create table if not exists public.nest_expense_settlements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('venmo', 'zelle', 'other')),
  note text not null default '' check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  check (payer_user_id <> recipient_user_id)
);

create index if not exists nest_expense_settlements_room_idx
  on public.nest_expense_settlements(room_id, created_at desc);

alter table public.nest_expense_settlements enable row level security;
alter table public.nest_expense_settlements replica identity full;
revoke all on public.nest_expense_settlements from anon, authenticated;
grant select on public.nest_expense_settlements to authenticated;

drop policy if exists "members can read nest expense settlements" on public.nest_expense_settlements;
create policy "members can read nest expense settlements"
on public.nest_expense_settlements for select to authenticated
using ((select private.is_nest_member(room_id)));

create or replace function public.get_nest_payment_contacts(p_room_id uuid)
returns table (user_id uuid, full_name text, phone text, venmo text, zelle text)
language sql
security definer
set search_path = ''
stable
as $$
  select member.user_id, member.display_name, profile.phone, profile.venmo, profile.zelle
  from public.room_members member
  left join public.profiles profile on profile.id = member.user_id
  where member.room_id = p_room_id
    and (select private.is_nest_member(p_room_id));
$$;

create or replace function public.get_nest_pair_balance(
  p_room_id uuid,
  p_other_user_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_expense_balance numeric := 0;
  v_settlement_balance numeric := 0;
begin
  if v_actor_id is null then raise exception 'authentication_required'; end if;
  if not (select private.is_nest_member(p_room_id))
    or not (select private.is_specific_nest_member(p_room_id, p_other_user_id)) then
    raise exception 'not_a_nest_member';
  end if;

  select coalesce(sum(
    case
      when expense.payer_user_id = p_other_user_id and participant.user_id = v_actor_id
        then expense.amount / nullif((select count(*) from public.nest_expense_participants all_participants where all_participants.expense_id = expense.id), 0)
      when expense.payer_user_id = v_actor_id and participant.user_id = p_other_user_id
        then -(expense.amount / nullif((select count(*) from public.nest_expense_participants all_participants where all_participants.expense_id = expense.id), 0))
      else 0
    end
  ), 0) into v_expense_balance
  from public.nest_expenses expense
  join public.nest_expense_participants participant on participant.expense_id = expense.id
  where expense.room_id = p_room_id
    and participant.payment_status <> 'confirmed'
    and ((expense.payer_user_id = p_other_user_id and participant.user_id = v_actor_id)
      or (expense.payer_user_id = v_actor_id and participant.user_id = p_other_user_id));

  select coalesce(sum(
    case
      when settlement.payer_user_id = v_actor_id and settlement.recipient_user_id = p_other_user_id then -settlement.amount
      when settlement.payer_user_id = p_other_user_id and settlement.recipient_user_id = v_actor_id then settlement.amount
      else 0
    end
  ), 0) into v_settlement_balance
  from public.nest_expense_settlements settlement
  where settlement.room_id = p_room_id
    and ((settlement.payer_user_id = v_actor_id and settlement.recipient_user_id = p_other_user_id)
      or (settlement.payer_user_id = p_other_user_id and settlement.recipient_user_id = v_actor_id));

  return round(v_expense_balance + v_settlement_balance, 2);
end;
$$;

create or replace function public.record_nest_expense_settlement(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_outstanding numeric;
  v_settlement_id uuid;
begin
  if v_actor_id is null then raise exception 'authentication_required'; end if;
  if not (select private.is_nest_member(p_room_id))
    or not (select private.is_specific_nest_member(p_room_id, p_recipient_user_id)) then
    raise exception 'not_a_nest_member';
  end if;
  if p_recipient_user_id = v_actor_id then raise exception 'cannot_pay_yourself'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_payment_amount'; end if;
  if p_payment_method not in ('venmo', 'zelle', 'other') then raise exception 'invalid_payment_method'; end if;
  if char_length(coalesce(p_note, '')) > 280 then raise exception 'payment_note_too_long'; end if;

  select public.get_nest_pair_balance(p_room_id, p_recipient_user_id) into v_outstanding;
  if p_amount > v_outstanding then raise exception 'payment_exceeds_amount_owed'; end if;

  insert into public.nest_expense_settlements (
    room_id, payer_user_id, recipient_user_id, amount, payment_method, note
  ) values (
    p_room_id, v_actor_id, p_recipient_user_id, round(p_amount, 2), p_payment_method, btrim(coalesce(p_note, ''))
  ) returning id into v_settlement_id;

  return v_settlement_id;
end;
$$;

revoke execute on function public.get_nest_payment_contacts(uuid) from public, anon;
revoke execute on function public.get_nest_pair_balance(uuid, uuid) from public, anon;
revoke execute on function public.record_nest_expense_settlement(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.get_nest_payment_contacts(uuid) to authenticated;
grant execute on function public.get_nest_pair_balance(uuid, uuid) to authenticated;
grant execute on function public.record_nest_expense_settlement(uuid, uuid, numeric, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nest_expense_settlements'
  ) then
    alter publication supabase_realtime add table public.nest_expense_settlements;
  end if;
end
$$;
