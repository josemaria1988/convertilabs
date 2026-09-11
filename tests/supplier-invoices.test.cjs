/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash } = require("node:crypto");
const { test, assert } = require("./testkit.cjs");
const { buildSupplierInvoicesBoard, loadSupplierInvoicesBoard } = require("@/modules/money/supplier-invoices");

const org = "org-a";
const row = values => ({ organization_id: org, ...values });
function fixture() {
  return { organizationId: org, organizationSlug: "rontil", now: new Date("2026-09-12T01:00:00Z"),
    documents: [row({ id: "doc1", status: "needs_review", document_type: "purchase_invoice", current_draft_id: "draft1", party_id: "supplier1", updated_at: "2026-09-11T19:30:00Z" })],
    drafts: [row({ id: "draft1", document_id: "doc1", document_role: "purchase", document_type: "purchase_invoice", status: "open",
      fields_json: { facts: { issuer_name: "Proveedor", issuer_tax_id: "220918880014", series: "A", document_number: "0000200", document_date: "2026-09-11", due_date: "2026-09-24", currency_code: "UYU", subtotal: 565.57, tax_amount: 124.43, total_amount: 690 } }, intake_context_json: {} })],
    parties: [row({ id: "supplier1", display_name: "Proveedor", tax_id_normalized: "220918880014" })], openItems: [], contexts: [], emailSources: [], exportAttempts: [] };
}
function attempt(input, saldo = "0.00") {
  const f = input.drafts[0].fields_json.facts;
  const fingerprint = `sha256:${createHash("sha256").update([f.issuer_tax_id, "sin-tipo", f.series, Number(f.document_number), f.document_date, f.total_amount, f.currency_code].join("|")).digest("hex")}`;
  return row({ id: "attempt1", provider: "zetasoftware", entity_type: "purchase_expense_export_attempt", test_mode: false, payload_json: {
    document_id: "doc1", status: "found_in_zeta", fiscal_fingerprint: fingerprint, recorded_at: "2026-09-11T19:22:12Z",
    request: { Data: { Movimiento: [{ CodigoProveedor: "PR00155", CodigoComprobante: 28, CodigoMoneda: 1, Fecha: "20260911", Serie: "A", Numero: 200 }] } },
    preview: { supplierRut: "220918880014", zetaSupplierCode: "PR00155", monedaCode: 1, lines: [{ netAmount: 565.57, ivaAmount: 124.43, totalAmount: 690 }] },
    response: { reconciliation: { status: "found", registroId: "43141", queryCompras: { Response: [
      { RegistroId: "42954", ProveedorCodigo: "PR00155", ComprobanteCodigo: 28, MonedaCodigo: 1, Serie: "A", Numero: 170, Fecha: "2026-09-01", Total: "1005.00", Saldo: "0.00" },
      { RegistroId: "43141", ProveedorCodigo: "PR00155", ComprobanteCodigo: 28, MonedaCodigo: 1, Serie: "A", Numero: 200, Fecha: "2026-09-11", Total: "690.00", Subtotal: "565.57", IVA: "124.43", Saldo: saldo },
    ] } } },
  } });
}
function ledger(values = {}) {
  return row({ id: "open1", party_id: "supplier1", source_document_id: "doc1", document_role: "purchase", document_type: "invoice", counterparty_type: "vendor", currency_code: "UYU", original_amount: "690.00", settled_amount: "190.00", outstanding_amount: "500.00", status: "partially_settled", metadata: { kind: "payable" }, updated_at: "2026-09-11T20:00:00Z", ...values });
}
const items = board => [...board.confirmed, ...board.unconfirmed].flatMap(group => group.invoices);

test("supplier board keeps received or cash-declared invoices unconfirmed", () => {
  const f = fixture(); f.contexts.push(row({ draft_id: "draft1", structured_context_json: { payment_terms: "cash", settlement_method: "cash", settlement_evidence_source: "user_input", settlement_status: "settled_on_document" } }));
  const board = buildSupplierInvoicesBoard(f);
  assert.equal(board.confirmed.length, 0); assert.equal(board.excludedPaidCount, 0);
  assert.equal(board.unconfirmed[0].invoices[0].amount, "690.00");
});

test("supplier board selects the exact Zeta RegistroId, not the first provider purchase", () => {
  const f = fixture(); f.exportAttempts.push(attempt(f, "300.00"));
  const board = buildSupplierInvoicesBoard(f);
  assert.equal(board.excludedPaidCount, 0); assert.equal(board.confirmed[0].invoices[0].amount, "300.00");
  f.exportAttempts[0].payload_json.response.reconciliation.queryCompras.Response[1].Saldo = "0.00";
  const paid = buildSupplierInvoicesBoard(f); assert.equal(paid.excludedPaidCount, 1); assert.equal(items(paid).length, 0);
});

test("supplier board registration alone, missing/null/wrong balance or identity never proves payment", () => {
  for (const mutate of [
    a => { delete a.payload_json.response.reconciliation.queryCompras; },
    a => { a.payload_json.response.reconciliation.registroId = "other"; },
    a => { a.payload_json.response.reconciliation.queryCompras.Response[1].Saldo = null; },
    a => { a.payload_json.response.reconciliation.queryCompras.Response[1].Saldo = ""; },
    a => { a.payload_json.response.reconciliation.queryCompras.Response[1].ProveedorCodigo = "PR00156"; },
    a => { a.payload_json.response.reconciliation.queryCompras.Response[1].MonedaCodigo = 2; },
    a => { a.payload_json.response.reconciliation.queryCompras.Response[1].Numero = 201; },
    a => { a.test_mode = true; },
  ]) {
    const f = fixture(), a = attempt(f); mutate(a); f.exportAttempts.push(a);
    const board = buildSupplierInvoicesBoard(f); assert.equal(board.excludedPaidCount, 0); assert.equal(board.confirmed.length, 0); assert.equal(items(board).length, 1);
  }
});

test("supplier board does not reuse payment for corrected fiscal content, date or ISO currency", () => {
  for (const patch of [{ total_amount: 700 }, { currency_code: "USD" }, { document_date: "2026-09-10" }, { document_number: "201" }, { subtotal: 566.57, tax_amount: 123.43 }]) {
    const f = fixture(); f.exportAttempts.push(attempt(f)); Object.assign(f.drafts[0].fields_json.facts, patch);
    const board = buildSupplierInvoicesBoard(f); assert.equal(board.excludedPaidCount, 0); assert.equal(board.unconfirmed.length, 1);
  }
});

test("supplier board uses ledger residual and keeps currencies separate with exact decimal strings", () => {
  const f = fixture(); f.openItems.push(ledger());
  const doc2 = structuredClone(f.documents[0]); doc2.id = "doc2"; doc2.current_draft_id = "draft2"; f.documents.push(doc2);
  const d2 = structuredClone(f.drafts[0]); d2.id = "draft2"; d2.document_id = "doc2"; d2.fields_json.facts.document_number = "201"; d2.fields_json.facts.currency_code = "USD"; f.drafts.push(d2);
  f.openItems.push(ledger({ id: "open2", source_document_id: "doc2", currency_code: "USD" }));
  const board = buildSupplierInvoicesBoard(f); assert.equal(board.confirmed.length, 1);
  assert.deepEqual(board.confirmed[0].totals, [{ currency: "USD", amount: "500.00" }, { currency: "UYU", amount: "500.00" }]);
});

test("supplier board requires coherent ledger amounts and excludes card/partner balances from confirmed supplier debt", () => {
  for (const patch of [{ settled_amount: "189.00" }, { outstanding_amount: null }, { currency_code: null }, { metadata: { kind: "clearing" } }, { party_id: "other" }]) {
    const f = fixture(); f.openItems.push(ledger(patch)); assert.equal(buildSupplierInvoicesBoard(f).confirmed.length, 0);
  }
  const f = fixture(); f.openItems.push(ledger()); f.contexts.push(row({ draft_id: "draft1", structured_context_json: { settlement_method: "paid_by_partner" } }));
  assert.equal(buildSupplierInvoicesBoard(f).confirmed.length, 0);
});

test("supplier board does not double-count duplicate ledger rows or photo/XML identities", () => {
  const f = fixture(); f.openItems.push(ledger(), ledger({ id: "open2" }));
  assert.equal(buildSupplierInvoicesBoard(f).confirmed.length, 0);
  f.openItems = []; const doc2 = structuredClone(f.documents[0]); doc2.id = "doc2"; doc2.current_draft_id = "draft2"; f.documents.push(doc2);
  const d2 = structuredClone(f.drafts[0]); d2.id = "draft2"; d2.document_id = "doc2"; d2.fields_json.facts.document_number = "200"; f.drafts.push(d2);
  const board = buildSupplierInvoicesBoard(f); assert.equal(items(board).length, 1); assert.equal(items(board)[0].amount, null); assert.equal(board.unconfirmed[0].totals.length, 0);
});

test("supplier board uses Antel MntPagar without claiming it is current balance and preserves fiscal difference", () => {
  const f = fixture(), facts = f.drafts[0].fields_json.facts;
  facts.total_amount = 367.51; f.drafts[0].intake_context_json.cfe_xml = { payable: 368, total: 367.51, nonBillable: 0.49 };
  const item = items(buildSupplierInvoicesBoard(f))[0]; assert.equal(item.amount, "368.00"); assert.match(item.reason, /no es un saldo confirmado/); assert.match(item.reason, /367\.51/); assert.match(item.reason, /0\.49/);
});

test("supplier board excludes collection supports, sales, credit notes and inactive local documents", () => {
  for (const type of ["purchase_payment_support", "receipt", "voucher", "sale_invoice", "credit_note"]) {
    const f = fixture(); f.drafts[0].document_type = type; assert.equal(items(buildSupplierInvoicesBoard(f)).length, 0);
  }
  for (const status of ["rejected", "duplicate", "archived"]) { const f = fixture(); f.documents[0].status = status; assert.equal(items(buildSupplierInvoicesBoard(f)).length, 0); }
});

test("supplier board preserves unknown amounts/currencies and Uruguay due-date boundaries", () => {
  const f = fixture(), facts = f.drafts[0].fields_json.facts;
  facts.currency_code = null; facts.total_amount = null; facts.due_date = "2026-09-11";
  let board = buildSupplierInvoicesBoard(f); assert.equal(items(board)[0].dueState, "due_soon"); assert.equal(items(board)[0].amount, null); assert.equal(items(board)[0].currency, null); assert.equal(board.unconfirmed[0].totals.length, 0);
  facts.due_date = "2026-09-10"; assert.equal(items(buildSupplierInvoicesBoard(f))[0].dueState, "overdue");
  facts.due_date = null; assert.equal(items(buildSupplierInvoicesBoard(f))[0].dueState, "no_due_date");
});

test("supplier board scopes every join to organization and exact current document draft", () => {
  const f = fixture(); f.exportAttempts.push({ ...attempt(f), organization_id: "org-b" }); f.openItems.push({ ...ledger(), organization_id: "org-b" });
  f.parties.push(row({ id: "other", display_name: "Other" })); assert.equal(buildSupplierInvoicesBoard(f).unconfirmed.length, 1);
  f.drafts[0].document_id = "other-document"; const board = buildSupplierInvoicesBoard(f); assert.equal(items(board).length, 0); assert.equal(board.inboxPendingCount, 1);
  f.documents[0].organization_id = "org-b"; assert.equal(items(buildSupplierInvoicesBoard(f)).length, 0);
});

test("supplier board source conflict or incomplete reads do not hide a possibly unpaid invoice", () => {
  const f = fixture(); f.exportAttempts.push(attempt(f)); f.emailSources.push(row({ document_id: "doc1", provider: "email_inbox", drift_status: "none", current_payload_hash: "a".repeat(64), payload_hash_at_materialization: "a".repeat(64), metadata_json: { differences_pending_review: false } }));
  assert.equal(buildSupplierInvoicesBoard(f).excludedPaidCount, 1);
  f.emailSources[0].metadata_json.differences_pending_review = true; assert.equal(buildSupplierInvoicesBoard(f).excludedPaidCount, 0);
  f.emailSources = []; f.evidenceIncomplete = true; const board = buildSupplierInvoicesBoard(f); assert.equal(board.excludedPaidCount, 0); assert.equal(board.confirmed.length, 0); assert.equal(items(board).length, 1);
});

function fakeDb(tables, failures = new Set()) {
  const calls = [];
  return { calls, from(table) {
    let selected = tables[table] ?? [], from = 0, to = Infinity; const filters = [];
    const query = {
      select() { return query; }, eq(key, val) { filters.push([key, val]); selected = selected.filter(r => r[key] === val); return query; },
      in(key, vals) { selected = selected.filter(r => vals.includes(r[key])); return query; }, order() { return query; }, range(a, b) { from = a; to = b; return query; },
      then(resolve, reject) { calls.push({ table, from, to, filters }); return Promise.resolve(failures.has(table) ? { data: null, error: { message: "SQL private" } } : { data: selected.slice(from, to + 1), error: null }).then(resolve, reject); },
    }; return query;
  } };
}
test("supplier board loader paginates beyond 500 records and batches tenant-scoped joins", async () => {
  const f = fixture(), docs = [], drafts = [];
  for (let i = 0; i < 501; i++) { docs.push({ ...f.documents[0], id: `doc${i}`, current_draft_id: `draft${i}` }); const d = structuredClone(f.drafts[0]); d.id = `draft${i}`; d.document_id = `doc${i}`; d.fields_json.facts.document_number = String(i + 1); drafts.push(d); }
  const db = fakeDb({ documents: docs, document_drafts: drafts, parties: f.parties });
  const board = await loadSupplierInvoicesBoard(db, { organizationId: org, organizationSlug: "rontil" });
  assert.equal(items(board).length, 501); assert.equal(board.coverage.status, "complete");
  assert.equal(db.calls.filter(c => c.table === "documents").length, 3);
  assert.ok(db.calls.every(c => c.filters.some(([key, val]) => key === "organization_id" && val === org)));
});

test("supplier board loader fails closed with generic unavailable/partial messages and no write methods", async () => {
  const f = fixture(), db = fakeDb({ documents: f.documents, document_drafts: f.drafts, parties: f.parties, integration_raw_records: [attempt(f)] }, new Set(["document_source_refs"]));
  const board = await loadSupplierInvoicesBoard(db, { organizationId: org, organizationSlug: "rontil" });
  assert.equal(board.coverage.status, "partial"); assert.equal(board.excludedPaidCount, 0); assert.equal(items(board).length, 1); assert.doesNotMatch(JSON.stringify(board), /SQL private/);
  const unavailable = await loadSupplierInvoicesBoard(fakeDb({}, new Set(["documents", "ledger_open_items"])), { organizationId: org, organizationSlug: "rontil" });
  assert.equal(unavailable.coverage.status, "unavailable"); assert.equal(unavailable.confirmed.length, 0);
});

test("supplier board loader reports its explicit 5000-row safety limit instead of silently claiming completeness", async () => {
  const documents = Array.from({ length: 5001 }, (_, i) => row({ id: `doc${i}`, status: "uploaded", current_draft_id: null }));
  const db = fakeDb({ documents });
  const board = await loadSupplierInvoicesBoard(db, { organizationId: org, organizationSlug: "rontil" });
  assert.equal(board.coverage.status, "partial"); assert.match(board.coverage.message, /5\.000/); assert.equal(board.inboxPendingCount, 5000);
  assert.ok(db.calls.some(call => call.table === "documents" && call.from === 5000 && call.to === 5000));
});
