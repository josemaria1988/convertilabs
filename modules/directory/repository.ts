import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { listPartyInteractions } from "@/modules/communications";
import {
  buildContactPayload,
  buildPartyContactPayload,
  buildPartyCreatePayload,
  buildPartyIdentifierPayload,
  buildPartyRolePayload,
} from "@/modules/directory/service";
import type {
  DirectoryContactItem,
  DirectoryDashboardData,
  DirectoryDocumentItem,
  DirectoryIdentifierItem,
  DirectoryMoneyItem,
  DirectoryPartyListItem,
  DirectoryTaskItem,
  DirectoryWorkUnitItem,
  PartyCreateInput,
  PartyIdentifierType,
  PartyProfileData,
  PartyRoleType,
} from "@/modules/directory/types";

type PartyRow = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  status: string | null;
  source: string | null;
  updated_at: string | null;
};

type PartyRoleRow = {
  party_id: string;
  role_type: PartyRoleType;
  status: string | null;
};

type PartyContactRow = {
  party_id: string;
  contact_id: string;
  relationship_label: string | null;
  is_primary: boolean | null;
};

type ContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  notes: string | null;
};

type IdentifierRow = {
  id: string;
  identifier_type: PartyIdentifierType;
  identifier_value: string;
  is_primary: boolean | null;
};

type WorkUnitRow = {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
};

type DocumentRow = {
  id: string;
  original_filename: string | null;
  counterparty_name: string | null;
  document_date: string | null;
  lifecycle_status: string | null;
};

type MoneyRow = {
  open_item_id: string;
  document_role: string | null;
  due_date: string | null;
  outstanding_amount: number | null;
  status: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
};

function isMissingDirectoryTable(error: unknown) {
  return isMissingSupabaseRelationError(error as { message?: string; code?: string }, "parties")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "party_roles")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "contacts")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "party_contacts");
}

function asNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapParty(
  row: PartyRow,
  rolesByPartyId: Map<string, PartyRoleType[]>,
  contactCountsByPartyId: Map<string, number>,
  interactionCountsByPartyId: Map<string, number>,
): DirectoryPartyListItem {
  return {
    id: row.id,
    displayName: row.display_name ?? row.legal_name ?? "Party sin nombre",
    legalName: row.legal_name,
    taxId: row.tax_id,
    status: row.status,
    source: row.source,
    updatedAt: row.updated_at,
    roles: rolesByPartyId.get(row.id) ?? [],
    contactCount: contactCountsByPartyId.get(row.id) ?? 0,
    interactionCount: interactionCountsByPartyId.get(row.id) ?? 0,
  };
}

async function loadPartyDecorations(
  supabase: SupabaseClient,
  organizationId: string,
  partyIds: string[],
) {
  const rolesByPartyId = new Map<string, PartyRoleType[]>();
  const contactCountsByPartyId = new Map<string, number>();
  const interactionIdsByPartyId = new Map<string, Set<string>>();

  if (partyIds.length === 0) {
    return {
      rolesByPartyId,
      contactCountsByPartyId,
      interactionCountsByPartyId: new Map<string, number>(),
    };
  }

  const [rolesResult, contactsResult, participantResult, linksResult] = await Promise.all([
    supabase
      .from("party_roles")
      .select("party_id, role_type, status")
      .eq("organization_id", organizationId)
      .in("party_id", partyIds),
    supabase
      .from("party_contacts")
      .select("party_id")
      .eq("organization_id", organizationId)
      .in("party_id", partyIds),
    supabase
      .from("interaction_participants")
      .select("party_id, interaction_id")
      .eq("organization_id", organizationId)
      .in("party_id", partyIds),
    supabase
      .from("interaction_links")
      .select("target_entity_id, interaction_id")
      .eq("organization_id", organizationId)
      .eq("target_entity_type", "party")
      .in("target_entity_id", partyIds),
  ]);

  if (rolesResult.error && !isMissingSupabaseRelationError(rolesResult.error, "party_roles")) {
    throw new Error(rolesResult.error.message);
  }

  if (contactsResult.error && !isMissingSupabaseRelationError(contactsResult.error, "party_contacts")) {
    throw new Error(contactsResult.error.message);
  }

  for (const role of ((rolesResult.data as PartyRoleRow[] | null) ?? [])) {
    if (role.status === "archived") {
      continue;
    }

    const current = rolesByPartyId.get(role.party_id) ?? [];
    current.push(role.role_type);
    rolesByPartyId.set(role.party_id, current);
  }

  for (const contact of (((contactsResult.data as Array<{ party_id?: string | null }> | null) ?? []))) {
    if (contact.party_id) {
      contactCountsByPartyId.set(contact.party_id, (contactCountsByPartyId.get(contact.party_id) ?? 0) + 1);
    }
  }

  if (!participantResult.error) {
    for (const row of (((participantResult.data as Array<{ party_id?: string | null; interaction_id?: string | null }> | null) ?? []))) {
      if (row.party_id && row.interaction_id) {
        const current = interactionIdsByPartyId.get(row.party_id) ?? new Set<string>();
        current.add(row.interaction_id);
        interactionIdsByPartyId.set(row.party_id, current);
      }
    }
  } else if (!isMissingSupabaseRelationError(participantResult.error, "interaction_participants")) {
    throw new Error(participantResult.error.message);
  }

  if (!linksResult.error) {
    for (const row of (((linksResult.data as Array<{ target_entity_id?: string | null; interaction_id?: string | null }> | null) ?? []))) {
      if (row.target_entity_id && row.interaction_id) {
        const current = interactionIdsByPartyId.get(row.target_entity_id) ?? new Set<string>();
        current.add(row.interaction_id);
        interactionIdsByPartyId.set(row.target_entity_id, current);
      }
    }
  } else if (!isMissingSupabaseRelationError(linksResult.error, "interaction_links")) {
    throw new Error(linksResult.error.message);
  }

  return {
    rolesByPartyId,
    contactCountsByPartyId,
    interactionCountsByPartyId: new Map(
      Array.from(interactionIdsByPartyId.entries()).map(([partyId, ids]) => [partyId, ids.size]),
    ),
  };
}

export async function listDirectoryParties(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    searchTerm?: string | null;
    roleFilter?: PartyRoleType | null;
  },
): Promise<DirectoryDashboardData> {
  let rolePartyIds: string[] | null = null;

  if (input.roleFilter) {
    const { data, error } = await supabase
      .from("party_roles")
      .select("party_id")
      .eq("organization_id", input.organizationId)
      .eq("role_type", input.roleFilter)
      .eq("status", "active")
      .limit(500);

    if (error) {
      if (isMissingDirectoryTable(error)) {
        return {
          isAvailable: false,
          parties: [],
          summary: {
            totalParties: 0,
            customers: 0,
            vendors: 0,
            contacts: 0,
            interactions: 0,
          },
        };
      }

      throw new Error(error.message);
    }

    rolePartyIds = ((data as Array<{ party_id?: string | null }> | null) ?? [])
      .map((row) => row.party_id)
      .filter((id): id is string => Boolean(id));

    if (rolePartyIds.length === 0) {
      return {
        isAvailable: true,
        parties: [],
        summary: {
          totalParties: 0,
          customers: 0,
          vendors: 0,
          contacts: 0,
          interactions: 0,
        },
      };
    }
  }

  let query = supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, status, source, updated_at", { count: "exact" })
    .eq("organization_id", input.organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(120);

  const searchTerm = (input.searchTerm ?? "").trim();

  if (searchTerm) {
    query = query.or(`display_name.ilike.%${searchTerm}%,legal_name.ilike.%${searchTerm}%,tax_id.ilike.%${searchTerm}%`);
  }

  if (rolePartyIds) {
    query = query.in("id", rolePartyIds);
  }

  const { data, count, error } = await query;

  if (error) {
    if (isMissingDirectoryTable(error)) {
      return {
        isAvailable: false,
        parties: [],
        summary: {
          totalParties: 0,
          customers: 0,
          vendors: 0,
          contacts: 0,
          interactions: 0,
        },
      };
    }

    throw new Error(error.message);
  }

  const rows = (data as PartyRow[] | null) ?? [];
  const decorations = await loadPartyDecorations(
    supabase,
    input.organizationId,
    rows.map((row) => row.id),
  );
  const parties = rows.map((row) =>
    mapParty(
      row,
      decorations.rolesByPartyId,
      decorations.contactCountsByPartyId,
      decorations.interactionCountsByPartyId,
    ));

  return {
    isAvailable: true,
    parties,
    summary: {
      totalParties: count ?? rows.length,
      customers: parties.filter((party) => party.roles.includes("customer")).length,
      vendors: parties.filter((party) => party.roles.includes("vendor")).length,
      contacts: parties.reduce((sum, party) => sum + party.contactCount, 0),
      interactions: parties.reduce((sum, party) => sum + party.interactionCount, 0),
    },
  };
}

async function loadIdentifiers(
  supabase: SupabaseClient,
  organizationId: string,
  partyId: string,
): Promise<DirectoryIdentifierItem[]> {
  const { data, error } = await supabase
    .from("party_identifiers")
    .select("id, identifier_type, identifier_value, is_primary")
    .eq("organization_id", organizationId)
    .eq("party_id", partyId)
    .order("is_primary", { ascending: false });

  if (error) {
    if (isMissingSupabaseRelationError(error, "party_identifiers")) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data as IdentifierRow[] | null) ?? []).map((row) => ({
    id: row.id,
    identifierType: row.identifier_type,
    identifierValue: row.identifier_value,
    isPrimary: row.is_primary ?? false,
  }));
}

async function loadContacts(
  supabase: SupabaseClient,
  organizationId: string,
  partyId: string,
): Promise<DirectoryContactItem[]> {
  const { data: linkRows, error: linksError } = await supabase
    .from("party_contacts")
    .select("party_id, contact_id, relationship_label, is_primary")
    .eq("organization_id", organizationId)
    .eq("party_id", partyId)
    .order("is_primary", { ascending: false });

  if (linksError) {
    if (isMissingSupabaseRelationError(linksError, "party_contacts")) {
      return [];
    }

    throw new Error(linksError.message);
  }

  const links = (linkRows as PartyContactRow[] | null) ?? [];
  const contactIds = links.map((row) => row.contact_id);

  if (contactIds.length === 0) {
    return [];
  }

  const { data: contactRows, error: contactsError } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, mobile, notes")
    .eq("organization_id", organizationId)
    .in("id", contactIds);

  if (contactsError) {
    if (isMissingSupabaseRelationError(contactsError, "contacts")) {
      return [];
    }

    throw new Error(contactsError.message);
  }

  const contactsById = new Map(
    ((contactRows as ContactRow[] | null) ?? []).map((row) => [row.id, row]),
  );

  return links.map((link) => {
    const contact = contactsById.get(link.contact_id);

    return {
      id: link.contact_id,
      fullName: contact?.full_name ?? "Contacto sin nombre",
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      mobile: contact?.mobile ?? null,
      notes: contact?.notes ?? null,
      relationshipLabel: link.relationship_label,
      isPrimary: link.is_primary ?? false,
    };
  });
}

async function safeRows<T>(
  query: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
  relationName: string,
): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    if (isMissingSupabaseRelationError(error, relationName)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data as T[] | null) ?? [];
}

export async function loadPartyProfile(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    partyId: string;
  },
): Promise<PartyProfileData> {
  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, status, source, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("id", input.partyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingDirectoryTable(error)) {
      return {
        isAvailable: false,
        party: null,
        identifiers: [],
        contacts: [],
        workUnits: [],
        documents: [],
        moneyItems: [],
        tasks: [],
        interactionsAvailable: false,
        interactions: [],
      };
    }

    throw new Error(error.message);
  }

  if (!data) {
    return {
      isAvailable: true,
      party: null,
      identifiers: [],
      contacts: [],
      workUnits: [],
      documents: [],
      moneyItems: [],
      tasks: [],
      interactionsAvailable: true,
      interactions: [],
    };
  }

  const row = data as PartyRow;
  const [decorations, identifiers, contacts, workUnits, documents, moneyItems, tasks, interactions] = await Promise.all([
    loadPartyDecorations(supabase, input.organizationId, [input.partyId]),
    loadIdentifiers(supabase, input.organizationId, input.partyId),
    loadContacts(supabase, input.organizationId, input.partyId),
    safeRows<WorkUnitRow>(
      supabase
        .from("work_units")
        .select("id, name, status, kind")
        .eq("organization_id", input.organizationId)
        .eq("customer_party_id", input.partyId)
        .order("updated_at", { ascending: false })
        .limit(20),
      "work_units",
    ),
    safeRows<DocumentRow>(
      supabase
        .from("documents")
        .select("id, original_filename, counterparty_name, document_date, lifecycle_status")
        .eq("organization_id", input.organizationId)
        .or(`party_id.eq.${input.partyId},vendor_party_id.eq.${input.partyId},customer_party_id.eq.${input.partyId}`)
        .order("created_at", { ascending: false })
        .limit(20),
      "documents",
    ),
    safeRows<MoneyRow>(
      supabase
        .from("v_open_items_outstanding")
        .select("open_item_id, document_role, due_date, outstanding_amount, status")
        .eq("organization_id", input.organizationId)
        .eq("party_id", input.partyId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20),
      "v_open_items_outstanding",
    ),
    safeRows<TaskRow>(
      supabase
        .from("tasks")
        .select("id, title, status, due_date")
        .eq("organization_id", input.organizationId)
        .eq("party_id", input.partyId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(20),
      "tasks",
    ),
    listPartyInteractions(supabase, {
      organizationId: input.organizationId,
      partyId: input.partyId,
    }),
  ]);

  return {
    isAvailable: true,
    party: mapParty(
      row,
      decorations.rolesByPartyId,
      decorations.contactCountsByPartyId,
      decorations.interactionCountsByPartyId,
    ),
    identifiers,
    contacts,
    workUnits: workUnits.map((item): DirectoryWorkUnitItem => ({
      id: item.id,
      name: item.name ?? "Trabajo sin nombre",
      status: item.status,
      kind: item.kind,
    })),
    documents: documents.map((item): DirectoryDocumentItem => ({
      id: item.id,
      label: item.counterparty_name ?? item.original_filename ?? "Documento sin nombre",
      documentDate: item.document_date,
      lifecycleStatus: item.lifecycle_status,
    })),
    moneyItems: moneyItems.map((item): DirectoryMoneyItem => ({
      id: item.open_item_id,
      documentRole: item.document_role,
      dueDate: item.due_date,
      outstandingAmount: asNumber(item.outstanding_amount),
      status: item.status,
    })),
    tasks: tasks.map((item): DirectoryTaskItem => ({
      id: item.id,
      title: item.title,
      status: item.status,
      dueDate: item.due_date,
    })),
    interactionsAvailable: interactions.isAvailable,
    interactions: interactions.items,
  };
}

export async function createDirectoryParty(
  supabase: SupabaseClient,
  input: PartyCreateInput & {
    roleTypes?: PartyRoleType[];
  },
) {
  const payload = buildPartyCreatePayload(input);
  const { data, error } = await supabase
    .from("parties")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const partyId = String((data as { id: string }).id);
  const roleTypes = input.roleTypes ?? [];

  if (roleTypes.length > 0) {
    const { error: rolesError } = await supabase
      .from("party_roles")
      .upsert(roleTypes.map((roleType) =>
        buildPartyRolePayload({
          organizationId: input.organizationId,
          partyId,
          roleType,
          actorId: input.actorId ?? null,
        })), {
        onConflict: "organization_id,party_id,role_type",
      });

    if (rolesError) {
      throw new Error(rolesError.message);
    }
  }

  if (input.taxId) {
    const { error: identifierError } = await supabase
      .from("party_identifiers")
      .upsert(buildPartyIdentifierPayload({
        organizationId: input.organizationId,
        partyId,
        identifierType: "rut",
        identifierValue: input.taxId,
        countryCode: input.countryCode ?? "UY",
        isPrimary: true,
        actorId: input.actorId ?? null,
      }), {
        onConflict: "organization_id,identifier_type,identifier_value_normalized",
      });

    if (identifierError) {
      throw new Error(identifierError.message);
    }
  }

  return partyId;
}

export async function addContactToParty(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    partyId: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    relationshipLabel?: string | null;
    isPrimary?: boolean;
    notes?: string | null;
    actorId?: string | null;
  },
) {
  const contactPayload = buildContactPayload(input);
  const { data, error } = await supabase
    .from("contacts")
    .insert(contactPayload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const contactId = String((data as { id: string }).id);
  const { error: linkError } = await supabase
    .from("party_contacts")
    .upsert(buildPartyContactPayload({
      organizationId: input.organizationId,
      partyId: input.partyId,
      contactId,
      relationshipLabel: input.relationshipLabel,
      isPrimary: input.isPrimary ?? false,
      actorId: input.actorId ?? null,
    }), {
      onConflict: "organization_id,party_id,contact_id",
    });

  if (linkError) {
    throw new Error(linkError.message);
  }

  return contactId;
}
