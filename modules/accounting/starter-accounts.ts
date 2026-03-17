import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildChartPresetPayload,
  type ChartPresetCode,
} from "@/modules/accounting/chart-presets";
import { insertChartAccountsWithCompat } from "@/modules/accounting/chart-write-compat";

type StarterAccountDefinition = {
  code: string;
  name: string;
  accountType: "asset" | "liability" | "revenue" | "expense";
  normalSide: "debit" | "credit";
  systemRole?: string;
  starterRole?: string;
  isProvisional?: boolean;
  taxProfileHint?: string;
};

type ExistingStarterAccountRow = {
  code: string;
  account_type: string;
  is_postable: boolean;
  is_active?: boolean;
  metadata: Record<string, unknown> | null;
};

const starterAccountDefinitions: StarterAccountDefinition[] = [
  {
    code: "SYS-AR",
    name: "Deudores por ventas",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "accounts_receivable",
  },
  {
    code: "SYS-AP",
    name: "Proveedores",
    accountType: "liability",
    normalSide: "credit",
    systemRole: "accounts_payable",
  },
  {
    code: "SYS-VAT-IN",
    name: "IVA compras acreditable",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "vat_input_creditable",
    taxProfileHint: "UY_VAT_PURCHASE_BASIC",
  },
  {
    code: "SYS-VAT-OUT",
    name: "IVA ventas debito fiscal",
    accountType: "liability",
    normalSide: "credit",
    systemRole: "vat_output_payable",
    taxProfileHint: "UY_VAT_SALE_BASIC",
  },
  {
    code: "SYS-CASH",
    name: "Caja del sistema",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "cash_account",
  },
  {
    code: "SYS-BANK",
    name: "Banco del sistema",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "bank_account",
  },
  {
    code: "SYS-CARD-CL",
    name: "Tarjetas a cobrar",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "card_clearing_account",
  },
  {
    code: "SYS-CHECK-CL",
    name: "Cheques a depositar",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "check_clearing_account",
  },
  {
    code: "TEMP-SALE-CLEAR",
    name: "Cobros contado a identificar",
    accountType: "asset",
    normalSide: "debit",
    systemRole: "cash_sales_unidentified_account",
    isProvisional: true,
  },
  {
    code: "TEMP-PUR-CLEAR",
    name: "Pagos contado a identificar",
    accountType: "liability",
    normalSide: "credit",
    systemRole: "cash_purchases_unidentified_account",
    isProvisional: true,
  },
  {
    code: "SYS-BANK-FEE",
    name: "Comisiones y gastos bancarios",
    accountType: "expense",
    normalSide: "debit",
    systemRole: "bank_fees_account",
  },
  {
    code: "GEN-SALE",
    name: "Ventas gravadas genericas",
    accountType: "revenue",
    normalSide: "credit",
    starterRole: "generic_sale_revenue",
  },
  {
    code: "GEN-EXP",
    name: "Gastos operativos genericos",
    accountType: "expense",
    normalSide: "debit",
    starterRole: "generic_purchase_expense",
  },
  {
    code: "TEMP-EXP",
    name: "Gasto por clasificar",
    accountType: "expense",
    normalSide: "debit",
    isProvisional: true,
    taxProfileHint: "UY_VAT_NON_DEDUCTIBLE",
  },
  {
    code: "TEMP-REV",
    name: "Ingreso por clasificar",
    accountType: "revenue",
    normalSide: "credit",
    isProvisional: true,
  },
  {
    code: "TEMP-INV",
    name: "Inventario por clasificar",
    accountType: "asset",
    normalSide: "debit",
    isProvisional: true,
  },
  {
    code: "TEMP-AST",
    name: "Activo por clasificar",
    accountType: "asset",
    normalSide: "debit",
    isProvisional: true,
  },
  {
    code: "TEMP-LIA",
    name: "Pasivo por clasificar",
    accountType: "liability",
    normalSide: "credit",
    isProvisional: true,
  },
];

function getSystemRole(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.system_role;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStarterRole(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.starter_role;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isActiveStarterAccount(account: ExistingStarterAccountRow) {
  return account.is_active !== false;
}

function normalizeAccountCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() ?? "";
}

export function buildStarterChartAccountPayload(input: {
  organizationId: string;
  actorId: string | null;
  existingAccounts: ExistingStarterAccountRow[];
  presetCode?: ChartPresetCode | null;
}) {
  const existingCodes = new Set(
    input.existingAccounts
      .map((account) => normalizeAccountCode(account.code))
      .filter((value): value is string => Boolean(value)),
  );
  const existingSystemRoles = new Set(
    input.existingAccounts
      .filter((account) => account.is_postable && isActiveStarterAccount(account))
      .map((account) => getSystemRole(account.metadata))
      .filter((value): value is string => Boolean(value)),
  );
  const hasRevenueAccount = input.existingAccounts.some(
    (account) => account.is_postable && isActiveStarterAccount(account) && account.account_type === "revenue",
  );
  const hasExpenseAccount = input.existingAccounts.some(
    (account) => account.is_postable && isActiveStarterAccount(account) && account.account_type === "expense",
  );
  const existingStarterRoles = new Set(
    input.existingAccounts
      .filter((account) => isActiveStarterAccount(account))
      .map((account) => getStarterRole(account.metadata))
      .filter((value): value is string => Boolean(value)),
  );

  const starterPayload = starterAccountDefinitions
    .filter((definition) => {
       if (existingCodes.has(normalizeAccountCode(definition.code))) {
         return false;
       }

      if (definition.systemRole && existingSystemRoles.has(definition.systemRole)) {
        return false;
      }

      if (definition.starterRole && existingStarterRoles.has(definition.starterRole)) {
        return false;
      }

      if (definition.starterRole === "generic_sale_revenue" && hasRevenueAccount) {
        return false;
      }

      if (definition.starterRole === "generic_purchase_expense" && hasExpenseAccount) {
        return false;
      }

      return true;
    })
    .map((definition) => ({
      organization_id: input.organizationId,
      code: definition.code,
      name: definition.name,
      account_type: definition.accountType,
      normal_side: definition.normalSide,
      is_postable: true,
      is_provisional: definition.isProvisional ?? false,
      source: definition.systemRole ? "system" : definition.isProvisional ? "system" : "starter",
      external_code: null,
      statement_section: null,
      nature_tag: definition.isProvisional ? "provisional" : null,
      function_tag: null,
      cashflow_tag: null,
      tax_profile_hint: definition.taxProfileHint ?? null,
      currency_policy: "mono_currency",
      metadata: {
        source: definition.systemRole ? "system" : "starter_bootstrap",
        starter_seeded_by: input.actorId,
        system_role: definition.systemRole ?? null,
        starter_role: definition.starterRole ?? null,
        is_provisional: definition.isProvisional ?? false,
        tax_profile_hint: definition.taxProfileHint ?? null,
      },
    }));

  if (!input.presetCode) {
    return starterPayload;
  }

  const presetPayload = buildChartPresetPayload({
    organizationId: input.organizationId,
    actorId: input.actorId,
    presetCode: input.presetCode,
    existingAccounts: [
      ...input.existingAccounts.map((account) => ({
        code: account.code,
      })),
      ...starterPayload.map((account) => ({
        code: account.code,
      })),
    ],
  });

   return [...starterPayload, ...presetPayload].filter((row, index, array) => {
     const normalizedCode = normalizeAccountCode(row.code);

     return array.findIndex((candidate) => normalizeAccountCode(candidate.code) === normalizedCode) === index;
   });
}

function isDuplicateChartAccountCodeError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  return error.code === "23505"
    || (error.message ?? "").includes("chart_of_accounts_organization_id_code_key");
}

async function loadExistingStarterAccounts(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("code, account_type, is_postable, is_active, metadata")
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as ExistingStarterAccountRow[] | null) ?? []);
}

export async function ensureStarterAccountingSetup(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    presetCode?: ChartPresetCode | null;
  },
) {
  const existingAccounts = await loadExistingStarterAccounts(supabase, input.organizationId);
  let payload = buildStarterChartAccountPayload({
    organizationId: input.organizationId,
    actorId: input.actorId,
    existingAccounts,
    presetCode: input.presetCode ?? null,
  });

  if (payload.length === 0) {
    return {
      insertedCount: 0,
      insertedCodes: [],
    };
  }

  let { error: insertError } = await insertChartAccountsWithCompat(supabase, payload);

  if (isDuplicateChartAccountCodeError(insertError)) {
    const refreshedAccounts = await loadExistingStarterAccounts(supabase, input.organizationId);

    payload = buildStarterChartAccountPayload({
      organizationId: input.organizationId,
      actorId: input.actorId,
      existingAccounts: refreshedAccounts,
      presetCode: input.presetCode ?? null,
    });

    if (payload.length === 0) {
      return {
        insertedCount: 0,
        insertedCodes: [],
      };
    }

    const retryResult = await insertChartAccountsWithCompat(supabase, payload);
    insertError = retryResult.error;
  }

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    insertedCount: payload.length,
    insertedCodes: payload.map((row) => row.code),
  };
}
