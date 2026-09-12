-- Correct the product-identity consolidation: .tapflow is the established
-- production/test identity family. Restore the still-present signed production
-- artifact and the prior internal release policy; only com.example.tapflow is
-- retired.
update public.autobattle_release_channels
set
    required_version_code = 153,
    version_name = '1.0.116',
    bucket_id = 'autobattle-releases',
    object_path = '1.0.116/AutoBattle-1.0.116-153.apk',
    filename = 'AutoBattle-1.0.116-153.apk',
    apk_bytes = 80085944,
    apk_sha256 = '16788aaf42754fcdad92a448aa8127da53d53032dc57b922b4285be0b8bbee85',
    release_notes = 'Initial signed AutoBattle production release for io.intelligentdecisions.tapflow.',
    enforcement_enabled = false,
    published_at = '2026-09-11T19:26:39.144891+00:00'::timestamptz,
    updated_at = now()
where channel = 'production';

update public.autobattle_release_channels
set
    required_version_code = 156,
    version_name = '1.0.119',
    bucket_id = null,
    object_path = null,
    filename = null,
    apk_bytes = null,
    apk_sha256 = null,
    release_notes = 'Startup-only release check behind branded splash; compact update gate and token marketplace.',
    enforcement_enabled = false,
    published_at = null,
    updated_at = now()
where channel = 'internal';
