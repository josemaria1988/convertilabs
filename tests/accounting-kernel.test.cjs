/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildEconomicEventHash,
  buildReversalJournalEntry,
  buildJournalEntrySourceHash,
  buildSourceEventFactsPayload,
  buildSourceEventPayload,
  buildTrialBalance,
} = require("@/modules/accounting/kernel");
const {
  resolveAccountRole,
} = require("@/modules/accounting/account-role-resolver");

function buildArtifactsInput(overrides = {}) {
  return {
    organizationId: "org-1",
    documentId: "doc-1",
    draftId: "draft-1",
    revisionNumber: 1,
    documentDate: "2026-03-17",
    documentType: "purchase_invoice",
    documentRole: "purchase",
    originalFilename: "invoice-001.pdf",
    fileHash: "bin-hash-001",
    currencyCode: "USD",
    reference: "A-001-123",
    confidence: 0.98,
    actorId: "user-1",
    facts: {
      issuer_name: "Proveedor SA",
      issuer_tax_id: "21433455019",
      receiver_name: "Convertilabs",
      receiver_tax_id: "210000000019",
      document_number: "123",
      series: "A-001",
      currency_code: "USD",
      document_date: "2026-03-17",
      due_date: "2026-03-30",
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
    amountBreakdown: [],
    lineItems: [],
    ruleSnapshotId: "rule-snap-1",
    derived: {
      monetarySnapshot: null,
      taxTreatment: {
        deterministicRuleRefs: [],
        treatmentCode: "vat_standard",
        vatBucket: "standard",
      },
      journalSuggestion: {
        ready: true,
        isBalanced: true,
        postingMode: "final",
        hasProvisionalAccounts: false,
        totalDebit: 122,
        totalCredit: 122,
        functionalTotalDebit: 5002,
        functionalTotalCredit: 5002,
        currencyCode: "USD",
        functionalCurrencyCode: "UYU",
        fxRate: 41,
        fxRateDate: "2026-03-16",
        fxRateSource: "bcu",
        fxRateBcuValue: 41,
        fxRateBcuDateUsed: "2026-03-16",
        fxRateBcuSeries: "closing",
        templateCode: "purchase_local_credit",
        taxProfileCode: "standard",
        operationKind: "purchase_invoice",
        paymentTerms: "credit",
        settlementMethod: "bank_transfer",
        settlementStatus: "open_payable",
        requiresFollowupSettlement: true,
        explanation: "Compra local con credito fiscal.",
        lines: [
          {
            lineNumber: 1,
            accountId: "acct-expense",
            accountCode: "5.1.01",
            accountName: "Compras",
            debit: 100,
            credit: 0,
            functionalDebit: 4100,
            functionalCredit: 0,
            currencyCode: "USD",
            fxRate: 41,
            provenance: "rule",
            taxTag: null,
            roleCode: "expense_account",
            linePurpose: "main",
            taxComponent: null,
            settlementComponent: null,
            isProvisional: false,
          },
          {
            lineNumber: 2,
            accountId: "acct-vat",
            accountCode: "1.1.05",
            accountName: "IVA compras",
            debit: 22,
            credit: 0,
            functionalDebit: 902,
            functionalCredit: 0,
            currencyCode: "USD",
            fxRate: 41,
            provenance: "rule",
            taxTag: "VAT",
            roleCode: "input_vat_account",
            linePurpose: "tax",
            taxComponent: "vat",
            settlementComponent: null,
            isProvisional: false,
          },
          {
            lineNumber: 3,
            accountId: "acct-ap",
            accountCode: "2.1.01",
            accountName: "Proveedores",
            debit: 0,
            credit: 122,
            functionalDebit: 0,
            functionalCredit: 5002,
            currencyCode: "USD",
            fxRate: 41,
            provenance: "rule",
            taxTag: null,
            roleCode: "accounts_payable_account",
            linePurpose: "counterparty",
            taxComponent: null,
            settlementComponent: "open_item",
            isProvisional: false,
          },
        ],
        blockingReasons: [],
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
      invoiceIdentity: null,
      conceptResolution: {
        lines: [],
        fallbackUsed: false,
        primaryConceptLabels: [],
        matchedConceptIds: [],
        blockingReasons: [],
        needsUserContext: false,
        unresolvedLineCount: 0,
      },
      accountingContext: {},
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
      appliedRule: {
        ruleId: "rule-1",
        scope: "concept_global",
        priority: 800,
        provenance: "rule_engine",
        accountId: "acct-expense",
        operationCategory: "services",
        linkedOperationType: null,
        templateCode: "purchase_local_credit",
        taxProfileCode: "standard",
        accountIsProvisional: false,
      },
      settlementContext: {
        operationKind: "purchase_invoice",
        paymentTerms: "credit",
        settlementMethod: "bank_transfer",
        settlementEvidenceSource: "invoice_document",
        settlementStatus: "open_payable",
        settlementAllocations: [],
        counterpartyRole: "supplier",
        templateCode: "purchase_local_credit",
        requiresFollowupSettlement: true,
        primaryAccountRole: "accounts_payable_account",
        openItemKind: "payable",
        blockers: [],
        warnings: [],
      },
      validation: {
        canConfirm: true,
        blockers: [],
        canPostProvisional: true,
        canConfirmFinal: true,
        postingStatus: "posted_final",
        blockerGroups: [],
      },
    },
    ...overrides,
  };
}

test("source event payload keeps stable binary hash and deterministic payload hash", () => {
  const first = buildSourceEventPayload(buildArtifactsInput());
  const second = buildSourceEventPayload(buildArtifactsInput());
  const changedFacts = buildSourceEventPayload(buildArtifactsInput({
    facts: {
      ...buildArtifactsInput().facts,
      total_amount: 130,
    },
  }));

  assert.equal(first.binary_hash, "bin-hash-001");
  assert.equal(second.binary_hash, "bin-hash-001");
  assert.equal(first.payload_hash, second.payload_hash);
  assert.notEqual(first.payload_hash, changedFacts.payload_hash);
});

test("economic hash ignores documental noise but reacts to posting facts", () => {
  const baseline = buildArtifactsInput();
  const sameEconomics = buildArtifactsInput({
    revisionNumber: 2,
    reference: "A-001-999",
    originalFilename: "invoice-renamed.pdf",
  });
  const differentEconomics = buildArtifactsInput({
    facts: {
      ...buildArtifactsInput().facts,
      total_amount: 130,
    },
  });
  const baselineFacts = buildSourceEventFactsPayload(baseline);
  const sameEconomicsFacts = buildSourceEventFactsPayload(sameEconomics);

  assert.notEqual(baselineFacts.payload_hash, sameEconomicsFacts.payload_hash);
  assert.equal(buildEconomicEventHash(baseline), buildEconomicEventHash(sameEconomics));
  assert.notEqual(buildEconomicEventHash(baseline), buildEconomicEventHash(differentEconomics));
});

test("posting hash stays stable across revision noise and changes when journal semantics change", () => {
  const baseline = buildArtifactsInput();
  const samePosting = buildArtifactsInput({
    revisionNumber: 2,
    reference: "A-001-999",
  });
  const changedPosting = buildArtifactsInput({
    derived: {
      ...buildArtifactsInput().derived,
      journalSuggestion: {
        ...buildArtifactsInput().derived.journalSuggestion,
        totalDebit: 130,
        totalCredit: 130,
        functionalTotalDebit: 5330,
        functionalTotalCredit: 5330,
        lines: [
          {
            ...buildArtifactsInput().derived.journalSuggestion.lines[0],
            debit: 108,
            functionalDebit: 4428,
          },
          ...buildArtifactsInput().derived.journalSuggestion.lines.slice(1, 2),
          {
            ...buildArtifactsInput().derived.journalSuggestion.lines[2],
            credit: 130,
            functionalCredit: 5330,
          },
        ],
      },
    },
  });

  assert.equal(buildJournalEntrySourceHash(baseline), buildJournalEntrySourceHash(samePosting));
  assert.notEqual(buildJournalEntrySourceHash(baseline), buildJournalEntrySourceHash(changedPosting));
});

test("account role bindings take precedence over heuristic resolution", () => {
  const resolved = resolveAccountRole({
    roleCode: "cash_account",
    appliedRule: {
      ruleId: "rule-1",
      scope: "concept_global",
      accountId: "acct-expense",
      accountCode: "5.1.01",
      accountName: "Compras",
      accountIsProvisional: false,
      status: "approved",
      vatProfileJson: null,
      taxProfileCode: null,
      operationCategory: null,
      linkedOperationType: null,
      templateCode: null,
      provenance: "rule_engine",
      priority: 800,
      source: "manual",
      createdAt: null,
    },
    accounts: [
      {
        id: "acct-cash",
        organization_id: "org-1",
        code: "1.1.01",
        name: "Caja",
        account_type: "asset",
        normal_side: "debit",
        is_postable: true,
        is_provisional: false,
        source: "manual",
        external_code: null,
        statement_section: null,
        nature_tag: null,
        function_tag: null,
        cashflow_tag: null,
        tax_profile_hint: null,
        currency_policy: "mono_currency",
        metadata: {},
      },
    ],
    bindings: [
      {
        id: "binding-1",
        organization_id: "org-1",
        binding_key: "cash.main",
        role_code: "cash_account",
        account_id: "acct-cash",
        document_role: null,
        currency_code: null,
        settlement_method: "cash",
        priority: 100,
        source: "manual",
        is_active: true,
        metadata: {},
      },
    ],
    documentRole: "sale",
    currencyCode: "UYU",
    settlementMethod: "cash",
  });

  assert.equal(resolved.accountId, "acct-cash");
  assert.equal(resolved.provenance, "binding:cash.main");
});

test("reversal journal entry swaps sides and preserves lineage metadata", () => {
  const reversal = buildReversalJournalEntry({
    header: {
      organization_id: "org-1",
      source_document_id: "doc-1",
      source_channel: "documents",
      source_system: "convertilabs",
      posting_mode: "final",
      currency_code: "USD",
      fx_rate: 41,
      fx_rate_date: "2026-03-16",
      fx_rate_source: "bcu",
      functional_currency_code: "UYU",
      functional_currency: "UYU",
      reference: "A-001-123",
      description: "Compra original",
    },
    lines: [
      {
        line_no: 1,
        account_id: "acct-expense",
        debit: 122,
        credit: 0,
        currency_code: "USD",
        original_currency_code: "USD",
        debit_original: 122,
        credit_original: 0,
        fx_rate: 41,
        fx_rate_applied: 41,
        functional_debit: 5002,
        functional_credit: 0,
        functional_currency_code: "UYU",
        description: "Compras",
        metadata: {},
      },
      {
        line_no: 2,
        account_id: "acct-ap",
        debit: 0,
        credit: 122,
        currency_code: "USD",
        original_currency_code: "USD",
        debit_original: 0,
        credit_original: 122,
        fx_rate: 41,
        fx_rate_applied: 41,
        functional_debit: 0,
        functional_credit: 5002,
        functional_currency_code: "UYU",
        description: "Proveedores",
        metadata: {},
      },
    ],
    originalJournalEntryId: "je-1",
    actorId: "user-1",
  });

  assert.equal(reversal.header.reverses_journal_entry_id, "je-1");
  assert.match(reversal.header.reference, /^REV-/);
  assert.equal(reversal.lines[0].debit, 0);
  assert.equal(reversal.lines[0].credit, 122);
  assert.equal(reversal.lines[1].debit, 122);
  assert.equal(reversal.lines[1].credit, 0);
  assert.equal(reversal.lines[0].source_ref_json.reversal_of_journal_entry_id, "je-1");
});

test("trial balance aggregates ledger lines by account deterministically", () => {
  const rows = buildTrialBalance([
    {
      accountId: "acct-expense",
      accountCode: "5.1.01",
      accountName: "Compras",
      debit: 100,
      credit: 0,
      functionalDebit: 4100,
      functionalCredit: 0,
    },
    {
      accountId: "acct-expense",
      accountCode: "5.1.01",
      accountName: "Compras",
      debit: 20,
      credit: 0,
      functionalDebit: 820,
      functionalCredit: 0,
    },
    {
      accountId: "acct-ap",
      accountCode: "2.1.01",
      accountName: "Proveedores",
      debit: 0,
      credit: 120,
      functionalDebit: 0,
      functionalCredit: 4920,
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[1].accountCode, "5.1.01");
  assert.equal(rows[1].debit, 120);
  assert.equal(rows[1].credit, 0);
  assert.equal(rows[1].balance, 120);
  assert.equal(rows[1].functionalBalance, 4920);
});
