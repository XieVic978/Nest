create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 80),
  phone text,
  venmo text,
  zelle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists venmo text;
alter table public.profiles add column if not exists zelle text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "users can read their profile" on public.profiles;
create policy "users can read their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "users can create their profile" on public.profiles;
create policy "users can create their profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "users can update their profile" on public.profiles;
create policy "users can update their profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
