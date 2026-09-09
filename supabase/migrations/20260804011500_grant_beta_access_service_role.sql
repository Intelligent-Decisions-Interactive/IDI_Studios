-- The Cloudflare Worker authenticates to Supabase as service_role. RLS bypass
-- does not itself grant privileges on tables or their identity sequences.

grant usage on schema public to service_role;

grant select, insert, update, delete
on table public.beta_access_requests to service_role;

grant select, insert, update, delete
on table public.beta_access_request_events to service_role;

grant usage, select
on sequence public.beta_access_requests_id_seq to service_role;

grant usage, select
on sequence public.beta_access_request_events_id_seq to service_role;
