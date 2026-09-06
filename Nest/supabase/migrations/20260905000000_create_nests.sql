create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

do $$
begin
  create type public.room_member_role as enum ('admin', 'member');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role public.room_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (user_id)
);

create unique index if not exists room_members_one_admin_per_room
  on public.room_members (room_id)
  where role = 'admin';

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{10}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists room_members_room_id_idx on public.room_members(room_id);
create index if not exists room_invites_room_id_idx on public.room_invites(room_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;

revoke all on table public.rooms, public.room_members, public.room_invites from anon, authenticated;
grant select on table public.rooms, public.room_members, public.room_invites to authenticated;

create or replace function private.is_nest_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_nest_admin(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function private.is_nest_member(uuid) from public, anon;
revoke execute on function private.is_nest_admin(uuid) from public, anon;
grant execute on function private.is_nest_member(uuid) to authenticated;
grant execute on function private.is_nest_admin(uuid) to authenticated;

drop policy if exists "members can read their nest" on public.rooms;
create policy "members can read their nest"
on public.rooms for select
to authenticated
using ((select private.is_nest_member(id)));

drop policy if exists "members can read nest members" on public.room_members;
create policy "members can read nest members"
on public.room_members for select
to authenticated
using ((select private.is_nest_member(room_id)));

drop policy if exists "admins can read nest invites" on public.room_invites;
create policy "admins can read nest invites"
on public.room_invites for select
to authenticated
using ((select private.is_nest_admin(room_id)));

create or replace function private.new_nest_invite(p_room_id uuid, p_user_id uuid)
returns public.room_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.room_invites;
  v_code text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_room_id::text, 1));

  update public.room_invites
  set revoked_at = pg_catalog.now()
  where room_id = p_room_id
    and revoked_at is null;

  loop
    v_code := pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.room_invites (room_id, code, created_by)
      values (p_room_id, v_code, p_user_id)
      returning * into v_invite;
      exit;
    exception
      when unique_violation then null;
    end;
  end loop;

  return v_invite;
end;
$$;

revoke execute on function private.new_nest_invite(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_my_nest()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_membership public.room_members%rowtype;
  v_room public.rooms%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select * into v_membership
  from public.room_members
  where user_id = v_user_id;

  if v_membership.room_id is null then
    return null;
  end if;

  select * into v_room
  from public.rooms
  where id = v_membership.room_id;

  return pg_catalog.jsonb_build_object(
    'room', pg_catalog.jsonb_build_object(
      'id', v_room.id,
      'name', v_room.name,
      'createdBy', v_room.created_by,
      'createdAt', v_room.created_at
    ),
    'membership', pg_catalog.jsonb_build_object(
      'role', v_membership.role,
      'joinedAt', v_membership.joined_at
    ),
    'members', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'userId', member.user_id,
            'displayName', member.display_name,
            'role', member.role,
            'joinedAt', member.joined_at
          ) order by member.joined_at
        ),
        '[]'::jsonb
      )
      from public.room_members as member
      where member.room_id = v_membership.room_id
    )
  );
end;
$$;

create or replace function public.get_active_nest_invite(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_invite public.room_invites%rowtype;
begin
  if not (select private.is_nest_admin(p_room_id)) then
    raise exception 'nest_admin_required';
  end if;

  select * into v_invite
  from public.room_invites
  where room_id = p_room_id
    and revoked_at is null
    and expires_at > pg_catalog.now()
  order by created_at desc
  limit 1;

  if v_invite.id is null then
    return null;
  end if;

  return pg_catalog.jsonb_build_object(
    'token', v_invite.token,
    'code', v_invite.code,
    'expiresAt', v_invite.expires_at
  );
end;
$$;

create or replace function public.create_nest(p_name text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_room public.rooms%rowtype;
  v_invite public.room_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_name)) not between 1 and 60 then
    raise exception 'nest_name_required';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_display_name)) not between 1 and 80 then
    raise exception 'display_name_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if exists (select 1 from public.room_members where user_id = v_user_id) then
    raise exception 'already_in_nest';
  end if;

  insert into public.rooms (name, created_by)
  values (pg_catalog.btrim(p_name), v_user_id)
  returning * into v_room;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_room.id, v_user_id, pg_catalog.btrim(p_display_name), 'admin');

  v_invite := private.new_nest_invite(v_room.id, v_user_id);

  return pg_catalog.jsonb_build_object(
    'status', 'created',
    'roomId', v_room.id,
    'invite', pg_catalog.jsonb_build_object(
      'token', v_invite.token,
      'code', v_invite.code,
      'expiresAt', v_invite.expires_at
    )
  );
end;
$$;

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
      v_code := pg_catalog.upper(pg_catalog.regexp_replace(p_invite, '[^A-Za-z0-9]', '', 'g'));
  end;

  if v_token is not null then
    select * into v_invite from public.room_invites where token = v_token limit 1 for share;
  else
    select * into v_invite from public.room_invites where code = v_code limit 1 for share;
  end if;

  if v_invite.id is null then
    raise exception 'invalid_invite';
  end if;
  select * into v_target_room from public.rooms where id = v_invite.room_id;
  if v_target_room.id is null then
    raise exception 'nest_not_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  select * into v_current from public.room_members where user_id = v_user_id for update;

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

  if v_current.room_id is not null and v_current.role = 'admin' and not exists (
    select 1 from public.room_members
    where room_id = v_current.room_id
      and user_id <> v_user_id
      and role = 'admin'
  ) then
    return pg_catalog.jsonb_build_object(
      'status', 'admin_transfer_required',
      'roomId', v_target_room.id,
      'roomName', v_target_room.name
    );
  end if;

  if v_current.room_id is not null then
    delete from public.room_members where user_id = v_user_id;
  end if;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (v_target_room.id, v_user_id, pg_catalog.btrim(p_display_name), 'member');

  return pg_catalog.jsonb_build_object(
    'status', 'joined',
    'roomId', v_target_room.id,
    'roomName', v_target_room.name
  );
end;
$$;

create or replace function public.regenerate_nest_invite(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite public.room_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if not (select private.is_nest_admin(p_room_id)) then
    raise exception 'nest_admin_required';
  end if;

  v_invite := private.new_nest_invite(p_room_id, v_user_id);
  return pg_catalog.jsonb_build_object(
    'token', v_invite.token,
    'code', v_invite.code,
    'expiresAt', v_invite.expires_at
  );
end;
$$;

create or replace function public.remove_nest_member(p_room_id uuid, p_user_id uuid)
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
  if not (select private.is_nest_admin(p_room_id)) then
    raise exception 'nest_admin_required';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_remove_self';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id and user_id = p_user_id
  for update;

  if v_member.user_id is null then
    raise exception 'membership_not_found';
  end if;
  if v_member.role = 'admin' then
    raise exception 'member_is_admin';
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = p_user_id;
end;
$$;

create or replace function public.transfer_nest_admin(p_room_id uuid, p_new_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication_required';
  end if;
  if not (select private.is_nest_admin(p_room_id)) then
    raise exception 'nest_admin_required';
  end if;
  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_new_admin_id
  ) then
    raise exception 'membership_not_found';
  end if;

  update public.room_members
  set role = 'member'
  where room_id = p_room_id and role = 'admin';

  update public.room_members
  set role = 'admin'
  where room_id = p_room_id and user_id = p_new_admin_id;
end;
$$;

revoke execute on function public.get_my_nest() from public, anon;
revoke execute on function public.get_active_nest_invite(uuid) from public, anon;
revoke execute on function public.create_nest(text, text) from public, anon;
revoke execute on function public.join_nest(text, text, boolean) from public, anon;
revoke execute on function public.regenerate_nest_invite(uuid) from public, anon;
revoke execute on function public.remove_nest_member(uuid, uuid) from public, anon;
revoke execute on function public.transfer_nest_admin(uuid, uuid) from public, anon;

grant execute on function public.get_my_nest() to authenticated;
grant execute on function public.get_active_nest_invite(uuid) to authenticated;
grant execute on function public.create_nest(text, text) to authenticated;
grant execute on function public.join_nest(text, text, boolean) to authenticated;
grant execute on function public.regenerate_nest_invite(uuid) to authenticated;
grant execute on function public.remove_nest_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_nest_admin(uuid, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'room_members'
    ) then
    alter publication supabase_realtime add table public.room_members;
  end if;
end
$$;

-- Every shared feature table (groceries, payments, chores, bills,
-- announcements, events, and documents) must include a non-null room_id and
-- use private.is_nest_member(room_id) in its SELECT/INSERT/UPDATE/DELETE RLS
-- policies. Client-side filtering alone is not an authorization boundary.
