/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildOpenItemMutationPlan,
} = require("@/modules/accounting/open-items");

test("open items create AP rows for purchase invoices", () => {
  const result = buildOpenItemMutationPlan({
    organizationId: "org-1",
    documentId: "doc-1",
    documentRole: "purchase",
    documentType: "purchase_invoice",
    counterpartyType: "vendor",
    counterpartyId: "vendor-1",
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
    fxRate: 1,
    fxRateDate: "2026-03-14",
    fxRateSource: "document_default",
    totalAmount: 500,
    existingOpenItems: [],
  });

  assert.equal(result.createOpenItems[0].currency_code, "USD");
  assert.equal(result.createOpenItems[0].functional_currency_code, "UYU");
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
