-- Let every current Nest member view, share, and regenerate the room's single
-- active invitation. Regenerating still revokes every older link and code.

drop policy if exists "admins can read nest invites" on public.room_invites;
drop policy if exists "members can read nest invites" on public.room_invites;
create policy "members can read nest invites"
on public.room_invites for select
to authenticated
using ((select private.is_nest_member(room_id)));

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
  if not (select private.is_nest_member(p_room_id)) then
    raise exception 'nest_membership_required';
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
  if not (select private.is_nest_member(p_room_id)) then
    raise exception 'nest_membership_required';
  end if;

  v_invite := private.new_nest_invite(p_room_id, v_user_id);
  return pg_catalog.jsonb_build_object(
    'token', v_invite.token,
    'code', v_invite.code,
    'expiresAt', v_invite.expires_at
  );
end;
$$;

revoke execute on function public.get_active_nest_invite(uuid)
from public, anon;
revoke execute on function public.regenerate_nest_invite(uuid)
from public, anon;
grant execute on function public.get_active_nest_invite(uuid)
to authenticated;
grant execute on function public.regenerate_nest_invite(uuid)
to authenticated;

alter table public.room_invites replica identity full;

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
      and tablename = 'room_invites'
  ) then
    alter publication supabase_realtime add table public.room_invites;
  end if;
end
$$;
