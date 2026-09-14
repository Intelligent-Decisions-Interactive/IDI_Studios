create or replace function public.autobattle_delete_account_orders(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    deleted_count bigint;
begin
    if p_user_id is null then
        raise exception 'AutoBattle account id is required.';
    end if;

    delete from public.autobattle_orders
    where user_id = p_user_id;

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

revoke all on function public.autobattle_delete_account_orders(uuid)
from public, anon, authenticated;
grant execute on function public.autobattle_delete_account_orders(uuid)
to service_role;

comment on function public.autobattle_delete_account_orders(uuid) is
'Deletes only the order dependencies for one account so the protected admin route can complete privacy deletion without direct order-table access.';
