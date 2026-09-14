-- Keep clan membership as an explicit admin-owned account classification.
-- Existing accounts that already redeemed the founding-clan offer are known
-- clan members and are backfilled; all other accounts remain unassigned.

alter table public.autobattle_profiles
add column if not exists clan_member boolean not null default false;

update public.autobattle_profiles as profile
set clan_member = true
where not profile.clan_member
  and exists (
    select 1
    from public.autobattle_code_redemptions as redemption
    where redemption.user_id = profile.user_id
      and redemption.campaign_key = 'founding-clan'
  );

comment on column public.autobattle_profiles.clan_member is
'Admin-managed clan membership classification. This does not itself grant or revoke credits or discounts.';
