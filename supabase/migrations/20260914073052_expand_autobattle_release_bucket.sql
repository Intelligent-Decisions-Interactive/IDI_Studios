-- Production 1.0.175 includes the account recovery image library and is larger
-- than the original 100 MiB release ceiling. Keep the bucket private and
-- restricted to monolithic Android packages while allowing future signed APKs
-- up to 150 MiB.
do $$
begin
  update storage.buckets
  set
    public = false,
    file_size_limit = 157286400,
    allowed_mime_types = array['application/vnd.android.package-archive']
  where id = 'autobattle-releases';

  if not found then
    raise exception 'AutoBattle release bucket is missing';
  end if;
end;
$$;
