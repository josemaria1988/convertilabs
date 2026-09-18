/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { buildAdministrativeReview, parseAdministrativeReview, validateAdministrativeReviewBinding } = require("@/modules/documents/administrative-review");
const { buildSupplierInvoicesBoard } = require("@/modules/money/supplier-invoices");
const facts = { issuer_tax_id: "220918880014", series: "A", document_number: "200", document_date: "2026-09-11", currency_code: "UYU", total_amount: 690 };
function review(patch = {}) {
  return buildAdministrativeReview({ organizationId: "org", documentId: "doc", currentDraftId: "draft", facts,
    actorId: "human", reviewedAt: "2026-09-18T14:00:00.000Z", source: { workbookSha256: "a".repeat(64), ref: "P04" },
    comment: "Comida del personal. Pagada con caja.", classificationStatus: "confirmed", futureScope: null,
    payment: { status: "paid", method: "Caja", date: null, amount: null, currency: null }, ...patch });
}
const scoped = value => ({ organization_id: "org", ...value });
function snapshot(status = "paid") {
  const r = review({ payment: { status, method: status === "paid" ? "Caja" : null, date: null, amount: null, currency: null } });
  return { organizationId: "org", organizationSlug: "rontil", now: new Date("2026-09-18T15:00:00Z"),
    documents: [scoped({ id: "doc", current_draft_id: "draft", party_id: "party", status: "needs_review", metadata: { administrative_review: r } })],
    drafts: [scoped({ id: "draft", document_id: "doc", document_role: "purchase", document_type: "purchase_invoice", status: "open", fields_json: { facts: { ...facts } } })],
    parties: [scoped({ id: "party", display_name: "Panadería", tax_id_normalized: facts.issuer_tax_id })], contexts: [], openItems: [], emailSources: [], exportAttempts: [] };
}
const count = groups => (groups ?? []).reduce((n, g) => n + g.invoices.length, 0);
function addLedger(f, balance, at) {
  f.openItems.push(scoped({ id: "ledger", source_document_id: "doc", party_id: "party", document_role: "purchase", document_type: "purchase_invoice", counterparty_type: "vendor", currency_code: "UYU",
    original_amount: "690.00", settled_amount: (690 - balance).toFixed(2), outstanding_amount: balance.toFixed(2), status: balance === 0 ? "settled" : balance === 690 ? "open" : "partially_settled", metadata: { kind: "payable" }, updated_at: at }));
}
function addCache(f, balance, at = "2026-09-18T14:30:00Z") {
  f.cachedPurchases = { organizationId: "org", contacts: [{ Codigo: "PR00155", RUT: facts.issuer_tax_id }], currencies: [{ Codigo: 9, CodigoISO: "UYU" }], rows: [{ RegistroId: 99, ProveedorCodigo: "PR00155", Serie: "A", Numero: "200", Fecha: "2026-09-11", MonedaCodigo: 9, ComprobanteCodigo: 28,
    _balance: { schemaVersion: 1, endpoint: "RESTFacturaProveedorV1Compras", dataAsOf: at, raw: { FacturaId: 99, ProveedorCodigo: "PR00155", FacturaSerie: "A", FacturaNumero: 200, FacturaDia: 11, FacturaMes: 9, FacturaAnio: 2026, MonedaCodigo: 9, ComprobanteCodigo: 28, FacturaTotal: 690, FacturaSaldo: balance } } }] };
}
test("administrative review binds tenant, document, draft and fiscal facts with immutable source attribution", () => {
  const r = review();
  assert.equal(validateAdministrativeReviewBinding(r, { ...r, facts }), true);
  for (const patch of [{ organizationId: "other" }, { documentId: "other" }, { currentDraftId: "other" }, { facts: { ...facts, total_amount: 691 } }, { facts: { ...facts, currency_code: "USD" } }])
    assert.equal(validateAdministrativeReviewBinding(r, { ...r, facts, ...patch }), false);
  assert.equal(validateAdministrativeReviewBinding(r, { ...r, facts: { ...facts, document_number: "000200", total_amount: "690.00" } }), true);
  assert.equal(r.payment.date, null); assert.equal(r.payment.amount, null); assert.equal(r.futureScope, null);
});
test("administrative review rejects invalid dates, automatic rules and an amount without currency", () => {
  for (const patch of [{ reviewedAt: "invalid" }, { reviewedAt: "2026-02-30T00:00:00Z" }, { futureScope: "vendor_default" }, { source: { workbookSha256: "invalid", ref: "P04" } },
    { payment: { status: "paid", method: null, date: "2026-02-30", amount: null, currency: null } },
    { payment: { status: "paid", method: null, date: null, amount: "690", currency: null } }]) assert.equal(parseAdministrativeReview({ ...review(), ...patch }), null);
});
test("human paid declaration stays visible separately, without invented amount/date or ledger writes", () => {
  const f = snapshot(), before = JSON.stringify(f), result = buildSupplierInvoicesBoard(f);
  assert.equal(count(result.humanPaid), 1); assert.equal(count(result.confirmed) + count(result.unconfirmed), 0);
  assert.equal(result.excludedPaidCount, 0); assert.equal(result.humanPaid[0].invoices[0].administrativeReview.paidAmount, null);
  assert.equal(JSON.stringify(f), before);
});
test("human unpaid declaration shows source amount as reference, not a newly posted payable", () => {
  const f = snapshot("unpaid"); f.drafts[0].intake_context_json = { cfe_xml: { payable: 690.49 } };
  const result = buildSupplierInvoicesBoard(f);
  assert.equal(count(result.humanUnpaid), 1); assert.equal(count(result.confirmed), 0);
  assert.equal(result.humanUnpaid[0].invoices[0].amount, "690.49"); assert.match(result.humanUnpaid[0].invoices[0].reason, /no es un saldo conciliado/);
});
test("old ledger debt does not cancel a later human payment declaration", () => {
  const f = snapshot(); addLedger(f, 690, "2026-09-17T18:00:00Z"); assert.equal(count(buildSupplierInvoicesBoard(f).humanPaid), 1);
});
test("newer contradictory balance requires review instead of hiding debt or overriding user", () => {
  for (const status of ["paid", "unpaid"]) {
    const f = snapshot(status); addLedger(f, status === "paid" ? 690 : 0, "2026-09-18T14:30:00Z");
    const result = buildSupplierInvoicesBoard(f); assert.equal(count(result.humanPaid) + count(result.humanUnpaid), 0);
    assert.equal(count(result.unconfirmed), 1); assert.equal(result.excludedPaidCount, 0); assert.match(result.unconfirmed[0].invoices[0].reason, /contradice/);
  }
});
test("stale, cross-tenant, future or source-conflicted human review never hides an invoice", () => {
  for (const mutate of [f => { f.documents[0].metadata.administrative_review.organizationId = "other"; }, f => { f.drafts[0].fields_json.facts.total_amount = 700; },
    f => { f.documents[0].metadata.administrative_review.reviewedAt = "2030-01-01T00:00:00Z"; }, f => { f.evidenceIncomplete = true; },
    f => { f.emailSources.push(scoped({ document_id: "doc", provider: "email_inbox", drift_status: "changed" })); }]) {
    const f = snapshot(); mutate(f); const result = buildSupplierInvoicesBoard(f); assert.equal(count(result.humanPaid), 0); assert.equal(count(result.unconfirmed), 1);
  }
});
test("cached explicit Zeta balance matches exact invoice and master currency without hardcoded currency codes", () => {
  const f = snapshot("unknown"); addCache(f, 250);
  const result = buildSupplierInvoicesBoard(f); assert.equal(result.confirmed[0].invoices[0].amount, "250.00");
  assert.match(result.confirmed[0].invoices[0].reason, /observado en Zeta/);
});
test("newer cache balance conflicts with declared payment; zero alone never invents a payment method/date", () => {
  const f = snapshot(); addCache(f, 100); assert.equal(count(buildSupplierInvoicesBoard(f).unconfirmed), 1);
  delete f.documents[0].metadata.administrative_review; f.cachedPurchases.rows[0]._balance.raw.FacturaSaldo = 0;
  const result = buildSupplierInvoicesBoard(f); assert.equal(result.excludedPaidCount, 1); assert.equal(count(result.humanPaid), 0);
});
test("human paid review preserves a matching current zero ERP balance without inventing payment date", () => {
  const f = snapshot(); addCache(f, 0);
  const result = buildSupplierInvoicesBoard(f), item = result.humanPaid[0].invoices[0];
  assert.match(item.reason, /Sin saldo observado en Zeta el/); assert.match(item.reason, /18\/09\/2026/);
  assert.deepEqual(item.observedBalance, { source: "zeta", amount: "0.00", currency: "UYU", asOf: "2026-09-18T14:30:00.000Z", beforeHumanReview: false });
  assert.equal(item.administrativeReview.paymentDate, null); assert.equal(item.administrativeReview.paidAmount, null);
});
test("human paid review shows older positive ERP and ledger balances with their source and chronology", () => {
  for (const source of ["zeta", "ledger"]) {
    const f = snapshot();
    if (source === "zeta") addCache(f, 690, "2026-09-17T18:00:00Z");
    else addLedger(f, 690, "2026-09-17T18:00:00Z");
    const result = buildSupplierInvoicesBoard(f), item = result.humanPaid[0].invoices[0];
    assert.match(item.reason, /Saldo observado 690\.00 UYU/); assert.match(item.reason, /saldo es anterior a tu revisión/);
    assert.match(item.reason, source === "zeta" ? /en Zeta/ : /cuentas por pagar de Convertilabs/);
    assert.equal(item.observedBalance.source, source); assert.equal(item.observedBalance.beforeHumanReview, true); assert.equal(count(result.unconfirmed), 0);
  }
});
test("a later human declaration survives differing older ledger and ERP balances with a visible historical warning", () => {
  for (const status of ["paid", "unpaid"]) {
    const f = snapshot(status); addLedger(f, 690, "2026-09-17T18:00:00Z"); addCache(f, 0, "2026-09-17T19:00:00Z");
    const result = buildSupplierInvoicesBoard(f), group = status === "paid" ? result.humanPaid : result.humanUnpaid;
    assert.equal(count(group), 1); assert.equal(count(result.unconfirmed), 0); assert.match(group[0].invoices[0].reason, /discrepancia histórica/);
    f.cachedPurchases.rows[0]._balance.dataAsOf = "2026-09-18T14:30:00Z";
    if (status === "paid") f.cachedPurchases.rows[0]._balance.raw.FacturaSaldo = 100;
    assert.equal(count(buildSupplierInvoicesBoard(f).unconfirmed), 1);
  }
});
test("cached balance rejects wrong dates, amounts, IDs, source timestamps and ambiguous currency mappings", () => {
  for (const mutate of [f => { f.cachedPurchases.rows[0]._balance.raw.FacturaDia = 12; }, f => { f.cachedPurchases.rows[0]._balance.raw.FacturaTotal = 689; },
    f => { f.cachedPurchases.rows[0]._balance.raw.FacturaId = 100; }, f => { f.cachedPurchases.rows[0]._balance.dataAsOf = "invalid"; },
    f => { f.cachedPurchases.currencies.push({ Codigo: 9, CodigoISO: "USD" }); }, f => { f.cachedPurchases.contacts.push({ Codigo: "PR00155", RUT: "213554700012" }); }, f => { f.cachedPurchases.rows.push(structuredClone(f.cachedPurchases.rows[0])); }]) {
    const f = snapshot("unknown"); addCache(f, 0); mutate(f); const result = buildSupplierInvoicesBoard(f);
    assert.equal(result.excludedPaidCount, 0); assert.equal(count(result.unconfirmed), 1);
  }
});
test("cached balance permits only explicit small XML payable rounding without changing fiscal total", () => {
  const f = snapshot("unknown"); addCache(f, 690.49); f.drafts[0].intake_context_json = { cfe_xml: { payable: 690.49 } }; f.cachedPurchases.rows[0]._balance.raw.FacturaTotal = 690.49;
  assert.equal(buildSupplierInvoicesBoard(f).confirmed[0].invoices[0].amount, "690.49"); assert.equal(f.drafts[0].fields_json.facts.total_amount, 690);
  f.drafts[0].intake_context_json.cfe_xml.payable = 700; f.cachedPurchases.rows[0]._balance.raw.FacturaTotal = 700;
  assert.equal(count(buildSupplierInvoicesBoard(f).confirmed), 0);
});
