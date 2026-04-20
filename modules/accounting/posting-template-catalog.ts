import type { AccountRoleCode } from "@/modules/accounting/types";

export type PostingTemplateOperationKind =
  | "purchase"
  | "sale"
  | "supplier_credit_note"
  | "customer_credit_note"
  | "adjustment";

export type PostingTemplateOperationFamily =
  | "purchase_expense"
  | "purchase_inventory"
  | "purchase_fixed_asset"
  | "purchase_paid_by_partner"
  | "sale_local"
  | "sale_export"
  | "credit_note"
  | "fx_adjustment";

export type PostingTemplatePaymentTerms =
  | "credit"
  | "cash"
  | "bank"
  | "paid_by_partner"
  | "unknown";

export type PostingTemplateLineAccountRef =
  | AccountRoleCode
  | "document_primary_account"
  | "tax_role_by_rate";

export type PostingTemplateAmountSource =
  | "net_amount"
  | "vat_amount"
  | "gross_total"
  | "net_amount_negative"
  | "vat_amount_negative"
  | "gross_total_negative";

export type PostingTemplateLineDefinition = {
  lineKey: string;
  debitCredit: "debit" | "credit";
  accountRoleCode: PostingTemplateLineAccountRef;
  amountSource: PostingTemplateAmountSource;
  descriptionTemplate: string;
  required: boolean;
};

export type PostingTemplateDefinition = {
  code: string;
  version: string;
  label: string;
  description: string;
  operationKind: PostingTemplateOperationKind;
  operationFamily: PostingTemplateOperationFamily;
  paymentTerms: PostingTemplatePaymentTerms;
  direction: "incoming" | "outgoing" | "adjustment";
  zetaJournalTypeNameHints: string[];
  lines: PostingTemplateLineDefinition[];
  requiredRoleCodes: AccountRoleCode[];
  createsOpenItem: boolean;
  settlementAware: boolean;
};

function uniqueRoles(lines: PostingTemplateLineDefinition[]) {
  return lines
    .map((line) => line.accountRoleCode)
    .filter((role): role is AccountRoleCode =>
      role !== "document_primary_account" && role !== "tax_role_by_rate")
    .filter((role, index, array) => array.indexOf(role) === index);
}

function defineTemplate(
  definition: Omit<PostingTemplateDefinition, "requiredRoleCodes"> & {
    requiredRoleCodes?: AccountRoleCode[];
  },
) {
  return {
    ...definition,
    requiredRoleCodes: definition.requiredRoleCodes ?? uniqueRoles(definition.lines),
  } satisfies PostingTemplateDefinition;
}

const purchaseExpenseBaseLines: PostingTemplateLineDefinition[] = [
  {
    lineKey: "purchase_net",
    debitCredit: "debit",
    accountRoleCode: "document_primary_account",
    amountSource: "net_amount",
    descriptionTemplate: "Gasto / cuenta principal del documento",
    required: true,
  },
  {
    lineKey: "purchase_vat",
    debitCredit: "debit",
    accountRoleCode: "tax_role_by_rate",
    amountSource: "vat_amount",
    descriptionTemplate: "IVA compras segun tasa del CFE",
    required: false,
  },
];

const saleLocalBaseLines: PostingTemplateLineDefinition[] = [
  {
    lineKey: "sale_net",
    debitCredit: "credit",
    accountRoleCode: "sales_local",
    amountSource: "net_amount",
    descriptionTemplate: "Venta plaza",
    required: true,
  },
  {
    lineKey: "sale_vat",
    debitCredit: "credit",
    accountRoleCode: "tax_role_by_rate",
    amountSource: "vat_amount",
    descriptionTemplate: "IVA ventas segun tasa del CFE",
    required: false,
  },
];

export const POSTING_TEMPLATE_CATALOG = [
  defineTemplate({
    code: "purchase_expense_credit.v1",
    version: "v1",
    label: "Compra gasto operativo credito",
    description: "Compra local de gasto operativo con saldo a pagar a proveedor.",
    operationKind: "purchase",
    operationFamily: "purchase_expense",
    paymentTerms: "credit",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Compra Credito", "Compra Crédito", "Diario Principal"],
    lines: [
      ...purchaseExpenseBaseLines,
      {
        lineKey: "accounts_payable",
        debitCredit: "credit",
        accountRoleCode: "accounts_payable",
        amountSource: "gross_total",
        descriptionTemplate: "Proveedor / cuenta a pagar",
        required: true,
      },
    ],
    requiredRoleCodes: ["purchase_expense_default", "accounts_payable"],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "purchase_expense_paid_by_partner.v1",
    version: "v1",
    label: "Compra pagada con dinero personal / a reintegrar",
    description: "Compra chica pagada con fondos personales, sin tocar banco ni caja de la empresa.",
    operationKind: "purchase",
    operationFamily: "purchase_paid_by_partner",
    paymentTerms: "paid_by_partner",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Diario Principal", "Compra Crédito", "Compra Credito", "Egreso de Caja"],
    lines: [
      ...purchaseExpenseBaseLines,
      {
        lineKey: "partner_reimbursement",
        debitCredit: "credit",
        accountRoleCode: "partner_reimbursement_payable",
        amountSource: "gross_total",
        descriptionTemplate: "Cuenta a reintegrar a socio",
        required: true,
      },
    ],
    requiredRoleCodes: ["purchase_expense_default", "partner_reimbursement_payable"],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "purchase_expense_cash_uyu.v1",
    version: "v1",
    label: "Compra gasto operativo contado caja",
    description: "Compra de gasto operativo pagada desde caja de la empresa.",
    operationKind: "purchase",
    operationFamily: "purchase_expense",
    paymentTerms: "cash",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Egreso de Caja", "Diario Principal"],
    lines: [
      ...purchaseExpenseBaseLines,
      {
        lineKey: "cash_uyu",
        debitCredit: "credit",
        accountRoleCode: "cash_uyu",
        amountSource: "gross_total",
        descriptionTemplate: "Caja pesos",
        required: true,
      },
    ],
    requiredRoleCodes: ["purchase_expense_default", "cash_uyu"],
    createsOpenItem: false,
    settlementAware: true,
  }),
  defineTemplate({
    code: "purchase_expense_bank_uyu.v1",
    version: "v1",
    label: "Compra gasto operativo contado banco",
    description: "Compra de gasto operativo pagada desde banco de la empresa.",
    operationKind: "purchase",
    operationFamily: "purchase_expense",
    paymentTerms: "bank",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Egreso Banco", "Diario Principal"],
    lines: [
      ...purchaseExpenseBaseLines,
      {
        lineKey: "bank_uyu",
        debitCredit: "credit",
        accountRoleCode: "bank_uyu",
        amountSource: "gross_total",
        descriptionTemplate: "Banco pesos",
        required: true,
      },
    ],
    requiredRoleCodes: ["purchase_expense_default", "bank_uyu"],
    createsOpenItem: false,
    settlementAware: true,
  }),
  defineTemplate({
    code: "purchase_fixed_asset_credit.v1",
    version: "v1",
    label: "Compra activo fijo credito",
    description: "Compra de bien de uso o activo fijo con saldo a proveedor.",
    operationKind: "purchase",
    operationFamily: "purchase_fixed_asset",
    paymentTerms: "credit",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Compra Crédito", "Compra Credito", "Diario Principal"],
    lines: [
      {
        lineKey: "fixed_asset",
        debitCredit: "debit",
        accountRoleCode: "purchase_fixed_asset",
        amountSource: "net_amount",
        descriptionTemplate: "Activo fijo",
        required: true,
      },
      {
        lineKey: "purchase_vat",
        debitCredit: "debit",
        accountRoleCode: "tax_role_by_rate",
        amountSource: "vat_amount",
        descriptionTemplate: "IVA compras segun tasa del CFE",
        required: false,
      },
      {
        lineKey: "accounts_payable",
        debitCredit: "credit",
        accountRoleCode: "accounts_payable",
        amountSource: "gross_total",
        descriptionTemplate: "Proveedor / cuenta a pagar",
        required: true,
      },
    ],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "purchase_inventory_credit.v1",
    version: "v1",
    label: "Compra mercaderia / stock credito",
    description: "Compra de mercaderia o inventario con saldo a proveedor.",
    operationKind: "purchase",
    operationFamily: "purchase_inventory",
    paymentTerms: "credit",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Compra Crédito", "Compra Credito", "Diario Principal"],
    lines: [
      {
        lineKey: "inventory",
        debitCredit: "debit",
        accountRoleCode: "purchase_inventory",
        amountSource: "net_amount",
        descriptionTemplate: "Mercaderias / stock",
        required: true,
      },
      {
        lineKey: "purchase_vat",
        debitCredit: "debit",
        accountRoleCode: "tax_role_by_rate",
        amountSource: "vat_amount",
        descriptionTemplate: "IVA compras segun tasa del CFE",
        required: false,
      },
      {
        lineKey: "accounts_payable",
        debitCredit: "credit",
        accountRoleCode: "accounts_payable",
        amountSource: "gross_total",
        descriptionTemplate: "Proveedor / cuenta a pagar",
        required: true,
      },
    ],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "sale_local_credit.v1",
    version: "v1",
    label: "Venta plaza credito",
    description: "Venta local con saldo a cobrar a cliente.",
    operationKind: "sale",
    operationFamily: "sale_local",
    paymentTerms: "credit",
    direction: "outgoing",
    zetaJournalTypeNameHints: ["Venta Crédito", "Venta Credito", "Diario Principal"],
    lines: [
      {
        lineKey: "accounts_receivable",
        debitCredit: "debit",
        accountRoleCode: "accounts_receivable",
        amountSource: "gross_total",
        descriptionTemplate: "Cliente / cuenta a cobrar",
        required: true,
      },
      ...saleLocalBaseLines,
    ],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "sale_local_cash_uyu.v1",
    version: "v1",
    label: "Venta plaza contado caja",
    description: "Venta local cobrada en caja pesos.",
    operationKind: "sale",
    operationFamily: "sale_local",
    paymentTerms: "cash",
    direction: "outgoing",
    zetaJournalTypeNameHints: ["Ingreso de Caja", "Diario Principal"],
    lines: [
      {
        lineKey: "cash_uyu",
        debitCredit: "debit",
        accountRoleCode: "cash_uyu",
        amountSource: "gross_total",
        descriptionTemplate: "Caja pesos",
        required: true,
      },
      ...saleLocalBaseLines,
    ],
    createsOpenItem: false,
    settlementAware: true,
  }),
  defineTemplate({
    code: "sale_local_bank_uyu.v1",
    version: "v1",
    label: "Venta plaza contado banco",
    description: "Venta local cobrada en banco pesos.",
    operationKind: "sale",
    operationFamily: "sale_local",
    paymentTerms: "bank",
    direction: "outgoing",
    zetaJournalTypeNameHints: ["Ingreso Banco", "Diario Principal"],
    lines: [
      {
        lineKey: "bank_uyu",
        debitCredit: "debit",
        accountRoleCode: "bank_uyu",
        amountSource: "gross_total",
        descriptionTemplate: "Banco pesos",
        required: true,
      },
      ...saleLocalBaseLines,
    ],
    createsOpenItem: false,
    settlementAware: true,
  }),
  defineTemplate({
    code: "sale_export_credit.v1",
    version: "v1",
    label: "Venta exportacion credito",
    description: "Venta de exportacion con saldo a cobrar, sin inventar IVA si el CFE no lo trae.",
    operationKind: "sale",
    operationFamily: "sale_export",
    paymentTerms: "credit",
    direction: "outgoing",
    zetaJournalTypeNameHints: ["Venta Exportación", "Venta Exportacion", "Diario Principal"],
    lines: [
      {
        lineKey: "accounts_receivable",
        debitCredit: "debit",
        accountRoleCode: "accounts_receivable",
        amountSource: "gross_total",
        descriptionTemplate: "Cliente / cuenta a cobrar",
        required: true,
      },
      {
        lineKey: "sales_export",
        debitCredit: "credit",
        accountRoleCode: "sales_export",
        amountSource: "net_amount",
        descriptionTemplate: "Venta exportacion",
        required: true,
      },
    ],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "supplier_credit_note.v1",
    version: "v1",
    label: "Nota de credito proveedor",
    description: "Invierte la compra original sin matching exhaustivo en este PR.",
    operationKind: "supplier_credit_note",
    operationFamily: "credit_note",
    paymentTerms: "credit",
    direction: "incoming",
    zetaJournalTypeNameHints: ["Nota Crédito Proveedor", "Nota Credito Proveedor", "Diario Principal"],
    lines: [
      {
        lineKey: "accounts_payable",
        debitCredit: "debit",
        accountRoleCode: "accounts_payable",
        amountSource: "gross_total",
        descriptionTemplate: "Disminucion de proveedor",
        required: true,
      },
      {
        lineKey: "purchase_net_reverse",
        debitCredit: "credit",
        accountRoleCode: "document_primary_account",
        amountSource: "net_amount",
        descriptionTemplate: "Reversa gasto / cuenta principal",
        required: true,
      },
      {
        lineKey: "purchase_vat_reverse",
        debitCredit: "credit",
        accountRoleCode: "tax_role_by_rate",
        amountSource: "vat_amount",
        descriptionTemplate: "Reversa IVA compras",
        required: false,
      },
    ],
    requiredRoleCodes: ["accounts_payable", "purchase_expense_default"],
    createsOpenItem: true,
    settlementAware: true,
  }),
  defineTemplate({
    code: "customer_credit_note.v1",
    version: "v1",
    label: "Nota de credito cliente",
    description: "Invierte la venta original sin matching exhaustivo en este PR.",
    operationKind: "customer_credit_note",
    operationFamily: "credit_note",
    paymentTerms: "credit",
    direction: "outgoing",
    zetaJournalTypeNameHints: ["Nota Crédito Cliente", "Nota Credito Cliente", "Diario Principal"],
    lines: [
      {
        lineKey: "sale_net_reverse",
        debitCredit: "debit",
        accountRoleCode: "sales_local",
        amountSource: "net_amount",
        descriptionTemplate: "Reversa venta plaza",
        required: true,
      },
      {
        lineKey: "sale_vat_reverse",
        debitCredit: "debit",
        accountRoleCode: "tax_role_by_rate",
        amountSource: "vat_amount",
        descriptionTemplate: "Reversa IVA ventas",
        required: false,
      },
      {
        lineKey: "accounts_receivable",
        debitCredit: "credit",
        accountRoleCode: "accounts_receivable",
        amountSource: "gross_total",
        descriptionTemplate: "Disminucion de cliente",
        required: true,
      },
    ],
    requiredRoleCodes: ["sales_local", "accounts_receivable"],
    createsOpenItem: true,
    settlementAware: true,
  }),
] as const satisfies readonly PostingTemplateDefinition[];

const templatesByCode = new Map<string, PostingTemplateDefinition>(
  POSTING_TEMPLATE_CATALOG.map((template) => [template.code, template]),
);

export function listPostingTemplates() {
  return [...POSTING_TEMPLATE_CATALOG];
}

export function getPostingTemplateDefinition(code: string | null | undefined) {
  return code ? templatesByCode.get(code) ?? null : null;
}
