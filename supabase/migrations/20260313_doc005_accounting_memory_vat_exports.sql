alter table public.vendors
  add column if not exists tax_id_normalized text,
  add column if not exists name_normalized text,
  add column if not exists default_operation_category text;

update public.vendors
set
  tax_id_normalized = nullif(regexp_replace(coalesce(tax_id, ''), '\D+', '', 'g'), ''),
  name_normalized = nullif(
    lower(
      trim(
        regexp_replace(
          translate(
            coalesce(name, ''),
            'ÁÀÂÄáàâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖóòôöÚÙÛÜúùûüÑñ',
            'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'
          ),
          '\s+',
          ' ',
          'g'
        )
      )
    ),
    ''
  ),
  updated_at = now()
where tax_id is not null
   or name is not null;

create unique index if not exists idx_vendors_org_tax_id_normalized
  on public.vendors (organization_id, tax_id_normalized)
  where tax_id_normalized is not null;

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

create table if not exists public.accounting_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope text not null,
  document_id uuid references public.documents(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  concept_id uuid references public.organization_concepts(id) on delete cascade,
  document_role public.document_direction not null default 'purchase',
  account_id uuid not null references public.chart_of_accounts(id),
  vat_profile_json jsonb not null default '{}'::jsonb,
  operation_category text,
  linked_operation_type text,
  priority integer not null default 0,
  source text not null default 'manual',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_accounting_rules_org_scope_active
  on public.accounting_rules (organization_id, scope, is_active, priority desc);

create index if not exists idx_accounting_rules_org_vendor_concept
  on public.accounting_rules (organization_id, vendor_id, concept_id, document_role);

alter table public.vat_runs
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id),
  add column if not exists locked_at timestamptz,
  add column if not exists reopened_by uuid references public.profiles(id),
  add column if not exists reopened_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_vat_runs_org_period_version
  on public.vat_runs (organization_id, period_id, version_no);

alter table public.exports
  add column if not exists export_scope text not null default 'vat_period',
  add column if not exists target_id uuid,
  add column if not exists artifact_filename text,
  add column if not exists artifact_mime_type text,
  add column if not exists failure_message text,
  add column if not exists downloaded_at timestamptz,
  add column if not exists expires_at timestamptz;

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

alter table public.vendor_aliases enable row level security;
alter table public.organization_concepts enable row level security;
alter table public.organization_concept_aliases enable row level security;
alter table public.accounting_rules enable row level security;
alter table public.document_line_items enable row level security;
alter table public.document_accounting_contexts enable row level security;

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
