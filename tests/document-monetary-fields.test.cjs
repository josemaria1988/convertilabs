/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");
const { buildDocumentMonetaryFields } = require("@/modules/documents/monetary-document-fields");
const { omitDocumentStep5Columns } = require("@/modules/accounting/step5-schema-compat");
const { loadWorkUnitDetail } = require("@/modules/work/repository");

function snapshot(overrides = {}) {
  return {
    currencyCode: "UYU", netAmountOriginal: 318.03, taxAmountOriginal: 69.97, totalAmountOriginal: 388,
    netAmountUyu: 318.03, taxAmountUyu: 69.97, totalAmountUyu: 388,
    fx: { functionalCurrencyCode: "UYU", rate: 1, blockingReasons: [] },
    ...overrides,
  };
}
const facts = { currency_code: "UYU", subtotal: 318.03, tax_amount: 69.97, total_amount: 388 };

test("draft monetary fields use existing canonical columns and survive optional schema compatibility", () => {
  const fields = buildDocumentMonetaryFields({ facts, monetarySnapshot: snapshot() });
  assert.deepEqual(fields, {
    document_currency_code: "UYU", document_net_amount_original: 318.03,
    document_tax_amount_original: 69.97, document_total_amount_original: 388,
    net_amount_uyu: 318.03, tax_amount_uyu: 69.97, total_amount_uyu: 388,
  });
  const schema = fs.readFileSync(path.join(__dirname, "../db/schema/04_documents.sql"), "utf8");
  for (const key of Object.keys(fields)) assert.match(schema, new RegExp(`\\b${key} (?:text|numeric)`));
  assert.deepEqual(omitDocumentStep5Columns({ ...fields, posting_status: "draft", issuer_city: null }), fields);
  assert.equal(Object.hasOwn(fields, "posting_status"), false);
  assert.equal(Object.hasOwn(fields, "confirmed_at"), false);
});

test("absent amounts stay null even when calculation snapshots supplied default zeros", () => {
  const fields = buildDocumentMonetaryFields({
    facts: { currency_code: "UYU", subtotal: null, tax_amount: null, total_amount: null },
    monetarySnapshot: snapshot({ netAmountOriginal: 0, taxAmountOriginal: 0, totalAmountOriginal: 0,
      netAmountUyu: 0, taxAmountUyu: 0, totalAmountUyu: 0 }),
  });
  assert.deepEqual(fields, {
    document_currency_code: "UYU", document_net_amount_original: null,
    document_tax_amount_original: null, document_total_amount_original: null,
    net_amount_uyu: null, tax_amount_uyu: null, total_amount_uyu: null,
  });
  const explicitZero = buildDocumentMonetaryFields({
    facts: { currency_code: "UYU", subtotal: 0, tax_amount: 0, total_amount: 0 }, monetarySnapshot: null,
  });
  assert.equal(explicitZero.document_total_amount_original, 0);
  assert.equal(explicitZero.tax_amount_uyu, 0);
  assert.equal(explicitZero.total_amount_uyu, 0);
});

test("an unknown currency is not inferred from the journal or snapshot default", () => {
  const fields = buildDocumentMonetaryFields({ facts: { ...facts, currency_code: null }, monetarySnapshot: snapshot() });
  assert.equal(fields.document_currency_code, null);
  assert.equal(fields.document_total_amount_original, 388);
  assert.equal(fields.net_amount_uyu, null);
  assert.equal(fields.tax_amount_uyu, null);
  assert.equal(fields.total_amount_uyu, null);
});

test("foreign amounts require resolved UYU conversion and retain original values when FX is missing", () => {
  const foreignFacts = { currency_code: "USD", subtotal: 100, tax_amount: 22, total_amount: 122 };
  const foreignSnapshot = snapshot({ currencyCode: "USD", netAmountOriginal: 100, taxAmountOriginal: 22,
    totalAmountOriginal: 122, netAmountUyu: 0, taxAmountUyu: 0, totalAmountUyu: 0,
    fx: { functionalCurrencyCode: "UYU", rate: 0, blockingReasons: ["MISSING_FX_RATE"] } });
  const unresolved = buildDocumentMonetaryFields({ facts: foreignFacts, monetarySnapshot: foreignSnapshot });
  assert.equal(unresolved.document_currency_code, "USD");
  assert.equal(unresolved.document_net_amount_original, 100);
  assert.equal(unresolved.document_tax_amount_original, 22);
  assert.equal(unresolved.document_total_amount_original, 122);
  assert.equal(unresolved.net_amount_uyu, null);
  assert.equal(unresolved.tax_amount_uyu, null);
  assert.equal(unresolved.total_amount_uyu, null);
  const resolved = buildDocumentMonetaryFields({ facts: foreignFacts, monetarySnapshot: {
    ...foreignSnapshot, netAmountUyu: 4000, taxAmountUyu: 880, totalAmountUyu: 4880,
    fx: { functionalCurrencyCode: "UYU", rate: 40, blockingReasons: [] },
  } });
  assert.equal(resolved.net_amount_uyu, 4000);
  assert.equal(resolved.tax_amount_uyu, 880);
  assert.equal(resolved.total_amount_uyu, 4880);
});

test("a saved purchase draft contributes document cost and VAT without accounting confirmation", async () => {
  const fields = buildDocumentMonetaryFields({ facts, monetarySnapshot: snapshot() });
  const draftDocument = { id: "invoice", direction: "purchase", document_type: "invoice", status: "needs_review",
    posting_status: "draft", original_filename: "invoice.jpg", document_date: "2026-09-09", created_at: "2026-09-09T12:00:00Z", ...fields };
  const work = { id: "work", organization_id: "org", code: null, name: "Servicio", kind: "service", status: "active",
    customer_party_id: null, start_date: null, end_date: null, estimated_revenue: null, estimated_cost: null,
    actual_revenue: 0, actual_cost: 0, currency_code: "UYU", description: null, source: "manual",
    created_at: "2026-09-09T12:00:00Z", updated_at: "2026-09-09T12:00:00Z" };
  const supabase = { from(table) {
    const result = () => ({ error: null, data: table === "work_units" ? work : table === "documents" ? [draftDocument] : [] });
    const query = { select() { return query; }, eq() { return query; }, order() { return query; }, in() { return query; },
      limit() { return query; }, maybeSingle() { return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
    return query;
  } };
  const detail = await loadWorkUnitDetail(supabase, { organizationId: "org", workUnitId: "work" });
  assert.equal(detail.documentCost, 388);
  assert.equal(detail.vatInputAmount, 69.97);
  assert.equal(detail.purchaseDocumentCount, 1);
  assert.equal(detail.pendingDocumentCount, 1);
  assert.equal(detail.postedDocumentCount, 0);
  assert.equal(detail.journalEntryCount, 0);
  assert.equal(detail.openItemCount, 0);
  assert.equal(draftDocument.posting_status, "draft");
});
