-- Chore-generated calendar entries are maintained only by the chore trigger.
-- Room members cannot edit those entries directly, but any member may update
-- the chore itself (including its calendar-display checkbox).
create or replace function private.validate_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.source_chore_id is null and new.created_by <> (select auth.uid()) then
      raise exception 'invalid_calendar_event_creator';
    end if;
  elsif new.source_chore_id is null and (
    new.room_id <> old.room_id
    or new.created_by <> old.created_by
    or new.source_chore_id is distinct from old.source_chore_id
  ) then
    raise exception 'calendar_event_ownership_immutable';
  end if;

  if new.source_chore_id is null and not (select private.is_nest_member(new.room_id)) then
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
