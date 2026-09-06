create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  assignee_user_id uuid not null references auth.users(id) on delete restrict,
  due_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  recurrence text not null default 'once' check (recurrence in ('once', 'weekly', 'biweekly', 'monthly')),
  rotation_user_ids uuid[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'completed' and completed_at is not null)
    or (status = 'upcoming' and completed_by is null and completed_at is null)
  )
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  author_user_id uuid not null references auth.users(id) on delete restrict,
  pinned boolean not null default false,
  automated boolean not null default false,
  target text check (target is null or target in ('chores', 'payments', 'groceries', 'calendar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcement_user_states (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  primary key (announcement_id, user_id)
);

create index if not exists chores_room_due_idx
  on public.chores(room_id, due_date, created_at desc);
create index if not exists announcements_room_created_idx
  on public.announcements(room_id, pinned desc, created_at desc);
create index if not exists announcement_states_room_user_idx
  on public.announcement_user_states(room_id, user_id);

alter table public.chores enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_user_states enable row level security;

alter table public.chores replica identity full;
alter table public.announcements replica identity full;
alter table public.announcement_user_states replica identity full;

revoke all on table public.chores, public.announcements, public.announcement_user_states from anon, authenticated;
grant select, insert, update, delete on table public.chores to authenticated;
grant select, insert, update, delete on table public.announcements to authenticated;
grant select, insert, update, delete on table public.announcement_user_states to authenticated;

create or replace function private.is_specific_nest_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = p_user_id
  );
$$;

revoke execute on function private.is_specific_nest_member(uuid, uuid) from public, anon;
grant execute on function private.is_specific_nest_member(uuid, uuid) to authenticated;

create or replace function private.validate_nest_chore()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rotation_user_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.room_id <> old.room_id or new.created_by <> old.created_by then
      raise exception 'chore_ownership_immutable';
    end if;
    if old.status = 'completed' then
      raise exception 'completed_chore_immutable';
    end if;
  else
    if new.created_by <> (select auth.uid()) then
      raise exception 'invalid_chore_creator';
    end if;
  end if;

  if not (select private.is_specific_nest_member(new.room_id, new.assignee_user_id)) then
    raise exception 'assignee_not_in_nest';
  end if;

  foreach v_rotation_user_id in array new.rotation_user_ids loop
    if not (select private.is_specific_nest_member(new.room_id, v_rotation_user_id)) then
      raise exception 'rotation_member_not_in_nest';
    end if;
  end loop;

  if pg_catalog.cardinality(new.rotation_user_ids) > 0
     and not (new.assignee_user_id = any(new.rotation_user_ids)) then
    raise exception 'assignee_not_in_rotation';
  end if;

  if new.status = 'completed' then
    if new.completed_by <> (select auth.uid()) then
      raise exception 'invalid_chore_completer';
    end if;
  elsif new.completed_by is not null or new.completed_at is not null then
    raise exception 'invalid_chore_completion';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.validate_nest_chore() from public, anon, authenticated;

drop trigger if exists validate_nest_chore_trigger on public.chores;
create trigger validate_nest_chore_trigger
before insert or update on public.chores
for each row execute function private.validate_nest_chore();

create or replace function private.reassign_removed_member_chores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fallback_user_id uuid;
begin
  select user_id into v_fallback_user_id
  from public.room_members
  where room_id = old.room_id
  order by joined_at
  limit 1;

  if v_fallback_user_id is null then
    return old;
  end if;

  update public.chores
  set
    rotation_user_ids = pg_catalog.array_remove(rotation_user_ids, old.user_id),
    assignee_user_id = case
      when assignee_user_id = old.user_id then coalesce(
        (pg_catalog.array_remove(rotation_user_ids, old.user_id))[1],
        v_fallback_user_id
      )
      else assignee_user_id
    end
  where room_id = old.room_id
    and status = 'upcoming'
    and (
      assignee_user_id = old.user_id
      or old.user_id = any(rotation_user_ids)
    );

  return old;
end;
$$;

revoke execute on function private.reassign_removed_member_chores() from public, anon, authenticated;

drop trigger if exists reassign_removed_member_chores_trigger on public.room_members;
create trigger reassign_removed_member_chores_trigger
after delete on public.room_members
for each row execute function private.reassign_removed_member_chores();

create or replace function private.validate_nest_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.room_id <> old.room_id or new.author_user_id <> old.author_user_id
       or new.created_at <> old.created_at then
      raise exception 'announcement_ownership_immutable';
    end if;
    if new.pinned <> old.pinned and not (select private.is_nest_admin(new.room_id)) then
      raise exception 'nest_admin_required_to_pin';
    end if;
  else
    if new.author_user_id <> (select auth.uid()) then
      raise exception 'invalid_announcement_author';
    end if;
    if new.pinned and not (select private.is_nest_admin(new.room_id)) then
      raise exception 'nest_admin_required_to_pin';
    end if;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.validate_nest_announcement() from public, anon, authenticated;

drop trigger if exists validate_nest_announcement_trigger on public.announcements;
create trigger validate_nest_announcement_trigger
before insert or update on public.announcements
for each row execute function private.validate_nest_announcement();

create or replace function private.validate_announcement_user_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_announcement_room_id uuid;
begin
  select room_id into v_announcement_room_id
  from public.announcements
  where id = new.announcement_id;

  if v_announcement_room_id is null or v_announcement_room_id <> new.room_id then
    raise exception 'announcement_room_mismatch';
  end if;
  if new.user_id <> (select auth.uid()) then
    raise exception 'invalid_announcement_state_user';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_announcement_user_state() from public, anon, authenticated;

drop trigger if exists validate_announcement_user_state_trigger on public.announcement_user_states;
create trigger validate_announcement_user_state_trigger
before insert or update on public.announcement_user_states
for each row execute function private.validate_announcement_user_state();

drop policy if exists "members can read nest chores" on public.chores;
create policy "members can read nest chores"
on public.chores for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members can create nest chores" on public.chores;
create policy "members can create nest chores"
on public.chores for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members can update nest chores" on public.chores;
create policy "members can update nest chores"
on public.chores for update to authenticated
using ((select private.is_nest_member(room_id)))
with check ((select private.is_nest_member(room_id)));

drop policy if exists "members can delete nest chores" on public.chores;
create policy "members can delete nest chores"
on public.chores for delete to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members can read nest announcements" on public.announcements;
create policy "members can read nest announcements"
on public.announcements for select to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "members can create nest announcements" on public.announcements;
create policy "members can create nest announcements"
on public.announcements for insert to authenticated
with check (
  author_user_id = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "authors and admins can update announcements" on public.announcements;
create policy "authors and admins can update announcements"
on public.announcements for update to authenticated
using (
  author_user_id = (select auth.uid())
  or (select private.is_nest_admin(room_id))
)
with check ((select private.is_nest_member(room_id)));

drop policy if exists "authors and admins can delete announcements" on public.announcements;
create policy "authors and admins can delete announcements"
on public.announcements for delete to authenticated
using (
  author_user_id = (select auth.uid())
  or (select private.is_nest_admin(room_id))
);

drop policy if exists "members can read their announcement states" on public.announcement_user_states;
create policy "members can read their announcement states"
on public.announcement_user_states for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members can create their announcement states" on public.announcement_user_states;
create policy "members can create their announcement states"
on public.announcement_user_states for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members can update their announcement states" on public.announcement_user_states;
create policy "members can update their announcement states"
on public.announcement_user_states for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_nest_member(room_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

drop policy if exists "members can delete their announcement states" on public.announcement_user_states;
create policy "members can delete their announcement states"
on public.announcement_user_states for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_nest_member(room_id))
);

create or replace function public.complete_nest_chore(p_chore_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_chore public.chores%rowtype;
  v_next_assignee uuid;
  v_next_due date;
  v_current_position integer;
  v_new_chore_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_chore
  from public.chores
  where id = p_chore_id
  for update;

  if v_chore.id is null then
    raise exception 'chore_not_found';
  end if;
  if not (select private.is_nest_member(v_chore.room_id)) then
    raise exception 'nest_membership_required';
  end if;
  if v_chore.status = 'completed' then
    return null;
  end if;

  update public.chores
  set status = 'completed', completed_by = v_user_id, completed_at = pg_catalog.now()
  where id = v_chore.id;

  if v_chore.recurrence = 'once' then
    return null;
  end if;

  v_next_due := case v_chore.recurrence
    when 'weekly' then v_chore.due_date + 7
    when 'biweekly' then v_chore.due_date + 14
    when 'monthly' then (v_chore.due_date + interval '1 month')::date
  end;

  if pg_catalog.cardinality(v_chore.rotation_user_ids) > 0 then
    v_current_position := pg_catalog.array_position(v_chore.rotation_user_ids, v_chore.assignee_user_id);
    if v_current_position is null then
      v_next_assignee := v_chore.rotation_user_ids[1];
    else
      v_next_assignee := v_chore.rotation_user_ids[
        (v_current_position % pg_catalog.cardinality(v_chore.rotation_user_ids)) + 1
      ];
    end if;
  else
    v_next_assignee := v_chore.assignee_user_id;
  end if;

  insert into public.chores (
    room_id, title, description, assignee_user_id, due_date, status,
    priority, recurrence, rotation_user_ids, created_by
  ) values (
    v_chore.room_id, v_chore.title, v_chore.description, v_next_assignee,
    v_next_due, 'upcoming', v_chore.priority, v_chore.recurrence,
    v_chore.rotation_user_ids, v_user_id
  )
  returning id into v_new_chore_id;

  return v_new_chore_id;
end;
$$;

revoke execute on function public.complete_nest_chore(uuid) from public, anon;
grant execute on function public.complete_nest_chore(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chores'
  ) then
    alter publication supabase_realtime add table public.chores;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcement_user_states'
  ) then
    alter publication supabase_realtime add table public.announcement_user_states;
  end if;
end
$$;
