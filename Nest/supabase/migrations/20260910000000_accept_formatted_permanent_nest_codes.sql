-- Some Nests created before permanent codes were standardized store the
-- display separator in rooms.join_code (ABCDE-FGHIJ), while newer Nests store
-- only the ten alphanumeric characters. Normalize both sides of the lookup so
-- either representation remains joinable without changing a Nest's code.
create or replace function public.join_nest_by_code(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_normalized_code text := pg_catalog.upper(
    pg_catalog.regexp_replace(pg_catalog.btrim(p_code), '[^A-Za-z0-9]', '', 'g')
  );
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 1 and 80 then
    raise exception 'display_name_required';
  end if;
  if pg_catalog.char_length(v_normalized_code) <> 10 then
    raise exception 'invalid_invite';
  end if;

  select rooms.*
  into v_room
  from public.rooms rooms
  where pg_catalog.upper(
    pg_catalog.regexp_replace(rooms.join_code, '[^A-Za-z0-9]', '', 'g')
  ) = v_normalized_code
  limit 1;

  if v_room.id is null then
    raise exception 'invalid_invite';
  end if;
  if exists (select 1 from public.room_members where user_id = v_user_id) then
    raise exception 'already_in_nest';
  end if;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_room.id, v_user_id, pg_catalog.btrim(p_display_name), 'member');

  return pg_catalog.jsonb_build_object(
    'status', 'joined',
    'roomId', v_room.id,
    'roomName', v_room.name
  );
end;
$$;

revoke all on function public.join_nest_by_code(text, text) from public, anon;
grant execute on function public.join_nest_by_code(text, text) to authenticated;
