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

alter table public.parties enable row level security;
alter table public.party_roles enable row level security;
alter table public.party_identifiers enable row level security;
alter table public.contacts enable row level security;
alter table public.party_contacts enable row level security;
alter table public.work_units enable row level security;
alter table public.business_events enable row level security;
alter table public.entity_links enable row level security;
alter table public.evidence_refs enable row level security;

drop policy if exists "parties_select_member" on public.parties;
create policy "parties_select_member"
on public.parties
for select
using (public.is_active_member(organization_id));

drop policy if exists "parties_insert_directory_roles" on public.parties;
create policy "parties_insert_directory_roles"
on public.parties
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "parties_update_directory_roles" on public.parties;
create policy "parties_update_directory_roles"
on public.parties
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "parties_delete_admin_roles" on public.parties;
create policy "parties_delete_admin_roles"
on public.parties
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "party_roles_select_member" on public.party_roles;
create policy "party_roles_select_member"
on public.party_roles
for select
using (public.is_active_member(organization_id));

drop policy if exists "party_roles_insert_directory_roles" on public.party_roles;
create policy "party_roles_insert_directory_roles"
on public.party_roles
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_roles_update_directory_roles" on public.party_roles;
create policy "party_roles_update_directory_roles"
on public.party_roles
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_roles_delete_admin_roles" on public.party_roles;
create policy "party_roles_delete_admin_roles"
on public.party_roles
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "party_identifiers_select_member" on public.party_identifiers;
create policy "party_identifiers_select_member"
on public.party_identifiers
for select
using (public.is_active_member(organization_id));

drop policy if exists "party_identifiers_insert_directory_roles" on public.party_identifiers;
create policy "party_identifiers_insert_directory_roles"
on public.party_identifiers
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_identifiers_update_directory_roles" on public.party_identifiers;
create policy "party_identifiers_update_directory_roles"
on public.party_identifiers
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_identifiers_delete_admin_roles" on public.party_identifiers;
create policy "party_identifiers_delete_admin_roles"
on public.party_identifiers
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "contacts_select_member" on public.contacts;
create policy "contacts_select_member"
on public.contacts
for select
using (public.is_active_member(organization_id));

drop policy if exists "contacts_insert_directory_roles" on public.contacts;
create policy "contacts_insert_directory_roles"
on public.contacts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "contacts_update_directory_roles" on public.contacts;
create policy "contacts_update_directory_roles"
on public.contacts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_contacts_select_member" on public.party_contacts;
create policy "party_contacts_select_member"
on public.party_contacts
for select
using (public.is_active_member(organization_id));

drop policy if exists "party_contacts_insert_directory_roles" on public.party_contacts;
create policy "party_contacts_insert_directory_roles"
on public.party_contacts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "party_contacts_update_directory_roles" on public.party_contacts;
create policy "party_contacts_update_directory_roles"
on public.party_contacts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_units_select_member" on public.work_units;
create policy "work_units_select_member"
on public.work_units
for select
using (public.is_active_member(organization_id));

drop policy if exists "work_units_insert_work_roles" on public.work_units;
create policy "work_units_insert_work_roles"
on public.work_units
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_units_update_work_roles" on public.work_units;
create policy "work_units_update_work_roles"
on public.work_units
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_units_delete_admin_roles" on public.work_units;
create policy "work_units_delete_admin_roles"
on public.work_units
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "business_events_select_member" on public.business_events;
create policy "business_events_select_member"
on public.business_events
for select
using (public.is_active_member(organization_id));

drop policy if exists "business_events_insert_event_roles" on public.business_events;
create policy "business_events_insert_event_roles"
on public.business_events
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "business_events_update_event_roles" on public.business_events;
create policy "business_events_update_event_roles"
on public.business_events
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

drop policy if exists "entity_links_select_member" on public.entity_links;
create policy "entity_links_select_member"
on public.entity_links
for select
using (public.is_active_member(organization_id));

drop policy if exists "entity_links_insert_event_roles" on public.entity_links;
create policy "entity_links_insert_event_roles"
on public.entity_links
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "entity_links_update_event_roles" on public.entity_links;
create policy "entity_links_update_event_roles"
on public.entity_links
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "entity_links_delete_admin_roles" on public.entity_links;
create policy "entity_links_delete_admin_roles"
on public.entity_links
for delete
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role
    ]
  )
);

drop policy if exists "evidence_refs_select_member" on public.evidence_refs;
create policy "evidence_refs_select_member"
on public.evidence_refs
for select
using (public.is_active_member(organization_id));

drop policy if exists "evidence_refs_insert_event_roles" on public.evidence_refs;
create policy "evidence_refs_insert_event_roles"
on public.evidence_refs
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "evidence_refs_update_event_roles" on public.evidence_refs;
create policy "evidence_refs_update_event_roles"
on public.evidence_refs
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

alter table public.treasury_bank_accounts enable row level security;
alter table public.treasury_bank_balance_snapshots enable row level security;
alter table public.treasury_vales enable row level security;
alter table public.treasury_vale_terms enable row level security;
alter table public.treasury_vale_events enable row level security;
alter table public.treasury_manual_receivables enable row level security;
alter table public.treasury_reserve_rules enable row level security;

drop policy if exists "treasury_bank_accounts_select_member" on public.treasury_bank_accounts;
create policy "treasury_bank_accounts_select_member"
on public.treasury_bank_accounts
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_bank_accounts_insert_treasury_roles" on public.treasury_bank_accounts;
create policy "treasury_bank_accounts_insert_treasury_roles"
on public.treasury_bank_accounts
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_bank_accounts_update_treasury_roles" on public.treasury_bank_accounts;
create policy "treasury_bank_accounts_update_treasury_roles"
on public.treasury_bank_accounts
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_bank_balance_snapshots_select_member" on public.treasury_bank_balance_snapshots;
create policy "treasury_bank_balance_snapshots_select_member"
on public.treasury_bank_balance_snapshots
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_bank_balance_snapshots_insert_treasury_roles" on public.treasury_bank_balance_snapshots;
create policy "treasury_bank_balance_snapshots_insert_treasury_roles"
on public.treasury_bank_balance_snapshots
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_bank_balance_snapshots_update_treasury_roles" on public.treasury_bank_balance_snapshots;
create policy "treasury_bank_balance_snapshots_update_treasury_roles"
on public.treasury_bank_balance_snapshots
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_vales_select_member" on public.treasury_vales;
create policy "treasury_vales_select_member"
on public.treasury_vales
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_vales_insert_treasury_roles" on public.treasury_vales;
create policy "treasury_vales_insert_treasury_roles"
on public.treasury_vales
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_vales_update_treasury_roles" on public.treasury_vales;
create policy "treasury_vales_update_treasury_roles"
on public.treasury_vales
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_vale_terms_select_member" on public.treasury_vale_terms;
create policy "treasury_vale_terms_select_member"
on public.treasury_vale_terms
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_vale_terms_insert_treasury_roles" on public.treasury_vale_terms;
create policy "treasury_vale_terms_insert_treasury_roles"
on public.treasury_vale_terms
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_vale_terms_update_treasury_roles" on public.treasury_vale_terms;
create policy "treasury_vale_terms_update_treasury_roles"
on public.treasury_vale_terms
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_vale_events_select_member" on public.treasury_vale_events;
create policy "treasury_vale_events_select_member"
on public.treasury_vale_events
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_vale_events_insert_treasury_roles" on public.treasury_vale_events;
create policy "treasury_vale_events_insert_treasury_roles"
on public.treasury_vale_events
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_vale_events_update_treasury_roles" on public.treasury_vale_events;
create policy "treasury_vale_events_update_treasury_roles"
on public.treasury_vale_events
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_manual_receivables_select_member" on public.treasury_manual_receivables;
create policy "treasury_manual_receivables_select_member"
on public.treasury_manual_receivables
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_manual_receivables_insert_treasury_roles" on public.treasury_manual_receivables;
create policy "treasury_manual_receivables_insert_treasury_roles"
on public.treasury_manual_receivables
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_manual_receivables_update_treasury_roles" on public.treasury_manual_receivables;
create policy "treasury_manual_receivables_update_treasury_roles"
on public.treasury_manual_receivables
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_reserve_rules_select_member" on public.treasury_reserve_rules;
create policy "treasury_reserve_rules_select_member"
on public.treasury_reserve_rules
for select
using (public.is_active_member(organization_id));

drop policy if exists "treasury_reserve_rules_insert_treasury_roles" on public.treasury_reserve_rules;
create policy "treasury_reserve_rules_insert_treasury_roles"
on public.treasury_reserve_rules
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "treasury_reserve_rules_update_treasury_roles" on public.treasury_reserve_rules;
create policy "treasury_reserve_rules_update_treasury_roles"
on public.treasury_reserve_rules
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'operator'::public.member_role
    ]
  )
);
alter table public.work_intake_items enable row level security;

drop policy if exists "work_intake_items_select_member" on public.work_intake_items;
create policy "work_intake_items_select_member"
on public.work_intake_items
for select
using (public.is_active_member(organization_id));

drop policy if exists "work_intake_items_insert_operations_roles" on public.work_intake_items;
create policy "work_intake_items_insert_operations_roles"
on public.work_intake_items
for insert
with check (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);

drop policy if exists "work_intake_items_update_operations_roles" on public.work_intake_items;
create policy "work_intake_items_update_operations_roles"
on public.work_intake_items
for update
using (
  public.has_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'admin_processing'::public.member_role,
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
      'admin_processing'::public.member_role,
      'accountant'::public.member_role,
      'reviewer'::public.member_role,
      'operator'::public.member_role
    ]
  )
);
