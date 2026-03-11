# Convertilabs Supabase Schema Draft

**Status:** Draft v0.1  
**Goal:** Define the first practical Postgres/Supabase schema for a multi-tenant accounting workflow product.

## Canonical SQL Source

The canonical executable SQL for this schema now lives under `/db`.

Recommended apply order:
- `db/schema/00_extensions.sql`
- `db/schema/01_enums.sql`
- `db/schema/02_identity_and_tenants.sql`
- `db/schema/03_master_data.sql`
- `db/schema/04_documents.sql`
- `db/schema/05_accounting.sql`
- `db/schema/06_tax_and_rules.sql`
- `db/schema/07_integrations_and_audit.sql`
- `db/rls/supabase_rls_policies.sql`

This document remains the design draft and schema rationale. If this markdown and `/db` ever diverge, update `/db` first and then sync this document.

## Design Principles

1. All business data is organization-scoped.
2. Original documents are immutable.
3. Extracted and suggested data is versioned.
4. Accounting entries are balanced and auditable.
5. Tax rules are explicit, time-bound, and traceable.
6. Public API readiness is easier if internal IDs and statuses are stable from day one.

## Recommended Extensions

```sql
create extension if not exists pgcrypto;
```

## Recommended Enums

```sql
create type public.member_role as enum ('owner', 'admin', 'accountant', 'reviewer', 'operator', 'developer', 'viewer');
create type public.document_direction as enum ('purchase', 'sale', 'other');
create type public.document_status as enum ('uploaded', 'queued', 'extracting', 'extracted', 'classified', 'needs_review', 'approved', 'rejected', 'duplicate', 'archived', 'uploading', 'error');
create type public.suggestion_status as enum ('drafted', 'needs_review', 'ready_for_review', 'approved', 'rejected', 'superseded');
create type public.entry_status as enum ('draft', 'reviewed', 'posted', 'exported', 'void');
create type public.tax_type as enum ('VAT', 'IRAE', 'IP');
create type public.tax_period_status as enum ('open', 'review', 'closed', 'locked');
create type public.export_status as enum ('queued', 'generating', 'generated', 'downloaded', 'failed', 'expired');
create type public.rule_scope as enum ('global', 'package', 'organization');
create type public.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense', 'memo');
create type public.normal_side as enum ('debit', 'credit');
```

## Core Tables Overview

### Identity and tenant tables
- `profiles`
- `organizations`
- `organization_members`

### Master data
- `chart_of_accounts`
- `vendors`
- `customers`

### Document processing
- `documents`
- `document_extractions`
- `document_relations`

### Accounting
- `accounting_suggestions`
- `accounting_suggestion_lines`
- `journal_entries`
- `journal_entry_lines`

### Tax and rules
- `normative_packages`
- `normative_documents`
- `tax_rules`
- `tax_periods`
- `vat_runs`

### Integration and audit
- `exports`
- `api_clients`
- `api_keys`
- `webhook_subscriptions`
- `audit_log`

## Table Drafts

## 1. profiles

Maps `auth.users` to application metadata.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
```

## 2. organizations

```sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code text not null default 'UY',
  base_currency text not null default 'UYU',
  legal_entity_type text,
  tax_id text,
  default_locale text not null default 'es-UY',
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 3. organization_members

```sql
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
```

## 4. chart_of_accounts

```sql
create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type public.account_type not null,
  normal_side public.normal_side not null,
  is_postable boolean not null default true,
  parent_id uuid references public.chart_of_accounts(id),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
```

## 5. vendors

```sql
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  default_account_id uuid references public.chart_of_accounts(id),
  default_payment_account_id uuid references public.chart_of_accounts(id),
  default_tax_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 6. customers

Useful for sales-side support and future expansions.

```sql
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 7. documents

```sql
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction public.document_direction not null default 'purchase',
  document_type text,
  status public.document_status not null default 'uploaded',
  storage_bucket text not null default 'documents-private',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  file_hash text,
  upload_source text not null default 'web',
  uploaded_by uuid references public.profiles(id),
  document_date date,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_documents_org_status on public.documents (organization_id, status);
create index if not exists idx_documents_file_hash on public.documents (organization_id, file_hash);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_documents_status on public.documents (status);
create index if not exists idx_documents_org_created_at on public.documents (organization_id, created_at desc);
```

## 8. document_extractions

One document can have multiple extraction versions.

```sql
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
create index if not exists idx_document_extractions_active on public.document_extractions (document_id, is_active);
```

## 9. document_relations

Supports linking costs to operations, sales, or original documents.

```sql
create table if not exists public.document_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid references public.documents(id) on delete cascade,
  relation_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## 10. accounting_suggestions

```sql
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
create index if not exists idx_accounting_suggestions_org_doc on public.accounting_suggestions (organization_id, document_id);
```

## 11. accounting_suggestion_lines

```sql
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
```

## 12. journal_entries

```sql
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
create index if not exists idx_journal_entries_org_date on public.journal_entries (organization_id, entry_date);
```

## 13. journal_entry_lines

```sql
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
```

## 14. normative_packages

Manual yearly package loading in early versions.

```sql
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
```

## 15. normative_documents

```sql
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
```

## 16. tax_rules

```sql
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
create index if not exists idx_tax_rules_scope_active on public.tax_rules (tax_type, scope, active);
```

## 17. tax_periods

```sql
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
```

## 18. vat_runs

```sql
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
  adjustments numeric(18,2) not null default 0,
  net_vat_payable numeric(18,2) not null default 0,
  version_no integer not null default 1,
  created_by uuid references public.profiles(id),
  finalized_by uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 19. exports

```sql
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_type text not null,
  target_system text not null,
  status public.export_status not null default 'queued',
  storage_bucket text not null default 'exports-private',
  storage_path text,
  payload_json jsonb not null default '{}'::jsonb,
  checksum text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 20. api_clients

```sql
create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## 21. api_keys

```sql
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
```

## 22. webhook_subscriptions

```sql
create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_url text not null,
  secret_hash text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

## 23. audit_log

```sql
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
create index if not exists idx_audit_log_org_created on public.audit_log (organization_id, created_at desc);
```

## RLS Strategy

All organization-scoped tables should enforce:
- user must be an active member of the organization
- role-based write restrictions
- service role only for background/system jobs where necessary

Suggested write roles:
- owner/admin/accountant/reviewer for accounting and tax operations
- operator for upload and draft-stage corrections
- developer for API/integration config only if explicitly allowed

## Storage Buckets

Recommended private buckets:
- `documents-private`
- `exports-private`
- `normative-private`

Do not use public buckets for business documents.

## Index Strategy

Minimum useful indexes:
- organization + status on workflow tables
- organization + period/date on accounting tables
- organization + file_hash on documents
- active rule indexes by tax type and validity
- audit log by organization and created_at

## Migration Order

Suggested first migration order:
1. enums
2. profiles / organizations / organization_members
3. chart_of_accounts / vendors / customers
4. documents / document_extractions / document_relations
5. accounting_suggestions / lines
6. journal_entries / lines
7. normative_packages / documents / tax_rules
8. tax_periods / vat_runs
9. exports / api clients / api keys / webhooks / audit_log
10. RLS policies and helper functions

## Open Decisions

Still to confirm:
- whether to use generated columns for period labels
- whether sales should use a dedicated invoice table later
- whether journal entries should support foreign currency revaluation in v1
- whether line-level tax tags should be normalized into a separate table later

## Summary

This schema draft is intentionally practical:
- tenant-safe
- document-first
- versioned
- audit-friendly
- export-ready
- able to support VAT now and broader tax logic later
