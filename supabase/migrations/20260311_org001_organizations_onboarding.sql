create index if not exists idx_organization_members_user_id
  on public.organization_members (user_id);

create index if not exists idx_organization_members_organization_id
  on public.organization_members (organization_id);

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

create or replace function public.create_organization_with_owner(p_name text)
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
    created_by
  )
  values (
    v_normalized_name,
    v_slug,
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

revoke all on function public.create_organization_with_owner(text) from public;
grant execute on function public.create_organization_with_owner(text) to authenticated;
grant execute on function public.create_organization_with_owner(text) to service_role;

drop policy if exists "organizations_select_member_or_creator" on public.organizations;
create policy "organizations_select_member_or_creator"
on public.organizations
for select
using (public.is_org_member(id));

drop policy if exists "organizations_insert_authenticated_creator" on public.organizations;

drop policy if exists "organization_members_select_self_or_owner_admin" on public.organization_members;
drop policy if exists "organization_members_select_member" on public.organization_members;
create policy "organization_members_select_member"
on public.organization_members
for select
using (public.is_org_member(organization_id));

drop policy if exists "organization_members_insert_owner_admin_or_bootstrap" on public.organization_members;
