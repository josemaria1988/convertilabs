import "server-only";

import type { ApprovalLearningInput } from "@/modules/accounting";
import { confirmFinalDocumentReview } from "@/modules/documents/review";

export async function confirmDocumentFinal(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  learning?: ApprovalLearningInput;
}) {
  return confirmFinalDocumentReview(input);
}
