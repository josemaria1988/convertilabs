-- Generated from db/ canonical SQL. Do not edit manually.
-- Regenerate with: npm run db:generate:migration

-- >>> db/schema/00_extensions.sql
create extension if not exists pgcrypto;
-- <<< db/schema/00_extensions.sql

-- >>> db/schema/01_enums.sql
do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'member_role'
  ) then
    create type public.member_role as enum (
  'owner',
  'admin',
  'admin_processing',
  'accountant',
  'reviewer',
  'operator',
  'developer',
  'viewer'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_direction'
  ) then
    create type public.document_direction as enum ('purchase', 'sale', 'other', 'unknown');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_status'
  ) then
    create type public.document_status as enum (
  'uploaded',
  'queued',
  'extracting',
  'extracted',
  'draft_ready',
  'classified',
  'classified_with_open_revision',
  'needs_review',
  'approved',
  'rejected',
  'duplicate',
  'archived',
  'uploading',
  'error'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_posting_status'
  ) then
    create type public.document_posting_status as enum (
  'draft',
  'vat_ready',
  'posted_provisional',
  'posted_final',
  'locked'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'suggestion_status'
  ) then
    create type public.suggestion_status as enum (
  'drafted',
  'needs_review',
  'ready_for_review',
  'approved',
  'rejected',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_profile_status'
  ) then
    create type public.organization_profile_status as enum (
  'draft',
  'active',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_rule_snapshot_status'
  ) then
    create type public.organization_rule_snapshot_status as enum (
  'draft',
  'active',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_processing_run_status'
  ) then
    create type public.document_processing_run_status as enum (
  'queued',
  'processing',
  'completed',
  'error',
  'skipped'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_draft_status'
  ) then
    create type public.document_draft_status as enum (
  'open',
  'ready_for_confirmation',
  'confirmed',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_draft_step_status'
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
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_revision_status'
  ) then
    create type public.document_revision_status as enum (
  'open',
  'pending_reconfirmation',
  'reconfirmed',
  'superseded'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'document_confirmation_type'
  ) then
    create type public.document_confirmation_type as enum (
  'final',
  'reconfirmation'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'normative_update_run_status'
  ) then
    create type public.normative_update_run_status as enum (
  'queued',
  'processing',
  'completed',
  'error'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'entry_status'
  ) then
    create type public.entry_status as enum (
  'draft',
  'reviewed',
  'posted',
  'exported',
  'void'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'journal_posting_mode'
  ) then
    create type public.journal_posting_mode as enum (
  'provisional',
  'final'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'tax_type'
  ) then
    create type public.tax_type as enum ('VAT', 'IRAE', 'IP');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'tax_period_status'
  ) then
    create type public.tax_period_status as enum (
  'open',
  'review',
  'closed',
  'locked'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'fiscal_period_status'
  ) then
    create type public.fiscal_period_status as enum (
  'open',
  'review',
  'closed',
  'locked',
  'ready_to_close',
  'soft_closed',
  'tax_locked',
  'hard_closed',
  'audit_frozen'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'export_status'
  ) then
    create type public.export_status as enum (
  'queued',
  'generating',
  'generated',
  'downloaded',
  'failed',
  'expired'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rule_scope'
  ) then
    create type public.rule_scope as enum ('global', 'package', 'organization');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'accounting_rule_status'
  ) then
    create type public.accounting_rule_status as enum (
  'candidate',
  'provisional',
  'approved'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'accounting_rule_lifecycle_status'
  ) then
    create type public.accounting_rule_lifecycle_status as enum (
  'draft',
  'active',
  'paused',
  'superseded',
  'deleted_if_unused'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'account_type'
  ) then
    create type public.account_type as enum (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
  'memo'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'normal_side'
  ) then
    create type public.normal_side as enum ('debit', 'credit');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'dgi_reconciliation_source_kind'
  ) then
    create type public.dgi_reconciliation_source_kind as enum (
  'manual_summary',
  'imported_file',
  'future_connector'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'dgi_reconciliation_run_status'
  ) then
    create type public.dgi_reconciliation_run_status as enum (
  'draft',
  'computed',
  'reviewed',
  'closed'
);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type as t
    join pg_namespace as n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'dgi_reconciliation_difference_status'
  ) then
    create type public.dgi_reconciliation_difference_status as enum (
  'matched',
  'missing_in_system',
  'extra_in_system',
  'amount_mismatch',
  'tax_treatment_mismatch',
  'pending_manual_adjustment'
);
  end if;
end
$$;
-- <<< db/schema/01_enums.sql

-- >>> db/schema/02_identity_and_tenants.sql
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
  tax_id_normalized text,
  tax_regime_code text,
  vat_regime text not null default 'UNKNOWN',
  dgi_group text not null default 'UNKNOWN',
  cfe_status text not null default 'UNKNOWN',
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

create unique index if not exists idx_organizations_tax_id_normalized
  on public.organizations (tax_id_normalized)
  where tax_id_normalized is not null;

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
-- <<< db/schema/02_identity_and_tenants.sql

-- >>> db/schema/03_master_data.sql
create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type public.account_type not null,
  normal_side public.normal_side not null,
  is_postable boolean not null default true,
  is_provisional boolean not null default false,
  source text not null default 'manual',
  external_code text,
  statement_section text,
  nature_tag text,
  function_tag text,
  cashflow_tag text,
  tax_profile_hint text,
  currency_policy text not null default 'mono_currency',
  parent_id uuid references public.chart_of_accounts(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.chart_of_accounts
  add column if not exists chapter_code text,
  add column if not exists presentation_code text,
  add column if not exists group_id uuid,
  add column if not exists currency_code text,
  add column if not exists natural_balance public.normal_side,
  add column if not exists requires_party boolean not null default false,
  add column if not exists reconciliable boolean not null default false,
  add column if not exists tax_account_kind text,
  add column if not exists include_fx_revaluation boolean not null default false,
  add column if not exists cost_center_policy text not null default 'optional',
  add column if not exists sort_order integer,
  add column if not exists provider_managed boolean not null default false,
  add column if not exists source_provider text,
  add column if not exists external_parent_code text,
  add column if not exists account_level integer,
  add column if not exists is_imputable boolean,
  add column if not exists uses_cost_centers boolean,
  add column if not exists literal_tributario integer,
  add column if not exists source_channel text not null default 'document_workflow',
  add column if not exists provider_meta_json jsonb not null default '{}'::jsonb,
  add column if not exists jurisdiction_meta_json jsonb not null default '{}'::jsonb,
  add column if not exists last_synced_from_provider_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chart_of_accounts_org_provider_external_code_key'
      and conrelid = 'public.chart_of_accounts'::regclass
  ) then
    alter table public.chart_of_accounts
      add constraint chart_of_accounts_org_provider_external_code_key
      unique (organization_id, source_provider, external_code);
  end if;
end
$$;

create table if not exists public.uy_locations (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  city text not null,
  postal_code text,
  lat numeric(10,6) not null,
  long numeric(10,6) not null,
  source text not null default 'seed_v1',
  source_version text not null default '2026-03-step5-location-v1',
  created_at timestamptz not null default now(),
  unique (department, city)
);

update public.chart_of_accounts
set natural_balance = coalesce(natural_balance, normal_side)
where natural_balance is null;

create table if not exists public.account_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_account_groups_org_code
  on public.account_groups (organization_id, code);

create index if not exists idx_chart_of_accounts_org_provider_imputable
  on public.chart_of_accounts (
    organization_id,
    source_provider,
    is_imputable,
    external_code
  )
  where source_provider is not null;

alter table public.chart_of_accounts
  drop constraint if exists chart_of_accounts_group_id_fkey;

alter table public.chart_of_accounts
  add constraint chart_of_accounts_group_id_fkey
    foreign key (group_id)
    references public.account_groups(id)
    on delete set null;

insert into public.uy_locations (department, city, postal_code, lat, long, source, source_version)
values
  ('montevideo', 'montevideo', '11000', -34.901100, -56.164500, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'canelones', '90000', -34.522800, -56.277800, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'las piedras', '90200', -34.730200, -56.219200, 'seed_v1', '2026-03-step5-location-v1'),
  ('canelones', 'ciudad de la costa', '15000', -34.816700, -55.950000, 'seed_v1', '2026-03-step5-location-v1'),
  ('maldonado', 'maldonado', '20000', -34.900000, -54.950000, 'seed_v1', '2026-03-step5-location-v1'),
  ('maldonado', 'punta del este', '20100', -34.962700, -54.945100, 'seed_v1', '2026-03-step5-location-v1'),
  ('colonia', 'colonia del sacramento', '70000', -34.471100, -57.844200, 'seed_v1', '2026-03-step5-location-v1'),
  ('salto', 'salto', '50000', -31.383300, -57.966700, 'seed_v1', '2026-03-step5-location-v1'),
  ('paysandu', 'paysandu', '60000', -32.321400, -58.075600, 'seed_v1', '2026-03-step5-location-v1'),
  ('rivera', 'rivera', '40000', -30.905300, -55.550800, 'seed_v1', '2026-03-step5-location-v1'),
  ('rocha', 'rocha', '27000', -34.483300, -54.333300, 'seed_v1', '2026-03-step5-location-v1'),
  ('lavalleja', 'minas', '30000', -34.375900, -55.237700, 'seed_v1', '2026-03-step5-location-v1'),
  ('soriano', 'mercedes', '75000', -33.252400, -58.030500, 'seed_v1', '2026-03-step5-location-v1'),
  ('san jose', 'san jose de mayo', '80000', -34.337500, -56.713600, 'seed_v1', '2026-03-step5-location-v1'),
  ('florida', 'florida', '94000', -34.095600, -56.214200, 'seed_v1', '2026-03-step5-location-v1'),
  ('flores', 'trinidad', '85000', -33.516500, -56.899600, 'seed_v1', '2026-03-step5-location-v1'),
  ('tacuarembo', 'tacuarembo', '45000', -31.716900, -55.981100, 'seed_v1', '2026-03-step5-location-v1'),
  ('durazno', 'durazno', '97000', -33.380600, -56.523600, 'seed_v1', '2026-03-step5-location-v1'),
  ('treinta y tres', 'treinta y tres', '33000', -33.233300, -54.383300, 'seed_v1', '2026-03-step5-location-v1'),
  ('rio negro', 'fray bentos', '65000', -33.116500, -58.310700, 'seed_v1', '2026-03-step5-location-v1'),
  ('cerro largo', 'melo', '37000', -32.370300, -54.167500, 'seed_v1', '2026-03-step5-location-v1'),
  ('artigas', 'artigas', '55000', -30.400000, -56.466700, 'seed_v1', '2026-03-step5-location-v1')
on conflict (department, city) do nothing;

create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text,
  decimals smallint not null default 2,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.currencies (code, name, symbol, decimals)
values
  ('UYU', 'Peso Uruguayo', '$', 2),
  ('USD', 'US Dollar', 'US$', 2),
  ('EUR', 'Euro', 'EUR', 2)
on conflict (code) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  decimals = excluded.decimals,
  updated_at = now();

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  base_currency_code text not null references public.currencies(code),
  quote_currency_code text not null references public.currencies(code),
  rate_type text not null default 'spot',
  rate numeric(18,6) not null,
  effective_date date not null,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, base_currency_code, quote_currency_code, rate_type, effective_date)
);

create index if not exists idx_exchange_rates_org_date
  on public.exchange_rates (organization_id, effective_date desc);

create table if not exists public.auxiliary_books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_auxiliary_books_org_code
  on public.auxiliary_books (organization_id, code);

create table if not exists public.journal_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_journal_types_org_code
  on public.journal_types (organization_id, code);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  party_kind text not null default 'external',
  legal_name text not null,
  display_name text,
  tax_id text,
  tax_id_normalized text,
  legacy_vendor_id uuid references public.vendors(id) on delete set null,
  legacy_customer_id uuid references public.customers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_parties_org_tax_id_normalized
  on public.parties (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_parties_org_display_name
  on public.parties (organization_id, display_name);

create table if not exists public.accounting_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  functional_currency_code text not null default 'UYU' references public.currencies(code),
  chapter_codes_json jsonb not null default '[]'::jsonb,
  modifications_locked_before date,
  uses_foreign_currency boolean not null default false,
  uses_cost_centers boolean not null default false,
  uses_references boolean not null default false,
  uses_tax_literals boolean not null default false,
  shared_exchange_rate_source_organization_id uuid references public.organizations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  archived_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_org_cost_centers_org_name_active
  on public.organization_cost_centers (organization_id, lower(name))
  where is_active = true;

create index if not exists idx_org_cost_centers_org_active_created
  on public.organization_cost_centers (organization_id, is_active, created_at desc);

create table if not exists public.account_role_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  binding_key text not null,
  role_code text not null,
  account_id uuid not null references public.chart_of_accounts(id) on delete cascade,
  document_role public.document_direction,
  currency_code text references public.currencies(code),
  settlement_method text,
  priority integer not null default 0,
  source text not null default 'manual',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, binding_key)
);

create index if not exists idx_account_role_bindings_org_role
  on public.account_role_bindings (organization_id, role_code, is_active, priority desc);

create index if not exists idx_account_role_bindings_org_account
  on public.account_role_bindings (organization_id, account_id);

insert into public.account_role_bindings (
  organization_id,
  binding_key,
  role_code,
  account_id,
  currency_code,
  priority,
  source,
  metadata
)
select
  coa.organization_id,
  coalesce(
    nullif(coa.metadata ->> 'semantic_key', ''),
    format('%s:%s', mapped.role_code, coa.code)
  ),
  mapped.role_code,
  coa.id,
  coa.currency_code,
  100,
  'system_role_backfill',
  jsonb_build_object(
    'backfilled_from_system_role',
    coa.metadata ->> 'system_role'
  )
from public.chart_of_accounts as coa
cross join lateral (
  values
    (case when coa.metadata ->> 'system_role' in ('revenue_account') then 'revenue_account' end),
    (case when coa.metadata ->> 'system_role' in ('expense_account') then 'expense_account' end),
    (case when coa.metadata ->> 'system_role' in ('inventory_account') then 'inventory_account' end),
    (case when coa.metadata ->> 'system_role' in ('fixed_asset_account') then 'fixed_asset_account' end),
    (case when coa.metadata ->> 'system_role' in ('output_vat_account', 'vat_output_payable') then 'output_vat_account' end),
    (case when coa.metadata ->> 'system_role' in ('input_vat_account', 'vat_input_creditable') then 'input_vat_account' end),
    (case when coa.metadata ->> 'system_role' in ('accounts_receivable_account', 'accounts_receivable') then 'accounts_receivable_account' end),
    (case when coa.metadata ->> 'system_role' in ('accounts_payable_account', 'accounts_payable') then 'accounts_payable_account' end),
    (case when coa.metadata ->> 'system_role' in ('cash_account') then 'cash_account' end),
    (case when coa.metadata ->> 'system_role' in ('bank_account') then 'bank_account' end),
    (case when coa.metadata ->> 'system_role' in ('card_clearing_account') then 'card_clearing_account' end),
    (case when coa.metadata ->> 'system_role' in ('check_clearing_account') then 'check_clearing_account' end),
    (case when coa.metadata ->> 'system_role' in ('cash_sales_unidentified_account') then 'cash_sales_unidentified_account' end),
    (case when coa.metadata ->> 'system_role' in ('cash_purchases_unidentified_account') then 'cash_purchases_unidentified_account' end),
    (case when coa.metadata ->> 'system_role' in ('bank_fees_account') then 'bank_fees_account' end),
    (case when coa.metadata ->> 'system_role' in ('fx_difference_account') then 'fx_difference_account' end)
) as mapped(role_code)
where mapped.role_code is not null
on conflict (organization_id, binding_key) do update
set
  role_code = excluded.role_code,
  account_id = excluded.account_id,
  currency_code = excluded.currency_code,
  priority = excluded.priority,
  metadata = public.account_role_bindings.metadata || excluded.metadata,
  updated_at = now();

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  tax_id_normalized text,
  name_normalized text,
  default_account_id uuid references public.chart_of_accounts(id),
  default_payment_account_id uuid references public.chart_of_accounts(id),
  default_tax_profile jsonb not null default '{}'::jsonb,
  default_operation_category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors
  add column if not exists fiscal_address_text text,
  add column if not exists fiscal_department text,
  add column if not exists fiscal_city text,
  add column if not exists fiscal_lat numeric(10,6),
  add column if not exists fiscal_long numeric(10,6),
  add column if not exists issuer_branch_code text,
  add column if not exists merchant_category_hint text,
  add column if not exists location_confidence numeric(10,6);

create unique index if not exists idx_vendors_org_tax_id_normalized
  on public.vendors (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_chart_of_accounts_org_external_code
  on public.chart_of_accounts (organization_id, external_code)
  where external_code is not null;

create index if not exists idx_chart_of_accounts_org_group
  on public.chart_of_accounts (organization_id, group_id)
  where group_id is not null;

create index if not exists idx_chart_of_accounts_org_source_channel
  on public.chart_of_accounts (organization_id, source_channel);

create index if not exists idx_vendors_org_name_normalized
  on public.vendors (organization_id, name_normalized);

create table if not exists public.vendor_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  alias_display text,
  alias_normalized text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vendor_id, alias_normalized)
);

create index if not exists idx_vendor_aliases_org_alias
  on public.vendor_aliases (organization_id, alias_normalized);

create table if not exists public.organization_concepts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  canonical_name text not null,
  description text,
  document_role public.document_direction not null default 'purchase',
  default_account_id uuid references public.chart_of_accounts(id),
  default_vat_profile_json jsonb not null default '{}'::jsonb,
  default_operation_category text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_organization_concepts_org_role_active
  on public.organization_concepts (organization_id, document_role, is_active);

create table if not exists public.organization_concept_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  concept_id uuid not null references public.organization_concepts(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  alias_code_normalized text,
  alias_description_normalized text not null,
  match_scope text not null default 'organization',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_concept_aliases_org_vendor_code
  on public.organization_concept_aliases (
    organization_id,
    vendor_id,
    alias_code_normalized
  );

create index if not exists idx_org_concept_aliases_org_vendor_description
  on public.organization_concept_aliases (
    organization_id,
    vendor_id,
    alias_description_normalized
  );

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  tax_id_normalized text,
  name_normalized text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customers_org_tax_id_normalized
  on public.customers (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

create index if not exists idx_customers_org_name_normalized
  on public.customers (organization_id, name_normalized);
-- <<< db/schema/03_master_data.sql

-- >>> db/schema/04_documents.sql
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cost_center_id uuid references public.organization_cost_centers(id) on delete set null,
  direction public.document_direction not null default 'unknown',
  document_type text,
  status public.document_status not null default 'uploaded',
  posting_status public.document_posting_status not null default 'draft',
  storage_bucket text not null default 'documents-private',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  file_hash text,
  upload_source text not null default 'web',
  source_type text not null default 'manual_upload',
  source_message_id text,
  source_attachment_hash text,
  source_reference text,
  vat_ready_at timestamptz,
  posted_provisional_at timestamptz,
  posted_final_at timestamptz,
  uploaded_by uuid references public.profiles(id),
  document_date date,
  document_currency_code text,
  document_net_amount_original numeric(18,2),
  document_tax_amount_original numeric(18,2),
  document_total_amount_original numeric(18,2),
  net_amount_uyu numeric(18,2),
  tax_amount_uyu numeric(18,2),
  total_amount_uyu numeric(18,2),
  fx_rate_policy_code text,
  fx_rate_bcu_value numeric(18,6),
  fx_rate_bcu_date_used date,
  fx_rate_bcu_series text,
  fx_rate_document_value numeric(18,6),
  fx_rate_document_date date,
  fx_rate_source text,
  fx_rate_override_reason text,
  vat_credit_category text,
  vat_deductibility_status text,
  vat_direct_tax_amount_uyu numeric(18,2),
  vat_indirect_tax_amount_uyu numeric(18,2),
  vat_deductible_tax_amount_uyu numeric(18,2),
  vat_nondeductible_tax_amount_uyu numeric(18,2),
  vat_proration_coefficient numeric(10,6),
  business_link_status text,
  dgi_reconciliation_status text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists cost_center_id uuid references public.organization_cost_centers(id) on delete set null;

alter table public.documents
  add column if not exists issuer_address_raw text,
  add column if not exists issuer_department text,
  add column if not exists issuer_city text,
  add column if not exists issuer_branch_code text,
  add column if not exists location_extraction_confidence numeric(10,6),
  add column if not exists location_signal_code text,
  add column if not exists location_signal_severity text,
  add column if not exists location_signal_payload jsonb not null default '{}'::jsonb,
  add column if not exists requires_business_purpose_review boolean not null default false,
  add column if not exists business_purpose_note text,
  add column if not exists suggested_expense_family text,
  add column if not exists suggested_tax_profile_code text;

create index if not exists idx_documents_org_status
  on public.documents (organization_id, status);

create index if not exists idx_documents_org_posting_status
  on public.documents (organization_id, posting_status, created_at desc);

create index if not exists idx_documents_file_hash
  on public.documents (organization_id, file_hash);

create index if not exists idx_documents_uploaded_by
  on public.documents (uploaded_by);

create index if not exists idx_documents_status
  on public.documents (status);

create index if not exists idx_documents_org_created_at
  on public.documents (organization_id, created_at desc);

create index if not exists idx_documents_org_cost_center_created_at
  on public.documents (organization_id, cost_center_id, created_at desc)
  where cost_center_id is not null;

create index if not exists idx_documents_org_location_signal
  on public.documents (organization_id, location_signal_severity, location_signal_code, created_at desc);

create index if not exists idx_documents_org_source_type
  on public.documents (organization_id, source_type, created_at desc);

create index if not exists idx_documents_org_source_message
  on public.documents (organization_id, source_message_id)
  where source_message_id is not null;

create index if not exists idx_documents_org_source_attachment
  on public.documents (organization_id, source_attachment_hash)
  where source_attachment_hash is not null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'documents-private',
  'documents-private',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'document-spreadsheets-private',
  'document-spreadsheets-private',
  false,
  20971520,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/tab-separated-values',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_no integer not null,
  provider text,
  raw_text text,
  extracted_json jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create index if not exists idx_document_extractions_active
  on public.document_extractions (document_id, is_active);

create table if not exists public.document_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid references public.documents(id) on delete cascade,
  relation_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.sanitize_document_filename(p_original_filename text)
returns text
language sql
immutable
set search_path = public
as $$
  with normalized as (
    select lower(
      regexp_replace(
        regexp_replace(
          translate(
            coalesce(nullif(regexp_replace(p_original_filename, '^.*[\\/]', ''), ''), 'document'),
            U&'\00E1\00E0\00E4\00E2\00E3\00E5\00E9\00E8\00EB\00EA\00ED\00EC\00EF\00EE\00F3\00F2\00F6\00F4\00F5\00FA\00F9\00FC\00FB\00F1\00E7',
            'aaaaaaeeeeiiiiooooouuuunc'
          ),
          '[^a-zA-Z0-9._-]+',
          '-',
          'g'
        ),
        '-{2,}',
        '-',
        'g'
      )
    ) as value
  )
  select coalesce(
    nullif(trim(both '-._' from value), ''),
    'document'
  )
  from normalized;
$$;

create or replace function public.build_document_storage_path(
  p_org_id uuid,
  p_document_id uuid,
  p_original_filename text
)
returns text
language sql
immutable
set search_path = public
as $$
  select format(
    'orgs/%s/%s/%s',
    p_org_id,
    p_document_id,
    public.sanitize_document_filename(p_original_filename)
  );
$$;

create or replace function public.document_storage_org_id(p_object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when array_length(storage.foldername(p_object_name), 1) >= 3
      and (storage.foldername(p_object_name))[1] = 'orgs'
      and (storage.foldername(p_object_name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p_object_name))[2])::uuid
    else null
  end;
$$;

create or replace function public.can_access_document_storage_object(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents as d
    where d.storage_bucket = p_bucket_id
      and d.storage_path = p_object_name
      and d.organization_id = public.document_storage_org_id(p_object_name)
      and public.is_org_member(d.organization_id)
  );
$$;

create or replace function public.can_upload_document_storage_object(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents as d
    where d.storage_bucket = p_bucket_id
      and d.storage_path = p_object_name
      and d.organization_id = public.document_storage_org_id(p_object_name)
      and d.uploaded_by = auth.uid()
      and public.is_org_member(d.organization_id)
      and d.status = 'uploading'::public.document_status
  );
$$;

create or replace function public.prepare_document_upload(
  p_org_id uuid,
  p_original_filename text,
  p_mime_type text,
  p_file_size bigint,
  p_direction public.document_direction default 'unknown'
)
returns table (
  document_id uuid,
  storage_bucket text,
  storage_path text,
  status public.document_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_original_filename text := coalesce(nullif(trim(regexp_replace(p_original_filename, '^.*[\\/]', '')), ''), 'document');
  v_document_id uuid := gen_random_uuid();
  v_storage_path text;
begin
  if auth.role() <> 'authenticated' or v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not public.is_org_member(p_org_id) then
    raise exception 'Not allowed to upload documents for this organization.'
      using errcode = '42501';
  end if;

  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Unsupported document MIME type.'
      using errcode = '22023';
  end if;

  if p_file_size is null or p_file_size <= 0 then
    raise exception 'Document file size must be greater than zero.'
      using errcode = '22023';
  end if;

  if p_file_size > 20971520 then
    raise exception 'Document file size exceeds the 20 MB limit.'
      using errcode = '22023';
  end if;

  v_storage_path := public.build_document_storage_path(
    p_org_id,
    v_document_id,
    v_original_filename
  );

  insert into public.documents (
    id,
    organization_id,
    direction,
    status,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    uploaded_by
  )
  values (
    v_document_id,
    p_org_id,
    coalesce(p_direction, 'unknown'::public.document_direction),
    'uploading'::public.document_status,
    'documents-private',
    v_storage_path,
    v_original_filename,
    p_mime_type,
    p_file_size,
    v_user_id
  );

  document_id := v_document_id;
  storage_bucket := 'documents-private';
  storage_path := v_storage_path;
  status := 'uploading'::public.document_status;

  return next;
end;
$$;

create or replace function public.complete_document_upload(
  p_document_id uuid
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  update public.documents as d
  set
    status = 'uploaded'::public.document_status,
    updated_at = now(),
    metadata = d.metadata - 'upload_error'
  where d.id = p_document_id
    and d.uploaded_by = auth.uid()
    and public.is_org_member(d.organization_id)
  returning d.* into v_document;

  if v_document.id is null then
    raise exception 'Document upload could not be finalized.'
      using errcode = '42501';
  end if;

  return v_document;
end;
$$;

create or replace function public.fail_document_upload(
  p_document_id uuid,
  p_error_message text default null
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  update public.documents as d
  set
    status = 'error'::public.document_status,
    updated_at = now(),
    metadata = d.metadata || jsonb_build_object(
      'upload_error',
      coalesce(nullif(trim(p_error_message), ''), 'Upload failed')
    )
  where d.id = p_document_id
    and d.uploaded_by = auth.uid()
    and public.is_org_member(d.organization_id)
  returning d.* into v_document;

  if v_document.id is null then
    raise exception 'Document upload could not be marked as failed.'
      using errcode = '42501';
  end if;

  return v_document;
end;
$$;

create or replace function public.list_dashboard_documents(
  p_org_id uuid,
  p_limit integer default 12
)
returns table (
  id uuid,
  original_filename text,
  status public.document_status,
  created_at timestamptz,
  uploaded_by_display text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
begin
  if auth.role() <> 'authenticated' or auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not public.is_org_member(p_org_id) then
    raise exception 'Not allowed to access this organization.'
      using errcode = '42501';
  end if;

  return query
  select
    d.id,
    d.original_filename,
    d.status,
    d.created_at,
    coalesce(
      nullif(p.full_name, ''),
      nullif(p.email, ''),
      'Usuario sin perfil'
    ) as uploaded_by_display
  from public.documents as d
  left join public.profiles as p
    on p.id = d.uploaded_by
  where d.organization_id = p_org_id
  order by d.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.prepare_document_upload(uuid, text, text, bigint, public.document_direction) from public;
grant execute on function public.prepare_document_upload(uuid, text, text, bigint, public.document_direction) to authenticated;
grant execute on function public.prepare_document_upload(uuid, text, text, bigint, public.document_direction) to service_role;

revoke all on function public.complete_document_upload(uuid) from public;
grant execute on function public.complete_document_upload(uuid) to authenticated;
grant execute on function public.complete_document_upload(uuid) to service_role;

revoke all on function public.fail_document_upload(uuid, text) from public;
grant execute on function public.fail_document_upload(uuid, text) to authenticated;
grant execute on function public.fail_document_upload(uuid, text) to service_role;

revoke all on function public.list_dashboard_documents(uuid, integer) from public;
grant execute on function public.list_dashboard_documents(uuid, integer) to authenticated;
grant execute on function public.list_dashboard_documents(uuid, integer) to service_role;
-- <<< db/schema/04_documents.sql

-- >>> db/schema/05_accounting.sql
create table if not exists public.accounting_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stable_family_code text not null default ('rule_family_' || gen_random_uuid()::text),
  version_number integer not null default 1,
  name text,
  description text,
  scope text not null,
  document_id uuid references public.documents(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  concept_id uuid references public.organization_concepts(id) on delete cascade,
  document_role public.document_direction not null default 'purchase',
  account_id uuid not null references public.chart_of_accounts(id),
  vat_profile_json jsonb not null default '{}'::jsonb,
  tax_profile_code text,
  operation_category text,
  linked_operation_type text,
  template_code text,
  status public.accounting_rule_status not null default 'approved',
  lifecycle_status public.accounting_rule_lifecycle_status not null default 'active',
  times_reused integer not null default 0,
  times_corrected integer not null default 0,
  times_matched integer not null default 0,
  times_applied integer not null default 0,
  priority integer not null default 0,
  source text not null default 'manual',
  created_from text,
  explainability_json jsonb not null default '{}'::jsonb,
  supersedes_rule_id uuid references public.accounting_rules(id) on delete set null,
  superseded_by_rule_id uuid references public.accounting_rules(id) on delete set null,
  pause_reason text,
  supersession_reason text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  is_active boolean not null default true,
  activated_at timestamptz,
  paused_at timestamptz,
  retired_at timestamptz,
  last_matched_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_rules
  add column if not exists stable_family_code text,
  add column if not exists version_number integer not null default 1,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists lifecycle_status public.accounting_rule_lifecycle_status not null default 'active',
  add column if not exists times_matched integer not null default 0,
  add column if not exists times_applied integer not null default 0,
  add column if not exists created_from text,
  add column if not exists explainability_json jsonb not null default '{}'::jsonb,
  add column if not exists supersedes_rule_id uuid references public.accounting_rules(id) on delete set null,
  add column if not exists superseded_by_rule_id uuid references public.accounting_rules(id) on delete set null,
  add column if not exists pause_reason text,
  add column if not exists supersession_reason text,
  add column if not exists activated_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists last_matched_at timestamptz;

alter table public.accounting_rules
  alter column stable_family_code set default ('rule_family_' || gen_random_uuid()::text);

update public.accounting_rules
set
  stable_family_code = coalesce(stable_family_code, 'rule_family_' || id::text),
  version_number = coalesce(version_number, 1),
  created_from = coalesce(nullif(created_from, ''), nullif(source, ''), 'manual'),
  lifecycle_status = case
    when coalesce(is_active, true) = true then 'active'::public.accounting_rule_lifecycle_status
    when status = 'candidate'::public.accounting_rule_status then 'draft'::public.accounting_rule_lifecycle_status
    else 'paused'::public.accounting_rule_lifecycle_status
  end,
  times_applied = greatest(coalesce(times_applied, 0), coalesce(times_reused, 0)),
  times_matched = greatest(coalesce(times_matched, 0), coalesce(times_reused, 0)),
  activated_at = case
    when coalesce(is_active, true) = true then coalesce(activated_at, created_at, now())
    else activated_at
  end,
  paused_at = case
    when coalesce(is_active, true) = false
      and status <> 'candidate'::public.accounting_rule_status then coalesce(paused_at, updated_at, created_at, now())
    else paused_at
  end
where true;

alter table public.accounting_rules
  alter column stable_family_code set not null;

create index if not exists idx_accounting_rules_org_scope_active
  on public.accounting_rules (organization_id, scope, is_active, priority desc);

create index if not exists idx_accounting_rules_org_status_scope
  on public.accounting_rules (organization_id, status, scope, is_active, priority desc);

create index if not exists idx_accounting_rules_org_lifecycle_scope
  on public.accounting_rules (organization_id, lifecycle_status, scope, priority desc);

create index if not exists idx_accounting_rules_org_vendor_concept
  on public.accounting_rules (organization_id, vendor_id, concept_id, document_role);

create index if not exists idx_accounting_rules_family_version
  on public.accounting_rules (organization_id, stable_family_code, version_number desc);

create table if not exists public.accounting_rule_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.accounting_rules(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_rule_events_org_rule_created
  on public.accounting_rule_events (organization_id, rule_id, created_at desc);

insert into public.accounting_rule_events (
  organization_id,
  rule_id,
  event_type,
  reason,
  payload_json,
  created_at
)
select
  rule.organization_id,
  rule.id,
  'migrated',
  'Backfill inicial de administracion de reglas',
  jsonb_build_object(
    'scope',
    rule.scope,
    'priority',
    rule.priority,
    'source',
    rule.source,
    'created_from',
    rule.created_from,
    'lifecycle_status',
    rule.lifecycle_status
  ),
  coalesce(rule.created_at, now())
from public.accounting_rules as rule
where not exists (
  select 1
  from public.accounting_rule_events as event
  where event.rule_id = rule.id
    and event.event_type = 'migrated'
);

create table if not exists public.accounting_rule_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  base_rule_id uuid references public.accounting_rules(id) on delete set null,
  candidate_rule_id uuid references public.accounting_rules(id) on delete set null,
  simulation_type text not null,
  sample_size integer not null default 0,
  affected_documents_count integer not null default 0,
  affected_recent_documents_count integer not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_rule_simulations_org_rule_created
  on public.accounting_rule_simulations (organization_id, base_rule_id, created_at desc);

create table if not exists public.accounting_rule_ai_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  context_scope text not null default 'global',
  context_rule_id uuid references public.accounting_rules(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_accounting_rule_ai_threads_org_created
  on public.accounting_rule_ai_threads (organization_id, archived_at, created_at desc);

create table if not exists public.accounting_rule_ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.accounting_rule_ai_threads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null,
  message_text text not null,
  structured_payload_json jsonb not null default '{}'::jsonb,
  referenced_rule_ids uuid[] not null default '{}'::uuid[],
  referenced_document_ids uuid[] not null default '{}'::uuid[],
  provider text,
  model text,
  tokens_input integer,
  tokens_output integer,
  estimated_cost numeric(18,8),
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_rule_ai_messages_thread_created
  on public.accounting_rule_ai_messages (thread_id, created_at desc);

create table if not exists public.accounting_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid references public.document_extractions(id) on delete set null,
  version_no integer not null,
  status public.suggestion_status not null default 'drafted',
  confidence numeric(5,4),
  explanation text,
  tax_treatment_json jsonb not null default '{}'::jsonb,
  rule_trace_json jsonb not null default '[]'::jsonb,
  generated_by text not null default 'system',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create index if not exists idx_accounting_suggestions_org_doc
  on public.accounting_suggestions (organization_id, document_id);

create table if not exists public.accounting_suggestion_lines (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.accounting_suggestions(id) on delete cascade,
  line_no integer not null,
  side public.normal_side not null,
  account_id uuid not null references public.chart_of_accounts(id),
  amount numeric(18,2) not null,
  tax_tag text,
  memo text,
  metadata jsonb not null default '{}'::jsonb,
  unique (suggestion_id, line_no)
);

create table if not exists public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  status public.fiscal_period_status not null default 'open',
  is_current boolean not null default false,
  closed_at timestamptz,
  locked_at timestamptz,
  reopened_at timestamptz,
  status_changed_at timestamptz,
  status_changed_by uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, starts_on, ends_on)
);

create index if not exists idx_fiscal_periods_org_dates
  on public.fiscal_periods (organization_id, starts_on, ends_on);

create index if not exists idx_fiscal_periods_org_status
  on public.fiscal_periods (organization_id, status, starts_on desc);

create table if not exists public.close_check_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  run_kind text not null default 'manual',
  status text not null default 'warning',
  triggered_by_profile_id uuid references public.profiles(id),
  input_hash text,
  summary_json jsonb not null default '{}'::jsonb,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_close_check_runs_org_period_created
  on public.close_check_runs (organization_id, fiscal_period_id, created_at desc);

create table if not exists public.close_check_results (
  id uuid primary key default gen_random_uuid(),
  close_check_run_id uuid not null references public.close_check_runs(id) on delete cascade,
  check_code text not null,
  family text not null,
  severity text not null,
  status text not null,
  message text not null,
  metric_value numeric(18,2),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (close_check_run_id, check_code)
);

create index if not exists idx_close_check_results_run_status
  on public.close_check_results (close_check_run_id, status);

create table if not exists public.fiscal_period_transition_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  from_status public.fiscal_period_status,
  to_status public.fiscal_period_status not null,
  changed_by_profile_id uuid references public.profiles(id),
  reason_code text,
  reason_comment text,
  validator_run_id uuid references public.close_check_runs(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fiscal_period_transition_logs_org_period_created
  on public.fiscal_period_transition_logs (organization_id, fiscal_period_id, created_at desc);

create table if not exists public.organization_accounting_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null,
  status text not null default 'active',
  fingerprint text not null,
  effective_from timestamptz not null default now(),
  source_rule_snapshot_id uuid,
  snapshot_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, version_number),
  unique (organization_id, fingerprint)
);

create index if not exists idx_org_accounting_snapshots_org_effective
  on public.organization_accounting_snapshots (organization_id, effective_from desc);

create table if not exists public.source_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_channel text not null,
  source_entity_type text not null,
  source_entity_id uuid,
  source_external_id text,
  source_document_id uuid references public.documents(id) on delete set null,
  binary_hash text,
  payload_hash text,
  source_ref_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_source_events_org_entity
  on public.source_events (organization_id, source_channel, source_entity_type, source_entity_id);

create index if not exists idx_source_events_org_binary_hash
  on public.source_events (organization_id, binary_hash)
  where binary_hash is not null;

create table if not exists public.source_event_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid not null references public.source_events(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  draft_id uuid,
  version_no integer not null,
  facts_json jsonb not null default '{}'::jsonb,
  amount_breakdown_json jsonb not null default '[]'::jsonb,
  line_items_json jsonb not null default '[]'::jsonb,
  payload_hash text,
  source_binary_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (source_event_id, version_no)
);

alter table public.source_event_facts
  add column if not exists economic_hash text;

create index if not exists idx_source_event_facts_org_event
  on public.source_event_facts (organization_id, source_event_id, version_no desc);

update public.source_event_facts
set economic_hash = coalesce(economic_hash, payload_hash)
where economic_hash is null;

create table if not exists public.posting_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid not null references public.source_events(id) on delete cascade,
  source_event_facts_id uuid not null references public.source_event_facts(id) on delete cascade,
  source_event_facts_version_no integer not null,
  accounting_snapshot_id uuid references public.organization_accounting_snapshots(id) on delete set null,
  accounting_snapshot_fingerprint text,
  proposal_version_no integer not null,
  status text not null default 'draft',
  posting_mode public.journal_posting_mode not null default 'final',
  proposal_hash text not null,
  economic_hash text,
  confirmability_status text not null default 'confirmable',
  explanation text,
  journal_preview_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  invalidated_at timestamptz,
  invalidated_reason text,
  materialized_journal_entry_id uuid,
  created_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_event_id, proposal_version_no)
);

alter table public.posting_proposals
  add column if not exists accounting_snapshot_fingerprint text,
  add column if not exists economic_hash text,
  add column if not exists confirmability_status text not null default 'confirmable',
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidated_reason text,
  add column if not exists materialized_journal_entry_id uuid;

create index if not exists idx_posting_proposals_org_event
  on public.posting_proposals (organization_id, source_event_id, proposal_version_no desc);

create index if not exists idx_posting_proposals_org_confirmability
  on public.posting_proposals (organization_id, confirmability_status, created_at desc);

create table if not exists public.posting_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.posting_proposals(id) on delete cascade,
  line_no integer not null,
  account_id uuid references public.chart_of_accounts(id) on delete set null,
  side public.normal_side not null,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  original_currency_code text,
  debit_original numeric(18,2),
  credit_original numeric(18,2),
  functional_currency_code text,
  functional_debit numeric(18,2) not null default 0,
  functional_credit numeric(18,2) not null default 0,
  fx_rate_applied numeric(18,6),
  tax_tag text,
  party_id uuid references public.parties(id) on delete set null,
  tax_code_id uuid,
  role_code text,
  line_purpose text,
  tax_component text,
  settlement_component text,
  source_ref_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  unique (proposal_id, line_no)
);

create table if not exists public.posting_decision_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid references public.source_events(id) on delete cascade,
  source_event_facts_id uuid references public.source_event_facts(id) on delete cascade,
  posting_proposal_id uuid references public.posting_proposals(id) on delete cascade,
  decision_stage text not null,
  decision_source text not null,
  explanation text,
  decision_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  source_suggestion_id uuid references public.accounting_suggestions(id) on delete set null,
  entry_date date not null,
  period_id uuid,
  status public.entry_status not null default 'draft',
  posting_mode public.journal_posting_mode not null default 'final',
  currency_code text not null default 'UYU',
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  fx_rate_source text not null default 'same_currency',
  fx_rate_bcu_value numeric(18,6),
  fx_rate_bcu_date_used date,
  functional_currency_code text not null default 'UYU',
  functional_currency text not null default 'UYU',
  source_currency_present boolean not null default false,
  reference text,
  description text,
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  functional_total_debit numeric(18,2) not null default 0,
  functional_total_credit numeric(18,2) not null default 0,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries
  add column if not exists fiscal_period_id uuid references public.fiscal_periods(id) on delete set null,
  add column if not exists journal_type_id uuid references public.journal_types(id) on delete set null,
  add column if not exists auxiliary_book_id uuid references public.auxiliary_books(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_system text not null default 'convertilabs',
  add column if not exists source_event_id uuid references public.source_events(id) on delete set null,
  add column if not exists posting_proposal_id uuid references public.posting_proposals(id) on delete set null,
  add column if not exists accounting_snapshot_id uuid references public.organization_accounting_snapshots(id) on delete set null,
  add column if not exists provider_connection_id uuid,
  add column if not exists provider_managed boolean not null default false,
  add column if not exists source_provider text,
  add column if not exists source_hash text,
  add column if not exists economic_hash text,
  add column if not exists entry_number bigint,
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists immutable_at timestamptz,
  add column if not exists legacy_immutable boolean not null default false,
  add column if not exists reverses_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  add column if not exists reversed_by_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  add column if not exists adjusts_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  add column if not exists annulment_reason text;

update public.journal_entries
set
  source_channel = coalesce(nullif(source_channel, ''), 'documents'),
  source_system = coalesce(nullif(source_system, ''), 'convertilabs'),
  economic_hash = coalesce(economic_hash, source_hash),
  first_seen_at = coalesce(first_seen_at, created_at, now()),
  last_seen_at = coalesce(last_seen_at, updated_at, created_at, now()),
  legacy_immutable = coalesce(legacy_immutable, false)
where true;

with existing_max as (
  select
    organization_id,
    coalesce(max(entry_number), 0) as max_entry_number
  from public.journal_entries
  group by organization_id
),
numbered_entries as (
  select
    je.id,
    coalesce(existing_max.max_entry_number, 0)
    + row_number() over (
      partition by je.organization_id
      order by je.created_at asc, je.id asc
    ) as generated_entry_number
  from public.journal_entries as je
  left join existing_max
    on existing_max.organization_id = je.organization_id
  where je.entry_number is null
    and je.status in ('posted', 'exported')
)
update public.journal_entries as je
set entry_number = numbered_entries.generated_entry_number
from numbered_entries
where numbered_entries.id = je.id;

create index if not exists idx_journal_entries_org_date
  on public.journal_entries (organization_id, entry_date);

create index if not exists idx_journal_entries_org_source_event
  on public.journal_entries (organization_id, source_event_id, created_at desc);

create unique index if not exists idx_journal_entries_org_entry_number
  on public.journal_entries (organization_id, entry_number)
  where entry_number is not null;

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null,
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  currency_code text not null default 'UYU',
  original_currency_code text,
  original_amount numeric(18,2),
  fx_rate numeric(18,6) not null default 1,
  fx_rate_applied numeric(18,6),
  functional_debit numeric(18,2) not null default 0,
  functional_credit numeric(18,2) not null default 0,
  functional_amount_uyu numeric(18,2),
  tax_tag text,
  vendor_id uuid references public.vendors(id),
  customer_id uuid references public.customers(id),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  unique (journal_entry_id, line_no)
);

alter table public.journal_entry_lines
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists tax_code_id uuid,
  add column if not exists debit_original numeric(18,2),
  add column if not exists credit_original numeric(18,2),
  add column if not exists functional_currency_code text,
  add column if not exists role_code text,
  add column if not exists line_purpose text,
  add column if not exists tax_component text,
  add column if not exists settlement_component text,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb,
  add column if not exists source_hash text,
  add column if not exists provider_managed boolean not null default false;

update public.journal_entry_lines as jel
set
  debit_original = coalesce(jel.debit_original, nullif(jel.debit, 0), 0),
  credit_original = coalesce(jel.credit_original, nullif(jel.credit, 0), 0),
  functional_currency_code = coalesce(jel.functional_currency_code, je.functional_currency_code, je.functional_currency, 'UYU'),
  role_code = coalesce(jel.role_code, nullif(jel.metadata ->> 'role_code', '')),
  line_purpose = coalesce(jel.line_purpose, nullif(jel.metadata ->> 'line_purpose', '')),
  tax_component = coalesce(jel.tax_component, nullif(jel.metadata ->> 'tax_component', '')),
  settlement_component = coalesce(jel.settlement_component, nullif(jel.metadata ->> 'settlement_component', ''))
from public.journal_entries as je
where je.id = jel.journal_entry_id;

alter table public.posting_proposals
  drop constraint if exists posting_proposals_materialized_journal_entry_id_fkey;

alter table public.posting_proposals
  add constraint posting_proposals_materialized_journal_entry_id_fkey
    foreign key (materialized_journal_entry_id)
    references public.journal_entries(id)
    on delete set null;

update public.posting_proposals as pp
set
  accounting_snapshot_fingerprint = coalesce(
    pp.accounting_snapshot_fingerprint,
    nullif(pp.metadata_json ->> 'accounting_snapshot_fingerprint', '')
  ),
  economic_hash = coalesce(
    pp.economic_hash,
    nullif(pp.metadata_json ->> 'economic_hash', ''),
    pp.proposal_hash
  ),
  materialized_journal_entry_id = coalesce(
    pp.materialized_journal_entry_id,
    (
      select je.id
      from public.journal_entries as je
      where je.posting_proposal_id = pp.id
      order by je.created_at desc, je.id desc
      limit 1
    )
  ),
  confirmability_status = case
    when exists (
      select 1
      from public.journal_entries as je
      where je.posting_proposal_id = pp.id
    ) then 'materialized'
    when coalesce(nullif(pp.confirmability_status, ''), 'confirmable') = 'materialized'
      and not exists (
        select 1
        from public.journal_entries as je
        where je.posting_proposal_id = pp.id
      ) then 'confirmable'
    else coalesce(nullif(pp.confirmability_status, ''), 'confirmable')
  end
where true;

create index if not exists idx_posting_proposals_materialized_journal
  on public.posting_proposals (materialized_journal_entry_id)
  where materialized_journal_entry_id is not null;

create or replace function public.finalize_journal_entry()
returns trigger
language plpgsql
as $$
declare
  v_entry_id uuid;
  v_organization_id uuid;
  v_status public.entry_status;
  v_entry_date date;
  v_fiscal_period_id uuid;
  v_old_immutable_at timestamptz;
  v_new_immutable_at timestamptz;
  v_period_id uuid;
  v_period_starts_on date;
  v_period_ends_on date;
  v_period_status public.fiscal_period_status;
  v_period_locked_at timestamptz;
  v_locked_before date;
  v_line_count integer;
  v_total_debit numeric(18,2);
  v_total_credit numeric(18,2);
  v_functional_total_debit numeric(18,2);
  v_functional_total_credit numeric(18,2);
  v_next_entry_number bigint;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  v_entry_id := new.id;
  v_organization_id := new.organization_id;
  v_status := new.status;
  v_entry_date := new.entry_date;
  v_fiscal_period_id := new.fiscal_period_id;
  v_old_immutable_at := old.immutable_at;
  v_new_immutable_at := new.immutable_at;

  if v_old_immutable_at is null and v_new_immutable_at is not null then
    if v_status not in ('posted'::public.entry_status, 'exported'::public.entry_status) then
      raise exception 'No se puede finalizar un asiento sin status posted/exported.';
    end if;

    if v_fiscal_period_id is null then
      raise exception 'No se puede finalizar un asiento sin fiscal_period_id.';
    end if;

    execute $sql$
      select fp.id, fp.starts_on, fp.ends_on, fp.status, fp.locked_at
      from public.fiscal_periods as fp
      where fp.id = $1
    $sql$
    into
      v_period_id,
      v_period_starts_on,
      v_period_ends_on,
      v_period_status,
      v_period_locked_at
    using v_fiscal_period_id;

    if v_period_id is null then
      raise exception 'No existe el periodo contable asociado al asiento.';
    end if;

    if v_entry_date < v_period_starts_on or v_entry_date > v_period_ends_on then
      raise exception 'La fecha del asiento queda fuera del periodo contable seleccionado.';
    end if;

    if v_period_status in (
      'closed'::public.fiscal_period_status,
      'locked'::public.fiscal_period_status,
      'soft_closed'::public.fiscal_period_status,
      'tax_locked'::public.fiscal_period_status,
      'hard_closed'::public.fiscal_period_status,
      'audit_frozen'::public.fiscal_period_status
    ) or v_period_locked_at is not null then
      raise exception 'No se puede finalizar un asiento en un periodo cerrado o bloqueado.';
    end if;

    execute $sql$
      select settings.modifications_locked_before
      from public.accounting_settings as settings
      where settings.organization_id = $1
      limit 1
    $sql$
    into v_locked_before
    using v_organization_id;

    if v_locked_before is not null and v_entry_date <= v_locked_before then
      raise exception 'La fecha del asiento cae antes del lock contable configurado.';
    end if;

    execute $sql$
      select
        count(*) as line_count,
        coalesce(sum(jel.debit), 0)::numeric(18,2) as total_debit,
        coalesce(sum(jel.credit), 0)::numeric(18,2) as total_credit,
        coalesce(sum(jel.functional_debit), 0)::numeric(18,2) as functional_total_debit,
        coalesce(sum(jel.functional_credit), 0)::numeric(18,2) as functional_total_credit
      from public.journal_entry_lines as jel
      where jel.journal_entry_id = $1
    $sql$
    into
      v_line_count,
      v_total_debit,
      v_total_credit,
      v_functional_total_debit,
      v_functional_total_credit
    using v_entry_id;

    if coalesce(v_line_count, 0) = 0 then
      raise exception 'No se puede finalizar un asiento sin lineas.';
    end if;

    if abs(coalesce(v_total_debit, 0) - coalesce(v_total_credit, 0)) > 0.01 then
      raise exception 'Debe y Haber no cuadran al finalizar el asiento.';
    end if;

    if abs(
      coalesce(v_functional_total_debit, 0)
      - coalesce(v_functional_total_credit, 0)
    ) > 0.01 then
      raise exception 'Los montos funcionales no cuadran al finalizar el asiento.';
    end if;

    if abs(coalesce(new.total_debit, 0) - coalesce(v_total_debit, 0)) > 0.01
      or abs(coalesce(new.total_credit, 0) - coalesce(v_total_credit, 0)) > 0.01
      or abs(
        coalesce(new.functional_total_debit, 0)
        - coalesce(v_functional_total_debit, 0)
      ) > 0.01
      or abs(
        coalesce(new.functional_total_credit, 0)
        - coalesce(v_functional_total_credit, 0)
      ) > 0.01 then
      raise exception 'Los totales del encabezado no coinciden con las lineas del asiento.';
    end if;

    new.total_debit := v_total_debit;
    new.total_credit := v_total_credit;
    new.functional_total_debit := v_functional_total_debit;
    new.functional_total_credit := v_functional_total_credit;
    new.immutable_at := coalesce(v_new_immutable_at, now());

    if new.entry_number is null then
      perform pg_advisory_xact_lock(hashtext(v_organization_id::text));

      execute $sql$
        select coalesce(max(je.entry_number), 0) + 1
        from public.journal_entries as je
        where je.organization_id = $1
          and je.id <> $2
      $sql$
      into v_next_entry_number
      using v_organization_id, v_entry_id;

      new.entry_number := v_next_entry_number;
    end if;
  elsif v_status in ('posted'::public.entry_status, 'exported'::public.entry_status)
    and v_new_immutable_at is null then
    raise exception 'No se puede dejar un asiento posted/exported sin immutable_at.';
  end if;

  return new;
end;
$$;

create or replace function public.guard_immutable_journal_entry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.immutable_at is not null then
      raise exception 'No se puede borrar un asiento inmutable.';
    end if;

    return old;
  end if;

  if old.immutable_at is not null then
    if new.immutable_at is distinct from old.immutable_at then
      raise exception 'No se puede modificar immutable_at de un asiento inmutable.';
    end if;

    if new.status is distinct from old.status
      and not (old.status = 'posted' and new.status = 'exported') then
      raise exception 'Un asiento inmutable solo puede cambiar de posted a exported.';
    end if;

    if (
      to_jsonb(new) - '{reversed_by_journal_entry_id,annulment_reason,status,updated_at,last_seen_at}'::text[]
    ) is distinct from (
      to_jsonb(old) - '{reversed_by_journal_entry_id,annulment_reason,status,updated_at,last_seen_at}'::text[]
    ) then
      raise exception 'No se puede modificar un asiento inmutable fuera de reversal/export metadata.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_immutable_journal_entry_line()
returns trigger
language plpgsql
as $$
declare
  parent_immutable_at timestamptz;
begin
  select immutable_at
  into parent_immutable_at
  from public.journal_entries
  where id = case
    when tg_op = 'DELETE' then old.journal_entry_id
    else new.journal_entry_id
  end;

  if parent_immutable_at is not null then
    raise exception 'No se pueden mutar lineas de un asiento inmutable.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_finalize_journal_entry on public.journal_entries;
create trigger trg_finalize_journal_entry
before update on public.journal_entries
for each row
execute function public.finalize_journal_entry();

drop trigger if exists trg_guard_immutable_journal_entry on public.journal_entries;
create trigger trg_guard_immutable_journal_entry
before update or delete on public.journal_entries
for each row
execute function public.guard_immutable_journal_entry();

drop trigger if exists trg_guard_immutable_journal_entry_line on public.journal_entry_lines;
create trigger trg_guard_immutable_journal_entry_line
before insert or update or delete on public.journal_entry_lines
for each row
execute function public.guard_immutable_journal_entry_line();

create table if not exists public.ledger_open_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_type text not null,
  counterparty_id uuid,
  source_document_id uuid references public.documents(id) on delete cascade,
  document_role public.document_direction not null default 'other',
  document_type text,
  issue_date date,
  due_date date,
  currency_code text not null default 'UYU',
  original_currency_code text,
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  fx_rate_source text not null default 'same_currency',
  fx_rate_origin numeric(18,6),
  fx_rate_origin_date date,
  functional_currency_code text not null default 'UYU',
  original_amount numeric(18,2) not null default 0,
  functional_amount numeric(18,2) not null default 0,
  functional_amount_origin_uyu numeric(18,2),
  settled_amount numeric(18,2) not null default 0,
  outstanding_amount numeric(18,2) not null default 0,
  status text not null default 'open',
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ledger_open_items
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb,
  add column if not exists opening_journal_entry_line_id uuid references public.journal_entry_lines(id) on delete set null,
  add column if not exists provider_connection_id uuid,
  add column if not exists provider_managed boolean not null default false,
  add column if not exists source_hash text;

update public.ledger_open_items
set source_channel = coalesce(nullif(source_channel, ''), 'documents')
where true;

create index if not exists idx_ledger_open_items_org_counterparty
  on public.ledger_open_items (organization_id, counterparty_type, counterparty_id, status);

create index if not exists idx_ledger_open_items_org_document
  on public.ledger_open_items (organization_id, source_document_id);

create table if not exists public.ledger_settlement_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  open_item_id uuid not null references public.ledger_open_items(id) on delete cascade,
  settlement_document_id uuid not null references public.documents(id) on delete cascade,
  settlement_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  currency_code text not null default 'UYU',
  fx_rate numeric(18,6) not null default 1,
  fx_rate_date date,
  amount numeric(18,2) not null default 0,
  functional_amount numeric(18,2) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.ledger_settlement_links
  add column if not exists settlement_journal_entry_line_id uuid references public.journal_entry_lines(id) on delete set null,
  add column if not exists source_channel text not null default 'documents',
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid,
  add column if not exists source_ref_json jsonb not null default '{}'::jsonb;

create index if not exists idx_ledger_settlement_links_org_open_item
  on public.ledger_settlement_links (organization_id, open_item_id, settled_at desc);
-- <<< db/schema/05_accounting.sql

-- >>> db/schema/06_tax_and_rules.sql
create table if not exists public.normative_packages (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'UY',
  tax_type public.tax_type not null,
  package_year integer not null,
  name text not null,
  status text not null default 'active',
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (country_code, tax_type, package_year, name)
);

create table if not exists public.normative_documents (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.normative_packages(id) on delete cascade,
  title text not null,
  document_type text,
  source_reference text,
  storage_bucket text not null default 'normative-private',
  storage_path text,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  package_id uuid references public.normative_packages(id) on delete cascade,
  tax_type public.tax_type not null,
  scope public.rule_scope not null,
  name text not null,
  priority integer not null default 0,
  active boolean not null default true,
  valid_from date,
  valid_to date,
  conditions_json jsonb not null default '[]'::jsonb,
  effects_json jsonb not null default '[]'::jsonb,
  source_reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_rules_scope_active
  on public.tax_rules (tax_type, scope, active);

create table if not exists public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_type public.tax_type not null,
  period_year integer not null,
  period_month integer,
  start_date date not null,
  end_date date not null,
  status public.tax_period_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, tax_type, period_year, period_month)
);

create table if not exists public.tax_period_document_selections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.tax_periods(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  selection_status text not null,
  note text,
  metadata_json jsonb not null default '{}'::jsonb,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_period_document_selections_status_check
    check (selection_status in ('confirmed_for_period', 'excluded_from_period')),
  unique (organization_id, period_id, document_id)
);

create index if not exists idx_tax_period_document_selections_period_status
  on public.tax_period_document_selections (organization_id, period_id, selection_status, decided_at desc);

create table if not exists public.vat_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.tax_periods(id) on delete cascade,
  status text not null default 'draft',
  input_snapshot_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  output_vat numeric(18,2) not null default 0,
  input_vat_creditable numeric(18,2) not null default 0,
  input_vat_non_deductible numeric(18,2) not null default 0,
  import_vat numeric(18,2) not null default 0,
  import_vat_advance numeric(18,2) not null default 0,
  adjustments numeric(18,2) not null default 0,
  net_vat_payable numeric(18,2) not null default 0,
  version_no integer not null default 1,
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  locked_by uuid references public.profiles(id),
  locked_at timestamptz,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_vat_runs_org_period_version
  on public.vat_runs (organization_id, period_id, version_no);

create table if not exists public.dgi_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_year integer not null,
  period_month integer not null,
  source_kind public.dgi_reconciliation_source_kind not null default 'manual_summary',
  status public.dgi_reconciliation_run_status not null default 'draft',
  baseline_payload jsonb not null default '{}'::jsonb,
  differences_payload jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dgi_reconciliation_runs_org_period
  on public.dgi_reconciliation_runs (organization_id, period_year, period_month, created_at desc);

create table if not exists public.dgi_reconciliation_buckets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.dgi_reconciliation_runs(id) on delete cascade,
  bucket_code text not null,
  dgi_net_amount_uyu numeric(18,2) not null default 0,
  system_net_amount_uyu numeric(18,2) not null default 0,
  dgi_tax_amount_uyu numeric(18,2) not null default 0,
  system_tax_amount_uyu numeric(18,2) not null default 0,
  delta_net_amount_uyu numeric(18,2) not null default 0,
  delta_tax_amount_uyu numeric(18,2) not null default 0,
  difference_status public.dgi_reconciliation_difference_status not null default 'matched',
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, bucket_code)
);

create index if not exists idx_dgi_reconciliation_buckets_org_run
  on public.dgi_reconciliation_buckets (organization_id, run_id, bucket_code);

create table if not exists public.organization_import_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference_code text,
  dua_number text,
  dua_year text,
  customs_broker_name text,
  supplier_name text,
  supplier_tax_id text,
  currency_code text,
  operation_date date,
  payment_date date,
  status text not null default 'draft',
  warnings_json jsonb not null default '[]'::jsonb,
  raw_summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_operations_org_created
  on public.organization_import_operations (organization_id, created_at desc);

create index if not exists idx_import_operations_org_status
  on public.organization_import_operations (organization_id, status, operation_date);

create table if not exists public.organization_import_operation_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_operation_id uuid not null references public.organization_import_operations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_type text not null default 'unknown',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, import_operation_id, document_id)
);

create index if not exists idx_import_operation_documents_org_operation
  on public.organization_import_operation_documents (organization_id, import_operation_id, created_at desc);

create table if not exists public.organization_import_operation_taxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_operation_id uuid not null references public.organization_import_operations(id) on delete cascade,
  tax_code text,
  tax_label text not null,
  external_tax_code text,
  amount numeric(18,2) not null default 0,
  currency_code text not null default 'USD',
  is_creditable_vat boolean not null default false,
  is_vat_advance boolean not null default false,
  is_other_tax boolean not null default true,
  source_document_id uuid references public.documents(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_operation_taxes_org_operation
  on public.organization_import_operation_taxes (organization_id, import_operation_id, created_at desc);
-- <<< db/schema/06_tax_and_rules.sql

-- >>> db/schema/07_integrations_and_audit.sql
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_type text not null,
  export_scope text not null default 'vat_period',
  target_system text not null,
  target_id uuid,
  status public.export_status not null default 'queued',
  storage_bucket text not null default 'exports-private',
  storage_path text,
  artifact_filename text,
  artifact_mime_type text,
  payload_json jsonb not null default '{}'::jsonb,
  checksum text,
  failure_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  downloaded_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.organization_dgi_form_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  form_code text not null,
  line_code text not null,
  metric_key text not null,
  label text not null,
  calculation_mode text not null default 'direct_metric',
  configuration_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_dgi_form_mappings_org_form
  on public.organization_dgi_form_mappings (organization_id, form_code, is_active, version desc);

create table if not exists public.vat_form_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vat_run_id uuid not null references public.vat_runs(id) on delete cascade,
  export_id uuid references public.exports(id) on delete set null,
  form_code text not null,
  lines_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_vat_form_exports_org_run
  on public.vat_form_exports (organization_id, vat_run_id, created_at desc);

create table if not exists public.organization_spreadsheet_import_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  file_name text not null,
  file_kind text not null default 'unknown',
  import_type text not null default 'unsupported',
  run_mode text not null default 'interactive',
  status text not null default 'preview_ready',
  provider_code text,
  model_code text,
  prompt_version text,
  schema_version text,
  batch_id text,
  response_id text,
  estimated_cost_usd numeric(12,6),
  warnings_json jsonb not null default '[]'::jsonb,
  preview_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  detected_mapping_json jsonb not null default '{}'::jsonb,
  status_events_json jsonb not null default '[]'::jsonb,
  retry_count integer not null default 0,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_spreadsheet_import_runs
  add column if not exists ai_parse_status text,
  add column if not exists ai_parse_payload jsonb not null default '{}'::jsonb,
  add column if not exists normalized_payload jsonb not null default '{}'::jsonb,
  add column if not exists error_report jsonb not null default '{}'::jsonb;

create index if not exists idx_org_spreadsheet_runs_org_created
  on public.organization_spreadsheet_import_runs (organization_id, created_at desc);

create index if not exists idx_org_spreadsheet_runs_org_status
  on public.organization_spreadsheet_import_runs (organization_id, status, import_type);

insert into storage.buckets (
  id,
  name,
  public
)
values
  ('exports-private', 'exports-private', false),
  ('normative-private', 'normative-private', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_url text not null,
  secret_hash text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  mode text not null default 'read_only',
  status text not null default 'configured',
  test_mode boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  encrypted_credentials text,
  credentials_fingerprint text,
  credentials_last_rotated_at timestamptz,
  last_connection_test_at timestamptz,
  last_connection_test_ok boolean,
  last_error text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists idx_integration_connections_org_provider_status
  on public.organization_integration_connections (organization_id, provider, status);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.organization_integration_connections(id) on delete set null,
  provider text not null,
  stream text not null,
  run_kind text not null default 'manual',
  status text not null default 'queued',
  test_mode boolean not null default true,
  test_run_key text,
  initiated_by_user_id uuid references public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  records_seen integer not null default 0,
  records_upserted integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  cursor_from text,
  cursor_to text,
  input_json jsonb not null default '{}'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  cleanup_status text not null default 'not_required',
  cleanup_required_by timestamptz,
  cleanup_verified_at timestamptz,
  cleanup_verified_by_user_id uuid references public.profiles(id),
  cleanup_evidence_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_sync_runs_org_provider_stream_created
  on public.integration_sync_runs (organization_id, provider, stream, created_at desc);

create index if not exists idx_integration_sync_runs_org_status
  on public.integration_sync_runs (organization_id, status, created_at desc);

create table if not exists public.integration_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.organization_integration_connections(id) on delete cascade,
  provider text not null,
  stream text not null,
  cursor_key text not null,
  cursor_value text,
  cursor_json jsonb not null default '{}'::jsonb,
  last_success_run_id uuid references public.integration_sync_runs(id) on delete set null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, stream, cursor_key)
);

create index if not exists idx_integration_sync_cursors_org_provider_stream
  on public.integration_sync_cursors (organization_id, provider, stream, cursor_key);

create table if not exists public.integration_raw_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.organization_integration_connections(id) on delete set null,
  provider text not null,
  stream text not null,
  entity_type text not null,
  external_key text not null,
  external_version_key text,
  payload_json jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_run_id uuid references public.integration_sync_runs(id) on delete set null,
  test_mode boolean not null default false,
  test_run_key text,
  document_date date,
  currency_code text,
  source_exchange_rate numeric(18,8),
  source_exchange_rate_date date,
  source_exchange_rate_kind text,
  source_total_amount numeric(18,2),
  source_net_amount numeric(18,2),
  source_tax_amount numeric(18,2),
  source_monetary_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, entity_type, external_key)
);

create index if not exists idx_integration_raw_records_org_stream_seen
  on public.integration_raw_records (organization_id, provider, stream, last_seen_at desc);

create index if not exists idx_integration_raw_records_payload_hash
  on public.integration_raw_records (organization_id, provider, payload_hash);

create table if not exists public.document_source_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider text not null,
  source_kind text not null,
  raw_record_id uuid references public.integration_raw_records(id) on delete set null,
  sync_run_id uuid references public.integration_sync_runs(id) on delete set null,
  external_key text not null,
  external_version_key text,
  payload_hash_at_materialization text,
  current_payload_hash text,
  drift_status text not null default 'none',
  factual_trust_mode text not null default 'external_deterministic',
  source_pdf_url text,
  source_pdf_url_expires_at timestamptz,
  bandeja_compatibility_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, source_kind, external_key)
);

create index if not exists idx_document_source_refs_document
  on public.document_source_refs (document_id, provider, source_kind);

create index if not exists idx_document_source_refs_raw_record
  on public.document_source_refs (raw_record_id);

create table if not exists public.integration_entity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_entity_type text not null,
  external_key text not null,
  local_entity_type text not null,
  local_entity_id uuid not null,
  match_method text not null,
  confidence numeric(5,4),
  status text not null default 'active',
  created_by_run_id uuid references public.integration_sync_runs(id) on delete set null,
  reviewed_by_user_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_entity_type, external_key)
);

create index if not exists idx_integration_entity_links_external
  on public.integration_entity_links (organization_id, provider, external_entity_type, external_key);

create index if not exists idx_integration_entity_links_local
  on public.integration_entity_links (organization_id, provider, local_entity_type, local_entity_id);

create table if not exists public.organization_cfe_email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_label text not null default 'Casilla principal de eFacturas',
  mailbox_email text not null,
  mailbox_email_normalized text not null,
  inbound_address text not null,
  ingestion_mode text not null default 'forwarding_alias',
  status text not null default 'pending_forwarding',
  is_active boolean not null default true,
  last_inbound_email_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (mailbox_email_normalized),
  unique (inbound_address)
);

create index if not exists idx_org_cfe_email_connections_org_user
  on public.organization_cfe_email_connections (organization_id, user_id);

create index if not exists idx_org_cfe_email_connections_org_active
  on public.organization_cfe_email_connections (organization_id, is_active, updated_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_org_created
  on public.audit_log (organization_id, created_at desc);

create table if not exists public.system_actors (
  id text primary key,
  display_name text not null,
  actor_kind text not null default 'ai_assistant',
  is_active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.system_actors (
  id,
  display_name,
  actor_kind,
  is_active,
  metadata_json
)
values (
  'system_ai_assistant',
  'Asistente Contable',
  'ai_assistant',
  true,
  jsonb_build_object(
    'personas',
    jsonb_build_array(
      'document_reviewer_assistant',
      'close_assistant',
      'tax_assistant',
      'audit_assistant'
    )
  )
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  actor_kind = excluded.actor_kind,
  is_active = excluded.is_active,
  metadata_json = excluded.metadata_json,
  updated_at = now();

create table if not exists public.assistant_personas (
  code text primary key,
  display_name text not null,
  scope text not null,
  system_actor_id text not null references public.system_actors(id),
  avatar_asset_path text,
  tone text,
  specialty_md text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.assistant_personas (
  code,
  display_name,
  scope,
  system_actor_id,
  avatar_asset_path,
  tone,
  specialty_md,
  is_active
)
values
  (
    'document_reviewer_assistant',
    'Asistente Contable',
    'documents',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Revision documental y propuestas contables dentro del workflow de documentos.',
    true
  ),
  (
    'tax_assistant',
    'Asistente Contable',
    'tax',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia fiscal y trazabilidad sobre IVA, validaciones y anomalias.',
    true
  ),
  (
    'close_assistant',
    'Asistente Contable',
    'close',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia sobre cierre contable, checks y bloqueos operativos.',
    true
  ),
  (
    'audit_assistant',
    'Asistente Contable',
    'audit',
    'system_ai_assistant',
    '/assistant/accounting-assistant.svg',
    'claro, analitico y consultivo',
    'Asistencia sobre imports, evidencia y resoluciones auditables.',
    true
  )
on conflict (code) do update
set
  display_name = excluded.display_name,
  scope = excluded.scope,
  system_actor_id = excluded.system_actor_id,
  avatar_asset_path = excluded.avatar_asset_path,
  tone = excluded.tone,
  specialty_md = excluded.specialty_md,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  persona_code text not null references public.assistant_personas(code),
  opened_by_profile_id uuid references public.profiles(id),
  status text not null default 'open',
  current_input_hash text,
  stale_reason text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, target_kind, target_id, persona_code)
);

create index if not exists idx_assistant_threads_org_target
  on public.assistant_threads (organization_id, target_kind, target_id, updated_at desc);

create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by_profile_id uuid references public.profiles(id),
  system_actor_id text not null references public.system_actors(id),
  thread_id uuid references public.assistant_threads(id) on delete set null,
  message_id uuid,
  persona text not null,
  scope text not null,
  target_kind text not null,
  target_id text not null,
  input_hash text,
  prompt_template_key text,
  prompt_template_version text,
  provider text,
  model text,
  model_version text,
  status text not null default 'completed',
  confidence numeric(5,4),
  rationale_markdown text,
  output_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  request_payload_json jsonb not null default '{}'::jsonb,
  response_payload_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_assistant_runs_org_target_created
  on public.assistant_runs (organization_id, target_kind, target_id, created_at desc);

create index if not exists idx_assistant_runs_org_scope_created
  on public.assistant_runs (organization_id, scope, created_at desc);

create index if not exists idx_assistant_runs_thread_created
  on public.assistant_runs (thread_id, created_at desc);

create table if not exists public.assistant_run_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  snapshot_ref text,
  source_hash_at_read text,
  excerpt_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_run_evidence_refs_run
  on public.assistant_run_evidence_refs (assistant_run_id, source_kind);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  role text not null,
  persona_code text references public.assistant_personas(code),
  created_by_profile_id uuid references public.profiles(id),
  system_actor_id text references public.system_actors(id),
  assistant_run_id uuid references public.assistant_runs(id) on delete set null,
  content_md text not null,
  structured_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_messages_thread_created
  on public.assistant_messages (thread_id, created_at desc);

create table if not exists public.assistant_suggestions (
  id uuid primary key default gen_random_uuid(),
  assistant_run_id uuid not null references public.assistant_runs(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete set null,
  message_id uuid references public.assistant_messages(id) on delete set null,
  suggestion_type text not null,
  proposed_payload_json jsonb not null default '{}'::jsonb,
  input_hash text,
  evidence_hash text,
  confidence numeric(5,4),
  rationale_md text,
  requested_by_profile_id uuid references public.profiles(id),
  resolution_status text not null default 'pending',
  resolved_by_profile_id uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestions_run_status
  on public.assistant_suggestions (assistant_run_id, resolution_status, created_at desc);

create index if not exists idx_assistant_suggestions_thread_status
  on public.assistant_suggestions (thread_id, resolution_status, created_at desc);

create table if not exists public.assistant_suggestion_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  assistant_suggestion_id uuid not null references public.assistant_suggestions(id) on delete cascade,
  source_kind text not null,
  source_id text not null,
  snapshot_ref text,
  source_hash_at_read text,
  excerpt_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_suggestion_evidence_refs_suggestion
  on public.assistant_suggestion_evidence_refs (assistant_suggestion_id, source_kind);

create table if not exists public.ai_decision_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  run_type text not null,
  provider_code text,
  model_code text,
  prompt_version text,
  schema_version text,
  response_id text,
  decision_source text not null,
  confidence_score numeric(5,4),
  certainty_level text not null default 'yellow',
  evidence_json jsonb not null default '{}'::jsonb,
  rationale_text text,
  warnings_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_decision_logs_org_doc_created
  on public.ai_decision_logs (organization_id, document_id, created_at desc);
-- <<< db/schema/07_integrations_and_audit.sql

-- >>> db/schema/08_document_ai_pipeline.sql
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
  vat_regime text not null default 'UNKNOWN',
  dgi_group text not null default 'UNKNOWN',
  cfe_status text not null default 'UNKNOWN',
  change_reason text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (organization_id, version_number)
);

alter table public.organization_profile_versions
  add column if not exists fiscal_address_text text,
  add column if not exists fiscal_department text,
  add column if not exists fiscal_city text,
  add column if not exists fiscal_postal_code text,
  add column if not exists fiscal_lat numeric(10,6),
  add column if not exists fiscal_long numeric(10,6),
  add column if not exists location_risk_policy text not null default 'warn_and_require_note',
  add column if not exists travel_radius_km_policy numeric(10,2);

update public.organization_profile_versions
set
  fiscal_address_text = coalesce(fiscal_address_text, nullif(profile_json ->> 'fiscal_address_text', '')),
  fiscal_department = coalesce(fiscal_department, nullif(profile_json ->> 'fiscal_department', '')),
  fiscal_city = coalesce(fiscal_city, nullif(profile_json ->> 'fiscal_city', '')),
  fiscal_postal_code = coalesce(fiscal_postal_code, nullif(profile_json ->> 'fiscal_postal_code', '')),
  location_risk_policy = coalesce(location_risk_policy, nullif(profile_json ->> 'location_risk_policy', ''), 'warn_and_require_note')
where profile_json <> '{}'::jsonb;

create index if not exists idx_org_profile_versions_org_effective
  on public.organization_profile_versions (organization_id, effective_from desc);

create table if not exists public.organization_business_profile_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_no integer not null,
  primary_activity_code text,
  short_description text,
  has_mixed_vat_operations boolean not null default false,
  has_imports boolean not null default false,
  has_exports boolean not null default false,
  is_multi_currency boolean not null default false,
  source text not null default 'onboarding',
  is_current boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  catalog_version text not null default 'uy-ciiu-rev4-dgi-ine-v1-2026-03-15'
);

create unique index if not exists organization_business_profile_versions_org_version_idx
  on public.organization_business_profile_versions (organization_id, version_no);

create index if not exists organization_business_profile_versions_current_idx
  on public.organization_business_profile_versions (organization_id, is_current);

create table if not exists public.organization_business_profile_activities (
  id uuid primary key default gen_random_uuid(),
  business_profile_version_id uuid not null references public.organization_business_profile_versions(id) on delete cascade,
  activity_code text not null,
  role text not null,
  rank integer not null default 0
);

create index if not exists organization_business_profile_activities_version_idx
  on public.organization_business_profile_activities (business_profile_version_id, role, rank);

create table if not exists public.organization_business_profile_traits (
  id uuid primary key default gen_random_uuid(),
  business_profile_version_id uuid not null references public.organization_business_profile_versions(id) on delete cascade,
  trait_code text not null,
  enabled boolean not null default true
);

create index if not exists organization_business_profile_traits_version_idx
  on public.organization_business_profile_traits (business_profile_version_id, trait_code);

create table if not exists public.organization_preset_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_profile_version_id uuid references public.organization_business_profile_versions(id) on delete set null,
  base_preset_code text not null,
  overlay_codes_json jsonb not null default '[]'::jsonb,
  application_mode text not null default 'recommended',
  explanation_json jsonb not null default '{}'::jsonb,
  applied_at timestamp with time zone not null default now(),
  applied_by uuid references public.profiles(id),
  active boolean not null default true
);

create index if not exists organization_preset_applications_org_active_idx
  on public.organization_preset_applications (organization_id, active, applied_at desc);

create table if not exists public.organization_preset_ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  business_profile_version_id uuid references public.organization_business_profile_versions(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  request_origin text not null,
  ip_hash text,
  input_hash text not null,
  input_snapshot_json jsonb not null default '{}'::jsonb,
  rule_recommendation_json jsonb not null default '{}'::jsonb,
  candidate_compositions_json jsonb not null default '[]'::jsonb,
  selected_composition_code text,
  confidence numeric(6,5),
  target_audience_fit text,
  key_benefit text,
  setup_tip text,
  assistant_letter_markdown text,
  observations_json jsonb not null default '[]'::jsonb,
  suggested_cost_centers_json jsonb not null default '[]'::jsonb,
  cost_center_draft_saved boolean not null default false,
  cost_center_draft_saved_at timestamp with time zone,
  cost_center_draft_saved_by uuid references public.profiles(id) on delete set null,
  provider_code text,
  model_code text,
  response_id text,
  prompt_hash text,
  request_payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12,6),
  status text not null default 'completed',
  failure_message text,
  created_at timestamp with time zone not null default now()
);

create index if not exists organization_preset_ai_runs_requested_by_created_idx
  on public.organization_preset_ai_runs (requested_by, created_at desc);

create index if not exists organization_preset_ai_runs_ip_hash_created_idx
  on public.organization_preset_ai_runs (ip_hash, created_at desc);

create index if not exists organization_preset_ai_runs_organization_created_idx
  on public.organization_preset_ai_runs (organization_id, created_at desc);

alter table public.organization_preset_applications
  add column if not exists ai_run_id uuid references public.organization_preset_ai_runs(id) on delete set null;

create index if not exists organization_preset_applications_ai_run_idx
  on public.organization_preset_applications (ai_run_id);

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
  vat_regime text not null default 'UNKNOWN',
  dgi_group text not null default 'UNKNOWN',
  cfe_status text not null default 'UNKNOWN',
  snapshot_json jsonb not null default '{}'::jsonb,
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
  provider_response_id text,
  provider_status text,
  transport_mode text,
  store_remote boolean not null default false,
  prompt_version text,
  schema_version text,
  attempt_count integer not null default 0,
  last_polled_at timestamptz,
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
  intake_context_json jsonb not null default '{}'::jsonb,
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

create table if not exists public.document_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  line_number integer not null,
  raw_concept_code text,
  raw_concept_description text,
  normalized_concept_code text,
  normalized_concept_description text,
  net_amount numeric(18,2),
  tax_rate numeric(10,4),
  tax_amount numeric(18,2),
  total_amount numeric(18,2),
  matched_concept_id uuid references public.organization_concepts(id) on delete set null,
  match_strategy text not null default 'unmatched',
  match_confidence numeric(5,4) not null default 0,
  requires_user_context boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, line_number)
);

create index if not exists idx_document_line_items_doc_draft
  on public.document_line_items (document_id, draft_id);

create table if not exists public.document_accounting_contexts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  draft_id uuid not null references public.document_drafts(id) on delete cascade,
  status text not null default 'not_required',
  reason_codes text[] not null default '{}',
  user_free_text text,
  structured_context_json jsonb not null default '{}'::jsonb,
  ai_request_payload_json jsonb not null default '{}'::jsonb,
  ai_response_json jsonb not null default '{}'::jsonb,
  provider_code text,
  model_code text,
  prompt_hash text,
  request_latency_ms integer,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id)
);

create index if not exists idx_document_accounting_contexts_doc_status
  on public.document_accounting_contexts (document_id, status);

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

create table if not exists public.document_invoice_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_draft_id uuid references public.document_drafts(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  issuer_tax_id_normalized text,
  issuer_name_normalized text,
  document_number_normalized text,
  document_date date,
  total_amount numeric(18,2),
  currency_code text,
  identity_strategy text not null default 'insufficient_data',
  invoice_identity_key text,
  duplicate_status text not null default 'clear',
  duplicate_of_document_id uuid references public.documents(id) on delete set null,
  duplicate_reason text,
  resolution_notes text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists idx_document_invoice_identities_org_key
  on public.document_invoice_identities (organization_id, invoice_identity_key);

create index if not exists idx_document_invoice_identities_org_status
  on public.document_invoice_identities (organization_id, duplicate_status);

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
-- <<< db/schema/08_document_ai_pipeline.sql

-- >>> db/schema/09_accounting_read_models.sql
create or replace view public.v_journal_entries_read as
with recursive lineage_walk as (
  select
    je.id as journal_entry_id,
    je.id as ancestor_journal_entry_id,
    coalesce(je.reverses_journal_entry_id, je.adjusts_journal_entry_id) as next_journal_entry_id,
    0 as lineage_depth
  from public.journal_entries as je

  union all

  select
    lineage_walk.journal_entry_id,
    parent.id as ancestor_journal_entry_id,
    coalesce(parent.reverses_journal_entry_id, parent.adjusts_journal_entry_id) as next_journal_entry_id,
    lineage_walk.lineage_depth + 1
  from lineage_walk
  join public.journal_entries as parent
    on parent.id = lineage_walk.next_journal_entry_id
  where lineage_walk.next_journal_entry_id is not null
    and lineage_walk.lineage_depth < 32
),
lineage_root as (
  select distinct on (lineage_walk.journal_entry_id)
    lineage_walk.journal_entry_id,
    lineage_walk.ancestor_journal_entry_id as lineage_root_journal_entry_id,
    lineage_walk.lineage_depth
  from lineage_walk
  order by lineage_walk.journal_entry_id, lineage_walk.lineage_depth desc
),
line_summary as (
  select
    jel.journal_entry_id,
    count(*)::integer as line_count,
    count(distinct jel.account_id)::integer as distinct_account_count
  from public.journal_entry_lines as jel
  group by jel.journal_entry_id
),
open_item_summary as (
  select
    loi.journal_entry_id,
    count(*)::integer as open_item_count,
    round(coalesce(sum(loi.outstanding_amount), 0), 2) as open_item_outstanding_amount,
    round(coalesce(sum(loi.functional_amount), 0), 2) as open_item_functional_amount
  from public.ledger_open_items as loi
  where loi.journal_entry_id is not null
  group by loi.journal_entry_id
),
settlement_summary as (
  select
    lsl.settlement_journal_entry_id as journal_entry_id,
    count(*)::integer as settlement_link_count,
    round(coalesce(sum(lsl.amount), 0), 2) as settlement_amount,
    round(coalesce(sum(lsl.functional_amount), 0), 2) as settlement_functional_amount,
    max(lsl.settled_at) as last_settled_at
  from public.ledger_settlement_links as lsl
  where lsl.settlement_journal_entry_id is not null
  group by lsl.settlement_journal_entry_id
)
select
  je.organization_id,
  je.id as journal_entry_id,
  je.entry_number,
  je.entry_date,
  je.status,
  je.posting_mode,
  je.source_channel,
  je.source_system,
  je.source_provider,
  je.provider_managed,
  je.source_document_id,
  je.source_event_id,
  se.source_entity_type,
  se.source_entity_id,
  se.source_external_id,
  je.posting_proposal_id,
  pp.confirmability_status as posting_proposal_confirmability_status,
  pp.accounting_snapshot_fingerprint,
  je.accounting_snapshot_id,
  je.fiscal_period_id,
  fp.code as fiscal_period_code,
  fp.label as fiscal_period_label,
  fp.status as fiscal_period_status,
  je.journal_type_id,
  jt.code as journal_type_code,
  jt.name as journal_type_name,
  je.auxiliary_book_id,
  ab.code as auxiliary_book_code,
  ab.name as auxiliary_book_name,
  je.reference,
  je.description,
  je.currency_code,
  je.functional_currency_code,
  je.fx_rate,
  je.fx_rate_date,
  je.fx_rate_source,
  je.total_debit,
  je.total_credit,
  je.functional_total_debit,
  je.functional_total_credit,
  je.source_hash,
  je.economic_hash,
  coalesce(line_summary.line_count, 0) as line_count,
  coalesce(line_summary.distinct_account_count, 0) as distinct_account_count,
  coalesce(open_item_summary.open_item_count, 0) as open_item_count,
  coalesce(open_item_summary.open_item_outstanding_amount, 0)::numeric(18,2) as open_item_outstanding_amount,
  coalesce(open_item_summary.open_item_functional_amount, 0)::numeric(18,2) as open_item_functional_amount,
  coalesce(settlement_summary.settlement_link_count, 0) as settlement_link_count,
  coalesce(settlement_summary.settlement_amount, 0)::numeric(18,2) as settlement_amount,
  coalesce(settlement_summary.settlement_functional_amount, 0)::numeric(18,2) as settlement_functional_amount,
  settlement_summary.last_settled_at,
  case
    when je.reverses_journal_entry_id is not null then 'reversal'
    when je.adjusts_journal_entry_id is not null then 'adjustment'
    else 'base'
  end as lineage_kind,
  lineage_root.lineage_root_journal_entry_id,
  coalesce(lineage_root.lineage_depth, 0) as lineage_depth,
  je.reverses_journal_entry_id,
  je.reversed_by_journal_entry_id,
  je.adjusts_journal_entry_id,
  je.annulment_reason,
  je.immutable_at is not null as is_immutable,
  je.reversed_by_journal_entry_id is null as is_active_leaf,
  je.first_seen_at,
  je.last_seen_at,
  je.created_at,
  je.updated_at
from public.journal_entries as je
left join public.source_events as se
  on se.id = je.source_event_id
left join public.posting_proposals as pp
  on pp.id = je.posting_proposal_id
left join public.fiscal_periods as fp
  on fp.id = je.fiscal_period_id
left join public.journal_types as jt
  on jt.id = je.journal_type_id
left join public.auxiliary_books as ab
  on ab.id = je.auxiliary_book_id
left join line_summary
  on line_summary.journal_entry_id = je.id
left join open_item_summary
  on open_item_summary.journal_entry_id = je.id
left join settlement_summary
  on settlement_summary.journal_entry_id = je.id
left join lineage_root
  on lineage_root.journal_entry_id = je.id;

alter view public.v_journal_entries_read set (security_invoker = true);

create or replace view public.v_journal_lineage as
with relations as (
  select
    je.organization_id,
    je.id as journal_entry_id,
    je.reverses_journal_entry_id as related_journal_entry_id,
    'reverses'::text as relation_type
  from public.journal_entries as je
  where je.reverses_journal_entry_id is not null

  union all

  select
    je.organization_id,
    je.id as journal_entry_id,
    je.reversed_by_journal_entry_id as related_journal_entry_id,
    'reversed_by'::text as relation_type
  from public.journal_entries as je
  where je.reversed_by_journal_entry_id is not null

  union all

  select
    je.organization_id,
    je.id as journal_entry_id,
    je.adjusts_journal_entry_id as related_journal_entry_id,
    'adjusts'::text as relation_type
  from public.journal_entries as je
  where je.adjusts_journal_entry_id is not null
)
select
  relations.organization_id,
  relations.journal_entry_id,
  current_entry.entry_number,
  current_entry.entry_date,
  current_entry.status as entry_status,
  current_entry.lineage_root_journal_entry_id,
  relations.related_journal_entry_id,
  related_entry.entry_number as related_entry_number,
  related_entry.entry_date as related_entry_date,
  related_entry.status as related_entry_status,
  related_entry.lineage_root_journal_entry_id as related_lineage_root_journal_entry_id,
  relations.relation_type
from relations
join public.v_journal_entries_read as current_entry
  on current_entry.journal_entry_id = relations.journal_entry_id
left join public.v_journal_entries_read as related_entry
  on related_entry.journal_entry_id = relations.related_journal_entry_id;

alter view public.v_journal_lineage set (security_invoker = true);

create or replace view public.v_trial_balance as
select
  je.organization_id,
  je.fiscal_period_id,
  fp.code as fiscal_period_code,
  fp.label as fiscal_period_label,
  je.source_channel,
  jel.account_id,
  coa.code as account_code,
  coa.name as account_name,
  coa.account_type,
  coa.chapter_code,
  coa.presentation_code,
  coa.statement_section,
  coalesce(coa.natural_balance, coa.normal_side) as natural_balance,
  round(coalesce(sum(jel.debit), 0), 2) as debit,
  round(coalesce(sum(jel.credit), 0), 2) as credit,
  round(coalesce(sum(jel.debit - jel.credit), 0), 2) as balance,
  round(coalesce(sum(coalesce(jel.functional_debit, jel.debit)), 0), 2) as functional_debit,
  round(coalesce(sum(coalesce(jel.functional_credit, jel.credit)), 0), 2) as functional_credit,
  round(
    coalesce(
      sum(coalesce(jel.functional_debit, jel.debit) - coalesce(jel.functional_credit, jel.credit)),
      0
    ),
    2
  ) as functional_balance,
  count(distinct je.id)::integer as entry_count,
  count(*)::integer as line_count,
  min(je.entry_date) as first_entry_date,
  max(je.entry_date) as last_entry_date
from public.journal_entries as je
join public.journal_entry_lines as jel
  on jel.journal_entry_id = je.id
left join public.chart_of_accounts as coa
  on coa.id = jel.account_id
left join public.fiscal_periods as fp
  on fp.id = je.fiscal_period_id
where je.status in ('posted', 'exported')
  and je.immutable_at is not null
group by
  je.organization_id,
  je.fiscal_period_id,
  fp.code,
  fp.label,
  je.source_channel,
  jel.account_id,
  coa.code,
  coa.name,
  coa.account_type,
  coa.chapter_code,
  coa.presentation_code,
  coa.statement_section,
  coalesce(coa.natural_balance, coa.normal_side);

alter view public.v_trial_balance set (security_invoker = true);

create or replace view public.v_open_items_outstanding as
with settlement_summary as (
  select
    lsl.open_item_id,
    count(*)::integer as settlement_count,
    round(coalesce(sum(lsl.amount), 0), 2) as settled_amount_linked,
    round(coalesce(sum(lsl.functional_amount), 0), 2) as settled_functional_amount_linked,
    max(lsl.settled_at) as last_settled_at
  from public.ledger_settlement_links as lsl
  group by lsl.open_item_id
)
select
  loi.organization_id,
  loi.id as open_item_id,
  loi.party_id,
  loi.counterparty_type,
  loi.counterparty_id,
  coalesce(p.display_name, p.legal_name, v.name, c.name) as counterparty_name,
  coalesce(p.tax_id_normalized, v.tax_id_normalized, c.tax_id_normalized) as counterparty_tax_id_normalized,
  loi.source_channel,
  loi.source_entity_type,
  loi.source_entity_id,
  loi.source_document_id,
  loi.document_role,
  loi.document_type,
  loi.issue_date,
  loi.due_date,
  case
    when loi.due_date is not null
      and loi.due_date < current_date
      and loi.outstanding_amount > 0
      then (current_date - loi.due_date)
    else 0
  end as days_overdue,
  loi.currency_code,
  loi.original_currency_code,
  loi.functional_currency_code,
  loi.fx_rate,
  loi.fx_rate_date,
  loi.fx_rate_source,
  loi.original_amount,
  loi.functional_amount,
  loi.settled_amount,
  loi.outstanding_amount,
  loi.status,
  loi.journal_entry_id as opening_journal_entry_id,
  opening_entry.entry_number as opening_entry_number,
  opening_entry.entry_date as opening_entry_date,
  loi.opening_journal_entry_line_id,
  coalesce(settlement_summary.settlement_count, 0) as settlement_count,
  coalesce(settlement_summary.settled_amount_linked, 0)::numeric(18,2) as settled_amount_linked,
  coalesce(settlement_summary.settled_functional_amount_linked, 0)::numeric(18,2) as settled_functional_amount_linked,
  settlement_summary.last_settled_at,
  coalesce((loi.metadata ->> 'residual_credit_balance')::boolean, false) as is_residual_credit_balance,
  loi.provider_managed,
  loi.source_hash,
  loi.created_at,
  loi.updated_at
from public.ledger_open_items as loi
left join public.parties as p
  on p.id = loi.party_id
left join public.vendors as v
  on loi.counterparty_type = 'vendor'
 and v.id = loi.counterparty_id
left join public.customers as c
  on loi.counterparty_type = 'customer'
 and c.id = loi.counterparty_id
left join public.journal_entries as opening_entry
  on opening_entry.id = loi.journal_entry_id
left join settlement_summary
  on settlement_summary.open_item_id = loi.id
where abs(coalesce(loi.outstanding_amount, 0)) > 0.009;

alter view public.v_open_items_outstanding set (security_invoker = true);

create or replace view public.v_balance_sheet as
select
  tb.organization_id,
  tb.fiscal_period_id,
  tb.fiscal_period_code,
  tb.fiscal_period_label,
  tb.account_id,
  tb.account_code,
  tb.account_name,
  tb.account_type,
  tb.chapter_code,
  tb.presentation_code,
  tb.statement_section,
  tb.natural_balance,
  case
    when tb.account_type = 'asset' then 'asset'
    when tb.account_type = 'liability' then 'liability'
    when tb.account_type = 'equity' then 'equity'
    else 'other'
  end as report_section,
  case
    when tb.account_type = 'asset' then tb.functional_balance
    else -1 * tb.functional_balance
  end as presentation_balance,
  tb.functional_balance as raw_functional_balance,
  case
    when tb.natural_balance = 'debit' then tb.functional_balance < 0
    when tb.natural_balance = 'credit' then tb.functional_balance > 0
    else false
  end as has_abnormal_balance
from public.v_trial_balance as tb
where tb.account_type in ('asset', 'liability', 'equity');

alter view public.v_balance_sheet set (security_invoker = true);

create or replace view public.v_income_statement as
select
  tb.organization_id,
  tb.fiscal_period_id,
  tb.fiscal_period_code,
  tb.fiscal_period_label,
  tb.account_id,
  tb.account_code,
  tb.account_name,
  tb.account_type,
  tb.chapter_code,
  tb.presentation_code,
  tb.statement_section,
  tb.natural_balance,
  case
    when tb.account_type = 'revenue' then 'revenue'
    when tb.account_type = 'expense' then 'expense'
    else 'other'
  end as report_section,
  case
    when tb.account_type = 'revenue' then -1 * tb.functional_balance
    else tb.functional_balance
  end as presentation_balance,
  tb.functional_balance as raw_functional_balance,
  case
    when tb.natural_balance = 'debit' then tb.functional_balance < 0
    when tb.natural_balance = 'credit' then tb.functional_balance > 0
    else false
  end as has_abnormal_balance
from public.v_trial_balance as tb
where tb.account_type in ('revenue', 'expense');

alter view public.v_income_statement set (security_invoker = true);
-- <<< db/schema/09_accounting_read_models.sql

-- >>> db/rls/supabase_rls_policies.sql
create or replace function public.is_active_member(p_org_id uuid)
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

create or replace function public.has_org_role(
  p_org_id uuid,
  p_allowed_roles public.member_role[]
)
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
      and om.role = any(p_allowed_roles)
  );
$$;

create or replace function public.is_org_creator(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations as o
    where o.id = p_org_id
      and o.created_by = auth.uid()
  );
$$;

create or replace function public.organization_has_members(p_org_id uuid)
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
  );
$$;

create or replace function public.can_bootstrap_org_owner(
  p_org_id uuid,
  p_user_id uuid,
  p_role public.member_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'authenticated'
    and p_user_id = auth.uid()
    and p_role = 'owner'::public.member_role
    and public.is_org_creator(p_org_id)
    and not public.organization_has_members(p_org_id);
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_aliases enable row level security;
alter table public.customers enable row level security;
alter table public.organization_concepts enable row level security;
alter table public.organization_concept_aliases enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_relations enable row level security;
alter table public.accounting_rules enable row level security;
alter table public.accounting_rule_events enable row level security;
alter table public.accounting_rule_simulations enable row level security;
alter table public.accounting_rule_ai_threads enable row level security;
alter table public.accounting_rule_ai_messages enable row level security;
alter table public.accounting_suggestions enable row level security;
alter table public.accounting_suggestion_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.normative_packages enable row level security;
alter table public.normative_documents enable row level security;
alter table public.tax_rules enable row level security;
alter table public.tax_periods enable row level security;
alter table public.tax_period_document_selections enable row level security;
alter table public.vat_runs enable row level security;
alter table public.exports enable row level security;
alter table public.api_clients enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.organization_integration_connections enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.integration_sync_cursors enable row level security;
alter table public.integration_raw_records enable row level security;
alter table public.document_source_refs enable row level security;
alter table public.integration_entity_links enable row level security;
alter table public.audit_log enable row level security;
alter table public.fiscal_periods enable row level security;
alter table public.close_check_runs enable row level security;
alter table public.close_check_results enable row level security;
alter table public.fiscal_period_transition_logs enable row level security;
alter table public.system_actors enable row level security;
alter table public.assistant_personas enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_runs enable row level security;
alter table public.assistant_run_evidence_refs enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_suggestions enable row level security;
alter table public.assistant_suggestion_evidence_refs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "organizations_select_member_or_creator" on public.organizations;
create policy "organizations_select_member_or_creator"
on public.organizations
for select
using (public.is_org_member(id));

drop policy if exists "organizations_insert_authenticated_creator" on public.organizations;

drop policy if exists "organizations_update_owner_admin" on public.organizations;
create policy "organizations_update_owner_admin"
on public.organizations
for update
using (
  public.has_org_role(
    id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
)
with check (
  public.has_org_role(
    id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "organizations_delete_owner_admin" on public.organizations;
create policy "organizations_delete_owner_admin"
on public.organizations
for delete
using (
  public.has_org_role(
    id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "organization_members_select_self_or_owner_admin" on public.organization_members;
drop policy if exists "organization_members_select_member" on public.organization_members;
create policy "organization_members_select_member"
on public.organization_members
for select
using (public.is_org_member(organization_id));

drop policy if exists "organization_members_insert_owner_admin_or_bootstrap" on public.organization_members;

drop policy if exists "organization_members_update_owner_admin" on public.organization_members;
create policy "organization_members_update_owner_admin"
on public.organization_members
for update
using (
  public.has_org_role(
    organization_id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "organization_members_delete_owner_admin" on public.organization_members;
create policy "organization_members_delete_owner_admin"
on public.organization_members
for delete
using (
  public.has_org_role(
    organization_id,
    array['owner'::public.member_role, 'admin'::public.member_role]
  )
);

drop policy if exists "chart_of_accounts_select_member" on public.chart_of_accounts;
create policy "chart_of_accounts_select_member"
on public.chart_of_accounts
for select
using (public.is_active_member(organization_id));

drop policy if exists "chart_of_accounts_insert_accounting_roles" on public.chart_of_accounts;
create policy "chart_of_accounts_insert_accounting_roles"
on public.chart_of_accounts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "chart_of_accounts_update_accounting_roles" on public.chart_of_accounts;
create policy "chart_of_accounts_update_accounting_roles"
on public.chart_of_accounts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "chart_of_accounts_delete_accounting_roles" on public.chart_of_accounts;
create policy "chart_of_accounts_delete_accounting_roles"
on public.chart_of_accounts
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vendors_select_member" on public.vendors;
create policy "vendors_select_member"
on public.vendors
for select
using (public.is_active_member(organization_id));

drop policy if exists "vendors_insert_accounting_roles" on public.vendors;
create policy "vendors_insert_accounting_roles"
on public.vendors
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vendors_update_accounting_roles" on public.vendors;
create policy "vendors_update_accounting_roles"
on public.vendors
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vendors_delete_accounting_roles" on public.vendors;
create policy "vendors_delete_accounting_roles"
on public.vendors
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vendor_aliases_select_member" on public.vendor_aliases;
create policy "vendor_aliases_select_member"
on public.vendor_aliases
for select
using (public.is_active_member(organization_id));

drop policy if exists "vendor_aliases_insert_accounting_roles" on public.vendor_aliases;
create policy "vendor_aliases_insert_accounting_roles"
on public.vendor_aliases
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vendor_aliases_update_accounting_roles" on public.vendor_aliases;
create policy "vendor_aliases_update_accounting_roles"
on public.vendor_aliases
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_concepts_select_member" on public.organization_concepts;
create policy "organization_concepts_select_member"
on public.organization_concepts
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_concepts_insert_accounting_roles" on public.organization_concepts;
create policy "organization_concepts_insert_accounting_roles"
on public.organization_concepts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_concepts_update_accounting_roles" on public.organization_concepts;
create policy "organization_concepts_update_accounting_roles"
on public.organization_concepts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_concept_aliases_select_member" on public.organization_concept_aliases;
create policy "organization_concept_aliases_select_member"
on public.organization_concept_aliases
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_concept_aliases_insert_accounting_roles" on public.organization_concept_aliases;
create policy "organization_concept_aliases_insert_accounting_roles"
on public.organization_concept_aliases
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_concept_aliases_update_accounting_roles" on public.organization_concept_aliases;
create policy "organization_concept_aliases_update_accounting_roles"
on public.organization_concept_aliases
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member"
on public.customers
for select
using (public.is_active_member(organization_id));

drop policy if exists "customers_insert_accounting_roles" on public.customers;
create policy "customers_insert_accounting_roles"
on public.customers
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "customers_update_accounting_roles" on public.customers;
create policy "customers_update_accounting_roles"
on public.customers
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "customers_delete_accounting_roles" on public.customers;
create policy "customers_delete_accounting_roles"
on public.customers
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member"
on public.documents
for select
using (public.is_active_member(organization_id));

drop policy if exists "documents_insert_document_roles" on public.documents;
create policy "documents_insert_document_roles"
on public.documents
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "documents_update_document_roles" on public.documents;
create policy "documents_update_document_roles"
on public.documents
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

do $$
begin
  if exists (
    select 1
    from pg_class as c
    join pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and pg_get_userbyid(c.relowner) = current_user
  ) then
    execute 'alter table storage.objects enable row level security';
    execute 'drop policy if exists "storage_documents_private_select_member" on storage.objects';
    execute '
      create policy "storage_documents_private_select_member"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = ''documents-private''
        and public.can_access_document_storage_object(bucket_id, name)
      )
    ';
    execute 'drop policy if exists "storage_documents_private_insert_uploader" on storage.objects';
    execute '
      create policy "storage_documents_private_insert_uploader"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = ''documents-private''
        and public.can_upload_document_storage_object(bucket_id, name)
      )
    ';
  else
    raise notice 'Skipping storage.objects policies because current role % does not own storage.objects.', current_user;
  end if;
end
$$;

drop policy if exists "document_extractions_select_member" on public.document_extractions;
create policy "document_extractions_select_member"
on public.document_extractions
for select
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.is_active_member(d.organization_id)
  )
);

drop policy if exists "document_extractions_insert_document_roles" on public.document_extractions;
create policy "document_extractions_insert_document_roles"
on public.document_extractions
for insert
with check (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.has_org_role(
        d.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_extractions_update_document_roles" on public.document_extractions;
create policy "document_extractions_update_document_roles"
on public.document_extractions
for update
using (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.has_org_role(
        d.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.documents as d
    where d.id = document_id
      and public.has_org_role(
        d.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_relations_select_member" on public.document_relations;
create policy "document_relations_select_member"
on public.document_relations
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_relations_insert_document_roles" on public.document_relations;
create policy "document_relations_insert_document_roles"
on public.document_relations
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_relations_update_document_roles" on public.document_relations;
create policy "document_relations_update_document_roles"
on public.document_relations
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_relations_delete_document_roles" on public.document_relations;
create policy "document_relations_delete_document_roles"
on public.document_relations
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rules_select_member" on public.accounting_rules;
create policy "accounting_rules_select_member"
on public.accounting_rules
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_rules_insert_accounting_roles" on public.accounting_rules;
create policy "accounting_rules_insert_accounting_roles"
on public.accounting_rules
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rules_update_accounting_roles" on public.accounting_rules;
create policy "accounting_rules_update_accounting_roles"
on public.accounting_rules
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_events_select_member" on public.accounting_rule_events;
create policy "accounting_rule_events_select_member"
on public.accounting_rule_events
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_rule_events_insert_accounting_roles" on public.accounting_rule_events;
create policy "accounting_rule_events_insert_accounting_roles"
on public.accounting_rule_events
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_simulations_select_member" on public.accounting_rule_simulations;
create policy "accounting_rule_simulations_select_member"
on public.accounting_rule_simulations
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_rule_simulations_insert_accounting_roles" on public.accounting_rule_simulations;
create policy "accounting_rule_simulations_insert_accounting_roles"
on public.accounting_rule_simulations
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_threads_select_consultive_roles" on public.accounting_rule_ai_threads;
create policy "accounting_rule_ai_threads_select_consultive_roles"
on public.accounting_rule_ai_threads
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_threads_insert_consultive_roles" on public.accounting_rule_ai_threads;
create policy "accounting_rule_ai_threads_insert_consultive_roles"
on public.accounting_rule_ai_threads
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_threads_update_consultive_roles" on public.accounting_rule_ai_threads;
create policy "accounting_rule_ai_threads_update_consultive_roles"
on public.accounting_rule_ai_threads
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "accounting_rule_ai_messages_select_consultive_roles" on public.accounting_rule_ai_messages;
create policy "accounting_rule_ai_messages_select_consultive_roles"
on public.accounting_rule_ai_messages
for select
using (
  exists (
    select 1
    from public.accounting_rule_ai_threads as t
    where t.id = thread_id
      and public.has_org_role(
        t.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_rule_ai_messages_insert_consultive_roles" on public.accounting_rule_ai_messages;
create policy "accounting_rule_ai_messages_insert_consultive_roles"
on public.accounting_rule_ai_messages
for insert
with check (
  exists (
    select 1
    from public.accounting_rule_ai_threads as t
    where t.id = thread_id
      and public.has_org_role(
        t.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_suggestions_select_member" on public.accounting_suggestions;
create policy "accounting_suggestions_select_member"
on public.accounting_suggestions
for select
using (public.is_active_member(organization_id));

drop policy if exists "accounting_suggestions_insert_accounting_roles" on public.accounting_suggestions;
create policy "accounting_suggestions_insert_accounting_roles"
on public.accounting_suggestions
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "accounting_suggestions_update_accounting_roles" on public.accounting_suggestions;
create policy "accounting_suggestions_update_accounting_roles"
on public.accounting_suggestions
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "accounting_suggestion_lines_select_member" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_select_member"
on public.accounting_suggestion_lines
for select
using (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.is_active_member(s.organization_id)
  )
);

drop policy if exists "accounting_suggestion_lines_insert_accounting_roles" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_insert_accounting_roles"
on public.accounting_suggestion_lines
for insert
with check (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_suggestion_lines_update_accounting_roles" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_update_accounting_roles"
on public.accounting_suggestion_lines
for update
using (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "accounting_suggestion_lines_delete_accounting_roles" on public.accounting_suggestion_lines;
create policy "accounting_suggestion_lines_delete_accounting_roles"
on public.accounting_suggestion_lines
for delete
using (
  exists (
    select 1
    from public.accounting_suggestions as s
    where s.id = suggestion_id
      and public.has_org_role(
        s.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "journal_entries_select_member" on public.journal_entries;
create policy "journal_entries_select_member"
on public.journal_entries
for select
using (public.is_active_member(organization_id));

drop policy if exists "journal_entries_insert_accounting_roles" on public.journal_entries;
create policy "journal_entries_insert_accounting_roles"
on public.journal_entries
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "journal_entries_update_accounting_roles" on public.journal_entries;
create policy "journal_entries_update_accounting_roles"
on public.journal_entries
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "journal_entry_lines_select_member" on public.journal_entry_lines;
create policy "journal_entry_lines_select_member"
on public.journal_entry_lines
for select
using (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.is_active_member(je.organization_id)
  )
);

drop policy if exists "journal_entry_lines_insert_accounting_roles" on public.journal_entry_lines;
create policy "journal_entry_lines_insert_accounting_roles"
on public.journal_entry_lines
for insert
with check (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "journal_entry_lines_update_accounting_roles" on public.journal_entry_lines;
create policy "journal_entry_lines_update_accounting_roles"
on public.journal_entry_lines
for update
using (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "journal_entry_lines_delete_accounting_roles" on public.journal_entry_lines;
create policy "journal_entry_lines_delete_accounting_roles"
on public.journal_entry_lines
for delete
using (
  exists (
    select 1
    from public.journal_entries as je
    where je.id = journal_entry_id
      and public.has_org_role(
        je.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "normative_packages_select_authenticated" on public.normative_packages;
create policy "normative_packages_select_authenticated"
on public.normative_packages
for select
using (auth.role() = 'authenticated');

drop policy if exists "normative_documents_select_authenticated" on public.normative_documents;
create policy "normative_documents_select_authenticated"
on public.normative_documents
for select
using (auth.role() = 'authenticated');

drop policy if exists "tax_rules_select_visible" on public.tax_rules;
create policy "tax_rules_select_visible"
on public.tax_rules
for select
using (
  (
    organization_id is not null
    and public.is_active_member(organization_id)
  )
  or (
    organization_id is null
    and auth.role() = 'authenticated'
  )
);

drop policy if exists "tax_rules_insert_accounting_roles" on public.tax_rules;
create policy "tax_rules_insert_accounting_roles"
on public.tax_rules
for insert
with check (
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_rules_update_accounting_roles" on public.tax_rules;
create policy "tax_rules_update_accounting_roles"
on public.tax_rules
for update
using (
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_rules_delete_accounting_roles" on public.tax_rules;
create policy "tax_rules_delete_accounting_roles"
on public.tax_rules
for delete
using (
  organization_id is not null
  and public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_periods_select_member" on public.tax_periods;
create policy "tax_periods_select_member"
on public.tax_periods
for select
using (public.is_active_member(organization_id));

drop policy if exists "tax_periods_insert_accounting_roles" on public.tax_periods;
create policy "tax_periods_insert_accounting_roles"
on public.tax_periods
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_periods_update_accounting_roles" on public.tax_periods;
create policy "tax_periods_update_accounting_roles"
on public.tax_periods
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vat_runs_select_member" on public.vat_runs;
create policy "vat_runs_select_member"
on public.vat_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "vat_runs_insert_accounting_roles" on public.vat_runs;
create policy "vat_runs_insert_accounting_roles"
on public.vat_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_period_document_selections_select_member" on public.tax_period_document_selections;
create policy "tax_period_document_selections_select_member"
on public.tax_period_document_selections
for select
using (public.is_active_member(organization_id));

drop policy if exists "tax_period_document_selections_insert_accounting_roles" on public.tax_period_document_selections;
create policy "tax_period_document_selections_insert_accounting_roles"
on public.tax_period_document_selections
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "tax_period_document_selections_update_accounting_roles" on public.tax_period_document_selections;
create policy "tax_period_document_selections_update_accounting_roles"
on public.tax_period_document_selections
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "vat_runs_update_accounting_roles" on public.vat_runs;
create policy "vat_runs_update_accounting_roles"
on public.vat_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "exports_select_member" on public.exports;
create policy "exports_select_member"
on public.exports
for select
using (public.is_active_member(organization_id));

drop policy if exists "exports_insert_accounting_roles" on public.exports;
create policy "exports_insert_accounting_roles"
on public.exports
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "exports_update_accounting_roles" on public.exports;
create policy "exports_update_accounting_roles"
on public.exports
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_select_integration_roles" on public.api_clients;
create policy "api_clients_select_integration_roles"
on public.api_clients
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_insert_integration_roles" on public.api_clients;
create policy "api_clients_insert_integration_roles"
on public.api_clients
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_update_integration_roles" on public.api_clients;
create policy "api_clients_update_integration_roles"
on public.api_clients
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_clients_delete_integration_roles" on public.api_clients;
create policy "api_clients_delete_integration_roles"
on public.api_clients
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "api_keys_select_integration_roles" on public.api_keys;
create policy "api_keys_select_integration_roles"
on public.api_keys
for select
using (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "api_keys_insert_integration_roles" on public.api_keys;
create policy "api_keys_insert_integration_roles"
on public.api_keys
for insert
with check (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "api_keys_update_integration_roles" on public.api_keys;
create policy "api_keys_update_integration_roles"
on public.api_keys
for update
using (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "api_keys_delete_integration_roles" on public.api_keys;
create policy "api_keys_delete_integration_roles"
on public.api_keys
for delete
using (
  exists (
    select 1
    from public.api_clients as ac
    where ac.id = api_client_id
      and public.has_org_role(
        ac.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'developer'::public.member_role
        ]
      )
  )
);

drop policy if exists "webhook_subscriptions_select_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_select_integration_roles"
on public.webhook_subscriptions
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "webhook_subscriptions_insert_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_insert_integration_roles"
on public.webhook_subscriptions
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "webhook_subscriptions_update_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_update_integration_roles"
on public.webhook_subscriptions
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "webhook_subscriptions_delete_integration_roles" on public.webhook_subscriptions;
create policy "webhook_subscriptions_delete_integration_roles"
on public.webhook_subscriptions
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_select_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_select_integration_roles"
on public.organization_integration_connections
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_insert_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_insert_integration_roles"
on public.organization_integration_connections
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_update_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_update_integration_roles"
on public.organization_integration_connections
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_integration_connections_delete_integration_roles" on public.organization_integration_connections;
create policy "organization_integration_connections_delete_integration_roles"
on public.organization_integration_connections
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_runs_select_member" on public.integration_sync_runs;
create policy "integration_sync_runs_select_member"
on public.integration_sync_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_sync_runs_insert_processing_roles" on public.integration_sync_runs;
create policy "integration_sync_runs_insert_processing_roles"
on public.integration_sync_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_runs_update_processing_roles" on public.integration_sync_runs;
create policy "integration_sync_runs_update_processing_roles"
on public.integration_sync_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_cursors_select_member" on public.integration_sync_cursors;
create policy "integration_sync_cursors_select_member"
on public.integration_sync_cursors
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_sync_cursors_upsert_processing_roles" on public.integration_sync_cursors;
create policy "integration_sync_cursors_upsert_processing_roles"
on public.integration_sync_cursors
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_sync_cursors_update_processing_roles" on public.integration_sync_cursors;
create policy "integration_sync_cursors_update_processing_roles"
on public.integration_sync_cursors
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_raw_records_select_member" on public.integration_raw_records;
create policy "integration_raw_records_select_member"
on public.integration_raw_records
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_raw_records_insert_processing_roles" on public.integration_raw_records;
create policy "integration_raw_records_insert_processing_roles"
on public.integration_raw_records
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_raw_records_update_processing_roles" on public.integration_raw_records;
create policy "integration_raw_records_update_processing_roles"
on public.integration_raw_records
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "document_source_refs_select_member" on public.document_source_refs;
create policy "document_source_refs_select_member"
on public.document_source_refs
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_source_refs_insert_processing_roles" on public.document_source_refs;
create policy "document_source_refs_insert_processing_roles"
on public.document_source_refs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "document_source_refs_update_processing_roles" on public.document_source_refs;
create policy "document_source_refs_update_processing_roles"
on public.document_source_refs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "integration_entity_links_select_member" on public.integration_entity_links;
create policy "integration_entity_links_select_member"
on public.integration_entity_links
for select
using (public.is_active_member(organization_id));

drop policy if exists "integration_entity_links_insert_accounting_roles" on public.integration_entity_links;
create policy "integration_entity_links_insert_accounting_roles"
on public.integration_entity_links
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "integration_entity_links_update_accounting_roles" on public.integration_entity_links;
create policy "integration_entity_links_update_accounting_roles"
on public.integration_entity_links
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "integration_entity_links_delete_integration_roles" on public.integration_entity_links;
create policy "integration_entity_links_delete_integration_roles"
on public.integration_entity_links
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

alter table public.organization_cfe_email_connections enable row level security;

drop policy if exists "organization_cfe_email_connections_select_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_select_scoped"
on public.organization_cfe_email_connections
for select
using (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_cfe_email_connections_insert_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_insert_scoped"
on public.organization_cfe_email_connections
for insert
with check (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_cfe_email_connections_update_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_update_scoped"
on public.organization_cfe_email_connections
for update
using (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
)
with check (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "organization_cfe_email_connections_delete_scoped" on public.organization_cfe_email_connections;
create policy "organization_cfe_email_connections_delete_scoped"
on public.organization_cfe_email_connections
for delete
using (
  (
    user_id = auth.uid()
    and public.is_active_member(organization_id)
  )
  or public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'developer'::public.member_role
    ]
  )
);

drop policy if exists "audit_log_select_member" on public.audit_log;
create policy "audit_log_select_member"
on public.audit_log
for select
using (
  organization_id is not null
  and public.is_active_member(organization_id)
);

drop policy if exists "fiscal_periods_select_member" on public.fiscal_periods;
create policy "fiscal_periods_select_member"
on public.fiscal_periods
for select
using (public.is_active_member(organization_id));

drop policy if exists "fiscal_periods_insert_close_roles" on public.fiscal_periods;
create policy "fiscal_periods_insert_close_roles"
on public.fiscal_periods
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "fiscal_periods_update_close_roles" on public.fiscal_periods;
create policy "fiscal_periods_update_close_roles"
on public.fiscal_periods
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "close_check_runs_select_member" on public.close_check_runs;
create policy "close_check_runs_select_member"
on public.close_check_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "close_check_runs_insert_close_roles" on public.close_check_runs;
create policy "close_check_runs_insert_close_roles"
on public.close_check_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "close_check_results_select_member" on public.close_check_results;
create policy "close_check_results_select_member"
on public.close_check_results
for select
using (
  exists (
    select 1
    from public.close_check_runs as ccr
    where ccr.id = close_check_run_id
      and public.is_active_member(ccr.organization_id)
  )
);

drop policy if exists "close_check_results_insert_close_roles" on public.close_check_results;
create policy "close_check_results_insert_close_roles"
on public.close_check_results
for insert
with check (
  exists (
    select 1
    from public.close_check_runs as ccr
    where ccr.id = close_check_run_id
      and public.has_org_role(
        ccr.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role
        ]
      )
  )
);

drop policy if exists "fiscal_period_transition_logs_select_member" on public.fiscal_period_transition_logs;
create policy "fiscal_period_transition_logs_select_member"
on public.fiscal_period_transition_logs
for select
using (public.is_active_member(organization_id));

drop policy if exists "fiscal_period_transition_logs_insert_close_roles" on public.fiscal_period_transition_logs;
create policy "fiscal_period_transition_logs_insert_close_roles"
on public.fiscal_period_transition_logs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role
    ]
  )
);

drop policy if exists "system_actors_select_authenticated" on public.system_actors;
create policy "system_actors_select_authenticated"
on public.system_actors
for select
using (auth.role() = 'authenticated');

drop policy if exists "assistant_personas_select_authenticated" on public.assistant_personas;
create policy "assistant_personas_select_authenticated"
on public.assistant_personas
for select
using (auth.role() = 'authenticated');

drop policy if exists "assistant_threads_select_consultive_roles" on public.assistant_threads;
create policy "assistant_threads_select_consultive_roles"
on public.assistant_threads
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "assistant_threads_insert_consultive_roles" on public.assistant_threads;
create policy "assistant_threads_insert_consultive_roles"
on public.assistant_threads
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "assistant_threads_update_consultive_roles" on public.assistant_threads;
create policy "assistant_threads_update_consultive_roles"
on public.assistant_threads
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "assistant_runs_select_member" on public.assistant_runs;
create policy "assistant_runs_select_member"
on public.assistant_runs
for select
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "assistant_runs_insert_processing_roles" on public.assistant_runs;
create policy "assistant_runs_insert_processing_roles"
on public.assistant_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "assistant_run_evidence_refs_select_member" on public.assistant_run_evidence_refs;
create policy "assistant_run_evidence_refs_select_member"
on public.assistant_run_evidence_refs
for select
using (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_run_evidence_refs_insert_processing_roles" on public.assistant_run_evidence_refs;
create policy "assistant_run_evidence_refs_insert_processing_roles"
on public.assistant_run_evidence_refs
for insert
with check (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_messages_select_consultive_roles" on public.assistant_messages;
create policy "assistant_messages_select_consultive_roles"
on public.assistant_messages
for select
using (
  exists (
    select 1
    from public.assistant_threads as at
    where at.id = thread_id
      and public.has_org_role(
        at.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_messages_insert_consultive_roles" on public.assistant_messages;
create policy "assistant_messages_insert_consultive_roles"
on public.assistant_messages
for insert
with check (
  exists (
    select 1
    from public.assistant_threads as at
    where at.id = thread_id
      and public.has_org_role(
        at.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestions_select_member" on public.assistant_suggestions;
create policy "assistant_suggestions_select_member"
on public.assistant_suggestions
for select
using (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestions_insert_processing_roles" on public.assistant_suggestions;
create policy "assistant_suggestions_insert_processing_roles"
on public.assistant_suggestions
for insert
with check (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestions_update_processing_roles" on public.assistant_suggestions;
create policy "assistant_suggestions_update_processing_roles"
on public.assistant_suggestions
for update
using (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.assistant_runs as ar
    where ar.id = assistant_run_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestion_evidence_refs_select_consultive_roles" on public.assistant_suggestion_evidence_refs;
create policy "assistant_suggestion_evidence_refs_select_consultive_roles"
on public.assistant_suggestion_evidence_refs
for select
using (
  exists (
    select 1
    from public.assistant_suggestions as sug
    join public.assistant_runs as ar
      on ar.id = sug.assistant_run_id
    where sug.id = assistant_suggestion_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

drop policy if exists "assistant_suggestion_evidence_refs_insert_consultive_roles" on public.assistant_suggestion_evidence_refs;
create policy "assistant_suggestion_evidence_refs_insert_consultive_roles"
on public.assistant_suggestion_evidence_refs
for insert
with check (
  exists (
    select 1
    from public.assistant_suggestions as sug
    join public.assistant_runs as ar
      on ar.id = sug.assistant_run_id
    where sug.id = assistant_suggestion_id
      and public.has_org_role(
        ar.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'admin_processing'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role
        ]
      )
  )
);

alter table public.organization_profile_versions enable row level security;
alter table public.organization_rule_snapshots enable row level security;
alter table public.document_processing_runs enable row level security;
alter table public.document_field_candidates enable row level security;
alter table public.document_classification_candidates enable row level security;
alter table public.document_drafts enable row level security;
alter table public.document_draft_steps enable row level security;
alter table public.document_draft_autosaves enable row level security;
alter table public.document_line_items enable row level security;
alter table public.document_accounting_contexts enable row level security;
alter table public.document_confirmations enable row level security;
alter table public.document_revisions enable row level security;
alter table public.document_invoice_identities enable row level security;
alter table public.normative_sources enable row level security;
alter table public.normative_items enable row level security;
alter table public.normative_update_runs enable row level security;

drop policy if exists "organization_profile_versions_select_member" on public.organization_profile_versions;
create policy "organization_profile_versions_select_member"
on public.organization_profile_versions
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_profile_versions_insert_profile_roles" on public.organization_profile_versions;
create policy "organization_profile_versions_insert_profile_roles"
on public.organization_profile_versions
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_profile_versions_update_profile_roles" on public.organization_profile_versions;
create policy "organization_profile_versions_update_profile_roles"
on public.organization_profile_versions
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_rule_snapshots_select_member" on public.organization_rule_snapshots;
create policy "organization_rule_snapshots_select_member"
on public.organization_rule_snapshots
for select
using (public.is_active_member(organization_id));

drop policy if exists "organization_rule_snapshots_insert_profile_roles" on public.organization_rule_snapshots;
create policy "organization_rule_snapshots_insert_profile_roles"
on public.organization_rule_snapshots
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "organization_rule_snapshots_update_profile_roles" on public.organization_rule_snapshots;
create policy "organization_rule_snapshots_update_profile_roles"
on public.organization_rule_snapshots
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "document_processing_runs_select_member" on public.document_processing_runs;
create policy "document_processing_runs_select_member"
on public.document_processing_runs
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_processing_runs_insert_document_roles" on public.document_processing_runs;
create policy "document_processing_runs_insert_document_roles"
on public.document_processing_runs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_processing_runs_update_document_roles" on public.document_processing_runs;
create policy "document_processing_runs_update_document_roles"
on public.document_processing_runs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_field_candidates_select_member" on public.document_field_candidates;
create policy "document_field_candidates_select_member"
on public.document_field_candidates
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_field_candidates_insert_document_roles" on public.document_field_candidates;
create policy "document_field_candidates_insert_document_roles"
on public.document_field_candidates
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_classification_candidates_select_member" on public.document_classification_candidates;
create policy "document_classification_candidates_select_member"
on public.document_classification_candidates
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_classification_candidates_insert_document_roles" on public.document_classification_candidates;
create policy "document_classification_candidates_insert_document_roles"
on public.document_classification_candidates
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_drafts_select_member" on public.document_drafts;
create policy "document_drafts_select_member"
on public.document_drafts
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_drafts_insert_document_roles" on public.document_drafts;
create policy "document_drafts_insert_document_roles"
on public.document_drafts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_drafts_update_document_roles" on public.document_drafts;
create policy "document_drafts_update_document_roles"
on public.document_drafts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_draft_steps_select_member" on public.document_draft_steps;
create policy "document_draft_steps_select_member"
on public.document_draft_steps
for select
using (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.is_active_member(dd.organization_id)
  )
);

drop policy if exists "document_draft_steps_insert_document_roles" on public.document_draft_steps;
create policy "document_draft_steps_insert_document_roles"
on public.document_draft_steps
for insert
with check (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_draft_steps_update_document_roles" on public.document_draft_steps;
create policy "document_draft_steps_update_document_roles"
on public.document_draft_steps
for update
using (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
)
with check (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_draft_autosaves_select_member" on public.document_draft_autosaves;
create policy "document_draft_autosaves_select_member"
on public.document_draft_autosaves
for select
using (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.is_active_member(dd.organization_id)
  )
);

drop policy if exists "document_draft_autosaves_insert_document_roles" on public.document_draft_autosaves;
create policy "document_draft_autosaves_insert_document_roles"
on public.document_draft_autosaves
for insert
with check (
  exists (
    select 1
    from public.document_drafts as dd
    where dd.id = draft_id
      and public.has_org_role(
        dd.organization_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'accountant'::public.member_role,
          'reviewer'::public.member_role,
          'operator'::public.member_role
        ]
      )
  )
);

drop policy if exists "document_line_items_select_member" on public.document_line_items;
create policy "document_line_items_select_member"
on public.document_line_items
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_line_items_insert_document_roles" on public.document_line_items;
create policy "document_line_items_insert_document_roles"
on public.document_line_items
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_line_items_update_document_roles" on public.document_line_items;
create policy "document_line_items_update_document_roles"
on public.document_line_items
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_accounting_contexts_select_member" on public.document_accounting_contexts;
create policy "document_accounting_contexts_select_member"
on public.document_accounting_contexts
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_accounting_contexts_insert_document_roles" on public.document_accounting_contexts;
create policy "document_accounting_contexts_insert_document_roles"
on public.document_accounting_contexts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_accounting_contexts_update_document_roles" on public.document_accounting_contexts;
create policy "document_accounting_contexts_update_document_roles"
on public.document_accounting_contexts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_confirmations_select_member" on public.document_confirmations;
create policy "document_confirmations_select_member"
on public.document_confirmations
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_confirmations_insert_confirmation_roles" on public.document_confirmations;
create policy "document_confirmations_insert_confirmation_roles"
on public.document_confirmations
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role
    ]
  )
);

drop policy if exists "document_revisions_select_member" on public.document_revisions;
create policy "document_revisions_select_member"
on public.document_revisions
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_revisions_insert_document_roles" on public.document_revisions;
create policy "document_revisions_insert_document_roles"
on public.document_revisions
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_revisions_update_document_roles" on public.document_revisions;
create policy "document_revisions_update_document_roles"
on public.document_revisions
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_invoice_identities_select_member" on public.document_invoice_identities;
create policy "document_invoice_identities_select_member"
on public.document_invoice_identities
for select
using (public.is_active_member(organization_id));

drop policy if exists "document_invoice_identities_insert_document_roles" on public.document_invoice_identities;
create policy "document_invoice_identities_insert_document_roles"
on public.document_invoice_identities
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "document_invoice_identities_update_document_roles" on public.document_invoice_identities;
create policy "document_invoice_identities_update_document_roles"
on public.document_invoice_identities
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "normative_sources_select_authenticated" on public.normative_sources;
create policy "normative_sources_select_authenticated"
on public.normative_sources
for select
using (auth.role() = 'authenticated');

drop policy if exists "normative_items_select_authenticated" on public.normative_items;
create policy "normative_items_select_authenticated"
on public.normative_items
for select
using (auth.role() = 'authenticated');

drop policy if exists "normative_update_runs_select_authenticated" on public.normative_update_runs;
create policy "normative_update_runs_select_authenticated"
on public.normative_update_runs
for select
using (auth.role() = 'authenticated');
-- <<< db/rls/supabase_rls_policies.sql
