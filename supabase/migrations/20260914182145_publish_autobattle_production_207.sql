-- Publish the verified signed AutoBattle 1.0.181 production artifact and
-- retire older production builds through the server-owned release policy.
do $$
begin
    update public.autobattle_release_channels
    set
        required_version_code = 207,
        version_name = '1.0.181',
        bucket_id = 'autobattle-releases',
        object_path = '1.0.181/AutoBattle-1.0.181-207.apk',
        filename = 'AutoBattle-1.0.181-207.apk',
        apk_bytes = 109058416,
        apk_sha256 = 'ec355616db62f8c009ecf9c5fe9c7c43a7a4eee6d9ec1aca4dd2fef896ce7992',
        release_notes = 'Production release with unified crypt automation, overlay-first runs, packaged starter profiles, cloud recovery, and the current account and marketplace experience.',
        enforcement_enabled = true,
        published_at = now(),
        updated_at = now()
    where channel = 'production';

    if not found then
        raise exception 'AutoBattle production release channel is missing';
    end if;
end;
$$;
