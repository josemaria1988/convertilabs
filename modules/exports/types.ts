import type {
  CanonicalAccountingPayload,
  CanonicalTaxPayload,
  DGIFormSummary,
} from "@/modules/exports/canonical";

export type ExportWorkbookSheet = {
  name: string;
  rows: Array<Array<string | number | null>>;
};

export type VatRunExportDataset = {
  organizationId: string;
  organizationName: string;
  vatRunId: string;
  periodLabel: string;
  totals: {
    documentCount: number;
    purchaseTaxableBase: number;
    saleTaxableBase: number;
    outputVat: number;
    inputVatCreditable: number;
    inputVatNonDeductible: number;
    importVat: number;
    importVatAdvance: number;
    netVatPayable: number;
    warningsCount: number;
  };
  purchases: Array<{
    date: string;
    vendor: string;
    vendorTaxId: string | null;
    documentNumber: string | null;
    primaryConcept: string;
    taxableBase: number;
    vat: number;
    total: number;
    deductibilityStatus: string;
    notes: string;
  }>;
  sales: Array<{
    date: string;
    customer: string;
    documentNumber: string | null;
    taxableBase: number;
    vat: number;
    total: number;
    rate: string;
    notes: string;
  }>;
  journalEntries: Array<{
    date: string;
    reference: string;
    account: string;
    accountName: string;
    debit: number;
    credit: number;
    provenance: string;
  }>;
  imports: Array<{
    referenceCode: string;
    duaNumber: string | null;
    supplierName: string | null;
    taxLabel: string;
    amount: number;
    sourceType: string;
    notes: string;
  }>;
  traceability: Array<{
    document: string;
    vendorResolved: string;
    duplicateDetected: string;
    conceptMatchStrategy: string;
    confidence: string;
    reviewer: string;
    approvalDate: string;
    appliedRule: string;
    flags: string;
  }>;
  dgiFormSummary: DGIFormSummary;
  canonicalTaxPayload: CanonicalTaxPayload;
  canonicalAccountingPayload: CanonicalAccountingPayload;
};

export type ExportJobResult = {
  exportId: string;
  status: "generated";
  storagePath: string;
  downloadUrl: string | null;
};
