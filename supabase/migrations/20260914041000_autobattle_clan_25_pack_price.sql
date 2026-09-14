-- Price the $4.99 pack at $2.99 for permanent founding-clan members while
-- preserving the $0.99 starter floor, one-use referral pricing, and the
-- existing half-price calculation for larger founding-clan packs.

create or replace function autobattle_private.discounted_pack_price_cents(
    p_price_cents integer,
    p_sku text,
    p_discount_percent integer,
    p_unlimited boolean
) returns integer
language sql
immutable
strict
set search_path = ''
as $$
    select case
        when p_discount_percent = 0 then p_price_cents
        when p_unlimited and p_sku = 'tokens_5' then p_price_cents
        when p_unlimited and p_sku = 'tokens_25' then 299
        when p_unlimited then (p_price_cents * (100 - p_discount_percent)) / 100
        else (p_price_cents * (100 - p_discount_percent) + 99) / 100
    end;
$$;

revoke all on function autobattle_private.discounted_pack_price_cents(integer, text, integer, boolean)
from public, anon, authenticated, service_role;

comment on function autobattle_private.discounted_pack_price_cents(integer, text, integer, boolean) is
'Server-authoritative pack price calculation. Permanent clan pricing excludes tokens_5, prices tokens_25 at $2.99, and halves larger packs; limited offers retain round-up behavior.';
