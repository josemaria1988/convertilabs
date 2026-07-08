import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  loadOrganizationDocumentsCountByCostCenter,
  listOrganizationCostCenters,
  type OrganizationCostCenterSummary,
} from "@/modules/cost-centers/service";
import {
  listAllOrganizationWorkspaceDocuments,
  type DocumentWorkspaceListItem,
} from "@/modules/documents/review";
import {
  listOrganizationWorkUnits,
  type WorkUnitListItem,
} from "@/modules/work";

export type FieldWorkUnitOption = {
  id: string;
  name: string;
  code: string | null;
  kind: WorkUnitListItem["kind"];
  status: WorkUnitListItem["status"];
  customerName: string | null;
  documentCount: number;
};

export type FieldWorkspaceData = {
  documents: DocumentWorkspaceListItem[];
  filteredDocuments: DocumentWorkspaceListItem[];
  costCenters: OrganizationCostCenterSummary[];
  workUnits: FieldWorkUnitOption[];
  activeCostCenterId: string | null;
  costCenterNameById: Map<string, string>;
  workUnitNameById: Map<string, string>;
};

const closedWorkUnitStatuses = new Set<WorkUnitListItem["status"]>([
  "completed",
  "cancelled",
  "archived",
]);

export function readOptionalSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapOpenFieldWorkUnits(items: WorkUnitListItem[]): FieldWorkUnitOption[] {
  return items
    .filter((item) => !closedWorkUnitStatuses.has(item.status))
    .map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      kind: item.kind,
      status: item.status,
      customerName: item.customer?.displayName ?? null,
      documentCount: item.documentCount,
    }));
}

export async function loadFieldWorkspaceData(input: {
  organizationId: string;
  organizationSlug: string;
  costCenterId?: string | null;
  limit?: number | null;
  includeArchivedProjects?: boolean;
}) {
  const [documents, costCenters, workUnitResult] = await Promise.all([
    listAllOrganizationWorkspaceDocuments({
      organizationId: input.organizationId,
      organizationSlug: input.organizationSlug,
      sortOrder: "date_desc",
      limit: input.limit ?? null,
    }),
    listOrganizationCostCenters({
      organizationId: input.organizationId,
      includeArchived: input.includeArchivedProjects ?? false,
    }),
    listOrganizationWorkUnits(getSupabaseServiceRoleClient(), input.organizationId),
  ]);

  const workUnits = mapOpenFieldWorkUnits(workUnitResult.items);
  const activeCostCenterId =
    input.costCenterId && costCenters.some((item) => item.id === input.costCenterId)
      ? input.costCenterId
      : null;
  const filteredDocuments = activeCostCenterId
    ? documents.filter((item) => item.costCenterId === activeCostCenterId)
    : documents;

  return {
    documents,
    filteredDocuments,
    costCenters,
    workUnits,
    activeCostCenterId,
    costCenterNameById: new Map(costCenters.map((item) => [item.id, item.name])),
    workUnitNameById: new Map(workUnits.map((item) => [item.id, item.name])),
  } satisfies FieldWorkspaceData;
}

export async function loadFieldDocumentsCountByCostCenter(organizationId: string) {
  return loadOrganizationDocumentsCountByCostCenter(organizationId);
}
