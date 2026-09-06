create table if not exists public.nest_expenses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  category text not null default 'other'
    check (category in ('food', 'utilities', 'rent', 'transport', 'other')),
  description text not null default '' check (char_length(description) <= 1000),
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nest_expense_participants (
  expense_id uuid not null references public.nest_expenses(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  payment_status text not null default 'open'
    check (payment_status in ('open', 'pending', 'confirmed')),
  marked_paid_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (expense_id, user_id),
  check (
    (payment_status = 'open' and marked_paid_at is null and confirmed_at is null)
    or (payment_status = 'pending' and marked_paid_at is not null and confirmed_at is null)
    or (payment_status = 'confirmed' and confirmed_at is not null)
  )
);

create index if not exists nest_expenses_room_date_idx
  on public.nest_expenses(room_id, expense_date desc, created_at desc);
create index if not exists nest_expense_participants_room_user_idx
  on public.nest_expense_participants(room_id, user_id, payment_status);

alter table public.nest_expenses enable row level security;
alter table public.nest_expense_participants enable row level security;
alter table public.nest_expenses replica identity full;
alter table public.nest_expense_participants replica identity full;

revoke all on table public.nest_expenses, public.nest_expense_participants from anon, authenticated;
grant select on table public.nest_expenses, public.nest_expense_participants to authenticated;

drop policy if exists "members can read nest expenses" on public.nest_expenses;
create policy "members can read nest expenses"
on public.nest_expenses for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members can read nest expense participants" on public.nest_expense_participants;
create policy "members can read nest expense participants"
on public.nest_expense_participants for select to authenticated
using ((select private.is_nest_member(room_id)));

create or replace function public.create_nest_expense(
  p_room_id uuid,
  p_title text,
  p_amount numeric,
  p_expense_date date,
  p_category text,
  p_description text,
  p_payer_user_id uuid,
  p_participant_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_expense_id uuid;
  v_participant_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authentication_required';
  end if;
  if not (select private.is_nest_member(p_room_id)) then
    raise exception 'not_a_nest_member';
  end if;
  if not (select private.is_specific_nest_member(p_room_id, p_payer_user_id)) then
    raise exception 'payer_not_in_nest';
  end if;
  if p_title is null or pg_catalog.char_length(pg_catalog.btrim(p_title)) not between 1 and 120 then
    raise exception 'invalid_expense_title';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_expense_amount';
  end if;
  if p_expense_date is null then
    raise exception 'invalid_expense_date';
  end if;
  if p_category not in ('food', 'utilities', 'rent', 'transport', 'other') then
    raise exception 'invalid_expense_category';
  end if;
  if pg_catalog.char_length(coalesce(p_description, '')) > 1000 then
    raise exception 'expense_description_too_long';
  end if;

  insert into public.nest_expenses (
    room_id,
    title,
    amount,
    expense_date,
    category,
    description,
    payer_user_id,
    created_by
  ) values (
    p_room_id,
    pg_catalog.btrim(p_title),
    p_amount,
    p_expense_date,
    p_category,
    pg_catalog.btrim(coalesce(p_description, '')),
    p_payer_user_id,
    v_actor_id
  ) returning id into v_expense_id;

  foreach v_participant_id in array coalesce(p_participant_user_ids, '{}'::uuid[]) loop
    if v_participant_id is null
       or not (select private.is_specific_nest_member(p_room_id, v_participant_id)) then
      raise exception 'expense_participant_not_in_nest';
    end if;

    insert into public.nest_expense_participants (
      expense_id,
      room_id,
      user_id,
      payment_status,
      confirmed_at
    ) values (
      v_expense_id,
      p_room_id,
      v_participant_id,
      case when v_participant_id = p_payer_user_id then 'confirmed' else 'open' end,
      case when v_participant_id = p_payer_user_id then pg_catalog.now() else null end
    ) on conflict (expense_id, user_id) do nothing;
  end loop;

  insert into public.nest_expense_participants (
    expense_id,
    room_id,
    user_id,
    payment_status,
    confirmed_at
  ) values (
    v_expense_id,
    p_room_id,
    p_payer_user_id,
    'confirmed',
    pg_catalog.now()
  ) on conflict (expense_id, user_id) do update
    set payment_status = 'confirmed',
        marked_paid_at = null,
        confirmed_at = excluded.confirmed_at,
        updated_at = pg_catalog.now();

  return v_expense_id;
end;
$$;

revoke execute on function public.create_nest_expense(uuid, text, numeric, date, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.create_nest_expense(uuid, text, numeric, date, text, text, uuid, uuid[]) to authenticated;

create or replace function public.set_nest_expense_payment_status(
  p_expense_id uuid,
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_expense public.nest_expenses%rowtype;
  v_participant public.nest_expense_participants%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_expense
  from public.nest_expenses
  where id = p_expense_id
  for update;

  if v_expense.id is null then
    raise exception 'expense_not_found';
  end if;
  if not (select private.is_nest_member(v_expense.room_id)) then
    raise exception 'not_a_nest_member';
  end if;

  select * into v_participant
  from public.nest_expense_participants
  where expense_id = p_expense_id and user_id = p_user_id
  for update;

  if v_participant.expense_id is null then
    raise exception 'expense_participant_not_found';
  end if;
  if p_user_id = v_expense.payer_user_id then
    raise exception 'payer_has_no_payment_to_confirm';
  end if;

  if v_actor_id = p_user_id then
    if p_status <> 'pending' or v_participant.payment_status = 'confirmed' then
      raise exception 'participant_can_only_mark_open_payment_pending';
    end if;
  elsif v_actor_id = v_expense.payer_user_id then
    if p_status not in ('open', 'confirmed') then
      raise exception 'payer_can_only_confirm_or_reject_payment';
    end if;
  else
    raise exception 'expense_payment_update_not_allowed';
  end if;

  update public.nest_expense_participants
  set payment_status = p_status,
      marked_paid_at = case
        when p_status = 'pending' then pg_catalog.now()
        when p_status = 'confirmed' then marked_paid_at
        else null
      end,
      confirmed_at = case when p_status = 'confirmed' then pg_catalog.now() else null end,
      updated_at = pg_catalog.now()
  where expense_id = p_expense_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.set_nest_expense_payment_status(uuid, uuid, text) from public, anon;
grant execute on function public.set_nest_expense_payment_status(uuid, uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nest_expenses'
  ) then
    alter publication supabase_realtime add table public.nest_expenses;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nest_expense_participants'
  ) then
    alter publication supabase_realtime add table public.nest_expense_participants;
  end if;
end
$$;
