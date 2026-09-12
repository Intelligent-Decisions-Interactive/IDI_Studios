-- Bind every new device session to one of the two active application products
-- in the same transaction that redeems its link code. Revoking the legacy RPC
-- prevents older Workers from silently creating production-channel sessions.
create or replace function public.autobattle_link_device_for_channel(
    p_code_hash text,
    p_session_token_hash text,
    p_device_name text,
    p_release_channel text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    link_result jsonb;
    linked_session_id uuid;
begin
    if p_release_channel not in ('production', 'internal') then
        raise exception using errcode = '22023', message = 'invalid_release_channel';
    end if;

    link_result := public.autobattle_link_device(
        p_code_hash,
        p_session_token_hash,
        p_device_name
    );
    linked_session_id := (link_result ->> 'sessionId')::uuid;

    update public.autobattle_device_sessions
    set release_channel = p_release_channel
    where id = linked_session_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'device_session_unavailable';
    end if;

    return link_result || jsonb_build_object('releaseChannel', p_release_channel);
end;
$$;

revoke all on function public.autobattle_link_device(text, text, text)
from service_role;
revoke all on function public.autobattle_link_device_for_channel(text, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.autobattle_link_device_for_channel(text, text, text, text)
to service_role;

comment on function public.autobattle_link_device_for_channel(text, text, text, text) is
'Atomically links an approved AutoBattle device to the production or internal release channel selected from its active application ID.';

-- Owner-only test credits are promotional ledger entries. They exercise the
-- same reservation, commit, release, and balance-integrity paths as paid
-- tokens without creating a fake order or payment record.
create or replace function public.autobattle_admin_grant_test_tokens(
    p_user_id uuid,
    p_amount bigint,
    p_request_id uuid,
    p_actor_email text,
    p_reason text,
    p_capability text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    normalized_actor text := lower(btrim(p_actor_email));
    normalized_reason text := btrim(p_reason);
begin
    perform autobattle_private.require_capability('credit_mint', p_capability);

    if p_amount not between 1 and 10000 then
        raise exception using errcode = '22023', message = 'invalid_test_credit_amount';
    end if;
    if char_length(normalized_actor) not between 3 and 320
       or normalized_actor !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
        raise exception using errcode = '22023', message = 'invalid_test_credit_actor';
    end if;
    if char_length(normalized_reason) not between 3 and 240 then
        raise exception using errcode = '22023', message = 'invalid_test_credit_reason';
    end if;

    return public.autobattle_grant_tokens(
        p_user_id,
        0,
        0,
        p_amount,
        'admin_grant',
        'admin-test-credit:' || p_request_id::text,
        p_request_id::text,
        jsonb_build_object(
            'actorEmail', normalized_actor,
            'reason', normalized_reason,
            'creditClass', 'test_promotional'
        )
    );
end;
$$;

revoke all on function public.autobattle_admin_grant_test_tokens(uuid, bigint, uuid, text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.autobattle_admin_grant_test_tokens(uuid, bigint, uuid, text, text, text)
to service_role;

comment on function public.autobattle_admin_grant_test_tokens(uuid, bigint, uuid, text, text, text) is
'Mints bounded, idempotent promotional credits for the verified admin account so token-flow tests never create fake purchases.';
