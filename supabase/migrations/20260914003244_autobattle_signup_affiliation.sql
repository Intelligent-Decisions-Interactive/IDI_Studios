-- Capture the player's own affiliation during first-time account setup without
-- treating that declaration as verified clan membership or granting benefits.

alter table public.autobattle_profiles
add column if not exists signup_affiliation text not null default 'not_provided';

alter table public.autobattle_profiles
add constraint autobattle_profiles_signup_affiliation_check
check (signup_affiliation in ('not_provided', 'clan', 'individual'));

comment on column public.autobattle_profiles.signup_affiliation is
'Player-declared affiliation captured during account setup. Admin verification remains in clan_member.';
