alter table public.autobattle_orders
add column if not exists provider_payment_id text,
add column if not exists tax_cents integer not null default 0,
add column if not exists charged_total_cents integer;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'autobattle_orders_tax_cents_check'
          and conrelid = 'public.autobattle_orders'::regclass
    ) then
        alter table public.autobattle_orders
        add constraint autobattle_orders_tax_cents_check check (tax_cents >= 0);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'autobattle_orders_charged_total_check'
          and conrelid = 'public.autobattle_orders'::regclass
    ) then
        alter table public.autobattle_orders
        add constraint autobattle_orders_charged_total_check check (
            charged_total_cents is null or charged_total_cents = total_cents + tax_cents
        );
    end if;
end;
$$;

create index if not exists autobattle_orders_provider_payment_idx
on public.autobattle_orders (provider, provider_payment_id)
where provider_payment_id is not null;

create table if not exists public.autobattle_payment_events (
    id uuid primary key default extensions.gen_random_uuid(),
    provider text not null default 'stripe' check (char_length(provider) between 2 and 40),
    provider_event_id text not null unique check (char_length(provider_event_id) between 4 and 255),
    event_type text not null check (char_length(event_type) between 3 and 120),
    object_id text check (object_id is null or char_length(object_id) between 3 and 255),
    order_id uuid references public.autobattle_orders(id) on delete set null,
    livemode boolean not null default false,
    status text not null check (status in ('received', 'processed', 'ignored', 'needs_review', 'failed')),
    details jsonb not null default '{}'::jsonb,
    received_at timestamptz not null default now(),
    processed_at timestamptz
);

create index if not exists autobattle_payment_events_status_received_idx
on public.autobattle_payment_events (status, received_at desc);

create index if not exists autobattle_payment_events_order_idx
on public.autobattle_payment_events (order_id, received_at desc)
where order_id is not null;

alter table public.autobattle_payment_events enable row level security;
revoke all on table public.autobattle_payment_events from anon, authenticated;
grant select, insert, update on table public.autobattle_payment_events to service_role;

create or replace function public.autobattle_checkout_quote(
    p_user_id uuid,
    p_sku text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    product public.autobattle_products%rowtype;
    entitlement public.autobattle_discount_entitlements%rowtype;
    discount_percent integer := 0;
    final_cents integer;
begin
    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;
    if profile.access_status = 'suspended' then
        raise exception using errcode = 'P0001', message = 'account_suspended';
    end if;

    select * into product
    from public.autobattle_products
    where sku = btrim(p_sku) and active;
    if not found then
        raise exception using errcode = 'P0001', message = 'product_unavailable';
    end if;

    select entitlement_row.* into entitlement
    from public.autobattle_discount_entitlements entitlement_row
    join public.autobattle_code_redemptions redemption
      on redemption.id = entitlement_row.source_redemption_id
    where entitlement_row.user_id = p_user_id
      and entitlement_row.status = 'active'
      and entitlement_row.unlimited
      and entitlement_row.percent_off = 50
      and redemption.campaign_key = 'founding-clan'
    order by entitlement_row.created_at asc
    limit 1;
    if found then
        discount_percent := entitlement.percent_off;
    end if;

    final_cents := (product.price_cents * (100 - discount_percent) + 99) / 100;
    return jsonb_build_object(
        'sku', product.sku,
        'paidTokens', product.paid_tokens,
        'bonusTokens', product.bonus_tokens,
        'subtotalCents', product.price_cents,
        'discountCents', product.price_cents - final_cents,
        'discountPercent', discount_percent,
        'discountEntitlementId', case when discount_percent > 0 then entitlement.id else null end,
        'totalCents', final_cents,
        'currency', product.currency
    );
end;
$$;

create or replace function public.autobattle_record_stripe_event(
    p_event_id text,
    p_event_type text,
    p_object_id text,
    p_livemode boolean,
    p_status text,
    p_details jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    payment_event public.autobattle_payment_events%rowtype;
    inserted_count integer := 0;
begin
    if char_length(btrim(p_event_id)) not between 4 and 255
       or char_length(btrim(p_event_type)) not between 3 and 120
       or p_status not in ('failed', 'ignored', 'needs_review')
       or octet_length(coalesce(p_details, '{}'::jsonb)::text) > 4096 then
        raise exception using errcode = '22023', message = 'invalid_payment_event';
    end if;

    insert into public.autobattle_payment_events (
        provider_event_id, event_type, object_id, livemode, status, details, processed_at
    ) values (
        btrim(p_event_id), btrim(p_event_type), nullif(btrim(p_object_id), ''),
        coalesce(p_livemode, false), p_status, coalesce(p_details, '{}'::jsonb), now()
    ) on conflict (provider_event_id) do nothing;
    get diagnostics inserted_count = row_count;

    select * into payment_event
    from public.autobattle_payment_events
    where provider_event_id = btrim(p_event_id);

    return jsonb_build_object(
        'eventId', payment_event.provider_event_id,
        'status', payment_event.status,
        'alreadyRecorded', inserted_count = 0
    );
end;
$$;

create or replace function public.autobattle_fulfill_stripe_checkout(
    p_event_id text,
    p_event_type text,
    p_checkout_id text,
    p_payment_intent_id text,
    p_user_id uuid,
    p_sku text,
    p_currency text,
    p_amount_subtotal integer,
    p_amount_tax integer,
    p_amount_total integer,
    p_discount_percent integer,
    p_discount_entitlement_id uuid,
    p_livemode boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    product public.autobattle_products%rowtype;
    entitlement public.autobattle_discount_entitlements%rowtype;
    payment_event public.autobattle_payment_events%rowtype;
    existing_order public.autobattle_orders%rowtype;
    purchase_order public.autobattle_orders%rowtype;
    balances public.autobattle_token_accounts%rowtype;
    grant_result jsonb;
    expected_total integer;
    expected_discount integer;
begin
    if char_length(btrim(p_event_id)) not between 4 and 255
       or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
       or char_length(btrim(p_checkout_id)) not between 4 and 255
       or p_user_id is null
       or char_length(btrim(p_sku)) not between 3 and 64
       or p_currency !~ '^[a-z]{3}$'
       or p_amount_subtotal < 0
       or p_amount_tax < 0
       or p_amount_total < 0
       or p_amount_subtotal + p_amount_tax <> p_amount_total
       or p_discount_percent not in (0, 50) then
        raise exception using errcode = '22023', message = 'invalid_stripe_checkout';
    end if;

    insert into public.autobattle_payment_events (
        provider_event_id, event_type, object_id, livemode, status, details
    ) values (
        btrim(p_event_id), p_event_type, btrim(p_checkout_id),
        coalesce(p_livemode, false), 'received',
        jsonb_build_object('paymentIntentId', nullif(btrim(p_payment_intent_id), ''))
    ) on conflict (provider_event_id) do nothing;

    select * into payment_event
    from public.autobattle_payment_events
    where provider_event_id = btrim(p_event_id)
    for update;

    if payment_event.status = 'processed' and payment_event.order_id is not null then
        select * into balances from public.autobattle_token_accounts where user_id = p_user_id;
        return jsonb_build_object(
            'alreadyFulfilled', true,
            'orderId', payment_event.order_id,
            'purchasedBalance', balances.purchased_balance,
            'bonusBalance', balances.bonus_balance,
            'promotionalBalance', balances.promotional_balance
        );
    end if;

    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;
    if profile.access_status = 'suspended' then
        raise exception using errcode = 'P0001', message = 'account_suspended';
    end if;

    select * into product
    from public.autobattle_products
    where sku = btrim(p_sku) and active;
    if not found then
        raise exception using errcode = 'P0001', message = 'product_unavailable';
    end if;

    if p_discount_percent = 50 then
        select entitlement_row.* into entitlement
        from public.autobattle_discount_entitlements entitlement_row
        join public.autobattle_code_redemptions redemption
          on redemption.id = entitlement_row.source_redemption_id
        where entitlement_row.id = p_discount_entitlement_id
          and entitlement_row.user_id = p_user_id
          and entitlement_row.status = 'active'
          and entitlement_row.unlimited
          and entitlement_row.percent_off = 50
          and redemption.campaign_key = 'founding-clan';
        if not found then
            raise exception using errcode = 'P0001', message = 'discount_unavailable';
        end if;
    elsif p_discount_entitlement_id is not null then
        raise exception using errcode = '22023', message = 'unexpected_discount';
    end if;

    expected_total := (product.price_cents * (100 - p_discount_percent) + 99) / 100;
    expected_discount := product.price_cents - expected_total;
    if p_currency <> product.currency or p_amount_subtotal <> expected_total then
        raise exception using errcode = '22023', message = 'stripe_amount_mismatch';
    end if;

    select * into existing_order
    from public.autobattle_orders
    where provider = 'stripe' and provider_checkout_id = btrim(p_checkout_id);
    if found then
        if existing_order.user_id <> p_user_id
           or existing_order.sku <> product.sku
           or existing_order.status <> 'paid'
           or existing_order.subtotal_cents <> product.price_cents
           or existing_order.discount_cents <> expected_discount
           or existing_order.total_cents <> expected_total
           or existing_order.tax_cents <> p_amount_tax
           or existing_order.charged_total_cents <> p_amount_total then
            raise exception using errcode = '23505', message = 'stripe_checkout_conflict';
        end if;
        update public.autobattle_payment_events
        set status = 'processed', order_id = existing_order.id, processed_at = now()
        where id = payment_event.id;
        select * into balances from public.autobattle_token_accounts where user_id = p_user_id;
        return jsonb_build_object(
            'alreadyFulfilled', true,
            'orderId', existing_order.id,
            'purchasedBalance', balances.purchased_balance,
            'bonusBalance', balances.bonus_balance,
            'promotionalBalance', balances.promotional_balance
        );
    end if;

    insert into public.autobattle_orders (
        user_id, sku, provider, provider_checkout_id, provider_event_id,
        provider_payment_id, status, subtotal_cents, discount_cents,
        total_cents, tax_cents, charged_total_cents, currency,
        discount_entitlement_id, paid_at
    ) values (
        p_user_id, product.sku, 'stripe', btrim(p_checkout_id), btrim(p_event_id),
        nullif(btrim(p_payment_intent_id), ''), 'paid', product.price_cents, expected_discount,
        expected_total, p_amount_tax, p_amount_total, product.currency,
        p_discount_entitlement_id, now()
    ) returning * into purchase_order;

    grant_result := public.autobattle_grant_tokens(
        p_user_id,
        product.paid_tokens,
        product.bonus_tokens,
        0,
        'purchase',
        'purchase:stripe:' || btrim(p_checkout_id),
        purchase_order.id::text,
        jsonb_build_object(
            'provider', 'stripe',
            'checkoutId', btrim(p_checkout_id),
            'paymentIntentId', nullif(btrim(p_payment_intent_id), ''),
            'sku', product.sku,
            'subtotalCents', product.price_cents,
            'discountCents', expected_discount,
            'totalCents', expected_total,
            'taxCents', p_amount_tax,
            'chargedTotalCents', p_amount_total,
            'discountPercent', p_discount_percent,
            'discountUnlimited', p_discount_percent = 50,
            'livemode', coalesce(p_livemode, false)
        )
    );

    update public.autobattle_profiles
    set access_status = 'active', updated_at = now()
    where user_id = p_user_id and access_status <> 'suspended';

    update public.autobattle_payment_events
    set status = 'processed', order_id = purchase_order.id, processed_at = now()
    where id = payment_event.id;

    return jsonb_build_object(
        'alreadyFulfilled', false,
        'orderId', purchase_order.id,
        'sku', product.sku,
        'paidTokens', product.paid_tokens,
        'bonusTokens', product.bonus_tokens,
        'purchasedBalance', (grant_result ->> 'purchased')::bigint,
        'bonusBalance', (grant_result ->> 'bonus')::bigint,
        'promotionalBalance', (grant_result ->> 'promotional')::bigint
    );
end;
$$;

revoke all on function public.autobattle_checkout_quote(uuid, text)
from public, anon, authenticated;
revoke all on function public.autobattle_record_stripe_event(text, text, text, boolean, text, jsonb)
from public, anon, authenticated;
revoke all on function public.autobattle_fulfill_stripe_checkout(text, text, text, text, uuid, text, text, integer, integer, integer, integer, uuid, boolean)
from public, anon, authenticated;

grant execute on function public.autobattle_checkout_quote(uuid, text)
to service_role;
grant execute on function public.autobattle_record_stripe_event(text, text, text, boolean, text, jsonb)
to service_role;
grant execute on function public.autobattle_fulfill_stripe_checkout(text, text, text, text, uuid, text, text, integer, integer, integer, integer, uuid, boolean)
to service_role;

comment on table public.autobattle_payment_events is
'Minimal Stripe event audit log. Full webhook payloads and customer PII are intentionally not stored.';
comment on function public.autobattle_fulfill_stripe_checkout(text, text, text, text, uuid, text, text, integer, integer, integer, integer, uuid, boolean) is
'Atomically verifies a signed Stripe Checkout snapshot, records the order, and grants purchased and bonus tokens exactly once.';
