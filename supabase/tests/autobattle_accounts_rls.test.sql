begin;

select plan(39);

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

select * from finish();
rollback;
