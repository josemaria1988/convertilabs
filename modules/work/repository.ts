import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { buildPartyCreatePayload, buildPartyRolePayload } from "@/modules/directory";
import {
  buildBusinessEventPayload,
  buildDocumentWorkUnitLinkPayload,
} from "@/modules/events";
import {
  buildWorkUnitCreatePayload,
  summarizeWorkUnitFinancials,
} from "@/modules/work/service";
import { summarizeWorkUnitDocuments } from "@/modules/work/work-unit-financial-summary";
import type {
  WorkUnitKind,
  WorkUnitStatus,
} from "@/modules/work/types";

type JsonRecord = Record<string, unknown>;

type WorkUnitRow = {
  id: string;
  organization_id: string;
  code: string | null;
  name: string;
  kind: WorkUnitKind;
  status: WorkUnitStatus;
  customer_party_id: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_revenue: number | null;
  estimated_cost: number | null;
  actual_revenue: number | null;
  actual_cost: number | null;
  margin_status: string | null;
  currency_code: string | null;
  description: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

type PartyRow = {
  id: string;
  display_name: string;
  legal_name: string | null;
  tax_id: string | null;
  status: string | null;
};

type WorkDocumentRow = {
  id: string;
  work_unit_id?: string | null;
  direction: string;
  document_type: string | null;
  status: string;
  posting_status: string | null;
  original_filename: string;
  document_date: string | null;
  document_currency_code: string | null;
  document_total_amount_original: number | null;
  document_tax_amount_original?: number | null;
  total_amount_uyu: number | null;
  tax_amount_uyu?: number | null;
  created_at: string;
};

type WorkOpenItemRow = {
  id: string;
  document_role: string | null;
  outstanding_amount: number | null;
};

export type WorkUnitCustomerOption = {
  id: string;
  displayName: string;
  taxId: string | null;
};

export type WorkUnitDocumentItem = {
  id: string;
  direction: string;
  documentType: string | null;
  status: string;
  postingStatus: string | null;
  originalFilename: string;
  documentDate: string | null;
  currencyCode: string | null;
  totalAmount: number | null;
  createdAt: string;
};

export type WorkUnitListItem = {
  id: string;
  code: string | null;
  name: string;
  kind: WorkUnitKind;
  status: WorkUnitStatus;
  customer: WorkUnitCustomerOption | null;
  startDate: string | null;
  endDate: string | null;
  estimatedRevenue: number | null;
  estimatedCost: number | null;
  actualRevenue: number;
  actualCost: number;
  actualMargin: number;
  marginStatus: string;
  currencyCode: string;
  description: string | null;
  source: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkUnitDetail = WorkUnitListItem & {
  documents: WorkUnitDocumentItem[];
  documentRevenue: number;
  documentCost: number;
  documentMargin: number;
  journalEntryCount: number;
  openItemCount: number;
  openReceivableAmount: number;
  openPayableAmount: number;
  vatInputAmount: number;
  vatOutputAmount: number;
  saleDocumentCount: number;
  purchaseDocumentCount: number;
  pendingDocumentCount: number;
  blockedDocumentCount: number;
  postedDocumentCount: number;
};

export type WorkUnitDocumentOption = WorkUnitDocumentItem & {
  workUnitId: string | null;
};

export type WorkUnitListResult = {
  isAvailable: boolean;
  items: WorkUnitListItem[];
  customerOptions: WorkUnitCustomerOption[];
};

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asJsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function mapParty(row: PartyRow): WorkUnitCustomerOption {
  return {
    id: row.id,
    displayName: row.display_name,
    taxId: row.tax_id,
  };
}

function amountFromDocument(row: WorkDocumentRow) {
  return asNumber(row.total_amount_uyu)
    ?? asNumber(row.document_total_amount_original)
    ?? null;
}

function taxAmountFromDocument(row: WorkDocumentRow) {
  return asNumber(row.tax_amount_uyu)
    ?? asNumber(row.document_tax_amount_original)
    ?? 0;
}

function mapDocument(row: WorkDocumentRow): WorkUnitDocumentItem {
  return {
    id: row.id,
    direction: row.direction,
    documentType: row.document_type,
    status: row.status,
    postingStatus: row.posting_status,
    originalFilename: row.original_filename,
    documentDate: row.document_date,
    currencyCode: row.document_currency_code,
    totalAmount: amountFromDocument(row),
    createdAt: row.created_at,
  };
}

function mapDocumentOption(row: WorkDocumentRow): WorkUnitDocumentOption {
  return {
    ...mapDocument(row),
    workUnitId: row.work_unit_id ?? null,
  };
}

function mapWorkUnit(
  row: WorkUnitRow,
  input: {
    customersById: Map<string, WorkUnitCustomerOption>;
    documentCountsByWorkUnitId: Map<string, number>;
  },
): WorkUnitListItem {
  const actualRevenue = asNumber(row.actual_revenue) ?? 0;
  const actualCost = asNumber(row.actual_cost) ?? 0;
  const summary = summarizeWorkUnitFinancials({
    estimatedRevenue: row.estimated_revenue,
    estimatedCost: row.estimated_cost,
    actualRevenue,
    actualCost,
  });

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    status: row.status,
    customer: row.customer_party_id
      ? input.customersById.get(row.customer_party_id) ?? null
      : null,
    startDate: row.start_date,
    endDate: row.end_date,
    estimatedRevenue: row.estimated_revenue,
    estimatedCost: row.estimated_cost,
    actualRevenue,
    actualCost,
    actualMargin: summary.actualMargin,
    marginStatus: row.margin_status ?? summary.marginStatus,
    currencyCode: row.currency_code ?? "UYU",
    description: row.description,
    source: row.source,
    documentCount: input.documentCountsByWorkUnitId.get(row.id) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadPartiesById(
  supabase: SupabaseClient,
  organizationId: string,
  partyIds: string[],
) {
  if (partyIds.length === 0) {
    return new Map<string, WorkUnitCustomerOption>();
  }

  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, status")
    .eq("organization_id", organizationId)
    .in("id", Array.from(new Set(partyIds)));

  if (error) {
    if (isMissingSupabaseRelationError(error, "parties")) {
      return new Map<string, WorkUnitCustomerOption>();
    }

    throw new Error(error.message);
  }

  return new Map(
    ((data as PartyRow[] | null) ?? []).map((row) => [row.id, mapParty(row)]),
  );
}

async function loadDocumentCountsByWorkUnitId(
  supabase: SupabaseClient,
  organizationId: string,
  workUnitIds: string[],
) {
  if (workUnitIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, work_unit_id")
    .eq("organization_id", organizationId)
    .in("work_unit_id", workUnitIds);

  if (error) {
    if (isMissingSupabaseRelationError(error, "documents")) {
      return new Map<string, number>();
    }

    throw new Error(error.message);
  }

  const counts = new Map<string, number>();

  for (const row of ((data as Array<{ work_unit_id?: string | null }> | null) ?? [])) {
    if (row.work_unit_id) {
      counts.set(row.work_unit_id, (counts.get(row.work_unit_id) ?? 0) + 1);
    }
  }

  return counts;
}

async function loadAccountingImpactForWorkUnit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    workUnitId: string;
  },
) {
  const [journalResult, openItemsResult] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("work_unit_id", input.workUnitId)
      .limit(500),
    supabase
      .from("ledger_open_items")
      .select("id, document_role, outstanding_amount")
      .eq("organization_id", input.organizationId)
      .eq("work_unit_id", input.workUnitId)
      .in("status", ["open", "partially_settled"])
      .limit(500),
  ]);

  if (journalResult.error && !isMissingSupabaseRelationError(journalResult.error, "journal_entries")) {
    throw new Error(journalResult.error.message);
  }

  if (openItemsResult.error && !isMissingSupabaseRelationError(openItemsResult.error, "ledger_open_items")) {
    throw new Error(openItemsResult.error.message);
  }

  const openItems = (openItemsResult.data as WorkOpenItemRow[] | null) ?? [];

  return {
    journalEntryCount: ((journalResult.data as Array<{ id?: string | null }> | null) ?? []).length,
    openItemCount: openItems.length,
    openReceivableAmount: openItems
      .filter((item) => item.document_role === "sale")
      .reduce((sum, item) => sum + (asNumber(item.outstanding_amount) ?? 0), 0),
    openPayableAmount: openItems
      .filter((item) => item.document_role === "purchase")
      .reduce((sum, item) => sum + (asNumber(item.outstanding_amount) ?? 0), 0),
  };
}

export async function listWorkUnitCustomerOptions(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const rows: PartyRow[] = [];
  const pageSize = 1000;
  const maxRows = 10000;

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await supabase
      .from("parties")
      .select("id, display_name, legal_name, tax_id, status")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("display_name", { ascending: true })
      .range(from, to);

    if (error) {
      if (isMissingSupabaseRelationError(error, "parties")) {
        return [];
      }

      throw new Error(error.message);
    }

    const page = (data as PartyRow[] | null) ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows.map(mapParty);
}

export async function listOrganizationWorkUnits(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<WorkUnitListResult> {
  const { data, error } = await supabase
    .from("work_units")
    .select(
      "id, organization_id, code, name, kind, status, customer_party_id, start_date, end_date, estimated_revenue, estimated_cost, actual_revenue, actual_cost, margin_status, currency_code, description, source, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_units")) {
      return {
        isAvailable: false,
        items: [],
        customerOptions: await listWorkUnitCustomerOptions(supabase, organizationId),
      };
    }

    throw new Error(error.message);
  }

  const rows = (data as WorkUnitRow[] | null) ?? [];
  const [customersById, documentCountsByWorkUnitId, customerOptions] = await Promise.all([
    loadPartiesById(
      supabase,
      organizationId,
      rows
        .map((row) => row.customer_party_id)
        .filter((value): value is string => Boolean(value)),
    ),
    loadDocumentCountsByWorkUnitId(
      supabase,
      organizationId,
      rows.map((row) => row.id),
    ),
    listWorkUnitCustomerOptions(supabase, organizationId),
  ]);

  return {
    isAvailable: true,
    items: rows.map((row) => mapWorkUnit(row, {
      customersById,
      documentCountsByWorkUnitId,
    })),
    customerOptions,
  };
}

export async function loadWorkUnitDetail(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    workUnitId: string;
  },
): Promise<WorkUnitDetail | null> {
  const { data, error } = await supabase
    .from("work_units")
    .select(
      "id, organization_id, code, name, kind, status, customer_party_id, start_date, end_date, estimated_revenue, estimated_cost, actual_revenue, actual_cost, margin_status, currency_code, description, source, created_at, updated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.workUnitId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_units")) {
      return null;
    }

    throw new Error(error.message);
  }

  const row = (data as WorkUnitRow | null) ?? null;

  if (!row) {
    return null;
  }

  const { data: documentRows, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, direction, document_type, status, posting_status, original_filename, document_date, document_currency_code, document_total_amount_original, document_tax_amount_original, total_amount_uyu, tax_amount_uyu, created_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("work_unit_id", input.workUnitId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (documentError && !isMissingSupabaseRelationError(documentError, "documents")) {
    throw new Error(documentError.message);
  }

  const rawDocuments = (documentRows as WorkDocumentRow[] | null) ?? [];
  const documents = rawDocuments.map(mapDocument);
  const customersById = await loadPartiesById(
    supabase,
    input.organizationId,
    row.customer_party_id ? [row.customer_party_id] : [],
  );
  const accountingImpact = await loadAccountingImpactForWorkUnit(supabase, input);
  const base = mapWorkUnit(row, {
    customersById,
    documentCountsByWorkUnitId: new Map([[row.id, documents.length]]),
  });
  const documentSummary = summarizeWorkUnitDocuments(documents);
  const vatInputAmount = rawDocuments
    .filter((document) => document.direction === "purchase")
    .reduce((sum, document) => sum + taxAmountFromDocument(document), 0);
  const vatOutputAmount = rawDocuments
    .filter((document) => document.direction === "sale")
    .reduce((sum, document) => sum + taxAmountFromDocument(document), 0);

  return {
    ...base,
    documents,
    documentRevenue: documentSummary.revenue,
    documentCost: documentSummary.cost,
    documentMargin: documentSummary.margin,
    ...accountingImpact,
    vatInputAmount,
    vatOutputAmount,
    saleDocumentCount: documentSummary.saleDocumentCount,
    purchaseDocumentCount: documentSummary.purchaseDocumentCount,
    pendingDocumentCount: documentSummary.pendingDocumentCount,
    blockedDocumentCount: documentSummary.blockedDocumentCount,
    postedDocumentCount: documentSummary.postedDocumentCount,
  };
}

export async function listWorkUnitDocumentOptions(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    workUnitId?: string | null;
  },
): Promise<WorkUnitDocumentOption[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, work_unit_id, direction, document_type, status, posting_status, original_filename, document_date, document_currency_code, document_total_amount_original, total_amount_uyu, created_at",
    )
    .eq("organization_id", input.organizationId)
    .order("document_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    if (isMissingSupabaseRelationError(error, "documents")) {
      return [];
    }

    throw new Error(error.message);
  }

  const rows = ((data as WorkDocumentRow[] | null) ?? []).map(mapDocumentOption);

  if (!input.workUnitId) {
    return rows;
  }

  return rows.filter((document) =>
    !document.workUnitId || document.workUnitId === input.workUnitId);
}

async function assertWorkUnitBelongsToOrganization(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    workUnitId: string;
  },
) {
  const { data, error } = await supabase
    .from("work_units")
    .select("id, name")
    .eq("organization_id", input.organizationId)
    .eq("id", input.workUnitId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("El trabajo seleccionado no pertenece a esta organizacion.");
  }

  return data as { id: string; name: string };
}

async function updateLedgerWorkUnitLink(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    workUnitId: string | null;
  },
) {
  const { data: openItemRows, error: selectError } = await supabase
    .from("ledger_open_items")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_document_id", input.documentId);

  if (selectError) {
    if (isMissingSupabaseRelationError(selectError, "ledger_open_items")) {
      return;
    }

    throw new Error(selectError.message);
  }

  const openItemIds = ((openItemRows as Array<{ id?: string | null }> | null) ?? [])
    .map((row) => row.id)
    .filter((value): value is string => Boolean(value));
  const { error: updateError } = await supabase
    .from("ledger_open_items")
    .update({
      work_unit_id: input.workUnitId,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("source_document_id", input.documentId);

  if (updateError && !isMissingSupabaseRelationError(updateError, "ledger_open_items")) {
    throw new Error(updateError.message);
  }

  if (openItemIds.length > 0) {
    const { error: settlementByOpenItemError } = await supabase
      .from("ledger_settlement_links")
      .update({
        work_unit_id: input.workUnitId,
      })
      .eq("organization_id", input.organizationId)
      .in("open_item_id", openItemIds);

    if (
      settlementByOpenItemError
      && !isMissingSupabaseRelationError(settlementByOpenItemError, "ledger_settlement_links")
    ) {
      throw new Error(settlementByOpenItemError.message);
    }
  }

  const { error: settlementByDocumentError } = await supabase
    .from("ledger_settlement_links")
    .update({
      work_unit_id: input.workUnitId,
    })
    .eq("organization_id", input.organizationId)
    .eq("settlement_document_id", input.documentId);

  if (
    settlementByDocumentError
    && !isMissingSupabaseRelationError(settlementByDocumentError, "ledger_settlement_links")
  ) {
    throw new Error(settlementByDocumentError.message);
  }
}

async function upsertDocumentWorkUnitLink(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    previousWorkUnitId: string | null;
    workUnitId: string | null;
    actorId?: string | null;
  },
) {
  if (input.previousWorkUnitId && input.previousWorkUnitId !== input.workUnitId) {
    const { error } = await supabase
      .from("entity_links")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", input.organizationId)
      .eq("source_entity_type", "document")
      .eq("source_entity_id", input.documentId)
      .eq("target_entity_type", "work_unit")
      .eq("target_entity_id", input.previousWorkUnitId)
      .eq("relation_type", "belongs_to");

    if (error && !isMissingSupabaseRelationError(error, "entity_links")) {
      throw new Error(error.message);
    }
  }

  if (!input.workUnitId) {
    return;
  }

  const payload = buildDocumentWorkUnitLinkPayload({
    organizationId: input.organizationId,
    documentId: input.documentId,
    workUnitId: input.workUnitId,
    confidence: 1,
    actorId: input.actorId ?? null,
    metadata: {
      source: "work_mvp_manual_assignment",
    },
  });
  const { error } = await supabase
    .from("entity_links")
    .upsert(payload, {
      onConflict: "organization_id,source_entity_type,source_entity_id,target_entity_type,target_entity_id,relation_type",
    });

  if (error && !isMissingSupabaseRelationError(error, "entity_links")) {
    throw new Error(error.message);
  }
}

export async function assignDocumentToWorkUnit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
    workUnitId: string | null;
    actorId?: string | null;
  },
) {
  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .select("id, organization_id, work_unit_id, posting_status, original_filename, document_date, party_id, vendor_party_id, customer_party_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId)
    .limit(1)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (!documentRow) {
    throw new Error("Documento no encontrado.");
  }

  const document = documentRow as {
    id: string;
    work_unit_id: string | null;
    posting_status: string | null;
    original_filename: string | null;
    document_date: string | null;
    party_id: string | null;
    vendor_party_id: string | null;
    customer_party_id: string | null;
  };

  if (document.posting_status === "locked") {
    throw new Error("No se puede cambiar el trabajo de un documento bloqueado por cierre.");
  }

  const workUnit = input.workUnitId
    ? await assertWorkUnitBelongsToOrganization(supabase, {
      organizationId: input.organizationId,
      workUnitId: input.workUnitId,
    })
    : null;
  const { error: updateError } = await supabase
    .from("documents")
    .update({
      work_unit_id: input.workUnitId,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await updateLedgerWorkUnitLink(supabase, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    workUnitId: input.workUnitId,
  });
  await upsertDocumentWorkUnitLink(supabase, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    previousWorkUnitId: document.work_unit_id,
    workUnitId: input.workUnitId,
    actorId: input.actorId ?? null,
  });

  const eventPayload = buildBusinessEventPayload({
    organizationId: input.organizationId,
    eventType: "other",
    eventDate: document.document_date,
    sourceEntityType: "document",
    sourceEntityId: input.documentId,
    partyId: document.party_id ?? document.vendor_party_id ?? document.customer_party_id ?? null,
    workUnitId: input.workUnitId,
    documentId: input.documentId,
    actorProfileId: input.actorId ?? null,
    summary: input.workUnitId
      ? `Documento asociado al trabajo ${workUnit?.name ?? input.workUnitId}.`
      : "Documento desasociado de trabajo.",
    metadata: {
      event_code: input.workUnitId
        ? "document_work_unit_assigned"
        : "document_work_unit_unassigned",
      previous_work_unit_id: document.work_unit_id,
      work_unit_id: input.workUnitId,
      document_filename: document.original_filename,
    },
  });
  const { error: eventError } = await supabase
    .from("business_events")
    .insert(eventPayload);

  if (eventError && !isMissingSupabaseRelationError(eventError, "business_events")) {
    throw new Error(eventError.message);
  }

  return {
    documentId: input.documentId,
    previousWorkUnitId: document.work_unit_id,
    workUnitId: input.workUnitId,
  };
}

export async function createCustomerPartyForWorkUnit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    displayName: string;
    taxId?: string | null;
    actorId?: string | null;
  },
) {
  const partyPayload = buildPartyCreatePayload({
    organizationId: input.organizationId,
    displayName: input.displayName,
    taxId: input.taxId,
    source: "work_unit_quick_create",
    actorId: input.actorId ?? null,
    metadata: {
      created_from: "work_unit_form",
    },
  });
  const { data, error } = await supabase
    .from("parties")
    .insert(partyPayload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const partyId = String((data as { id: string }).id);
  const rolePayload = buildPartyRolePayload({
    organizationId: input.organizationId,
    partyId,
    roleType: "customer",
    actorId: input.actorId ?? null,
    metadata: {
      created_from: "work_unit_form",
    },
  });
  const { error: roleError } = await supabase
    .from("party_roles")
    .upsert(rolePayload, {
      onConflict: "organization_id,party_id,role_type",
    });

  if (roleError) {
    throw new Error(roleError.message);
  }

  return partyId;
}

export async function createWorkUnit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    name: string;
    code?: string | null;
    kind?: WorkUnitKind;
    status?: WorkUnitStatus;
    customerPartyId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    estimatedRevenue?: number | null;
    estimatedCost?: number | null;
    currencyCode?: string | null;
    description?: string | null;
    metadata?: JsonRecord;
  },
) {
  const payload = buildWorkUnitCreatePayload({
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    name: input.name,
    code: input.code,
    kind: input.kind ?? "job",
    status: input.status ?? "active",
    customerPartyId: input.customerPartyId ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    estimatedRevenue: input.estimatedRevenue,
    estimatedCost: input.estimatedCost,
    currencyCode: input.currencyCode,
    description: input.description,
    source: "manual",
    metadata: {
      ...asJsonRecord(input.metadata),
      created_from: "work_mvp",
    },
  });
  const { data, error } = await supabase
    .from("work_units")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const workUnitId = String((data as { id: string }).id);
  const eventPayload = buildBusinessEventPayload({
    organizationId: input.organizationId,
    eventType: "work_unit_created",
    sourceEntityType: "work_unit",
    sourceEntityId: workUnitId,
    partyId: input.customerPartyId ?? null,
    workUnitId,
    actorProfileId: input.actorId ?? null,
    summary: `Trabajo creado: ${payload.name}`,
    metadata: {
      work_unit_name: payload.name,
      work_unit_kind: payload.kind,
    },
  });
  const { error: eventError } = await supabase
    .from("business_events")
    .insert(eventPayload);

  if (eventError && !isMissingSupabaseRelationError(eventError, "business_events")) {
    throw new Error(eventError.message);
  }

  return workUnitId;
}
