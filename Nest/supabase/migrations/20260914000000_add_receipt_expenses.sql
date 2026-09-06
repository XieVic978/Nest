alter table public.nest_expense_participants
  add column if not exists share_amount numeric(12, 2);

update public.nest_expense_participants participant
set share_amount = round(expense.amount / nullif((select count(*) from public.nest_expense_participants all_participants where all_participants.expense_id = expense.id), 0), 2)
from public.nest_expenses expense
where participant.expense_id = expense.id and participant.share_amount is null;

alter table public.nest_expense_participants
  alter column share_amount set not null;
alter table public.nest_expense_participants
  alter column share_amount set default 0;

create table if not exists public.nest_expense_receipts (
  expense_id uuid primary key references public.nest_expenses(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  image_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.nest_expense_receipt_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.nest_expenses(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  amount numeric(12, 2) not null check (amount >= 0),
  assigned_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.nest_expense_receipts enable row level security;
alter table public.nest_expense_receipt_items enable row level security;
revoke all on public.nest_expense_receipts, public.nest_expense_receipt_items from anon, authenticated;
grant select on public.nest_expense_receipts, public.nest_expense_receipt_items to authenticated;

create policy "members can read expense receipts" on public.nest_expense_receipts for select to authenticated using ((select private.is_nest_member(room_id)));
create policy "members can read expense receipt items" on public.nest_expense_receipt_items for select to authenticated using ((select private.is_nest_member(room_id)));

create or replace function public.create_nest_receipt_expense(
  p_room_id uuid, p_title text, p_amount numeric, p_expense_date date, p_description text,
  p_participant_user_ids uuid[], p_items jsonb, p_image_path text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid()); v_expense uuid; v_id uuid; v_item jsonb;
  v_assigned_total numeric := 0; v_shared_total numeric := 0; v_count integer; v_share numeric;
begin
  if v_actor is null or not (select private.is_nest_member(p_room_id)) then raise exception 'not_a_nest_member'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_amount <= 0 then raise exception 'invalid_receipt_expense'; end if;
  if p_participant_user_ids is null or cardinality(p_participant_user_ids) = 0 then raise exception 'receipt_participants_required'; end if;
  foreach v_id in array p_participant_user_ids loop
    if not (select private.is_specific_nest_member(p_room_id, v_id)) then raise exception 'receipt_participant_not_in_nest'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if nullif(btrim(coalesce(v_item->>'name', '')), '') is null or coalesce((v_item->>'amount')::numeric, -1) < 0 then raise exception 'invalid_receipt_item'; end if;
    if v_item->>'assignedUserId' is not null then
      if not ((v_item->>'assignedUserId')::uuid = any(p_participant_user_ids)) then raise exception 'receipt_assignee_not_selected'; end if;
      v_assigned_total := v_assigned_total + (v_item->>'amount')::numeric;
    else v_shared_total := v_shared_total + (v_item->>'amount')::numeric;
    end if;
  end loop;
  if round(v_assigned_total + v_shared_total, 2) <> round(p_amount, 2) then raise exception 'receipt_total_mismatch'; end if;
  v_count := cardinality(p_participant_user_ids); v_share := v_shared_total / v_count;
  insert into public.nest_expenses(room_id,title,amount,expense_date,category,description,payer_user_id,created_by) values (p_room_id,btrim(p_title),p_amount,p_expense_date,'food',btrim(coalesce(p_description,'')),v_actor,v_actor) returning id into v_expense;
  foreach v_id in array p_participant_user_ids loop
    insert into public.nest_expense_participants(expense_id,room_id,user_id,payment_status,confirmed_at,share_amount) values (v_expense,p_room_id,v_id,case when v_id=v_actor then 'confirmed' else 'open' end,case when v_id=v_actor then now() else null end,v_share + coalesce((select sum((value->>'amount')::numeric) from jsonb_array_elements(p_items) where value->>'assignedUserId'=v_id::text),0));
  end loop;
  insert into public.nest_expense_receipts(expense_id,room_id,image_path) values (v_expense,p_room_id,p_image_path);
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.nest_expense_receipt_items(expense_id,room_id,name,amount,assigned_user_id) values (v_expense,p_room_id,btrim(v_item->>'name'),(v_item->>'amount')::numeric,nullif(v_item->>'assignedUserId','')::uuid);
  end loop;
  return v_expense;
end; $$;

revoke execute on function public.create_nest_receipt_expense(uuid,text,numeric,date,text,uuid[],jsonb,text) from public, anon;
grant execute on function public.create_nest_receipt_expense(uuid,text,numeric,date,text,uuid[],jsonb,text) to authenticated;

create or replace function public.get_nest_pair_balance(p_room_id uuid, p_other_user_id uuid)
returns numeric language plpgsql security definer set search_path = '' stable as $$
declare v_actor_id uuid := (select auth.uid()); v_expense_balance numeric := 0; v_settlement_balance numeric := 0;
begin
  if v_actor_id is null then raise exception 'authentication_required'; end if;
  if not (select private.is_nest_member(p_room_id)) or not (select private.is_specific_nest_member(p_room_id, p_other_user_id)) then raise exception 'not_a_nest_member'; end if;
  select coalesce(sum(case
    when expense.payer_user_id = p_other_user_id and participant.user_id = v_actor_id then coalesce(nullif(participant.share_amount, 0), expense.amount / nullif((select count(*) from public.nest_expense_participants all_participants where all_participants.expense_id = expense.id), 0))
    when expense.payer_user_id = v_actor_id and participant.user_id = p_other_user_id then -coalesce(nullif(participant.share_amount, 0), expense.amount / nullif((select count(*) from public.nest_expense_participants all_participants where all_participants.expense_id = expense.id), 0))
    else 0 end), 0) into v_expense_balance
  from public.nest_expenses expense join public.nest_expense_participants participant on participant.expense_id = expense.id
  where expense.room_id = p_room_id and participant.payment_status <> 'confirmed' and ((expense.payer_user_id = p_other_user_id and participant.user_id = v_actor_id) or (expense.payer_user_id = v_actor_id and participant.user_id = p_other_user_id));
  select coalesce(sum(case when settlement.payer_user_id = v_actor_id and settlement.recipient_user_id = p_other_user_id then -settlement.amount when settlement.payer_user_id = p_other_user_id and settlement.recipient_user_id = v_actor_id then settlement.amount else 0 end), 0) into v_settlement_balance from public.nest_expense_settlements settlement where settlement.room_id = p_room_id and ((settlement.payer_user_id = v_actor_id and settlement.recipient_user_id = p_other_user_id) or (settlement.payer_user_id = p_other_user_id and settlement.recipient_user_id = v_actor_id));
  return round(v_expense_balance + v_settlement_balance, 2);
end; $$;
