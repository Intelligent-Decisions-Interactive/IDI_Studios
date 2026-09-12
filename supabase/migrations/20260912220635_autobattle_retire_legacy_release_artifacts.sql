-- Stop distributing APKs that were built with retired application IDs. The
-- private storage objects remain recoverable, but neither channel references
-- them after the two-product application-ID consolidation.
update public.autobattle_release_channels
set
    required_version_code = 174,
    version_name = '1.0.148',
    bucket_id = null,
    object_path = null,
    filename = null,
    apk_bytes = null,
    apk_sha256 = null,
    release_notes = case channel
        when 'production' then 'Production identity consolidated to io.intelligentdecisions.io. A newly signed artifact is pending publication.'
        else 'Test identity consolidated to test.intelligentdecisions.io. Use the validated local test build until its artifact is published.'
    end,
    enforcement_enabled = false,
    published_at = null,
    updated_at = now()
where channel in ('production', 'internal');
