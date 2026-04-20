import { normalizeTextToken } from "@/modules/accounting/normalization";
import { getEquivalentBindingRoleCodes } from "@/modules/accounting/account-roles";
import type {
  AccountRoleBindingRecord,
  AccountRoleCode,
  ManualAccountRoleOverrides,
  PostableAccountRecord,
  ResolvedAccountingRule,
  SettlementMethod,
} from "@/modules/accounting/types";

export type ResolvedAccountRole = {
  roleCode: AccountRoleCode;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  isProvisional: boolean;
  provenance: string;
};

const systemRoleAliases: Record<AccountRoleCode, string[]> = {
  revenue_account: ["revenue_account"],
  expense_account: ["expense_account"],
  inventory_account: ["inventory_account"],
  fixed_asset_account: ["fixed_asset_account"],
  output_vat_account: ["output_vat_account", "vat_output_payable"],
  input_vat_account: ["input_vat_account", "vat_input_creditable"],
  accounts_receivable_account: ["accounts_receivable_account", "accounts_receivable"],
  accounts_payable_account: ["accounts_payable_account", "accounts_payable"],
  cash_account: ["cash_account"],
  bank_account: ["bank_account"],
  card_clearing_account: ["card_clearing_account"],
  check_clearing_account: ["check_clearing_account"],
  cash_sales_unidentified_account: ["cash_sales_unidentified_account"],
  cash_purchases_unidentified_account: ["cash_purchases_unidentified_account"],
  bank_fees_account: ["bank_fees_account"],
  fx_difference_account: ["fx_difference_account"],
  purchase_expense_default: ["purchase_expense_default", "expense_account"],
  purchase_inventory: ["purchase_inventory", "inventory_account"],
  purchase_fixed_asset: ["purchase_fixed_asset", "fixed_asset_account"],
  vat_purchase_basic: ["vat_purchase_basic", "input_vat_account", "vat_input_creditable"],
  vat_purchase_minimum: ["vat_purchase_minimum", "input_vat_account", "vat_input_creditable"],
  vat_purchase_other: ["vat_purchase_other", "input_vat_account", "vat_input_creditable"],
  accounts_payable: ["accounts_payable", "accounts_payable_account"],
  partner_reimbursement_payable: ["partner_reimbursement_payable", "partner_reimbursement"],
  cash_uyu: ["cash_uyu", "cash_account"],
  cash_usd: ["cash_usd", "cash_account"],
  bank_uyu: ["bank_uyu", "bank_account"],
  bank_usd: ["bank_usd", "bank_account"],
  accounts_receivable: ["accounts_receivable", "accounts_receivable_account"],
  sales_local: ["sales_local", "revenue_account"],
  sales_export: ["sales_export", "revenue_account"],
  vat_sales_basic: ["vat_sales_basic", "output_vat_account", "vat_output_payable"],
  vat_sales_minimum: ["vat_sales_minimum", "output_vat_account", "vat_output_payable"],
  vat_sales_other: ["vat_sales_other", "output_vat_account", "vat_output_payable"],
  withholding_payable: ["withholding_payable"],
  fx_gain: ["fx_gain", "fx_difference_account"],
  fx_loss: ["fx_loss", "fx_difference_account"],
};

function isProvisionalAccount(account: PostableAccountRecord | null | undefined) {
  return Boolean(
    account?.is_provisional
    || account?.code?.startsWith("TEMP-")
    || account?.metadata?.is_provisional === true,
  );
}

function findAccountById(
  accounts: PostableAccountRecord[],
  accountId: string | null | undefined,
) {
  if (!accountId) {
    return null;
  }

  return accounts.find((account) => account.id === accountId) ?? null;
}

function findAccountBySystemRole(
  accounts: PostableAccountRecord[],
  roleCode: AccountRoleCode,
) {
  const aliases = systemRoleAliases[roleCode];

  return accounts.find((account) => {
    const systemRole = typeof account.metadata?.system_role === "string"
      ? account.metadata.system_role.trim()
      : null;

    return Boolean(systemRole && aliases.includes(systemRole));
  }) ?? null;
}

function findAccountByBinding(input: {
  accounts: PostableAccountRecord[];
  bindings: AccountRoleBindingRecord[];
  roleCode: AccountRoleCode;
  documentRole?: string | null;
  currencyCode?: string | null;
  settlementMethod?: SettlementMethod | null;
}) {
  const currencyCode = input.currencyCode?.trim().toUpperCase() ?? null;
  const roleCodes = getEquivalentBindingRoleCodes(input.roleCode);
  const candidates = input.bindings
    .filter((binding) =>
      binding.is_active
      && roleCodes.includes(binding.role_code)
      && (binding.document_role === null || binding.document_role === input.documentRole)
      && (
        binding.currency_code === null
        || binding.currency_code.trim().toUpperCase() === currencyCode
      )
      && (
        binding.settlement_method === null
        || binding.settlement_method === input.settlementMethod
      ))
    .map((binding) => ({
      binding,
      account: findAccountById(input.accounts, binding.account_id),
      score:
        binding.priority
        + (binding.document_role === input.documentRole ? 40 : 0)
        + (
          binding.currency_code !== null
          && binding.currency_code.trim().toUpperCase() === currencyCode
            ? 20
            : 0
        )
        + (binding.settlement_method === input.settlementMethod ? 10 : 0),
    }))
    .filter((candidate) => candidate.account !== null)
    .sort((left, right) => right.score - left.score);

  return candidates[0] ?? null;
}

function matchesHeuristic(
  account: PostableAccountRecord,
  patterns: string[],
  semanticKeys: string[],
) {
  const haystack = [
    account.code,
    account.name,
    typeof account.metadata?.semantic_key === "string" ? account.metadata.semantic_key : null,
    typeof account.metadata?.starter_role === "string" ? account.metadata.starter_role : null,
    typeof account.metadata?.nature_tag === "string" ? account.metadata.nature_tag : null,
    account.nature_tag,
  ]
    .map((value) => normalizeTextToken(value))
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return patterns.some((pattern) => haystack.includes(pattern))
    || semanticKeys.some((key) => haystack.includes(key));
}

function findAccountByHeuristic(
  accounts: PostableAccountRecord[],
  roleCode: AccountRoleCode,
) {
  switch (roleCode) {
    case "purchase_expense_default":
      return accounts.find((account) =>
        matchesHeuristic(account, ["gasto", "gastos", "administrativo", "servicio"], ["expense"]),
      ) ?? null;
    case "purchase_inventory":
      return accounts.find((account) =>
        matchesHeuristic(account, ["mercaderia", "mercaderias", "inventario", "stock"], ["inventory"]),
      ) ?? null;
    case "purchase_fixed_asset":
      return accounts.find((account) =>
        matchesHeuristic(account, ["activo fijo", "bienes de uso", "maquinaria"], ["fixed_asset"]),
      ) ?? null;
    case "vat_purchase_basic":
    case "vat_purchase_minimum":
    case "vat_purchase_other":
      return accounts.find((account) =>
        matchesHeuristic(account, ["iva compras", "credito fiscal"], ["vat_input_creditable"]),
      ) ?? null;
    case "vat_sales_basic":
    case "vat_sales_minimum":
    case "vat_sales_other":
      return accounts.find((account) =>
        matchesHeuristic(account, ["iva ventas", "debito fiscal"], ["vat_output_payable"]),
      ) ?? null;
    case "accounts_payable":
      return accounts.find((account) =>
        matchesHeuristic(account, ["proveedores", "acreedores"], ["accounts_payable"]),
      ) ?? null;
    case "partner_reimbursement_payable":
      return accounts.find((account) =>
        matchesHeuristic(account, ["socio", "reintegrar", "reintegro", "anticipo"], ["partner_reimbursement"]),
      ) ?? null;
    case "accounts_receivable":
      return accounts.find((account) =>
        matchesHeuristic(account, ["clientes", "deudores"], ["accounts_receivable"]),
      ) ?? null;
    case "sales_local":
      return accounts.find((account) =>
        matchesHeuristic(account, ["ventas plaza", "ventas locales", "ventas gravadas"], ["sales_local"]),
      ) ?? null;
    case "sales_export":
      return accounts.find((account) =>
        matchesHeuristic(account, ["exportacion", "exportaciones", "exterior"], ["sales_export"]),
      ) ?? null;
    case "cash_uyu":
    case "cash_usd":
    case "cash_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["caja", "cash"], ["cash_uyu", "cash"]),
      ) ?? null;
    case "bank_uyu":
    case "bank_usd":
    case "bank_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["banco", "bank"], ["bank_uyu", "bank_usd", "bank"]),
      ) ?? null;
    case "withholding_payable":
      return accounts.find((account) =>
        matchesHeuristic(account, ["retencion", "retenciones"], ["withholding_payable"]),
      ) ?? null;
    case "fx_gain":
    case "fx_loss":
      return accounts.find((account) =>
        matchesHeuristic(account, ["diferencia de cambio", "resultado cambio"], ["fx_difference"]),
      ) ?? null;
    case "card_clearing_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["tarjeta", "adquir", "card"], ["card_receivables", "card_clearing"]),
      ) ?? null;
    case "check_clearing_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["cheque", "valores"], ["check_clearing"]),
      ) ?? null;
    case "cash_sales_unidentified_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["identificar", "cobro contado"], ["cash_sales_unidentified"]),
      ) ?? null;
    case "cash_purchases_unidentified_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["identificar", "pago contado"], ["cash_purchases_unidentified"]),
      ) ?? null;
    case "bank_fees_account":
      return accounts.find((account) =>
        matchesHeuristic(account, ["comision", "arancel", "fee"], ["bank_fees", "card_fees"]),
      ) ?? null;
    default:
      return null;
  }
}

function resolveFromPrimaryAccount(input: {
  roleCode: AccountRoleCode;
  accounts: PostableAccountRecord[];
  appliedRule: ResolvedAccountingRule;
}) {
  const primaryAccount = findAccountById(input.accounts, input.appliedRule.accountId);

  if (!primaryAccount) {
    return null;
  }

  const normalizedType = normalizeTextToken(primaryAccount.account_type);

  if (
    input.roleCode === "revenue_account"
    && (normalizedType === "revenue" || normalizedType === "income")
  ) {
    return primaryAccount;
  }

  if (
    input.roleCode === "expense_account"
    && normalizedType === "expense"
  ) {
    return primaryAccount;
  }

  if (input.roleCode === "inventory_account" && normalizedType === "asset") {
    return primaryAccount;
  }

  if (input.roleCode === "fixed_asset_account" && normalizedType === "asset") {
    return primaryAccount;
  }

  return null;
}

export function resolveAccountRole(input: {
  roleCode: AccountRoleCode;
  accounts: PostableAccountRecord[];
  appliedRule: ResolvedAccountingRule;
  manualRoleOverrides?: ManualAccountRoleOverrides;
  bindings?: AccountRoleBindingRecord[];
  documentRole?: string | null;
  currencyCode?: string | null;
  settlementMethod?: SettlementMethod | null;
}) {
  const manualRoleOverrideId = input.manualRoleOverrides?.[input.roleCode] ?? null;

  if (manualRoleOverrideId) {
    const account = findAccountById(input.accounts, manualRoleOverrideId);

    return {
      roleCode: input.roleCode,
      accountId: account?.id ?? manualRoleOverrideId,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      isProvisional: isProvisionalAccount(account),
      provenance: "manual_role_override",
    } satisfies ResolvedAccountRole;
  }

  const fromPrimary = resolveFromPrimaryAccount(input);

  if (fromPrimary) {
    return {
      roleCode: input.roleCode,
      accountId: fromPrimary.id,
      accountCode: fromPrimary.code,
      accountName: fromPrimary.name,
      isProvisional: isProvisionalAccount(fromPrimary),
      provenance: input.appliedRule.provenance,
    } satisfies ResolvedAccountRole;
  }

  const fromBinding = findAccountByBinding({
    accounts: input.accounts,
    bindings: input.bindings ?? [],
    roleCode: input.roleCode,
    documentRole: input.documentRole ?? null,
    currencyCode: input.currencyCode ?? null,
    settlementMethod: input.settlementMethod ?? null,
  });

  if (fromBinding?.account) {
    return {
      roleCode: input.roleCode,
      accountId: fromBinding.account.id,
      accountCode: fromBinding.account.code,
      accountName: fromBinding.account.name,
      isProvisional: isProvisionalAccount(fromBinding.account),
      provenance: `binding:${fromBinding.binding.binding_key}`,
    } satisfies ResolvedAccountRole;
  }

  const bySystemRole = findAccountBySystemRole(input.accounts, input.roleCode);

  if (bySystemRole) {
    return {
      roleCode: input.roleCode,
      accountId: bySystemRole.id,
      accountCode: bySystemRole.code,
      accountName: bySystemRole.name,
      isProvisional: isProvisionalAccount(bySystemRole),
      provenance: `system_role:${String(bySystemRole.metadata?.system_role ?? input.roleCode)}`,
    } satisfies ResolvedAccountRole;
  }

  const byHeuristic = findAccountByHeuristic(input.accounts, input.roleCode);

  if (byHeuristic) {
    return {
      roleCode: input.roleCode,
      accountId: byHeuristic.id,
      accountCode: byHeuristic.code,
      accountName: byHeuristic.name,
      isProvisional: isProvisionalAccount(byHeuristic),
      provenance: "heuristic_role_match",
    } satisfies ResolvedAccountRole;
  }

  return {
    roleCode: input.roleCode,
    accountId: null,
    accountCode: null,
    accountName: null,
    isProvisional: false,
    provenance: "missing_role_mapping",
  } satisfies ResolvedAccountRole;
}
