import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAccountingDraftArtifacts,
} from "@/modules/accounting/suggestion-engine";
import {
  loadAccountingRuntimeContext,
  loadDocumentAccountingContext,
  loadPriorApprovalExamples,
} from "@/modules/accounting/repository";
import {
  resolveAccountingAssistantSuggestion,
} from "@/modules/accounting/assistant";
import {
  resolveAccountingContext,
} from "@/modules/accounting/rule-engine";
import {
  resolveDocumentConcepts,
} from "@/modules/accounting/concept-resolution";
import { resolveVendorFromFacts } from "@/modules/accounting/vendor-resolution";
import type {
  AccountingAssistantResult,
  AccountingContextResolution,
  AccountingSuggestionContext,
  DocumentAccountingContextRecord,
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DocumentRoleCandidate,
  OrganizationFiscalProfile,
  OrganizationRuleSnapshotContext,
} from "@/modules/accounting/types";

function materializeStoredAssistantResult(
  accountingContext: AccountingContextResolution,
): AccountingAssistantResult | null {
  const aiResponse = accountingContext.aiResponse;
  const output =
    aiResponse.output && typeof aiResponse.output === "object"
      ? (aiResponse.output as Record<string, unknown>)
      : null;

  if (!output) {
    return null;
  }

  return {
    status: "completed",
    shouldBlockConfirmation:
      typeof output.shouldBlockConfirmation === "boolean"
        ? output.shouldBlockConfirmation
        : false,
    confidence:
      typeof output.confidence === "number"
        ? output.confidence
        : null,
    rationale:
      typeof output.rationale === "string"
        ? output.rationale
        : null,
    output: {
      suggestedConceptId:
        typeof output.suggestedConceptId === "string" ? output.suggestedConceptId : null,
      suggestedAccountId:
        typeof output.suggestedAccountId === "string" ? output.suggestedAccountId : null,
      suggestedOperationCategory:
        typeof output.suggestedOperationCategory === "string"
          ? output.suggestedOperationCategory
          : null,
      linkedOperationType:
        typeof output.linkedOperationType === "string" ? output.linkedOperationType : null,
      vatContextHint:
        typeof output.vatContextHint === "string" ? output.vatContextHint : null,
      confidence:
        typeof output.confidence === "number" ? output.confidence : 0,
      rationale:
        typeof output.rationale === "string" ? output.rationale : "",
      reviewFlags: Array.isArray(output.reviewFlags)
        ? output.reviewFlags.filter((flag): flag is string => typeof flag === "string")
        : [],
      shouldBlockConfirmation:
        typeof output.shouldBlockConfirmation === "boolean"
          ? output.shouldBlockConfirmation
          : false,
    },
    providerCode: accountingContext.providerCode,
    modelCode: accountingContext.modelCode,
    promptHash: accountingContext.promptHash,
    latencyMs: accountingContext.requestLatencyMs,
    requestPayload: accountingContext.aiRequestPayload,
    responsePayload: accountingContext.aiResponse,
    reviewFlags: Array.isArray(output.reviewFlags)
      ? output.reviewFlags.filter((flag): flag is string => typeof flag === "string")
      : [],
  } satisfies AccountingAssistantResult;
}

export async function deriveDocumentAccountingState(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
  draftId: string;
  actorId: string | null;
  documentRole: DocumentRoleCandidate;
  documentType: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  operationCategory: string | null;
  profile: OrganizationFiscalProfile | null;
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
  invoiceIdentity: AccountingSuggestionContext["invoiceIdentity"];
  storedContext?: DocumentAccountingContextRecord | null;
  runAssistant?: boolean;
}) {
  const runtimeContext = await loadAccountingRuntimeContext(
    input.supabase,
    input.organizationId,
    input.documentRole,
  );
  const vendorResolution = resolveVendorFromFacts({
    facts: input.facts,
    vendors: runtimeContext.vendors,
  });
  const conceptResolution = resolveDocumentConcepts({
    lineItems: input.lineItems,
    amountBreakdown: input.amountBreakdown,
    concepts: runtimeContext.concepts,
    aliases: runtimeContext.conceptAliases,
    vendorId: vendorResolution.vendorId,
  });
  const storedContext =
    input.storedContext === undefined
      ? await loadDocumentAccountingContext(input.supabase, input.draftId)
      : input.storedContext;
  const accountingContext = resolveAccountingContext({
    documentRole: input.documentRole,
    vendorResolution,
    conceptResolution,
    operationCategory: input.operationCategory,
    storedContext,
  });
  let assistantSuggestion: AccountingAssistantResult =
    materializeStoredAssistantResult(accountingContext) ?? {
    status: "not_requested",
    shouldBlockConfirmation: false,
    confidence: null,
    rationale: null,
    output: null,
    providerCode: null,
    modelCode: null,
    promptHash: null,
    latencyMs: null,
    requestPayload: {},
    responsePayload: {},
    reviewFlags: [],
  };

  if (!assistantSuggestion.output && accountingContext.canRunAssistant && input.runAssistant) {
    const priorApprovedExamples = await loadPriorApprovalExamples(
      input.supabase,
      input.organizationId,
      input.documentRole,
    );

    assistantSuggestion = await resolveAccountingAssistantSuggestion({
      organizationId: input.organizationId,
      documentId: input.documentId,
      draftId: input.draftId,
      vendor: vendorResolution,
      invoiceIdentity: input.invoiceIdentity,
      extractedFacts: input.facts,
      lineItems: conceptResolution.lines,
      candidateConcepts: runtimeContext.concepts.map((concept) => ({
        id: concept.id,
        code: concept.code,
        canonicalName: concept.canonical_name,
        documentRole: concept.document_role,
        defaultAccountId: concept.default_account_id,
        defaultOperationCategory: concept.default_operation_category,
      })),
      userContextText: accountingContext.userFreeText ?? "",
      allowedAccounts: runtimeContext.accounts,
      allowedConcepts: runtimeContext.concepts,
      priorApprovedExamples,
      fiscalProfileSummary: {
        organizationSummary: input.profile
          ? `${input.profile.countryCode} / ${input.profile.legalEntityType} / ${input.profile.taxRegimeCode}`
          : "Sin perfil fiscal activo",
        ruleSnapshotSummary: input.ruleSnapshot
          ? `v${input.ruleSnapshot.versionNumber} desde ${input.ruleSnapshot.effectiveFrom}`
          : "Sin snapshot activo",
      },
    });
  }

  const derived = buildAccountingDraftArtifacts({
    organizationId: input.organizationId,
    documentId: input.documentId,
    draftId: input.draftId,
    documentRole: input.documentRole,
    documentType: input.documentType,
    facts: input.facts,
    amountBreakdown: input.amountBreakdown,
    lineItems: input.lineItems,
    operationCategory: input.operationCategory,
    profile: input.profile,
    ruleSnapshot: input.ruleSnapshot,
    vendorResolution,
    invoiceIdentity: input.invoiceIdentity,
    conceptResolution,
    accountingContext: assistantSuggestion.output
      ? {
          ...accountingContext,
          status: accountingContext.status === "provided"
            ? "assistant_completed"
            : accountingContext.status,
          aiRequestPayload: assistantSuggestion.requestPayload,
          aiResponse: {
            output: assistantSuggestion.output,
            response: assistantSuggestion.responsePayload,
          },
          providerCode: assistantSuggestion.providerCode,
          modelCode: assistantSuggestion.modelCode,
          promptHash: assistantSuggestion.promptHash,
          requestLatencyMs: assistantSuggestion.latencyMs,
        }
      : accountingContext,
    assistantSuggestion,
    accounts: runtimeContext.accounts,
    activeRules: runtimeContext.activeRules,
  });

  return {
    runtimeContext,
    storedContext,
    vendorResolution,
    conceptResolution,
    accountingContext: derived.accountingContext,
    assistantSuggestion: derived.assistantSuggestion,
    derived,
  };
}
