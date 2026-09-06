-- COALESCE is a PostgreSQL conditional expression, not a schema-qualified
-- pg_catalog function. Replace the room snapshot function for databases that
-- already applied 20260905000000_create_nests.sql.
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

revoke execute on function public.get_my_nest() from public, anon;
grant execute on function public.get_my_nest() to authenticated;
