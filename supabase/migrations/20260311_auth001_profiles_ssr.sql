alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_profiles_email
  on public.profiles (email);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_select_self"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;
drop function if exists public.sync_profile_from_auth_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select
  users.id,
  users.email,
  nullif(users.raw_user_meta_data ->> 'full_name', ''),
  nullif(users.raw_user_meta_data ->> 'avatar_url', '')
from auth.users as users
where not exists (
  select 1
  from public.profiles as profiles
  where profiles.id = users.id
);

update public.profiles as profiles
set
  email = coalesce(profiles.email, users.email),
  full_name = coalesce(
    nullif(profiles.full_name, ''),
    nullif(users.raw_user_meta_data ->> 'full_name', '')
  ),
  avatar_url = coalesce(
    nullif(profiles.avatar_url, ''),
    nullif(users.raw_user_meta_data ->> 'avatar_url', '')
  )
from auth.users as users
where users.id = profiles.id
  and (
    profiles.email is null
    or nullif(profiles.full_name, '') is null
    or nullif(profiles.avatar_url, '') is null
  );
