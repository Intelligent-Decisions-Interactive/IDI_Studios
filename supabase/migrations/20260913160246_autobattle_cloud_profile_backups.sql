-- Account-owned AutoBattle profile snapshots are shared by the production and
-- internal products. Device sessions remain channel-bound, but backup history
-- deliberately does not: the same user can restore a Test snapshot in Production
-- (or the reverse) when both builds support the snapshot schema.
create table public.autobattle_cloud_backups (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    object_path text not null unique,
    status text not null default 'uploading'
        check (status in ('uploading', 'ready', 'failed')),
    source_release_channel text not null
        check (source_release_channel in ('production', 'internal')),
    source_version_name text not null
        check (source_version_name ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$'),
    schema_version integer not null check (schema_version between 1 and 1000),
    file_bytes bigint not null check (file_bytes between 1 and 104857600),
    sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
    profile_count integer not null default 0 check (profile_count between 0 and 10000),
    image_count integer not null default 0 check (image_count between 0 and 100000),
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    failure_reason text,
    constraint autobattle_cloud_backups_completion_check check (
        (status = 'uploading' and completed_at is null and failure_reason is null)
        or (status = 'ready' and completed_at is not null and failure_reason is null)
        or (status = 'failed' and completed_at is not null and failure_reason is not null)
    )
);

create index autobattle_cloud_backups_user_ready_idx
on public.autobattle_cloud_backups (user_id, created_at desc)
where status = 'ready';

create index autobattle_cloud_backups_user_pending_idx
on public.autobattle_cloud_backups (user_id, created_at desc)
where status = 'uploading';

alter table public.autobattle_cloud_backups enable row level security;

revoke all on table public.autobattle_cloud_backups from public, anon, authenticated;
grant select, insert, update, delete on table public.autobattle_cloud_backups to service_role;

comment on table public.autobattle_cloud_backups is
    'Private, account-owned AutoBattle profile archives shared across production and internal release channels.';

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'autobattle-profile-backups',
    'autobattle-profile-backups',
    false,
    104857600,
    array['application/vnd.idistudios.autobattle-profile+zip']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.autobattle_begin_cloud_backup(
    p_user_id uuid,
    p_expected_backup_id uuid,
    p_force boolean,
    p_source_release_channel text,
    p_source_version_name text,
    p_schema_version integer,
    p_file_bytes bigint,
    p_sha256 text,
    p_profile_count integer,
    p_image_count integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    latest public.autobattle_cloud_backups%rowtype;
    created public.autobattle_cloud_backups%rowtype;
    backup_id uuid := gen_random_uuid();
begin
    if p_user_id is null then
        raise exception using errcode = '22023', message = 'invalid_backup_owner';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    update public.autobattle_cloud_backups
    set status = 'failed',
        completed_at = now(),
        failure_reason = 'upload_timeout'
    where user_id = p_user_id
      and status = 'uploading'
      and created_at < now() - interval '15 minutes';

    select * into latest
    from public.autobattle_cloud_backups
    where user_id = p_user_id
      and status in ('uploading', 'ready')
    order by created_at desc, id desc
    limit 1;

    if latest.id is not null
       and not coalesce(p_force, false)
       and p_expected_backup_id is distinct from latest.id then
        return jsonb_build_object(
            'accepted', false,
            'latestBackupId', latest.id,
            'latestStatus', latest.status,
            'latestCreatedAt', latest.created_at
        );
    end if;

    insert into public.autobattle_cloud_backups (
        id,
        user_id,
        object_path,
        source_release_channel,
        source_version_name,
        schema_version,
        file_bytes,
        sha256,
        profile_count,
        image_count
    ) values (
        backup_id,
        p_user_id,
        p_user_id::text || '/' || backup_id::text || '.abprofile',
        p_source_release_channel,
        p_source_version_name,
        p_schema_version,
        p_file_bytes,
        lower(p_sha256),
        p_profile_count,
        p_image_count
    ) returning * into created;

    return jsonb_build_object(
        'accepted', true,
        'backupId', created.id,
        'objectPath', created.object_path
    );
end;
$$;

create or replace function public.autobattle_finalize_cloud_backup(
    p_user_id uuid,
    p_backup_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    completed public.autobattle_cloud_backups%rowtype;
    pruned_paths text[];
begin
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    update public.autobattle_cloud_backups
    set status = 'ready', completed_at = now()
    where id = p_backup_id
      and user_id = p_user_id
      and status = 'uploading'
    returning * into completed;

    if completed.id is null then
        raise exception using errcode = 'P0002', message = 'backup_upload_not_found';
    end if;

    with stale as (
        select id
        from public.autobattle_cloud_backups
        where user_id = p_user_id
          and (
              status = 'failed'
              or (
                  status = 'ready'
                  and id not in (
                      select id
                      from public.autobattle_cloud_backups
                      where user_id = p_user_id and status = 'ready'
                      order by created_at desc, id desc
                      limit 5
                  )
              )
          )
    ), removed as (
        delete from public.autobattle_cloud_backups backup
        using stale
        where backup.id = stale.id
        returning backup.object_path
    )
    select coalesce(array_agg(object_path), array[]::text[])
    into pruned_paths
    from removed;

    return jsonb_build_object(
        'id', completed.id,
        'sourceReleaseChannel', completed.source_release_channel,
        'sourceVersionName', completed.source_version_name,
        'schemaVersion', completed.schema_version,
        'fileBytes', completed.file_bytes,
        'sha256', completed.sha256,
        'profileCount', completed.profile_count,
        'imageCount', completed.image_count,
        'createdAt', completed.created_at,
        'completedAt', completed.completed_at,
        'prunedObjectPaths', to_jsonb(pruned_paths)
    );
end;
$$;

create or replace function public.autobattle_fail_cloud_backup(
    p_user_id uuid,
    p_backup_id uuid,
    p_reason text
)
returns void
language sql
security invoker
set search_path = ''
as $$
    update public.autobattle_cloud_backups
    set status = 'failed',
        completed_at = now(),
        failure_reason = left(coalesce(nullif(p_reason, ''), 'upload_failed'), 120)
    where id = p_backup_id
      and user_id = p_user_id
      and status = 'uploading';
$$;

revoke all on function public.autobattle_begin_cloud_backup(uuid, uuid, boolean, text, text, integer, bigint, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.autobattle_begin_cloud_backup(uuid, uuid, boolean, text, text, integer, bigint, text, integer, integer)
to service_role;

revoke all on function public.autobattle_finalize_cloud_backup(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.autobattle_finalize_cloud_backup(uuid, uuid)
to service_role;

revoke all on function public.autobattle_fail_cloud_backup(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.autobattle_fail_cloud_backup(uuid, uuid, text)
to service_role;
