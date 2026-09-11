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
    p_livemode boolean,
    p_capability text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_event_type <> 'payment_intent.succeeded'
       or coalesce(p_payment_intent_id, '') !~ '^pi_[A-Za-z0-9_]+$'
       or btrim(coalesce(p_checkout_id, '')) <> btrim(p_payment_intent_id) then
        raise exception using errcode = '22023', message = 'payment_intent_required';
    end if;

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

comment on function public.autobattle_fulfill_stripe_checkout(
    text, text, text, text, uuid, text, text,
    integer, integer, integer, integer, uuid, boolean, text
) is 'Mints AutoBattle tokens only from a verified payment_intent.succeeded webhook and a valid server capability.';
