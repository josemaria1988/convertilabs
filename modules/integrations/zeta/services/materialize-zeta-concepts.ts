import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZetaConceptoRaw } from "@/modules/integrations/zeta/contracts/plan-de-cuentas";

type ZetaConceptMaterializationSummary = {
  linked: number;
  skipped: number;
  missingAccount: number;
  failed: number;
  warnings: string[];
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function findZetaChartAccountId(
  supabase: SupabaseClient,
  organizationId: string,
  externalCode: string,
) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_provider", "zetasoftware")
    .eq("external_code", externalCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return asString((data as { id?: unknown } | null)?.id);
}

async function linkConceptToAccount(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    concept: ZetaConceptoRaw;
    accountId: string;
    runId?: string | null;
  },
) {
  const { error } = await supabase
    .from("integration_entity_links")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: "zetasoftware",
        external_entity_type: "concept",
        external_key: input.concept.Codigo,
        local_entity_type: "chart_account",
        local_entity_id: input.accountId,
        match_method: "zeta_concept_codigo_contable",
        confidence: 1,
        status: "active",
        created_by_run_id: input.runId ?? null,
        metadata_json: {
          concept_name: input.concept.Nombre,
          concept_type: input.concept.Tipo,
          concept_active: input.concept.ConceptoActivo,
          codigo_contable: input.concept.CodigoContable,
          codigo_iva: input.concept.CodigoIVA,
          tasa_iva: input.concept.TasaIVA,
          codigo_grupo: input.concept.CodigoGrupo,
          nombre_grupo: input.concept.NombreGrupo,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,external_entity_type,external_key" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function materializeZetaConcepts(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    concepts: ZetaConceptoRaw[];
    runId?: string | null;
  },
): Promise<ZetaConceptMaterializationSummary> {
  const summary: ZetaConceptMaterializationSummary = {
    linked: 0,
    skipped: 0,
    missingAccount: 0,
    failed: 0,
    warnings: [],
  };

  for (const concept of input.concepts) {
    const conceptCode = asString(concept.Codigo);
    const chartCode = asString(concept.CodigoContable);

    if (!conceptCode || !chartCode) {
      summary.skipped += 1;
      continue;
    }

    try {
      const accountId = await findZetaChartAccountId(
        supabase,
        input.organizationId,
        chartCode,
      );

      if (!accountId) {
        summary.missingAccount += 1;
        continue;
      }

      await linkConceptToAccount(supabase, {
        organizationId: input.organizationId,
        concept,
        accountId,
        runId: input.runId,
      });
      summary.linked += 1;
    } catch (error) {
      summary.failed += 1;
      summary.warnings.push(
        error instanceof Error
          ? `Concepto Zeta ${conceptCode}: ${error.message}`
          : `Concepto Zeta ${conceptCode}: no se pudo vincular.`,
      );
    }
  }

  return summary;
}

export type { ZetaConceptMaterializationSummary };
