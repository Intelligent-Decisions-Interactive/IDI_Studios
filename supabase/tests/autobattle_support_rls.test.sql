begin;

select plan(12);

select has_table('public', 'autobattle_support_tickets', 'support tickets table exists');
select has_table('public', 'autobattle_support_messages', 'support messages table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.autobattle_support_tickets'::regclass),
  'support tickets have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.autobattle_support_messages'::regclass),
  'support messages have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.autobattle_support_tickets', 'select,insert,update,delete'), 'anon cannot access support tickets');
select ok(not has_table_privilege('authenticated', 'public.autobattle_support_tickets', 'select,insert,update,delete'), 'authenticated clients cannot access support tickets directly');
select ok(has_table_privilege('service_role', 'public.autobattle_support_tickets', 'select,insert,update,delete'), 'service role manages support tickets through protected Worker routes');
select ok(not has_table_privilege('anon', 'public.autobattle_support_messages', 'select,insert,update,delete'), 'anon cannot access support messages');
select ok(not has_table_privilege('authenticated', 'public.autobattle_support_messages', 'select,insert,update,delete'), 'authenticated clients cannot access support messages directly');
select ok(has_table_privilege('service_role', 'public.autobattle_support_messages', 'select,insert,update,delete'), 'service role manages support messages through protected Worker routes');
select col_is_fk('public', 'autobattle_support_tickets', 'user_id', 'support tickets are deleted with their account');
select col_is_fk('public', 'autobattle_support_messages', 'ticket_id', 'support messages are deleted with their ticket');

select * from finish();
rollback;
