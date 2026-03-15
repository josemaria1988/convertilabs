import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseColumnError } from "@/lib/supabase/schema-compat";
import {
  buildChartPresetPayload,
  listChartPresets,
  type ChartPresetCode,
} from "@/modules/accounting/chart-presets";

export type ChartAccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "memo";

export type ChartAccountNormalSide =
  | "debit"
  | "credit";

type ChartAccountRow = {
  id: string;
  code: string;
  name: string;
  account_type: ChartAccountType;
  normal_side: ChartAccountNormalSide;
  is_postable: boolean;
  is_provisional?: boolean | null;
  source?: string | null;
  external_code?: string | null;
  statement_section?: string | null;
  nature_tag?: string | null;
  function_tag?: string | null;
  cashflow_tag?: string | null;
  tax_profile_hint?: string | null;
  currency_policy?: string | null;
  is_active: boolean;
  parent_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationChartAccount = {
  id: string;
  code: string;
  name: string;
  accountType: ChartAccountType;
  normalSide: ChartAccountNormalSide;
  isPostable: boolean;
  isProvisional: boolean;
  isActive: boolean;
  parentId: string | null;
  parentCode: string | null;
  systemRole: string | null;
  source: string | null;
  externalCode: string | null;
  statementSection: string | null;
  natureTag: string | null;
  functionTag: string | null;
  cashflowTag: string | null;
  taxProfileHint: string | null;
  currencyPolicy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationChartManagementData = {
  accounts: OrganizationChartAccount[];
  presets: Array<{
    code: ChartPresetCode;
    label: string;
    description: string;
  }>;
  summary: {
    activeCount: number;
    postableCount: number;
    systemRoleCount: number;
    provisionalCount: number;
    externalCodeCount: number;
  };
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

async function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    entityId: string | null;
    action: string;
    beforeJson?: Record<string, unknown>;
    afterJson?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "chart_account",
      entity_id: input.entityId,
      action: input.action,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      metadata: input.metadata ?? {},
    });
}

function mapChartAccountRows(rows: ChartAccountRow[]) {
  const codeById = new Map(rows.map((row) => [row.id, row.code]));

  return rows
    .map((row) => {
      const metadata = asRecord(row.metadata);

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        accountType: row.account_type,
        normalSide: row.normal_side,
        isPostable: row.is_postable,
        isProvisional:
          asBoolean(row.is_provisional)
          ?? asBoolean(metadata.is_provisional)
          ?? row.code.startsWith("TEMP-"),
        isActive: row.is_active,
        parentId: row.parent_id,
        parentCode: row.parent_id ? codeById.get(row.parent_id) ?? null : null,
        systemRole: asString(metadata.system_role),
        source: asString(row.source) ?? asString(metadata.source),
        externalCode: asString(row.external_code) ?? asString(metadata.external_code),
        statementSection: asString(row.statement_section) ?? asString(metadata.statement_section),
        natureTag: asString(row.nature_tag) ?? asString(metadata.nature_tag),
        functionTag: asString(row.function_tag) ?? asString(metadata.function_tag),
        cashflowTag: asString(row.cashflow_tag) ?? asString(metadata.cashflow_tag),
        taxProfileHint: asString(row.tax_profile_hint) ?? asString(metadata.tax_profile_hint),
        currencyPolicy: asString(row.currency_policy) ?? asString(metadata.currency_policy),
        metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } satisfies OrganizationChartAccount;
    })
    .sort((left, right) => left.code.localeCompare(right.code, "es", {
      numeric: true,
      sensitivity: "base",
    }));
}

async function loadChartAccountRows(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const selectClause = [
    "id",
    "code",
    "name",
    "account_type",
    "normal_side",
    "is_postable",
    "is_provisional",
    "source",
    "external_code",
    "statement_section",
    "nature_tag",
    "function_tag",
    "cashflow_tag",
    "tax_profile_hint",
    "currency_policy",
    "is_active",
    "parent_id",
    "metadata",
    "created_at",
    "updated_at",
  ].join(", ");
  const legacySelectClause =
    "id, code, name, account_type, normal_side, is_postable, is_active, parent_id, metadata, created_at, updated_at";

  const primaryResult = await supabase
    .from("chart_of_accounts")
    .select(selectClause)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("code", { ascending: true });
  let data = primaryResult.data as unknown;
  let error = primaryResult.error;

  if (error && isMissingSupabaseColumnError(error, "chart_of_accounts")) {
    const legacyResult = await supabase
      .from("chart_of_accounts")
      .select(legacySelectClause)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("code", { ascending: true });
    data = legacyResult.data as unknown;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data as ChartAccountRow[] | null) ?? [];
}

export async function loadOrganizationChartManagementData(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const rows = await loadChartAccountRows(supabase, organizationId);
  const accounts = mapChartAccountRows(rows);

  return {
    accounts,
    presets: listChartPresets().map((preset) => ({
      code: preset.code,
      label: preset.label,
      description: preset.description,
    })),
    summary: {
      activeCount: accounts.length,
      postableCount: accounts.filter((account) => account.isPostable).length,
      systemRoleCount: accounts.filter((account) => account.systemRole).length,
      provisionalCount: accounts.filter((account) => account.isProvisional).length,
      externalCodeCount: accounts.filter((account) => Boolean(account.externalCode)).length,
    },
  } satisfies OrganizationChartManagementData;
}

function normalizeAccountType(value: string) {
  switch (value.trim().toLowerCase()) {
    case "asset":
    case "liability":
    case "equity":
    case "revenue":
    case "expense":
    case "memo":
      return value.trim().toLowerCase() as ChartAccountType;
    default:
      throw new Error("El tipo de cuenta no es valido.");
  }
}

function normalizeNormalSide(value: string, accountType: ChartAccountType) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "debit" || normalized === "credit") {
    return normalized as ChartAccountNormalSide;
  }

  return accountType === "liability" || accountType === "equity" || accountType === "revenue"
    ? "credit"
    : "debit";
}

function buildChartAccountPayload(input: {
  code: string;
  name: string;
  accountType: string;
  normalSide: string;
  isPostable: boolean;
  isProvisional?: boolean;
  externalCode?: string | null;
  statementSection?: string | null;
  natureTag?: string | null;
  functionTag?: string | null;
  cashflowTag?: string | null;
  taxProfileHint?: string | null;
  currencyPolicy?: string | null;
}) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (!code) {
    throw new Error("El codigo de cuenta es obligatorio.");
  }

  if (!name) {
    throw new Error("El nombre de cuenta es obligatorio.");
  }

  const accountType = normalizeAccountType(input.accountType);
  const normalSide = normalizeNormalSide(input.normalSide, accountType);

  return {
    code,
    name,
    account_type: accountType,
    normal_side: normalSide,
    is_postable: input.isPostable,
    is_provisional: input.isProvisional ?? false,
    source: "organization_settings_manual",
    external_code: asString(input.externalCode),
    statement_section: asString(input.statementSection),
    nature_tag: asString(input.natureTag),
    function_tag: asString(input.functionTag),
    cashflow_tag: asString(input.cashflowTag),
    tax_profile_hint: asString(input.taxProfileHint),
    currency_policy: asString(input.currencyPolicy) ?? "mono_currency",
  };
}

export async function createOrganizationChartAccount(input: {
  organizationId: string;
  actorId: string | null;
  code: string;
  name: string;
  accountType: string;
  normalSide: string;
  isPostable: boolean;
  isProvisional?: boolean;
  externalCode?: string | null;
  statementSection?: string | null;
  natureTag?: string | null;
  functionTag?: string | null;
  cashflowTag?: string | null;
  taxProfileHint?: string | null;
  currencyPolicy?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const payload = buildChartAccountPayload(input);
  const { data: existing, error: existingError } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("code", payload.code)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    throw new Error("Ya existe una cuenta activa con ese codigo.");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      organization_id: input.organizationId,
      ...payload,
      metadata: {
        source: "organization_settings_manual",
        updated_by: input.actorId,
        is_provisional: payload.is_provisional,
        external_code: payload.external_code,
        statement_section: payload.statement_section,
        nature_tag: payload.nature_tag,
        function_tag: payload.function_tag,
        cashflow_tag: payload.cashflow_tag,
        tax_profile_hint: payload.tax_profile_hint,
        currency_policy: payload.currency_policy,
      },
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, code, name, account_type, normal_side, is_postable, is_provisional, source, external_code, statement_section, nature_tag, function_tag, cashflow_tag, tax_profile_hint, currency_policy, is_active, parent_id, metadata, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear la cuenta.");
  }

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityId: data.id as string,
    action: "chart_account:create",
    afterJson: {
      code: data.code,
      name: data.name,
      account_type: data.account_type,
      normal_side: data.normal_side,
      is_postable: data.is_postable,
      is_provisional: data.is_provisional,
      external_code: data.external_code,
      tax_profile_hint: data.tax_profile_hint,
    },
  });

  const rows = await loadChartAccountRows(supabase, input.organizationId);
  return mapChartAccountRows(rows).find((account) => account.id === data.id) ?? null;
}

export async function updateOrganizationChartAccount(input: {
  organizationId: string;
  actorId: string | null;
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  normalSide: string;
  isPostable: boolean;
  isProvisional?: boolean;
  externalCode?: string | null;
  statementSection?: string | null;
  natureTag?: string | null;
  functionTag?: string | null;
  cashflowTag?: string | null;
  taxProfileHint?: string | null;
  currencyPolicy?: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: current, error: currentError } = await supabase
    .from("chart_of_accounts")
    .select(
      "id, code, name, account_type, normal_side, is_postable, is_active, parent_id, metadata, created_at, updated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.accountId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (currentError || !current?.id) {
    throw new Error(currentError?.message ?? "La cuenta no existe.");
  }

  const currentRow = current as ChartAccountRow;
  const systemRole = asString(asRecord(currentRow.metadata).system_role);
  const payload = buildChartAccountPayload(input);

  if (systemRole) {
    payload.account_type = currentRow.account_type;
    payload.normal_side = currentRow.normal_side;
    payload.is_postable = currentRow.is_postable;
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("code", payload.code)
    .eq("is_active", true)
    .neq("id", input.accountId)
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    throw new Error(duplicateError.message);
  }

  if (duplicate?.id) {
    throw new Error("Ya existe otra cuenta activa con ese codigo.");
  }

  const nextMetadata = {
    ...asRecord(currentRow.metadata),
    updated_by: input.actorId,
    updated_from: "organization_settings",
    is_provisional: payload.is_provisional,
    external_code: payload.external_code,
    statement_section: payload.statement_section,
    nature_tag: payload.nature_tag,
    function_tag: payload.function_tag,
    cashflow_tag: payload.cashflow_tag,
    tax_profile_hint: payload.tax_profile_hint,
    currency_policy: payload.currency_policy,
  };
  const { error: updateError } = await supabase
    .from("chart_of_accounts")
    .update({
      ...payload,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.accountId)
    .eq("organization_id", input.organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityId: input.accountId,
    action: "chart_account:update",
    beforeJson: {
      code: currentRow.code,
      name: currentRow.name,
      account_type: currentRow.account_type,
      normal_side: currentRow.normal_side,
      is_postable: currentRow.is_postable,
    },
    afterJson: {
      code: payload.code,
      name: payload.name,
      account_type: payload.account_type,
      normal_side: payload.normal_side,
      is_postable: payload.is_postable,
      is_provisional: payload.is_provisional,
      external_code: payload.external_code,
      tax_profile_hint: payload.tax_profile_hint,
    },
    metadata: systemRole
      ? {
          system_role: systemRole,
          note: "Los atributos estructurales de cuentas de sistema se mantuvieron bloqueados.",
        }
      : {},
  });
}

function escapeCsvCell(value: string | number | boolean | null) {
  const stringValue =
    value === null
      ? ""
      : typeof value === "boolean"
        ? (value ? "true" : "false")
        : String(value);

  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

export function buildOrganizationChartCsv(accounts: OrganizationChartAccount[]) {
  const header = [
    "code",
    "name",
    "account_type",
    "normal_side",
    "is_postable",
    "is_provisional",
    "parent_code",
    "system_role",
    "source",
    "external_code",
    "statement_section",
    "nature_tag",
    "function_tag",
    "cashflow_tag",
    "tax_profile_hint",
    "currency_policy",
  ];
  const rows = accounts.map((account) => [
    account.code,
    account.name,
    account.accountType,
    account.normalSide,
    account.isPostable,
    account.isProvisional,
    account.parentCode,
    account.systemRole,
    account.source,
    account.externalCode,
    account.statementSection,
    account.natureTag,
    account.functionTag,
    account.cashflowTag,
    account.taxProfileHint,
    account.currencyPolicy,
  ]);

  return [
    header.map((value) => escapeCsvCell(value)).join(","),
    ...rows.map((row) => row.map((value) => escapeCsvCell(value)).join(",")),
  ].join("\r\n");
}

export async function applyOrganizationChartPreset(input: {
  organizationId: string;
  actorId: string | null;
  presetCode: ChartPresetCode;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const rows = await loadChartAccountRows(supabase, input.organizationId);
  const payload = buildChartPresetPayload({
    organizationId: input.organizationId,
    actorId: input.actorId,
    presetCode: input.presetCode,
    existingAccounts: rows.map((row) => ({
      code: row.code,
    })),
  });

  if (payload.length === 0) {
    return {
      insertedCount: 0,
    };
  }

  const { error } = await supabase
    .from("chart_of_accounts")
    .insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    entityId: null,
    action: "chart_account:apply_preset",
    metadata: {
      preset_code: input.presetCode,
      inserted_count: payload.length,
    },
  });

  return {
    insertedCount: payload.length,
  };
}
