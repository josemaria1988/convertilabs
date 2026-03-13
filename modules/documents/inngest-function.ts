import { inngest } from "@/lib/inngest/client";
import { processDocumentRunFromInngest } from "@/modules/documents/processing";

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
