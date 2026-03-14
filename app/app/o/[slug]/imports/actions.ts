"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  attachDocumentToImportOperation,
  createImportOperation,
  updateImportOperationStatus,
} from "@/modules/imports";
import { rebuildMonthlyVatRunFromConfirmations } from "@/modules/tax/vat-runs";
import {
  appendSpreadsheetStatusEvent,
  cancelSpreadsheetImport,
  confirmCompletedSpreadsheetImport,
  loadSpreadsheetImportRun,
  materializeSpreadsheetImportRun,
  retrySpreadsheetImport,
  runSpreadsheetImport,
  updateSpreadsheetImportRun,
} from "@/modules/spreadsheets";
import {
  formatImportOperationStatusLabel,
  formatLifecycleStatusLabel,
  formatSpreadsheetImportTypeLabel,
} from "@/modules/presentation/labels";

function buildPaths(slug: string) {
  return {
    imports: `/app/o/${slug}/imports`,
    tax: `/app/o/${slug}/tax`,
  };
}

export async function uploadSpreadsheetImportAction(input: {
  slug: string;
  formData: FormData;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!["owner", "admin", "accountant", "reviewer", "operator"].includes(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede importar planillas.",
    };
  }

  const file = input.formData.get("spreadsheet");
  const preferredModeRaw = String(input.formData.get("preferredMode") ?? "auto");

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Selecciona una planilla valida antes de importar.",
    };
  }

  const run = await runSpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    fileName: file.name,
    mimeType: file.type,
    bytes: await file.arrayBuffer(),
    preferredMode:
      preferredModeRaw === "interactive" || preferredModeRaw === "batch"
        ? preferredModeRaw
        : null,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);
  revalidatePath(paths.tax);

  return {
    ok: true,
    message: `Importacion ${formatLifecycleStatusLabel(run.status).toLowerCase()} para ${run.fileName}.`,
  };
}

export async function retrySpreadsheetImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const run = await retrySpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    runId: input.runId,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);
  revalidatePath(paths.tax);

  return {
    ok: true,
    message: `Reintento ${run.retryCount} lanzado para ${run.fileName}.`,
  };
}

export async function cancelSpreadsheetImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const run = await cancelSpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    runId: input.runId,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);

  return {
    ok: true,
    message: `Importacion cancelada para ${run.fileName}.`,
  };
}

export async function confirmSpreadsheetImportAction(input: {
  slug: string;
  runId: string;
  selectedSections?: Array<
    "historical_vat_liquidation"
    | "chart_of_accounts_import"
    | "journal_template_import"
  >;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = getSupabaseServiceRoleClient();
  const currentRun = await loadSpreadsheetImportRun(
    supabase,
    organization.id,
    input.runId,
  );

  if (!currentRun) {
    return {
      ok: false,
      message: "No se encontro el import run solicitado.",
    };
  }

  const materialized = await materializeSpreadsheetImportRun(supabase, {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    run: currentRun,
    selectedSections: input.selectedSections ?? null,
  });
  const confirmed = await confirmCompletedSpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    runId: input.runId,
    actorId: authState.user?.id ?? null,
  });
  await updateSpreadsheetImportRun(supabase, {
    organizationId: organization.id,
    runId: confirmed.id,
    statusEvents: appendSpreadsheetStatusEvent(
      confirmed.statusEvents,
      "materialized",
      materialized.notes.join(" ") || "Import confirmado sin materializacion adicional.",
    ),
    metadata: {
      ...confirmed.metadata,
      materialized_sections: materialized.sections,
      materialization_stats: materialized.stats,
      materialization_notes: materialized.notes,
    },
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);
  revalidatePath(paths.tax);

  return {
    ok: true,
    message: materialized.sections.length > 0
      ? `Vista previa confirmada para ${confirmed.fileName}. Se materializaron: ${materialized.sections.map((section) => formatSpreadsheetImportTypeLabel(section)).join(", ")}.`
      : `Vista previa confirmada para ${confirmed.fileName}.`,
  };
}

export async function createImportOperationAction(input: {
  slug: string;
  formData: FormData;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const operationId = await createImportOperation(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    referenceCode: String(input.formData.get("referenceCode") ?? "").trim() || null,
    duaNumber: String(input.formData.get("duaNumber") ?? "").trim() || null,
    duaYear: String(input.formData.get("duaYear") ?? "").trim() || null,
    customsBrokerName: String(input.formData.get("customsBrokerName") ?? "").trim() || null,
    supplierName: String(input.formData.get("supplierName") ?? "").trim() || null,
    supplierTaxId: String(input.formData.get("supplierTaxId") ?? "").trim() || null,
    currencyCode: String(input.formData.get("currencyCode") ?? "").trim() || null,
    operationDate: String(input.formData.get("operationDate") ?? "").trim() || null,
    paymentDate: String(input.formData.get("paymentDate") ?? "").trim() || null,
  });

  revalidatePath(buildPaths(input.slug).imports);

  return {
    ok: true,
    message: `Operacion de importacion creada (${operationId}).`,
  };
}

export async function attachDocumentToImportOperationAction(input: {
  slug: string;
  formData: FormData;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const importOperationId = String(input.formData.get("importOperationId") ?? "").trim();
  const documentId = String(input.formData.get("documentId") ?? "").trim();

  if (!importOperationId || !documentId) {
    return {
      ok: false,
      message: "Selecciona una operacion y un documento validos.",
    };
  }

  await attachDocumentToImportOperation(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    importOperationId,
    documentId,
  });

  revalidatePath(buildPaths(input.slug).imports);
  revalidatePath(buildPaths(input.slug).tax);

  return {
    ok: true,
    message: "Documento vinculado a la operacion de importacion.",
  };
}

export async function updateImportOperationStatusAction(input: {
  slug: string;
  importOperationId: string;
  status: "approved" | "blocked_manual_review" | "ready_for_review";
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = getSupabaseServiceRoleClient();
  await updateImportOperationStatus(supabase, {
    organizationId: organization.id,
    importOperationId: input.importOperationId,
    status: input.status,
  });

  if (input.status === "approved") {
    const { data, error } = await supabase
      .from("organization_import_operations")
      .select("operation_date, payment_date")
      .eq("organization_id", organization.id)
      .eq("id", input.importOperationId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const periodDate = typeof data?.operation_date === "string"
      ? data.operation_date
      : typeof data?.payment_date === "string"
        ? data.payment_date
        : null;

    if (periodDate) {
      await rebuildMonthlyVatRunFromConfirmations(
        supabase,
        organization.id,
        periodDate,
        null,
      );
    }
  }

  revalidatePath(buildPaths(input.slug).imports);
  revalidatePath(buildPaths(input.slug).tax);

  return {
    ok: true,
    message: `Operacion actualizada a ${formatImportOperationStatusLabel(input.status).toLowerCase()}.`,
  };
}
