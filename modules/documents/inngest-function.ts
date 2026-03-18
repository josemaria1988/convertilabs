import { inngest } from "@/lib/inngest/client";
import { processDocumentRunFromInngest } from "@/modules/documents/processing";
import { processDocumentSpreadsheetImportRunFromInngest } from "@/modules/documents/spreadsheet-import-background";

export const documentsProcessRequested = inngest.createFunction(
  {
    id: "documents-process-requested",
  },
  {
    event: "documents/process.requested",
  },
  async ({ event, step, logger }) => {
    logger.info("Starting document processing run.", {
      documentId: event.data.documentId,
      runId: event.data.runId,
    });

    return processDocumentRunFromInngest({
      runId: event.data.runId,
      step,
      logger,
    });
  },
);

export const documentSpreadsheetImportRequested = inngest.createFunction(
  {
    id: "document-spreadsheet-import-requested",
  },
  {
    event: "documents/spreadsheet-import.requested",
  },
  async ({ event, step, logger }) => {
    logger.info("Starting document spreadsheet import run.", {
      runId: event.data.runId,
      organizationId: event.data.organizationId,
    });

    return processDocumentSpreadsheetImportRunFromInngest({
      runId: event.data.runId,
      organizationId: event.data.organizationId,
      step,
      logger,
    });
  },
);
