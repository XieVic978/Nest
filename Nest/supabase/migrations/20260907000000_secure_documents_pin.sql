create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profile_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  documents_pin_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_secrets enable row level security;
revoke all on table public.profile_secrets from anon, authenticated;

create or replace function public.set_document_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly four digits'; end if;
  insert into public.profile_secrets (user_id, documents_pin_hash)
  values (auth.uid(), crypt(p_pin, gen_salt('bf', 12)))
  on conflict (user_id) do update set documents_pin_hash = excluded.documents_pin_hash, updated_at = now();
end;
$$;

create or replace function public.verify_document_pin(p_pin text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select p_pin ~ '^[0-9]{4}$' and exists (
    select 1 from public.profile_secrets
    where user_id = auth.uid() and documents_pin_hash = crypt(p_pin, documents_pin_hash)
  );
$$;

create or replace function public.has_document_pin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profile_secrets where user_id = auth.uid());
$$;

revoke all on function public.set_document_pin(text) from public;
revoke all on function public.verify_document_pin(text) from public;
revoke all on function public.has_document_pin() from public;
grant execute on function public.set_document_pin(text) to authenticated;
grant execute on function public.verify_document_pin(text) to authenticated;
grant execute on function public.has_document_pin() to authenticated;
