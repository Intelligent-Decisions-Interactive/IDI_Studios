-- Refer-a-friend rewards are server-owned and transactionally tied to verified
-- account signup, committed cycles, and verified Stripe purchases.

create table autobattle_private.autobattle_referral_codes (
    id uuid primary key default extensions.gen_random_uuid(),
    referrer_user_id uuid unique
        references public.autobattle_profiles(user_id) on delete set null,
    code text not null unique
        check (code ~ '^[A-F0-9]{12}$'),
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table autobattle_private.autobattle_referrals (
    id uuid primary key default extensions.gen_random_uuid(),
    referral_code_id uuid not null
        references autobattle_private.autobattle_referral_codes(id) on delete restrict,
    referrer_user_id uuid
        references public.autobattle_profiles(user_id) on delete set null,
    referee_user_id uuid unique
        references public.autobattle_profiles(user_id) on delete set null,
    referee_email_hash text not null unique
        check (referee_email_hash ~ '^[a-f0-9]{64}$'),
    signup_ledger_id uuid unique
        references public.autobattle_token_ledger(id) on delete set null,
    cycle_reward_ledger_id uuid unique
        references public.autobattle_token_ledger(id) on delete set null,
    purchase_reward_ledger_id uuid unique
        references public.autobattle_token_ledger(id) on delete set null,
    first_cycle_reference_id uuid unique
        references public.autobattle_token_ledger(id) on delete set null,
    first_purchase_order_id uuid unique
        references public.autobattle_orders(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint autobattle_referrals_distinct_accounts
        check (referrer_user_id is null or referee_user_id is null or referrer_user_id <> referee_user_id)
);

create index autobattle_referrals_referrer_created_idx
on autobattle_private.autobattle_referrals (referrer_user_id, created_at desc)
where referrer_user_id is not null;

revoke all on table
    autobattle_private.autobattle_referral_codes,
    autobattle_private.autobattle_referrals
from public, anon, authenticated, service_role;

alter table public.autobattle_discount_entitlements
alter column source_redemption_id drop not null;

alter table public.autobattle_discount_entitlements
add column source_referral_id uuid
references autobattle_private.autobattle_referrals(id) on delete restrict;

alter table public.autobattle_discount_entitlements
add constraint autobattle_discount_entitlements_source_referral_id_key
unique (source_referral_id);

alter table public.autobattle_discount_entitlements
add constraint autobattle_discount_entitlements_exactly_one_source
check (
    (source_redemption_id is not null and source_referral_id is null)
    or (source_redemption_id is null and source_referral_id is not null)
);

alter table public.autobattle_token_ledger
drop constraint autobattle_token_ledger_entry_type_check;

alter table public.autobattle_token_ledger
add constraint autobattle_token_ledger_entry_type_check
check (entry_type in (
    'admin_grant', 'clan_grant', 'purchase', 'cycle', 'refund', 'adjustment', 'referral'
));

create or replace function public.autobattle_grant_tokens(
    p_user_id uuid,
    p_purchased bigint,
    p_bonus bigint,
    p_promotional bigint,
    p_entry_type text,
    p_idempotency_key text,
    p_reference_id text default null,
    p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing public.autobattle_token_ledger%rowtype;
    balances public.autobattle_token_accounts%rowtype;
    grant_total numeric;
begin
    grant_total := coalesce(p_purchased, -1)::numeric
        + coalesce(p_bonus, -1)::numeric
        + coalesce(p_promotional, -1)::numeric;
    if coalesce(p_purchased, -1) < 0
       or coalesce(p_bonus, -1) < 0
       or coalesce(p_promotional, -1) < 0
       or grant_total < 1
       or grant_total > 100000 then
        raise exception using errcode = '22023', message = 'invalid_token_grant';
    end if;
    if p_entry_type not in (
        'admin_grant', 'clan_grant', 'purchase', 'refund', 'adjustment', 'referral'
    ) then
        raise exception using errcode = '22023', message = 'invalid_grant_type';
    end if;
    if char_length(p_idempotency_key) not between 8 and 160 then
        raise exception using errcode = '22023', message = 'invalid_grant_idempotency_key';
    end if;

    perform public.autobattle_assert_token_integrity(p_user_id);

    select * into existing
    from public.autobattle_token_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
        if existing.entry_type <> p_entry_type
           or existing.purchased_delta <> p_purchased
           or existing.bonus_delta <> p_bonus
           or existing.promotional_delta <> p_promotional
           or existing.reference_id is distinct from p_reference_id then
            raise exception using errcode = '23505', message = 'grant_idempotency_conflict';
        end if;
        select * into balances from public.autobattle_token_accounts where user_id = p_user_id;
        return jsonb_build_object(
            'ledgerId', existing.id,
            'status', existing.status,
            'purchased', balances.purchased_balance,
            'bonus', balances.bonus_balance,
            'promotional', balances.promotional_balance
        );
    end if;

    update public.autobattle_token_accounts
    set purchased_balance = purchased_balance + p_purchased,
        bonus_balance = bonus_balance + p_bonus,
        promotional_balance = promotional_balance + p_promotional,
        updated_at = now()
    where user_id = p_user_id
    returning * into balances;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;

    insert into public.autobattle_token_ledger (
        user_id, entry_type, status, purchased_delta, bonus_delta,
        promotional_delta, idempotency_key, reference_id, metadata
    ) values (
        p_user_id, p_entry_type, 'posted', p_purchased, p_bonus,
        p_promotional, p_idempotency_key, p_reference_id, coalesce(p_metadata, '{}'::jsonb)
    ) returning * into existing;

    return jsonb_build_object(
        'ledgerId', existing.id,
        'status', existing.status,
        'purchased', balances.purchased_balance,
        'bonus', balances.bonus_balance,
        'promotional', balances.promotional_balance
    );
end;
$$;

create or replace function public.autobattle_get_referral_summary(
    p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    referral_code autobattle_private.autobattle_referral_codes%rowtype;
    candidate text;
    referred_count bigint := 0;
    cycle_reward_count bigint := 0;
    purchase_reward_count bigint := 0;
    attempt integer;
begin
    if not exists (
        select 1 from public.autobattle_profiles where user_id = p_user_id
    ) then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;

    select * into referral_code
    from autobattle_private.autobattle_referral_codes
    where referrer_user_id = p_user_id;

    if not found then
        for attempt in 1..16 loop
            candidate := upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 12));
            begin
                insert into autobattle_private.autobattle_referral_codes (
                    referrer_user_id, code
                ) values (
                    p_user_id, candidate
                )
                on conflict (referrer_user_id) do nothing
                returning * into referral_code;
            exception when unique_violation then
                referral_code.id := null;
            end;

            if referral_code.id is null then
                select * into referral_code
                from autobattle_private.autobattle_referral_codes
                where referrer_user_id = p_user_id;
            end if;
            exit when referral_code.id is not null;
        end loop;
    end if;

    if referral_code.id is null then
        raise exception using errcode = 'P0001', message = 'referral_code_unavailable';
    end if;

    if not referral_code.active then
        update autobattle_private.autobattle_referral_codes
        set active = true
        where id = referral_code.id;
        referral_code.active := true;
    end if;

    select
        count(*),
        count(cycle_reward_ledger_id),
        count(purchase_reward_ledger_id)
    into referred_count, cycle_reward_count, purchase_reward_count
    from autobattle_private.autobattle_referrals
    where referrer_user_id = p_user_id;

    return jsonb_build_object(
        'code', referral_code.code,
        'referredCount', referred_count,
        'cycleRewardCount', cycle_reward_count,
        'purchaseRewardCount', purchase_reward_count,
        'earnedCredits', (cycle_reward_count + purchase_reward_count) * 30
    );
end;
$$;

create or replace function public.autobattle_claim_referral(
    p_user_id uuid,
    p_code text,
    p_capability text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    referrer_profile public.autobattle_profiles%rowtype;
    referral_code autobattle_private.autobattle_referral_codes%rowtype;
    existing_referral autobattle_private.autobattle_referrals%rowtype;
    referral autobattle_private.autobattle_referrals%rowtype;
    grant_result jsonb;
    normalized_code text;
    email_hash text;
begin
    perform autobattle_private.require_capability('credit_mint', p_capability);
    normalized_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    if normalized_code !~ '^[A-F0-9]{12}$' then
        raise exception using errcode = '22023', message = 'invalid_referral_code';
    end if;

    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;
    email_hash := encode(extensions.digest(profile.email, 'sha256'), 'hex');

    select * into referral_code
    from autobattle_private.autobattle_referral_codes
    where code = normalized_code and active
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'invalid_referral_code';
    end if;

    select * into referrer_profile
    from public.autobattle_profiles
    where user_id = referral_code.referrer_user_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'invalid_referral_code';
    end if;
    if referral_code.referrer_user_id = p_user_id
       or encode(extensions.digest(referrer_profile.email, 'sha256'), 'hex') = email_hash then
        raise exception using errcode = '22023', message = 'self_referral_not_allowed';
    end if;

    select * into existing_referral
    from autobattle_private.autobattle_referrals
    where referee_user_id = p_user_id or referee_email_hash = email_hash
    order by created_at asc
    limit 1
    for update;
    if found then
        if existing_referral.referee_user_id = p_user_id
           and existing_referral.referrer_user_id = referral_code.referrer_user_id then
            return jsonb_build_object(
                'claimed', false,
                'alreadyClaimed', true,
                'referralId', existing_referral.id
            );
        end if;
        raise exception using errcode = 'P0001', message = 'referral_already_claimed';
    end if;

    if exists (
        select 1 from public.autobattle_token_ledger where user_id = p_user_id
    ) or exists (
        select 1 from public.autobattle_orders where user_id = p_user_id
    ) then
        raise exception using errcode = 'P0001', message = 'referral_signup_offer_unavailable';
    end if;

    insert into autobattle_private.autobattle_referrals (
        referral_code_id,
        referrer_user_id,
        referee_user_id,
        referee_email_hash
    ) values (
        referral_code.id,
        referral_code.referrer_user_id,
        p_user_id,
        email_hash
    ) returning * into referral;

    grant_result := public.autobattle_grant_tokens(
        p_user_id,
        0,
        0,
        30,
        'referral',
        'referral:signup:' || referral.id::text,
        referral.id::text,
        jsonb_build_object(
            'milestone', 'signup',
            'referralId', referral.id
        )
    );

    update autobattle_private.autobattle_referrals
    set signup_ledger_id = (grant_result ->> 'ledgerId')::uuid,
        updated_at = now()
    where id = referral.id;

    insert into public.autobattle_discount_entitlements (
        user_id,
        source_redemption_id,
        source_referral_id,
        percent_off,
        remaining_uses,
        unlimited
    ) values (
        p_user_id,
        null,
        referral.id,
        50,
        1,
        false
    );

    return jsonb_build_object(
        'claimed', true,
        'alreadyClaimed', false,
        'referralId', referral.id,
        'promotionalCredits', 30,
        'discountPercent', 50,
        'discountUses', 1
    );
end;
$$;

create or replace function autobattle_private.reward_referrer(
    p_referee_user_id uuid,
    p_milestone text,
    p_reference_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    referral autobattle_private.autobattle_referrals%rowtype;
    grant_result jsonb;
begin
    if p_milestone not in ('cycle', 'purchase') or p_reference_id is null then
        raise exception using errcode = '22023', message = 'invalid_referral_milestone';
    end if;

    select * into referral
    from autobattle_private.autobattle_referrals
    where referee_user_id = p_referee_user_id
    for update;
    if not found or referral.referrer_user_id is null then
        return jsonb_build_object('rewarded', false, 'reason', 'no_referral');
    end if;

    if p_milestone = 'cycle' and referral.cycle_reward_ledger_id is not null then
        return jsonb_build_object('rewarded', false, 'reason', 'already_rewarded');
    end if;
    if p_milestone = 'purchase' and referral.purchase_reward_ledger_id is not null then
        return jsonb_build_object('rewarded', false, 'reason', 'already_rewarded');
    end if;

    grant_result := public.autobattle_grant_tokens(
        referral.referrer_user_id,
        0,
        0,
        30,
        'referral',
        'referral:' || p_milestone || ':' || referral.id::text,
        p_reference_id::text,
        jsonb_build_object(
            'milestone', p_milestone,
            'referralId', referral.id,
            'refereeUserId', p_referee_user_id,
            'sourceReferenceId', p_reference_id
        )
    );

    if p_milestone = 'cycle' then
        update autobattle_private.autobattle_referrals
        set cycle_reward_ledger_id = (grant_result ->> 'ledgerId')::uuid,
            first_cycle_reference_id = p_reference_id,
            updated_at = now()
        where id = referral.id;
    else
        update autobattle_private.autobattle_referrals
        set purchase_reward_ledger_id = (grant_result ->> 'ledgerId')::uuid,
            first_purchase_order_id = p_reference_id,
            updated_at = now()
        where id = referral.id;
    end if;

    return jsonb_build_object(
        'rewarded', true,
        'referralId', referral.id,
        'milestone', p_milestone,
        'promotionalCredits', 30
    );
end;
$$;

create or replace function public.autobattle_commit_cycle(
    p_user_id uuid,
    p_reservation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    entry public.autobattle_token_ledger%rowtype;
    profile public.autobattle_profiles%rowtype;
    referral_reward jsonb;
begin
    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;

    select * into entry
    from public.autobattle_token_ledger
    where id = p_reservation_id and user_id = p_user_id and entry_type = 'cycle'
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'reservation_not_found';
    end if;
    if entry.status = 'released' then
        raise exception using errcode = 'P0001', message = 'reservation_already_released';
    end if;
    if entry.status = 'reserved' then
        update public.autobattle_token_ledger
        set status = 'committed', updated_at = now()
        where id = entry.id;
        entry.status := 'committed';
    end if;

    referral_reward := autobattle_private.reward_referrer(p_user_id, 'cycle', entry.id);
    return jsonb_build_object(
        'reservationId', entry.id,
        'status', entry.status,
        'referralRewarded', coalesce((referral_reward ->> 'rewarded')::boolean, false)
    );
end;
$$;

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

    select * into entitlement
    from public.autobattle_discount_entitlements
    where user_id = p_user_id
      and status = 'active'
      and (unlimited or remaining_uses > 0)
    order by unlimited desc, percent_off desc, created_at asc
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

create or replace function public.autobattle_fulfill_stripe_checkout_unchecked(
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
    referral_reward jsonb;
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
        select * into entitlement
        from public.autobattle_discount_entitlements
        where id = p_discount_entitlement_id
          and user_id = p_user_id
          and status = 'active'
          and percent_off = 50
          and (unlimited or remaining_uses > 0)
        for update;
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
            'discountUnlimited', coalesce(entitlement.unlimited, false),
            'livemode', coalesce(p_livemode, false)
        )
    );

    if p_discount_entitlement_id is not null and not entitlement.unlimited then
        update public.autobattle_discount_entitlements
        set remaining_uses = remaining_uses - 1,
            status = case when remaining_uses <= 1 then 'redeemed' else status end,
            updated_at = now()
        where id = entitlement.id;
    end if;

    referral_reward := autobattle_private.reward_referrer(p_user_id, 'purchase', purchase_order.id);

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
        'promotionalBalance', (grant_result ->> 'promotional')::bigint,
        'referralRewarded', coalesce((referral_reward ->> 'rewarded')::boolean, false)
    );
end;
$$;

revoke all on function public.autobattle_get_referral_summary(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.autobattle_claim_referral(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function autobattle_private.reward_referrer(uuid, text, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.autobattle_get_referral_summary(uuid)
to service_role;
grant execute on function public.autobattle_claim_referral(uuid, text, text)
to service_role;

comment on table autobattle_private.autobattle_referrals is
'Immutable email-level referral claims with one idempotent reward per qualifying milestone.';
comment on column autobattle_private.autobattle_referrals.referee_email_hash is
'SHA-256 of the normalized, verified account email. Retained to prevent repeated signup rewards after account recreation.';
