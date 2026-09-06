-- Permanent Nest codes live on rooms. The previous regenerate RPC only made a
-- row in the legacy room_invites table, so its code could never be accepted by
-- join_nest_by_code. Regenerate the room's real code instead.
create or replace function public.regenerate_nest_join_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room_id uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select members.room_id
  into v_room_id
  from public.room_members members
  where members.user_id = v_user_id;

  if v_room_id is null then
    raise exception 'membership_not_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_room_id::text, 2)
  );

  loop
    v_code := pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        10
      )
    );

    begin
      update public.rooms
      set join_code = v_code
      where id = v_room_id;
      exit;
    exception
      when unique_violation then null;
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.regenerate_nest_join_code() from public, anon;
grant execute on function public.regenerate_nest_join_code() to authenticated;

-- Prevent older clients from generating an expiring code that the permanent
-- join flow cannot consume.
revoke execute on function public.regenerate_nest_invite(uuid) from authenticated;

-- Let every signed-in member refresh the displayed code when another member
-- regenerates it.
alter table public.rooms replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end
$$;
