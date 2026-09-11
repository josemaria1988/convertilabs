/** Read-only presentation contract. Classification, grouping and amounts belong to the read model. */
export type SupplierInvoiceDueState = "overdue" | "due_soon" | "future" | "no_due_date";

export type SupplierInvoiceItem = {
  id: string;
  number: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  /** due_soon means the next seven days, calculated by the read model in the organization's timezone. */
  dueState: SupplierInvoiceDueState;
  currency: string | null;
  /** Confirmed balance in confirmed groups; document amount awaiting review in unconfirmed groups. */
  amount: string | null;
  reviewHref: string;
  reason?: string | null;
};

export type SupplierInvoiceGroup = {
  /** Canonical party or fiscal-identity grouping key, never the display name alone. */
  id: string;
  name: string;
  taxId: string | null;
  totals: Array<{ currency: string; amount: string }>;
  invoices: SupplierInvoiceItem[];
};

export type SupplierInvoicesBoardProps = {
  confirmed: SupplierInvoiceGroup[];
  unconfirmed: SupplierInvoiceGroup[];
  updatedAt: string | null;
  coverage: { status: "complete" | "partial" | "unavailable"; message?: string };
  error?: string | null;
  excludedPaidCount?: number;
  inboxPendingCount?: number;
  inboxPendingHref?: string;
};

export type SupplierInvoicesBoardData = SupplierInvoicesBoardProps;
