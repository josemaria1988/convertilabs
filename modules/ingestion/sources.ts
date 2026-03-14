export type DocumentSourceType =
  | "manual_upload"
  | "batch_upload"
  | "email_inbox"
  | "cfe_feed"
  | "spreadsheet_import";

export type DocumentIngestionEnvelope = {
  sourceType: DocumentSourceType;
  messageId?: string | null;
  attachmentHash?: string | null;
  invoiceIdentityKey?: string | null;
  externalReference?: string | null;
};

export interface DocumentIngestionSource {
  sourceType: DocumentSourceType;
  buildEnvelope(): Promise<DocumentIngestionEnvelope>;
}

export interface EmailIngestionSource extends DocumentIngestionSource {
  sourceType: "email_inbox";
  senderEmail: string | null;
  subject: string | null;
}

export interface CFEIngestionSource extends DocumentIngestionSource {
  sourceType: "cfe_feed";
  cfeId: string | null;
  emitterTaxId: string | null;
}

export function buildDocumentIngestionDedupeKeys(
  envelope: DocumentIngestionEnvelope,
) {
  return [
    envelope.messageId ? `message:${envelope.messageId}` : null,
    envelope.attachmentHash ? `attachment:${envelope.attachmentHash}` : null,
    envelope.invoiceIdentityKey ? `invoice:${envelope.invoiceIdentityKey}` : null,
    envelope.externalReference ? `external:${envelope.externalReference}` : null,
  ].filter((value): value is string => Boolean(value));
}
