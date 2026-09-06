-- Always derive the manual event owner from the authenticated caller. This
-- prevents stale client-side profile data from blocking a room member's event.
create or replace function private.validate_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.source_chore_id is null then
    if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
    new.created_by := (select auth.uid());
  elsif tg_op = 'UPDATE' and new.source_chore_id is null and (
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
