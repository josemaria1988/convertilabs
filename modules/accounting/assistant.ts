export type AccountingAssistantStatus = "not_requested";

export type AccountingAssistantResult = {
  status: AccountingAssistantStatus;
  shouldBlockConfirmation: false;
  confidence: null;
  rationale: string | null;
};

export async function resolveAccountingAssistantSuggestion() {
  return {
    status: "not_requested",
    shouldBlockConfirmation: false,
    confidence: null,
    rationale: null,
  } satisfies AccountingAssistantResult;
}
