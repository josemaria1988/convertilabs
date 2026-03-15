import { resolveAccountingRuleSelection } from "@/modules/accounting/rule-engine";
import type { AccountingSuggestionContext } from "@/modules/accounting/types";

export const accountingRulePrecedence = [
  "manual_override",
  "document_override",
  "vendor_concept_operation_category",
  "vendor_concept",
  "concept_global",
  "vendor_default",
  "assistant",
  "manual_review",
] as const;

export function resolveAccountingRuleWithPrecedence(input: AccountingSuggestionContext) {
  return resolveAccountingRuleSelection(input);
}

export function describeAccountingRulePrecedence() {
  return [...accountingRulePrecedence];
}
