import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseColumnError } from "@/lib/supabase/schema-compat";

type ChartAccountInsertRow = {
  organization_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_side: string;
  is_postable: boolean;
  parent_id?: string | null;
  is_active?: boolean;
  is_provisional?: boolean | null;
  source?: string | null;
  external_code?: string | null;
  statement_section?: string | null;
  nature_tag?: string | null;
  function_tag?: string | null;
  cashflow_tag?: string | null;
  tax_profile_hint?: string | null;
  currency_policy?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function assignCompatMetadataField(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value !== undefined) {
    metadata[key] = value;
  }
}

export function toLegacyChartAccountInsertRow(row: ChartAccountInsertRow) {
  const metadata = {
    ...asRecord(row.metadata),
  };

  assignCompatMetadataField(metadata, "source", row.source);
  assignCompatMetadataField(metadata, "is_provisional", row.is_provisional);
  assignCompatMetadataField(metadata, "external_code", row.external_code);
  assignCompatMetadataField(metadata, "statement_section", row.statement_section);
  assignCompatMetadataField(metadata, "nature_tag", row.nature_tag);
  assignCompatMetadataField(metadata, "function_tag", row.function_tag);
  assignCompatMetadataField(metadata, "cashflow_tag", row.cashflow_tag);
  assignCompatMetadataField(metadata, "tax_profile_hint", row.tax_profile_hint);
  assignCompatMetadataField(metadata, "currency_policy", row.currency_policy);

  return {
    organization_id: row.organization_id,
    code: row.code,
    name: row.name,
    account_type: row.account_type,
    normal_side: row.normal_side,
    is_postable: row.is_postable,
    parent_id: row.parent_id ?? null,
    is_active: row.is_active ?? true,
    metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertChartAccountsWithCompat(
  supabase: SupabaseClient,
  rows: ChartAccountInsertRow[],
) {
  let result = await supabase
    .from("chart_of_accounts")
    .insert(rows);

  if (result.error && isMissingSupabaseColumnError(result.error, "chart_of_accounts")) {
    result = await supabase
      .from("chart_of_accounts")
      .insert(rows.map((row) => toLegacyChartAccountInsertRow(row)));
  }

  return result;
}

export type { ChartAccountInsertRow };
