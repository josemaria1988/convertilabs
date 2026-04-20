import type { AccountRoleCode } from "@/modules/accounting/types";

export type AccountRoleNormalBalance = "debit" | "credit" | "mixed";

export type AccountRoleDefinition = {
  code: AccountRoleCode;
  label: string;
  description: string;
  normalBalance: AccountRoleNormalBalance;
  requiredForTemplates: string[];
  zetaSearchHints: string[];
  bridgeRequired: boolean;
  visibleInZetaRoleMap: boolean;
};

function defineRole(definition: AccountRoleDefinition) {
  return definition;
}

export const ACCOUNT_ROLE_DEFINITIONS = [
  defineRole({
    code: "purchase_expense_default",
    label: "Gasto operativo default",
    description: "Cuenta principal de gasto cuando no hay concepto Zeta o regla mas especifica.",
    normalBalance: "debit",
    requiredForTemplates: [
      "purchase_expense_credit.v1",
      "purchase_expense_paid_by_partner.v1",
      "purchase_expense_cash_uyu.v1",
      "purchase_expense_bank_uyu.v1",
      "supplier_credit_note.v1",
    ],
    zetaSearchHints: ["gastos administrativos", "gastos generales", "gasto operativo", "servicios"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "purchase_inventory",
    label: "Mercaderias / stock",
    description: "Cuenta de compras de mercaderia o inventario.",
    normalBalance: "debit",
    requiredForTemplates: ["purchase_inventory_credit.v1"],
    zetaSearchHints: ["mercaderia", "mercaderias", "inventario", "stock", "compras mercaderia"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "purchase_fixed_asset",
    label: "Activo fijo",
    description: "Cuenta de altas de bienes de uso o activo fijo.",
    normalBalance: "debit",
    requiredForTemplates: ["purchase_fixed_asset_credit.v1"],
    zetaSearchHints: ["activo fijo", "bienes de uso", "propiedad planta equipo", "maquinaria"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "vat_purchase_basic",
    label: "IVA compras basica",
    description: "Credito fiscal de compras a tasa basica.",
    normalBalance: "debit",
    requiredForTemplates: [
      "purchase_expense_credit.v1",
      "purchase_expense_paid_by_partner.v1",
      "purchase_expense_cash_uyu.v1",
      "purchase_expense_bank_uyu.v1",
      "purchase_fixed_asset_credit.v1",
      "purchase_inventory_credit.v1",
      "supplier_credit_note.v1",
    ],
    zetaSearchHints: ["iva compras", "iva credito fiscal", "iva crédito fiscal", "iva compras basica"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "vat_purchase_minimum",
    label: "IVA compras minima",
    description: "Credito fiscal de compras a tasa minima.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["iva compras minima", "iva credito fiscal minima", "iva mínimo compras"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "vat_purchase_other",
    label: "IVA compras otras tasas",
    description: "Credito fiscal de compras cuando la tasa no es basica ni minima.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["iva compras", "iva otras tasas", "credito fiscal"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "accounts_payable",
    label: "Proveedores",
    description: "Pasivo operativo por facturas de proveedores a credito.",
    normalBalance: "credit",
    requiredForTemplates: [
      "purchase_expense_credit.v1",
      "purchase_fixed_asset_credit.v1",
      "purchase_inventory_credit.v1",
      "supplier_credit_note.v1",
    ],
    zetaSearchHints: ["proveedores", "acreedores comerciales", "cuentas a pagar"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "partner_reimbursement_payable",
    label: "Cuenta a reintegrar a socio",
    description: "Pasivo por compras pagadas con dinero personal de socios o vinculados.",
    normalBalance: "credit",
    requiredForTemplates: ["purchase_expense_paid_by_partner.v1"],
    zetaSearchHints: [
      "socio",
      "socios",
      "reintegrar",
      "reintegro",
      "anticipo",
      "cuenta a pagar socio",
      "a reintegrar",
    ],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "cash_uyu",
    label: "Caja pesos",
    description: "Caja de la empresa en pesos uruguayos.",
    normalBalance: "debit",
    requiredForTemplates: ["purchase_expense_cash_uyu.v1", "sale_local_cash_uyu.v1"],
    zetaSearchHints: ["caja", "caja pesos", "efectivo", "caja moneda nacional"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "cash_usd",
    label: "Caja dolares",
    description: "Caja de la empresa en dolares.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["caja usd", "caja dolares", "caja dólares", "efectivo usd"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "bank_uyu",
    label: "Banco pesos",
    description: "Cuenta bancaria de la empresa en pesos uruguayos.",
    normalBalance: "debit",
    requiredForTemplates: ["purchase_expense_bank_uyu.v1", "sale_local_bank_uyu.v1"],
    zetaSearchHints: ["banco", "brou", "cuenta corriente", "banco pesos", "banco moneda nacional"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "bank_usd",
    label: "Banco dolares",
    description: "Cuenta bancaria de la empresa en dolares.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["banco usd", "banco dolares", "banco dólares", "cuenta corriente usd"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "accounts_receivable",
    label: "Clientes / deudores por ventas",
    description: "Activo por ventas a credito.",
    normalBalance: "debit",
    requiredForTemplates: ["sale_local_credit.v1", "sale_export_credit.v1", "customer_credit_note.v1"],
    zetaSearchHints: ["clientes", "deudores por ventas", "cuentas a cobrar", "deudores comerciales"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "sales_local",
    label: "Ventas plaza",
    description: "Cuenta de ingresos por ventas locales.",
    normalBalance: "credit",
    requiredForTemplates: [
      "sale_local_credit.v1",
      "sale_local_cash_uyu.v1",
      "sale_local_bank_uyu.v1",
      "customer_credit_note.v1",
    ],
    zetaSearchHints: ["ventas plaza", "ventas gravadas", "ventas locales", "ingresos ventas"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "sales_export",
    label: "Ventas exportacion",
    description: "Cuenta de ingresos por ventas de exportacion.",
    normalBalance: "credit",
    requiredForTemplates: ["sale_export_credit.v1"],
    zetaSearchHints: ["exportacion", "exportaciones", "ventas exterior", "ventas exportacion"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "vat_sales_basic",
    label: "IVA ventas basica",
    description: "Debito fiscal de ventas a tasa basica.",
    normalBalance: "credit",
    requiredForTemplates: [
      "sale_local_credit.v1",
      "sale_local_cash_uyu.v1",
      "sale_local_bank_uyu.v1",
      "customer_credit_note.v1",
    ],
    zetaSearchHints: ["iva ventas", "iva debito fiscal", "iva débito fiscal", "iva ventas basica"],
    bridgeRequired: true,
    visibleInZetaRoleMap: true,
  }),
  defineRole({
    code: "vat_sales_minimum",
    label: "IVA ventas minima",
    description: "Debito fiscal de ventas a tasa minima.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["iva ventas minima", "iva debito fiscal minima", "iva mínimo ventas"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "vat_sales_other",
    label: "IVA ventas otras tasas",
    description: "Debito fiscal de ventas cuando la tasa no es basica ni minima.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["iva ventas", "iva otras tasas", "debito fiscal"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "withholding_payable",
    label: "Retenciones a pagar",
    description: "Pasivo por retenciones practicadas.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["retenciones", "retencion a pagar", "retenciones a pagar"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "fx_gain",
    label: "Diferencia de cambio ganancia",
    description: "Resultado positivo por diferencias de cambio.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["diferencia de cambio ganancia", "ganancia cambio", "resultado cambio"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "fx_loss",
    label: "Diferencia de cambio perdida",
    description: "Resultado negativo por diferencias de cambio.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["diferencia de cambio perdida", "perdida cambio", "resultado cambio"],
    bridgeRequired: true,
    visibleInZetaRoleMap: false,
  }),
] as const satisfies readonly AccountRoleDefinition[];

export const LEGACY_ACCOUNT_ROLE_DEFINITIONS = [
  defineRole({
    code: "revenue_account",
    label: "Cuenta principal de ingresos",
    description: "Rol historico para ingresos principales.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["ventas", "ingresos"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "expense_account",
    label: "Cuenta principal de gastos",
    description: "Rol historico para gastos principales.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["gastos", "egresos"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "inventory_account",
    label: "Cuenta principal de inventario",
    description: "Rol historico para inventario.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["inventario", "stock"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "fixed_asset_account",
    label: "Cuenta principal de activo",
    description: "Rol historico para activo fijo.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["activo fijo", "bienes de uso"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "output_vat_account",
    label: "Cuenta de IVA ventas",
    description: "Rol historico para debito fiscal.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["iva ventas", "debito fiscal"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "input_vat_account",
    label: "Cuenta de IVA compras",
    description: "Rol historico para credito fiscal.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["iva compras", "credito fiscal"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "accounts_receivable_account",
    label: "Cuenta de clientes",
    description: "Rol historico para deudores por venta.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["clientes", "deudores por ventas"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "accounts_payable_account",
    label: "Cuenta de proveedores",
    description: "Rol historico para proveedores.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["proveedores", "acreedores"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "cash_account",
    label: "Cuenta de caja",
    description: "Rol historico para caja.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["caja", "efectivo"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "bank_account",
    label: "Cuenta bancaria",
    description: "Rol historico para bancos.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["banco", "cuenta corriente"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "card_clearing_account",
    label: "Cuenta de tarjetas a cobrar",
    description: "Rol historico para clearing de tarjetas.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["tarjetas", "adquirente"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "check_clearing_account",
    label: "Cuenta de cheques",
    description: "Rol historico para valores y cheques.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["cheques", "valores"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "cash_sales_unidentified_account",
    label: "Cuenta provisoria para cobros a identificar",
    description: "Rol historico para cobros contado sin medio confirmado.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["cobros a identificar"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "cash_purchases_unidentified_account",
    label: "Cuenta provisoria para pagos a identificar",
    description: "Rol historico para pagos contado sin medio confirmado.",
    normalBalance: "credit",
    requiredForTemplates: [],
    zetaSearchHints: ["pagos a identificar"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "bank_fees_account",
    label: "Cuenta de comisiones o gastos bancarios",
    description: "Rol historico para comisiones bancarias.",
    normalBalance: "debit",
    requiredForTemplates: [],
    zetaSearchHints: ["comisiones", "gastos bancarios"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
  defineRole({
    code: "fx_difference_account",
    label: "Cuenta de diferencias de cambio",
    description: "Rol historico generico para diferencias de cambio.",
    normalBalance: "mixed",
    requiredForTemplates: [],
    zetaSearchHints: ["diferencia de cambio"],
    bridgeRequired: false,
    visibleInZetaRoleMap: false,
  }),
] as const satisfies readonly AccountRoleDefinition[];

export const ALL_ACCOUNT_ROLE_DEFINITIONS = [
  ...LEGACY_ACCOUNT_ROLE_DEFINITIONS,
  ...ACCOUNT_ROLE_DEFINITIONS,
] as const satisfies readonly AccountRoleDefinition[];

const accountRoleDefinitionsByCode = new Map<AccountRoleCode, AccountRoleDefinition>(
  ALL_ACCOUNT_ROLE_DEFINITIONS.map((definition) => [definition.code, definition]),
);

export const ZETA_ROLE_MAP_PRIMARY_ROLE_CODES = ACCOUNT_ROLE_DEFINITIONS
  .filter((definition) => definition.visibleInZetaRoleMap)
  .map((definition) => definition.code);

export const ACCOUNT_ROLE_CODES = ALL_ACCOUNT_ROLE_DEFINITIONS.map((definition) => definition.code);

const equivalentBindingRoles: Partial<Record<AccountRoleCode, AccountRoleCode[]>> = {
  revenue_account: ["revenue_account", "sales_local", "sales_export"],
  expense_account: ["expense_account", "purchase_expense_default"],
  inventory_account: ["inventory_account", "purchase_inventory"],
  fixed_asset_account: ["fixed_asset_account", "purchase_fixed_asset"],
  output_vat_account: ["output_vat_account", "vat_sales_basic", "vat_sales_minimum", "vat_sales_other"],
  input_vat_account: ["input_vat_account", "vat_purchase_basic", "vat_purchase_minimum", "vat_purchase_other"],
  accounts_receivable_account: ["accounts_receivable_account", "accounts_receivable"],
  accounts_payable_account: ["accounts_payable_account", "accounts_payable"],
  cash_account: ["cash_account", "cash_uyu", "cash_usd"],
  bank_account: ["bank_account", "bank_uyu", "bank_usd"],
  fx_difference_account: ["fx_difference_account", "fx_gain", "fx_loss"],
};

export function listAccountRoleDefinitions() {
  return [...ALL_ACCOUNT_ROLE_DEFINITIONS];
}

export function listZetaRoleMapDefinitions() {
  return ACCOUNT_ROLE_DEFINITIONS.filter((definition) => definition.visibleInZetaRoleMap);
}

export function getAccountRoleDefinition(code: string | null | undefined) {
  return code ? accountRoleDefinitionsByCode.get(code as AccountRoleCode) ?? null : null;
}

export function isAccountRoleCode(value: string | null | undefined): value is AccountRoleCode {
  return Boolean(value && accountRoleDefinitionsByCode.has(value as AccountRoleCode));
}

export function getEquivalentBindingRoleCodes(roleCode: AccountRoleCode) {
  const equivalents = equivalentBindingRoles[roleCode] ?? [roleCode];

  return equivalents.filter((value, index, array) => array.indexOf(value) === index);
}
