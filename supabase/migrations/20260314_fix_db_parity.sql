-- Consolidated parity fix for environments where:
-- 1. organizations is missing vat_regime / dgi_group / cfe_status
-- 2. document_processing_runs is missing the Inngest/OpenAI polling columns
--
-- IMPORTANT:
-- Do not drop current_processing_run_id, current_draft_id, last_rule_snapshot_id,
-- or last_processed_at from public.documents. Those columns are valid and used by the app.

alter table public.organizations
  add column if not exists vat_regime text not null default 'UNKNOWN',
  add column if not exists dgi_group text not null default 'UNKNOWN',
  add column if not exists cfe_status text not null default 'UNKNOWN';

alter table public.organization_profile_versions
  add column if not exists vat_regime text not null default 'UNKNOWN',
  add column if not exists dgi_group text not null default 'UNKNOWN',
  add column if not exists cfe_status text not null default 'UNKNOWN';

alter table public.organization_rule_snapshots
  add column if not exists vat_regime text not null default 'UNKNOWN',
  add column if not exists dgi_group text not null default 'UNKNOWN',
  add column if not exists cfe_status text not null default 'UNKNOWN',
  add column if not exists snapshot_json jsonb not null default '{}'::jsonb;

update public.organizations
set
  vat_regime = coalesce(nullif(trim(vat_regime), ''), 'UNKNOWN'),
  dgi_group = coalesce(nullif(trim(dgi_group), ''), 'UNKNOWN'),
  cfe_status = coalesce(nullif(trim(cfe_status), ''), 'UNKNOWN');

update public.organization_profile_versions
set
  vat_regime = coalesce(nullif(trim(vat_regime), ''), 'UNKNOWN'),
  dgi_group = coalesce(nullif(trim(dgi_group), ''), 'UNKNOWN'),
  cfe_status = coalesce(nullif(trim(cfe_status), ''), 'UNKNOWN');

update public.organization_rule_snapshots
set
  vat_regime = coalesce(nullif(trim(vat_regime), ''), 'UNKNOWN'),
  dgi_group = coalesce(nullif(trim(dgi_group), ''), 'UNKNOWN'),
  cfe_status = coalesce(nullif(trim(cfe_status), ''), 'UNKNOWN'),
  snapshot_json = case
    when snapshot_json = '{}'::jsonb then jsonb_build_object(
      'organization_profile', jsonb_build_object(
        'country_code', country_code,
        'legal_entity_type', legal_entity_type,
        'tax_regime_code', tax_regime_code,
        'vat_regime', coalesce(nullif(trim(vat_regime), ''), 'UNKNOWN'),
        'dgi_group', coalesce(nullif(trim(dgi_group), ''), 'UNKNOWN'),
        'cfe_status', coalesce(nullif(trim(cfe_status), ''), 'UNKNOWN')
      ),
      'rule_refs', coalesce(deterministic_rule_refs_json, '[]'::jsonb)
    )
    else snapshot_json
  end;

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

alter table public.document_processing_runs
  add column if not exists provider_response_id text,
  add column if not exists provider_status text,
  add column if not exists transport_mode text,
  add column if not exists store_remote boolean not null default false,
  add column if not exists prompt_version text,
  add column if not exists schema_version text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_polled_at timestamptz;
