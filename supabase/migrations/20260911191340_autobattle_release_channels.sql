-- Server-owned AutoBattle release policy. Mobile and browser clients never
-- receive direct table privileges; the Worker exposes only bounded metadata.
create table if not exists public.autobattle_release_channels (
    channel text primary key check (channel in ('production', 'internal')),
    required_version_code integer not null check (required_version_code between 1 and 2100000000),
    version_name text not null check (char_length(version_name) between 1 and 40),
    bucket_id text check (bucket_id is null or bucket_id ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
    object_path text check (
        object_path is null or (
            char_length(object_path) between 3 and 500 and
            object_path !~ E'[\\r\\n\\\\]' and
            object_path !~ '(^|/)[.][.]?(/|$)'
        )
    ),
    filename text check (
        filename is null or filename ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,175}[.]apk$'
    ),
    apk_bytes bigint check (apk_bytes is null or apk_bytes > 0),
    apk_sha256 text check (apk_sha256 is null or apk_sha256 ~ '^[0-9a-f]{64}$'),
    release_notes text not null default '' check (char_length(release_notes) <= 4000),
    enforcement_enabled boolean not null default false,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        not enforcement_enabled or (
            bucket_id is not null and char_length(bucket_id) between 3 and 100 and
            object_path is not null and char_length(object_path) between 3 and 500 and
            filename is not null and char_length(filename) between 3 and 180 and
            apk_bytes is not null and apk_sha256 is not null and published_at is not null
        )
    )
);

insert into public.autobattle_release_channels (
    channel,
    required_version_code,
    version_name,
    bucket_id,
    object_path,
    filename,
    apk_bytes,
    apk_sha256,
    release_notes,
    enforcement_enabled,
    published_at
) values (
    'production',
    153,
    '1.0.116',
    'autobattle-releases',
    '1.0.116/AutoBattle-1.0.116-153.apk',
    'AutoBattle-1.0.116-153.apk',
    80085944,
    '16788aaf42754fcdad92a448aa8127da53d53032dc57b922b4285be0b8bbee85',
    'Initial signed AutoBattle production release.',
    false,
    now()
), (
    'internal',
    154,
    '1.0.117',
    null,
    null,
    null,
    null,
    null,
    'ADBridge development line.',
    false,
    null
)
on conflict (channel) do nothing;

alter table public.autobattle_device_sessions
add column if not exists release_channel text not null default 'production';

alter table public.autobattle_device_sessions
drop constraint if exists autobattle_device_sessions_release_channel_check;

alter table public.autobattle_device_sessions
add constraint autobattle_device_sessions_release_channel_check
check (release_channel in ('production', 'internal'));

alter table public.autobattle_device_sessions
drop constraint if exists autobattle_device_sessions_release_channel_fkey;

alter table public.autobattle_device_sessions
add constraint autobattle_device_sessions_release_channel_fkey
foreign key (release_channel)
references public.autobattle_release_channels(channel)
on update restrict
on delete restrict;

alter table public.autobattle_release_channels enable row level security;

revoke all on table public.autobattle_release_channels from public, anon, authenticated;
grant select, insert, update, delete on table public.autobattle_release_channels to service_role;

comment on table public.autobattle_release_channels is
'Server-owned release policy for production and internal AutoBattle rollout groups.';

comment on column public.autobattle_device_sessions.release_channel is
'Server-assigned rollout group. Mobile clients cannot select or mutate this value.';
