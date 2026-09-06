-- Private storage bucket for receipt images.
--
-- Path convention: `<room_id>/<filename>` inside the `receipts` bucket. Access
-- is granted only to members of the room named by the first path segment, so a
-- roommate can only read/write receipts for their own Nest.
--
-- The bucket is private (public = false); the app fetches images with signed
-- URLs created through the authenticated client.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Members of the room in the first path segment can read its receipts.
drop policy if exists "members read nest receipts" on storage.objects;
create policy "members read nest receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (select private.is_nest_member((storage.foldername(name))[1]::uuid))
);

-- Members can upload receipts into their room's folder.
drop policy if exists "members upload nest receipts" on storage.objects;
create policy "members upload nest receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (select private.is_nest_member((storage.foldername(name))[1]::uuid))
);

-- Members can delete receipts in their room's folder (e.g. when removing an
-- expense or replacing a bad scan).
drop policy if exists "members delete nest receipts" on storage.objects;
create policy "members delete nest receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'receipts'
  and (select private.is_nest_member((storage.foldername(name))[1]::uuid))
);
