create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email
  on public.profiles (email);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code text not null default 'UY',
  base_currency text not null default 'UYU',
  legal_entity_type text,
  tax_id text,
  tax_regime_code text,
  vat_regime text,
  dgi_group text,
  cfe_status text,
  default_locale text not null default 'es-UY',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_user_id
  on public.organization_members (user_id);

create index if not exists idx_organization_members_organization_id
  on public.organization_members (organization_id);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members as om
    where om.organization_id = p_org_id
      and om.user_id = auth.uid()
      and om.is_active = true
  );
$$;

create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members as om
    where om.organization_id = p_org_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role = 'owner'::public.member_role
  );
$$;

create or replace function public.slugify_organization_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(
    both '-'
    from regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(p_name, '')),
          U&'\00E1\00E0\00E4\00E2\00E3\00E5\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00F5\00FA\00F9\00FC\00FB\00F1\00E7',
          'aaaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-{2,}',
      '-',
      'g'
    )
  );
$$;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_legal_entity_type text default null,
  p_tax_id text default null,
  p_tax_regime_code text default null,
  p_vat_regime text default null,
  p_dgi_group text default null,
  p_cfe_status text default null
)
returns table (organization_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_name text;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 0;
  v_organization_id uuid;
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  v_normalized_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');

  if char_length(v_normalized_name) < 2 then
    raise exception 'Organization name must contain at least 2 characters.'
      using errcode = '22023';
  end if;

  if char_length(v_normalized_name) > 120 then
    raise exception 'Organization name must contain at most 120 characters.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_legal_entity_type, '')), '') is null then
    raise exception 'Organization legal entity type is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_tax_id, '')), '') is null then
    raise exception 'Organization tax id is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_tax_regime_code, '')), '') is null then
    raise exception 'Organization tax regime code is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_vat_regime, '')), '') is null then
    raise exception 'Organization vat regime is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_dgi_group, '')), '') is null then
    raise exception 'Organization dgi group is required.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_cfe_status, '')), '') is null then
    raise exception 'Organization cfe status is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
  ) then
    raise exception 'Profile missing for authenticated user.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.organization_members as om
    where om.user_id = v_user_id
      and om.is_active = true
  ) then
    raise exception 'User already belongs to an active organization.'
      using errcode = 'P0001';
  end if;

  v_base_slug := public.slugify_organization_name(v_normalized_name);

  if v_base_slug = '' then
    raise exception 'Organization name must include letters or numbers.'
      using errcode = '22023';
  end if;

  v_slug := v_base_slug;

  loop
    exit when not exists (
      select 1
      from public.organizations as o
      where o.slug = v_slug
    );

    v_suffix := v_suffix + 1;
    v_slug := format('%s-%s', v_base_slug, v_suffix);
  end loop;

  insert into public.organizations (
    name,
    slug,
    legal_entity_type,
    tax_id,
    tax_regime_code,
    vat_regime,
    dgi_group,
    cfe_status,
    created_by
  )
  values (
    v_normalized_name,
    v_slug,
    trim(p_legal_entity_type),
    trim(p_tax_id),
    trim(p_tax_regime_code),
    trim(p_vat_regime),
    trim(p_dgi_group),
    trim(p_cfe_status),
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    v_organization_id,
    v_user_id,
    'owner'::public.member_role
  );

  organization_id := v_organization_id;
  slug := v_slug;

  return next;
end;
$$;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_legal_entity_type text default null,
  p_tax_id text default null,
  p_tax_regime_code text default null
)
returns table (organization_id uuid, slug text)
language sql
security definer
set search_path = public
as $$
  select *
  from public.create_organization_with_owner(
    p_name,
    p_legal_entity_type,
    p_tax_id,
    p_tax_regime_code,
    'UNKNOWN',
    'UNKNOWN',
    'UNKNOWN'
  );
$$;

revoke all on function public.create_organization_with_owner(text, text, text, text) from public;
revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text) from public;
grant execute on function public.create_organization_with_owner(text, text, text, text) to authenticated;
grant execute on function public.create_organization_with_owner(text, text, text, text) to service_role;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text) to service_role;
