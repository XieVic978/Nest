create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  start_date date not null,
  start_time text not null default 'All day',
  end_date date not null,
  end_time text not null default 'All day',
  location text not null default '' check (char_length(location) <= 240),
  attendee_names text[] not null default '{}',
  category text not null default 'household' check (category in ('household', 'guest', 'travel', 'bill', 'chore', 'availability')),
  all_day boolean not null default false,
  source_chore_id uuid unique references public.chores(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.chores
  add column if not exists display_on_calendar boolean not null default true;

create index if not exists calendar_events_room_start_idx
  on public.calendar_events(room_id, start_date, end_date);

alter table public.calendar_events enable row level security;
alter table public.calendar_events replica identity full;

revoke all on table public.calendar_events from anon, authenticated;
grant select, insert, update, delete on table public.calendar_events to authenticated;

create or replace function private.validate_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.source_chore_id is null then
    if new.created_by <> (select auth.uid()) then
      raise exception 'invalid_calendar_event_creator';
    end if;
  elsif new.room_id <> old.room_id or new.created_by <> old.created_by or new.source_chore_id is distinct from old.source_chore_id then
    raise exception 'calendar_event_ownership_immutable';
  end if;

  if not (select private.is_nest_member(new.room_id)) then
    raise exception 'nest_membership_required';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists validate_calendar_event_trigger on public.calendar_events;
create trigger validate_calendar_event_trigger
before insert or update on public.calendar_events
for each row execute function private.validate_calendar_event();

create or replace function private.sync_chore_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_on_calendar then
    insert into public.calendar_events (
      room_id, title, description, start_date, start_time, end_date, end_time,
      category, all_day, source_chore_id, created_by
    ) values (
      new.room_id, new.title, new.description, new.due_date, 'All day', new.due_date, 'All day',
      'chore', true, new.id, new.created_by
    )
    on conflict (source_chore_id) do update set
      title = excluded.title,
      description = excluded.description,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      updated_at = pg_catalog.now();
  else
    delete from public.calendar_events where source_chore_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_chore_calendar_event_trigger on public.chores;
create trigger sync_chore_calendar_event_trigger
after insert or update of title, description, due_date, display_on_calendar on public.chores
for each row execute function private.sync_chore_calendar_event();

drop policy if exists "members can read calendar events" on public.calendar_events;
create policy "members can read calendar events"
on public.calendar_events for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members can create calendar events" on public.calendar_events;
create policy "members can create calendar events"
on public.calendar_events for insert to authenticated
with check (
  created_by = (select auth.uid())
  and source_chore_id is null
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members can update manual calendar events" on public.calendar_events;
create policy "members can update manual calendar events"
on public.calendar_events for update to authenticated
using ((select private.is_nest_member(room_id)) and source_chore_id is null)
with check ((select private.is_nest_member(room_id)) and source_chore_id is null);

drop policy if exists "members can delete manual calendar events" on public.calendar_events;
create policy "members can delete manual calendar events"
on public.calendar_events for delete to authenticated
using ((select private.is_nest_member(room_id)) and source_chore_id is null);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_events'
  ) then
    alter publication supabase_realtime add table public.calendar_events;
  end if;
end
$$;
