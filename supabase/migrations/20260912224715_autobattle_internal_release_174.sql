-- Publish the installed AutoBattle Test candidate as the exact internal build.
-- The Android client intentionally requires both version code and name to
-- match before account and token-flow verification can continue.
do $$
begin
    update public.autobattle_release_channels
    set
        required_version_code = 174,
        version_name = '1.0.148',
        release_notes = 'AutoBattle Test release candidate with the corrected test.intelligentdecisions.tapflow identity and account/token verification.',
        updated_at = now()
    where channel = 'internal';

    if not found then
        raise exception 'AutoBattle internal release channel is missing';
    end if;
end;
$$;
