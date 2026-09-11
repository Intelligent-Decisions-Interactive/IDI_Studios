-- AutoBattle production releases are never public Storage objects. The website
-- streams them through an authenticated, approval-gated server route instead.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'autobattle-releases',
  'autobattle-releases',
  false,
  104857600,
  array['application/vnd.android.package-archive']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

