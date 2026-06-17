import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { listAllOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import {
  buildCompanyHomeDashboard,
  type CompanyHomeDashboard,
  type CompanyHomeDocumentSignal,
  type CompanyHomeMoneySignal,
  type CompanyHomePartySignal,
  type CompanyHomeWorkUnitSignal,
} from "@/modules/presentation/company-home";

type WorkUnitHomeRow = {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
  actual_revenue: number | null;
  actual_cost: number | null;
  margin_status: string | null;
  updated_at: string | null;
};

type PartyHomeRow = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
  status: string | null;
  source: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type OpenItemHomeRow = {
  open_item_id: string;
  counterparty_name: string | null;
  document_role: string | null;
  due_date: string | null;
  days_overdue: number | null;
  outstanding_amount: number | null;
  status: string | null;
  source_document_id: string | null;
};

function asNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapWorkUnitRow(row: WorkUnitHomeRow): CompanyHomeWorkUnitSignal {
  return {
    id: row.id,
    name: row.name ?? "Trabajo sin nombre",
    status: row.status ?? "planned",
    kind: row.kind ?? "job",
    actualRevenue: asNumber(row.actual_revenue),
    actualCost: asNumber(row.actual_cost),
    marginStatus: row.margin_status,
    updatedAt: row.updated_at,
  };
}

function mapPartyRow(row: PartyHomeRow): CompanyHomePartySignal {
  return {
    id: row.id,
    displayName: row.display_name ?? row.legal_name ?? "Contraparte sin nombre",
    status: row.status,
    source: row.source,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function mapMoneyRow(row: OpenItemHomeRow): CompanyHomeMoneySignal {
  return {
    id: row.open_item_id,
    counterpartyName: row.counterparty_name,
    documentRole: row.document_role,
    dueDate: row.due_date,
    daysOverdue: asNumber(row.days_overdue),
    outstandingAmount: asNumber(row.outstanding_amount),
    status: row.status,
    sourceDocumentId: row.source_document_id,
  };
}

async function loadWorkUnitSignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  isAvailable: boolean;
  totalCount: number;
  recent: CompanyHomeWorkUnitSignal[];
}> {
  const { data, count, error } = await supabase
    .from("work_units")
    .select(
      "id, name, status, kind, actual_revenue, actual_cost, margin_status, updated_at",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_units")) {
      return {
        isAvailable: false,
        totalCount: 0,
        recent: [],
      };
    }

    throw new Error(error.message);
  }

  return {
    isAvailable: true,
    totalCount: count ?? data?.length ?? 0,
    recent: ((data as WorkUnitHomeRow[] | null) ?? []).map(mapWorkUnitRow),
  };
}

async function loadPartySignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  isAvailable: boolean;
  totalCount: number;
  recent: CompanyHomePartySignal[];
}> {
  const { data, count, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, status, source, updated_at, created_at", {
      count: "exact",
    })
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(8);

  if (error) {
    if (isMissingSupabaseRelationError(error, "parties")) {
      return {
        isAvailable: false,
        totalCount: 0,
        recent: [],
      };
    }

    throw new Error(error.message);
  }

  return {
    isAvailable: true,
    totalCount: count ?? data?.length ?? 0,
    recent: ((data as PartyHomeRow[] | null) ?? []).map(mapPartyRow),
  };
}

async function loadMoneySignals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  isAvailable: boolean;
  totalCount: number;
  recent: CompanyHomeMoneySignal[];
}> {
  const { data, count, error } = await supabase
    .from("v_open_items_outstanding")
    .select(
      "open_item_id, counterparty_name, document_role, due_date, days_overdue, outstanding_amount, status, source_document_id",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) {
    if (isMissingSupabaseRelationError(error, "v_open_items_outstanding")) {
      return {
        isAvailable: false,
        totalCount: 0,
        recent: [],
      };
    }

    throw new Error(error.message);
  }

  return {
    isAvailable: true,
    totalCount: count ?? data?.length ?? 0,
    recent: ((data as OpenItemHomeRow[] | null) ?? []).map(mapMoneyRow),
  };
}

function mapDocumentSignal(input: {
  organizationSlug: string;
  document: Awaited<ReturnType<typeof listAllOrganizationWorkspaceDocuments>>[number];
}): CompanyHomeDocumentSignal {
  return {
    id: input.document.id,
    label: input.document.counterpartyName ?? input.document.originalFilename,
    href: input.document.processedHref ?? `/app/o/${input.organizationSlug}/documents?documentId=${input.document.id}`,
    createdAt: input.document.createdAt,
    bucket: input.document.operationalBucket,
    blockingReason: input.document.blockingReason,
    nextActionLabel: input.document.nextPrimaryActionLabel,
  };
}

export async function loadCompanyHomeDashboard(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
  },
): Promise<CompanyHomeDashboard> {
  const [documents, work, directory, money] = await Promise.all([
    listAllOrganizationWorkspaceDocuments({
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      sortOrder: "date_desc",
      limit: 40,
    }),
    loadWorkUnitSignals(supabase, input.organizationId),
    loadPartySignals(supabase, input.organizationId),
    loadMoneySignals(supabase, input.organizationId),
  ]);

  return buildCompanyHomeDashboard({
    organizationSlug: input.organizationSlug,
    documents: documents.map((document) =>
      mapDocumentSignal({
        organizationSlug: input.organizationSlug,
        document,
      })),
    work,
    directory,
    money,
  });
}
