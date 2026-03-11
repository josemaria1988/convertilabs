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
