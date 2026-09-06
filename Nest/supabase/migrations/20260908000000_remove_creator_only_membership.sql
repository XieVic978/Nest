-- The creator is recorded for history only. Every room member has equal access.
update public.room_members set role = 'member' where role = 'admin';
drop index if exists public.room_members_one_admin_per_room;

alter table public.rooms alter column join_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

create or replace function public.create_nest(p_name text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 60 then raise exception 'nest_name_required'; end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 1 and 80 then raise exception 'display_name_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if exists (select 1 from public.room_members where user_id = v_user_id) then raise exception 'already_in_nest'; end if;
  insert into public.rooms (name, created_by) values (pg_catalog.btrim(p_name), v_user_id) returning * into v_room;
  insert into public.room_members (room_id, user_id, display_name, role) values (v_room.id, v_user_id, pg_catalog.btrim(p_display_name), 'member');
  return pg_catalog.jsonb_build_object('status', 'created', 'roomId', v_room.id, 'roomName', v_room.name);
end;
$$;
