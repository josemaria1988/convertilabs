import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyConceptCode } from "@/modules/accounting/normalization";
import type { JournalTemplateImportCanonical } from "@/modules/spreadsheets/types";

export type TemplateImportStatus =
  | "ready"
  | "missing_main_account"
  | "duplicate_concept_in_import"
  | "duplicate_concept_existing";

export type TemplateImportPreviewRow = {
  rowNumber: number;
  templateName: string;
  conceptCode: string;
  conceptName: string;
  documentRole: "purchase" | "sale" | "other";
  operationCategory: string | null;
  mainAccountCode: string | null;
  vatAccountCode: string | null;
  counterpartyAccountCode: string | null;
  status: TemplateImportStatus;
  warnings: string[];
};

export type TemplateImportPreview = {
  templates: TemplateImportPreviewRow[];
  warnings: string[];
  readyCount: number;
  blockedCount: number;
};

function normalizeDocumentRole(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "sale") {
    return "sale" as const;
  }

  if (normalized === "other") {
    return "other" as const;
  }

  return "purchase" as const;
}

export function buildTemplateImportPreview(input: {
  canonical: JournalTemplateImportCanonical;
  availableAccountCodes: string[];
  existingConceptCodes?: string[];
}) {
  const availableAccountCodes = new Set(input.availableAccountCodes.map((code) => code.trim()));
  const existingConceptCodes = new Set((input.existingConceptCodes ?? []).map((code) => code.trim()));
  const seenConceptCodes = new Set<string>();
  const templates = input.canonical.templates.map((template, index) => {
    const templateName = template.templateName.trim() || `Plantilla ${index + 1}`;
    const conceptName = (template.conceptName ?? templateName).trim();
    const conceptCode = (
      slugifyConceptCode(conceptName)
      ?? slugifyConceptCode(templateName)
      ?? `template_${index + 1}`
    );
    const documentRole = normalizeDocumentRole(template.documentRole);
    const warnings: string[] = [];
    let status: TemplateImportStatus = "ready";

    if (!template.mainAccountCode || !availableAccountCodes.has(template.mainAccountCode.trim())) {
      status = "missing_main_account";
      warnings.push("La cuenta principal no existe en el plan de cuentas disponible.");
    } else if (seenConceptCodes.has(conceptCode)) {
      status = "duplicate_concept_in_import";
      warnings.push("El concepto canonico se repite dentro del mismo import.");
    } else if (existingConceptCodes.has(conceptCode)) {
      status = "duplicate_concept_existing";
      warnings.push("El concepto ya existe en la organizacion.");
    }

    seenConceptCodes.add(conceptCode);

    return {
      rowNumber: index + 1,
      templateName,
      conceptCode,
      conceptName,
      documentRole,
      operationCategory: template.operationCategory ?? null,
      mainAccountCode: template.mainAccountCode?.trim() ?? null,
      vatAccountCode: template.vatAccountCode?.trim() ?? null,
      counterpartyAccountCode: template.counterpartyAccountCode?.trim() ?? null,
      status,
      warnings,
    } satisfies TemplateImportPreviewRow;
  });
  const blockedCount = templates.filter((template) => template.status !== "ready").length;

  return {
    templates,
    warnings: [
      ...input.canonical.warnings,
      ...(blockedCount > 0
        ? [`${blockedCount} plantilla(s) quedaron bloqueadas por validacion.`]
        : []),
    ],
    readyCount: templates.length - blockedCount,
    blockedCount,
  } satisfies TemplateImportPreview;
}

export async function loadExistingConceptCodes(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_concepts")
    .select("code")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ code: string }> | null) ?? []).map((row) => row.code);
}

async function loadAccountIdsByCode(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (((data as Array<{ id: string; code: string }> | null) ?? [])).map((row) => [row.code, row.id]),
  );
}

export async function persistTemplateImportPreview(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    preview: TemplateImportPreview;
  },
) {
  const readyRows = input.preview.templates.filter((template) => template.status === "ready");

  if (readyRows.length === 0) {
    return {
      conceptCount: 0,
      ruleCount: 0,
      skippedCount: input.preview.templates.length,
    };
  }

  const accountIdsByCode = await loadAccountIdsByCode(supabase, input.organizationId);
  const conceptPayload = readyRows.map((template) => ({
    organization_id: input.organizationId,
    code: template.conceptCode,
    canonical_name: template.conceptName,
    description: template.templateName,
    document_role: template.documentRole,
    default_account_id: template.mainAccountCode ? accountIdsByCode.get(template.mainAccountCode) ?? null : null,
    default_vat_profile_json:
      template.vatAccountCode
        ? {
            vat_bucket: template.documentRole === "sale" ? "output_vat" : "input_creditable",
            vat_account_code: template.vatAccountCode,
          }
        : {},
    default_operation_category: template.operationCategory,
    metadata: {
      source: "spreadsheet_import_template",
      template_name: template.templateName,
      counterparty_account_code: template.counterpartyAccountCode,
      imported_by: input.actorId,
    },
  }));
  const { data: concepts, error: conceptError } = await supabase
    .from("organization_concepts")
    .insert(conceptPayload)
    .select("id, code");

  if (conceptError) {
    throw new Error(conceptError.message);
  }

  const conceptIdByCode = new Map(
    (((concepts as Array<{ id: string; code: string }> | null) ?? [])).map((row) => [row.code, row.id]),
  );
  const rulePayload = readyRows.flatMap((template) => {
    const conceptId = conceptIdByCode.get(template.conceptCode);
    const accountId = template.mainAccountCode
      ? accountIdsByCode.get(template.mainAccountCode) ?? null
      : null;

    if (!conceptId || !accountId) {
      return [];
    }

    return [{
      organization_id: input.organizationId,
      scope: "concept_global",
      document_id: null,
      vendor_id: null,
      concept_id: conceptId,
      document_role: template.documentRole,
      account_id: accountId,
      vat_profile_json:
        template.vatAccountCode
          ? {
              vat_bucket: template.documentRole === "sale" ? "output_vat" : "input_creditable",
              vat_account_code: template.vatAccountCode,
            }
          : {},
      operation_category: template.operationCategory,
      linked_operation_type: null,
      priority: 800,
      source: "imported_template",
      created_by: input.actorId,
      approved_by: input.actorId,
      metadata: {
        template_name: template.templateName,
        counterparty_account_code: template.counterpartyAccountCode,
      },
    }];
  });

  if (rulePayload.length > 0) {
    const { error: ruleError } = await supabase
      .from("accounting_rules")
      .insert(rulePayload);

    if (ruleError) {
      throw new Error(ruleError.message);
    }
  }

  return {
    conceptCount: conceptPayload.length,
    ruleCount: rulePayload.length,
    skippedCount: input.preview.templates.length - readyRows.length,
  };
}
