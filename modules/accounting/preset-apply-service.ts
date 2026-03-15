import type { SupabaseClient } from "@supabase/supabase-js";
import type { PresetComposition } from "@/modules/accounting/presets/types";
import { insertChartAccountsWithCompat } from "@/modules/accounting/chart-write-compat";

function inferNormalSide(
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense",
  normalSide?: "debit" | "credit",
) {
  if (normalSide) {
    return normalSide;
  }

  return accountType === "liability" || accountType === "equity" || accountType === "revenue"
    ? "credit"
    : "debit";
}

export async function applyPresetComposition(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    composition: PresetComposition;
    source:
      | "recommended"
      | "manual_pick"
      | "minimal_temp_only"
      | "external_import"
      | "hybrid_ai_recommended";
  },
) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("code")
    .eq("organization_id", input.organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const existingCodes = new Set(
    (((data as Array<{ code: string }> | null) ?? []).map((entry) => entry.code.trim().toUpperCase())),
  );
  const payload = input.composition.accounts
    .filter((account) => !existingCodes.has(account.code.toUpperCase()))
    .map((account) => ({
      organization_id: input.organizationId,
      code: account.code,
      name: account.name,
      account_type: account.accountType,
      normal_side: inferNormalSide(account.accountType, account.normalSide),
      is_postable: account.isPostable ?? true,
      is_provisional: account.isProvisional ?? false,
      source: "preset",
      external_code: account.externalCode ?? null,
      statement_section: account.statementSection ?? null,
      nature_tag: account.natureTag ?? null,
      function_tag: account.functionTag ?? null,
      cashflow_tag: account.cashflowTag ?? null,
      tax_profile_hint: account.taxProfileHint ?? null,
      currency_policy: account.currencyPolicy ?? "mono_currency",
      metadata: {
        source: "preset_application",
        preset_composition_code: input.composition.code,
        base_preset_code: input.composition.basePresetCode,
        overlay_codes: input.composition.overlayCodes,
        semantic_key: account.semanticKey,
        preset_application_mode: input.source,
        preset_applied_by: input.actorId,
        system_role: account.systemRole ?? null,
        tax_profile_hint: account.taxProfileHint ?? null,
      },
    }));

  if (payload.length === 0) {
    return { insertedCount: 0, insertedCodes: [] as string[] };
  }

  const { error: insertError } = await insertChartAccountsWithCompat(supabase, payload);

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    insertedCount: payload.length,
    insertedCodes: payload.map((row) => row.code),
  };
}
