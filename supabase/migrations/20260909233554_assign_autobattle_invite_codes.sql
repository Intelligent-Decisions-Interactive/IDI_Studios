alter table public.autobattle_invite_codes
add column if not exists assigned_user_id uuid
references public.autobattle_profiles(user_id) on delete cascade;

create unique index if not exists autobattle_invite_codes_assigned_user_idx
on public.autobattle_invite_codes (assigned_user_id, campaign_key)
where assigned_user_id is not null and active and redemption_count = 0;

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

    if invite.assigned_user_id is not null and invite.assigned_user_id <> p_user_id then
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

revoke execute on function public.autobattle_redeem_invite_code(uuid, text)
from public, anon, authenticated;
grant execute on function public.autobattle_redeem_invite_code(uuid, text)
to service_role;
