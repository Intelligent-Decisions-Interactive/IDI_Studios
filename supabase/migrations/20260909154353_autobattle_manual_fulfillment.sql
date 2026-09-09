-- Admin-recorded payments for the first public beta. Payment is confirmed outside
-- AutoBattle, then this service-role-only function records and fulfills it once.

create index if not exists autobattle_orders_sku_idx
on public.autobattle_orders (sku);

create index if not exists autobattle_orders_discount_entitlement_idx
on public.autobattle_orders (discount_entitlement_id)
where discount_entitlement_id is not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'autobattle_orders_checkout_id_length'
          and conrelid = 'public.autobattle_orders'::regclass
    ) then
        alter table public.autobattle_orders
        add constraint autobattle_orders_checkout_id_length
        check (char_length(btrim(provider_checkout_id)) between 4 and 160);
    end if;
end;
$$;

create or replace function public.autobattle_fulfill_manual_purchase(
    p_user_id uuid,
    p_sku text,
    p_payment_reference text,
    p_created_by text,
    p_apply_discount boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    product public.autobattle_products%rowtype;
    entitlement public.autobattle_discount_entitlements%rowtype;
    existing_order public.autobattle_orders%rowtype;
    purchase_order public.autobattle_orders%rowtype;
    balances public.autobattle_token_accounts%rowtype;
    grant_result jsonb;
    normalized_reference text := btrim(p_payment_reference);
    normalized_actor text := lower(btrim(p_created_by));
    discount_percent integer := 0;
    final_cents integer;
    applied_discount_cents integer;
begin
    if p_user_id is null or char_length(btrim(p_sku)) < 3 then
        raise exception using errcode = '22023', message = 'invalid_purchase';
    end if;
    if char_length(normalized_reference) not between 4 and 160 then
        raise exception using errcode = '22023', message = 'invalid_payment_reference';
    end if;
    if char_length(normalized_actor) not between 3 and 320 then
        raise exception using errcode = '22023', message = 'invalid_purchase_actor';
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

    select * into existing_order
    from public.autobattle_orders
    where provider = 'manual' and provider_checkout_id = normalized_reference;
    if found then
        if existing_order.user_id <> p_user_id or existing_order.sku <> product.sku then
            raise exception using errcode = '23505', message = 'payment_reference_conflict';
        end if;
        select * into balances
        from public.autobattle_token_accounts
        where user_id = p_user_id;
        return jsonb_build_object(
            'alreadyFulfilled', true,
            'orderId', existing_order.id,
            'sku', existing_order.sku,
            'paidTokens', product.paid_tokens,
            'bonusTokens', product.bonus_tokens,
            'subtotalCents', existing_order.subtotal_cents,
            'discountCents', existing_order.discount_cents,
            'totalCents', existing_order.total_cents,
            'currency', existing_order.currency,
            'purchasedBalance', balances.purchased_balance,
            'bonusBalance', balances.bonus_balance,
            'promotionalBalance', balances.promotional_balance
        );
    end if;

    if coalesce(p_apply_discount, true) then
        select * into entitlement
        from public.autobattle_discount_entitlements
        where user_id = p_user_id
          and status = 'active'
          and remaining_uses > 0
        order by created_at asc
        limit 1
        for update;
        if found then
            discount_percent := entitlement.percent_off;
        end if;
    end if;

    -- The customer-facing total rounds up to the nearest cent. A 50% discount
    -- on $4.99 is therefore $2.50 rather than silently rounding down to $2.49.
    final_cents := (product.price_cents * (100 - discount_percent) + 99) / 100;
    applied_discount_cents := product.price_cents - final_cents;

    begin
        insert into public.autobattle_orders (
            user_id, sku, provider, provider_checkout_id, status,
            subtotal_cents, discount_cents, total_cents, currency,
            discount_entitlement_id, paid_at
        ) values (
            p_user_id, product.sku, 'manual', normalized_reference, 'paid',
            product.price_cents, applied_discount_cents, final_cents, product.currency,
            case when discount_percent > 0 then entitlement.id else null end, now()
        ) returning * into purchase_order;
    exception when unique_violation then
        select * into existing_order
        from public.autobattle_orders
        where provider = 'manual' and provider_checkout_id = normalized_reference;
        if not found or existing_order.user_id <> p_user_id or existing_order.sku <> product.sku then
            raise exception using errcode = '23505', message = 'payment_reference_conflict';
        end if;
        select * into balances
        from public.autobattle_token_accounts
        where user_id = p_user_id;
        return jsonb_build_object(
            'alreadyFulfilled', true,
            'orderId', existing_order.id,
            'sku', existing_order.sku,
            'paidTokens', product.paid_tokens,
            'bonusTokens', product.bonus_tokens,
            'subtotalCents', existing_order.subtotal_cents,
            'discountCents', existing_order.discount_cents,
            'totalCents', existing_order.total_cents,
            'currency', existing_order.currency,
            'purchasedBalance', balances.purchased_balance,
            'bonusBalance', balances.bonus_balance,
            'promotionalBalance', balances.promotional_balance
        );
    end;

    if discount_percent > 0 then
        update public.autobattle_discount_entitlements
        set remaining_uses = remaining_uses - 1,
            status = case when remaining_uses = 1 then 'redeemed' else 'active' end,
            updated_at = now()
        where id = entitlement.id;
    end if;

    grant_result := public.autobattle_grant_tokens(
        p_user_id,
        product.paid_tokens,
        product.bonus_tokens,
        0,
        'purchase',
        'purchase:manual:' || purchase_order.id::text,
        purchase_order.id::text,
        jsonb_build_object(
            'provider', 'manual',
            'paymentReference', normalized_reference,
            'recordedBy', normalized_actor,
            'sku', product.sku,
            'subtotalCents', product.price_cents,
            'discountCents', applied_discount_cents,
            'totalCents', final_cents,
            'discountPercent', discount_percent
        )
    );

    update public.autobattle_profiles
    set access_status = 'active', updated_at = now()
    where user_id = p_user_id and access_status <> 'suspended';

    return jsonb_build_object(
        'alreadyFulfilled', false,
        'orderId', purchase_order.id,
        'sku', product.sku,
        'paidTokens', product.paid_tokens,
        'bonusTokens', product.bonus_tokens,
        'subtotalCents', product.price_cents,
        'discountCents', applied_discount_cents,
        'discountPercent', discount_percent,
        'totalCents', final_cents,
        'currency', product.currency,
        'purchasedBalance', (grant_result ->> 'purchased')::bigint,
        'bonusBalance', (grant_result ->> 'bonus')::bigint,
        'promotionalBalance', (grant_result ->> 'promotional')::bigint
    );
end;
$$;

revoke all on function public.autobattle_fulfill_manual_purchase(uuid, text, text, text, boolean)
from public, anon, authenticated;

grant execute on function public.autobattle_fulfill_manual_purchase(uuid, text, text, text, boolean)
to service_role;

comment on function public.autobattle_fulfill_manual_purchase(uuid, text, text, text, boolean) is
'Records a confirmed external payment and fulfills its AutoBattle token pack exactly once.';
