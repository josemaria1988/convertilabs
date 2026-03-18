/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildAccountingDraftArtifacts,
} = require("@/modules/accounting/suggestion-engine");
const {
  buildOpenItemMutationPlan,
} = require("@/modules/accounting/open-items");
const {
  buildReversalJournalEntry,
  buildTrialBalance,
} = require("@/modules/accounting/kernel");

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

function buildActiveRule(overrides = {}) {
  return {
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
    documentType: "purchase_invoice",
    facts: {
      issuer_name: "Proveedor SA",
      issuer_tax_id: "21433455019",
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "1234",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-03-31",
      due_date: "2026-04-15",
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
      documentDate: "2026-03-31",
      totalAmount: 122,
      currencyCode: "UYU",
      identityStrategy: "tax_id_number_date",
      invoiceIdentityKey: "21433455019|a1234|2026-03-31",
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
      businessPurposeNote: null,
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
    accountRoleBindings: [],
    activeRules: [
      buildActiveRule(),
    ],
    ...overrides,
  };
}

function summarizeJournalLines(lines) {
  return lines.map((line) => ({
    roleCode: line.roleCode,
    linePurpose: line.linePurpose,
    settlementComponent: line.settlementComponent,
    taxComponent: line.taxComponent,
    debit: line.debit,
    credit: line.credit,
    functionalDebit: line.functionalDebit,
    functionalCredit: line.functionalCredit,
    currencyCode: line.currencyCode,
  }));
}

function mapJournalLinesForTrialBalance(lines) {
  return lines.map((line) => ({
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: line.debit,
    credit: line.credit,
    functionalDebit: line.functionalDebit,
    functionalCredit: line.functionalCredit,
  }));
}

test("golden fixture: purchase invoice on credit posts VAT and opens AP", () => {
  const context = buildBaseContext();
  const derived = buildAccountingDraftArtifacts(context);
  const plan = buildOpenItemMutationPlan({
    organizationId: context.organizationId,
    documentId: context.documentId,
    documentRole: context.documentRole,
    documentType: context.documentType,
    openItemKind: derived.settlementContext.openItemKind,
    counterpartyType: "vendor",
    counterpartyId: context.vendorResolution.vendorId,
    journalEntryId: "je-purchase-1",
    issueDate: context.facts.document_date,
    dueDate: context.facts.due_date,
    currencyCode: derived.journalSuggestion.currencyCode,
    functionalCurrencyCode: derived.journalSuggestion.functionalCurrencyCode,
    fxRate: derived.journalSuggestion.fxRate,
    fxRateDate: derived.journalSuggestion.fxRateDate,
    fxRateSource: derived.journalSuggestion.fxRateSource,
    totalAmount: context.facts.total_amount,
    existingOpenItems: [],
  });

  assert.equal(derived.journalSuggestion.templateCode, "purchase_local_credit");
  assert.deepEqual(summarizeJournalLines(derived.journalSuggestion.lines), [
    {
      roleCode: "expense_account",
      linePurpose: "main",
      settlementComponent: null,
      taxComponent: "vat_purchase_base",
      debit: 100,
      credit: 0,
      functionalDebit: 100,
      functionalCredit: 0,
      currencyCode: "UYU",
    },
    {
      roleCode: "input_vat_account",
      linePurpose: "tax",
      settlementComponent: null,
      taxComponent: "vat_input_creditable",
      debit: 22,
      credit: 0,
      functionalDebit: 22,
      functionalCredit: 0,
      currencyCode: "UYU",
    },
    {
      roleCode: "accounts_payable_account",
      linePurpose: "settlement",
      settlementComponent: "open_item",
      taxComponent: null,
      debit: 0,
      credit: 122,
      functionalDebit: 0,
      functionalCredit: 122,
      currencyCode: "UYU",
    },
  ]);
  assert.equal(plan.createOpenItems.length, 1);
  assert.equal(plan.createOpenItems[0].metadata.kind, "payable");
  assert.equal(plan.createOpenItems[0].outstanding_amount, 122);
});

test("golden fixture: sale invoice on credit posts AR and output VAT", () => {
  const context = buildBaseContext({
    documentId: "doc-sale-1",
    draftId: "draft-sale-1",
    documentRole: "sale",
    documentType: "sale_invoice",
    facts: {
      ...buildBaseContext().facts,
      issuer_name: "Convertilabs SAS",
      issuer_tax_id: "210000000019",
      receiver_name: "Cliente SA",
      receiver_tax_id: "21677899001",
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...buildBaseContext().accountingContext,
      operationKind: "sale_invoice",
      paymentTerms: "credit",
      settlementMethod: "unknown",
    },
    activeRules: [
      buildActiveRule({
        id: "rule-sale",
        document_role: "sale",
        account_id: "acct-revenue",
        operation_category: "taxed_basic_22",
      }),
    ],
  });
  const derived = buildAccountingDraftArtifacts(context);
  const plan = buildOpenItemMutationPlan({
    organizationId: context.organizationId,
    documentId: context.documentId,
    documentRole: context.documentRole,
    documentType: context.documentType,
    openItemKind: derived.settlementContext.openItemKind,
    counterpartyType: "customer",
    counterpartyId: "customer-1",
    journalEntryId: "je-sale-1",
    issueDate: context.facts.document_date,
    dueDate: context.facts.due_date,
    currencyCode: derived.journalSuggestion.currencyCode,
    functionalCurrencyCode: derived.journalSuggestion.functionalCurrencyCode,
    fxRate: derived.journalSuggestion.fxRate,
    fxRateDate: derived.journalSuggestion.fxRateDate,
    fxRateSource: derived.journalSuggestion.fxRateSource,
    totalAmount: context.facts.total_amount,
    existingOpenItems: [],
  });

  assert.equal(derived.journalSuggestion.templateCode, "sale_local_credit");
  assert.deepEqual(summarizeJournalLines(derived.journalSuggestion.lines), [
    {
      roleCode: "accounts_receivable_account",
      linePurpose: "settlement",
      settlementComponent: "open_item",
      taxComponent: null,
      debit: 122,
      credit: 0,
      functionalDebit: 122,
      functionalCredit: 0,
      currencyCode: "UYU",
    },
    {
      roleCode: "revenue_account",
      linePurpose: "main",
      settlementComponent: null,
      taxComponent: "vat_sale_base",
      debit: 0,
      credit: 100,
      functionalDebit: 0,
      functionalCredit: 100,
      currencyCode: "UYU",
    },
    {
      roleCode: "output_vat_account",
      linePurpose: "tax",
      settlementComponent: null,
      taxComponent: "vat_output_payable",
      debit: 0,
      credit: 22,
      functionalDebit: 0,
      functionalCredit: 22,
      currencyCode: "UYU",
    },
  ]);
  assert.equal(plan.createOpenItems.length, 1);
  assert.equal(plan.createOpenItems[0].metadata.kind, "receivable");
  assert.equal(plan.createOpenItems[0].outstanding_amount, 122);
});

test("golden fixture: supplier payment in April settles March payable with bank outflow", () => {
  const context = buildBaseContext({
    documentId: "doc-pay-1",
    draftId: "draft-pay-1",
    documentType: "payment_support",
    facts: {
      ...buildBaseContext().facts,
      document_date: "2026-04-10",
      due_date: null,
      subtotal: 40,
      tax_amount: 0,
      total_amount: 40,
    },
    amountBreakdown: [],
    lineItems: [],
    accountingContext: {
      ...buildBaseContext().accountingContext,
      operationKind: "supplier_payment",
      paymentTerms: "cash",
      settlementMethod: "bank_transfer",
      settlementEvidenceSource: "receipt_document",
    },
  });
  const derived = buildAccountingDraftArtifacts(context);
  const plan = buildOpenItemMutationPlan({
    organizationId: context.organizationId,
    documentId: context.documentId,
    documentRole: context.documentRole,
    documentType: "payment_support",
    counterpartyType: "vendor",
    counterpartyId: context.vendorResolution.vendorId,
    journalEntryId: "je-pay-1",
    issueDate: context.facts.document_date,
    dueDate: context.facts.due_date,
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: context.facts.document_date,
    fxRateSource: "same_currency",
    totalAmount: 40,
    existingOpenItems: [
      {
        id: "open-ap-1",
        issue_date: "2026-03-31",
        outstanding_amount: 122,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.equal(derived.journalSuggestion.templateCode, "supplier_payment");
  assert.deepEqual(summarizeJournalLines(derived.journalSuggestion.lines), [
    {
      roleCode: "accounts_payable_account",
      linePurpose: "counterparty",
      settlementComponent: "open_item",
      taxComponent: null,
      debit: 40,
      credit: 0,
      functionalDebit: 40,
      functionalCredit: 0,
      currencyCode: "UYU",
    },
    {
      roleCode: "bank_account",
      linePurpose: "settlement",
      settlementComponent: "bank_transfer",
      taxComponent: null,
      debit: 0,
      credit: 40,
      functionalDebit: 0,
      functionalCredit: 40,
      currencyCode: "UYU",
    },
  ]);
  assert.equal(plan.updateOpenItems[0].outstanding_amount, 82);
  assert.equal(plan.updateOpenItems[0].status, "partially_settled");
  assert.equal(plan.settlementLinks[0].amount, 40);
});

test("golden fixture: customer receipt partially settles receivable with bank inflow", () => {
  const context = buildBaseContext({
    documentId: "doc-receipt-1",
    draftId: "draft-receipt-1",
    documentRole: "sale",
    documentType: "receipt",
    facts: {
      ...buildBaseContext().facts,
      issuer_name: "Convertilabs SAS",
      issuer_tax_id: "210000000019",
      receiver_name: "Cliente SA",
      receiver_tax_id: "21677899001",
      document_date: "2026-04-12",
      due_date: null,
      subtotal: 60,
      tax_amount: 0,
      total_amount: 60,
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
    amountBreakdown: [],
    lineItems: [],
    operationCategory: "taxed_basic_22",
    accountingContext: {
      ...buildBaseContext().accountingContext,
      operationKind: "customer_receipt",
      paymentTerms: "cash",
      settlementMethod: "bank_transfer",
      settlementEvidenceSource: "receipt_document",
    },
    activeRules: [
      buildActiveRule({
        id: "rule-sale",
        document_role: "sale",
        account_id: "acct-revenue",
        operation_category: "taxed_basic_22",
      }),
    ],
  });
  const derived = buildAccountingDraftArtifacts(context);
  const plan = buildOpenItemMutationPlan({
    organizationId: context.organizationId,
    documentId: context.documentId,
    documentRole: context.documentRole,
    documentType: "receipt",
    counterpartyType: "customer",
    counterpartyId: "customer-1",
    journalEntryId: "je-receipt-1",
    issueDate: context.facts.document_date,
    dueDate: context.facts.due_date,
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: context.facts.document_date,
    fxRateSource: "same_currency",
    totalAmount: 60,
    existingOpenItems: [
      {
        id: "open-ar-1",
        issue_date: "2026-03-31",
        outstanding_amount: 122,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.equal(derived.journalSuggestion.templateCode, "customer_collection");
  assert.deepEqual(summarizeJournalLines(derived.journalSuggestion.lines), [
    {
      roleCode: "bank_account",
      linePurpose: "settlement",
      settlementComponent: "bank_transfer",
      taxComponent: null,
      debit: 60,
      credit: 0,
      functionalDebit: 60,
      functionalCredit: 0,
      currencyCode: "UYU",
    },
    {
      roleCode: "accounts_receivable_account",
      linePurpose: "counterparty",
      settlementComponent: "open_item",
      taxComponent: null,
      debit: 0,
      credit: 60,
      functionalDebit: 0,
      functionalCredit: 60,
      currencyCode: "UYU",
    },
  ]);
  assert.equal(plan.updateOpenItems[0].outstanding_amount, 62);
  assert.equal(plan.settlementLinks[0].amount, 60);
});

test("golden fixture: purchase credit note reverses expense, VAT and payable", () => {
  const context = buildBaseContext({
    documentId: "doc-credit-note-1",
    draftId: "draft-credit-note-1",
    documentType: "purchase_credit_note",
    facts: {
      ...buildBaseContext().facts,
      document_date: "2026-04-18",
      subtotal: 50,
      tax_amount: 11,
      total_amount: 61,
    },
    amountBreakdown: [
      {
        label: "Servicios",
        amount: 50,
        tax_rate: 22,
        tax_code: "IVA",
      },
    ],
    lineItems: [
      {
        line_number: 1,
        concept_code: null,
        concept_description: "Nota de credito servicio",
        quantity: null,
        unit_amount: null,
        net_amount: 50,
        tax_rate: 22,
        tax_amount: 11,
        total_amount: 61,
      },
    ],
    accountingContext: {
      ...buildBaseContext().accountingContext,
      operationKind: "purchase_credit_note",
      paymentTerms: "credit",
      settlementMethod: "unknown",
    },
  });
  const derived = buildAccountingDraftArtifacts(context);
  const plan = buildOpenItemMutationPlan({
    organizationId: context.organizationId,
    documentId: context.documentId,
    documentRole: context.documentRole,
    documentType: "purchase_credit_note",
    counterpartyType: "vendor",
    counterpartyId: context.vendorResolution.vendorId,
    journalEntryId: "je-credit-note-1",
    issueDate: context.facts.document_date,
    dueDate: null,
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: context.facts.document_date,
    fxRateSource: "same_currency",
    totalAmount: 61,
    existingOpenItems: [
      {
        id: "open-ap-1",
        issue_date: "2026-03-31",
        outstanding_amount: 122,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.deepEqual(summarizeJournalLines(derived.journalSuggestion.lines), [
    {
      roleCode: "expense_account",
      linePurpose: "main",
      settlementComponent: null,
      taxComponent: "vat_purchase_base",
      debit: 0,
      credit: 50,
      functionalDebit: 0,
      functionalCredit: 50,
      currencyCode: "UYU",
    },
    {
      roleCode: "input_vat_account",
      linePurpose: "tax",
      settlementComponent: null,
      taxComponent: "vat_input_creditable",
      debit: 0,
      credit: 11,
      functionalDebit: 0,
      functionalCredit: 11,
      currencyCode: "UYU",
    },
    {
      roleCode: "accounts_payable_account",
      linePurpose: "settlement",
      settlementComponent: "open_item",
      taxComponent: null,
      debit: 61,
      credit: 0,
      functionalDebit: 61,
      functionalCredit: 0,
      currencyCode: "UYU",
    },
  ]);
  assert.equal(plan.updateOpenItems[0].outstanding_amount, 61);
  assert.equal(plan.settlementLinks[0].amount, 61);
});

test("golden fixture: USD payable and later payment keep original currency and payment FX in settlements", () => {
  const invoiceContext = buildBaseContext({
    documentId: "doc-usd-invoice-1",
    draftId: "draft-usd-invoice-1",
    facts: {
      ...buildBaseContext().facts,
      currency_code: "USD",
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
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
        bcuDateUsed: "2026-03-30",
        bcuSeries: "closing",
        documentValue: null,
        documentDate: "2026-03-31",
        overrideReason: null,
        warnings: [],
        blockingReasons: [],
      },
    },
  });
  const invoiceDerived = buildAccountingDraftArtifacts(invoiceContext);
  const invoicePlan = buildOpenItemMutationPlan({
    organizationId: invoiceContext.organizationId,
    documentId: invoiceContext.documentId,
    documentRole: invoiceContext.documentRole,
    documentType: invoiceContext.documentType,
    openItemKind: invoiceDerived.settlementContext.openItemKind,
    counterpartyType: "vendor",
    counterpartyId: invoiceContext.vendorResolution.vendorId,
    journalEntryId: "je-usd-invoice-1",
    issueDate: invoiceContext.facts.document_date,
    dueDate: invoiceContext.facts.due_date,
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    fxRate: 44.1,
    fxRateDate: "2026-03-30",
    fxRateSource: "bcu",
    totalAmount: 122,
    existingOpenItems: [],
  });
  const paymentContext = buildBaseContext({
    documentId: "doc-usd-pay-1",
    draftId: "draft-usd-pay-1",
    documentType: "payment_support",
    facts: {
      ...buildBaseContext().facts,
      currency_code: "USD",
      document_date: "2026-04-20",
      due_date: null,
      subtotal: 60,
      tax_amount: 0,
      total_amount: 60,
    },
    amountBreakdown: [],
    lineItems: [],
    monetarySnapshot: {
      currencyCode: "USD",
      netAmountOriginal: 60,
      taxAmountOriginal: 0,
      totalAmountOriginal: 60,
      netAmountUyu: 2688,
      taxAmountUyu: 0,
      totalAmountUyu: 2688,
      fx: {
        policyCode: "dgi_previous_business_day_interbank",
        currencyCode: "USD",
        functionalCurrencyCode: "UYU",
        source: "bcu",
        rate: 44.8,
        bcuValue: 44.8,
        bcuDateUsed: "2026-04-19",
        bcuSeries: "closing",
        documentValue: null,
        documentDate: "2026-04-20",
        overrideReason: null,
        warnings: [],
        blockingReasons: [],
      },
    },
    accountingContext: {
      ...buildBaseContext().accountingContext,
      operationKind: "supplier_payment",
      paymentTerms: "cash",
      settlementMethod: "bank_transfer",
      settlementEvidenceSource: "receipt_document",
    },
  });
  const paymentDerived = buildAccountingDraftArtifacts(paymentContext);
  const paymentPlan = buildOpenItemMutationPlan({
    organizationId: paymentContext.organizationId,
    documentId: paymentContext.documentId,
    documentRole: paymentContext.documentRole,
    documentType: "payment_support",
    counterpartyType: "vendor",
    counterpartyId: paymentContext.vendorResolution.vendorId,
    journalEntryId: "je-usd-pay-1",
    issueDate: paymentContext.facts.document_date,
    dueDate: paymentContext.facts.due_date,
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    fxRate: 44.8,
    fxRateDate: "2026-04-19",
    fxRateSource: "bcu",
    totalAmount: 60,
    existingOpenItems: [
      {
        id: "open-usd-1",
        issue_date: "2026-03-31",
        outstanding_amount: 122,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.equal(invoiceDerived.journalSuggestion.functionalTotalDebit, 5380.2);
  assert.equal(invoicePlan.createOpenItems[0].currency_code, "USD");
  assert.equal(invoicePlan.createOpenItems[0].functional_amount, 5380.2);
  assert.equal(paymentDerived.journalSuggestion.functionalTotalCredit, 2688);
  assert.equal(paymentPlan.updateOpenItems[0].outstanding_amount, 62);
  assert.equal(paymentPlan.settlementLinks[0].fx_rate, 44.8);
  assert.equal(paymentPlan.settlementLinks[0].functional_amount, 2688);
});

test("golden fixture: reversal plus later adjustment leaves net balance equal to the corrected entry", () => {
  const originalContext = buildBaseContext();
  const originalDerived = buildAccountingDraftArtifacts(originalContext);
  const correctionContext = buildBaseContext({
    facts: {
      ...buildBaseContext().facts,
      subtotal: 150,
      tax_amount: 33,
      total_amount: 183,
    },
    amountBreakdown: [
      {
        label: "Servicios",
        amount: 150,
        tax_rate: 22,
        tax_code: "IVA",
      },
    ],
    lineItems: [
      {
        line_number: 1,
        concept_code: null,
        concept_description: "Servicio de software corregido",
        quantity: null,
        unit_amount: null,
        net_amount: 150,
        tax_rate: 22,
        tax_amount: 33,
        total_amount: 183,
      },
    ],
  });
  const correctionDerived = buildAccountingDraftArtifacts(correctionContext);
  const reversal = buildReversalJournalEntry({
    header: {
      organization_id: "org-1",
      source_document_id: "doc-1",
      source_channel: "documents",
      source_system: "convertilabs",
      posting_mode: "final",
      currency_code: "UYU",
      fx_rate: 1,
      fx_rate_date: "2026-04-05",
      fx_rate_source: "same_currency",
      functional_currency_code: "UYU",
      functional_currency: "UYU",
      reference: "A-1234",
      description: "Compra marzo",
    },
    lines: originalDerived.journalSuggestion.lines.map((line) => ({
      line_no: line.lineNumber,
      account_id: line.accountId,
      debit: line.debit,
      credit: line.credit,
      currency_code: line.currencyCode,
      original_currency_code: line.currencyCode,
      debit_original: line.debit,
      credit_original: line.credit,
      fx_rate: line.fxRate,
      fx_rate_applied: line.fxRate,
      functional_debit: line.functionalDebit,
      functional_credit: line.functionalCredit,
      functional_currency_code: originalDerived.journalSuggestion.functionalCurrencyCode,
      description: line.accountName,
      role_code: line.roleCode,
      line_purpose: line.linePurpose,
      tax_component: line.taxComponent,
      settlement_component: line.settlementComponent,
      metadata: {},
    })),
    originalJournalEntryId: "je-original-1",
    actorId: "user-1",
  });
  const netRows = buildTrialBalance([
    ...mapJournalLinesForTrialBalance(originalDerived.journalSuggestion.lines),
    ...reversal.lines.map((line) => ({
      accountId: line.account_id,
      accountCode: line.account_id,
      accountName: line.description,
      debit: line.debit,
      credit: line.credit,
      functionalDebit: line.functional_debit,
      functionalCredit: line.functional_credit,
    })),
    ...mapJournalLinesForTrialBalance(correctionDerived.journalSuggestion.lines),
  ]);

  assert.equal(reversal.header.reverses_journal_entry_id, "je-original-1");
  assert.match(reversal.header.reference, /^REV-/);
  assert.deepEqual(
    netRows.map((row) => [row.balance, row.functionalBalance]),
    buildTrialBalance(mapJournalLinesForTrialBalance(correctionDerived.journalSuggestion.lines))
      .map((row) => [row.balance, row.functionalBalance]),
  );
});
