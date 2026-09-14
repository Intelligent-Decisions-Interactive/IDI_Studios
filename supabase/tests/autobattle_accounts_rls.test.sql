begin;

select plan(75);

select has_column('public', 'autobattle_profiles', 'clan_member', 'profiles record admin-assigned clan membership');
select has_column('public', 'autobattle_profiles', 'signup_affiliation', 'profiles record the affiliation declared during account setup');
select ok(has_column_privilege('service_role', 'public.autobattle_profiles', 'clan_member', 'update'), 'service role can update verified clan membership through the Worker');
select ok(has_column_privilege('service_role', 'public.autobattle_profiles', 'signup_affiliation', 'update'), 'service role can record signup affiliation through the Worker');
select ok(not has_column_privilege('anon', 'public.autobattle_profiles', 'clan_member', 'update'), 'anon cannot update verified clan membership');
select ok(not has_column_privilege('authenticated', 'public.autobattle_profiles', 'clan_member', 'update'), 'authenticated cannot update verified clan membership directly');
select ok(not has_column_privilege('anon', 'public.autobattle_profiles', 'signup_affiliation', 'update'), 'anon cannot update signup affiliation');
select ok(not has_column_privilege('authenticated', 'public.autobattle_profiles', 'signup_affiliation', 'update'), 'authenticated cannot update signup affiliation directly');

select ok(not has_table_privilege('anon', 'public.autobattle_profiles', 'select,insert,update,delete'), 'anon cannot access profiles');
select ok(not has_table_privilege('authenticated', 'public.autobattle_profiles', 'select,insert,update,delete'), 'authenticated cannot access profiles directly');
select ok(not has_table_privilege('anon', 'public.autobattle_token_accounts', 'select,insert,update,delete'), 'anon cannot access balances');
select ok(not has_table_privilege('authenticated', 'public.autobattle_token_accounts', 'select,insert,update,delete'), 'authenticated cannot access balances directly');
select ok(not has_table_privilege('anon', 'public.autobattle_token_ledger', 'select,insert,update,delete'), 'anon cannot access the ledger');
select ok(not has_table_privilege('authenticated', 'public.autobattle_token_ledger', 'select,insert,update,delete'), 'authenticated cannot access the ledger directly');
select ok(not has_table_privilege('anon', 'public.autobattle_products', 'select,insert,update,delete'), 'anon cannot access products directly');
select ok(not has_table_privilege('authenticated', 'public.autobattle_products', 'select,insert,update,delete'), 'authenticated cannot access products directly');
select ok(not has_table_privilege('anon', 'public.autobattle_invite_codes', 'select,insert,update,delete'), 'anon cannot access invite codes');
select ok(not has_table_privilege('authenticated', 'public.autobattle_invite_codes', 'select,insert,update,delete'), 'authenticated cannot access invite codes directly');
select ok(not has_table_privilege('anon', 'public.autobattle_code_redemptions', 'select,insert,update,delete'), 'anon cannot access redemptions');
select ok(not has_table_privilege('authenticated', 'public.autobattle_code_redemptions', 'select,insert,update,delete'), 'authenticated cannot access redemptions directly');
select ok(not has_table_privilege('anon', 'public.autobattle_discount_entitlements', 'select,insert,update,delete'), 'anon cannot access discounts');
select ok(not has_table_privilege('authenticated', 'public.autobattle_discount_entitlements', 'select,insert,update,delete'), 'authenticated cannot access discounts directly');
select ok(not has_table_privilege('anon', 'public.autobattle_device_link_codes', 'select,insert,update,delete'), 'anon cannot access device link codes');
select ok(not has_table_privilege('authenticated', 'public.autobattle_device_link_codes', 'select,insert,update,delete'), 'authenticated cannot access device link codes directly');
select ok(not has_table_privilege('anon', 'public.autobattle_device_sessions', 'select,insert,update,delete'), 'anon cannot access device sessions');
select ok(not has_table_privilege('authenticated', 'public.autobattle_device_sessions', 'select,insert,update,delete'), 'authenticated cannot access device sessions directly');
select ok(not has_table_privilege('anon', 'public.autobattle_orders', 'select,insert,update,delete'), 'anon cannot access orders');
select ok(not has_table_privilege('authenticated', 'public.autobattle_orders', 'select,insert,update,delete'), 'authenticated cannot access orders directly');
select ok(not has_table_privilege('service_role', 'public.autobattle_orders', 'delete'), 'service role cannot delete orders directly');
select ok(not has_function_privilege('anon', 'public.autobattle_delete_account_orders(uuid)', 'execute'), 'anon cannot delete account order dependencies');
select ok(not has_function_privilege('authenticated', 'public.autobattle_delete_account_orders(uuid)', 'execute'), 'authenticated users cannot delete account order dependencies');
select ok(has_function_privilege('service_role', 'public.autobattle_delete_account_orders(uuid)', 'execute'), 'service role can delete one account order set through the protected admin route');
select ok(not has_table_privilege('anon', 'public.autobattle_release_channels', 'select,insert,update,delete'), 'anon cannot access release policy');
select ok(not has_table_privilege('authenticated', 'public.autobattle_release_channels', 'select,insert,update,delete'), 'authenticated cannot access release policy directly');
select ok(has_table_privilege('service_role', 'public.autobattle_release_channels', 'select'), 'service role can read release policy through the Worker');
select ok(not has_table_privilege('anon', 'public.autobattle_cloud_backups', 'select,insert,update,delete'), 'anon cannot access profile backups');
select ok(not has_table_privilege('authenticated', 'public.autobattle_cloud_backups', 'select,insert,update,delete'), 'authenticated cannot access profile backups directly');
select ok(has_table_privilege('service_role', 'public.autobattle_cloud_backups', 'select,insert,update,delete'), 'service role manages profile backups through the Worker');
select results_eq(
    $$select public from storage.buckets where id = 'autobattle-profile-backups'$$,
    array[false],
    'profile backup storage is private'
);
select ok(not has_function_privilege('anon', 'public.autobattle_begin_cloud_backup(uuid,uuid,boolean,text,text,integer,bigint,text,integer,integer)', 'execute'), 'anon cannot begin profile backups');
select ok(has_function_privilege('service_role', 'public.autobattle_begin_cloud_backup(uuid,uuid,boolean,text,text,integer,bigint,text,integer,integer)', 'execute'), 'service role can begin profile backups through the Worker');
select ok(not has_function_privilege('authenticated', 'public.autobattle_finalize_cloud_backup(uuid,uuid)', 'execute'), 'authenticated users cannot finalize profile backups directly');
select ok(has_function_privilege('service_role', 'public.autobattle_finalize_cloud_backup(uuid,uuid)', 'execute'), 'service role can finalize profile backups through the Worker');
select ok(has_function_privilege('service_role', 'public.autobattle_fail_cloud_backup(uuid,uuid,text)', 'execute'), 'service role can mark failed profile backups through the Worker');
select ok(not has_function_privilege('service_role', 'public.autobattle_link_device(text, text, text)', 'execute'), 'service role cannot link retired clients without an explicit channel');
select ok(not has_function_privilege('anon', 'public.autobattle_link_device_for_channel(text, text, text, text)', 'execute'), 'anon cannot link a device to a release channel');
select ok(has_function_privilege('service_role', 'public.autobattle_link_device_for_channel(text, text, text, text)', 'execute'), 'service role can link active application products to a release channel');
select ok(not has_function_privilege('anon', 'public.autobattle_admin_grant_test_tokens(uuid, bigint, uuid, text, text, text)', 'execute'), 'anon cannot mint test credits');
select ok(not has_function_privilege('authenticated', 'public.autobattle_admin_grant_test_tokens(uuid, bigint, uuid, text, text, text)', 'execute'), 'authenticated users cannot mint test credits');
select ok(has_function_privilege('service_role', 'public.autobattle_admin_grant_test_tokens(uuid, bigint, uuid, text, text, text)', 'execute'), 'service role can mint test credits through the protected admin route');
select ok(not has_table_privilege('service_role', 'autobattle_private.autobattle_referral_codes', 'select,insert,update,delete'), 'service role cannot bypass referral functions');
select ok(not has_table_privilege('service_role', 'autobattle_private.autobattle_referrals', 'select,insert,update,delete'), 'service role cannot alter referral claims directly');
select ok(not has_function_privilege('anon', 'public.autobattle_claim_referral(uuid,text,text)', 'execute'), 'anon cannot claim referral rewards');
select ok(not has_function_privilege('authenticated', 'public.autobattle_claim_referral(uuid,text,text)', 'execute'), 'authenticated clients cannot claim referral rewards directly');
select ok(has_function_privilege('service_role', 'public.autobattle_claim_referral(uuid,text,text)', 'execute'), 'service role can claim referrals through the protected Worker route');

select ok(not has_function_privilege('anon', 'public.autobattle_ensure_account(uuid,text,text,text)', 'execute'), 'anon cannot ensure accounts');
select ok(not has_function_privilege('authenticated', 'public.autobattle_ensure_account(uuid,text,text,text)', 'execute'), 'authenticated cannot ensure accounts directly');
select ok(not has_function_privilege('anon', 'public.autobattle_reserve_cycle(uuid,text,text)', 'execute'), 'anon cannot reserve cycles');
select ok(not has_function_privilege('authenticated', 'public.autobattle_reserve_cycle(uuid,text,text)', 'execute'), 'authenticated cannot reserve cycles directly');
select ok(not has_function_privilege('anon', 'public.autobattle_commit_cycle(uuid,uuid)', 'execute'), 'anon cannot commit cycles');
select ok(not has_function_privilege('authenticated', 'public.autobattle_commit_cycle(uuid,uuid)', 'execute'), 'authenticated cannot commit cycles directly');
select ok(not has_function_privilege('anon', 'public.autobattle_release_cycle(uuid,uuid)', 'execute'), 'anon cannot release cycles');
select ok(not has_function_privilege('authenticated', 'public.autobattle_release_cycle(uuid,uuid)', 'execute'), 'authenticated cannot release cycles directly');
select ok(not has_function_privilege('anon', 'public.autobattle_release_stale_cycles(uuid)', 'execute'), 'anon cannot release stale reservations');
select ok(not has_function_privilege('authenticated', 'public.autobattle_release_stale_cycles(uuid)', 'execute'), 'authenticated cannot release stale reservations directly');
select ok(not has_function_privilege('anon', 'public.autobattle_redeem_invite_code(uuid,text)', 'execute'), 'anon cannot redeem codes directly');
select ok(not has_function_privilege('authenticated', 'public.autobattle_redeem_invite_code(uuid,text)', 'execute'), 'authenticated cannot redeem codes directly');
select ok(not has_function_privilege('anon', 'public.autobattle_link_device(text,text,text)', 'execute'), 'anon cannot exchange device link codes');
select ok(not has_function_privilege('authenticated', 'public.autobattle_link_device(text,text,text)', 'execute'), 'authenticated cannot exchange device link codes directly');
select ok(has_function_privilege('service_role', 'public.autobattle_reserve_cycle(uuid,text,text)', 'execute'), 'service role can reserve cycles through the Worker');
select ok(has_function_privilege('service_role', 'public.autobattle_redeem_invite_code(uuid,text)', 'execute'), 'service role can redeem codes through the Worker');
select ok(has_function_privilege('service_role', 'public.autobattle_link_device(text,text,text)', 'execute'), 'service role can link devices through the Worker');
select ok(has_function_privilege('service_role', 'public.autobattle_release_stale_cycles(uuid)', 'execute'), 'service role can release stale reservations through the Worker');

select results_eq(
    $$select count(*)::bigint from public.autobattle_products where active$$,
    array[6::bigint],
    'all six token packs are seeded'
);

select is(
    autobattle_private.discounted_pack_price_cents(499, 'tokens_25', 50, true),
    299,
    'the permanent clan price for the 25-token pack is $2.99'
);

select is(
    autobattle_private.discounted_pack_price_cents(999, 'tokens_50', 50, true),
    499,
    'larger permanent clan packs retain their existing half-price calculation'
);

select * from finish();
rollback;
