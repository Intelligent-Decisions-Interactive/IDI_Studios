-- AutoBattle token integrity and least-privilege hardening.
--
-- The token ledger is authoritative. Deferred constraint triggers allow the
-- existing atomic workflows to update the cached balance and ledger in either
-- order, while rejecting any transaction that leaves them out of sync.

create schema if not exists autobattle_private;
revoke all on schema autobattle_private from public, anon, authenticated, service_role;

create table if not exists autobattle_private.capability_verifiers (
    capability text primary key check (capability ~ '^[a-z][a-z0-9_]{2,63}$'),
    secret_sha256 text not null check (secret_sha256 ~ '^[a-f0-9]{64}$'),
    updated_at timestamptz not null default now()
);

revoke all on table autobattle_private.capability_verifiers
from public, anon, authenticated, service_role;

insert into autobattle_private.capability_verifiers (capability, secret_sha256)
values (
    'credit_mint',
    'a44d335cbf1d024bf037e770433e8995eb95c88dc53e2a9f5dd6f77ce4cbbe7b'
)
on conflict (capability) do update set
    secret_sha256 = excluded.secret_sha256,
    updated_at = now();

create or replace function autobattle_private.require_capability(
    p_capability text,
    p_secret text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    expected_hash text;
begin
    select secret_sha256 into expected_hash
    from autobattle_private.capability_verifiers
    where capability = p_capability;

    if expected_hash is null
       or p_secret is null
       or char_length(p_secret) < 32
       or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> expected_hash then
        raise exception using errcode = '42501', message = 'invalid_autobattle_capability';
    end if;
end;
$$;

revoke all on function autobattle_private.require_capability(text, text)
from public, anon, authenticated, service_role;

-- Remove the deliberate table-editor balance change and preserve every
-- legitimate purchase, invite grant, reservation, commit, and release recorded
-- in the ledger.
with ledger_balances as (
    select
        user_id,
        coalesce(sum(purchased_delta) filter (where status <> 'released'), 0) as purchased,
        coalesce(sum(bonus_delta) filter (where status <> 'released'), 0) as bonus,
        coalesce(sum(promotional_delta) filter (where status <> 'released'), 0) as promotional
    from public.autobattle_token_ledger
    group by user_id
)
update public.autobattle_token_accounts account
set purchased_balance = coalesce(ledger.purchased, 0),
    bonus_balance = coalesce(ledger.bonus, 0),
    promotional_balance = coalesce(ledger.promotional, 0),
    updated_at = now()
from (
    select
        account_row.user_id,
        ledger_balances.purchased,
        ledger_balances.bonus,
        ledger_balances.promotional
    from public.autobattle_token_accounts account_row
    left join ledger_balances using (user_id)
) ledger
where account.user_id = ledger.user_id;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'autobattle_token_accounts_purchased_cap') then
        alter table public.autobattle_token_accounts
        add constraint autobattle_token_accounts_purchased_cap
        check (purchased_balance between 0 and 1000000);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'autobattle_token_accounts_bonus_cap') then
        alter table public.autobattle_token_accounts
        add constraint autobattle_token_accounts_bonus_cap
        check (bonus_balance between 0 and 1000000);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'autobattle_token_accounts_promotional_cap') then
        alter table public.autobattle_token_accounts
        add constraint autobattle_token_accounts_promotional_cap
        check (promotional_balance between 0 and 1000000);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'autobattle_token_ledger_delta_cap') then
        alter table public.autobattle_token_ledger
        add constraint autobattle_token_ledger_delta_cap
        check (
            purchased_delta between -100000 and 100000
            and bonus_delta between -100000 and 100000
            and promotional_delta between -100000 and 100000
        );
    end if;
    if not exists (select 1 from pg_constraint where conname = 'autobattle_products_token_cap') then
        alter table public.autobattle_products
        add constraint autobattle_products_token_cap
        check (paid_tokens between 1 and 10000 and bonus_tokens between 0 and 10000);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'autobattle_products_price_cap') then
        alter table public.autobattle_products
        add constraint autobattle_products_price_cap
        check (price_cents between 1 and 1000000);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'autobattle_invite_grant_cap') then
        alter table public.autobattle_invite_codes
        add constraint autobattle_invite_grant_cap
        check (
            promotional_tokens between 0 and 1000
            and discount_uses between 1 and 100
            and max_redemptions between 1 and 10000
        );
    end if;
end;
$$;

create or replace function public.autobattle_assert_token_integrity(
    p_user_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    account public.autobattle_token_accounts%rowtype;
    expected_purchased bigint := 0;
    expected_bonus bigint := 0;
    expected_promotional bigint := 0;
    ledger_exists boolean := false;
begin
    select * into account
    from public.autobattle_token_accounts
    where user_id = p_user_id;

    select
        coalesce(sum(purchased_delta) filter (where status <> 'released'), 0),
        coalesce(sum(bonus_delta) filter (where status <> 'released'), 0),
        coalesce(sum(promotional_delta) filter (where status <> 'released'), 0),
        count(*) > 0
    into expected_purchased, expected_bonus, expected_promotional, ledger_exists
    from public.autobattle_token_ledger
    where user_id = p_user_id;

    if not found then
        return;
    end if;

    if account.user_id is null then
        if ledger_exists then
            raise exception using errcode = 'P0001', message = 'token_balance_integrity_violation';
        end if;
        return;
    end if;

    if account.purchased_balance <> expected_purchased
       or account.bonus_balance <> expected_bonus
       or account.promotional_balance <> expected_promotional then
        raise exception using errcode = 'P0001', message = 'token_balance_integrity_violation';
    end if;
end;
$$;

revoke all on function public.autobattle_assert_token_integrity(uuid)
from public, anon, authenticated;
grant execute on function public.autobattle_assert_token_integrity(uuid) to service_role;

create or replace function public.autobattle_enforce_token_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.autobattle_assert_token_integrity(coalesce(new.user_id, old.user_id));
    return null;
end;
$$;

revoke all on function public.autobattle_enforce_token_integrity()
from public, anon, authenticated, service_role;

drop trigger if exists autobattle_token_accounts_integrity on public.autobattle_token_accounts;
create constraint trigger autobattle_token_accounts_integrity
after insert or update or delete on public.autobattle_token_accounts
deferrable initially deferred
for each row execute function public.autobattle_enforce_token_integrity();

drop trigger if exists autobattle_token_ledger_integrity on public.autobattle_token_ledger;
create constraint trigger autobattle_token_ledger_integrity
after insert or update or delete on public.autobattle_token_ledger
deferrable initially deferred
for each row execute function public.autobattle_enforce_token_integrity();

-- Cap each internal grant and reject reuse of an idempotency key with different
-- semantics. This function remains callable by other postgres-owned security
-- definer functions, but no longer by the Worker role itself.
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
    if p_entry_type not in ('admin_grant', 'clan_grant', 'purchase', 'refund', 'adjustment') then
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

revoke all on function public.autobattle_grant_tokens(uuid, bigint, bigint, bigint, text, text, text, jsonb)
from public, anon, authenticated, service_role;

-- Wrap every public credit-minting workflow in a second capability that is
-- independent of the Supabase service key.
alter function public.autobattle_redeem_invite_code(uuid, text)
rename to autobattle_redeem_invite_code_unchecked;
revoke all on function public.autobattle_redeem_invite_code_unchecked(uuid, text)
from public, anon, authenticated, service_role;

create function public.autobattle_redeem_invite_code(
    p_user_id uuid,
    p_code_hash text,
    p_capability text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform autobattle_private.require_capability('credit_mint', p_capability);
    perform public.autobattle_assert_token_integrity(p_user_id);
    return public.autobattle_redeem_invite_code_unchecked(p_user_id, p_code_hash);
end;
$$;

revoke all on function public.autobattle_redeem_invite_code(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.autobattle_redeem_invite_code(uuid, text, text)
to service_role;

alter function public.autobattle_fulfill_stripe_checkout(
    text, text, text, text, uuid, text, text,
    integer, integer, integer, integer, uuid, boolean
) rename to autobattle_fulfill_stripe_checkout_unchecked;
revoke all on function public.autobattle_fulfill_stripe_checkout_unchecked(
    text, text, text, text, uuid, text, text,
    integer, integer, integer, integer, uuid, boolean
) from public, anon, authenticated, service_role;

create function public.autobattle_fulfill_stripe_checkout(
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
    p_livemode boolean,
    p_capability text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform autobattle_private.require_capability('credit_mint', p_capability);
    perform public.autobattle_assert_token_integrity(p_user_id);
    return public.autobattle_fulfill_stripe_checkout_unchecked(
        p_event_id,
        p_event_type,
        p_checkout_id,
        p_payment_intent_id,
        p_user_id,
        p_sku,
        p_currency,
        p_amount_subtotal,
        p_amount_tax,
        p_amount_total,
        p_discount_percent,
        p_discount_entitlement_id,
        p_livemode
    );
end;
$$;

revoke all on function public.autobattle_fulfill_stripe_checkout(
    text, text, text, text, uuid, text, text,
    integer, integer, integer, integer, uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.autobattle_fulfill_stripe_checkout(
    text, text, text, text, uuid, text, text,
    integer, integer, integer, integer, uuid, boolean, text
) to service_role;

-- Manual fulfillment is retired now that Stripe PaymentIntents are live.
revoke all on function public.autobattle_fulfill_manual_purchase(uuid, text, text, text, boolean)
from service_role;

-- Remove broad service-role DML and grant only the columns used by the Worker.
revoke all privileges on table
    public.autobattle_profiles,
    public.autobattle_token_accounts,
    public.autobattle_token_ledger,
    public.autobattle_products,
    public.autobattle_invite_codes,
    public.autobattle_code_redemptions,
    public.autobattle_discount_entitlements,
    public.autobattle_device_link_codes,
    public.autobattle_device_sessions,
    public.autobattle_orders,
    public.autobattle_payment_events
from service_role;

grant select on table
    public.autobattle_profiles,
    public.autobattle_token_accounts,
    public.autobattle_token_ledger,
    public.autobattle_invite_codes,
    public.autobattle_code_redemptions,
    public.autobattle_discount_entitlements,
    public.autobattle_device_sessions
to service_role;

grant update (player_name, access_status, updated_at)
on public.autobattle_profiles to service_role;

grant insert (
    code_hash,
    campaign_key,
    label,
    promotional_tokens,
    discount_percent,
    discount_uses,
    discount_unlimited,
    max_redemptions,
    assigned_user_id,
    created_by
) on public.autobattle_invite_codes to service_role;
grant update (active) on public.autobattle_invite_codes to service_role;

grant insert (user_id, code_hash, expires_at)
on public.autobattle_device_link_codes to service_role;

grant update (last_seen_at, revoked_at)
on public.autobattle_device_sessions to service_role;

comment on function public.autobattle_assert_token_integrity(uuid) is
'Fails closed when the cached token balance differs from the authoritative non-released ledger.';
comment on table autobattle_private.capability_verifiers is
'SHA-256 verifiers for high-impact Worker capabilities. Plaintext capability values are stored only as Cloudflare secrets.';
