insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "nest members can read receipts" on storage.objects;
create policy "nest members can read receipts" on storage.objects for select to authenticated
using (bucket_id = 'receipts' and (select private.is_nest_member((storage.foldername(name))[1]::uuid)));

drop policy if exists "nest members can upload receipts" on storage.objects;
create policy "nest members can upload receipts" on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and (select private.is_nest_member((storage.foldername(name))[1]::uuid)));

drop policy if exists "nest members can delete receipts" on storage.objects;
create policy "nest members can delete receipts" on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and (select private.is_nest_member((storage.foldername(name))[1]::uuid)));
