-- Replace an account's pending link code atomically without granting the
-- service role broad DELETE access to the underlying table.
create or replace function public.autobattle_replace_device_link_code(
    p_user_id uuid,
    p_code_hash text,
    p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile public.autobattle_profiles%rowtype;
    active_device_count integer;
begin
    if p_user_id is null
       or coalesce(p_code_hash, '') !~ '^[0-9a-f]{64}$'
       or p_expires_at <= now()
       or p_expires_at > now() + interval '15 minutes' then
        raise exception using errcode = '22023', message = 'invalid_device_link_code';
    end if;

    select * into profile
    from public.autobattle_profiles
    where user_id = p_user_id
    for update;
    if not found
       or profile.access_status not in ('beta', 'active')
       or nullif(btrim(profile.player_name), '') is null then
        raise exception using errcode = 'P0001', message = 'account_unavailable';
    end if;

    select count(*) into active_device_count
    from public.autobattle_device_sessions
    where user_id = p_user_id
      and revoked_at is null
      and expires_at > now();
    if active_device_count >= 5 then
        raise exception using errcode = 'P0001', message = 'device_limit_reached';
    end if;

    delete from public.autobattle_device_link_codes
    where user_id = p_user_id
      and redeemed_at is null;

    insert into public.autobattle_device_link_codes (user_id, code_hash, expires_at)
    values (p_user_id, p_code_hash, p_expires_at);
end;
$$;

revoke all on function public.autobattle_replace_device_link_code(uuid, text, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.autobattle_replace_device_link_code(uuid, text, timestamptz)
to service_role;

comment on function public.autobattle_replace_device_link_code(uuid, text, timestamptz) is
'Atomically replaces pending device-link codes for one eligible AutoBattle account; service-role only.';
