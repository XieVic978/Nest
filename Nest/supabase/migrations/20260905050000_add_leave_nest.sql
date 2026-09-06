-- Leave a Nest atomically. Admins hand ownership to the earliest remaining
-- member; deleting the final membership deletes the room and all child data.

create or replace function private.leave_nest_membership(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.room_members%rowtype;
  v_room_id uuid;
  v_next_admin_id uuid;
  v_remaining_count bigint;
begin
  select room_id into v_room_id
  from public.room_members
  where user_id = p_user_id;

  if v_room_id is null then
    raise exception 'nest_membership_required';
  end if;

  -- Serialize membership changes in this room so two simultaneous departures
  -- cannot promote the wrong person or leave a room without an admin.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_room_id::text, 2)
  );

  select * into v_membership
  from public.room_members
  where room_id = v_room_id
    and user_id = p_user_id
  for update;

  if v_membership.user_id is null then
    raise exception 'nest_membership_required';
  end if;

  select pg_catalog.count(*) into v_remaining_count
  from public.room_members
  where room_id = v_room_id
    and user_id <> p_user_id;

  if v_remaining_count = 0 then
    delete from public.rooms
    where id = v_room_id;

    return pg_catalog.jsonb_build_object(
      'status', 'left',
      'roomId', v_room_id,
      'roomDeleted', true,
      'newAdminUserId', null
    );
  end if;

  if v_membership.role = 'admin' then
    select user_id into v_next_admin_id
    from public.room_members
    where room_id = v_room_id
      and user_id <> p_user_id
    order by joined_at asc, user_id asc
    limit 1
    for update;

    -- Remove the old admin role first to satisfy the one-admin unique index.
    update public.room_members
    set role = 'member'
    where room_id = v_room_id
      and user_id = p_user_id;

    update public.room_members
    set role = 'admin'
    where room_id = v_room_id
      and user_id = v_next_admin_id;

    -- Invites were created under the departing admin's authority. The new
    -- admin can generate a fresh ten-minute invitation when they are ready.
    update public.room_invites
    set revoked_at = pg_catalog.now()
    where room_id = v_room_id
      and revoked_at is null;
  end if;

  delete from public.room_members
  where room_id = v_room_id
    and user_id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'status', 'left',
    'roomId', v_room_id,
    'roomDeleted', false,
    'newAdminUserId', v_next_admin_id
  );
end;
$$;

revoke execute on function private.leave_nest_membership(uuid)
from public, anon, authenticated;

-- Some existing projects already have a void-returning leave_nest() RPC.
-- PostgreSQL cannot change a function's return type with CREATE OR REPLACE,
-- so remove that zero-argument signature before recreating it as JSONB.
drop function if exists public.leave_nest();

create function public.leave_nest()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  return private.leave_nest_membership(v_user_id);
end;
$$;

revoke execute on function public.leave_nest() from public, anon;
grant execute on function public.leave_nest() to authenticated;

-- Switching Nests uses the same departure rules. Because this entire function
-- is one transaction, a failed target insert also rolls back the old departure.
create or replace function public.join_nest(
  p_invite text,
  p_display_name text,
  p_confirm_leave boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite public.room_invites%rowtype;
  v_current public.room_members%rowtype;
  v_target_room public.rooms%rowtype;
  v_token uuid;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 1 and 80 then
    raise exception 'display_name_required';
  end if;

  begin
    v_token := pg_catalog.btrim(p_invite)::uuid;
  exception
    when invalid_text_representation then
      v_token := null;
      v_code := pg_catalog.upper(
        pg_catalog.regexp_replace(p_invite, '[^A-Za-z0-9]', '', 'g')
      );
  end;

  if v_token is not null then
    select * into v_invite
    from public.room_invites
    where token = v_token
    limit 1
    for share;
  else
    select * into v_invite
    from public.room_invites
    where code = v_code
    limit 1
    for share;
  end if;

  if v_invite.id is null then
    raise exception 'invalid_invite';
  end if;

  select * into v_target_room
  from public.rooms
  where id = v_invite.room_id;

  if v_target_room.id is null then
    raise exception 'nest_not_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select * into v_current
  from public.room_members
  where user_id = v_user_id;

  if v_current.room_id = v_target_room.id then
    return pg_catalog.jsonb_build_object(
      'status', 'already_member',
      'roomId', v_target_room.id,
      'roomName', v_target_room.name
    );
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked';
  end if;
  if v_invite.expires_at <= pg_catalog.now() then
    raise exception 'invite_expired';
  end if;

  if v_current.room_id is not null and not p_confirm_leave then
    return pg_catalog.jsonb_build_object(
      'status', 'switch_required',
      'roomId', v_target_room.id,
      'roomName', v_target_room.name
    );
  end if;

  if v_current.room_id is not null then
    perform private.leave_nest_membership(v_user_id);
  end if;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (
    v_target_room.id,
    v_user_id,
    pg_catalog.btrim(p_display_name),
    'member'
  );

  return pg_catalog.jsonb_build_object(
    'status', 'joined',
    'roomId', v_target_room.id,
    'roomName', v_target_room.name
  );
end;
$$;

revoke execute on function public.join_nest(text, text, boolean)
from public, anon;
grant execute on function public.join_nest(text, text, boolean)
to authenticated;

-- Coordinate admin-driven member changes with leave_nest as well.
create or replace function public.remove_nest_member(
  p_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.room_members%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_room_id::text, 2)
  );

  if not (select private.is_nest_admin(p_room_id)) then
    raise exception 'nest_admin_required';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_remove_self';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id
  for update;

  if v_member.user_id is null then
    raise exception 'membership_not_found';
  end if;
  if v_member.role = 'admin' then
    raise exception 'member_is_admin';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.transfer_nest_admin(
  p_room_id uuid,
  p_new_admin_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_room_id::text, 2)
  );

  if not (select private.is_nest_admin(p_room_id)) then
    raise exception 'nest_admin_required';
  end if;
  if not exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = p_new_admin_id
  ) then
    raise exception 'membership_not_found';
  end if;

  update public.room_members
  set role = 'member'
  where room_id = p_room_id
    and role = 'admin';

  update public.room_members
  set role = 'admin'
  where room_id = p_room_id
    and user_id = p_new_admin_id;
end;
$$;

revoke execute on function public.remove_nest_member(uuid, uuid)
from public, anon;
revoke execute on function public.transfer_nest_admin(uuid, uuid)
from public, anon;
grant execute on function public.remove_nest_member(uuid, uuid)
to authenticated;
grant execute on function public.transfer_nest_admin(uuid, uuid)
to authenticated;
