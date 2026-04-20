import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stableJsonStringify } from "@/modules/integrations/credentials";
import type { ZetaChartAccountCandidate } from "@/modules/integrations/zeta/contracts/plan-de-cuentas";

type JsonRecord = Record<string, unknown>;

type ChartAccountMirrorRow = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_side: "debit" | "credit";
  is_postable: boolean;
  is_active: boolean;
  provider_managed: boolean | null;
  source_provider: string | null;
  external_code: string | null;
  external_parent_code: string | null;
  account_level: number | null;
  is_imputable: boolean | null;
  uses_cost_centers: boolean | null;
  literal_tributario: number | null;
  parent_id: string | null;
  chapter_code: string | null;
  presentation_code: string | null;
  provider_meta_json: JsonRecord | null;
  metadata: JsonRecord | null;
};

type ChartAccountCodeRow = Pick<
  ChartAccountMirrorRow,
  "id" | "code" | "provider_managed" | "source_provider" | "external_code"
>;

export type ZetaChartAccountMaterializationSummary = {
  upserted: number;
  unchanged: number;
  conflict: number;
  failed: number;
  warnings: string[];
};

const zetaProvider = "zetasoftware";
const chartAccountSelect =
  "id, organization_id, code, name, account_type, normal_side, is_postable, is_active, provider_managed, source_provider, external_code, external_parent_code, account_level, is_imputable, uses_cost_centers, literal_tributario, parent_id, chapter_code, presentation_code, provider_meta_json, metadata";

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalSideForAccountType(accountType: string): "debit" | "credit" {
  return accountType === "liability" || accountType === "equity" || accountType === "revenue"
    ? "credit"
    : "debit";
}

export function inferZetaAccountType(candidate: ZetaChartAccountCandidate) {
  const haystack = [
    candidate.external_code,
    candidate.provider_meta.capitulo,
    candidate.provider_meta.grupo_codigo,
    candidate.provider_meta.grupo_nombre,
    candidate.name,
  ].join(" ").toLowerCase();
  const firstDigit = candidate.external_code.match(/\d/)?.[0] ?? "";

  if (/activo/.test(haystack) || firstDigit === "1") {
    return "asset";
  }

  if (/pasivo/.test(haystack) || firstDigit === "2") {
    return "liability";
  }

  if (/patrimonio|capital|equity/.test(haystack) || firstDigit === "3") {
    return "equity";
  }

  if (/ingreso|venta|revenue/.test(haystack) || firstDigit === "4") {
    return "revenue";
  }

  if (/egreso|gasto|costo|expense/.test(haystack) || ["5", "6", "7", "8", "9"].includes(firstDigit)) {
    return "expense";
  }

  return "memo";
}

function syncHash(value: unknown) {
  return createHash("sha256").update(stableJsonStringify(value), "utf8").digest("hex");
}

function comparablePayload(candidate: ZetaChartAccountCandidate, parentId: string | null) {
  const accountType = inferZetaAccountType(candidate);

  return {
    code: candidate.external_code,
    name: candidate.name,
    account_type: accountType,
    normal_side: normalSideForAccountType(accountType),
    is_postable: candidate.is_imputable,
    is_imputable: candidate.is_imputable,
    external_parent_code: candidate.external_parent_code,
    account_level: candidate.account_level,
    uses_cost_centers: candidate.uses_cost_centers,
    literal_tributario: candidate.literal_tributario,
    parent_id: parentId,
    chapter_code: candidate.provider_meta.capitulo || null,
    presentation_code: candidate.provider_meta.codigo_presentacion || null,
    provider_meta_json: candidate.provider_meta,
  };
}

function comparableExisting(row: ChartAccountMirrorRow) {
  const metadata = asRecord(row.metadata);
  const providerMeta = asRecord(row.provider_meta_json);

  return {
    code: row.code,
    name: row.name,
    account_type: row.account_type,
    normal_side: row.normal_side,
    is_postable: row.is_postable,
    is_imputable: asBoolean(row.is_imputable) ?? asBoolean(metadata.is_imputable) ?? row.is_postable,
    external_parent_code: asString(row.external_parent_code) ?? asString(metadata.external_parent_code),
    account_level: asNumber(row.account_level) ?? asNumber(metadata.account_level) ?? 0,
    uses_cost_centers: asBoolean(row.uses_cost_centers) ?? asBoolean(metadata.uses_cost_centers) ?? false,
    literal_tributario: asNumber(row.literal_tributario) ?? asNumber(metadata.literal_tributario),
    parent_id: asString(row.parent_id),
    chapter_code: asString(row.chapter_code) ?? asString(providerMeta.capitulo),
    presentation_code: asString(row.presentation_code) ?? asString(providerMeta.codigo_presentacion),
    provider_meta_json: providerMeta,
  };
}

function buildMetadata(candidate: ZetaChartAccountCandidate, hash: string) {
  return {
    source: zetaProvider,
    provider: zetaProvider,
    provider_managed: true,
    external_code: candidate.external_code,
    external_parent_code: candidate.external_parent_code,
    is_imputable: candidate.is_imputable,
    account_level: candidate.account_level,
    uses_cost_centers: candidate.uses_cost_centers,
    literal_tributario: candidate.literal_tributario,
    display_code_name: candidate.display_code_name,
    sync_hash: hash,
  };
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function fetchProviderAccounts(
  supabase: SupabaseClient,
  organizationId: string,
  externalCodes: string[],
) {
  const rows: ChartAccountMirrorRow[] = [];

  for (const chunk of chunkValues([...new Set(externalCodes)].filter(Boolean), 500)) {
    if (chunk.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select(chartAccountSelect)
      .eq("organization_id", organizationId)
      .eq("source_provider", zetaProvider)
      .in("external_code", chunk);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(((data as ChartAccountMirrorRow[] | null) ?? [])));
  }

  return new Map(rows.map((row) => [row.external_code ?? row.code, row]));
}

async function fetchAccountsByCode(
  supabase: SupabaseClient,
  organizationId: string,
  codes: string[],
) {
  const rows: ChartAccountCodeRow[] = [];

  for (const chunk of chunkValues([...new Set(codes)].filter(Boolean), 500)) {
    if (chunk.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("id, code, provider_managed, source_provider, external_code")
      .eq("organization_id", organizationId)
      .in("code", chunk);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(((data as ChartAccountCodeRow[] | null) ?? [])));
  }

  const byCode = new Map<string, ChartAccountCodeRow[]>();

  for (const row of rows) {
    byCode.set(row.code, [...(byCode.get(row.code) ?? []), row]);
  }

  return byCode;
}

function findLocalDuplicate(
  rows: ChartAccountCodeRow[] | undefined,
  externalCode: string,
) {
  return rows?.find((row) =>
    !(row.source_provider === zetaProvider && row.external_code === externalCode)) ?? null;
}

async function recordConflictLink(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    externalCode: string;
    localEntityId: string;
    runId?: string | null;
    reason: string;
  },
) {
  const { error } = await supabase
    .from("integration_entity_links")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: zetaProvider,
        external_entity_type: "chart_account",
        external_key: input.externalCode,
        local_entity_type: "chart_account",
        local_entity_id: input.localEntityId,
        match_method: "code_conflict",
        confidence: 1,
        status: "conflict",
        created_by_run_id: input.runId ?? null,
        metadata_json: {
          reason: input.reason,
          zeta_external_code: input.externalCode,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider,external_entity_type,external_key" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

function buildUpsertPayload(
  input: {
    organizationId: string;
    candidate: ZetaChartAccountCandidate;
    parentId: string | null;
    hash: string;
  },
) {
  const accountType = inferZetaAccountType(input.candidate);

  return {
    organization_id: input.organizationId,
    code: input.candidate.external_code,
    name: input.candidate.name,
    account_type: accountType,
    normal_side: normalSideForAccountType(accountType),
    is_postable: input.candidate.is_imputable,
    is_active: true,
    is_provisional: false,
    source: zetaProvider,
    external_code: input.candidate.external_code,
    external_parent_code: input.candidate.external_parent_code,
    account_level: input.candidate.account_level,
    is_imputable: input.candidate.is_imputable,
    uses_cost_centers: input.candidate.uses_cost_centers,
    literal_tributario: input.candidate.literal_tributario,
    parent_id: input.parentId,
    chapter_code: input.candidate.provider_meta.capitulo || null,
    presentation_code: input.candidate.provider_meta.codigo_presentacion || null,
    provider_managed: true,
    source_provider: zetaProvider,
    source_channel: "zeta_mirror",
    provider_meta_json: input.candidate.provider_meta,
    metadata: buildMetadata(input.candidate, input.hash),
    last_synced_from_provider_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertChartAccountPayloads(
  supabase: SupabaseClient,
  payloads: JsonRecord[],
) {
  for (const chunk of chunkValues(payloads, 250)) {
    const { error } = await supabase
      .from("chart_of_accounts")
      .upsert(chunk, {
        onConflict: "organization_id,source_provider,external_code",
      });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function materializeZetaChartAccounts(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    candidates: ZetaChartAccountCandidate[];
    runId?: string | null;
  },
): Promise<ZetaChartAccountMaterializationSummary> {
  const summary: ZetaChartAccountMaterializationSummary = {
    upserted: 0,
    unchanged: 0,
    conflict: 0,
    failed: 0,
    warnings: [],
  };
  const candidates = [...input.candidates]
    .filter((candidate) => candidate.external_code && candidate.name)
    .sort((left, right) =>
      (left.account_level - right.account_level)
      || left.external_code.localeCompare(right.external_code, "es", { numeric: true, sensitivity: "base" }),
    );
  const providerAccounts = await fetchProviderAccounts(
    supabase,
    input.organizationId,
    candidates.map((candidate) => candidate.external_code),
  );
  const accountsByCode = await fetchAccountsByCode(
    supabase,
    input.organizationId,
    candidates.map((candidate) => candidate.external_code),
  );
  const payloads: JsonRecord[] = [];

  for (const candidate of candidates) {
    try {
      const existing = providerAccounts.get(candidate.external_code) ?? null;
      const parentId = candidate.external_parent_code
        ? asString(providerAccounts.get(candidate.external_parent_code)?.id)
        : null;
      const nextComparable = comparablePayload(candidate, parentId);
      const hash = syncHash(nextComparable);

      if (existing) {
        if (existing.provider_managed === false) {
          await recordConflictLink(supabase, {
            organizationId: input.organizationId,
            externalCode: candidate.external_code,
            localEntityId: existing.id,
            runId: input.runId,
            reason: "provider_external_code_attached_to_manual_account",
          });
          summary.conflict += 1;
          continue;
        }

        if (syncHash(comparableExisting(existing)) === hash) {
          summary.unchanged += 1;
          continue;
        }

        payloads.push(buildUpsertPayload({
          organizationId: input.organizationId,
          candidate,
          parentId,
          hash,
        }));
        continue;
      }

      const localDuplicate = findLocalDuplicate(
        accountsByCode.get(candidate.external_code),
        candidate.external_code,
      );

      if (localDuplicate) {
        await recordConflictLink(supabase, {
          organizationId: input.organizationId,
          externalCode: candidate.external_code,
          localEntityId: localDuplicate.id,
          runId: input.runId,
          reason: "local_account_code_already_exists",
        });
        summary.conflict += 1;
        continue;
      }

      payloads.push(buildUpsertPayload({
        organizationId: input.organizationId,
        candidate,
        parentId,
        hash,
      }));
    } catch (error) {
      summary.failed += 1;
      summary.warnings.push(
        error instanceof Error
          ? `Cuenta Zeta ${candidate.external_code}: ${error.message}`
          : `Cuenta Zeta ${candidate.external_code}: no se pudo materializar.`,
      );
    }
  }

  if (payloads.length > 0) {
    try {
      await upsertChartAccountPayloads(supabase, payloads);
      summary.upserted += payloads.length;
    } catch (error) {
      summary.failed += payloads.length;
      summary.warnings.push(
        error instanceof Error
          ? `Cuentas Zeta: ${error.message}`
          : "No se pudieron materializar las cuentas Zeta.",
      );
    }
  }

  return summary;
}
