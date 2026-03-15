alter type public.member_role add value if not exists 'admin_processing';

alter table public.organizations
  add column if not exists tax_id_normalized text;

update public.organizations
set
  tax_id_normalized = nullif(regexp_replace(coalesce(tax_id, ''), '\D+', '', 'g'), ''),
  updated_at = now()
where coalesce(tax_id, '') <> '';

with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by tax_id_normalized
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.organizations
  where tax_id_normalized is not null
)
update public.organizations as organizations
set
  tax_id_normalized = null,
  updated_at = now()
from ranked_duplicates
where ranked_duplicates.id = organizations.id
  and ranked_duplicates.duplicate_rank > 1;

create unique index if not exists idx_organizations_tax_id_normalized
  on public.organizations (tax_id_normalized)
  where tax_id_normalized is not null;

drop function if exists public.create_organization_with_owner(text, text, text, text);
drop function if exists public.create_organization_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

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
  v_tax_id_normalized text;
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

  v_tax_id_normalized := nullif(regexp_replace(trim(coalesce(p_tax_id, '')), '\D+', '', 'g'), '');

  if v_tax_id_normalized is null then
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
    from public.organizations as o
    where o.tax_id_normalized = v_tax_id_normalized
  ) then
    raise exception 'An organization with this tax id already exists. Request access to the existing tenant instead.'
      using errcode = '23505';
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
    tax_id_normalized,
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
    v_tax_id_normalized,
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

create table if not exists public.document_assignment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  triggered_by_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'started',
  request_payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  selected_account_id uuid references public.chart_of_accounts(id) on delete set null,
  selected_operation_category text,
  selected_template_code text,
  selected_tax_profile_code text,
  confidence numeric(5,4),
  provider_code text,
  model_code text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_document_assignment_runs_doc_created
  on public.document_assignment_runs (document_id, created_at desc);
