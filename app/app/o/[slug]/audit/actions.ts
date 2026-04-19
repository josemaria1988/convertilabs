"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { applyDocumentAuditPreviewDecisions } from "@/modules/audit/document-import-audit";
import { enqueueDocumentSpreadsheetImport } from "@/modules/documents/spreadsheet-import-background";
import {
  runZetaSync,
  type ZetaSyncStream,
} from "@/modules/integrations/zeta/services/sync-service";
import {
  formatDocumentSpreadsheetImportStatusMessage,
  isDocumentSpreadsheetImportType,
  summarizeDocumentSpreadsheetImportRun,
} from "@/modules/documents/spreadsheet-import-runs";
import { cancelSpreadsheetImport, loadSpreadsheetImportRun } from "@/modules/spreadsheets";
import type { DocumentSpreadsheetLedgerKind } from "@/modules/documents/spreadsheet-batch-import";

function buildPaths(slug: string) {
  return {
    audit: `/app/o/${slug}/audit`,
    documents: `/app/o/${slug}/documents`,
  };
}

function canRunAudit(role: string) {
  return role !== "viewer";
}

function parseZetaDocumentStream(value: FormDataEntryValue | null): ZetaSyncStream {
  const stream = typeof value === "string" ? value : "";

  if (stream === "sales_documents" || stream === "received_cfes") {
    return stream;
  }

  throw new Error("Selecciona si quieres sincronizar compras o ventas desde Zetasoftware.");
}

function isAcceptedSpreadsheetFile(fileName: string, mimeType: string) {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();

  return (
    normalizedName.endsWith(".csv")
    || normalizedName.endsWith(".tsv")
    || normalizedName.endsWith(".xlsx")
    || normalizedName.endsWith(".xls")
    || normalizedMime.includes("text/csv")
    || normalizedMime.includes("tab-separated")
    || normalizedMime.includes("spreadsheetml.sheet")
    || normalizedMime.includes("ms-excel")
  );
}

function revalidateAuditSurfaces(slug: string) {
  const paths = buildPaths(slug);
  revalidatePath(paths.audit);
  revalidatePath(paths.documents);
}

export async function createDocumentAuditImportAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ledgerKindValue = String(formData.get("ledgerKind") ?? "purchase");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canRunAudit(organization.role)) {
    return {
      ok: false,
      runId: null,
      importableRowsDetected: 0,
      message: "Tu rol no puede iniciar auditorias de importacion documental.",
    };
  }

  const spreadsheet = formData.get("spreadsheet");

  if (!(spreadsheet instanceof File) || spreadsheet.size === 0) {
    return {
      ok: false,
      runId: null,
      importableRowsDetected: 0,
      message: "Selecciona una planilla valida antes de iniciar la auditoria.",
    };
  }

  if (!isAcceptedSpreadsheetFile(spreadsheet.name, spreadsheet.type)) {
    return {
      ok: false,
      runId: null,
      importableRowsDetected: 0,
      message: "La auditoria documental admite .csv, .tsv, .xlsx y .xls en variantes compatibles.",
    };
  }

  const ledgerKind: DocumentSpreadsheetLedgerKind =
    ledgerKindValue === "sale" ? "sale" : "purchase";
  const result = await enqueueDocumentSpreadsheetImport({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    file: spreadsheet,
    ledgerKind,
  });

  revalidateAuditSurfaces(slug);

  return {
    ok: result.ok,
    runId: result.runId,
    importableRowsDetected: result.importableRowsDetected,
    message: result.message,
  };
}

export async function runZetaDocumentSyncFromAuditAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canRunAudit(organization.role)) {
    throw new Error("Tu rol no puede iniciar sincronizaciones documentales.");
  }

  const stream = parseZetaDocumentStream(formData.get("stream"));
  const period = String(formData.get("period") ?? "").trim();
  const maxPagesRaw = Number(formData.get("maxPages") ?? 200);
  const maxPages = Number.isFinite(maxPagesRaw) ? maxPagesRaw : 200;

  await runZetaSync({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    actorUserId: authState.user?.id ?? null,
    stream,
    period,
    maxPages,
  });

  revalidateAuditSurfaces(slug);
  revalidatePath(`/app/o/${organization.slug}/tax`);
  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/settings?tab=integrations`);
}

export async function loadDocumentAuditImportStatusesAction(input: {
  slug: string;
  runIds: string[];
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = getSupabaseServiceRoleClient();
  const uniqueRunIds = Array.from(new Set(input.runIds.filter(Boolean))).slice(0, 12);

  if (uniqueRunIds.length === 0) {
    return [];
  }

  const runs = await Promise.all(uniqueRunIds.map((runId) =>
    loadSpreadsheetImportRun(supabase, organization.id, runId)));

  return runs
    .filter((run): run is NonNullable<typeof run> => Boolean(run))
    .filter((run) => isDocumentSpreadsheetImportType(run.importType))
    .map((run) => {
      const summary = summarizeDocumentSpreadsheetImportRun(run);

      return {
        ...summary,
        message: formatDocumentSpreadsheetImportStatusMessage(summary),
      };
    });
}

export async function cancelDocumentAuditImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = getSupabaseServiceRoleClient();
  const existingRun = await loadSpreadsheetImportRun(supabase, organization.id, input.runId);

  if (!existingRun || !isDocumentSpreadsheetImportType(existingRun.importType)) {
    throw new Error("No encontramos una auditoria documental en segundo plano para cancelar.");
  }

  const run = await cancelSpreadsheetImport({
    supabase,
    organizationId: organization.id,
    runId: input.runId,
  });

  revalidateAuditSurfaces(input.slug);

  return {
    ok: true,
    message: `Auditoria cancelada para ${run.fileName}.`,
  };
}

export async function applyDocumentAuditPreviewDecisionsAction(input: {
  slug: string;
  runId: string;
  acceptRowIds?: string[];
  rejectRowIds?: string[];
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canRunAudit(organization.role)) {
    throw new Error("Tu rol no puede decidir sobre auditorias documentales.");
  }

  const result = await applyDocumentAuditPreviewDecisions({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    runId: input.runId,
    acceptRowIds: input.acceptRowIds,
    rejectRowIds: input.rejectRowIds,
  });

  revalidateAuditSurfaces(input.slug);

  return {
    ok: true,
    status: result.run.status,
    previewCounts: result.previewCounts,
    message: result.message,
  };
}
