-- Receipt Scan & Split: expenses, items, participants, and debts.
--
-- All money is stored as integer cents (bigint). Never store money as floats.
-- Everything is scoped to a Nest (room) and gated by private.is_nest_member,
-- matching the pattern used by grocery_items / chores.
--
-- Expenses are treated as immutable snapshots: once saved, the split is fixed.
-- A member may delete an entire expense (cascades to its children), but rows
-- are not edited in place. This keeps the reconciliation (shares sum to total)
-- trustworthy after the fact.

-- ----------------------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  paid_by uuid not null references auth.users(id) on delete restrict,
  merchant text not null default '' check (char_length(merchant) <= 200),
  purchased_at timestamptz,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  tip_cents bigint not null default 0 check (tip_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  receipt_image_path text check (receipt_image_path is null or char_length(receipt_image_path) <= 400),
  created_at timestamptz not null default now()
);

create index if not exists expenses_room_created_idx
  on public.expenses(room_id, created_at desc);

-- ----------------------------------------------------------------------------
-- expense_items  (assigned_to_user_id null => shared)
-- ----------------------------------------------------------------------------
create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  quantity integer not null default 1 check (quantity >= 1),
  line_total_cents bigint not null check (line_total_cents >= 0),
  assigned_to_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists expense_items_expense_idx
  on public.expense_items(expense_id);

-- ----------------------------------------------------------------------------
-- expense_participants (final calculated share per included roommate)
-- ----------------------------------------------------------------------------
create table if not exists public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  final_share_cents bigint not null default 0 check (final_share_cents >= 0),
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index if not exists expense_participants_expense_idx
  on public.expense_participants(expense_id);

-- ----------------------------------------------------------------------------
-- expense_debts (debtor owes creditor amount_cents; MVP: creditor is payer)
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.expense_debt_status as enum ('open', 'settled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.expense_debts (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  debtor_user_id uuid not null references auth.users(id) on delete restrict,
  creditor_user_id uuid not null references auth.users(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  status public.expense_debt_status not null default 'open',
  created_at timestamptz not null default now(),
  check (debtor_user_id <> creditor_user_id)
);

create index if not exists expense_debts_room_idx
  on public.expense_debts(room_id, status);
create index if not exists expense_debts_expense_idx
  on public.expense_debts(expense_id);

-- ----------------------------------------------------------------------------
-- Helper: does the current user belong to the nest that owns this expense?
-- Used by RLS on the child tables that only carry expense_id.
-- ----------------------------------------------------------------------------
create or replace function private.can_access_expense(p_expense_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and private.is_nest_member(e.room_id)
  );
$$;

revoke execute on function private.can_access_expense(uuid) from public, anon;
grant execute on function private.can_access_expense(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_participants enable row level security;
alter table public.expense_debts enable row level security;

alter table public.expenses replica identity full;
alter table public.expense_debts replica identity full;

revoke all on table public.expenses, public.expense_items,
  public.expense_participants, public.expense_debts from anon, authenticated;
grant select, insert, delete on table public.expenses to authenticated;
grant select, insert, delete on table public.expense_items to authenticated;
grant select, insert, delete on table public.expense_participants to authenticated;
grant select, insert, update, delete on table public.expense_debts to authenticated;

-- expenses ------------------------------------------------------------------
drop policy if exists "members read nest expenses" on public.expenses;
create policy "members read nest expenses"
on public.expenses for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members create nest expenses" on public.expenses;
create policy "members create nest expenses"
on public.expenses for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members delete nest expenses" on public.expenses;
create policy "members delete nest expenses"
on public.expenses for delete to authenticated
using ((select private.is_nest_member(room_id)));

-- expense_items -------------------------------------------------------------
drop policy if exists "members read expense items" on public.expense_items;
create policy "members read expense items"
on public.expense_items for select to authenticated
using ((select private.can_access_expense(expense_id)));

drop policy if exists "members create expense items" on public.expense_items;
create policy "members create expense items"
on public.expense_items for insert to authenticated
with check ((select private.can_access_expense(expense_id)));

drop policy if exists "members delete expense items" on public.expense_items;
create policy "members delete expense items"
on public.expense_items for delete to authenticated
using ((select private.can_access_expense(expense_id)));

-- expense_participants ------------------------------------------------------
drop policy if exists "members read expense participants" on public.expense_participants;
create policy "members read expense participants"
on public.expense_participants for select to authenticated
using ((select private.can_access_expense(expense_id)));

drop policy if exists "members create expense participants" on public.expense_participants;
create policy "members create expense participants"
on public.expense_participants for insert to authenticated
with check ((select private.can_access_expense(expense_id)));

drop policy if exists "members delete expense participants" on public.expense_participants;
create policy "members delete expense participants"
on public.expense_participants for delete to authenticated
using ((select private.can_access_expense(expense_id)));

-- expense_debts -------------------------------------------------------------
drop policy if exists "members read nest debts" on public.expense_debts;
create policy "members read nest debts"
on public.expense_debts for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members create nest debts" on public.expense_debts;
create policy "members create nest debts"
on public.expense_debts for insert to authenticated
with check (
  (select private.is_nest_member(room_id))
  and (select private.can_access_expense(expense_id))
);

drop policy if exists "members update nest debts" on public.expense_debts;
create policy "members update nest debts"
on public.expense_debts for update to authenticated
using ((select private.is_nest_member(room_id)))
with check ((select private.is_nest_member(room_id)));

drop policy if exists "members delete nest debts" on public.expense_debts;
create policy "members delete nest debts"
on public.expense_debts for delete to authenticated
using ((select private.is_nest_member(room_id)));

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expense_debts'
  ) then
    alter publication supabase_realtime add table public.expense_debts;
  end if;
end
$$;
