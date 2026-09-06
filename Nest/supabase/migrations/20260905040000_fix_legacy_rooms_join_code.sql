-- Some Supabase projects created the rooms table before the current invite
-- design and still have rooms.join_code defined as NOT NULL. The current room
-- flow stores expiring, regeneratable codes in room_invites, so create_nest
-- intentionally does not write the legacy column.
--
-- Keep the column for compatibility with older teammate branches, but allow
-- the current create_nest function to insert a room without duplicating the
-- invite code in two places. This is safe to run more than once and is also a
-- no-op on projects that never had the legacy column.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rooms'
      and column_name = 'join_code'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.rooms alter column join_code drop not null';
  end if;
end
$$;
