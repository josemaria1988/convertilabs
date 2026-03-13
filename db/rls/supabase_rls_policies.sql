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
alter table public.customers enable row level security;
alter table public.documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.document_relations enable row level security;
alter table public.accounting_suggestions enable row level security;
alter table public.accounting_suggestion_lines enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.normative_packages enable row level security;
alter table public.normative_documents enable row level security;
alter table public.tax_rules enable row level security;
alter table public.tax_periods enable row level security;
alter table public.vat_runs enable row level security;
alter table public.exports enable row level security;
alter table public.api_clients enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.audit_log enable row level security;

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

drop policy if exists "audit_log_select_member" on public.audit_log;
create policy "audit_log_select_member"
on public.audit_log
for select
using (
  organization_id is not null
  and public.is_active_member(organization_id)
);

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
