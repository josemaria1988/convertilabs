alter type public.document_status add value if not exists 'draft_ready';
alter type public.document_status add value if not exists 'classified_with_open_revision';

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'organization_profile_status'
  ) then
    create type public.organization_profile_status as enum ('draft', 'active', 'superseded');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'organization_rule_snapshot_status'
  ) then
    create type public.organization_rule_snapshot_status as enum ('draft', 'active', 'superseded');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'document_processing_run_status'
  ) then
    create type public.document_processing_run_status as enum ('queued', 'processing', 'completed', 'error', 'skipped');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'document_draft_status'
  ) then
    create type public.document_draft_status as enum ('open', 'ready_for_confirmation', 'confirmed', 'superseded');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'document_draft_step_status'
  ) then
    create type public.document_draft_step_status as enum (
      'not_started',
      'draft_saved',
      'confirmed',
      'stale_after_upstream_change',
      'blocked',
      'error'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'document_revision_status'
  ) then
    create type public.document_revision_status as enum ('open', 'pending_reconfirmation', 'reconfirmed', 'superseded');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'document_confirmation_type'
  ) then
    create type public.document_confirmation_type as enum ('final', 'reconfirmation');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'normative_update_run_status'
  ) then
    create type public.normative_update_run_status as enum ('queued', 'processing', 'completed', 'error');
  end if;
end
$$;

alter table public.organizations
  add column if not exists tax_regime_code text;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_legal_entity_type text default null,
  p_tax_id text default null,
  p_tax_regime_code text default null
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
    created_by
  )
  values (
    v_normalized_name,
    v_slug,
    trim(p_legal_entity_type),
    trim(p_tax_id),
    trim(p_tax_regime_code),
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

revoke all on function public.create_organization_with_owner(text, text, text, text) from public;
grant execute on function public.create_organization_with_owner(text, text, text, text) to authenticated;
grant execute on function public.create_organization_with_owner(text, text, text, text) to service_role;

create table if not exists public.organization_profile_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null,
  status public.organization_profile_status not null default 'draft',
  effective_from date not null,
  effective_to date,
  legal_entity_type text not null,
  tax_regime_code text not null,
  country_code text not null default 'UY',
  tax_id text not null,
  profile_summary text,
  profile_json jsonb not null default '{}'::jsonb,
  change_reason text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

create index if not exists idx_org_profile_versions_org_effective
  on public.organization_profile_versions (organization_id, effective_from desc);

create table if not exists public.organization_rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_version_id uuid references public.organization_profile_versions(id) on delete set null,
  version_number integer not null,
  status public.organization_rule_snapshot_status not null default 'draft',
  scope_code text not null default 'vat_document_intake',
  effective_from date not null,
  effective_to date,
  legal_entity_type text not null,
  tax_regime_code text not null,
  country_code text not null default 'UY',
  prompt_summary text not null,
  rules_json jsonb not null default '[]'::jsonb,
  deterministic_rule_refs_json jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

create index if not exists idx_org_rule_snapshots_org_effective
  on public.organization_rule_snapshots (organization_id, effective_from desc);

create table if not exists public.document_processing_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  run_number integer not null,
  status public.document_processing_run_status not null default 'queued',
  provider_code text not null default 'openai',
  model_code text,
  triggered_by text not null default 'manual',
  requested_by uuid references public.profiles(id),
  organization_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  openai_file_id text,
  failure_stage text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  provider_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, run_number)
);

create index if not exists idx_document_processing_runs_doc_created
  on public.document_processing_runs (document_id, created_at desc);

create table if not exists public.document_field_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid not null references public.document_processing_runs(id) on delete cascade,
  field_name text not null,
  field_value_json jsonb not null default '{}'::jsonb,
  normalized_value_json jsonb not null default '{}'::jsonb,
  source_page integer,
  source_bbox_json jsonb not null default '{}'::jsonb,
  extraction_method text,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create index if not exists idx_document_field_candidates_doc
  on public.document_field_candidates (document_id, field_name);

create table if not exists public.document_classification_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid not null references public.document_processing_runs(id) on delete cascade,
  candidate_type text not null,
  candidate_role public.document_direction,
  candidate_code text,
  explanation text,
  confidence numeric(5,4),
  rank_order integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_classification_candidates_doc
  on public.document_classification_candidates (document_id, candidate_type, rank_order);

create table if not exists public.document_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  processing_run_id uuid references public.document_processing_runs(id) on delete set null,
  organization_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  revision_number integer not null,
  status public.document_draft_status not null default 'open',
  document_role public.document_direction not null default 'other',
  document_type text,
  operation_context_json jsonb not null default '{}'::jsonb,
  fields_json jsonb not null default '{}'::jsonb,
  extracted_text text,
  warnings_json jsonb not null default '[]'::jsonb,
  journal_suggestion_json jsonb not null default '{}'::jsonb,
  tax_treatment_json jsonb not null default '{}'::jsonb,
  source_confidence numeric(5,4),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (document_id, revision_number)
);

create index if not exists idx_document_drafts_doc_updated
  on public.document_drafts (document_id, updated_at desc);

create table if not exists public.document_draft_steps (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  step_code text not null,
  status public.document_draft_step_status not null default 'not_started',
  last_saved_at timestamptz,
  last_confirmed_at timestamptz,
  stale_reason text,
  snapshot_json jsonb not null default '{}'::jsonb,
  unique (draft_id, step_code)
);

create table if not exists public.document_draft_autosaves (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  step_code text not null,
  payload_patch_json jsonb not null default '{}'::jsonb,
  saved_by uuid references public.profiles(id),
  saved_at timestamptz not null default now()
);

create index if not exists idx_document_draft_autosaves_draft_saved
  on public.document_draft_autosaves (draft_id, saved_at desc);

create table if not exists public.document_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  confirmation_type public.document_confirmation_type not null,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz not null default now(),
  snapshot_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_document_confirmations_doc
  on public.document_confirmations (document_id, confirmed_at desc);

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  revision_number integer not null,
  base_confirmed_draft_id uuid references public.document_drafts(id) on delete set null,
  working_draft_id uuid references public.document_drafts(id) on delete set null,
  status public.document_revision_status not null default 'open',
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  reconfirmed_by uuid references public.profiles(id),
  reconfirmed_at timestamptz,
  unique (document_id, revision_number)
);

create table if not exists public.normative_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_type text not null,
  base_url text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.normative_items (
  id uuid primary key default gen_random_uuid(),
  normative_document_id uuid not null references public.normative_documents(id) on delete cascade,
  item_code text,
  topic_codes_json jsonb not null default '[]'::jsonb,
  text text not null,
  summary text,
  legal_entity_type text,
  tax_regime_code text,
  tax_type public.tax_type,
  effective_from date,
  effective_to date,
  supersedes_item_id uuid references public.normative_items(id) on delete set null,
  embedding_status text not null default 'not_started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_normative_items_document
  on public.normative_items (normative_document_id);

create table if not exists public.normative_update_runs (
  id uuid primary key default gen_random_uuid(),
  status public.normative_update_run_status not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  sources_checked_json jsonb not null default '[]'::jsonb,
  changes_detected_json jsonb not null default '[]'::jsonb,
  review_required boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists current_processing_run_id uuid references public.document_processing_runs(id) on delete set null,
  add column if not exists current_draft_id uuid references public.document_drafts(id) on delete set null,
  add column if not exists last_rule_snapshot_id uuid references public.organization_rule_snapshots(id) on delete set null,
  add column if not exists last_processed_at timestamptz;

create index if not exists idx_documents_current_processing_run
  on public.documents (current_processing_run_id);
