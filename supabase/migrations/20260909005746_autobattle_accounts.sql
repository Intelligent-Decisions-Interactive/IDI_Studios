-- AutoBattle accounts, usage tokens, invite codes, and purchase-ready catalog.
-- Public clients never receive service-role access. The IDI Worker is the sole
-- writer and all privileged functions explicitly revoke PUBLIC execution.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.autobattle_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null check (
        email = lower(btrim(email))
        and char_length(email) between 3 and 320
    ),
    player_name text check (
        player_name is null
        or char_length(btrim(player_name)) between 1 and 80
    ),
    access_status text not null default 'pending' check (
        access_status in ('pending', 'beta', 'active', 'suspended')
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists autobattle_profiles_email_idx
on public.autobattle_profiles (email);

create table if not exists public.autobattle_token_accounts (
    user_id uuid primary key references public.autobattle_profiles(user_id) on delete cascade,
    purchased_balance bigint not null default 0 check (purchased_balance >= 0),
    bonus_balance bigint not null default 0 check (bonus_balance >= 0),
    promotional_balance bigint not null default 0 check (promotional_balance >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.autobattle_token_ledger (
    id uuid primary key default extensions.gen_random_uuid(),
    user_id uuid not null references public.autobattle_profiles(user_id) on delete cascade,
    entry_type text not null check (
        entry_type in ('admin_grant', 'clan_grant', 'purchase', 'cycle', 'refund', 'adjustment')
    ),
    status text not null check (status in ('posted', 'reserved', 'committed', 'released')),
    purchased_delta bigint not null default 0,
    bonus_delta bigint not null default 0,
    promotional_delta bigint not null default 0,
    idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
    reference_id text,
    metadata jsonb not null default '{}'::jsonb,
    reservation_expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, idempotency_key),
    check (purchased_delta <> 0 or bonus_delta <> 0 or promotional_delta <> 0),
    check (
        (entry_type = 'cycle' and reservation_expires_at is not null)
        or (entry_type <> 'cycle' and reservation_expires_at is null)
    )
);

create index if not exists autobattle_token_ledger_user_created_idx
on public.autobattle_token_ledger (user_id, created_at desc);

create table if not exists public.autobattle_products (
    sku text primary key check (sku ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
    paid_tokens integer not null check (paid_tokens > 0),
    bonus_tokens integer not null default 0 check (bonus_tokens >= 0),
    price_cents integer not null check (price_cents > 0),
    currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
    featured boolean not null default false,
    active boolean not null default true,
    display_order integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.autobattle_products
    (sku, paid_tokens, bonus_tokens, price_cents, featured, display_order)
values
    ('tokens_5', 5, 0, 99, false, 1),
    ('tokens_25', 25, 5, 499, false, 2),
    ('tokens_50', 50, 10, 999, false, 3),
    ('tokens_100', 100, 25, 1999, true, 4),
    ('tokens_250', 250, 50, 4999, false, 5),
    ('tokens_500', 500, 100, 9999, false, 6)
on conflict (sku) do update set
    paid_tokens = excluded.paid_tokens,
    bonus_tokens = excluded.bonus_tokens,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    featured = excluded.featured,
    active = excluded.active,
    display_order = excluded.display_order,
    updated_at = now();

create table if not exists public.autobattle_invite_codes (
    id uuid primary key default extensions.gen_random_uuid(),
    code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
    campaign_key text not null check (campaign_key ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
    label text not null check (char_length(label) between 1 and 120),
    promotional_tokens integer not null default 30 check (promotional_tokens >= 0),
    discount_percent integer not null default 50 check (discount_percent between 1 and 100),
    discount_uses integer not null default 1 check (discount_uses > 0),
    max_redemptions integer not null default 1 check (max_redemptions > 0),
    redemption_count integer not null default 0 check (
        redemption_count >= 0 and redemption_count <= max_redemptions
    ),
    active boolean not null default true,
    starts_at timestamptz,
    expires_at timestamptz,
    created_by text not null,
    created_at timestamptz not null default now(),
    check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.autobattle_code_redemptions (
    id uuid primary key default extensions.gen_random_uuid(),
    code_id uuid not null references public.autobattle_invite_codes(id),
    campaign_key text not null,
    user_id uuid not null references public.autobattle_profiles(user_id) on delete cascade,
    redeemed_at timestamptz not null default now(),
    unique (code_id, user_id),
    unique (campaign_key, user_id)
);

create index if not exists autobattle_code_redemptions_user_idx
on public.autobattle_code_redemptions (user_id, redeemed_at desc);

create table if not exists public.autobattle_discount_entitlements (
    id uuid primary key default extensions.gen_random_uuid(),
    user_id uuid not null references public.autobattle_profiles(user_id) on delete cascade,
    source_redemption_id uuid not null unique references public.autobattle_code_redemptions(id),
    percent_off integer not null check (percent_off between 1 and 100),
    remaining_uses integer not null check (remaining_uses >= 0),
    status text not null default 'active' check (status in ('active', 'redeemed', 'revoked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists autobattle_discounts_user_status_idx
on public.autobattle_discount_entitlements (user_id, status, created_at desc);

create table if not exists public.autobattle_device_link_codes (
    id uuid primary key default extensions.gen_random_uuid(),
    user_id uuid not null references public.autobattle_profiles(user_id) on delete cascade,
    code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
    expires_at timestamptz not null,
    redeemed_at timestamptz,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index if not exists autobattle_device_link_codes_user_idx
on public.autobattle_device_link_codes (user_id, created_at desc);

create table if not exists public.autobattle_device_sessions (
    id uuid primary key default extensions.gen_random_uuid(),
    user_id uuid not null references public.autobattle_profiles(user_id) on delete cascade,
    token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
    device_name text not null check (char_length(device_name) between 1 and 120),
    expires_at timestamptz not null,
    last_seen_at timestamptz not null default now(),
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

create index if not exists autobattle_device_sessions_user_idx
on public.autobattle_device_sessions (user_id, revoked_at, expires_at desc);

create table if not exists public.autobattle_orders (
    id uuid primary key default extensions.gen_random_uuid(),
    user_id uuid not null references public.autobattle_profiles(user_id) on delete restrict,
    sku text not null references public.autobattle_products(sku),
    provider text not null check (char_length(provider) between 2 and 40),
    provider_checkout_id text not null,
    provider_event_id text,
    status text not null default 'pending' check (
        status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
    ),
    subtotal_cents integer not null check (subtotal_cents > 0),
    discount_cents integer not null default 0 check (discount_cents >= 0),
    total_cents integer not null check (total_cents >= 0),
    currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
    discount_entitlement_id uuid references public.autobattle_discount_entitlements(id),
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider, provider_checkout_id),
    unique (provider, provider_event_id),
    check (subtotal_cents - discount_cents = total_cents)
);

create index if not exists autobattle_orders_user_created_idx
on public.autobattle_orders (user_id, created_at desc);

alter table public.autobattle_profiles enable row level security;
alter table public.autobattle_token_accounts enable row level security;
alter table public.autobattle_token_ledger enable row level security;
alter table public.autobattle_products enable row level security;
alter table public.autobattle_invite_codes enable row level security;
alter table public.autobattle_code_redemptions enable row level security;
alter table public.autobattle_discount_entitlements enable row level security;
alter table public.autobattle_device_link_codes enable row level security;
alter table public.autobattle_device_sessions enable row level security;
alter table public.autobattle_orders enable row level security;

revoke all on table public.autobattle_profiles from anon, authenticated;
revoke all on table public.autobattle_token_accounts from anon, authenticated;
revoke all on table public.autobattle_token_ledger from anon, authenticated;
revoke all on table public.autobattle_products from anon, authenticated;
revoke all on table public.autobattle_invite_codes from anon, authenticated;
revoke all on table public.autobattle_code_redemptions from anon, authenticated;
revoke all on table public.autobattle_discount_entitlements from anon, authenticated;
revoke all on table public.autobattle_device_link_codes from anon, authenticated;
revoke all on table public.autobattle_device_sessions from anon, authenticated;
revoke all on table public.autobattle_orders from anon, authenticated;

grant select, insert, update, delete on table public.autobattle_profiles to service_role;
grant select, insert, update, delete on table public.autobattle_token_accounts to service_role;
grant select, insert, update, delete on table public.autobattle_token_ledger to service_role;
grant select, insert, update, delete on table public.autobattle_products to service_role;
grant select, insert, update, delete on table public.autobattle_invite_codes to service_role;
grant select, insert, update, delete on table public.autobattle_code_redemptions to service_role;
grant select, insert, update, delete on table public.autobattle_discount_entitlements to service_role;
grant select, insert, update, delete on table public.autobattle_device_link_codes to service_role;
grant select, insert, update, delete on table public.autobattle_device_sessions to service_role;
grant select, insert, update, delete on table public.autobattle_orders to service_role;

create or replace function public.autobattle_ensure_account(
    p_user_id uuid,
    p_email text,
    p_player_name text default null,
    p_access_status text default 'pending'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_user_id is null or p_email is null or lower(btrim(p_email)) = '' then
        raise exception using errcode = '22023', message = 'invalid_account_identity';
    end if;
    if p_access_status not in ('pending', 'beta', 'active', 'suspended') then
        raise exception using errcode = '22023', message = 'invalid_access_status';
    end if;

    insert into public.autobattle_profiles (user_id, email, player_name, access_status)
    values (
        p_user_id,
        lower(btrim(p_email)),
        nullif(btrim(p_player_name), ''),
        p_access_status
    )
    on conflict (user_id) do update set
        email = excluded.email,
        player_name = coalesce(public.autobattle_profiles.player_name, excluded.player_name),
        access_status = case
            when public.autobattle_profiles.access_status = 'suspended' then 'suspended'
            when public.autobattle_profiles.access_status = 'active' then 'active'
            when excluded.access_status = 'active' then 'active'
            when public.autobattle_profiles.access_status = 'beta' then 'beta'
            when excluded.access_status = 'beta' then 'beta'
            else public.autobattle_profiles.access_status
        end,
        updated_at = now();

    insert into public.autobattle_token_accounts (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
end;
$$;

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
begin
    if p_purchased < 0 or p_bonus < 0 or p_promotional < 0 or
       p_purchased + p_bonus + p_promotional <= 0 then
        raise exception using errcode = '22023', message = 'invalid_token_grant';
    end if;
    if p_entry_type not in ('admin_grant', 'clan_grant', 'purchase', 'refund', 'adjustment') then
        raise exception using errcode = '22023', message = 'invalid_grant_type';
    end if;

    select * into existing
    from public.autobattle_token_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
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

create or replace function public.autobattle_release_stale_cycles(
    p_user_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    refunded_purchased bigint := 0;
    refunded_bonus bigint := 0;
    refunded_promotional bigint := 0;
    released_count integer := 0;
begin
    -- Every token operation locks the profile first. This serializes cleanup with
    -- reserve, commit, and release and prevents a stale reservation being refunded twice.
    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id
    for update;
    if not found then return 0; end if;

    select
        coalesce(sum(-purchased_delta), 0),
        coalesce(sum(-bonus_delta), 0),
        coalesce(sum(-promotional_delta), 0),
        count(*)
    into refunded_purchased, refunded_bonus, refunded_promotional, released_count
    from public.autobattle_token_ledger
    where user_id = p_user_id
      and entry_type = 'cycle'
      and status = 'reserved'
      and reservation_expires_at <= now();

    if released_count > 0 then
        update public.autobattle_token_accounts
        set purchased_balance = purchased_balance + refunded_purchased,
            bonus_balance = bonus_balance + refunded_bonus,
            promotional_balance = promotional_balance + refunded_promotional,
            updated_at = now()
        where user_id = p_user_id;

        update public.autobattle_token_ledger
        set status = 'released',
            metadata = metadata || jsonb_build_object('releaseReason', 'reservation_expired'),
            updated_at = now()
        where user_id = p_user_id
          and entry_type = 'cycle'
          and status = 'reserved'
          and reservation_expires_at <= now();
    end if;

    return released_count;
end;
$$;

create or replace function public.autobattle_reserve_cycle(
    p_user_id uuid,
    p_idempotency_key text,
    p_workflow_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    balances public.autobattle_token_accounts%rowtype;
    entry public.autobattle_token_ledger%rowtype;
    purchased_delta bigint := 0;
    bonus_delta bigint := 0;
    promotional_delta bigint := 0;
begin
    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id
    for update;
    if not found or profile.access_status not in ('beta', 'active') then
        raise exception using errcode = 'P0001', message = 'account_not_authorized';
    end if;

    perform public.autobattle_release_stale_cycles(p_user_id);

    -- Check idempotency only after taking the per-account lock. Concurrent retries
    -- with the same key now serialize instead of racing the unique constraint.
    select * into entry
    from public.autobattle_token_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
        select * into balances from public.autobattle_token_accounts where user_id = p_user_id;
        return jsonb_build_object(
            'reservationId', entry.id,
            'status', entry.status,
            'purchased', balances.purchased_balance,
            'bonus', balances.bonus_balance,
            'promotional', balances.promotional_balance
        );
    end if;

    select * into balances
    from public.autobattle_token_accounts
    where user_id = p_user_id
    for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;
    if balances.purchased_balance + balances.bonus_balance + balances.promotional_balance < 1 then
        raise exception using errcode = 'P0001', message = 'insufficient_tokens';
    end if;

    if balances.promotional_balance > 0 then
        promotional_delta := -1;
    elsif balances.bonus_balance > 0 then
        bonus_delta := -1;
    else
        purchased_delta := -1;
    end if;

    update public.autobattle_token_accounts
    set purchased_balance = purchased_balance + purchased_delta,
        bonus_balance = bonus_balance + bonus_delta,
        promotional_balance = promotional_balance + promotional_delta,
        updated_at = now()
    where user_id = p_user_id
    returning * into balances;

    insert into public.autobattle_token_ledger (
        user_id, entry_type, status, purchased_delta, bonus_delta,
        promotional_delta, idempotency_key, metadata, reservation_expires_at
    ) values (
        p_user_id, 'cycle', 'reserved', purchased_delta, bonus_delta,
        promotional_delta, p_idempotency_key,
        jsonb_build_object('workflowName', left(coalesce(p_workflow_name, 'Workflow'), 80)),
        now() + interval '6 hours'
    ) returning * into entry;

    return jsonb_build_object(
        'reservationId', entry.id,
        'status', entry.status,
        'purchased', balances.purchased_balance,
        'bonus', balances.bonus_balance,
        'promotional', balances.promotional_balance
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
    return jsonb_build_object('reservationId', entry.id, 'status', entry.status);
end;
$$;

create or replace function public.autobattle_release_cycle(
    p_user_id uuid,
    p_reservation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    entry public.autobattle_token_ledger%rowtype;
    balances public.autobattle_token_accounts%rowtype;
    profile public.autobattle_profiles%rowtype;
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
    if entry.status = 'committed' then
        raise exception using errcode = 'P0001', message = 'reservation_already_committed';
    end if;
    if entry.status = 'reserved' then
        update public.autobattle_token_accounts
        set purchased_balance = purchased_balance - entry.purchased_delta,
            bonus_balance = bonus_balance - entry.bonus_delta,
            promotional_balance = promotional_balance - entry.promotional_delta,
            updated_at = now()
        where user_id = p_user_id
        returning * into balances;

        update public.autobattle_token_ledger
        set status = 'released', updated_at = now()
        where id = entry.id;
        entry.status := 'released';
    else
        select * into balances from public.autobattle_token_accounts where user_id = p_user_id;
    end if;
    return jsonb_build_object(
        'reservationId', entry.id,
        'status', entry.status,
        'purchased', balances.purchased_balance,
        'bonus', balances.bonus_balance,
        'promotional', balances.promotional_balance
    );
end;
$$;

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
            'discountPercent', invite.discount_percent
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
        jsonb_build_object('campaign', invite.campaign_key, 'label', invite.label)
    );

    insert into public.autobattle_discount_entitlements (
        user_id, source_redemption_id, percent_off, remaining_uses
    ) values (
        p_user_id, redemption.id, invite.discount_percent, invite.discount_uses
    );

    return jsonb_build_object(
        'status', 'redeemed',
        'promotionalGranted', invite.promotional_tokens,
        'promotional', balances.promotional_balance,
        'discountPercent', invite.discount_percent,
        'discountUses', invite.discount_uses
    );
end;
$$;

create or replace function public.autobattle_link_device(
    p_code_hash text,
    p_session_token_hash text,
    p_device_name text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    link_code public.autobattle_device_link_codes%rowtype;
    device_session public.autobattle_device_sessions%rowtype;
    profile public.autobattle_profiles%rowtype;
    active_device_count integer;
begin
    select * into link_code
    from public.autobattle_device_link_codes
    where code_hash = lower(btrim(p_code_hash))
    for update;
    if not found or link_code.redeemed_at is not null or link_code.expires_at <= now() then
        raise exception using errcode = 'P0001', message = 'invalid_device_link_code';
    end if;
    if char_length(btrim(p_device_name)) not between 1 and 120 or
       p_session_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception using errcode = '22023', message = 'invalid_device_session';
    end if;

    -- Lock the account row so simultaneous link-code exchanges cannot race past
    -- the access check or the per-account device limit.
    select * into profile
    from public.autobattle_profiles
    where user_id = link_code.user_id
    for update;
    if not found or profile.access_status not in ('beta', 'active') then
        raise exception using errcode = 'P0001', message = 'account_not_authorized';
    end if;

    select count(*) into active_device_count
    from public.autobattle_device_sessions
    where user_id = link_code.user_id
      and revoked_at is null
      and expires_at > now();
    if active_device_count >= 5 then
        raise exception using errcode = 'P0001', message = 'device_limit_reached';
    end if;

    update public.autobattle_device_link_codes
    set redeemed_at = now()
    where id = link_code.id;

    insert into public.autobattle_device_sessions (
        user_id, token_hash, device_name, expires_at
    ) values (
        link_code.user_id,
        p_session_token_hash,
        btrim(p_device_name),
        now() + interval '90 days'
    ) returning * into device_session;

    return jsonb_build_object(
        'sessionId', device_session.id,
        'userId', device_session.user_id,
        'deviceName', device_session.device_name,
        'expiresAt', device_session.expires_at
    );
end;
$$;

revoke all on function public.autobattle_ensure_account(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.autobattle_grant_tokens(uuid, bigint, bigint, bigint, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.autobattle_release_stale_cycles(uuid) from public, anon, authenticated;
revoke all on function public.autobattle_reserve_cycle(uuid, text, text) from public, anon, authenticated;
revoke all on function public.autobattle_commit_cycle(uuid, uuid) from public, anon, authenticated;
revoke all on function public.autobattle_release_cycle(uuid, uuid) from public, anon, authenticated;
revoke all on function public.autobattle_redeem_invite_code(uuid, text) from public, anon, authenticated;
revoke all on function public.autobattle_link_device(text, text, text) from public, anon, authenticated;

grant execute on function public.autobattle_ensure_account(uuid, text, text, text) to service_role;
grant execute on function public.autobattle_grant_tokens(uuid, bigint, bigint, bigint, text, text, text, jsonb) to service_role;
grant execute on function public.autobattle_release_stale_cycles(uuid) to service_role;
grant execute on function public.autobattle_reserve_cycle(uuid, text, text) to service_role;
grant execute on function public.autobattle_commit_cycle(uuid, uuid) to service_role;
grant execute on function public.autobattle_release_cycle(uuid, uuid) to service_role;
grant execute on function public.autobattle_redeem_invite_code(uuid, text) to service_role;
grant execute on function public.autobattle_link_device(text, text, text) to service_role;

comment on table public.autobattle_token_ledger is
'Append-only token audit trail. Cycle entries move reserved -> committed or released; they are never deleted.';
comment on table public.autobattle_invite_codes is
'Stores SHA-256 invite-code hashes only. Plaintext codes are shown once by the protected admin endpoint.';
