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

alter table public.document_invoice_identities enable row level security;

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
