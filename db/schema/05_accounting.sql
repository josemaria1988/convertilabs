create table if not exists public.accounting_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
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
  times_reused integer not null default 0,
  times_corrected integer not null default 0,
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

create index if not exists idx_accounting_rules_org_status_scope
  on public.accounting_rules (organization_id, status, scope, is_active, priority desc);

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

create index if not exists idx_journal_entries_org_date
  on public.journal_entries (organization_id, entry_date);

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

create table if not exists public.ledger_open_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  counterparty_type text not null,
  counterparty_id uuid,
  source_document_id uuid not null references public.documents(id) on delete cascade,
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

create index if not exists idx_ledger_settlement_links_org_open_item
  on public.ledger_settlement_links (organization_id, open_item_id, settled_at desc);
