import { createHash } from "crypto";
import "server-only";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { buildAccountingExportArtifact } from "@/modules/exports/accounting-adapters";
import { getAccountingExportLayout } from "@/modules/exports/external-system-layouts";
import { buildVatRunExcelWorkbook } from "@/modules/exports/excel-workbook";
import {
  loadAccountingExportDataset,
  loadVatRunExportDataset,
} from "@/modules/exports/repository";
import type { ExportJobResult } from "@/modules/exports/types";

function buildStoragePath(input: {
  organizationId: string;
  exportId: string;
  periodLabel: string;
}) {
  return `orgs/${input.organizationId}/vat-runs/${input.periodLabel}/export-${input.exportId}.xml`;
}

function buildAccountingStoragePath(input: {
  organizationId: string;
  exportId: string;
  periodLabel: string;
  layoutExtension: string;
}) {
  return `orgs/${input.organizationId}/accounting-exports/${input.periodLabel}/export-${input.exportId}.${input.layoutExtension}`;
}

async function recordExportAuditEvent(input: {
  organizationId: string;
  actorId: string | null;
  exportId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "export",
      entity_id: input.exportId,
      action: input.action,
      metadata: input.metadata ?? {},
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function persistVatFormExportSummary(input: {
  organizationId: string;
  vatRunId: string;
  exportId: string;
  actorId: string | null;
  summary: {
    formCode: string;
    lines: unknown[];
    warnings: string[];
  };
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("vat_form_exports")
    .insert({
      organization_id: input.organizationId,
      vat_run_id: input.vatRunId,
      export_id: input.exportId,
      form_code: input.summary.formCode,
      lines_json: input.summary.lines,
      warnings_json: input.summary.warnings,
      created_by: input.actorId,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createVatRunExport(input: {
  organizationId: string;
  vatRunId: string;
  actorId: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: exportRow, error: createError } = await supabase
    .from("exports")
    .insert({
      organization_id: input.organizationId,
      export_type: "vat_period_excel",
      export_scope: "vat_period",
      target_system: "excel_xml",
      target_id: input.vatRunId,
      status: "queued",
      created_by: input.actorId,
    })
    .select("id")
    .limit(1)
    .single();

  if (createError || !exportRow?.id) {
    throw new Error(createError?.message ?? "No se pudo crear el job de export.");
  }

  const exportId = exportRow.id as string;

  try {
    await supabase
      .from("exports")
      .update({
        status: "generating",
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    const dataset = await loadVatRunExportDataset(
      supabase,
      input.organizationId,
      input.vatRunId,
    );

    if (
      dataset.traceability.length === 0
      && dataset.journalEntries.length === 0
      && dataset.imports.length === 0
      && dataset.dgiFormSummary.lines.length === 0
    ) {
      throw new Error("El modelo canonico aprobado esta incompleto para generar el export.");
    }

    const workbook = buildVatRunExcelWorkbook(dataset);
    const checksum = createHash("sha256").update(workbook).digest("hex");
    const storagePath = buildStoragePath({
      organizationId: input.organizationId,
      exportId,
      periodLabel: dataset.periodLabel,
    });
    const filename = `convertilabs-${dataset.periodLabel}.xml`;
    const uploadResult = await supabase.storage
      .from("exports-private")
      .upload(storagePath, Buffer.from(workbook, "utf8"), {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }

    await supabase
      .from("exports")
      .update({
        status: "generated",
        storage_path: storagePath,
        artifact_filename: filename,
        artifact_mime_type: "application/xml",
        payload_json: {
          vat_run_id: input.vatRunId,
          period_label: dataset.periodLabel,
          dgi_form_code: dataset.dgiFormSummary.formCode,
          canonical_tax_payload: dataset.canonicalTaxPayload,
        },
        checksum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    await recordExportAuditEvent({
      organizationId: input.organizationId,
      actorId: input.actorId,
      exportId,
      action: "export:generated",
      metadata: {
        vat_run_id: input.vatRunId,
      },
    });
    await persistVatFormExportSummary({
      organizationId: input.organizationId,
      vatRunId: input.vatRunId,
      exportId,
      actorId: input.actorId,
      summary: {
        formCode: dataset.dgiFormSummary.formCode,
        lines: dataset.dgiFormSummary.lines,
        warnings: dataset.dgiFormSummary.warnings,
      },
    });

    const { data: signedUrlData } = await supabase.storage
      .from("exports-private")
      .createSignedUrl(storagePath, 60 * 10);

    return {
      exportId,
      status: "generated",
      storagePath,
      downloadUrl: signedUrlData?.signedUrl ?? null,
    } satisfies ExportJobResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el export.";

    await supabase
      .from("exports")
      .update({
        status: "failed",
        failure_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    await recordExportAuditEvent({
      organizationId: input.organizationId,
      actorId: input.actorId,
      exportId,
      action: "export:failed",
      metadata: {
        error: message,
      },
    });

    throw new Error(message);
  }
}

export async function loadRecentExports(
  organizationId: string,
  targetId?: string,
) {
  const supabase = getSupabaseServiceRoleClient();
  let query = supabase
    .from("exports")
    .select(
      "id, export_type, target_system, target_id, status, storage_path, artifact_filename, artifact_mime_type, failure_message, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (targetId) {
    query = query.eq("target_id", targetId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all((((data as Array<{
    id: string;
    export_type: string;
    target_system: string;
    target_id: string | null;
    status: string;
    storage_path: string | null;
    artifact_filename: string | null;
    artifact_mime_type: string | null;
    failure_message: string | null;
    created_at: string;
    updated_at: string;
  }> | null) ?? [])).map(async (row) => {
    const signedUrl = row.storage_path
      ? (await supabase.storage
          .from("exports-private")
          .createSignedUrl(row.storage_path, 60 * 10)).data?.signedUrl ?? null
      : null;

    return {
      id: row.id,
      exportType: row.export_type,
      targetSystem: row.target_system,
      targetId: row.target_id,
      status: row.status,
      filename: row.artifact_filename,
      mimeType: row.artifact_mime_type,
      failureMessage: row.failure_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      downloadUrl: signedUrl,
    };
  }));
}

export async function createAccountingExport(input: {
  organizationId: string;
  actorId: string | null;
  periodYear: number;
  periodMonth: number;
  scope: "posted_provisional" | "posted_final" | "all_posted";
  layoutCode: "generic_csv" | "generic_excel_xml";
}) {
  const supabase = getSupabaseServiceRoleClient();
  const layout = getAccountingExportLayout(input.layoutCode);

  if (!layout) {
    throw new Error("Layout de exportacion contable no soportado.");
  }

  const periodLabel = `${input.periodYear}-${String(input.periodMonth).padStart(2, "0")}`;
  const { data: exportRow, error: createError } = await supabase
    .from("exports")
    .insert({
      organization_id: input.organizationId,
      export_type: input.layoutCode === "generic_csv"
        ? "accounting_journals_csv"
        : "accounting_journals_excel",
      export_scope: "accounting_period",
      target_system: input.layoutCode,
      status: "queued",
      created_by: input.actorId,
      payload_json: {
        period_year: input.periodYear,
        period_month: input.periodMonth,
        scope: input.scope,
      },
    })
    .select("id")
    .limit(1)
    .single();

  if (createError || !exportRow?.id) {
    throw new Error(createError?.message ?? "No se pudo crear el export contable.");
  }

  const exportId = exportRow.id as string;

  try {
    await supabase
      .from("exports")
      .update({
        status: "generating",
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    const dataset = await loadAccountingExportDataset(supabase, input.organizationId, {
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      scope: input.scope,
    });

    if (dataset.rows.length === 0) {
      throw new Error("No hay asientos para exportar con el filtro seleccionado.");
    }

    const artifact = buildAccountingExportArtifact({
      dataset,
      layoutCode: input.layoutCode,
    });
    const checksum = createHash("sha256").update(artifact).digest("hex");
    const storagePath = buildAccountingStoragePath({
      organizationId: input.organizationId,
      exportId,
      periodLabel,
      layoutExtension: layout.fileExtension,
    });
    const uploadResult = await supabase.storage
      .from("exports-private")
      .upload(storagePath, Buffer.from(artifact, "utf8"), {
        contentType: layout.mimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }

    await supabase
      .from("exports")
      .update({
        status: "generated",
        storage_path: storagePath,
        artifact_filename: `convertilabs-contable-${periodLabel}.${layout.fileExtension}`,
        artifact_mime_type: layout.mimeType,
        payload_json: {
          period_year: input.periodYear,
          period_month: input.periodMonth,
          period_label: periodLabel,
          scope: input.scope,
          layout_code: input.layoutCode,
          warnings: dataset.warnings,
          rows: dataset.rows.length,
          recategorization_queue: dataset.recategorizationQueue.length,
          dgi_differences: dataset.dgiDifferences.length,
        },
        checksum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    await recordExportAuditEvent({
      organizationId: input.organizationId,
      actorId: input.actorId,
      exportId,
      action: "export:generated",
      metadata: {
        export_family: "accounting",
        scope: input.scope,
        layout_code: input.layoutCode,
        period_label: periodLabel,
      },
    });

    const { data: signedUrlData } = await supabase.storage
      .from("exports-private")
      .createSignedUrl(storagePath, 60 * 10);

    return {
      exportId,
      status: "generated",
      storagePath,
      downloadUrl: signedUrlData?.signedUrl ?? null,
    } satisfies ExportJobResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el export contable.";

    await supabase
      .from("exports")
      .update({
        status: "failed",
        failure_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    await recordExportAuditEvent({
      organizationId: input.organizationId,
      actorId: input.actorId,
      exportId,
      action: "export:failed",
      metadata: {
        export_family: "accounting",
        error: message,
      },
    });

    throw new Error(message);
  }
}
