/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { createHash } = require("node:crypto");
const { buildSupplierInvoicesBoard, loadSupplierInvoicesBoard } = require("../modules/money/supplier-invoices.ts");

function snapshot() {
  return { organizationId: "org-1", organizationSlug: "rontil", now: new Date("2026-09-12T01:00:00Z"),
    documents: [{ id: "doc-1", organization_id: "org-1", party_id: "party-1", current_draft_id: "draft-1", direction: "purchase", status: "needs_review", document_type: "purchase_invoice", document_date: "2026-09-11" }],
    drafts: [{ id: "draft-1", organization_id: "org-1", document_id: "doc-1", document_role: "purchase", document_type: "purchase_invoice", status: "open", intake_context_json: {},
      fields_json: { facts: { issuer_tax_id: "220918880014", issuer_name: "Proveedor", series: "A", document_number: "200", document_date: "2026-09-11", due_date: "2026-09-11", currency_code: "UYU", subtotal: 565.57, tax_amount: 124.43, total_amount: 690 } } }],
    parties: [{ id: "party-1", organization_id: "org-1", display_name: "Proveedor", tax_id_normalized: "220918880014" }],
    openItems: [], contexts: [], emailSources: [], exportAttempts: [] };
}
function ledger(patch = {}) {
  return { id: "ledger-1", organization_id: "org-1", party_id: "party-1", source_document_id: "doc-1", document_role: "purchase", document_type: "purchase_invoice",
    counterparty_type: "vendor", currency_code: "UYU", original_amount: "690.00", settled_amount: "100.00", outstanding_amount: "590.00", status: "partially_settled",
    metadata: { kind: "payable" }, issue_date: "2026-09-11", due_date: "2026-09-20", updated_at: "2026-09-11T19:00:00Z", ...patch };
}
function paidAttempt() {
  const fingerprint = `sha256:${createHash("sha256").update("220918880014|sin-tipo|A|200|2026-09-11|690|UYU").digest("hex")}`;
  const found = { RegistroId: "43141", ProveedorCodigo: "PR00155", Serie: "A", Numero: "200", Fecha: "2026-09-11", MonedaCodigo: 1,
    ComprobanteCodigo: 28, Total: "690.00", Subtotal: "565.57", IVA: "124.43", Saldo: "0.00" };
  return { id: "attempt-1", organization_id: "org-1", provider: "zetasoftware", entity_type: "purchase_expense_export_attempt", test_mode: false,
    external_key: "purchase_expense_invoice:doc-1", metadata_json: { status: "found_in_zeta" },
    payload_json: { document_id: "doc-1", status: "found_in_zeta", fiscal_fingerprint: fingerprint, recorded_at: "2026-09-11T19:22:13Z",
      request: { Data: { Movimiento: [{ CodigoProveedor: "PR00155", CodigoComprobante: 28, Serie: "A", Numero: 200, Fecha: "20260911", CodigoMoneda: 1 }] } },
      preview: { supplierRut: "220918880014", zetaSupplierCode: "PR00155", monedaCode: 1, lines: [{ totalAmount: 690, netAmount: 565.57, ivaAmount: 124.43 }] },
      response: { reconciliation: { registroId: "43141", queryCompras: { Response: [{ ...found, RegistroId: "42954", Total: "1005.00" }, found], IsLastPage: true } } } } };
}
const items = (board, kind) => board[kind].flatMap((group) => group.invoices);
const confirmedTotal = (board) => board.confirmed.flatMap((group) => group.totals).find((entry) => entry.currency === "UYU")?.amount;

test("review: canonical partially_settled ledger remains a confirmed partial supplier balance", () => {
  const data = snapshot(); data.openItems = [ledger()];
  const board = buildSupplierInvoicesBoard(data);
  assert.equal(confirmedTotal(board), "590.00"); assert.equal(board.excludedPaidCount, 0);
});

test("review: provider balance linked to a document without draft is not silently dropped", () => {
  const data = snapshot(); data.documents[0].current_draft_id = null; data.drafts = [];
  data.openItems = [ledger({ status: "open", settled_amount: "0.00", outstanding_amount: "690.00" })];
  const board = buildSupplierInvoicesBoard(data);
  assert.ok(items(board, "confirmed").length + items(board, "unconfirmed").length > 0, "An existing payable must remain visible even while its original lacks a draft");
});

test("review: standalone ledger with impossible balance cannot become confirmed debt", () => {
  const data = snapshot(); data.documents = []; data.drafts = [];
  data.openItems = [ledger({ source_document_id: null, status: "open", original_amount: "100.00", settled_amount: "0.00", outstanding_amount: "1000.00" })];
  const board = buildSupplierInvoicesBoard(data);
  assert.equal(items(board, "confirmed").length, 0);
  assert.ok(items(board, "unconfirmed").length > 0 || board.coverage.status !== "complete", "Corruption must stay visible as an unresolved item or incomplete coverage");
});

test("review: settled status with positive balance cannot become confirmed payable", () => {
  const data = snapshot(); data.openItems = [ledger({ status: "settled" })];
  const board = buildSupplierInvoicesBoard(data);
  assert.equal(items(board, "confirmed").length, 0); assert.equal(board.excludedPaidCount, 0);
});

test("review: the exact ERP record proves payment, not the first row of the supplier query", () => {
  const data = snapshot(); data.exportAttempts = [paidAttempt()];
  assert.equal(buildSupplierInvoicesBoard(data).excludedPaidCount, 1);
  data.exportAttempts[0].payload_json.response.reconciliation.queryCompras.Response[1].Saldo = "100.00";
  const board = buildSupplierInvoicesBoard(data);
  assert.equal(board.excludedPaidCount, 0); assert.equal(confirmedTotal(board), "100.00");
});

test("review: a mismatched current draft or different tenant cannot inherit payment evidence", () => {
  for (const change of [data => { data.drafts[0].fields_json.facts.currency_code = "USD"; },
    data => { data.exportAttempts[0].organization_id = "other-org"; }, data => { data.drafts[0].document_id = "other-document"; }]) {
    const data = snapshot(); data.exportAttempts = [paidAttempt()]; change(data);
    assert.equal(buildSupplierInvoicesBoard(data).excludedPaidCount, 0);
  }
});

test("review: ERP response with wrong VAT breakdown is not payment evidence for the reviewed invoice", () => {
  const data = snapshot(); data.exportAttempts = [paidAttempt()];
  const row = data.exportAttempts[0].payload_json.response.reconciliation.queryCompras.Response[1];
  row.Subtotal = "690.00"; row.IVA = "0.00";
  const board = buildSupplierInvoicesBoard(data);
  assert.equal(board.excludedPaidCount, 0); assert.equal(items(board, "unconfirmed").length, 1);
});

test("review: conflicting or malformed email source cannot hide a document as paid", () => {
  const valid = { id: "source-1", organization_id: "org-1", document_id: "doc-1", provider: "email_inbox", drift_status: "none",
    metadata_json: { differences_pending_review: false }, current_payload_hash: "a".repeat(64), payload_hash_at_materialization: "a".repeat(64) };
  for (const patch of [{ current_payload_hash: "b".repeat(64) }, { metadata_json: {} }, { current_payload_hash: "x", payload_hash_at_materialization: "x" }]) {
    const data = snapshot(); data.exportAttempts = [paidAttempt()]; data.emailSources = [{ ...valid, ...patch }];
    assert.equal(buildSupplierInvoicesBoard(data).excludedPaidCount, 0);
  }
});

test("review: clearing and partner ledger balances are not supplier debt", () => {
  for (const partner of [false, true]) {
    const data = snapshot(); data.openItems = [ledger({ status: "open", metadata: { kind: partner ? "payable" : "clearing" } })];
    if (partner) data.contexts = [{ organization_id: "org-1", document_id: "doc-1", draft_id: "draft-1", structured_context_json: { settlement_method: "paid_by_partner" } }];
    const board = buildSupplierInvoicesBoard(data);
    assert.equal(items(board, "confirmed").length, 0); assert.equal(items(board, "unconfirmed").length, 1);
  }
});

test("review: due today is not overdue at Uruguay midnight and currencies remain separate", () => {
  const data = snapshot(); data.documents.push({ ...data.documents[0], id: "doc-2", current_draft_id: "draft-2" });
  const draft = structuredClone(data.drafts[0]); draft.id = "draft-2"; draft.document_id = "doc-2";
  Object.assign(draft.fields_json.facts, { document_number: "201", currency_code: "USD", total_amount: "10.50", due_date: null }); data.drafts.push(draft);
  const board = buildSupplierInvoicesBoard(data);
  assert.equal(items(board, "unconfirmed").find(item => item.id === "doc-1").dueState, "due_soon");
  assert.equal(items(board, "unconfirmed").find(item => item.id === "doc-2").dueState, "no_due_date");
  assert.deepEqual(board.unconfirmed[0].totals, [{ currency: "USD", amount: "10.50" }, { currency: "UYU", amount: "690.00" }]);
});

function fakeReadOnly(data, failedTable) {
  const tables = { documents: data.documents, document_drafts: data.drafts, ledger_open_items: data.openItems, parties: data.parties,
    document_accounting_contexts: data.contexts, document_source_refs: data.emailSources, integration_raw_records: data.exportAttempts };
  return { from(table) {
    const filters = [];
    const query = { select() { return query; }, order() { return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      limit(n) { return query.range(0, n - 1); },
      async range(from, to) { return table === failedTable ? { data: null, error: { message: "fixture unavailable" } }
        : { data: (tables[table] ?? []).filter(row => filters.every(filter => filter(row))).slice(from, to + 1), error: null }; },
      insert() { assert.fail("Read-only board must not mutate"); }, update() { assert.fail("Read-only board must not mutate"); }, delete() { assert.fail("Read-only board must not mutate"); },
    }; return query;
  } };
}

test("review: missing source reads restore paid candidates to visible uncertainty", async () => {
  const data = snapshot(); data.exportAttempts = [paidAttempt()];
  const board = await loadSupplierInvoicesBoard(fakeReadOnly(data, "document_source_refs"), data);
  assert.equal(board.coverage.status, "partial"); assert.equal(board.excludedPaidCount, 0);
  assert.equal(items(board, "unconfirmed").length, 1);
});

test("review: partial coverage does not create duplicate group keys when merging uncertainty", async () => {
  const data = snapshot(); data.documents.push({ ...data.documents[0], id: "doc-2", current_draft_id: "draft-2" });
  const draft = structuredClone(data.drafts[0]); draft.id = "draft-2"; draft.document_id = "doc-2"; draft.fields_json.facts.document_number = "201"; data.drafts.push(draft);
  data.openItems = [ledger({ status: "open", settled_amount: "0.00", outstanding_amount: "690.00" })];
  const board = await loadSupplierInvoicesBoard(fakeReadOnly(data, "document_source_refs"), data);
  assert.equal(board.coverage.status, "partial");
  assert.equal(new Set(board.unconfirmed.map(group => group.id)).size, board.unconfirmed.length);
  assert.equal(items(board, "unconfirmed").length, 2);
});
