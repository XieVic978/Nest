create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  quantity text not null default '1' check (char_length(btrim(quantity)) between 1 and 40),
  notes text not null default '' check (char_length(notes) <= 1000),
  category text not null default 'other' check (category in ('produce', 'dairy', 'pantry', 'household', 'other')),
  added_by uuid not null references auth.users(id) on delete restrict,
  purchased_by uuid references auth.users(id) on delete set null,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (purchased_by is null and purchased_at is null)
    or (purchased_by is not null and purchased_at is not null)
  )
);

create index if not exists grocery_items_room_status_idx
  on public.grocery_items(room_id, purchased_at, created_at desc);

alter table public.grocery_items enable row level security;
alter table public.grocery_items replica identity full;

revoke all on table public.grocery_items from anon, authenticated;
grant select, insert, update, delete on table public.grocery_items to authenticated;

create or replace function private.validate_nest_grocery_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.added_by <> (select auth.uid()) then
      raise exception 'invalid_grocery_creator';
    end if;
    if new.purchased_by is not null or new.purchased_at is not null then
      raise exception 'new_grocery_item_cannot_be_purchased';
    end if;
  else
    if new.room_id <> old.room_id or new.added_by <> old.added_by
       or new.created_at <> old.created_at then
      raise exception 'grocery_ownership_immutable';
    end if;

    if new.purchased_by is distinct from old.purchased_by then
      if new.purchased_by is not null and new.purchased_by <> (select auth.uid()) then
        raise exception 'invalid_grocery_purchaser';
      end if;
    elsif new.purchased_at is distinct from old.purchased_at then
      raise exception 'grocery_purchase_time_immutable';
    end if;
  end if;

  if new.purchased_by is not null
     and not (select private.is_specific_nest_member(new.room_id, new.purchased_by)) then
    raise exception 'grocery_purchaser_not_in_nest';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.validate_nest_grocery_item() from public, anon, authenticated;

drop trigger if exists validate_nest_grocery_item_trigger on public.grocery_items;
create trigger validate_nest_grocery_item_trigger
before insert or update on public.grocery_items
for each row execute function private.validate_nest_grocery_item();

drop policy if exists "members can read nest grocery items" on public.grocery_items;
create policy "members can read nest grocery items"
on public.grocery_items for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members can create nest grocery items" on public.grocery_items;
create policy "members can create nest grocery items"
on public.grocery_items for insert to authenticated
with check (
  added_by = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members can update nest grocery items" on public.grocery_items;
create policy "members can update nest grocery items"
on public.grocery_items for update to authenticated
using ((select private.is_nest_member(room_id)))
with check ((select private.is_nest_member(room_id)));

drop policy if exists "members can delete nest grocery items" on public.grocery_items;
create policy "members can delete nest grocery items"
on public.grocery_items for delete to authenticated
using ((select private.is_nest_member(room_id)));

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'grocery_items'
  ) then
    alter publication supabase_realtime add table public.grocery_items;
  end if;
end
$$;
