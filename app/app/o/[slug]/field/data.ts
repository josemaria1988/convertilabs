import "server-only";

import {
  loadOrganizationDocumentsCountByCostCenter,
  listOrganizationCostCenters,
  type OrganizationCostCenterSummary,
} from "@/modules/cost-centers/service";
import {
  listAllOrganizationWorkspaceDocuments,
  type DocumentWorkspaceListItem,
} from "@/modules/documents/review";

export type FieldWorkspaceData = {
  documents: DocumentWorkspaceListItem[];
  filteredDocuments: DocumentWorkspaceListItem[];
  costCenters: OrganizationCostCenterSummary[];
  activeCostCenterId: string | null;
  costCenterNameById: Map<string, string>;
};

export function readOptionalSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function loadFieldWorkspaceData(input: {
  organizationId: string;
  organizationSlug: string;
  costCenterId?: string | null;
  limit?: number | null;
  includeArchivedProjects?: boolean;
}) {
  const [documents, costCenters] = await Promise.all([
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
  ]);

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
    activeCostCenterId,
    costCenterNameById: new Map(costCenters.map((item) => [item.id, item.name])),
  } satisfies FieldWorkspaceData;
}

export async function loadFieldDocumentsCountByCostCenter(organizationId: string) {
  return loadOrganizationDocumentsCountByCostCenter(organizationId);
}
