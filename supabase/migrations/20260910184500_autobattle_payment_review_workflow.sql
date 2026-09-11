create or replace function public.autobattle_record_stripe_review_event(
    p_event_id text,
    p_event_type text,
    p_object_id text,
    p_payment_intent_id text,
    p_livemode boolean,
    p_amount integer,
    p_suspend_account boolean,
    p_details jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    purchase_order public.autobattle_orders%rowtype;
    payment_event public.autobattle_payment_events%rowtype;
    inserted_count integer := 0;
begin
    if char_length(btrim(p_event_id)) not between 4 and 255
       or char_length(btrim(p_event_type)) not between 3 and 120
       or coalesce(p_payment_intent_id, '') !~ '^pi_[A-Za-z0-9_]+$'
       or coalesce(p_amount, -1) < -1
       or octet_length(coalesce(p_details, '{}'::jsonb)::text) > 4096 then
        raise exception using errcode = '22023', message = 'invalid_payment_review_event';
    end if;

    select * into purchase_order
    from public.autobattle_orders
    where provider = 'stripe'
      and provider_payment_id = btrim(p_payment_intent_id)
    limit 1;

    if not found then
        return jsonb_build_object('matched', false, 'alreadyRecorded', false);
    end if;

    insert into public.autobattle_payment_events (
        provider_event_id,
        event_type,
        object_id,
        livemode,
        status,
        order_id,
        details,
        processed_at
    ) values (
        btrim(p_event_id),
        btrim(p_event_type),
        nullif(btrim(p_object_id), ''),
        coalesce(p_livemode, false),
        'needs_review',
        purchase_order.id,
        coalesce(p_details, '{}'::jsonb),
        now()
    ) on conflict (provider_event_id) do nothing;
    get diagnostics inserted_count = row_count;

    select * into payment_event
    from public.autobattle_payment_events
    where provider_event_id = btrim(p_event_id);

    if inserted_count > 0 then
        if p_event_type = 'charge.refunded'
           or (
               p_event_type in ('refund.created', 'refund.updated')
               and coalesce(p_details ->> 'status', '') = 'succeeded'
           ) then
            update public.autobattle_orders
            set status = case
                    when coalesce(p_amount, 0) >= coalesce(charged_total_cents, total_cents)
                        then 'refunded'
                    else 'partially_refunded'
                end,
                updated_at = now()
            where id = purchase_order.id;
        end if;

        if coalesce(p_suspend_account, false) then
            update public.autobattle_profiles
            set access_status = 'suspended', updated_at = now()
            where user_id = purchase_order.user_id
              and access_status <> 'suspended';
        end if;
    end if;

    return jsonb_build_object(
        'matched', true,
        'eventId', payment_event.id,
        'userId', purchase_order.user_id,
        'alreadyRecorded', inserted_count = 0
    );
end;
$$;

revoke all on function public.autobattle_record_stripe_review_event(
    text, text, text, text, boolean, integer, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.autobattle_record_stripe_review_event(
    text, text, text, text, boolean, integer, boolean, jsonb
) to service_role;

create or replace function public.autobattle_list_payment_reviews()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
    select coalesce(jsonb_agg(review order by "receivedAt" desc), '[]'::jsonb)
    from (
        select jsonb_build_object(
            'id', event.id,
            'eventId', event.provider_event_id,
            'eventType', event.event_type,
            'objectId', event.object_id,
            'receivedAt', event.received_at,
            'details', event.details,
            'orderId', purchase_order.id,
            'paymentIntentId', purchase_order.provider_payment_id,
            'orderStatus', purchase_order.status,
            'userId', profile.user_id,
            'email', profile.email,
            'playerName', coalesce(profile.player_name, ''),
            'accessStatus', profile.access_status
        ) as review,
        event.received_at as "receivedAt"
        from public.autobattle_payment_events event
        join public.autobattle_orders purchase_order on purchase_order.id = event.order_id
        join public.autobattle_profiles profile on profile.user_id = purchase_order.user_id
        where event.status = 'needs_review'
        order by event.received_at desc
        limit 100
    ) reviews;
$$;

revoke all on function public.autobattle_list_payment_reviews()
from public, anon, authenticated;
grant execute on function public.autobattle_list_payment_reviews()
to service_role;

create or replace function public.autobattle_resolve_payment_review(
    p_event_id uuid,
    p_resolution text,
    p_actor text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    payment_event public.autobattle_payment_events%rowtype;
begin
    if char_length(btrim(coalesce(p_resolution, ''))) not between 1 and 500
       or char_length(btrim(coalesce(p_actor, ''))) not between 3 and 320 then
        raise exception using errcode = '22023', message = 'invalid_payment_review_resolution';
    end if;

    update public.autobattle_payment_events
    set status = 'ignored',
        details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
            'resolution', btrim(p_resolution),
            'resolvedBy', lower(btrim(p_actor)),
            'resolvedAt', now()
        ),
        processed_at = now()
    where id = p_event_id
      and status = 'needs_review'
    returning * into payment_event;

    if not found then
        raise exception using errcode = 'P0002', message = 'payment_review_not_found';
    end if;

    return jsonb_build_object('id', payment_event.id, 'status', payment_event.status);
end;
$$;

revoke all on function public.autobattle_resolve_payment_review(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.autobattle_resolve_payment_review(uuid, text, text)
to service_role;

comment on function public.autobattle_record_stripe_review_event(text, text, text, text, boolean, integer, boolean, jsonb)
is 'Records refund and dispute events only when they match an AutoBattle Stripe order and optionally suspends the account.';
