import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
} from "@/modules/ai/document-intake-contract";

export type ImportOperationStatus =
  | "draft"
  | "processing"
  | "ready_for_review"
  | "approved"
  | "blocked_manual_review";

export type ImportLinkedDocumentType =
  | "dua"
  | "commercial_invoice"
  | "broker_invoice"
  | "freight_invoice"
  | "insurance_invoice"
  | "local_related_service"
  | "unknown";

export type ImportTaxLine = {
  taxCode: string | null;
  taxLabel: string;
  externalTaxCode: string | null;
  amount: number;
  currencyCode: string | null;
  isCreditableVat: boolean;
  isVatAdvance: boolean;
  isOtherTax: boolean;
  sourceDocumentId: string | null;
  warnings: string[];
};

export type ImportDocumentIntakeInput = {
  documentId: string;
  documentType: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  extractedText: string | null;
};

export type ImportDocumentIntakeResult = {
  documentId: string;
  documentKind: ImportLinkedDocumentType;
  duaNumber: string | null;
  duaYear: string | null;
  referenceCode: string | null;
  supplierName: string | null;
  supplierTaxId: string | null;
  operationDate: string | null;
  paymentDate: string | null;
  currencyCode: string | null;
  warnings: string[];
  taxes: ImportTaxLine[];
  looksLikeLocalExpense: boolean;
  rawFacts: DocumentIntakeFactMap;
};

export type ImportOperationAggregateResult = {
  referenceCode: string | null;
  duaNumber: string | null;
  duaYear: string | null;
  supplierName: string | null;
  supplierTaxId: string | null;
  currencyCode: string | null;
  operationDate: string | null;
  paymentDate: string | null;
  status: ImportOperationStatus;
  warnings: string[];
  taxLines: ImportTaxLine[];
  linkedDocuments: Array<{
    documentId: string;
    documentType: ImportLinkedDocumentType;
    isPrimary: boolean;
    looksLikeLocalExpense: boolean;
  }>;
  summary: Record<string, unknown>;
};

export type ImportOperationListItem = {
  id: string;
  referenceCode: string | null;
  duaNumber: string | null;
  duaYear: string | null;
  customsBrokerName: string | null;
  supplierName: string | null;
  supplierTaxId: string | null;
  currencyCode: string | null;
  operationDate: string | null;
  paymentDate: string | null;
  status: ImportOperationStatus;
  warnings: string[];
  taxLines: ImportTaxLine[];
  linkedDocuments: Array<{
    documentId: string;
    documentType: ImportLinkedDocumentType;
    isPrimary: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
};
