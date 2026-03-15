import type { PostableAccountRecord } from "@/modules/accounting/types";

export type ChartPresetCode = "uy_niif_importadores";

export type ChartPresetAccountDefinition = {
  code: string;
  name: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  normalSide?: "debit" | "credit";
  isPostable?: boolean;
  isProvisional?: boolean;
  systemRole?: string;
  externalCode?: string | null;
  statementSection?: string | null;
  natureTag?: string | null;
  functionTag?: string | null;
  cashflowTag?: string | null;
  taxProfileHint?: string | null;
  currencyPolicy?: string | null;
};

export type ChartPresetDefinition = {
  code: ChartPresetCode;
  label: string;
  description: string;
  accounts: ChartPresetAccountDefinition[];
};

function inferNormalSide(
  accountType: ChartPresetAccountDefinition["accountType"],
  normalSide?: "debit" | "credit",
) {
  if (normalSide) {
    return normalSide;
  }

  return accountType === "liability" || accountType === "equity" || accountType === "revenue"
    ? "credit"
    : "debit";
}

const presetAccounts: ChartPresetAccountDefinition[] = [
  { code: "1.1.1.01", name: "Caja UYU", accountType: "asset", natureTag: "cash" },
  { code: "1.1.1.02", name: "Bancos UYU", accountType: "asset", natureTag: "cash" },
  { code: "1.1.1.03", name: "Bancos USD", accountType: "asset", natureTag: "cash_fx", currencyPolicy: "multi_currency" },
  { code: "1.1.1.04", name: "Valores a depositar", accountType: "asset", natureTag: "cash" },
  { code: "1.1.2.01", name: "Creditos por ventas plaza", accountType: "asset", natureTag: "receivables" },
  { code: "1.1.2.02", name: "Documentos a cobrar", accountType: "asset", natureTag: "receivables" },
  { code: "1.1.2.03", name: "Deudores varios", accountType: "asset", natureTag: "receivables_other" },
  { code: "1.1.2.04", name: "Anticipos a proveedores", accountType: "asset", natureTag: "advances" },
  { code: "1.1.3.01", name: "IVA compras plaza credito fiscal", accountType: "asset", natureTag: "vat_input", taxProfileHint: "UY_VAT_PURCHASE_BASIC" },
  { code: "1.1.3.02", name: "IVA importacion credito fiscal", accountType: "asset", natureTag: "vat_input_import", taxProfileHint: "UY_VAT_IMPORT_CREDITABLE" },
  { code: "1.1.3.03", name: "Anticipo IVA importacion recuperable", accountType: "asset", natureTag: "vat_advance_import", taxProfileHint: "UY_VAT_IMPORT_ANTICIPO" },
  { code: "1.1.3.04", name: "Otras percepciones recuperables", accountType: "asset", natureTag: "tax_credit" },
  { code: "1.1.4.01", name: "Mercaderias", accountType: "asset", natureTag: "inventory" },
  { code: "1.1.4.02", name: "Materias primas e insumos", accountType: "asset", natureTag: "inventory" },
  { code: "1.1.4.03", name: "Repuestos", accountType: "asset", natureTag: "inventory_spares" },
  { code: "1.1.4.04", name: "Mercaderias en transito", accountType: "asset", natureTag: "inventory_in_transit", currencyPolicy: "multi_currency" },
  { code: "1.1.4.05", name: "Gastos de importacion a distribuir", accountType: "asset", natureTag: "import_cost_pool", taxProfileHint: "UY_VAT_IMPORT_CREDITABLE" },
  { code: "1.1.5.01", name: "Gastos pagados por adelantado", accountType: "asset", natureTag: "prepaid" },
  { code: "1.1.5.02", name: "Seguros pagados por adelantado", accountType: "asset", natureTag: "prepaid" },
  { code: "1.2.1.01", name: "Maquinaria y equipos", accountType: "asset", natureTag: "ppe" },
  { code: "1.2.1.02", name: "Rodados", accountType: "asset", natureTag: "ppe" },
  { code: "1.2.1.03", name: "Muebles y utiles", accountType: "asset", natureTag: "ppe" },
  { code: "1.2.1.04", name: "Equipos informaticos", accountType: "asset", natureTag: "ppe" },
  { code: "1.2.1.05", name: "Mejoras en inmuebles arrendados", accountType: "asset", natureTag: "ppe" },
  { code: "1.2.1.06", name: "Activo fijo en curso", accountType: "asset", natureTag: "ppe_cip" },
  { code: "1.2.9.01", name: "Depreciacion acumulada maquinaria y equipos", accountType: "asset", normalSide: "credit", natureTag: "contra_asset" },
  { code: "1.2.9.02", name: "Depreciacion acumulada rodados", accountType: "asset", normalSide: "credit", natureTag: "contra_asset" },
  { code: "1.2.9.03", name: "Depreciacion acumulada muebles y utiles", accountType: "asset", normalSide: "credit", natureTag: "contra_asset" },
  { code: "1.2.9.04", name: "Depreciacion acumulada equipos informaticos", accountType: "asset", normalSide: "credit", natureTag: "contra_asset" },
  { code: "2.1.1.01", name: "Proveedores plaza", accountType: "liability", natureTag: "payables" },
  { code: "2.1.1.02", name: "Proveedores del exterior", accountType: "liability", natureTag: "payables_fx", currencyPolicy: "multi_currency" },
  { code: "2.1.1.03", name: "Documentos a pagar", accountType: "liability", natureTag: "payables" },
  { code: "2.1.1.04", name: "Acreedores varios", accountType: "liability", natureTag: "payables_other" },
  { code: "2.1.2.01", name: "IVA ventas debito fiscal", accountType: "liability", natureTag: "vat_output", taxProfileHint: "UY_VAT_SALE_BASIC" },
  { code: "2.1.2.02", name: "IVA a pagar", accountType: "liability", natureTag: "vat_payable" },
  { code: "2.1.2.03", name: "Retenciones y percepciones por pagar", accountType: "liability", natureTag: "tax_payable" },
  { code: "2.1.2.04", name: "Anticipos de clientes", accountType: "liability", natureTag: "advances_received" },
  { code: "2.1.2.05", name: "Tributos aduaneros a pagar", accountType: "liability", natureTag: "customs_payable" },
  { code: "2.1.2.06", name: "Diferencias de cambio realizadas a pagar", accountType: "liability", natureTag: "fx_result_short" },
  { code: "2.2.1.01", name: "Prestamos y obligaciones financieras LP", accountType: "liability", natureTag: "debt_long" },
  { code: "2.2.1.02", name: "Pasivo por arrendamientos LP", accountType: "liability", natureTag: "lease_long" },
  { code: "3.1.1.01", name: "Capital integrado", accountType: "equity", natureTag: "equity" },
  { code: "3.1.2.01", name: "Reservas", accountType: "equity", natureTag: "equity" },
  { code: "3.1.3.01", name: "Resultados acumulados", accountType: "equity", natureTag: "retained_earnings" },
  { code: "3.1.3.02", name: "Resultado del ejercicio", accountType: "equity", natureTag: "current_year_result" },
  { code: "4.1.1.01", name: "Ventas plaza tasa basica", accountType: "revenue", natureTag: "sales_basic", taxProfileHint: "UY_VAT_SALE_BASIC" },
  { code: "4.1.1.02", name: "Ventas plaza tasa minima", accountType: "revenue", natureTag: "sales_minimum", taxProfileHint: "UY_VAT_SALE_MINIMUM" },
  { code: "4.1.1.03", name: "Ventas exentas o no gravadas", accountType: "revenue", natureTag: "sales_exempt", taxProfileHint: "UY_VAT_PURCHASE_EXEMPT" },
  { code: "4.1.1.04", name: "Exportaciones", accountType: "revenue", natureTag: "export_sales", taxProfileHint: "UY_VAT_EXPORT" },
  { code: "4.1.2.01", name: "Servicios gravados", accountType: "revenue", natureTag: "services", taxProfileHint: "UY_VAT_SALE_BASIC" },
  { code: "4.1.9.01", name: "Descuentos y devoluciones sobre ventas", accountType: "revenue", normalSide: "debit", natureTag: "contra_revenue" },
  { code: "4.1.9.02", name: "Diferencias de cambio realizadas ganadas", accountType: "revenue", natureTag: "fx_gain" },
  { code: "5.1.1.01", name: "Costo de ventas mercaderias", accountType: "expense", natureTag: "cogs" },
  { code: "5.1.1.02", name: "Consumo de materias primas e insumos", accountType: "expense", natureTag: "cogs" },
  { code: "5.1.1.03", name: "Variacion de inventarios", accountType: "expense", natureTag: "inventory_variation" },
  { code: "5.1.2.01", name: "Gastos de importacion no capitalizables", accountType: "expense", natureTag: "import_expense" },
  { code: "5.1.2.02", name: "Fletes y seguros de compra no capitalizables", accountType: "expense", natureTag: "import_expense" },
  { code: "5.2.1.01", name: "Sueldos y cargas", accountType: "expense", natureTag: "admin_expense" },
  { code: "5.2.1.02", name: "Honorarios profesionales", accountType: "expense", natureTag: "admin_expense" },
  { code: "5.2.1.03", name: "Arrendamientos", accountType: "expense", natureTag: "admin_expense" },
  { code: "5.2.1.04", name: "Electricidad, agua y telecomunicaciones", accountType: "expense", natureTag: "admin_expense" },
  { code: "5.2.1.05", name: "Papeleria y gastos generales", accountType: "expense", natureTag: "admin_expense" },
  { code: "5.2.1.06", name: "Reparaciones y mantenimiento", accountType: "expense", natureTag: "admin_expense" },
  { code: "5.2.1.07", name: "Fletes y distribucion ventas", accountType: "expense", natureTag: "selling_expense" },
  { code: "5.2.1.08", name: "Comisiones de ventas", accountType: "expense", natureTag: "selling_expense" },
  { code: "5.2.1.09", name: "Gastos bancarios", accountType: "expense", natureTag: "finance_expense" },
  { code: "5.2.1.10", name: "Intereses perdidos", accountType: "expense", natureTag: "finance_expense" },
  { code: "5.2.1.11", name: "Diferencias de cambio realizadas perdidas", accountType: "expense", natureTag: "fx_loss" },
  { code: "5.2.2.01", name: "Depreciacion maquinaria y equipos", accountType: "expense", natureTag: "depreciation" },
  { code: "5.2.2.02", name: "Depreciacion rodados", accountType: "expense", natureTag: "depreciation" },
  { code: "5.2.2.03", name: "Depreciacion muebles y utiles", accountType: "expense", natureTag: "depreciation" },
  { code: "5.2.2.04", name: "Depreciacion equipos informaticos", accountType: "expense", natureTag: "depreciation" },
  { code: "SYS-AR", name: "Deudores por ventas del sistema", accountType: "asset", systemRole: "accounts_receivable", natureTag: "system" },
  { code: "SYS-AP", name: "Proveedores del sistema", accountType: "liability", systemRole: "accounts_payable", natureTag: "system" },
  { code: "SYS-VAT-IN", name: "IVA compras acreditable del sistema", accountType: "asset", systemRole: "vat_input_creditable", natureTag: "system", taxProfileHint: "UY_VAT_PURCHASE_BASIC" },
  { code: "SYS-VAT-OUT", name: "IVA ventas debito fiscal del sistema", accountType: "liability", systemRole: "vat_output_payable", natureTag: "system", taxProfileHint: "UY_VAT_SALE_BASIC" },
  { code: "GEN-SALE", name: "Ingreso generico starter", accountType: "revenue", natureTag: "system_generic" },
  { code: "GEN-EXP", name: "Gasto generico starter", accountType: "expense", natureTag: "system_generic" },
  { code: "TEMP-EXP", name: "Gasto por clasificar", accountType: "expense", isProvisional: true, natureTag: "provisional", taxProfileHint: "UY_VAT_NON_DEDUCTIBLE" },
  { code: "TEMP-REV", name: "Ingreso por clasificar", accountType: "revenue", isProvisional: true, natureTag: "provisional" },
  { code: "TEMP-INV", name: "Inventario por clasificar", accountType: "asset", isProvisional: true, natureTag: "provisional" },
  { code: "TEMP-AST", name: "Activo por clasificar", accountType: "asset", isProvisional: true, natureTag: "provisional" },
  { code: "TEMP-LIA", name: "Pasivo por clasificar", accountType: "liability", isProvisional: true, natureTag: "provisional" },
];

const chartPresets: ChartPresetDefinition[] = [
  {
    code: "uy_niif_importadores",
    label: "Convertilabs Uruguay NIIF-ready / Importadores",
    description:
      "Preset estandar para empresas comerciales, industriales e importadoras con foco IVA, multi-moneda y exportacion al ERP existente.",
    accounts: presetAccounts,
  },
];

export function listChartPresets() {
  return chartPresets;
}

export function getChartPresetByCode(code: ChartPresetCode) {
  return chartPresets.find((preset) => preset.code === code) ?? null;
}

export function isProvisionalAccountCode(code: string | null | undefined) {
  return ["TEMP-EXP", "TEMP-REV", "TEMP-INV", "TEMP-AST", "TEMP-LIA"].includes((code ?? "").trim().toUpperCase());
}

export function resolveProvisionalAccountCode(input: {
  documentRole: "purchase" | "sale" | "other";
  accountTypeHint?: string | null;
  operationCategory?: string | null;
}) {
  if (input.documentRole === "sale") {
    return "TEMP-REV";
  }

  switch ((input.accountTypeHint ?? "").trim().toLowerCase()) {
    case "asset":
      return input.operationCategory?.includes("inventory") ? "TEMP-INV" : "TEMP-AST";
    case "liability":
      return "TEMP-LIA";
    default:
      return "TEMP-EXP";
  }
}

export function buildChartPresetPayload(input: {
  organizationId: string;
  actorId: string | null;
  presetCode: ChartPresetCode;
  existingAccounts?: Array<Pick<PostableAccountRecord, "code">> | null;
}) {
  const preset = getChartPresetByCode(input.presetCode);

  if (!preset) {
    throw new Error("Preset de plan de cuentas no encontrado.");
  }

  const existingCodes = new Set(
    (input.existingAccounts ?? [])
      .map((account) => account.code?.trim().toUpperCase())
      .filter((value): value is string => Boolean(value)),
  );

  return preset.accounts
    .filter((account) => !existingCodes.has(account.code.toUpperCase()))
    .map((account) => ({
      organization_id: input.organizationId,
      code: account.code,
      name: account.name,
      account_type: account.accountType,
      normal_side: inferNormalSide(account.accountType, account.normalSide),
      is_postable: account.isPostable ?? true,
      is_provisional: account.isProvisional ?? false,
      source: account.systemRole ? "system" : "preset",
      external_code: account.externalCode ?? null,
      statement_section: account.statementSection ?? null,
      nature_tag: account.natureTag ?? null,
      function_tag: account.functionTag ?? null,
      cashflow_tag: account.cashflowTag ?? null,
      tax_profile_hint: account.taxProfileHint ?? null,
      currency_policy: account.currencyPolicy ?? "mono_currency",
      metadata: {
        source: account.systemRole ? "system" : "preset",
        preset_code: input.presetCode,
        preset_seeded_by: input.actorId,
        system_role: account.systemRole ?? null,
        is_provisional: account.isProvisional ?? false,
        nature_tag: account.natureTag ?? null,
        tax_profile_hint: account.taxProfileHint ?? null,
      },
    }));
}
