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

alter table public.tax_period_document_selections enable row level security;

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
