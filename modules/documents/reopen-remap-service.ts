import "server-only";

import { reopenDocumentReview } from "@/modules/documents/review";

export async function reopenDocumentForRemap(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
}) {
  return reopenDocumentReview(input);
}
