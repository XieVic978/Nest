create or replace function public.delete_nest_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_expense public.nest_expenses%rowtype;
begin
  if v_actor_id is null then raise exception 'authentication_required'; end if;
  select * into v_expense from public.nest_expenses where id = p_expense_id for update;
  if v_expense.id is null then raise exception 'expense_not_found'; end if;
  if not (select private.is_nest_member(v_expense.room_id)) then raise exception 'not_a_nest_member'; end if;
  if v_expense.created_by <> v_actor_id then raise exception 'only_expense_owner_can_delete'; end if;
  delete from public.nest_expenses where id = p_expense_id;
end;
$$;

revoke execute on function public.delete_nest_expense(uuid) from public, anon;
grant execute on function public.delete_nest_expense(uuid) to authenticated;
