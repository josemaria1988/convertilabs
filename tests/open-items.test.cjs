/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildOpenItemMutationPlan,
  resolveOpenItemMonetaryContext,
  syncApprovedDocumentOpenItems,
} = require("@/modules/accounting/open-items");

test("open items create AP rows for purchase invoices", () => {
  const result = buildOpenItemMutationPlan({
    organizationId: "org-1",
    documentId: "doc-1",
    documentRole: "purchase",
    documentType: "purchase_invoice",
    counterpartyType: "vendor",
    counterpartyId: "vendor-1",
    partyId: "party-1",
    workUnitId: "work-1",
    journalEntryId: "je-1",
    issueDate: "2026-03-14",
    dueDate: "2026-03-30",
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: "2026-03-14",
    fxRateSource: "same_currency",
    totalAmount: 122,
    existingOpenItems: [],
  });

  assert.equal(result.createOpenItems.length, 1);
  assert.equal(result.createOpenItems[0].outstanding_amount, 122);
  assert.equal(result.createOpenItems[0].counterparty_type, "vendor");
  assert.equal(result.createOpenItems[0].counterparty_id, "vendor-1");
  assert.equal(result.createOpenItems[0].party_id, "party-1");
  assert.equal(result.createOpenItems[0].work_unit_id, "work-1");
});

test("open items keep foreign currency information for AR invoices", () => {
  const result = buildOpenItemMutationPlan({
    organizationId: "org-1",
    documentId: "doc-2",
    documentRole: "sale",
    documentType: "sale_invoice",
    counterpartyType: "customer",
    counterpartyId: "customer-1",
    journalEntryId: "je-2",
    issueDate: "2026-03-14",
    dueDate: "2026-03-30",
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    fxRate: 44.1,
    fxRateDate: "2026-03-14",
    fxRateSource: "bcu",
    totalAmount: 500,
    existingOpenItems: [],
  });

  assert.equal(result.createOpenItems[0].currency_code, "USD");
  assert.equal(result.createOpenItems[0].functional_currency_code, "UYU");
  assert.equal(result.createOpenItems[0].functional_amount, 22050);
});

test("open items settle partially with receipts or payments", () => {
  const result = buildOpenItemMutationPlan({
    organizationId: "org-1",
    documentId: "doc-3",
    documentRole: "sale",
    documentType: "sale_receipt",
    counterpartyType: "customer",
    counterpartyId: "customer-1",
    journalEntryId: "je-3",
    issueDate: "2026-03-15",
    dueDate: null,
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: "2026-03-15",
    fxRateSource: "same_currency",
    totalAmount: 40,
    existingOpenItems: [
      {
        id: "open-1",
        issue_date: "2026-03-10",
        outstanding_amount: 100,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.equal(result.updateOpenItems.length, 1);
  assert.equal(result.updateOpenItems[0].outstanding_amount, 60);
  assert.equal(result.settlementLinks[0].amount, 40);
});

test("open items settle credit notes fully without residual balance", () => {
  const result = buildOpenItemMutationPlan({
    organizationId: "org-1",
    documentId: "doc-4",
    documentRole: "purchase",
    documentType: "purchase_credit_note",
    counterpartyType: "vendor",
    counterpartyId: "vendor-1",
    journalEntryId: "je-4",
    issueDate: "2026-03-15",
    dueDate: null,
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: "2026-03-15",
    fxRateSource: "same_currency",
    totalAmount: 100,
    existingOpenItems: [
      {
        id: "open-1",
        issue_date: "2026-03-10",
        outstanding_amount: 100,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.equal(result.createOpenItems.length, 0);
  assert.equal(result.updateOpenItems[0].status, "settled");
});

test("open items preserve residual credit balances when settlement exceeds outstanding amount", () => {
  const result = buildOpenItemMutationPlan({
    organizationId: "org-1",
    documentId: "doc-5",
    documentRole: "purchase",
    documentType: "purchase_payment_support",
    counterpartyType: "vendor",
    counterpartyId: "vendor-1",
    journalEntryId: "je-5",
    issueDate: "2026-03-15",
    dueDate: null,
    currencyCode: "UYU",
    functionalCurrencyCode: "UYU",
    fxRate: 1,
    fxRateDate: "2026-03-15",
    fxRateSource: "same_currency",
    totalAmount: 70,
    existingOpenItems: [
      {
        id: "open-1",
        issue_date: "2026-03-10",
        outstanding_amount: 50,
        settled_amount: 0,
        status: "open",
      },
    ],
  });

  assert.equal(result.updateOpenItems[0].outstanding_amount, 0);
  assert.equal(result.createOpenItems.length, 1);
  assert.equal(result.createOpenItems[0].outstanding_amount, -20);
});

test("open item monetary context blocks foreign currency without a trusted FX snapshot", () => {
  const result = resolveOpenItemMonetaryContext({
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    documentDate: "2026-03-17",
    confirmedSnapshot: {
      currencyCode: "USD",
      functionalCurrencyCode: "UYU",
      fxRate: 1,
      fxRateDate: null,
      fxRateSource: "document_default",
    },
  });

  assert.equal(result.blockingReason !== null, true);
});

test("open item mutation plan blocks foreign currency without a trusted FX snapshot", () => {
  assert.throws(() => {
    buildOpenItemMutationPlan({
      organizationId: "org-1",
      documentId: "doc-usd-missing-fx",
      documentRole: "sale",
      documentType: "sale_invoice",
      counterpartyType: "customer",
      counterpartyId: "customer-1",
      journalEntryId: "je-usd-missing-fx",
      issueDate: "2026-03-17",
      dueDate: "2026-03-30",
      currencyCode: "USD",
      functionalCurrencyCode: "UYU",
      fxRate: 1,
      fxRateDate: null,
      fxRateSource: "document_default",
      totalAmount: 100,
      existingOpenItems: [],
    });
  }, /snapshot FX confiable/i);
});

test("open items do not auto-settle across currencies in MVP", () => {
  assert.throws(() => {
    buildOpenItemMutationPlan({
      organizationId: "org-1",
      documentId: "doc-uyu-receipt",
      documentRole: "sale",
      documentType: "sale_receipt",
      counterpartyType: "customer",
      counterpartyId: "customer-1",
      journalEntryId: "je-uyu-receipt",
      issueDate: "2026-03-20",
      dueDate: null,
      currencyCode: "UYU",
      functionalCurrencyCode: "UYU",
      fxRate: 1,
      fxRateDate: "2026-03-20",
      fxRateSource: "same_currency",
      totalAmount: 40,
      existingOpenItems: [
        {
          id: "open-usd-1",
          issue_date: "2026-03-10",
          currency_code: "USD",
          functional_currency_code: "UYU",
          fx_rate: 44.1,
          fx_rate_date: "2026-03-10",
          fx_rate_source: "bcu",
          outstanding_amount: 100,
          settled_amount: 0,
          status: "open",
        },
      ],
    });
  }, /auto-settlement entre UYU y USD/i);
});

test("open items persist the fiscal FX resolved for foreign currency documents", async () => {
  const insertedOpenItems = [];
  const insertedParties = [];
  const upsertedRoles = [];
  const upsertedIdentifiers = [];
  const supabase = {
    from(table) {
      if (table === "parties") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => ({
            data: null,
            error: null,
          }),
          insert(payload) {
            insertedParties.push(payload);
            return {
              select() {
                return this;
              },
              limit() {
                return this;
              },
              single: async () => ({
                data: { id: "party-1" },
                error: null,
              }),
            };
          },
        };
      }

      if (table === "party_roles") {
        return {
          upsert: async (payload) => {
            upsertedRoles.push(payload);
            return { error: null };
          },
        };
      }

      if (table === "party_identifiers") {
        return {
          upsert: async (payload) => {
            upsertedIdentifiers.push(payload);
            return { error: null };
          },
        };
      }

      if (table === "ledger_open_items") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          neq() {
            return this;
          },
          order: async () => ({
            data: [],
            error: null,
          }),
          insert: async (payload) => {
            insertedOpenItems.push(...payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  await syncApprovedDocumentOpenItems({
    supabase,
    organizationId: "org-1",
    documentId: "doc-usd-1",
    documentRole: "purchase",
    documentType: "purchase_invoice",
    settlementContext: {
      operationKind: "purchase_invoice",
      openItemKind: "payable",
    },
    documentDate: "2026-03-17",
    dueDate: "2026-03-30",
    currencyCode: "USD",
    functionalCurrencyCode: "UYU",
    confirmedMonetarySnapshot: {
      currencyCode: "USD",
      functionalCurrencyCode: "UYU",
      fxRate: 44.1,
      fxRateDate: "2026-03-16",
      fxRateSource: "bcu",
    },
    draftMonetarySnapshot: {
      currencyCode: "USD",
      functionalCurrencyCode: "UYU",
      fxRate: 44.1,
      fxRateDate: "2026-03-16",
      fxRateSource: "bcu",
    },
    totalAmount: 500,
    vendorId: "vendor-1",
    issuerName: "Proveedor exterior",
    issuerTaxId: "219999999999",
    receiverName: null,
    receiverTaxId: null,
    journalEntryId: "je-usd-1",
    workUnitId: "work-1",
  });

  assert.equal(insertedOpenItems.length, 1);
  assert.equal(insertedOpenItems[0].currency_code, "USD");
  assert.equal(insertedOpenItems[0].functional_currency_code, "UYU");
  assert.equal(insertedOpenItems[0].fx_rate, 44.1);
  assert.equal(insertedOpenItems[0].fx_rate_date, "2026-03-16");
  assert.equal(insertedOpenItems[0].fx_rate_source, "bcu");
  assert.equal(insertedOpenItems[0].functional_amount, 22050);
  assert.equal(insertedOpenItems[0].counterparty_id, "vendor-1");
  assert.equal(insertedOpenItems[0].party_id, "party-1");
  assert.equal(insertedOpenItems[0].work_unit_id, "work-1");
  assert.equal(insertedParties[0].legacy_vendor_id, "vendor-1");
  assert.equal(upsertedRoles[0].role_type, "vendor");
  assert.equal(upsertedIdentifiers[0].identifier_value_normalized, "219999999999");
});

test("syncApprovedDocumentOpenItems blocks foreign currency documents without a trusted FX snapshot", async () => {
  const supabase = {
    from() {
      throw new Error("No deberia consultar tablas si el FX ya es invalido.");
    },
  };

  await assert.rejects(
    syncApprovedDocumentOpenItems({
      supabase,
      organizationId: "org-1",
      documentId: "doc-usd-invalid",
      documentRole: "purchase",
      documentType: "purchase_invoice",
      settlementContext: {
        operationKind: "purchase_invoice",
        openItemKind: "payable",
      },
      documentDate: "2026-03-17",
      dueDate: "2026-03-30",
      currencyCode: "USD",
      functionalCurrencyCode: "UYU",
      confirmedMonetarySnapshot: {
        currencyCode: "USD",
        functionalCurrencyCode: "UYU",
        fxRate: 1,
        fxRateDate: null,
        fxRateSource: "document_default",
      },
      draftMonetarySnapshot: null,
      totalAmount: 500,
      vendorId: "vendor-1",
      issuerName: "Proveedor exterior",
      issuerTaxId: "219999999999",
      receiverName: null,
      receiverTaxId: null,
      journalEntryId: "je-usd-invalid",
    }),
    /snapshot FX confiable/i,
  );
});
