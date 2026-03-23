"use server";

import { revalidatePath } from "next/cache";
import type { ManualAccountRoleOverrides } from "@/modules/accounting";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { createVatRunExport } from "@/modules/exports";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { runDocumentClassification } from "@/modules/accounting/classification-runner";
import { confirmDocumentManualAssignment } from "@/modules/documents/review";
import { postDocumentProvisional } from "@/modules/documents/post-provisional-service";
import { saveTaxPeriodDocumentSelection } from "@/modules/tax/tax-period-decisions";
import { rebuildMonthlyVatRunFromConfirmations } from "@/modules/tax/vat-runs";
import { updateVatRunLifecycle } from "@/modules/tax/vat-runs";

function taxPath(slug: string) {
  return `/app/o/${slug}/tax`;
}

function documentPath(slug: string, documentId: string) {
  return `/app/o/${slug}/documents/${documentId}`;
}

function canOperateTaxWorkbench(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role);
}

export async function updateVatRunLifecycleAction(input: {
  slug: string;
  vatRunId: string;
  action: "review" | "finalize" | "lock" | "reopen";
  reason?: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!canOperateTaxWorkbench(role)) {
    return {
      ok: false,
      message: "Tu rol no puede mutar periodos IVA.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  await updateVatRunLifecycle({
    supabase,
    organizationId: organization.id,
    runId: input.vatRunId,
    actorId: authState.user?.id ?? null,
    action: input.action,
    reason: input.reason ?? null,
  });

  revalidatePath(taxPath(input.slug));

  return {
    ok: true,
    message: "Periodo IVA actualizado.",
  };
}

export async function createVatRunExportAction(input: {
  slug: string;
  vatRunId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!canOperateTaxWorkbench(role)) {
    return {
      ok: false,
      message: "Tu rol no puede generar exports.",
      downloadUrl: null,
    };
  }

  const result = await createVatRunExport({
    organizationId: organization.id,
    vatRunId: input.vatRunId,
    actorId: authState.user?.id ?? null,
  });

  revalidatePath(taxPath(input.slug));

  return {
    ok: true,
    message: "Export generado.",
    downloadUrl: result.downloadUrl,
  };
}

export async function generateVatRunDefinitiveAction(input: {
  slug: string;
  period: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!canOperateTaxWorkbench(role)) {
    return {
      ok: false,
      message: "Tu rol no puede generar la corrida definitiva de IVA.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  await rebuildMonthlyVatRunFromConfirmations(
    supabase,
    organization.id,
    input.period,
    authState.user?.id ?? null,
  );

  revalidatePath(taxPath(input.slug));

  return {
    ok: true,
    message: "Corrida definitiva de IVA regenerada desde la simulacion actual.",
  };
}

export async function saveTaxPeriodDocumentSelectionAction(input: {
  slug: string;
  period: string;
  documentIds: string[];
  selectionStatus: "confirmed_for_period" | "excluded_from_period";
  note?: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!canOperateTaxWorkbench(role)) {
    return {
      ok: false,
      message: "Tu rol no puede resolver la bandeja fiscal del periodo.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  const result = await saveTaxPeriodDocumentSelection(supabase, {
    organizationId: organization.id,
    period: input.period,
    documentIds: input.documentIds,
    selectionStatus: input.selectionStatus,
    actorId: authState.user?.id ?? null,
    note: input.note ?? null,
    metadata: {
      origin: "tax_period_workbench",
    },
  });

  revalidatePath(taxPath(input.slug));

  return result;
}

export async function runTaxWorkbenchDocumentAction(input: {
  slug: string;
  period: string;
  documentIds: string[];
  action: "reclassify" | "confirm_manual" | "post_provisional";
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!canOperateTaxWorkbench(role)) {
    return {
      ok: false,
      message: "Tu rol no puede ejecutar acciones fiscales operativas.",
    };
  }

  const actorId = authState.user?.id ?? null;
  const documentIds = Array.from(
    new Set(input.documentIds.filter((documentId) => typeof documentId === "string" && documentId.trim().length > 0)),
  );

  if (documentIds.length === 0) {
    return {
      ok: false,
      message: "Selecciona al menos un documento para ejecutar la accion.",
    };
  }

  for (const documentId of documentIds) {
    if (input.action === "reclassify") {
      await runDocumentClassification({
        organizationId: organization.id,
        documentId,
        actorId,
      });
    } else if (input.action === "confirm_manual") {
      await confirmDocumentManualAssignment({
        organizationId: organization.id,
        documentId,
        actorId,
      });
    } else if (input.action === "post_provisional") {
      await postDocumentProvisional({
        organizationId: organization.id,
        documentId,
        actorId,
      });
    }

    revalidatePath(documentPath(input.slug, documentId));
  }

  revalidatePath(taxPath(input.slug));

  return {
    ok: true,
    message:
      input.action === "reclassify"
        ? `${documentIds.length} documento(s) enviados a reclasificacion.`
        : input.action === "confirm_manual"
          ? `${documentIds.length} documento(s) consolidados como revision manual.`
          : `${documentIds.length} documento(s) posteados provisionalmente.`,
  };
}

export async function confirmTaxWorkbenchManualAssignmentAction(input: {
  slug: string;
  documentId: string;
  manualRoleOverrides?: ManualAccountRoleOverrides | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!canOperateTaxWorkbench(role)) {
    return {
      ok: false,
      message: "Tu rol no puede resolver manualmente este documento desde Impuestos.",
    };
  }

  const result = await confirmDocumentManualAssignment({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    manualRoleOverrides: input.manualRoleOverrides ?? null,
  });

  revalidatePath(taxPath(input.slug));
  revalidatePath(documentPath(input.slug, input.documentId));

  return result;
}
