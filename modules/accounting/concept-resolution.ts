import type {
  AccountingDraftFields,
  ConceptResolutionLine,
  ConceptResolutionResult,
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  JsonRecord,
} from "@/modules/accounting/types";
import {
  asNumber,
  asRecord,
  asString,
  normalizeDocumentNumber,
  normalizeTextToken,
} from "@/modules/accounting/normalization";

export function parseDraftFacts(fieldsJson: JsonRecord | null): DocumentIntakeFactMap {
  const fields = asRecord(fieldsJson);
  const facts = asRecord(fields.facts);

  return {
    issuer_name: asString(facts.issuer_name),
    issuer_tax_id: asString(facts.issuer_tax_id),
    receiver_name: asString(facts.receiver_name),
    receiver_tax_id: asString(facts.receiver_tax_id),
    document_number: asString(facts.document_number),
    series: asString(facts.series),
    currency_code: asString(facts.currency_code),
    document_date: asString(facts.document_date),
    due_date: asString(facts.due_date),
    subtotal: asNumber(facts.subtotal),
    tax_amount: asNumber(facts.tax_amount),
    total_amount: asNumber(facts.total_amount),
    purchase_category_candidate: asString(facts.purchase_category_candidate),
    sale_category_candidate: asString(facts.sale_category_candidate),
  };
}

export function parseAmountBreakdown(fieldsJson: JsonRecord | null) {
  const fields = asRecord(fieldsJson);
  const entries = Array.isArray(fields.amount_breakdown) ? fields.amount_breakdown : [];

  return entries.map((entry) => {
    const record = asRecord(entry);

    return {
      label: asString(record.label) ?? "Concepto",
      amount: asNumber(record.amount),
      tax_rate: asNumber(record.tax_rate),
      tax_code: asString(record.tax_code),
    } satisfies DocumentIntakeAmountBreakdown;
  });
}

export function parseLineItems(fieldsJson: JsonRecord | null) {
  const fields = asRecord(fieldsJson);
  const entries = Array.isArray(fields.line_items) ? fields.line_items : [];

  return entries.map((entry, index) => {
    const record = asRecord(entry);

    return {
      line_number: asNumber(record.line_number) ?? index + 1,
      concept_code: asString(record.concept_code),
      concept_description: asString(record.concept_description),
      quantity: asNumber(record.quantity),
      unit_amount: asNumber(record.unit_amount),
      net_amount: asNumber(record.net_amount),
      tax_rate: asNumber(record.tax_rate),
      tax_amount: asNumber(record.tax_amount),
      total_amount: asNumber(record.total_amount),
    } satisfies DocumentIntakeLineItem;
  });
}

export function getOperationCategoryValue(
  draft: {
    document_role: "purchase" | "sale" | "other";
    operation_context_json: JsonRecord | null;
  },
  facts: DocumentIntakeFactMap,
) {
  const operationContext = asRecord(draft.operation_context_json);
  const explicitCategory = asString(operationContext.operation_category_candidate);

  if (explicitCategory) {
    return explicitCategory;
  }

  if (draft.document_role === "purchase") {
    return facts.purchase_category_candidate;
  }

  if (draft.document_role === "sale") {
    return facts.sale_category_candidate;
  }

  return null;
}

function buildFallbackConceptLines(amountBreakdown: DocumentIntakeAmountBreakdown[]) {
  return amountBreakdown.map((entry, index) => ({
    lineNumber: index + 1,
    rawCode: null,
    rawDescription: entry.label,
    normalizedCode: null,
    normalizedDescription: normalizeTextToken(entry.label),
    source: "amount_breakdown",
  } satisfies ConceptResolutionLine));
}

export function resolveDocumentConcepts(input: {
  lineItems: DocumentIntakeLineItem[];
  amountBreakdown: DocumentIntakeAmountBreakdown[];
}) {
  const normalizedLineItems = input.lineItems
    .filter((line) => line.concept_description || line.concept_code || line.net_amount !== null)
    .map((line, index) => ({
      lineNumber: line.line_number ?? index + 1,
      rawCode: line.concept_code,
      rawDescription: line.concept_description,
      normalizedCode: normalizeDocumentNumber(line.concept_code),
      normalizedDescription: normalizeTextToken(line.concept_description),
      source: "line_item",
    } satisfies ConceptResolutionLine));
  const lines =
    normalizedLineItems.length > 0
      ? normalizedLineItems
      : buildFallbackConceptLines(input.amountBreakdown);
  const labels = lines
    .map((line) => line.rawDescription ?? line.rawCode)
    .filter((value): value is string => Boolean(value));

  return {
    lines,
    fallbackUsed: normalizedLineItems.length === 0,
    primaryConceptLabels: labels.slice(0, 5),
  } satisfies ConceptResolutionResult;
}

export function buildDraftFieldsPayload(input: AccountingDraftFields) {
  return {
    facts: input.facts,
    amount_breakdown: input.amountBreakdown,
    line_items: input.lineItems,
  };
}
