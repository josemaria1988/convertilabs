import type { PresetBundle } from "@/modules/accounting/presets/types";

export const uyBaseSaGeneralPresetV1: PresetBundle = {
  code: "UY_BASE_SA_GENERAL_V1",
  version: "v1",
  kind: "base",
  label: "Base Uruguay sociedad comercial general",
  description: "Base general para Uruguay con estructura contable inicial, cuentas de resultados, IVA y patrimonio.",
  accounts: [
    { code: "1.1.1.01", name: "Caja UYU", accountType: "asset", semanticKey: "cash_uyu", natureTag: "cash" },
    { code: "1.1.1.02", name: "Bancos UYU", accountType: "asset", semanticKey: "bank_uyu", natureTag: "cash" },
    { code: "1.1.2.01", name: "Creditos por ventas plaza", accountType: "asset", semanticKey: "trade_receivables", natureTag: "receivables" },
    { code: "1.1.2.02", name: "Anticipos a proveedores", accountType: "asset", semanticKey: "supplier_advances", natureTag: "advances" },
    { code: "1.1.3.01", name: "IVA compras credito fiscal", accountType: "asset", semanticKey: "vat_input_credit", natureTag: "vat_input", taxProfileHint: "UY_VAT_PURCHASE_BASIC" },
    { code: "1.1.4.01", name: "Mercaderias", accountType: "asset", semanticKey: "inventory_goods", natureTag: "inventory" },
    { code: "2.1.1.01", name: "Proveedores plaza", accountType: "liability", semanticKey: "trade_payables", natureTag: "payables" },
    { code: "2.1.2.01", name: "IVA ventas debito fiscal", accountType: "liability", semanticKey: "vat_output_payable", natureTag: "vat_output", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "3.1.1.01", name: "Capital integrado", accountType: "equity", semanticKey: "equity_capital", natureTag: "equity" },
    { code: "4.1.1.01", name: "Ventas gravadas plaza", accountType: "revenue", semanticKey: "sales_basic", natureTag: "sales_basic", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "4.1.2.01", name: "Servicios gravados", accountType: "revenue", semanticKey: "services_basic", natureTag: "services", taxProfileHint: "UY_VAT_SALE_BASIC" },
    { code: "5.1.1.01", name: "Costo de ventas", accountType: "expense", semanticKey: "cost_of_sales", natureTag: "cogs" },
    { code: "5.2.1.01", name: "Gastos administrativos", accountType: "expense", semanticKey: "admin_expenses", natureTag: "admin_expense" },
    { code: "5.2.1.02", name: "Honorarios profesionales", accountType: "expense", semanticKey: "professional_fees", natureTag: "admin_expense" }
  ],
  journalTemplates: [
    { code: "purchase_local_basic", label: "Compra local basica", description: "Compra local con IVA credito fiscal." },
    { code: "sale_local_basic", label: "Venta local basica", description: "Venta local con debito fiscal." }
  ],
  taxProfiles: [
    { code: "UY_VAT_PURCHASE_BASIC", label: "IVA compras basico" },
    { code: "UY_VAT_SALE_BASIC", label: "IVA ventas basico" }
  ],
  uiHints: [
    { key: "plan_recomendado", tone: "info", message: "Siempre se compone sobre una base general Uruguay antes de sumar overlays." }
  ],
};
