import type {
  AccountingDraftFields,
  ConceptMatchStrategy,
  ConceptResolutionLine,
  ConceptResolutionResult,
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  JsonRecord,
  OrganizationConceptAliasRecord,
  OrganizationConceptRecord,
} from "@/modules/accounting/types";
import {
  asNumber,
  asRecord,
  asString,
  computeTokenOverlapScore,
  normalizeConceptCode,
  normalizeConceptDescription,
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
    normalizedDescription: normalizeConceptDescription(entry.label),
    source: "amount_breakdown",
    matchedConceptId: null,
    matchedConceptCode: null,
    matchedConceptName: null,
    matchStrategy: "fallback_amount_breakdown",
    matchConfidence: 0,
    requiresUserContext: true,
    candidateConceptIds: [],
  } satisfies ConceptResolutionLine));
}

function buildAliasMap(aliases: OrganizationConceptAliasRecord[]) {
  return aliases.reduce(
    (map, alias) => {
      const vendorKey = alias.vendor_id ?? "organization";
      const scoped = map.get(vendorKey) ?? [];
      scoped.push(alias);
      map.set(vendorKey, scoped);
      return map;
    },
    new Map<string, OrganizationConceptAliasRecord[]>(),
  );
}

function matchByAlias(input: {
  lineCode: string | null;
  lineDescription: string | null;
  aliases: OrganizationConceptAliasRecord[];
  conceptsById: Map<string, OrganizationConceptRecord>;
  strategyPrefix: "vendor" | "organization";
}) {
  if (input.lineCode) {
    const codeMatch = input.aliases.find(
      (alias) => alias.alias_code_normalized && alias.alias_code_normalized === input.lineCode,
    );

    if (codeMatch) {
      const concept = input.conceptsById.get(codeMatch.concept_id);

      if (concept) {
        return {
          concept,
          strategy: `${input.strategyPrefix}_alias_code` as ConceptMatchStrategy,
          confidence: 1,
        };
      }
    }
  }

  if (input.lineDescription) {
    const descriptionMatch = input.aliases.find(
      (alias) => alias.alias_description_normalized === input.lineDescription,
    );

    if (descriptionMatch) {
      const concept = input.conceptsById.get(descriptionMatch.concept_id);

      if (concept) {
        return {
          concept,
          strategy: `${input.strategyPrefix}_alias_description` as ConceptMatchStrategy,
          confidence: 0.98,
        };
      }
    }
  }

  return null;
}

function matchBySemanticSimilarity(input: {
  lineDescription: string | null;
  concepts: OrganizationConceptRecord[];
}) {
  let bestMatch: OrganizationConceptRecord | null = null;
  let bestScore = 0;

  for (const concept of input.concepts) {
    const score = Math.max(
      computeTokenOverlapScore(input.lineDescription, concept.canonical_name),
      computeTokenOverlapScore(input.lineDescription, concept.description),
    );

    if (score > bestScore) {
      bestScore = score;
      bestMatch = concept;
    }
  }

  if (!bestMatch || bestScore < 0.72) {
    return null;
  }

  return {
    concept: bestMatch,
    strategy: "semantic_similarity" as const,
    confidence: bestScore,
  };
}

export function resolveDocumentConcepts(input: {
  lineItems: DocumentIntakeLineItem[];
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  concepts?: OrganizationConceptRecord[];
  aliases?: OrganizationConceptAliasRecord[];
  vendorId?: string | null;
}) {
  const activeConcepts = (input.concepts ?? []).filter((concept) => concept.is_active);
  const conceptsById = new Map(activeConcepts.map((concept) => [concept.id, concept]));
  const aliasMap = buildAliasMap(input.aliases ?? []);
  const vendorAliases = input.vendorId ? aliasMap.get(input.vendorId) ?? [] : [];
  const organizationAliases = aliasMap.get("organization") ?? [];
  const normalizedLineItems = input.lineItems
    .filter((line) => line.concept_description || line.concept_code || line.net_amount !== null)
    .map((line, index) => {
      const normalizedCode = normalizeConceptCode(line.concept_code);
      const normalizedDescription = normalizeConceptDescription(line.concept_description);
      const vendorAliasMatch = matchByAlias({
        lineCode: normalizedCode,
        lineDescription: normalizedDescription,
        aliases: vendorAliases,
        conceptsById,
        strategyPrefix: "vendor",
      });
      const organizationAliasMatch = vendorAliasMatch
        ? null
        : matchByAlias({
            lineCode: normalizedCode,
            lineDescription: normalizedDescription,
            aliases: organizationAliases,
            conceptsById,
            strategyPrefix: "organization",
          });
      const semanticMatch =
        vendorAliasMatch || organizationAliasMatch
          ? null
          : matchBySemanticSimilarity({
              lineDescription: normalizedDescription,
              concepts: activeConcepts,
            });
      const resolvedMatch = vendorAliasMatch ?? organizationAliasMatch ?? semanticMatch;

      return {
        lineNumber: line.line_number ?? index + 1,
        rawCode: line.concept_code,
        rawDescription: line.concept_description,
        normalizedCode,
        normalizedDescription,
        source: "line_item",
        matchedConceptId: resolvedMatch?.concept.id ?? null,
        matchedConceptCode: resolvedMatch?.concept.code ?? null,
        matchedConceptName: resolvedMatch?.concept.canonical_name ?? null,
        matchStrategy: resolvedMatch?.strategy ?? "unmatched",
        matchConfidence: resolvedMatch?.confidence ?? 0,
        requiresUserContext: !resolvedMatch || resolvedMatch.confidence < 0.8,
        candidateConceptIds: resolvedMatch ? [resolvedMatch.concept.id] : [],
      } satisfies ConceptResolutionLine;
    });
  const lines =
    normalizedLineItems.length > 0
      ? normalizedLineItems
      : buildFallbackConceptLines(input.amountBreakdown);
  const labels = lines
    .map((line) => line.matchedConceptName ?? line.rawDescription ?? line.rawCode)
    .filter((value): value is string => Boolean(value));
  const matchedConceptIds = lines
    .map((line) => line.matchedConceptId)
    .filter((value): value is string => Boolean(value));
  const unresolvedLineCount = lines.filter((line) => line.requiresUserContext).length;
  const blockingReasons =
    unresolvedLineCount > 0
      ? ["Hay lineas/conceptos sin match confiable y requieren contexto contable."]
      : [];

  return {
    lines,
    fallbackUsed: normalizedLineItems.length === 0,
    primaryConceptLabels: labels.slice(0, 5),
    matchedConceptIds,
    blockingReasons,
    needsUserContext: unresolvedLineCount > 0,
    unresolvedLineCount,
  } satisfies ConceptResolutionResult;
}

export function buildDraftFieldsPayload(input: AccountingDraftFields) {
  return {
    facts: input.facts,
    amount_breakdown: input.amountBreakdown,
    line_items: input.lineItems,
  };
}

export function buildPersistableConceptLines(input: {
  lineItems: DocumentIntakeLineItem[];
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  conceptLines: ConceptResolutionLine[];
}) {
  return input.conceptLines.map((line) => {
    const lineItem = input.lineItems.find((candidate) =>
      (candidate.line_number ?? null) === line.lineNumber);
    const fallbackAmount = input.amountBreakdown[line.lineNumber - 1] ?? null;

    return {
      lineNumber: line.lineNumber,
      rawConceptCode: line.rawCode,
      rawConceptDescription: line.rawDescription,
      normalizedConceptCode: line.normalizedCode,
      normalizedConceptDescription: line.normalizedDescription,
      netAmount: lineItem?.net_amount ?? fallbackAmount?.amount ?? null,
      taxRate: lineItem?.tax_rate ?? fallbackAmount?.tax_rate ?? null,
      taxAmount: lineItem?.tax_amount ?? null,
      totalAmount: lineItem?.total_amount ?? fallbackAmount?.amount ?? null,
      matchedConceptId: line.matchedConceptId,
      matchStrategy: line.matchStrategy,
      matchConfidence: line.matchConfidence,
      requiresUserContext: line.requiresUserContext,
      metadata: {
        source: line.source,
        candidate_concept_ids: line.candidateConceptIds,
        matched_concept_name: line.matchedConceptName,
      },
    };
  });
}
