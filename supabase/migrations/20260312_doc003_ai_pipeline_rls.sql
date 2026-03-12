alter table public.organization_profile_versions enable row level security;
alter table public.organization_rule_snapshots enable row level security;
alter table public.document_processing_runs enable row level security;
alter table public.document_field_candidates enable row level security;
alter table public.document_classification_candidates enable row level security;
alter table public.document_drafts enable row level security;
alter table public.document_draft_steps enable row level security;
alter table public.document_draft_autosaves enable row level security;
alter table public.document_confirmations enable row level security;
alter table public.document_revisions enable row level security;
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
