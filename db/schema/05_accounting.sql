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

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid references public.documents(id) on delete set null,
  source_suggestion_id uuid references public.accounting_suggestions(id) on delete set null,
  entry_date date not null,
  period_id uuid,
  status public.entry_status not null default 'draft',
  currency_code text not null default 'UYU',
  reference text,
  description text,
  total_debit numeric(18,2) not null default 0,
  total_credit numeric(18,2) not null default 0,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_journal_entries_org_date
  on public.journal_entries (organization_id, entry_date);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null,
  account_id uuid not null references public.chart_of_accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  tax_tag text,
  vendor_id uuid references public.vendors(id),
  customer_id uuid references public.customers(id),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  unique (journal_entry_id, line_no)
);
