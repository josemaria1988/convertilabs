import type { WorkUnitCreatePayload } from "@/modules/work/types";
import { buildWorkUnitCreatePayload } from "@/modules/work/service";

export type LegacyCostCenterBridgeRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  archived_by?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LegacyCostCenterWorkUnitPayload = WorkUnitCreatePayload & {
  archived_at: string | null;
  archived_by: string | null;
};

function asMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function buildWorkUnitPayloadFromLegacyCostCenter(
  row: LegacyCostCenterBridgeRow,
  actorId?: string | null,
): LegacyCostCenterWorkUnitPayload {
  return {
    ...buildWorkUnitCreatePayload({
      organizationId: row.organization_id,
      name: row.name,
      kind: "cost_center",
      status: row.is_active ? "active" : "archived",
      description: row.description,
      source: "legacy_cost_center_bridge",
      legacyCostCenterId: row.id,
      metadata: {
        ...asMetadata(row.metadata),
        legacy_source_table: "organization_cost_centers",
        legacy_cost_center_id: row.id,
      },
      actorId: actorId ?? row.updated_by ?? row.created_by ?? null,
    }),
    archived_at: row.is_active ? null : row.archived_at ?? null,
    archived_by: row.is_active ? null : row.archived_by ?? actorId ?? null,
  };
}

export function buildDocumentCostCenterBridgeMetadata(input: {
  currentMetadata?: Record<string, unknown> | null;
  costCenterId: string | null;
  workUnitId: string | null;
  actorId: string | null;
  assignmentSource: string;
  assignedAt: string;
}) {
  return {
    ...asMetadata(input.currentMetadata),
    cost_center_last_assignment_source: input.assignmentSource,
    cost_center_last_assignment_at: input.assignedAt,
    cost_center_last_assignment_by: input.actorId,
    work_unit_last_assignment_source: "legacy_cost_center_bridge",
    work_unit_last_assignment_at: input.assignedAt,
    work_unit_last_assignment_by: input.actorId,
    bridged_cost_center_id: input.costCenterId,
    bridged_work_unit_id: input.workUnitId,
  };
}
