-- Publish AutoBattle Test 1.0.163 as the exact internal build expected by
-- test.intelligentdecisions.tapflow. Production remains unchanged.
do $$
begin
    update public.autobattle_release_channels
    set
        required_version_code = 189,
        version_name = '1.0.163',
        release_notes = 'AutoBattle Test referral release candidate with reusable referral links, one-time referee rewards, and milestone rewards for each distinct referral.',
        updated_at = now()
    where channel = 'internal';

    if not found then
        raise exception 'AutoBattle internal release channel is missing';
    end if;
end;
$$;
