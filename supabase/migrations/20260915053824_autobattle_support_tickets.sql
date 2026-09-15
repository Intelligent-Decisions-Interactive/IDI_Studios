create table public.autobattle_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_email text not null,
  player_name text not null default '',
  category text not null check (category in ('bug', 'account', 'billing', 'automation', 'recognition', 'other')),
  subject text not null check (char_length(subject) between 5 and 100),
  initial_message text not null check (char_length(initial_message) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  release_channel text not null check (release_channel in ('production', 'internal')),
  application_id text not null check (application_id in ('io.intelligentdecisions.tapflow', 'test.intelligentdecisions.tapflow')),
  app_version_name text not null check (char_length(app_version_name) between 1 and 40),
  app_version_code integer not null check (app_version_code > 0),
  device_manufacturer text not null default '' check (char_length(device_manufacturer) <= 80),
  device_model text not null default '' check (char_length(device_model) <= 120),
  android_version text not null default '' check (char_length(android_version) <= 80),
  diagnostics_excerpt text check (diagnostics_excerpt is null or char_length(diagnostics_excerpt) <= 49152),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_user_message_at timestamptz not null default now(),
  last_admin_message_at timestamptz
);

create index autobattle_support_tickets_user_updated_idx
  on public.autobattle_support_tickets (user_id, updated_at desc);
create index autobattle_support_tickets_status_updated_idx
  on public.autobattle_support_tickets (status, updated_at desc);

create table public.autobattle_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.autobattle_support_tickets(id) on delete cascade,
  author_type text not null check (author_type in ('user', 'admin')),
  author_email text not null check (char_length(author_email) between 3 and 320),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index autobattle_support_messages_ticket_created_idx
  on public.autobattle_support_messages (ticket_id, created_at);

alter table public.autobattle_support_tickets enable row level security;
alter table public.autobattle_support_messages enable row level security;

revoke all on table public.autobattle_support_tickets from public, anon, authenticated;
revoke all on table public.autobattle_support_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.autobattle_support_tickets to service_role;
grant select, insert, update, delete on table public.autobattle_support_messages to service_role;

comment on table public.autobattle_support_tickets is
  'Private AutoBattle support cases submitted through authenticated device sessions.';
comment on column public.autobattle_support_tickets.diagnostics_excerpt is
  'Optional user-consented excerpt from AutoBattle-owned rotating diagnostics; never screenshots or game data.';
comment on table public.autobattle_support_messages is
  'User and verified-admin replies associated with an AutoBattle support case.';
