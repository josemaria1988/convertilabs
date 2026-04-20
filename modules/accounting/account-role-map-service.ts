import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  getAccountRoleDefinition,
  listZetaRoleMapDefinitions,
  type AccountRoleDefinition,
} from "@/modules/accounting/account-roles";
import type {
  AccountRoleCode,
  JsonRecord,
  PostableAccountRecord,
} from "@/modules/accounting/types";

type ChartAccountRow = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_side: "debit" | "credit";
  is_postable: boolean;
  is_active?: boolean | null;
  provider_managed?: boolean | null;
  source_provider?: string | null;
  external_code?: string | null;
  is_imputable?: boolean | null;
  literal_tributario?: number | null;
  provider_meta_json?: JsonRecord | null;
  metadata?: JsonRecord | null;
};

type AccountRoleBindingRow = {
  id: string;
  organization_id: string;
  binding_key: string;
  role_code: string;
  account_id: string;
  document_role: string | null;
  currency_code: string | null;
  settlement_method: string | null;
  priority: number | null;
  source: string | null;
  is_active: boolean | null;
  metadata: JsonRecord | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type IntegrationConnectionRow = {
  id: string;
  status: string | null;
  provider: string | null;
};

export type AccountRoleMappedAccount = Pick<
  PostableAccountRecord,
  | "id"
  | "organization_id"
  | "code"
  | "name"
  | "account_type"
  | "normal_side"
  | "is_postable"
  | "provider_managed"
  | "source_provider"
  | "external_code"
  | "is_imputable"
  | "literal_tributario"
  | "provider_meta_json"
  | "metadata"
>;

export type AccountRoleMappingView = {
  bindingId: string | null;
  organizationId: string;
  accountRoleCode: AccountRoleCode;
  role: AccountRoleDefinition;
  account: AccountRoleMappedAccount | null;
  source: string | null;
  confidence: number | null;
  notes: string | null;
  warnings: string[];
  updatedAt: string | null;
};

export type AccountRoleMappingSuggestion = {
  accountRoleCode: AccountRoleCode;
  account: AccountRoleMappedAccount;
  score: number;
  matchedHints: string[];
};

export type AccountRoleMapSettings = {
  organizationId: string;
  status: "complete" | "incomplete";
  requiredCount: number;
  mappedCount: number;
  roles: AccountRoleMappingView[];
  accounts: AccountRoleMappedAccount[];
  suggestions: AccountRoleMappingSuggestion[];
};

function bindingKeyForRole(roleCode: AccountRoleCode) {
  return `zeta_role:${roleCode}`;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapAccount(row: ChartAccountRow): AccountRoleMappedAccount {
  return {
    id: row.id,
    organization_id: row.organization_id,
    code: row.code,
    name: row.name,
    account_type: row.account_type,
    normal_side: row.normal_side,
    is_postable: row.is_postable,
    provider_managed: row.provider_managed ?? false,
    source_provider: row.source_provider ?? null,
    external_code: row.external_code ?? null,
    is_imputable: row.is_imputable ?? null,
    literal_tributario: row.literal_tributario ?? null,
    provider_meta_json: asRecord(row.provider_meta_json),
    metadata: asRecord(row.metadata),
  };
}

function accountCanReceiveMapping(account: AccountRoleMappedAccount | null) {
  return Boolean(account && account.is_postable !== false && account.is_imputable !== false);
}

function accountDisplayText(account: AccountRoleMappedAccount) {
  return [
    account.external_code,
    account.code,
    account.name,
    JSON.stringify(account.provider_meta_json ?? {}),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

async function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorProfileId: string | null;
    action: string;
    entityId?: string | null;
    beforeJson?: JsonRecord | null;
    afterJson?: JsonRecord | null;
    metadata?: JsonRecord;
  },
) {
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorProfileId,
      entity_type: "account_role_binding",
      entity_id: input.entityId ?? null,
      action: input.action,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      metadata: input.metadata ?? {},
    });

  if (error && isMissingSupabaseRelationError(error, "audit_log")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }
}

async function loadZetaConnectionActive(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_integration_connections")
    .select("id, provider, status")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error && isMissingSupabaseRelationError(error, "organization_integration_connections")) {
    return false;
  }

  if (error) {
    throw new Error(error.message);
  }

  const row = data as IntegrationConnectionRow | null;

  return Boolean(row?.id && row.status !== "paused");
}

async function loadMappingAccounts(
  supabase: SupabaseClient,
  organizationId: string,
  options: {
    includeNonImputable?: boolean;
  } = {},
) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select(
      "id, organization_id, code, name, account_type, normal_side, is_postable, is_active, provider_managed, source_provider, external_code, is_imputable, literal_tributario, provider_meta_json, metadata",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("is_postable", true)
    .order("source_provider", { ascending: false })
    .order("external_code", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const accounts = ((data as ChartAccountRow[] | null) ?? []).map(mapAccount);

  return options.includeNonImputable
    ? accounts
    : accounts.filter(accountCanReceiveMapping);
}

async function loadRoleBindings(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const roleCodes = listZetaRoleMapDefinitions().map((definition) => definition.code);
  const { data, error } = await supabase
    .from("account_role_bindings")
    .select(
      "id, organization_id, binding_key, role_code, account_id, document_role, currency_code, settlement_method, priority, source, is_active, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role_code", roleCodes);

  if (error && isMissingSupabaseRelationError(error, "account_role_bindings")) {
    return [];
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data as AccountRoleBindingRow[] | null) ?? [];
}

function buildWarnings(input: {
  zetaConnected: boolean;
  account: AccountRoleMappedAccount | null;
}) {
  const warnings: string[] = [];

  if (input.account && !accountCanReceiveMapping(input.account)) {
    warnings.push("account_not_imputable");
  }

  if (
    input.zetaConnected
    && input.account
    && input.account.source_provider !== "zetasoftware"
  ) {
    warnings.push("local_account_not_bridge_ready");
  }

  return warnings;
}

export async function listAccountRoleMappings(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
  },
): Promise<AccountRoleMappingView[]> {
  const [accounts, bindings, zetaConnected] = await Promise.all([
    loadMappingAccounts(supabase, params.organizationId),
    loadRoleBindings(supabase, params.organizationId),
    loadZetaConnectionActive(supabase, params.organizationId),
  ]);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return listZetaRoleMapDefinitions().map((role) => {
    const binding = bindings
      .filter((candidate) => candidate.role_code === role.code)
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0] ?? null;
    const account = binding ? accountsById.get(binding.account_id) ?? null : null;
    const metadata = asRecord(binding?.metadata);

    return {
      bindingId: binding?.id ?? null,
      organizationId: params.organizationId,
      accountRoleCode: role.code,
      role,
      account,
      source: binding?.source ?? null,
      confidence: asNumber(metadata.confidence),
      notes: asString(metadata.notes),
      warnings: buildWarnings({
        zetaConnected,
        account,
      }),
      updatedAt: binding?.updated_at ?? binding?.created_at ?? null,
    } satisfies AccountRoleMappingView;
  });
}

export async function suggestAccountRoleMappings(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
  },
): Promise<AccountRoleMappingSuggestion[]> {
  const accounts = (await loadMappingAccounts(supabase, params.organizationId))
    .filter((account) => account.source_provider === "zetasoftware");
  const suggestions: AccountRoleMappingSuggestion[] = [];

  for (const role of listZetaRoleMapDefinitions()) {
    const roleSuggestions = accounts
      .map((account) => {
        const haystack = accountDisplayText(account);
        const matchedHints = role.zetaSearchHints.filter((hint) =>
          haystack.includes(hint.toLowerCase()),
        );
        const score =
          matchedHints.length * 10
          + (account.provider_managed ? 5 : 0)
          + (account.external_code ? 2 : 0);

        return {
          accountRoleCode: role.code,
          account,
          score,
          matchedHints,
        } satisfies AccountRoleMappingSuggestion;
      })
      .filter((suggestion) => suggestion.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    suggestions.push(...roleSuggestions);
  }

  return suggestions;
}

export async function upsertAccountRoleMapping(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    accountRoleCode: AccountRoleCode;
    chartAccountId: string;
    actorProfileId: string | null;
    source?: "manual" | "suggested" | "imported";
    notes?: string | null;
  },
): Promise<AccountRoleMappingView> {
  const role = getAccountRoleDefinition(params.accountRoleCode);

  if (!role || !role.visibleInZetaRoleMap) {
    throw new Error("Rol contable no soportado para el mapa Zeta.");
  }

  const [accounts, zetaConnected] = await Promise.all([
    loadMappingAccounts(supabase, params.organizationId, { includeNonImputable: true }),
    loadZetaConnectionActive(supabase, params.organizationId),
  ]);
  const account = accounts.find((candidate) => candidate.id === params.chartAccountId) ?? null;

  if (!account) {
    throw new Error("La cuenta contable no existe en esta organizacion o no esta activa.");
  }

  if (!accountCanReceiveMapping(account)) {
    throw new Error("Solo se pueden mapear cuentas imputables.");
  }

  const now = new Date().toISOString();
  const source = params.source ?? "manual";
  const metadata = {
    notes: params.notes?.trim() || null,
    zeta_role_map: true,
    warnings: buildWarnings({
      zetaConnected,
      account,
    }),
    updated_by: params.actorProfileId,
  };
  const payload = {
    organization_id: params.organizationId,
    binding_key: bindingKeyForRole(params.accountRoleCode),
    role_code: params.accountRoleCode,
    account_id: params.chartAccountId,
    document_role: null,
    currency_code: null,
    settlement_method: null,
    priority: 1000,
    source,
    is_active: true,
    metadata,
    updated_at: now,
  };
  const before = (await listAccountRoleMappings(supabase, {
    organizationId: params.organizationId,
  })).find((mapping) => mapping.accountRoleCode === params.accountRoleCode) ?? null;
  const { data, error } = await supabase
    .from("account_role_bindings")
    .upsert(payload, {
      onConflict: "organization_id,binding_key",
    })
    .select(
      "id, organization_id, binding_key, role_code, account_id, document_role, currency_code, settlement_method, priority, source, is_active, metadata, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const binding = data as AccountRoleBindingRow;
  await recordAuditEvent(supabase, {
    organizationId: params.organizationId,
    actorProfileId: params.actorProfileId,
    entityId: binding.id,
    action: before?.bindingId ? "account_role_mapping_updated" : "account_role_mapping_created",
    beforeJson: before
      ? {
        account_role_code: before.accountRoleCode,
        chart_account_id: before.account?.id ?? null,
      }
      : null,
    afterJson: {
      account_role_code: params.accountRoleCode,
      chart_account_id: params.chartAccountId,
      source,
    },
    metadata: {
      provider: "zetasoftware",
    },
  });

  const mappings = await listAccountRoleMappings(supabase, {
    organizationId: params.organizationId,
  });

  return mappings.find((mapping) => mapping.accountRoleCode === params.accountRoleCode)!;
}

export async function deleteAccountRoleMapping(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    accountRoleCode: AccountRoleCode;
    actorProfileId: string | null;
  },
): Promise<void> {
  const role = getAccountRoleDefinition(params.accountRoleCode);

  if (!role || !role.visibleInZetaRoleMap) {
    throw new Error("Rol contable no soportado para el mapa Zeta.");
  }

  const before = (await listAccountRoleMappings(supabase, {
    organizationId: params.organizationId,
  })).find((mapping) => mapping.accountRoleCode === params.accountRoleCode) ?? null;
  const { error } = await supabase
    .from("account_role_bindings")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", params.organizationId)
    .eq("binding_key", bindingKeyForRole(params.accountRoleCode));

  if (error && isMissingSupabaseRelationError(error, "account_role_bindings")) {
    return;
  }

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditEvent(supabase, {
    organizationId: params.organizationId,
    actorProfileId: params.actorProfileId,
    entityId: before?.bindingId ?? null,
    action: "account_role_mapping_deleted",
    beforeJson: before
      ? {
        account_role_code: before.accountRoleCode,
        chart_account_id: before.account?.id ?? null,
      }
      : null,
    afterJson: {
      account_role_code: params.accountRoleCode,
      deleted: true,
    },
    metadata: {
      provider: "zetasoftware",
    },
  });
}

export async function loadAccountRoleMapSettings(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
  },
): Promise<AccountRoleMapSettings> {
  const [roles, accounts, suggestions] = await Promise.all([
    listAccountRoleMappings(supabase, params),
    loadMappingAccounts(supabase, params.organizationId),
    suggestAccountRoleMappings(supabase, params),
  ]);
  const mappedCount = roles.filter((role) => role.account !== null).length;

  return {
    organizationId: params.organizationId,
    status: mappedCount === roles.length ? "complete" : "incomplete",
    requiredCount: roles.length,
    mappedCount,
    roles,
    accounts,
    suggestions,
  } satisfies AccountRoleMapSettings;
}
