-- Cover referral-code lookups and foreign-key maintenance.
create index if not exists autobattle_referrals_referral_code_idx
    on autobattle_private.autobattle_referrals (referral_code_id);
