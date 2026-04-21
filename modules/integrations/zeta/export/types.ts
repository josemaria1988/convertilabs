import type { PaymentTerms, PostingTemplateCode, SettlementMethod } from "@/modules/accounting";
import type { ZetaFacturaProveedorMovimiento } from "@/modules/integrations/zeta/contracts/factura-proveedor";

export type ZetaPurchaseKind = "expense" | "merchandise" | "unknown";

export type ZetaPurchaseExportStatus =
  | "not_ready"
  | "dry_run_ready"
  | "blocked"
  | "sent"
  | "success_pending_reconciliation"
  | "found_in_zeta"
  | "already_exists_in_zeta"
  | "amount_mismatch"
  | "timeout_unknown"
  | "zeta_error";

export type ZetaPurchaseExportMode = "automatic" | "assisted" | "blocked";

export type ZetaPurchaseExportBlocker = {
  code: string;
  message: string;
  field?: string;
};

export type ZetaPurchaseExportWarning = {
  code: string;
  message: string;
};

export type ZetaCatalogRow = Record<string, unknown>;

export type ZetaOperationalMappingsConfig = {
  documentTypes?: Partial<Record<
    "purchase_expense_credit" | "purchase_expense_cash" | "supplier_credit_note_expense",
    string | number
  >>;
  concepts?: {
    default?: string;
    bySupplierCode?: Record<string, string>;
    byDetectedConcept?: Record<string, string>;
  };
  vatRates?: Record<string, string | number>;
  paymentTerms?: Partial<Record<PaymentTerms | "paid_by_partner", string | number>>;
  paymentMethods?: Partial<Record<Exclude<SettlementMethod, "mixed" | "unknown">, string | number>>;
  currencies?: Record<string, string | number>;
  defaults?: {
    currencyCode?: string | number;
    localCode?: number;
    userCode?: number;
    cashboxCode?: number;
    paymentTermCode?: string | number;
  };
  paidByPartnerPaymentMethodCode?: string | number;
};

export type ZetaPurchaseExpenseCatalogs = {
  suppliers: ZetaCatalogRow[];
  supplierCommercialData?: ZetaCatalogRow[];
  documentTypes: ZetaCatalogRow[];
  concepts: ZetaCatalogRow[];
  vatRates: ZetaCatalogRow[];
  paymentTerms: ZetaCatalogRow[];
  paymentMethods: ZetaCatalogRow[];
  currencies: ZetaCatalogRow[];
  businessLocations?: ZetaCatalogRow[];
  users?: ZetaCatalogRow[];
  cashboxes?: ZetaCatalogRow[];
  config?: ZetaOperationalMappingsConfig;
};

export type ZetaPurchaseExpenseDocumentLineInput = {
  lineNumber?: number | null;
  conceptCode?: string | null;
  conceptDescription?: string | null;
  netAmount?: number | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
};

export type ZetaPurchaseExpenseDocumentInput = {
  organizationId: string;
  documentId: string;
  documentRole: "purchase" | "sale" | "other";
  documentType: string | null;
  postingTemplateCode?: PostingTemplateCode | string | null;
  operationCategory?: string | null;
  paymentTerms?: PaymentTerms | null;
  settlementMethod?: SettlementMethod | null;
  supplierRut: string | null;
  supplierName: string | null;
  series: string | null;
  number: string | number | null;
  fiscalIdentityTrusted?: boolean;
  issueDate: string | null;
  currencyCode: string | null;
  exchangeRate?: number | null;
  netAmount?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  sourceReference?: string | null;
  cfeTypeCode?: string | number | null;
  lines: ZetaPurchaseExpenseDocumentLineInput[];
};

export type ZetaPurchaseInvoiceExportPreviewLine = {
  conceptCode: string | null;
  conceptName: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  ivaCode: number | null;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
};

export type ZetaPurchaseInvoiceExportPreview = {
  supplierName: string | null;
  supplierRut: string | null;
  zetaSupplierCode: string | null;
  comprobanteCode: number | null;
  comprobanteName: string | null;
  fecha: string | null;
  serie: string | null;
  numero: number | null;
  monedaCode: number | null;
  cotizacion: number | null;
  conditionCode: string | number | null;
  paymentMethodCode: number | null;
  purchaseKind: ZetaPurchaseKind;
  lines: ZetaPurchaseInvoiceExportPreviewLine[];
  paidByPartnerMessage?: string | null;
};

export type ZetaPurchaseInvoiceExportResolution = {
  documentId: string;
  exportable: boolean;
  mode: ZetaPurchaseExportMode;
  status: ZetaPurchaseExportStatus;
  blockers: ZetaPurchaseExportBlocker[];
  warnings: ZetaPurchaseExportWarning[];
  payload: {
    Data: {
      Movimiento: ZetaFacturaProveedorMovimiento[];
    };
  } | null;
  preview: ZetaPurchaseInvoiceExportPreview;
  fiscalFingerprint: string | null;
};

export type ZetaPurchaseInvoiceExportResult = ZetaPurchaseInvoiceExportResolution & {
  dryRun: boolean;
  zetaResponse?: unknown;
  duplicate?: {
    found: boolean;
    registroId: string | number | null;
    raw: unknown;
  } | null;
  attemptRawRecordId?: string | null;
};

