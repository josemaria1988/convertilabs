import "server-only";

import { EventSchemas, Inngest } from "inngest";
import { getInngestEnv } from "@/lib/env";

export type DocumentProcessRequestedEventData = {
  documentId: string;
  organizationId: string;
  runId: string;
  requestedBy: string | null;
  triggeredBy: "upload" | "manual_retry" | "reprocess_after_profile_change";
};

export type ConvertilabsEvents = {
  "documents/process.requested": {
    data: DocumentProcessRequestedEventData;
  };
};

const schemas = new EventSchemas().fromRecord<ConvertilabsEvents>();
const inngestEnv = getInngestEnv();

export const inngest = new Inngest({
  id: "convertilabs",
  eventKey: inngestEnv.eventKey || undefined,
  baseUrl: inngestEnv.baseUrl || undefined,
  isDev: inngestEnv.isDev,
  appVersion: inngestEnv.appVersion,
  schemas,
});
