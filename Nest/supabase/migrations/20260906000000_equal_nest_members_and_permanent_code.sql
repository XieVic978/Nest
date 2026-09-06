-- All Nest members have the same permissions. The creator is only recorded
-- for history; it does not grant extra in-app access.
alter table public.rooms add column if not exists join_code text;

-- Earlier migrations may create a Nest before this permanent-code layer is
-- applied. A default keeps future create_nest calls compatible either way.
alter table public.rooms alter column join_code set default
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

update public.rooms
set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where join_code is null;

alter table public.rooms alter column join_code set not null;
create unique index if not exists rooms_join_code_key on public.rooms (join_code);

create or replace function public.get_nest_join_code()
returns text
language sql security definer set search_path = '' stable
as $$
  select rooms.join_code
  from public.room_members members
  join public.rooms rooms on rooms.id = members.room_id
  where members.user_id = auth.uid()
$$;

-- An earlier migration can provide a JSON-returning leave_nest RPC. PostgreSQL
-- cannot replace a function with a different return type, so remove that
-- signature before restoring the equal-member, membership-only behavior.
drop function if exists public.leave_nest();

create function public.leave_nest()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  delete from public.room_members where user_id = auth.uid();
end;
$$;

create or replace function public.join_nest_by_code(p_code text, p_display_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if char_length(btrim(p_display_name)) not between 1 and 80 then raise exception 'display_name_required'; end if;
  select * into v_room from public.rooms where join_code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if v_room.id is null then raise exception 'invalid_invite'; end if;
  if exists (select 1 from public.room_members where user_id = v_user_id) then raise exception 'already_in_nest'; end if;
  insert into public.room_members (room_id, user_id, display_name, role) values (v_room.id, v_user_id, btrim(p_display_name), 'member');
  return jsonb_build_object('status', 'joined', 'roomId', v_room.id, 'roomName', v_room.name);
end;
$$;

revoke all on function public.get_nest_join_code() from public, anon;
revoke all on function public.leave_nest() from public, anon;
revoke all on function public.join_nest_by_code(text, text) from public, anon;
grant execute on function public.get_nest_join_code() to authenticated;
grant execute on function public.leave_nest() to authenticated;
grant execute on function public.join_nest_by_code(text, text) to authenticated;
