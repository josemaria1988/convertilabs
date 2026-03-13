/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveAccountingAssistantSuggestion,
} = require("@/modules/accounting/assistant");
const {
  resolveUyVatTreatment,
} = require("@/modules/tax/uy-vat-engine");
const {
  buildVatRunExcelWorkbook,
} = require("@/modules/exports/excel-workbook");

function buildAssistantInput() {
  return {
    organizationId: "org-1",
    documentId: "doc-1",
    draftId: "draft-1",
    vendor: null,
    invoiceIdentity: null,
    extractedFacts: {
      issuer_name: "Proveedor SA",
      issuer_tax_id: "21433455019",
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "1234",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-03-10",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: "services",
      sale_category_candidate: null,
    },
    lineItems: [
      {
        lineNumber: 1,
        rawCode: null,
        rawDescription: "Servicio operativo",
        normalizedCode: null,
        normalizedDescription: "servicio operativo",
        source: "line_item",
        matchedConceptId: null,
        matchedConceptCode: null,
        matchedConceptName: null,
        matchStrategy: "unmatched",
        matchConfidence: 0,
        requiresUserContext: true,
        candidateConceptIds: [],
      },
    ],
    candidateConcepts: [],
    userContextText: "Es un gasto operativo mensual de soporte.",
    allowedAccounts: [
      {
        id: "acct-allowed",
        organization_id: "org-1",
        code: "6101",
        name: "Gastos operativos",
        account_type: "expense",
        normal_side: "debit",
        is_postable: true,
        metadata: {},
      },
    ],
    allowedConcepts: [
      {
        id: "concept-1",
        organization_id: "org-1",
        code: "services",
        canonical_name: "Servicios",
        description: null,
        document_role: "purchase",
        default_account_id: "acct-allowed",
        default_vat_profile_json: {},
        default_operation_category: "services",
        is_active: true,
        metadata: {},
      },
    ],
    priorApprovedExamples: [],
    fiscalProfileSummary: {
      organizationSummary: "UY / SAS / GENERAL",
      ruleSnapshotSummary: "v1 desde 2026-03-01",
    },
  };
}

function buildVatInput(overrides = {}) {
  return {
    documentRole: "purchase",
    documentType: "invoice",
    facts: {
      issuer_name: "Proveedor SA",
      issuer_tax_id: "21433455019",
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "1234",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-03-10",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: "services",
      sale_category_candidate: null,
    },
    amountBreakdown: [
      {
        label: "Servicios",
        amount: 100,
        tax_rate: 22,
        tax_code: "IVA",
      },
    ],
    operationCategory: "services",
    profile: {
      countryCode: "UY",
      legalEntityType: "SAS",
      taxRegimeCode: "GENERAL",
      vatRegime: "GENERAL",
      dgiGroup: "CEDE",
      cfeStatus: "ELECTRONIC_ISSUER",
      taxId: "21433455019",
    },
    ruleSnapshot: {
      id: "snapshot-1",
      versionNumber: 1,
      effectiveFrom: "2026-03-01",
      promptSummary: "MVP snapshot",
      deterministicRuleRefs: [],
    },
    linkedOperationType: null,
    userContextText: null,
    vatProfile: null,
    ...overrides,
  };
}

test("assistant skips the second AI when there is no user context", async () => {
  const result = await resolveAccountingAssistantSuggestion({
    ...buildAssistantInput(),
    userContextText: "   ",
  });

  assert.equal(result.status, "not_requested");
  assert.equal(result.output, null);
});

test("assistant rejects responses that point to non allowed accounts", async () => {
  const openAiModule = require("@/lib/llm/openai-responses");
  const original = openAiModule.createStructuredOpenAIResponse;
  const previousApiKey = process.env.OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = "test-key";
  openAiModule.createStructuredOpenAIResponse = async () => ({
    responseId: "resp-1",
    output: {
      suggestedConceptId: "concept-1",
      suggestedAccountId: "acct-forbidden",
      suggestedOperationCategory: "services",
      linkedOperationType: null,
      vatContextHint: null,
      confidence: 0.92,
      rationale: "Clasificacion sugerida.",
      reviewFlags: [],
      shouldBlockConfirmation: false,
    },
    rawText: "{}",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    },
    rawResponse: {},
  });

  try {
    const result = await resolveAccountingAssistantSuggestion(buildAssistantInput());
    assert.equal(result.status, "failed");
    assert.match(result.rationale ?? "", /fuera del set permitido/i);
    assert.equal(result.shouldBlockConfirmation, true);
  } finally {
    openAiModule.createStructuredOpenAIResponse = original;

    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
  }
});

test("VAT engine classifies standard deductible purchases and honors non deductible overrides", () => {
  const deductible = resolveUyVatTreatment(buildVatInput());
  const baseVatInput = buildVatInput();
  const nonDeductible = resolveUyVatTreatment(buildVatInput({
    operationCategory: "fuel_and_lubricants",
    facts: {
      ...baseVatInput.facts,
      purchase_category_candidate: "fuel_and_lubricants",
    },
    amountBreakdown: [
      {
        label: "Combustible",
        amount: 100,
        tax_rate: 22,
        tax_code: "IVA",
      },
    ],
    vatProfile: {
      deductible: false,
    },
  }));

  assert.equal(deductible.ready, true);
  assert.equal(deductible.vatBucket, "input_creditable");
  assert.equal(nonDeductible.ready, true);
  assert.equal(nonDeductible.vatBucket, "input_non_deductible");
});

test("VAT engine blocks transport linked to exempt or export operations in MVP", () => {
  const result = resolveUyVatTreatment(buildVatInput({
    operationCategory: "transport",
    linkedOperationType: "export_service",
    userContextText: "Flete vinculado a exportacion",
  }));

  assert.equal(result.ready, false);
  assert.match(result.blockingReasons.join(" "), /exportacion|exentas/i);
});

test("Excel export workbook is generated from canonical approved data without inventing fields", () => {
  const workbook = buildVatRunExcelWorkbook({
    organizationId: "org-1",
    organizationName: "Convertilabs Demo",
    vatRunId: "vat-1",
    periodLabel: "2026-03",
    totals: {
      documentCount: 2,
      purchaseTaxableBase: 100,
      saleTaxableBase: 200,
      outputVat: 44,
      inputVatCreditable: 22,
      inputVatNonDeductible: 0,
      netVatPayable: 22,
      warningsCount: 1,
    },
    purchases: [
      {
        date: "2026-03-10",
        vendor: "Proveedor SA",
        vendorTaxId: "21433455019",
        documentNumber: "A1234",
        primaryConcept: "Servicios",
        taxableBase: 100,
        vat: 22,
        total: 122,
        deductibilityStatus: "creditable",
        notes: "",
      },
    ],
    sales: [
      {
        date: "2026-03-11",
        customer: "Cliente SA",
        documentNumber: "B0001",
        taxableBase: 200,
        vat: 44,
        total: 244,
        rate: "22%",
        notes: "",
      },
    ],
    journalEntries: [
      {
        date: "2026-03-10",
        reference: "A1234",
        account: "6101",
        accountName: "Gastos administrativos",
        debit: 100,
        credit: 0,
        provenance: "accounting_rule:concept_global",
      },
    ],
    traceability: [
      {
        document: "factura-a1234.pdf",
        vendorResolved: "Proveedor SA",
        duplicateDetected: "No",
        conceptMatchStrategy: "organization_alias_description",
        confidence: "0.98",
        reviewer: "reviewer@demo.test",
        approvalDate: "2026-03-10",
        appliedRule: "concept_global",
        flags: "",
      },
    ],
  });

  assert.match(workbook, /Resumen ejecutivo/);
  assert.match(workbook, /Libro compras/);
  assert.match(workbook, /Libro ventas/);
  assert.match(workbook, /Asientos contables/);
  assert.match(workbook, /Trazabilidad y revision/);
  assert.match(workbook, /Convertilabs Demo/);
  assert.match(workbook, /2026-03/);
});
