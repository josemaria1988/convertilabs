create table if not exists public.operational_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  suggestion_type text not null,
  source_entity_type text,
  source_entity_id uuid,
  suggested_action_json jsonb not null default '{}'::jsonb,
  confidence numeric(5, 4),
  reason text,
  required_evidence_json jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  result_entity_type text,
  result_entity_id uuid,
  expires_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_suggestions_type_check check (
    suggestion_type in (
      'work_unit_assignment_suggestion',
      'party_resolution_suggestion',
      'task_suggestion',
      'process_structuring_suggestion',
      'continuity_risk_suggestion',
      'company_status_summary',
      'money_risk_summary'
    )
  ),
  constraint operational_suggestions_status_check check (
    status in ('pending', 'accepted', 'rejected', 'expired')
  ),
  constraint operational_suggestions_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists idx_operational_suggestions_org_status
  on public.operational_suggestions (organization_id, status, created_at desc);

create index if not exists idx_operational_suggestions_org_source
  on public.operational_suggestions (organization_id, source_entity_type, source_entity_id);

alter table public.operational_suggestions enable row level security;

drop policy if exists "operational_suggestions_select_members" on public.operational_suggestions;
create policy "operational_suggestions_select_members"
  on public.operational_suggestions
  for select
  using (public.is_active_member(organization_id));

drop policy if exists "operational_suggestions_insert_operators" on public.operational_suggestions;
create policy "operational_suggestions_insert_operators"
  on public.operational_suggestions
  for insert
  with check (
    public.has_org_role(organization_id, array[
      'owner'::public.member_role, 'admin'::public.member_role,
      'admin_processing'::public.member_role, 'accountant'::public.member_role,
      'reviewer'::public.member_role, 'operator'::public.member_role
    ])
  );

drop policy if exists "operational_suggestions_update_operators" on public.operational_suggestions;
create policy "operational_suggestions_update_operators"
  on public.operational_suggestions
  for update
  using (
    public.has_org_role(organization_id, array[
      'owner'::public.member_role, 'admin'::public.member_role,
      'admin_processing'::public.member_role, 'accountant'::public.member_role,
      'reviewer'::public.member_role, 'operator'::public.member_role
    ])
  )
  with check (
    public.has_org_role(organization_id, array[
      'owner'::public.member_role, 'admin'::public.member_role,
      'admin_processing'::public.member_role, 'accountant'::public.member_role,
      'reviewer'::public.member_role, 'operator'::public.member_role
    ])
  );
