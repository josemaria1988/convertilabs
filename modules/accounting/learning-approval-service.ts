import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createRuleFromApproval } from "@/modules/accounting/repository";
import { deriveDocumentAccountingState } from "@/modules/accounting/runtime";
import type { ApprovalLearningInput } from "@/modules/accounting/types";
import { loadReviewDocumentContext } from "@/modules/documents/review-context";

export async function approveDocumentLearning(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  learning: ApprovalLearningInput;
}) {
  if (input.learning.scope === "none") {
    return {
      ok: false,
      message: "Selecciona un criterio reusable antes de guardarlo.",
      ruleId: null,
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  const context = await loadReviewDocumentContext({
    supabase,
    organizationId: input.organizationId,
    documentId: input.documentId,
    actorId: input.actorId,
  });
  const accountingState = await deriveDocumentAccountingState({
    supabase,
    organizationId: input.organizationId,
    documentId: context.document.id,
    draftId: context.draft.id,
    actorId: input.actorId,
    documentRole: context.draft.document_role,
    documentType: context.draft.document_type,
    facts: context.facts,
    amountBreakdown: context.amountBreakdown,
    lineItems: context.lineItems,
    operationCategory: context.operationCategory,
    profile: context.profile,
    ruleSnapshot: context.ruleSnapshot,
    invoiceIdentity: context.invoiceIdentity,
    runAssistant: false,
  });
  const derived = accountingState.derived;

  if (!derived.appliedRule.accountId) {
    return {
      ok: false,
      message: "Todavia no hay una cuenta aprobable para convertir en regla reusable.",
      ruleId: null,
    };
  }

  const ruleId = await createRuleFromApproval(supabase, {
    organizationId: context.document.organization_id,
    documentId: context.document.id,
    actorId: input.actorId,
    documentRole: context.draft.document_role,
    learning: input.learning,
    vendorId: derived.vendorResolution.vendorId,
    conceptId:
      derived.accountingContext.manualOverrideConceptId
      ?? derived.conceptResolution.matchedConceptIds[0]
      ?? derived.assistantSuggestion.output?.suggestedConceptId
      ?? null,
    conceptName:
      input.learning.learnedConceptName
      ?? derived.accountingContext.learnedConceptName
      ?? derived.conceptResolution.primaryConceptLabels[0]
      ?? null,
    accountId: derived.appliedRule.accountId,
    operationCategory: derived.appliedRule.operationCategory ?? context.operationCategory,
    linkedOperationType: derived.appliedRule.linkedOperationType,
    vatProfileJson: {
      treatment_code: derived.taxTreatment.treatmentCode,
      vat_bucket: derived.taxTreatment.vatBucket,
    },
    taxProfileCode: derived.appliedRule.taxProfileCode,
    templateCode: derived.journalSuggestion.templateCode ?? derived.appliedRule.templateCode,
    status: derived.appliedRule.accountIsProvisional ? "provisional" : "approved",
    conceptLines: derived.conceptResolution.lines,
    rationale:
      derived.assistantSuggestion.rationale
      ?? derived.journalSuggestion.explanation,
  });

  return {
    ok: true,
    message: "Criterio reusable guardado para futuras facturas.",
    ruleId,
  };
}
