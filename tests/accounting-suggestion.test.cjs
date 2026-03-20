/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveAccountingContext,
  resolveAccountingRuleSelection,
} = require("@/modules/accounting/rule-engine");
const {
  buildAccountingDraftArtifacts,
} = require("@/modules/accounting/suggestion-engine");
const {
  buildAccountingImpactPreview,
} = require("@/modules/accounting/accounting-impact-preview");
const {
  buildAccountingLearningSuggestions: buildLearningSuggestions,
} = require("@/modules/accounting/learning-suggestions");

function buildAccount(overrides = {}) {
  return {
    id: "acct-1",
    organization_id: "org-1",
    code: "6101",
    name: "Gastos administrativos",
    account_type: "expense",
    normal_side: "debit",
    is_postable: true,
    metadata: {},
    ...overrides,
  };
}

function buildBaseContext(overrides = {}) {
  const accounts = [
    buildAccount({
      id: "acct-expense",
      code: "6101",
      name: "Gastos administrativos",
    }),
    buildAccount({
      id: "acct-revenue",
      code: "4101",
      name: "Ventas gravadas 22%",
      account_type: "income",
      normal_side: "credit",
    }),
    buildAccount({
      id: "acct-payable",
      code: "2101",
      name: "Proveedores",
      account_type: "liability",
      normal_side: "credit",
      metadata: {
        system_role: "accounts_payable",
      },
    }),
    buildAccount({
      id: "acct-receivable",
      code: "1101",
      name: "Clientes",
      account_type: "asset",
      metadata: {
        system_role: "accounts_receivable",
      },
    }),
    buildAccount({
      id: "acct-vat-input",
      code: "1191",
      name: "IVA compras",
      account_type: "asset",
      metadata: {
        system_role: "vat_input_creditable",
      },
    }),
    buildAccount({
      id: "acct-vat-output",
      code: "2191",
      name: "IVA ventas",
      account_type: "liability",
      normal_side: "credit",
      metadata: {
        system_role: "vat_output_payable",
      },
    }),
    buildAccount({
      id: "acct-cash",
      code: "1110",
      name: "Caja",
      account_type: "asset",
      metadata: {
        system_role: "cash_account",
      },
    }),
    buildAccount({
      id: "acct-bank",
      code: "1120",
      name: "Banco",
      account_type: "asset",
      metadata: {
        system_role: "bank_account",
      },
    }),
    buildAccount({
      id: "acct-card-clearing",
      code: "1130",
      name: "Tarjetas a cobrar",
      account_type: "asset",
      metadata: {
        system_role: "card_clearing_account",
      },
    }),
    buildAccount({
      id: "acct-sale-unknown",
      code: "TEMP-SALE-CLEAR",
      name: "Cobros contado a identificar",
      account_type: "asset",
      is_provisional: true,
      metadata: {
        system_role: "cash_sales_unidentified_account",
      },
    }),
    buildAccount({
      id: "acct-purchase-unknown",
      code: "TEMP-PUR-CLEAR",
      name: "Pagos contado a identificar",
      account_type: "liability",
      normal_side: "credit",
      is_provisional: true,
      metadata: {
        system_role: "cash_purchases_unidentified_account",
      },
    }),
  ];

  return {
    organizationId: "org-1",
    documentId: "doc-1",
    draftId: "draft-1",
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
    lineItems: [
      {
        line_number: 1,
        concept_code: null,
        concept_description: "Servicio de software",
        quantity: null,
        unit_amount: null,
        net_amount: 100,
        tax_rate: 22,
        tax_amount: 22,
        total_amount: 122,
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
    vendorResolution: {
      status: "matched",
      matchStrategy: "tax_id",
      vendorId: "vendor-1",
      vendorName: "Proveedor SA",
      normalizedTaxId: "21433455019",
      normalizedName: "proveedor sa",
      defaultAccountId: null,
      defaultPaymentAccountId: null,
      defaultTaxProfile: null,
      defaultOperationCategory: null,
      candidates: [],
      blockingReasons: [],
    },
    invoiceIdentity: {
      issuerTaxIdNormalized: "21433455019",
      issuerNameNormalized: "proveedor sa",
      documentNumberNormalized: "a1234",
      documentDate: "2026-03-10",
      totalAmount: 122,
      currencyCode: "UYU",
      identityStrategy: "tax_id_number_date",
      invoiceIdentityKey: "21433455019|a1234|2026-03-10",
      duplicateStatus: "clear",
      duplicateOfDocumentId: null,
      duplicateReason: null,
      shouldBlockConfirmation: false,
      blockingReasons: [],
    },
    conceptResolution: {
      lines: [
        {
          lineNumber: 1,
          rawCode: null,
          rawDescription: "Servicio de software",
          normalizedCode: null,
          normalizedDescription: "servicio de software",
          source: "line_item",
          matchedConceptId: "concept-services",
          matchedConceptCode: "services",
          matchedConceptName: "Servicios",
          matchStrategy: "organization_alias_description",
          matchConfidence: 0.98,
          requiresUserContext: false,
          candidateConceptIds: ["concept-services"],
        },
      ],
      fallbackUsed: false,
      primaryConceptLabels: ["Servicios"],
      matchedConceptIds: ["concept-services"],
      blockingReasons: [],
      needsUserContext: false,
      unresolvedLineCount: 0,
    },
    accountingContext: {
      status: "not_required",
      reasonCodes: [],
      userFreeText: null,
      structuredContext: {},
      aiRequestPayload: {},
      aiResponse: {},
      providerCode: null,
      modelCode: null,
      promptHash: null,
      requestLatencyMs: null,
      manualOverrideAccountId: null,
      manualOverrideConceptId: null,
      manualOverrideOperationCategory: null,
      learnedConceptName: null,
      operationKind: "purchase_invoice",
      paymentTerms: "credit",
      settlementMethod: "unknown",
      settlementEvidenceSource: "none",
      settlementAllocations: [],
      shouldBlockConfirmation: false,
      canRunAssistant: false,
      blockingReasons: [],
    },
    assistantSuggestion: {
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
    },
    accounts,
    activeRules: [
      {
        id: "rule-concept",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "purchase",
        account_id: "acct-expense",
        vat_profile_json: {},
        operation_category: "services",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    ...overrides,
  };
}

test("accounting context only blocks when ambiguity exists and no user resolution was provided", () => {
  const seed = buildBaseContext();
  const required = resolveAccountingContext({
    documentId: "doc-1",
    documentRole: "purchase",
    vendorResolution: {
      ...seed.vendorResolution,
      status: "ambiguous",
      matchStrategy: "ambiguous",
      blockingReasons: ["ambiguous vendor"],
      candidates: [
        {
          vendorId: "vendor-1",
          vendorName: "Proveedor SA",
          matchStrategy: "ambiguous",
        },
      ],
    },
    conceptResolution: {
      ...seed.conceptResolution,
      needsUserContext: true,
      unresolvedLineCount: 1,
      blockingReasons: ["needs context"],
    },
    activeRules: [],
    operationCategory: "transport",
    storedContext: null,
  });
  const provided = resolveAccountingContext({
    documentId: "doc-1",
    documentRole: "purchase",
    vendorResolution: seed.vendorResolution,
    conceptResolution: {
      ...seed.conceptResolution,
      needsUserContext: true,
      unresolvedLineCount: 1,
      blockingReasons: ["needs context"],
    },
    activeRules: [],
    operationCategory: "services",
    storedContext: {
      id: "ctx-1",
      organization_id: "org-1",
      document_id: "doc-1",
      draft_id: "draft-1",
      status: "provided",
      reason_codes: ["unmatched_concept"],
      user_free_text: "Es un gasto operativo mensual del area comercial.",
      structured_context_json: {},
      ai_request_payload_json: {},
      ai_response_json: {},
      provider_code: null,
      model_code: null,
      prompt_hash: null,
      request_latency_ms: null,
      created_at: "2026-03-10T00:00:00Z",
      updated_at: "2026-03-10T00:00:00Z",
    },
  });

  assert.equal(required.status, "required");
  assert.equal(required.shouldBlockConfirmation, true);
  assert.equal(provided.status, "provided");
  assert.equal(provided.shouldBlockConfirmation, false);
});

test("accounting context is skipped when a trusted vendor default already covers the document", () => {
  const seed = buildBaseContext();
  const resolved = resolveAccountingContext({
    documentId: "doc-1",
    documentRole: "purchase",
    vendorResolution: {
      ...seed.vendorResolution,
      defaultAccountId: "acct-expense",
    },
    conceptResolution: {
      ...seed.conceptResolution,
      needsUserContext: true,
      unresolvedLineCount: 1,
      matchedConceptIds: [],
      blockingReasons: ["needs context"],
    },
    activeRules: [],
    operationCategory: "services",
    storedContext: null,
  });

  assert.equal(resolved.status, "not_required");
  assert.equal(resolved.reasonCodes.length, 0);
});

test("rule selection follows explicit precedence with vendor concept over concept global and vendor default", () => {
  const selected = resolveAccountingRuleSelection(buildBaseContext({
    activeRules: [
      {
        id: "rule-vendor-default",
        organization_id: "org-1",
        scope: "vendor_default",
        document_id: null,
        vendor_id: "vendor-1",
        concept_id: null,
        document_role: "purchase",
        account_id: "acct-expense",
        vat_profile_json: {},
        operation_category: "services",
        linked_operation_type: null,
        priority: 700,
        source: "manual",
        is_active: true,
        metadata: {},
      },
      {
        id: "rule-concept-global",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "purchase",
        account_id: "acct-expense",
        vat_profile_json: {},
        operation_category: "services",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
      {
        id: "rule-vendor-concept",
        organization_id: "org-1",
        scope: "vendor_concept",
        document_id: null,
        vendor_id: "vendor-1",
        concept_id: "concept-services",
        document_role: "purchase",
        account_id: "acct-expense",
        vat_profile_json: {},
        operation_category: "services",
        linked_operation_type: null,
        priority: 900,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
  }));
  const manual = resolveAccountingRuleSelection(buildBaseContext({
    accountingContext: {
      ...buildBaseContext().accountingContext,
      status: "manual_override",
      manualOverrideAccountId: "acct-expense",
      manualOverrideOperationCategory: "services",
    },
  }));

  assert.equal(selected.scope, "vendor_concept");
  assert.equal(selected.ruleId, "rule-vendor-concept");
  assert.equal(manual.scope, "document_override");
  assert.equal(manual.provenance, "manual_override");
});

test("rule selection gives priority to vendor concept plus operation category over vendor concept", () => {
  const selected = resolveAccountingRuleSelection(buildBaseContext({
    activeRules: [
      {
        id: "rule-vendor-concept",
        organization_id: "org-1",
        scope: "vendor_concept",
        document_id: null,
        vendor_id: "vendor-1",
        concept_id: "concept-services",
        document_role: "purchase",
        account_id: "acct-expense",
        vat_profile_json: {},
        operation_category: "services",
        linked_operation_type: null,
        priority: 900,
        source: "manual",
        is_active: true,
        metadata: {},
      },
      {
        id: "rule-vendor-concept-operation",
        organization_id: "org-1",
        scope: "vendor_concept_operation_category",
        document_id: null,
        vendor_id: "vendor-1",
        concept_id: "concept-services",
        document_role: "purchase",
        account_id: "acct-expense",
        vat_profile_json: {},
        operation_category: "services",
        linked_operation_type: null,
        priority: 950,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
  }));

  assert.equal(selected.scope, "vendor_concept_operation_category");
  assert.equal(selected.ruleId, "rule-vendor-concept-operation");
});

test("purchase artifacts build a balanced journal from organization accounts and rules", () => {
  const derived = buildAccountingDraftArtifacts(buildBaseContext());

  assert.equal(derived.validation.canConfirm, true);
  assert.equal(derived.journalSuggestion.ready, true);
  assert.equal(derived.journalSuggestion.isBalanced, true);
  assert.equal(derived.journalSuggestion.templateCode, "purchase_local_credit");
  assert.equal(derived.journalSuggestion.totalDebit, 122);
  assert.equal(derived.journalSuggestion.totalCredit, 122);
  assert.deepEqual(
    derived.journalSuggestion.lines.map((line) => line.roleCode),
    ["expense_account", "input_vat_account", "accounts_payable_account"],
  );
  assert.deepEqual(
    derived.journalSuggestion.lines.map((line) => line.taxTag),
    ["vat_purchase_base", "vat_input_creditable", null],
  );
});

test("sale cash with card uses card clearing and leaves follow-up settlement pending", () => {
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    documentRole: "sale",
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...buildBaseContext().accountingContext,
      operationKind: "sale_invoice",
      paymentTerms: "cash",
      settlementMethod: "card",
    },
    activeRules: [
      {
        id: "rule-sale",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "sale",
        account_id: "acct-revenue",
        vat_profile_json: {},
        operation_category: "taxed_basic_22",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    facts: {
      ...buildBaseContext().facts,
      receiver_name: "Cliente SA",
      receiver_tax_id: "21677899001",
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
  }));

  assert.equal(derived.journalSuggestion.templateCode, "card_sale_clearing");
  assert.equal(derived.journalSuggestion.ready, true);
  assert.equal(derived.journalSuggestion.settlementStatus, "pending_followup_event");
  assert.equal(derived.validation.canConfirm, true);
  assert.deepEqual(
    derived.journalSuggestion.lines.map((line) => line.roleCode),
    ["card_clearing_account", "revenue_account", "output_vat_account"],
  );
});

test("sale cash unknown falls back to provisional clearing without blocking provisional flow", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    documentRole: "sale",
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...seed.accountingContext,
      operationKind: "sale_invoice",
      paymentTerms: "cash",
      settlementMethod: "unknown",
    },
    activeRules: [
      {
        id: "rule-sale",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "sale",
        account_id: "acct-revenue",
        vat_profile_json: {},
        operation_category: "taxed_basic_22",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    facts: {
      ...seed.facts,
      receiver_name: "Cliente SA",
      receiver_tax_id: "21677899001",
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
  }));

  assert.equal(derived.journalSuggestion.templateCode, "sale_cash_unknown_clearing");
  assert.equal(derived.journalSuggestion.hasProvisionalAccounts, true);
  assert.equal(derived.validation.canPostProvisional, true);
  assert.equal(derived.validation.canConfirmFinal, false);
});

test("sale invoice uses intake settlement hints from the document itself", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    documentRole: "sale",
    documentType: "sale_invoice",
    intakeContext: {
      settlement_hints: {
        payment_terms: "cash",
        settlement_method_explicit: "bank_transfer",
        settlement_method_evidence_text:
          "PAGO: Contado. Datos para Transferencia: BROU CTA CTE USD 001556498-00003. Titular: RONTIL S.A.",
        has_receipt_language: false,
        has_card_voucher_language: false,
        has_bank_transfer_reference: true,
      },
    },
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...seed.accountingContext,
      operationKind: null,
      paymentTerms: "unknown",
      settlementMethod: "unknown",
      settlementEvidenceSource: "none",
    },
    activeRules: [
      {
        id: "rule-sale",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "sale",
        account_id: "acct-revenue",
        vat_profile_json: {},
        operation_category: "taxed_basic_22",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    facts: {
      ...seed.facts,
      issuer_name: "Rontil S.A.",
      issuer_tax_id: "213554700012",
      receiver_name: "Strong Grain SAS",
      receiver_tax_id: "220629730013",
      currency_code: "USD",
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
  }));

  assert.equal(derived.settlementContext.operationKind, "sale_invoice");
  assert.equal(derived.settlementContext.paymentTerms, "cash");
  assert.equal(derived.settlementContext.settlementMethod, "bank_transfer");
  assert.equal(derived.settlementContext.settlementEvidenceSource, "invoice_document");
  assert.equal(derived.journalSuggestion.templateCode, "sale_local_cash");
  assert.equal(derived.validation.canConfirm, true);
});

test("sale invoice without explicit payment evidence defaults to credit instead of blocking", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    documentRole: "sale",
    documentType: "sale_invoice",
    intakeContext: {
      settlement_hints: {
        payment_terms: null,
        settlement_method_explicit: null,
        settlement_method_evidence_text: null,
        has_receipt_language: false,
        has_card_voucher_language: false,
        has_bank_transfer_reference: false,
      },
    },
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...seed.accountingContext,
      operationKind: null,
      paymentTerms: "unknown",
      settlementMethod: "unknown",
      settlementEvidenceSource: "none",
    },
    activeRules: [
      {
        id: "rule-sale",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "sale",
        account_id: "acct-revenue",
        vat_profile_json: {},
        operation_category: "taxed_basic_22",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    facts: {
      ...seed.facts,
      issuer_name: "Rontil S.A.",
      issuer_tax_id: "213554700012",
      receiver_name: "Strong Grain SAS",
      receiver_tax_id: "220629730013",
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
  }));

  assert.equal(derived.settlementContext.operationKind, "sale_invoice");
  assert.equal(derived.settlementContext.paymentTerms, "credit");
  assert.equal(derived.settlementContext.settlementMethod, "unknown");
  assert.equal(derived.journalSuggestion.templateCode, "sale_local_credit");
  assert.equal(derived.validation.canConfirm, true);
});

test("assistant output can unblock a new concept once context was provided", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    conceptResolution: {
      lines: [
        {
          lineNumber: 1,
          rawCode: null,
          rawDescription: "Servicio especializado nuevo",
          normalizedCode: null,
          normalizedDescription: "servicio especializado nuevo",
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
      fallbackUsed: false,
      primaryConceptLabels: ["Servicio especializado nuevo"],
      matchedConceptIds: [],
      blockingReasons: ["Hay lineas/conceptos sin match confiable y requieren contexto contable."],
      needsUserContext: true,
      unresolvedLineCount: 1,
    },
    accountingContext: {
      ...seed.accountingContext,
      status: "provided",
      userFreeText: "Es un gasto de soporte tecnico recurrente para la operacion.",
      canRunAssistant: true,
    },
    assistantSuggestion: {
      status: "completed",
      shouldBlockConfirmation: false,
      confidence: 0.91,
      rationale: "El contexto explica un servicio operativo recurrente.",
      output: {
        suggestedConceptId: null,
        suggestedAccountId: "acct-expense",
        suggestedOperationCategory: "services",
        linkedOperationType: null,
        vatContextHint: null,
        confidence: 0.91,
        rationale: "Servicio operativo recurrente.",
        reviewFlags: [],
        shouldBlockConfirmation: false,
      },
      providerCode: "openai",
      modelCode: "gpt-4o-mini",
      promptHash: "hash",
      latencyMs: 150,
      requestPayload: {},
      responsePayload: {},
      reviewFlags: [],
    },
    activeRules: [],
  }));

  assert.equal(derived.appliedRule.scope, "assistant");
  assert.equal(derived.journalSuggestion.ready, true);
  assert.equal(derived.validation.canConfirm, true);
  assert.equal(
    derived.validation.blockers.includes(
      "Hay lineas/conceptos sin match confiable y requieren contexto contable.",
    ),
    false,
  );
});

test("assistant low confidence keeps the document blocked even if an account was suggested", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    conceptResolution: {
      ...seed.conceptResolution,
      matchedConceptIds: [],
      needsUserContext: true,
      unresolvedLineCount: 1,
      blockingReasons: ["Hay lineas/conceptos sin match confiable y requieren contexto contable."],
    },
    accountingContext: {
      ...seed.accountingContext,
      status: "assistant_completed",
      userFreeText: "Es una compra recurrente pero todavia dudosa.",
      canRunAssistant: true,
    },
    assistantSuggestion: {
      status: "completed",
      shouldBlockConfirmation: false,
      confidence: 0.51,
      rationale: "No hay contexto suficiente para cerrar la clasificacion.",
      output: {
        suggestedConceptId: null,
        suggestedAccountId: "acct-expense",
        suggestedOperationCategory: "services",
        linkedOperationType: null,
        vatContextHint: null,
        confidence: 0.51,
        rationale: "Duda material.",
        reviewFlags: [],
        shouldBlockConfirmation: false,
      },
      providerCode: "openai",
      modelCode: "gpt-4o",
      promptHash: "hash",
      latencyMs: 200,
      requestPayload: {},
      responsePayload: {},
      reviewFlags: [],
    },
    activeRules: [],
  }));

  assert.equal(derived.validation.canConfirm, false);
  assert.match(derived.validation.blockers.join(" "), /baja confianza/i);
});

test("learning suggestions proactively recommend vendor plus concept when both are reusable", () => {
  const seed = buildBaseContext();
  const suggestions = buildLearningSuggestions({
    accountingContext: seed.accountingContext,
    conceptResolution: seed.conceptResolution,
    vendorResolution: seed.vendorResolution,
    operationCategory: "services",
    appliedRule: {
      accountId: "acct-expense",
    },
  });

  assert.equal(suggestions.recommendedScope, "vendor_concept_operation_category");
  assert.equal(suggestions.options[0].scope, "vendor_concept_operation_category");
});

test("journal suggestion blocks when a required VAT system account is missing", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    accounts: seed.accounts.filter((account) => account.id !== "acct-vat-input"),
  }));

  assert.equal(derived.journalSuggestion.ready, false);
  assert.match(derived.validation.blockers.join(" "), /input_vat_account/i);
});

test("accounting impact preview explains when the selected main account is incompatible", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    documentRole: "sale",
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...seed.accountingContext,
      manualOverrideAccountId: "acct-cash",
      operationKind: "sale_invoice",
      paymentTerms: "cash",
      settlementMethod: "cash",
    },
    activeRules: [
      {
        id: "rule-sale",
        organization_id: "org-1",
        scope: "concept_global",
        document_id: null,
        vendor_id: null,
        concept_id: "concept-services",
        document_role: "sale",
        account_id: "acct-revenue",
        vat_profile_json: {},
        operation_category: "taxed_basic_22",
        linked_operation_type: null,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    facts: {
      ...seed.facts,
      issuer_name: "Mi empresa SAS",
      issuer_tax_id: "215556660011",
      receiver_name: "Cliente SA",
      receiver_tax_id: "21677899001",
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
  }));

  const preview = buildAccountingImpactPreview({
    journalSuggestion: derived.journalSuggestion,
    taxTreatment: derived.taxTreatment,
    appliedRule: derived.appliedRule,
    settlementContext: derived.settlementContext,
  });

  assert.equal(preview.summary.mainAccount, null);
  assert.equal(preview.summary.settlementAccount, null);
  assert.match(
    preview.missingItems.join(" "),
    /cuenta principal de ingresos para esta venta/i,
  );
});

test("foreign currency documents block confirmation when fiscal FX from BCU is unresolved", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    facts: {
      ...seed.facts,
      currency_code: "USD",
      document_date: "2026-03-17",
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
    },
    monetarySnapshot: {
      currencyCode: "USD",
      netAmountOriginal: 100,
      taxAmountOriginal: 22,
      totalAmountOriginal: 122,
      netAmountUyu: 100,
      taxAmountUyu: 22,
      totalAmountUyu: 122,
      fx: {
        policyCode: "dgi_previous_business_day_interbank",
        currencyCode: "USD",
        functionalCurrencyCode: "UYU",
        source: "document_default",
        rate: 1,
        bcuValue: null,
        bcuDateUsed: null,
        bcuSeries: null,
        documentValue: null,
        documentDate: "2026-03-17",
        overrideReason: null,
        warnings: [],
        blockingReasons: ["No se pudo resolver el tipo de cambio fiscal BCU."],
      },
    },
  }));

  assert.equal(derived.validation.canPostProvisional, false);
  assert.equal(derived.validation.canConfirmFinal, false);
  assert.match(derived.validation.blockers.join(" "), /tipo de cambio fiscal bcu/i);
});

test("journal suggestion uses the BCU date actually applied instead of the document date", () => {
  const seed = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(buildBaseContext({
    facts: {
      ...seed.facts,
      currency_code: "USD",
      document_date: "2026-03-17",
    },
    monetarySnapshot: {
      currencyCode: "USD",
      netAmountOriginal: 100,
      taxAmountOriginal: 22,
      totalAmountOriginal: 122,
      netAmountUyu: 4410,
      taxAmountUyu: 970.2,
      totalAmountUyu: 5380.2,
      fx: {
        policyCode: "dgi_previous_business_day_interbank",
        currencyCode: "USD",
        functionalCurrencyCode: "UYU",
        source: "bcu",
        rate: 44.1,
        bcuValue: 44.1,
        bcuDateUsed: "2026-03-14",
        bcuSeries: "2224",
        documentValue: null,
        documentDate: "2026-03-17",
        overrideReason: null,
        warnings: [],
        blockingReasons: [],
      },
    },
  }));

  assert.equal(derived.journalSuggestion.fxRate, 44.1);
  assert.equal(derived.journalSuggestion.fxRateDate, "2026-03-14");
  assert.equal(derived.journalSuggestion.fxRateBcuDateUsed, "2026-03-14");
});
