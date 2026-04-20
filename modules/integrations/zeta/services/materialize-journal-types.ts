import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZetaJournalTypeRaw } from "@/modules/integrations/zeta/contracts/plan-de-cuentas";

type JsonRecord = Record<string, unknown>;

export type ZetaJournalTypesMaterializationSummary = {
  available: number;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function materializeZetaJournalTypes(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    connectionId: string;
    journalTypes: ZetaJournalTypeRaw[];
  },
): Promise<ZetaJournalTypesMaterializationSummary> {
  const availableJournalTypes = input.journalTypes
    .map((journalType) => ({
      code: asString(journalType.Codigo),
      name: asString(journalType.Nombre),
      concept: asString(journalType.Concepto),
      auxiliar_codigo: asString(journalType.AuxiliarCodigo),
      auxiliar_nombre: asString(journalType.AuxiliarNombre),
      columna_iva: asString(journalType.ColumnaIVA),
      dgi_2181: journalType.DGI2181 === "S",
      importes_negativo_auxiliares: journalType.ImportesNegativoAuxiliares === "S",
      resumir_diarios: journalType.ResumirDiarios === "S",
    }))
    .filter((journalType): journalType is {
      code: string;
      name: string;
      concept: string | null;
      auxiliar_codigo: string | null;
      auxiliar_nombre: string | null;
      columna_iva: string | null;
      dgi_2181: boolean;
      importes_negativo_auxiliares: boolean;
      resumir_diarios: boolean;
    } => Boolean(journalType.code && journalType.name));

  const { data, error } = await supabase
    .from("organization_integration_connections")
    .select("config_json")
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const config = asRecord((data as { config_json?: unknown } | null)?.config_json);
  const { error: updateError } = await supabase
    .from("organization_integration_connections")
    .update({
      config_json: {
        ...config,
        available_journal_types: availableJournalTypes,
        available_journal_types_synced_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    available: availableJournalTypes.length,
  };
}
