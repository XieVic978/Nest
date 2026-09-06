create or replace function public.sync_room_member_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.room_members
  set display_name = new.full_name
  where user_id = new.id
    and display_name is distinct from new.full_name;
  return new;
end;
$$;

drop trigger if exists sync_room_member_name_from_profile on public.profiles;
create trigger sync_room_member_name_from_profile
after insert or update of full_name on public.profiles
for each row execute function public.sync_room_member_name_from_profile();
