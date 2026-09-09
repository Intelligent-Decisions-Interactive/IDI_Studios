alter table public.autobattle_orders
add column if not exists tax_behavior text not null default 'exclusive';

alter table public.autobattle_orders
drop constraint if exists autobattle_orders_charged_total_check;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'autobattle_orders_tax_behavior_check'
          and conrelid = 'public.autobattle_orders'::regclass
    ) then
        alter table public.autobattle_orders
        add constraint autobattle_orders_tax_behavior_check
        check (tax_behavior in ('exclusive', 'inclusive'));
    end if;
end;
$$;

alter table public.autobattle_orders
add constraint autobattle_orders_charged_total_check check (
    charged_total_cents is null
    or (
        tax_behavior = 'exclusive'
        and charged_total_cents = total_cents + tax_cents
    )
    or (
        tax_behavior = 'inclusive'
        and charged_total_cents = total_cents
        and tax_cents <= total_cents
    )
);

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
    payment_tax_behavior text;
begin
    payment_tax_behavior := case
        when p_event_type = 'payment_intent.succeeded' then 'inclusive'
        else 'exclusive'
    end;
    if char_length(btrim(p_event_id)) not between 4 and 255
       or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded')
       or char_length(btrim(p_checkout_id)) not between 4 and 255
       or p_user_id is null
       or char_length(btrim(p_sku)) not between 3 and 64
       or p_currency !~ '^[a-z]{3}$'
       or p_amount_subtotal < 0
       or p_amount_tax < 0
       or p_amount_total < 0
       or (
           payment_tax_behavior = 'exclusive'
           and p_amount_subtotal + p_amount_tax <> p_amount_total
       )
       or (
           payment_tax_behavior = 'inclusive'
           and (p_amount_subtotal <> p_amount_total or p_amount_tax > p_amount_total)
       )
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
           or existing_order.charged_total_cents <> p_amount_total
           or existing_order.tax_behavior <> payment_tax_behavior then
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
        total_cents, tax_cents, charged_total_cents, tax_behavior, currency,
        discount_entitlement_id, paid_at
    ) values (
        p_user_id, product.sku, 'stripe', btrim(p_checkout_id), btrim(p_event_id),
        nullif(btrim(p_payment_intent_id), ''), 'paid', product.price_cents, expected_discount,
        expected_total, p_amount_tax, p_amount_total, payment_tax_behavior, product.currency,
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
            'taxBehavior', payment_tax_behavior,
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
revoke all on function public.autobattle_fulfill_stripe_checkout(text, text, text, text, uuid, text, text, integer, integer, integer, integer, uuid, boolean)
from public, anon, authenticated;

grant execute on function public.autobattle_fulfill_stripe_checkout(text, text, text, text, uuid, text, text, integer, integer, integer, integer, uuid, boolean)
to service_role;

comment on function public.autobattle_fulfill_stripe_checkout(text, text, text, text, uuid, text, text, integer, integer, integer, integer, uuid, boolean) is
'Atomically verifies a signed Stripe Checkout or native PaymentIntent snapshot, records the order, and grants purchased and bonus tokens exactly once.';
