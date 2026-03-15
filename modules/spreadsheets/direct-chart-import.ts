import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildChartImportPreview,
  loadExistingChartAccountCodes,
  persistChartImportPreview,
} from "@/modules/accounting";
import {
  buildSpreadsheetCanonicalSections,
  interpretSpreadsheetPreview,
} from "@/modules/spreadsheets/interpreter";
import { parseSpreadsheetFile } from "@/modules/spreadsheets/parser";

export async function importChartOfAccountsSpreadsheetDirect(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorId: string | null;
  fileName: string;
  mimeType?: string | null;
  bytes: ArrayBuffer | Uint8Array;
}) {
  const preview = parseSpreadsheetFile({
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    bytes: input.bytes,
  });
  const interpretation = await interpretSpreadsheetPreview({
    organizationId: input.organizationId,
    preview,
    provider: process.env.OPENAI_API_KEY ? "auto" : "heuristic",
  });

  if (
    interpretation.importType !== "chart_of_accounts_import"
    && interpretation.importType !== "mixed"
  ) {
    throw new Error("La planilla no fue detectada como un import valido de plan de cuentas.");
  }

  const sections = buildSpreadsheetCanonicalSections({
    organizationId: input.organizationId,
    preview,
    sheetIntents: interpretation.sheetIntents,
    warnings: interpretation.warnings,
  });

  if (!sections.chartOfAccounts) {
    throw new Error("La planilla no contiene una seccion valida de plan de cuentas para importar.");
  }

  const existingAccountCodes = await loadExistingChartAccountCodes(
    input.supabase,
    input.organizationId,
  );
  const chartPreview = buildChartImportPreview({
    canonical: sections.chartOfAccounts,
    existingAccountCodes,
  });
  const persisted = await persistChartImportPreview(input.supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    preview: chartPreview,
  });

  return {
    interpretation,
    chartPreview,
    persisted,
  };
}
