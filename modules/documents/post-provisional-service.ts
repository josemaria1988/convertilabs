import "server-only";

import { postProvisionalDocumentReview } from "@/modules/documents/review";

export async function postDocumentProvisional(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
}) {
  return postProvisionalDocumentReview(input);
}
