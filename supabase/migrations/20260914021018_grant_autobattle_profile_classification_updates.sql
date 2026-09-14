-- Profile classification is written only through the protected Worker routes.
-- The token-integrity hardening migration replaced broad service-role DML with
-- column-level grants, so each later profile column must be granted explicitly.

revoke update (clan_member, signup_affiliation)
on table public.autobattle_profiles
from anon, authenticated;

grant update (clan_member, signup_affiliation)
on table public.autobattle_profiles
to service_role;
