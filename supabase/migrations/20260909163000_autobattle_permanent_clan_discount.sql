-- Founding clan members keep their 50% token-pack price permanently. Limited-use
-- entitlements remain available for future campaigns.

alter table public.autobattle_invite_codes
add column if not exists discount_unlimited boolean not null default false;

alter table public.autobattle_discount_entitlements
add column if not exists unlimited boolean not null default false;

update public.autobattle_invite_codes
set discount_unlimited = true
where campaign_key = 'founding-clan';

update public.autobattle_discount_entitlements as entitlement
set unlimited = true,
    remaining_uses = greatest(entitlement.remaining_uses, 1),
    status = 'active',
    updated_at = now()
from public.autobattle_code_redemptions as redemption
where entitlement.source_redemption_id = redemption.id
  and redemption.campaign_key = 'founding-clan';

create or replace function public.autobattle_redeem_invite_code(
    p_user_id uuid,
    p_code_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    invite public.autobattle_invite_codes%rowtype;
    redemption public.autobattle_code_redemptions%rowtype;
    balances public.autobattle_token_accounts%rowtype;
begin
    select * into invite
    from public.autobattle_invite_codes
    where code_hash = lower(btrim(p_code_hash))
    for update;
    if not found or not invite.active or
       (invite.starts_at is not null and invite.starts_at > now()) or
       (invite.expires_at is not null and invite.expires_at <= now()) then
        raise exception using errcode = 'P0001', message = 'invalid_invite_code';
    end if;

    select * into redemption
    from public.autobattle_code_redemptions
    where campaign_key = invite.campaign_key and user_id = p_user_id;
    if found then
        select * into balances from public.autobattle_token_accounts where user_id = p_user_id;
        return jsonb_build_object(
            'status', 'already_redeemed',
            'promotional', balances.promotional_balance,
            'discountPercent', invite.discount_percent,
            'discountUnlimited', invite.discount_unlimited
        );
    end if;

    if invite.redemption_count >= invite.max_redemptions then
        raise exception using errcode = 'P0001', message = 'invite_code_exhausted';
    end if;

    insert into public.autobattle_code_redemptions (code_id, campaign_key, user_id)
    values (invite.id, invite.campaign_key, p_user_id)
    returning * into redemption;

    update public.autobattle_invite_codes
    set redemption_count = redemption_count + 1
    where id = invite.id;

    update public.autobattle_profiles
    set access_status = case when access_status = 'suspended' then 'suspended' else 'beta' end,
        updated_at = now()
    where user_id = p_user_id;

    update public.autobattle_token_accounts
    set promotional_balance = promotional_balance + invite.promotional_tokens,
        updated_at = now()
    where user_id = p_user_id
    returning * into balances;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;

    insert into public.autobattle_token_ledger (
        user_id, entry_type, status, promotional_delta, idempotency_key,
        reference_id, metadata
    ) values (
        p_user_id, 'clan_grant', 'posted', invite.promotional_tokens,
        'clan:' || invite.campaign_key || ':' || p_user_id::text,
        redemption.id::text,
        jsonb_build_object(
            'campaign', invite.campaign_key,
            'label', invite.label,
            'discountUnlimited', invite.discount_unlimited
        )
    );

    insert into public.autobattle_discount_entitlements (
        user_id, source_redemption_id, percent_off, remaining_uses, unlimited
    ) values (
        p_user_id,
        redemption.id,
        invite.discount_percent,
        invite.discount_uses,
        invite.discount_unlimited
    );

    return jsonb_build_object(
        'status', 'redeemed',
        'promotionalGranted', invite.promotional_tokens,
        'promotional', balances.promotional_balance,
        'discountPercent', invite.discount_percent,
        'discountUses', invite.discount_uses,
        'discountUnlimited', invite.discount_unlimited
    );
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
    discount_unlimited boolean := false;
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
        if existing_order.discount_entitlement_id is not null then
            select * into entitlement
            from public.autobattle_discount_entitlements
            where id = existing_order.discount_entitlement_id;
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
            'discountUnlimited', coalesce(entitlement.unlimited, false),
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
          and (unlimited or remaining_uses > 0)
        order by unlimited desc, percent_off desc, created_at asc
        limit 1
        for update;
        if found then
            discount_percent := entitlement.percent_off;
            discount_unlimited := entitlement.unlimited;
        end if;
    end if;

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
        if existing_order.discount_entitlement_id is not null then
            select * into entitlement
            from public.autobattle_discount_entitlements
            where id = existing_order.discount_entitlement_id;
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
            'discountUnlimited', coalesce(entitlement.unlimited, false),
            'totalCents', existing_order.total_cents,
            'currency', existing_order.currency,
            'purchasedBalance', balances.purchased_balance,
            'bonusBalance', balances.bonus_balance,
            'promotionalBalance', balances.promotional_balance
        );
    end;

    if discount_percent > 0 and not discount_unlimited then
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
            'discountPercent', discount_percent,
            'discountUnlimited', discount_unlimited
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
        'discountUnlimited', discount_unlimited,
        'totalCents', final_cents,
        'currency', product.currency,
        'purchasedBalance', (grant_result ->> 'purchased')::bigint,
        'bonusBalance', (grant_result ->> 'bonus')::bigint,
        'promotionalBalance', (grant_result ->> 'promotional')::bigint
    );
end;
$$;

revoke all on function public.autobattle_redeem_invite_code(uuid, text)
from public, anon, authenticated;
revoke all on function public.autobattle_fulfill_manual_purchase(uuid, text, text, text, boolean)
from public, anon, authenticated;

grant execute on function public.autobattle_redeem_invite_code(uuid, text)
to service_role;
grant execute on function public.autobattle_fulfill_manual_purchase(uuid, text, text, text, boolean)
to service_role;

comment on column public.autobattle_discount_entitlements.unlimited is
'When true, purchases may apply this entitlement without decrementing remaining_uses.';
