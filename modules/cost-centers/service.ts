import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  buildDocumentCostCenterBridgeMetadata,
  buildWorkUnitPayloadFromLegacyCostCenter,
  type LegacyCostCenterBridgeRow,
} from "@/modules/work";

export type CostCenterAssignmentSource =
  | "mobile_field"
  | "desktop_review"
  | "desktop_documents";

export type OrganizationCostCenterSummary = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  workUnitId: string | null;
};

type CostCenterRow = LegacyCostCenterBridgeRow & {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

function mapCostCenterRow(
  row: CostCenterRow,
  workUnitId: string | null = null,
): OrganizationCostCenterSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    workUnitId,
  };
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isMissingWorkUnitsRelation(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message && (
    /work_units/i.test(error.message)
    && (
      /does not exist/i.test(error.message)
      || /schema cache/i.test(error.message)
      || /relation/i.test(error.message)
    )
  ));
}

async function loadWorkUnitIdsByCostCenter(input: {
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>;
  organizationId: string;
  costCenterIds: string[];
}) {
  if (input.costCenterIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await input.supabase
    .from("work_units")
    .select("id, legacy_cost_center_id")
    .eq("organization_id", input.organizationId)
    .in("legacy_cost_center_id", input.costCenterIds);

  if (error) {
    if (isMissingWorkUnitsRelation(error)) {
      return new Map<string, string>();
    }

    throw new Error(error.message);
  }

  return new Map(
    (((data as Array<{ id: string; legacy_cost_center_id: string | null }> | null) ?? [])
      .filter((row) => Boolean(row.legacy_cost_center_id))
      .map((row) => [row.legacy_cost_center_id as string, row.id])),
  );
}

async function ensureWorkUnitForCostCenter(input: {
  supabase: ReturnType<typeof getSupabaseServiceRoleClient>;
  costCenter: CostCenterRow;
  actorId: string | null;
}) {
  const existing = await input.supabase
    .from("work_units")
    .select("id")
    .eq("organization_id", input.costCenter.organization_id)
    .eq("legacy_cost_center_id", input.costCenter.id)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    if (isMissingWorkUnitsRelation(existing.error)) {
      return null;
    }

    throw new Error(existing.error.message);
  }

  if ((existing.data as { id?: string } | null)?.id) {
    return (existing.data as { id: string }).id;
  }

  const payload = buildWorkUnitPayloadFromLegacyCostCenter(input.costCenter, input.actorId);
  const inserted = await input.supabase
    .from("work_units")
    .insert(payload)
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? "No se pudo crear el trabajo asociado al proyecto.");
  }

  return (inserted.data as { id: string }).id;
}

export function canCreateOrganizationCostCenter(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role);
}

export function canArchiveOrganizationCostCenter(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role);
}

export function canAssignOrganizationCostCenter(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role);
}

export async function listOrganizationCostCenters(input: {
  organizationId: string;
  includeArchived?: boolean;
}) {
  const supabase = getSupabaseServiceRoleClient();
  let query = supabase
    .from("organization_cost_centers")
    .select("id, organization_id, name, description, is_active, created_at, updated_at, archived_at")
    .eq("organization_id", input.organizationId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (!input.includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data as CostCenterRow[] | null) ?? []);
  const workUnitIdsByCostCenter = await loadWorkUnitIdsByCostCenter({
    supabase,
    organizationId: input.organizationId,
    costCenterIds: rows.map((row) => row.id),
  });

  return rows.map((row) => mapCostCenterRow(row, workUnitIdsByCostCenter.get(row.id) ?? null));
}

export async function loadOrganizationDocumentsCountByCostCenter(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select("cost_center_id")
    .eq("organization_id", organizationId)
    .not("cost_center_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const counts: Record<string, number> = {};

  for (const row of (((data as Array<{ cost_center_id: string | null }> | null) ?? []))) {
    if (!row.cost_center_id) {
      continue;
    }

    counts[row.cost_center_id] = (counts[row.cost_center_id] ?? 0) + 1;
  }

  return counts;
}

export async function createOrganizationCostCenter(input: {
  organizationId: string;
  actorId: string | null;
  name: string;
  description?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const normalizedName = normalizeName(input.name);
  const normalizedDescription = input.description?.trim() ? input.description.trim() : null;

  if (normalizedName.length < 3) {
    throw new Error("El proyecto necesita al menos 3 caracteres.");
  }

  if (normalizedName.length > 120) {
    throw new Error("El proyecto no puede superar 120 caracteres.");
  }

  const { data, error } = await supabase
    .from("organization_cost_centers")
    .insert({
      organization_id: input.organizationId,
      name: normalizedName,
      description: normalizedDescription,
      created_by: input.actorId,
      updated_by: input.actorId,
    })
    .select("id, organization_id, name, description, is_active, created_at, updated_at, archived_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el proyecto.");
  }

  const { error: settingsError } = await supabase
    .from("accounting_settings")
    .upsert({
      organization_id: input.organizationId,
      uses_cost_centers: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "organization_id",
    });

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const costCenterRow = data as CostCenterRow;
  const workUnitId = await ensureWorkUnitForCostCenter({
    supabase,
    costCenter: costCenterRow,
    actorId: input.actorId,
  });

  return mapCostCenterRow(costCenterRow, workUnitId);
}

export async function archiveOrganizationCostCenter(input: {
  organizationId: string;
  costCenterId: string;
  actorId: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const archivedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("organization_cost_centers")
    .update({
      is_active: false,
      archived_at: archivedAt,
      archived_by: input.actorId,
      updated_at: archivedAt,
      updated_by: input.actorId,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.costCenterId)
    .eq("is_active", true)
    .select("id, organization_id, name, description, is_active, created_at, updated_at, archived_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No encontramos ese proyecto activo para archivar.");
  }

  const workUnitUpdate = await supabase
    .from("work_units")
    .update({
      status: "archived",
      archived_at: archivedAt,
      archived_by: input.actorId,
      updated_at: archivedAt,
      updated_by: input.actorId,
    })
    .eq("organization_id", input.organizationId)
    .eq("legacy_cost_center_id", input.costCenterId)
    .select("id")
    .maybeSingle();

  if (workUnitUpdate.error && !isMissingWorkUnitsRelation(workUnitUpdate.error)) {
    throw new Error(workUnitUpdate.error.message);
  }

  return mapCostCenterRow(
    data as CostCenterRow,
    (workUnitUpdate.data as { id?: string } | null)?.id ?? null,
  );
}

export async function assignDocumentCostCenter(input: {
  organizationId: string;
  documentId: string;
  costCenterId: string | null;
  actorId: string | null;
  assignmentSource?: CostCenterAssignmentSource;
}) {
  const supabase = getSupabaseServiceRoleClient();
  let workUnitId: string | null = null;

  if (input.costCenterId) {
    const { data: costCenter, error: costCenterError } = await supabase
      .from("organization_cost_centers")
      .select("id, organization_id, name, description, is_active, metadata, created_by, updated_by, archived_by, archived_at, created_at, updated_at")
      .eq("organization_id", input.organizationId)
      .eq("id", input.costCenterId)
      .eq("is_active", true)
      .maybeSingle();

    if (costCenterError) {
      throw new Error(costCenterError.message);
    }

    if (!costCenter?.id) {
      throw new Error("Selecciona un proyecto activo de esta organizacion.");
    }

    workUnitId = await ensureWorkUnitForCostCenter({
      supabase,
      costCenter: costCenter as CostCenterRow,
      actorId: input.actorId,
    });
  }

  const currentTimestamp = new Date().toISOString();
  const { data: documentRow, error: documentLoadError } = await supabase
    .from("documents")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId)
    .maybeSingle();

  if (documentLoadError) {
    throw new Error(documentLoadError.message);
  }

  if (!documentRow?.id) {
    throw new Error("No encontramos ese documento dentro de la organizacion actual.");
  }

  const currentMetadata =
    documentRow.metadata
    && typeof documentRow.metadata === "object"
    && !Array.isArray(documentRow.metadata)
      ? documentRow.metadata as Record<string, unknown>
      : {};
  const assignmentSource = input.assignmentSource ?? "desktop_documents";
  const { data, error } = await supabase
    .from("documents")
    .update({
      cost_center_id: input.costCenterId,
      work_unit_id: workUnitId,
      updated_at: currentTimestamp,
      metadata: buildDocumentCostCenterBridgeMetadata({
        currentMetadata,
        costCenterId: input.costCenterId,
        workUnitId,
        actorId: input.actorId,
        assignmentSource,
        assignedAt: currentTimestamp,
      }),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId)
    .select("id, cost_center_id, work_unit_id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("No encontramos ese documento dentro de la organizacion actual.");
  }

  return {
    documentId: data.id,
    costCenterId: data.cost_center_id ?? null,
    workUnitId: data.work_unit_id ?? null,
  };
}
