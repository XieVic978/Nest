-- Chore calendar rows are maintained by sync_chore_calendar_event. They must
-- not be treated as manual calendar events when a roommate edits, completes,
-- or removes the associated chore.
create or replace function private.validate_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.source_chore_id is null then
      if (select auth.uid()) is null then
        raise exception 'authentication_required';
      end if;

      -- Manual events always belong to their creator, regardless of values
      -- supplied from an older client.
      new.created_by := (select auth.uid());
    end if;
  elsif tg_op = 'UPDATE' then
    if new.room_id <> old.room_id
      or new.source_chore_id is distinct from old.source_chore_id then
      raise exception 'calendar_event_ownership_immutable';
    end if;

    -- Only manual events have an immutable user owner. A chore event keeps
    -- the original chore creator while any Nest member updates the chore.
    if new.source_chore_id is null
      and new.created_by <> old.created_by then
      raise exception 'calendar_event_ownership_immutable';
    end if;
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
