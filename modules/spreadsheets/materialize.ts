import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildChartImportPreview,
  buildTemplateImportPreview,
  loadExistingChartAccountCodes,
  loadExistingConceptCodes,
  persistChartImportPreview,
  persistTemplateImportPreview,
} from "@/modules/accounting";
import { buildSpreadsheetCanonicalSections } from "@/modules/spreadsheets/interpreter";
import type {
  SpreadsheetImportRunRecord,
  SpreadsheetImportType,
} from "@/modules/spreadsheets/types";

export type SpreadsheetMaterializedSection =
  | "historical_vat_liquidation"
  | "chart_of_accounts_import"
  | "journal_template_import";

export type SpreadsheetMaterializationSummary = {
  sections: SpreadsheetMaterializedSection[];
  notes: string[];
  stats: Record<string, number>;
};

function normalizeSelectedSections(
  run: SpreadsheetImportRunRecord,
  selectedSections?: SpreadsheetMaterializedSection[] | null,
) {
  if (selectedSections && selectedSections.length > 0) {
    return Array.from(new Set(selectedSections));
  }

  if (run.importType === "mixed") {
    return [
      "historical_vat_liquidation",
      "chart_of_accounts_import",
      "journal_template_import",
    ] satisfies SpreadsheetMaterializedSection[];
  }

  if (run.importType === "historical_vat_liquidation") {
    return ["historical_vat_liquidation"] satisfies SpreadsheetMaterializedSection[];
  }

  if (run.importType === "chart_of_accounts_import") {
    return ["chart_of_accounts_import"] satisfies SpreadsheetMaterializedSection[];
  }

  if (run.importType === "journal_template_import") {
    return ["journal_template_import"] satisfies SpreadsheetMaterializedSection[];
  }

  return [] satisfies SpreadsheetMaterializedSection[];
}

export async function materializeSpreadsheetImportRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    run: SpreadsheetImportRunRecord;
    selectedSections?: SpreadsheetMaterializedSection[] | null;
  },
) {
  if (!input.run.preview || !input.run.result) {
    throw new Error("El import run no tiene preview y resultado suficientes para materializar.");
  }

  const sections = buildSpreadsheetCanonicalSections({
    organizationId: input.organizationId,
    preview: input.run.preview,
    sheetIntents: input.run.result.sheetIntents,
    warnings: input.run.result.warnings,
  });
  const selectedSections = normalizeSelectedSections(input.run, input.selectedSections);
  const notes: string[] = [];
  const stats: Record<string, number> = {};
  const materializedSections: SpreadsheetMaterializedSection[] = [];

  if (selectedSections.includes("historical_vat_liquidation") && sections.historicalVat) {
    materializedSections.push("historical_vat_liquidation");
    stats.historicalPeriods = sections.historicalVat.periods.length;
    notes.push(`Se confirmaron ${sections.historicalVat.periods.length} periodo(s) historicos para timeline fiscal.`);
  }

  if (selectedSections.includes("chart_of_accounts_import") && sections.chartOfAccounts) {
    const existingAccountCodes = await loadExistingChartAccountCodes(
      supabase,
      input.organizationId,
    );
    const preview = buildChartImportPreview({
      canonical: sections.chartOfAccounts,
      existingAccountCodes,
    });
    const persisted = await persistChartImportPreview(supabase, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      preview,
    });

    materializedSections.push("chart_of_accounts_import");
    stats.insertedAccounts = persisted.insertedCount;
    stats.skippedAccounts = persisted.skippedCount;
    notes.push(`Plan de cuentas importado: ${persisted.insertedCount} cuenta(s) nuevas.`);
  }

  if (selectedSections.includes("journal_template_import") && sections.journalTemplates) {
    const [availableAccountCodes, existingConceptCodes] = await Promise.all([
      loadExistingChartAccountCodes(supabase, input.organizationId),
      loadExistingConceptCodes(supabase, input.organizationId),
    ]);
    const preview = buildTemplateImportPreview({
      canonical: sections.journalTemplates,
      availableAccountCodes,
      existingConceptCodes,
    });
    const persisted = await persistTemplateImportPreview(supabase, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      preview,
    });

    materializedSections.push("journal_template_import");
    stats.insertedConcepts = persisted.conceptCount;
    stats.insertedRules = persisted.ruleCount;
    stats.skippedTemplates = persisted.skippedCount;
    notes.push(`Plantillas contables importadas: ${persisted.conceptCount} concepto(s) y ${persisted.ruleCount} regla(s).`);
  }

  return {
    sections: materializedSections,
    notes,
    stats,
  } satisfies SpreadsheetMaterializationSummary;
}

export function canMaterializeSpreadsheetImportType(importType: SpreadsheetImportType) {
  return importType !== "unsupported";
}
