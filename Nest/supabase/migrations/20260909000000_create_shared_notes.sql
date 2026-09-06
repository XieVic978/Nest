create table if not exists public.shared_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null default 'Untitled note' check (char_length(btrim(title)) between 1 and 160),
  content text not null default '' check (char_length(content) <= 20000),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shared_notes_one_per_room on public.shared_notes(room_id);
alter table public.shared_notes enable row level security;
alter table public.shared_notes replica identity full;
revoke all on table public.shared_notes from anon, authenticated;
grant select, insert, update, delete on public.shared_notes to authenticated;

create or replace function private.validate_shared_note()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_nest_member(new.room_id)) then raise exception 'nest_membership_required'; end if;
  if tg_op = 'INSERT' then
    if new.created_by <> auth.uid() or new.updated_by <> auth.uid() then raise exception 'invalid_note_author'; end if;
  else
    if new.room_id <> old.room_id or new.created_by <> old.created_by or new.created_at <> old.created_at then raise exception 'note_ownership_immutable'; end if;
    new.updated_by := auth.uid(); new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_shared_note() from public, anon, authenticated;
drop trigger if exists validate_shared_note_trigger on public.shared_notes;
create trigger validate_shared_note_trigger before insert or update on public.shared_notes for each row execute function private.validate_shared_note();

drop policy if exists "members can read shared notes" on public.shared_notes;
create policy "members can read shared notes" on public.shared_notes for select to authenticated using ((select private.is_nest_member(room_id)));
drop policy if exists "members can create shared notes" on public.shared_notes;
create policy "members can create shared notes" on public.shared_notes for insert to authenticated with check (created_by = auth.uid() and updated_by = auth.uid() and (select private.is_nest_member(room_id)));
drop policy if exists "members can edit shared notes" on public.shared_notes;
create policy "members can edit shared notes" on public.shared_notes for update to authenticated using ((select private.is_nest_member(room_id))) with check ((select private.is_nest_member(room_id)));
drop policy if exists "members can delete shared notes" on public.shared_notes;
create policy "members can delete shared notes" on public.shared_notes for delete to authenticated using ((select private.is_nest_member(room_id)));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_notes') then
    alter publication supabase_realtime add table public.shared_notes;
  end if;
end $$;
