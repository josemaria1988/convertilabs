/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createFakeSupabase(options = {}) {
  let sequence = 0;
  const state = {
    organization_integration_connections: [{
      id: "conn-1",
      organization_id: "org-1",
      provider: "zetasoftware",
      status: "connected",
      mode: "read_write",
      test_mode: false,
      config_json: {
        purchase_expense_export: {
          documentTypes: {
            purchase_expense_credit: 11,
            purchase_expense_cash: 12,
            supplier_credit_note_expense: 13,
          },
          concepts: {
            default: "GASTOSVAR",
          },
          paymentTerms: {
            credit: "CR",
            cash: "CO",
          },
          paymentMethods: {
            cash: 1,
          },
          currencies: {
            UYU: 1,
          },
          defaults: {
            localCode: 1,
            userCode: 42,
            cashboxCode: 1,
          },
        },
      },
    }],
    integration_raw_records: [
      raw("contact", "PR0031", { Codigo: "PR0031", Nombre: "Los Delfines", RUT: "21.999.888.777", EsProveedor: "S" }),
      raw("supplier_commercial_data", "PR0031", { Codigo: "PR0031", IVA: "N" }),
      raw("document_type", "11", { Codigo: 11, Nombre: "Compra gasto credito", ComprobanteGastos: "S", Activo: "S", IVA: "N" }),
      raw("document_type", "12", { Codigo: 12, Nombre: "Compra gasto contado", ComprobanteGastos: "S", Activo: "S", IVA: "N" }),
      raw("document_type", "13", { Codigo: 13, Nombre: "Nota gasto", ComprobanteGastos: "S", Activo: "S", IVA: "N" }),
      raw("concept", "GASTOSVAR", { Codigo: "GASTOSVAR", Nombre: "Gastos varios", ConceptoActivo: "S" }),
      raw("vat_rate", "1", { Codigo: 1, Tasa: 22 }),
      raw("vat_rate", "2", { Codigo: 2, Tasa: 10 }),
      raw("payment_term", "CR", { Codigo: "CR", Nombre: "Credito", Activo: "S" }),
      raw("payment_term", "CO", { Codigo: "CO", Nombre: "Contado", Activo: "S" }),
      raw("payment_method", "1", { Codigo: 1, Nombre: "Efectivo", Activo: "S", RequiereCaja: "N" }),
      raw("currency", "1", { Codigo: 1, CodigoISO: "UYU" }),
      raw("business_location", "1", { Codigo: 1, Nombre: "Casa central", Activo: "S" }),
      raw("user_role", "42", { Codigo: 42, Nombre: "Usuario API", UsuarioEmail: "api@example.com" }),
      raw("cashbox", "1", { Codigo: 1, Nombre: "Caja principal", LocalCodigo: 1, LocalActivo: "S" }),
    ],
    documents: [{
      id: "doc-1",
      organization_id: "org-1",
      created_at: "2026-04-20T15:00:00.000Z",
      updated_at: "2026-04-20T15:00:00.000Z",
      document_date: "2026-04-20",
      current_draft_id: "draft-1",
      metadata: {},
    }],
    document_drafts: [{
      id: "draft-1",
      document_id: "doc-1",
      revision_number: 1,
      document_role: "purchase",
      document_type: "purchase_invoice",
      status: "open",
      operation_context_json: { operation_category_candidate: "admin_expense" },
      intake_context_json: {},
      fields_json: {
        facts: {
          issuer_name: "Los Delfines",
          issuer_tax_id: "21.999.888.777",
          issuer_address_raw: null,
          issuer_department: null,
          issuer_city: null,
          issuer_branch_code: null,
          merchant_category_hints: [],
          location_extraction_confidence: null,
          receiver_name: "Rontil",
          receiver_tax_id: "21.433.455.019",
          document_number: "123456",
          series: "A",
          currency_code: "UYU",
          document_date: "2026-04-20",
          due_date: "2026-05-20",
          subtotal: 1000,
          tax_amount: 220,
          total_amount: 1220,
          purchase_category_candidate: "admin_expense",
          sale_category_candidate: null,
        },
        line_items: [{
          line_number: 1,
          concept_code: null,
          concept_description: "Gasto",
          quantity: 1,
          unit_amount: 1000,
          net_amount: 1000,
          tax_rate: 22,
          tax_amount: 220,
          total_amount: 1220,
        }],
        amount_breakdown: [],
      },
      journal_suggestion_json: {
        templateCode: "purchase_expense_credit.v1",
        currencyCode: "UYU",
      },
    }],
    document_accounting_contexts: [{
      draft_id: "draft-1",
      structured_context_json: {
        payment_terms: "credit",
        settlement_method: "unknown",
        zeta_purchase_expense_concept_code: "GASTOSVAR",
        zeta_purchase_expense_payment_term_code: "CR",
      },
    }],
    document_source_refs: [{
      document_id: "doc-1",
      provider: "zetasoftware",
      source_kind: "zeta_received_cfe",
    }],
    document_draft_steps: [{
      draft_id: "draft-1",
      step_code: "identity",
      status: "confirmed",
    }],
    audit_log: [],
  };

  if (options.purchaseSnapshot !== false) {
    const { reportHash } = require("@/modules/integrations/zeta/cache/report-contracts");
    const rows = options.purchaseRows ?? [];
    const columns = [...new Set(rows.flatMap(Object.keys))];
    const filters = { FechaDesde: "2026-04-01", FechaHasta: "2026-04-30" };
    const timestamp = new Date(Date.now() - (options.cacheAgeMs ?? 1_000)).toISOString();
    const snapshotKey = reportHash({ report: "purchases", filters }).slice(0, 32);
    const manifest = {
      report: "purchases", filters, endpoint: "RESTFacturaProveedorV1ComprasDetalladas",
      startedAt: timestamp, completedAt: timestamp, pages: 1, columns,
      snapshotKey, cachePages: 1, rowCount: rows.length,
      sha256: reportHash({ columns, rows }), complete: true,
      incremental: {
        strategy: "replace_queried_window_and_upsert_ids", sourceDateField: "Fecha",
        previousRunId: null, previousDataAsOf: null,
        deltaFetchedFrom: filters.FechaDesde, deltaFetchedTo: filters.FechaHasta,
        fetchedFilters: filters, previousRowCount: 0, fetchedRowCount: rows.length,
        insertedRows: rows.length, updatedRows: 0, unchangedRows: 0, removedRows: 0,
        historicalEditsOutsideDeltaCovered: false,
      },
    };
    state.integration_sync_runs = [{ id: "cache-run-1", organization_id: "org-1", provider: "zetasoftware",
      stream: "zeta.daily_cache", test_mode: false, status: "completed", started_at: timestamp,
      finished_at: timestamp, summary_json: { schemaVersion: 1, reports: [manifest] }, metadata_json: {} }];
    const payload = { rows };
    state.integration_raw_records.push({ id: "cache-page-1", organization_id: "org-1", provider: "zetasoftware",
      entity_type: "report_snapshot_page", last_sync_run_id: "cache-run-1", test_mode: false,
      external_key: `cache-run-1:${snapshotKey}:000001`, payload_json: payload, payload_hash: reportHash(payload),
      metadata_json: { snapshotKey, page: 1, report: "purchases" } });
  }

  function raw(entityType, externalKey, row) {
    return {
      id: `raw-${entityType}-${externalKey}`,
      organization_id: "org-1",
      provider: "zetasoftware",
      entity_type: entityType,
      external_key: externalKey,
      test_mode: false,
      payload_json: { row },
      metadata_json: {},
    };
  }

  class Builder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.payload = null;
      this.limitCount = null;
      this.rangeFrom = null;
      this.rangeTo = null;
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    like(field, pattern) {
      assert.equal(pattern, "purchase_expense_invoice:sha256:%");
      this.filters.push({ field, prefix: pattern.slice(0, -1) });
      return this;
    }

    order() {
      return this;
    }

    limit(value) {
      this.limitCount = value;
      return this;
    }

    range(from, to) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    maybeSingle() {
      const rows = this.filterRows();
      return Promise.resolve({ data: rows[0] || null, error: null });
    }

    single() {
      const result = this.execute();
      return Promise.resolve({
        data: Array.isArray(result.data) ? result.data[0] || null : result.data,
        error: result.error,
      });
    }

    insert(payload) {
      const rows = Array.isArray(payload) ? payload : [payload];

      if (this.table === "audit_log" && options.failPriceReviewAudit) {
        return Promise.resolve({ data: null, error: { message: "Test audit unavailable" } });
      }

      if (this.table === "integration_raw_records") {
        const pendingKeys = new Set();
        const duplicate = rows.some((row) => {
          const key = [
            row.organization_id,
            row.provider,
            row.entity_type,
            row.external_key,
          ].join("|");
          const alreadyStored = state[this.table].some((candidate) =>
            candidate.organization_id === row.organization_id
            && candidate.provider === row.provider
            && candidate.entity_type === row.entity_type
            && candidate.external_key === row.external_key);
          const alreadyPending = pendingKeys.has(key);
          pendingKeys.add(key);
          return alreadyStored || alreadyPending;
        });

        if (duplicate) {
          return Promise.resolve({
            data: null,
            error: {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            },
          });
        }
      }

      for (const row of rows) {
        state[this.table].push({ id: row.id || `${this.table}-${++sequence}`, ...row });
      }
      return Promise.resolve({ data: null, error: null });
    }

    update(payload) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload) {
      this.operation = "upsert";
      this.payload = payload;
      return this;
    }

    then(resolve, reject) {
      try {
        resolve(this.execute());
      } catch (error) {
        reject(error);
      }
    }

    execute() {
      if (this.table === "document_source_refs" && options.failEmailSourceRead
        && this.filters.some((entry) => entry.field === "provider" && entry.value === "email_inbox")) {
        return { data: null, error: { message: "private source read failure" } };
      }
      if (this.operation === "update") {
        if (this.table === "documents" && options.failPriceReviewCas && this.payload.metadata?.zeta_purchase_price_input_review) {
          return { data: [], error: null };
        }
        const rows = this.filterRows();
        for (const row of rows) {
          Object.assign(row, this.payload);
        }
        return { data: rows, error: null };
      }

      if (this.operation === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];

        if (
          options.failExportAttemptUpsert
          && rows.some((row) => row.entity_type === "purchase_expense_export_attempt")
        ) {
          return {
            data: null,
            error: {
              code: "TEST_POST_ADD_PERSISTENCE_FAILURE",
              message: "fallo de persistencia posterior a Agregar",
            },
          };
        }

        const saved = [];
        for (const row of rows) {
          const existing = state[this.table].find((candidate) =>
            candidate.organization_id === row.organization_id
            && candidate.provider === row.provider
            && candidate.entity_type === row.entity_type
            && candidate.external_key === row.external_key);
          if (existing) {
            Object.assign(existing, row);
            saved.push(existing);
          } else {
            const inserted = { id: `${this.table}-${++sequence}`, ...row };
            state[this.table].push(inserted);
            saved.push(inserted);
          }
        }
        return { data: saved, error: null };
      }

      let rows = this.filterRows();
      if (this.rangeFrom !== null && this.rangeTo !== null) {
        rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
      }
      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount);
      }
      return { data: rows, error: null };
    }

    filterRows() {
      return (state[this.table] || []).filter((row) =>
        this.filters.every((filter) => {
          const [column, jsonKey] = filter.field.split("->>");
          const value = jsonKey ? row[column]?.[jsonKey] : row[column];
          return filter.prefix ? typeof value === "string" && value.startsWith(filter.prefix) : value === filter.value;
        }));
    }
  }

  return {
    state,
    from(table) {
      if (!state[table]) {
        state[table] = [];
      }
      return new Builder(table);
    },
  };
}

function zetaClient(fetchImpl) {
  const { createZetaRestClient } = require("@/modules/integrations/zeta/client/rest-client");
  const { createHumanExportZetaRequestPolicy } = require("@/modules/integrations/zeta/client/read-policy");
  return createZetaRestClient({
    organizationId: "org-1",
    requestPolicy: createHumanExportZetaRequestPolicy("org-1"),
    baseUrl: "https://api.zeta.example",
    credentials: {
      DesarrolladorCodigo: "dev",
      DesarrolladorClave: "secret",
      EmpresaCodigo: "emp",
      EmpresaClave: "secret",
      UsuarioCodigo: 1,
      UsuarioClave: "",
      RolCodigo: 2,
    },
    fetchImpl,
  });
}

const PRICE_REVIEW_ACTOR = "11111111-1111-4111-8111-111111111111";
function priceReviewFixture(options = {}) {
  const supabase = createFakeSupabase(options);
  supabase.state.organization_members = [{ organization_id: "org-1", user_id: PRICE_REVIEW_ACTOR, role: "owner", is_active: true }];
  supabase.state.integration_raw_records.find((row) => row.entity_type === "supplier_commercial_data").payload_json.row.IVA = "M";
  supabase.state.documents[0].metadata = { preserved: "unchanged" };
  return supabase;
}
function priceReviewParams(extra = {}) {
  return { organizationId: "org-1", documentId: "doc-1", actorProfileId: PRICE_REVIEW_ACTOR,
    expectedDraftId: "draft-1", description: "Comida", unitPrice: 1220, dryRun: true, ...extra };
}

test("envio con precio bruto verifica desglose y pending no se valida solo por total en copia", async () => {
  const { confirmZetaPurchaseExpensePriceInputReview, exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const expectedNet of [1000, 900, null]) {
    const supabase = priceReviewFixture();
    const prepared = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams(), { supabase });
    await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams({ dryRun: false, humanConfirmed: true,
      expectedScopeFingerprint: prepared.review.scopeFingerprint }), { supabase });
    let queryCount = 0, addCount = 0;
    const client = zetaClient(async (url, init) => {
      if (url.endsWith("RESTFacturaProveedorV1Agregar")) {
        addCount++;
        const line = JSON.parse(init.body).AgregarIn.Data.Movimiento.Lineas[0];
        assert.equal(line.PrecioUnitario, 1220);
        assert.equal(line.Cantidad, 1);
        assert.equal(line.Concepto, "Comida");
        return { ok: true, status: 200, statusText: "OK", json: async () => ({ AgregarOut: { Succeed: true, Response: { Succeed: true }, Error: null } }) };
      }
      assert.ok(url.endsWith("RESTFacturaProveedorV1QueryCompras"));
      queryCount++;
      const row = { RegistroId: 777, ComprobanteCodigo: 11, Serie: "A", Numero: 123456, Fecha: "2026-04-20", MonedaCodigo: 1, ProveedorCodigo: "PR0031", Total: 1220,
        ...(expectedNet === null ? {} : { Subtotal: expectedNet, IVA: 1220 - expectedNet }) };
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ QueryComprasOut: { Succeed: true, Response: queryCount === 1 ? [] : [row], IsLastPage: true, Error: null } }) };
    });
    const params = { organizationId: "org-1", documentId: "doc-1", actorProfileId: PRICE_REVIEW_ACTOR, humanConfirmed: true };
    const result = await exportPurchaseExpenseInvoiceToZeta(params, { supabase, client });
    assert.equal(addCount, 1);
    assert.equal(result.status, expectedNet === 1000 ? "found_in_zeta" : "success_pending_reconciliation");
    assert.equal(result.zetaResponse.reconciliation.status, expectedNet === 1000 ? "found_in_zeta" : "amount_mismatch");
    if (expectedNet !== 1000) {
      const updatedCache = createFakeSupabase({ purchaseRows: monthlyPurchaseRows() });
      supabase.state.integration_sync_runs = updatedCache.state.integration_sync_runs;
      supabase.state.integration_raw_records = supabase.state.integration_raw_records.filter(row => row.entity_type !== "report_snapshot_page")
        .concat(updatedCache.state.integration_raw_records.filter(row => row.entity_type === "report_snapshot_page"));
      const before = structuredClone(supabase.state);
      const countBefore = queryCount;
      const pending = await exportPurchaseExpenseInvoiceToZeta({ ...params, dryRun: true }, { supabase, client });
      assert.equal(pending.preview.cacheReconciliation.status, "already_in_erp");
      assert.equal(pending.status, "success_pending_reconciliation");
      assert.equal(queryCount, countBefore);
      assert.deepEqual(supabase.state, before);
      const rechecked = await exportPurchaseExpenseInvoiceToZeta(params, { supabase, client });
      assert.equal(rechecked.status, "success_pending_reconciliation");
      assert.equal(rechecked.zetaResponse.reconciliation.status, "amount_mismatch");
      assert.equal(addCount, 1);
    }
  }
});

test("confirmacion IVA incluido guarda decision puntual y preserva extraccion, configuracion y reservas", async () => {
  const { confirmZetaPurchaseExpensePriceInputReview } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = priceReviewFixture();
  const before = structuredClone(supabase.state);
  const prepared = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams(), { supabase });
  assert.equal(prepared.saved, false);
  assert.deepEqual(supabase.state, before);
  assert.equal(prepared.payload.Data.Movimiento[0].Lineas[0].PrecioUnitario, 1220);
  assert.equal(prepared.payload.Data.Movimiento[0].Lineas[0].Concepto, "Comida");
  const saved = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams({ dryRun: false, humanConfirmed: true,
    expectedScopeFingerprint: prepared.review.scopeFingerprint }), { supabase });
  assert.equal(saved.saved, true);
  assert.equal(supabase.state.documents[0].metadata.preserved, "unchanged");
  assert.deepEqual(supabase.state.documents[0].metadata.zeta_purchase_price_input_review, saved.review);
  assert.deepEqual(supabase.state.document_drafts, before.document_drafts);
  assert.deepEqual(supabase.state.organization_integration_connections, before.organization_integration_connections);
  assert.deepEqual(supabase.state.integration_raw_records, before.integration_raw_records);
  assert.equal(supabase.state.audit_log.length, 1);
  const ready = await exportReady(supabase);
  assert.equal(ready.exportable, true);
  assert.equal(ready.preview.lines[0].unitPrice, 1220);
  assert.equal(ready.preview.lines[0].netAmount, 1000);
  assert.equal(ready.preview.lines[0].ivaAmount, 220);
  const reviewBefore = structuredClone(saved.review);
  supabase.state.document_drafts[0].fields_json.line_items[0].concept_description = "Otro contenido";
  const stale = await exportReady(supabase);
  assert.equal(stale.exportable, false);
  assert.equal(stale.payload, null);
  assert.deepEqual(supabase.state.documents[0].metadata.zeta_purchase_price_input_review, reviewBefore);
});

test("confirmacion IVA incluido rechaza actor, consentimiento, draft o alcance distintos sin activar review", async () => {
  const { confirmZetaPurchaseExpensePriceInputReview } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const scenario of ["role", "tenant", "consent", "draft", "fingerprint", "price", "previous_claim"]) {
    const supabase = priceReviewFixture();
    const params = priceReviewParams({ dryRun: false, humanConfirmed: true });
    const prepared = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams(), { supabase });
    params.expectedScopeFingerprint = prepared.review.scopeFingerprint;
    if (scenario === "role") supabase.state.organization_members[0].role = "viewer";
    if (scenario === "tenant") params.organizationId = "other-org";
    if (scenario === "consent") params.humanConfirmed = false;
    if (scenario === "draft") params.expectedDraftId = "other-draft";
    if (scenario === "fingerprint") params.expectedScopeFingerprint = "stale";
    if (scenario === "price") params.unitPrice = 1000;
    if (scenario === "previous_claim") supabase.state.integration_raw_records.push({ id: "prior-reservation", organization_id: "org-1", provider: "zetasoftware",
      entity_type: "purchase_expense_export_claim", external_key: "reserved", payload_json: { document_id: "doc-1" }, metadata_json: {} });
    const before = structuredClone(supabase.state);
    await assert.rejects(() => confirmZetaPurchaseExpensePriceInputReview(params, { supabase }));
    assert.deepEqual(supabase.state, before, scenario);
  }
});

test("fallos de auditoria o CAS dejan confirmacion de precio inactiva", async () => {
  const { confirmZetaPurchaseExpensePriceInputReview } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const option of ["failPriceReviewAudit", "failPriceReviewCas"]) {
    const supabase = priceReviewFixture({ [option]: true });
    const prepared = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams(), { supabase });
    const documentBefore = structuredClone(supabase.state.documents);
    await assert.rejects(() => confirmZetaPurchaseExpensePriceInputReview(priceReviewParams({ dryRun: false, humanConfirmed: true,
      expectedScopeFingerprint: prepared.review.scopeFingerprint }), { supabase }));
    assert.deepEqual(supabase.state.documents, documentBefore);
    assert.equal(supabase.state.audit_log.length, option === "failPriceReviewCas" ? 1 : 0);
    assert.equal((await exportReady(supabase)).exportable, false);
  }
});

test("precio confirmado no evita espera de copia mensual ni produce HTTP con cache antigua", async () => {
  const { confirmZetaPurchaseExpensePriceInputReview, exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = priceReviewFixture({ cacheAgeMs: 2 * 86400000 });
  const prepared = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams(), { supabase });
  await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams({ dryRun: false, humanConfirmed: true,
    expectedScopeFingerprint: prepared.review.scopeFingerprint }), { supabase });
  let calls = 0;
  const client = zetaClient(async () => { calls++; throw new Error("No HTTP with stale cache"); });
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1", actorProfileId: PRICE_REVIEW_ACTOR,
    dryRun: true, humanConfirmed: true }, { supabase, client });
  assert.equal(result.status, "waiting_for_sync");
  assert.equal(result.exportable, false);
  assert.equal(result.preview.lines[0].unitPrice, 1220);
  assert.equal(calls, 0);
  assert.equal(supabase.state.integration_raw_records.some(r => r.entity_type === "purchase_expense_export_claim"), false);
});

function monthlyPurchaseRows(total = 1220) {
  const { groupZetaPurchaseDetailRows } = require("@/modules/integrations/zeta/sync/daily-sync");
  return groupZetaPurchaseDetailRows([{
    FacturaId: 991, FacturaAnio: 2026, FacturaMes: 4, FacturaDia: 20,
    FacturaSerie: "A", FacturaNumero: 123456, ComprobanteCodigo: 11,
    ProveedorCodigo: "PR0031", MonedaCodigo: 1, FacturaSigno: 1,
    LineaSubtotal: total - 220, LineaIVA: 220, LineaTotal: total,
  }], "2026-04", "2026-04-30");
}

function addDocumentCopy(supabase, documentId, facts = {}) {
  const draftId = `${documentId}-draft`;
  supabase.state.documents.push({ ...structuredClone(supabase.state.documents[0]), id: documentId, current_draft_id: draftId });
  const draft = structuredClone(supabase.state.document_drafts[0]);
  Object.assign(draft, { id: draftId, document_id: documentId });
  Object.assign(draft.fields_json.facts, facts);
  supabase.state.document_drafts.push(draft);
  supabase.state.document_accounting_contexts.push({ ...structuredClone(supabase.state.document_accounting_contexts[0]), draft_id: draftId });
  supabase.state.document_draft_steps.push({ draft_id: draftId, step_code: "identity", status: "confirmed" });
  return draft;
}

async function exportReady(supabase, documentId = "doc-1") {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  return exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId, actorProfileId: "user-1", dryRun: true }, { supabase });
}

function seedLegacyClaim(supabase, ready, options = {}) {
  const documentId = options.documentId ?? ready.documentId;
  const fingerprint = options.fingerprint ?? ready.fiscalFingerprint;
  const claim = { id: `legacy-${documentId}`, organization_id: "org-1", provider: "zetasoftware",
    entity_type: "purchase_expense_export_claim", external_key: `purchase_expense_invoice:${fingerprint}`,
    payload_json: { document_id: documentId, fiscal_fingerprint: fingerprint }, metadata_json: {} };
  supabase.state.integration_raw_records.push(claim);
  if (options.attempt) supabase.state.integration_raw_records.push({
    id: `legacy-attempt-${documentId}`, organization_id: "org-1", provider: "zetasoftware",
    entity_type: "purchase_expense_export_attempt", external_key: `purchase_expense_invoice:${documentId}`,
    payload_json: { fiscal_fingerprint: fingerprint, request: ready.payload, preview: ready.preview },
    metadata_json: { status: "zeta_error" },
  });
  return claim;
}

function successfulEmptyClient(calls) {
  return zetaClient(async (url) => {
    calls.push(url);
    return { ok: true, status: 200, statusText: "OK", json: async () =>
      url.endsWith("RESTFacturaProveedorV1QueryCompras")
        ? { QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }
        : { AgregarOut: { Succeed: true, Response: { Succeed: true, Mensaje: "OK" }, Error: null } } };
  });
}

const matchingEmailSource = (extra = {}) => ({ id: "email-source", organization_id: "org-1", document_id: "doc-1",
  provider: "email_inbox", source_kind: "cfe_xml_email", drift_status: "none",
  metadata_json: { differences_pending_review: false }, current_payload_hash: "a".repeat(64), payload_hash_at_materialization: "a".repeat(64), ...extra });

test("XML igual conserva payload y confirmacion puntual de IVA previamente aprobada", async () => {
  const { confirmZetaPurchaseExpensePriceInputReview } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = priceReviewFixture();
  const prepared = await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams(), { supabase });
  await confirmZetaPurchaseExpensePriceInputReview(priceReviewParams({ dryRun: false, humanConfirmed: true,
    expectedScopeFingerprint: prepared.review.scopeFingerprint }), { supabase });
  const before = await exportReady(supabase);
  const document = structuredClone(supabase.state.documents), draft = structuredClone(supabase.state.document_drafts);
  supabase.state.document_source_refs.push(matchingEmailSource(),
    matchingEmailSource({ id: "foreign-source", organization_id: "another-org", drift_status: "source_changed_pending_review" }),
    matchingEmailSource({ id: "another-document", document_id: "doc-other", drift_status: "source_changed_pending_review" }));
  const after = await exportReady(supabase);
  assert.equal(after.exportable, true); assert.deepEqual(after.payload, before.payload);
  assert.deepEqual(after.preview.priceInputReview, before.preview.priceInputReview);
  assert.equal(after.fiscalFingerprint, before.fiscalFingerprint);
  assert.deepEqual(supabase.state.documents, document); assert.deepEqual(supabase.state.document_drafts, draft);
});

test("fuente email discordante o incompleta bloquea antes de consultas Zeta y reservas", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const patch of [{ drift_status: "source_changed_pending_review" }, { metadata_json: { differences_pending_review: true } },
    { current_payload_hash: "b".repeat(64) }, { current_payload_hash: null },
    { current_payload_hash: "x", payload_hash_at_materialization: "x" }, { metadata_json: {} },
    { metadata_json: { differences_pending_review: "false" } }]) {
    const supabase = createFakeSupabase(); supabase.state.document_source_refs.push(matchingEmailSource(patch));
    const before = structuredClone(supabase.state); let calls = 0;
    const client = zetaClient(async () => { calls++; throw new Error("No preflight or Agregar expected"); });
    for (const dryRun of [true, false]) {
      const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
        actorProfileId: "user-1", humanConfirmed: true, dryRun }, { supabase, client });
      assert.equal(result.status, "blocked"); assert.equal(result.exportable, false); assert.equal(result.payload, null);
      assert.ok(result.blockers.some((entry) => entry.code.startsWith("zeta_email_source_review_")));
    }
    assert.equal(calls, 0); assert.deepEqual(supabase.state, before);
  }
});

test("lectura incompleta de fuentes falla cerrada y el guard revisa tambien la segunda pagina", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const failEmailSourceRead of [true, false]) {
    const supabase = createFakeSupabase({ failEmailSourceRead });
    if (!failEmailSourceRead) {
      for (let i = 0; i < 200; i++) supabase.state.document_source_refs.push(matchingEmailSource({ id: `source-${i}` }));
      supabase.state.document_source_refs.push(matchingEmailSource({ id: "last-source", metadata_json: { differences_pending_review: true } }));
    }
    let calls = 0;
    const client = zetaClient(async () => { calls++; throw new Error("No ERP calls"); });
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true }, { supabase, client });
    assert.equal(result.status, "blocked"); assert.equal(calls, 0);
    assert.ok(result.blockers.some((entry) => entry.code === (failEmailSourceRead ? "zeta_email_source_review_unavailable" : "zeta_email_source_review_pending")));
  }
});

test("XML discordante recibido durante preflight impide Agregar sin adquirir una reserva", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase(); let calls = 0;
  const client = zetaClient(async (url) => {
    calls++; assert.ok(url.endsWith("RESTFacturaProveedorV1QueryCompras"));
    supabase.state.document_source_refs.push(matchingEmailSource({ drift_status: "source_changed_pending_review" }));
    return { ok: true, status: 200, json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true } }) };
  });
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
    actorProfileId: "user-1", humanConfirmed: true }, { supabase, client });
  assert.equal(result.status, "blocked"); assert.equal(calls, 1);
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_email_source_review_pending"));
  assert.equal(supabase.state.integration_raw_records.some((row) => row.entity_type === "purchase_expense_export_claim"), false);
});

test("IVA incluido bloquea dry-run y envio confirmado antes de HTTP o reservas", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  supabase.state.integration_raw_records.find((row) => row.entity_type === "supplier_commercial_data").payload_json.row.IVA = "M";
  const before = JSON.stringify(supabase.state);
  let calls = 0;
  const client = zetaClient(async () => { calls++; throw new Error("No debe consultar Zeta."); });
  for (const dryRun of [true, false]) {
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true, dryRun }, { supabase, client });
    assert.equal(result.exportable, false);
    assert.equal(result.payload, null);
    assert.ok(result.blockers.some((entry) => entry.code === "zeta_purchase_price_vat_included_unverified"));
    assert.equal(result.preview.lines[0].netAmount, 1000);
    assert.equal(result.preview.lines[0].ivaAmount, 220);
    assert.equal(result.preview.lines[0].totalAmount, 1220);
    if (dryRun) assert.equal(JSON.stringify(supabase.state), before);
  }
  assert.equal(calls, 0);
  assert.equal(supabase.state.integration_raw_records.some((row) => row.entity_type === "purchase_expense_export_claim"), false);
  const attempt = supabase.state.integration_raw_records.find((row) => row.entity_type === "purchase_expense_export_attempt");
  assert.equal(attempt.metadata_json.status, "blocked");
  assert.equal(attempt.payload_json.request, null);
});

test("servicio no proyecta codigo local ni external_code generico como centro ERP", async () => {
  for (const metadata of [{}, { external_code: "OTHER-ERP" }, { zeta_cost_center_code: "Z01" }, { zeta_centro_costo_codigo: "Z02" }, { cost_center_external_code: "Z03" }]) {
    const supabase = createFakeSupabase();
    supabase.state.documents[0].work_unit_id = "work-1";
    supabase.state.work_units = [{ id: "work-1", organization_id: "org-1", code: "LOCAL-NP", name: "Servicio NP", metadata_json: metadata }];
    const result = await exportReady(supabase);
    const expected = metadata.zeta_cost_center_code ?? metadata.zeta_centro_costo_codigo ?? metadata.cost_center_external_code;
    assert.equal(result.exportable, true);
    assert.equal(result.preview.workUnitName, "Servicio NP");
    assert.equal(result.payload.Data.Movimiento[0].CodigoCentroCosto, expected);
    assert.equal(supabase.state.documents[0].work_unit_id, "work-1");
  }
});

test("totales confirmados de comida con varios items usan nombre del concepto conservando detalle", async () => {
  const supabase = createFakeSupabase();
  const fields = supabase.state.document_drafts[0].fields_json;
  Object.assign(fields.facts, { subtotal: 318.03, tax_amount: 69.97, total_amount: 388 });
  fields.line_items = [
    { line_number: 1, concept_description: "COCA COLA ZERO 600ML", net_amount: null, tax_rate: null, tax_amount: null, total_amount: 65 },
    { line_number: 2, concept_description: "AGUA NATIVA", net_amount: null, tax_rate: null, tax_amount: null, total_amount: 83 },
    { line_number: 3, concept_description: "EMPANADAS", net_amount: null, tax_rate: null, tax_amount: null, total_amount: 220 },
  ];
  supabase.state.integration_raw_records.find((row) => row.entity_type === "concept").payload_json.row.Nombre = "Gastos de comidas";
  const originalLines = structuredClone(fields.line_items);
  const result = await exportReady(supabase);
  assert.equal(result.exportable, true);
  assert.equal(result.payload.Data.Movimiento[0].Lineas[0].Concepto, "Gastos de comidas");
  assert.equal(result.preview.lines[0].netAmount, 318.03);
  assert.equal(result.preview.lines[0].totalAmount, 388);
  assert.deepEqual(fields.line_items, originalLines);
});

test("dos fotos con misma identidad y distinto importe fecha moneda y tipo reservan un solo envio", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const copy = addDocumentCopy(supabase, "doc-2", { document_date: "2026-04-21", subtotal: 2000, tax_amount: 440, total_amount: 2440, currency_code: "USD", document_number: "000123456", series: " a " });
  copy.intake_context_json.cfe_type_code = "112";
  copy.journal_suggestion_json.fxRate = 40;
  supabase.state.organization_integration_connections[0].config_json.purchase_expense_export.currencies.USD = 2;
  supabase.state.integration_raw_records.push({ ...structuredClone(supabase.state.integration_raw_records.find((row) => row.entity_type === "currency")), id: "usd", external_key: "2", payload_json: { row: { Codigo: 2, CodigoISO: "USD" } } });
  const calls = [], client = successfulEmptyClient(calls);
  const results = await Promise.all(["doc-1", "doc-2"].map((documentId) => exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1", documentId, actorProfileId: "user-1", humanConfirmed: true,
  }, { supabase, client })));
  assert.notEqual(results[0].fiscalFingerprint, results[1].fiscalFingerprint);
  assert.deepEqual(results[0].fiscalIdentity, results[1].fiscalIdentity);
  assert.equal(calls.filter((url) => url.endsWith("RESTFacturaProveedorV1Agregar")).length, 1);
  assert.equal(results.filter((result) => result.status === "success_pending_reconciliation").length, 1);
  assert.equal(results.filter((result) => result.blockers.some((b) => b.code === "zeta_export_claim_already_exists")).length, 1);
  const claims = supabase.state.integration_raw_records.filter((row) => row.entity_type === "purchase_expense_export_claim");
  assert.equal(claims.length, 1);
  assert.deepEqual(claims[0].payload_json.fiscal_identity, results[0].fiscalIdentity);
});

test("claim legacy bloquea otra foto corregida desde intento guardado o documento sin cambios", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const attempt of [false, true]) {
    const supabase = createFakeSupabase(), ready = await exportReady(supabase);
    seedLegacyClaim(supabase, ready, { attempt });
    addDocumentCopy(supabase, "doc-2", { document_date: "2026-04-21", subtotal: 2000, tax_amount: 440, total_amount: 2440 });
    if (attempt) supabase.state.document_drafts[0].fields_json.facts.document_number = "999999";
    const before = structuredClone(supabase.state), calls = [];
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-2", actorProfileId: "user-1", humanConfirmed: true }, { supabase, client: successfulEmptyClient(calls) });
    assert.equal(result.status, "blocked");
    assert.ok(result.blockers.some((b) => b.code === "zeta_export_claim_already_exists"));
    assert.equal(calls.length, 0);
    assert.deepEqual(supabase.state, before);
  }
});

test("claim legacy no identificable bloquea sin HTTP ni liberar aunque cambie el documento", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase(), ready = await exportReady(supabase);
  seedLegacyClaim(supabase, ready);
  addDocumentCopy(supabase, "doc-2", { document_number: "777777" });
  supabase.state.document_drafts[0].fields_json.facts.document_number = "999999";
  const calls = [];
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-2", actorProfileId: "user-1", humanConfirmed: true }, { supabase, client: successfulEmptyClient(calls) });
  assert.ok(result.blockers.some((b) => b.code === "zeta_export_legacy_claim_unresolved"));
  assert.equal(calls.length, 0);
  assert.equal(supabase.state.integration_raw_records.filter((r) => r.entity_type === "purchase_expense_export_claim").length, 1);
});

test("claim legacy del mismo documento sobrevive a correcciones de identidad", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase(), ready = await exportReady(supabase);
  seedLegacyClaim(supabase, ready);
  supabase.state.document_drafts[0].fields_json.facts.document_number = "999999";
  const calls = [];
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1", humanConfirmed: true }, { supabase, client: successfulEmptyClient(calls) });
  assert.ok(result.blockers.some((b) => b.code === "zeta_export_claim_already_exists"));
  assert.equal(calls.length, 0);
});

test("claim legacy de otra organizacion no bloquea ni se utiliza para inferir identidad", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase(), ready = await exportReady(supabase);
  seedLegacyClaim(supabase, ready).organization_id = "org-other";
  const calls = [];
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1", humanConfirmed: true }, { supabase, client: successfulEmptyClient(calls) });
  assert.equal(result.status, "success_pending_reconciliation");
  assert.equal(calls.filter((url) => url.endsWith("RESTFacturaProveedorV1Agregar")).length, 1);
});

test("claim legacy identificado de otro comprobante permite nueva identidad sin reescribirlo", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase(), ready = await exportReady(supabase);
  const claim = seedLegacyClaim(supabase, ready), original = structuredClone(claim);
  addDocumentCopy(supabase, "doc-2", { document_number: "777777" });
  const calls = [];
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-2", actorProfileId: "user-1", humanConfirmed: true }, { supabase, client: successfulEmptyClient(calls) });
  assert.equal(result.status, "success_pending_reconciliation");
  assert.equal(calls.filter((url) => url.endsWith("RESTFacturaProveedorV1Agregar")).length, 1);
  assert.deepEqual(claim, original);
});

test("compatibilidad legacy recorre paginas y encuentra identidad reservada despues de 500 filas", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase(), ready = await exportReady(supabase);
  const { createHash } = require("node:crypto");
  for (let i = 0; i < 501; i += 1) {
    const stored = structuredClone(ready);
    stored.payload.Data.Movimiento[0].Numero = i === 500 ? 123456 : 700000 + i;
    seedLegacyClaim(supabase, stored, { documentId: `legacy-source-${i}`, fingerprint: `sha256:${createHash("sha256").update(String(i)).digest("hex")}`, attempt: true });
  }
  const calls = [];
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1", humanConfirmed: true }, { supabase, client: successfulEmptyClient(calls) });
  assert.ok(result.blockers.some((b) => b.code === "zeta_export_claim_already_exists"));
  assert.equal(result.attemptRawRecordId, "legacy-legacy-source-500");
  assert.equal(calls.length, 0);
});

test("sin copia mensual ambas validacion y envio esperan sin HTTP ni escrituras", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase({ purchaseSnapshot: false });
  // Register the empty table up front so read-only builder initialization is not a mutation assertion.
  supabase.state.integration_sync_runs = [];
  const before = JSON.stringify(supabase.state);
  let calls = 0;
  const client = zetaClient(async () => { calls++; throw new Error("No debe consultar Zeta."); });
  for (const dryRun of [true, false]) {
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true, dryRun }, { supabase, client });
    assert.equal(result.status, "waiting_for_sync");
    assert.equal(result.exportable, false);
    assert.equal(result.preview.cacheReconciliation.status, "waiting_for_sync");
    assert.equal(result.preview.cacheReconciliation.apiRequests, 0);
  }
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(supabase.state), before);
});

test("copia obsoleta o iniciada antes de cargar factura no habilita exportacion", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const reason of ["cache_stale", "snapshot_before_document"]) {
    const supabase = createFakeSupabase({ cacheAgeMs: reason === "cache_stale" ? 86400001 : 10000 });
    if (reason === "snapshot_before_document") supabase.state.documents[0].created_at = new Date().toISOString();
    let calls = 0;
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true }, { supabase,
      client: zetaClient(async () => { calls++; throw new Error("No debe consultar Zeta."); }) });
    assert.equal(result.status, "waiting_for_sync");
    assert.ok(result.preview.cacheReconciliation.reasons.includes(reason));
    assert.equal(calls, 0);
    assert.equal(supabase.state.integration_raw_records.some((row) => row.entity_type === "purchase_expense_export_claim"), false);
  }
});

test("copia mensual bloquea identidad fiscal existente y diferencias de total sin preflight vivo", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const total of [1220, 1500]) {
    const supabase = createFakeSupabase({ purchaseRows: monthlyPurchaseRows(total) });
    let calls = 0;
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true }, { supabase,
      client: zetaClient(async () => { calls++; throw new Error("No debe consultar Zeta."); }) });
    assert.equal(result.exportable, false);
    assert.equal(result.preview.cacheReconciliation.status, total === 1220 ? "already_in_erp" : "differences");
    assert.equal(result.status, total === 1220 ? "already_exists_in_zeta" : "blocked");
    assert.equal(result.preview.cacheReconciliation.matches[0].registroId, 991);
    assert.equal(calls, 0);
  }
});

test("ausente en copia reciente requiere confirmacion humana antes del preflight", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let calls = 0;
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
    actorProfileId: "user-1" }, { supabase,
    client: zetaClient(async () => { calls++; throw new Error("No debe consultar Zeta sin confirmar."); }) });
  assert.equal(result.preview.cacheReconciliation.status, "missing_from_erp");
  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_human_confirmation_required"));
  assert.equal(calls, 0);
});

test("timeout previo no se transforma en faltante reenviable aunque forceResend sea true", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const ready = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
    actorProfileId: "user-1", dryRun: true }, { supabase });
  supabase.state.integration_raw_records.push({ id: "unknown-1", organization_id: "org-1", provider: "zetasoftware",
    entity_type: "purchase_expense_export_attempt", external_key: "purchase_expense_invoice:doc-1",
    payload_json: { request: ready.payload, preview: ready.preview }, metadata_json: { status: "timeout_unknown" } });
  let calls = 0;
  for (const dryRun of [true, false]) {
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true, forceResend: true, dryRun }, { supabase,
      client: zetaClient(async () => { calls++; throw new Error("No debe reenviar."); }) });
    assert.equal(result.status, "timeout_unknown");
    assert.equal(result.exportable, false);
  }
  assert.equal(calls, 0);
});

test("validacion pending puede verificar la copia mensual sin HTTP ni modificar el intento", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase({ purchaseRows: monthlyPurchaseRows() });
  const prepared = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
    actorProfileId: "user-1", dryRun: true }, { supabase });
  supabase.state.integration_raw_records.push({ id: "pending-1", organization_id: "org-1", provider: "zetasoftware",
    entity_type: "purchase_expense_export_attempt", external_key: "purchase_expense_invoice:doc-1",
    source_total_amount: 1220, payload_json: { request: prepared.payload, preview: prepared.preview },
    metadata_json: { status: "success_pending_reconciliation" } });
  const before = JSON.stringify(supabase.state);
  let calls = 0;
  const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
    actorProfileId: "user-1", dryRun: true }, { supabase,
    client: zetaClient(async () => { calls++; throw new Error("No debe consultar Zeta."); }) });
  assert.equal(result.status, "found_in_zeta");
  assert.equal(result.exportable, false);
  assert.equal(result.duplicate.registroId, 991);
  assert.equal(result.preview.cacheReconciliation.source, "supabase");
  assert.equal(JSON.stringify(supabase.state), before);
  assert.equal(calls, 0);
});

test("preflight final bloquea factura agregada o cambiada desde la copia sin reservar ni enviar", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const change of [{ Total: 1500 }, { ComprobanteCodigo: 12 }, { MonedaCodigo: 2 }]) {
    const supabase = createFakeSupabase();
    const calls = [];
    const client = zetaClient(async (url) => {
      calls.push(url);
      assert.ok(url.endsWith("RESTFacturaProveedorV1QueryCompras"));
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ QueryComprasOut: {
        Succeed: true, IsLastPage: true, Error: null, Response: [{ RegistroId: 991, ProveedorCodigo: "PR0031",
          ComprobanteCodigo: 11, Serie: "A", Numero: 123456, MonedaCodigo: 1, Total: 1220, ...change }],
      } }) };
    });
    const result = await exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true }, { supabase, client });
    assert.equal(result.status, "blocked");
    assert.ok(result.blockers.some((entry) => entry.code === "zeta_preflight_fiscal_conflict"));
    assert.equal(calls.length, 1);
    assert.equal(supabase.state.integration_raw_records.some((row) => row.entity_type === "purchase_expense_export_claim"), false);
  }
});

test("preflight incompleto por pagina vacia o repetida nunca llega a Agregar", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const repeated of [false, true]) {
    const supabase = createFakeSupabase();
    const calls = [];
    const client = zetaClient(async (url) => {
      calls.push(url);
      assert.ok(url.endsWith("RESTFacturaProveedorV1QueryCompras"));
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ QueryComprasOut: {
        Succeed: true, IsLastPage: repeated && calls.length === 2, Error: null,
        Response: repeated ? [{ RegistroId: 1, ProveedorCodigo: "OTRO" }] : [],
      } }) };
    });
    await assert.rejects(exportPurchaseExpenseInvoiceToZeta({ organizationId: "org-1", documentId: "doc-1",
      actorProfileId: "user-1", humanConfirmed: true }, { supabase, client }), /pagina/);
    assert.equal(calls.length, repeated ? 2 : 1);
    assert.equal(supabase.state.integration_raw_records.some((row) => row.entity_type === "purchase_expense_export_claim"), false);
  }
});

test("dry-run pagina el catalogo completo y encuentra proveedores despues de 1000 filas", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const fillerContacts = Array.from({ length: 1_000 }, (_, index) => ({
    id: `raw-contact-fill-${index}`,
    organization_id: "org-1",
    provider: "zetasoftware",
    entity_type: "contact",
    external_key: `FILL${String(index).padStart(4, "0")}`,
    test_mode: false,
    payload_json: {
      row: {
        Codigo: `FILL${index}`,
        Nombre: `Proveedor ${index}`,
        RUT: `219000${String(index).padStart(6, "0")}`,
        EsProveedor: "S",
      },
    },
    metadata_json: {},
  }));
  supabase.state.integration_raw_records.unshift(...fillerContacts);

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
    dryRun: true,
  }, { supabase });

  assert.equal(result.status, "dry_run_ready");
  assert.equal(result.preview.zetaSupplierCode, "PR0031");
});

test("envio real exige concepto Zeta confirmado en el documento", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  delete supabase.state.document_accounting_contexts[0]
    .structured_context_json.zeta_purchase_expense_concept_code;
  let zetaCalls = 0;
  const client = zetaClient(async () => {
    zetaCalls += 1;
    throw new Error("No debe llamar a Zeta sin concepto documental confirmado.");
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "blocked");
  assert.equal(zetaCalls, 0);
  assert.ok(result.blockers.some((entry) =>
    entry.code === "zeta_document_concept_confirmation_missing"));
});

test("envio real exige condicion de pago Zeta confirmada en el documento", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  delete supabase.state.document_accounting_contexts[0]
    .structured_context_json.zeta_purchase_expense_payment_term_code;
  let zetaCalls = 0;
  const client = zetaClient(async () => {
    zetaCalls += 1;
    throw new Error("No debe llamar a Zeta sin condicion documental confirmada.");
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "blocked");
  assert.equal(zetaCalls, 0);
  assert.ok(result.blockers.some((entry) =>
    entry.code === "zeta_document_payment_term_confirmation_missing"));
});

test("export service hace preflight, envia FacturaProveedorAgregar y guarda snapshot", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const calls = [];
  const client = zetaClient(async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ AgregarOut: { Succeed: true, Response: { Succeed: true, Mensaje: "OK" }, Error: null } }),
    };
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "success_pending_reconciliation");
  assert.equal(calls.length, 3);
  assert.equal(calls[1].body.AgregarIn.Data.Movimiento.CodigoProveedor, "PR0031");
  assert.equal(
    calls[1].body.AgregarIn.Data.Movimiento.Lineas[0].CodigoArticulo,
    "GASTOSVAR",
  );
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.ok(exportRecord);
  assert.equal(exportRecord.metadata_json.status, "success_pending_reconciliation");
  assert.equal(Array.isArray(result.payload.Data.Movimiento), true);
  assert.equal(result.payload.Data.Movimiento.length, 1);
  assert.deepEqual(exportRecord.payload_json.request, result.payload);
  assert.deepEqual(calls[1].body.AgregarIn.Data.Movimiento, result.payload.Data.Movimiento[0]);
  assert.equal(exportRecord.payload_json.fiscal_fingerprint, result.fiscalFingerprint);
  assert.deepEqual(exportRecord.payload_json.fiscal_identity, result.fiscalIdentity);
  assert.equal(supabase.state.audit_log.some((row) => row.action === "zeta_purchase_expense_export_completed"), true);
});

test("claim durable permite un solo Agregar ante dos exportaciones concurrentes", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let agregarCalls = 0;
  let signalAddStarted;
  let releaseAdd;
  const addStarted = new Promise((resolve) => {
    signalAddStarted = resolve;
  });
  const addRelease = new Promise((resolve) => {
    releaseAdd = resolve;
  });
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: [],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    }

    agregarCalls += 1;
    signalAddStarted();
    await addRelease;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        AgregarOut: {
          Succeed: true,
          Response: { Succeed: true, Mensaje: "OK" },
          Error: null,
        },
      }),
    };
  });
  const firstPromise = exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  await Promise.race([
    addStarted,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error("La primera exportacion no llego a Agregar.")),
      1_000,
    )),
  ]);

  let second;
  try {
    second = await exportPurchaseExpenseInvoiceToZeta({
      organizationId: "org-1",
      documentId: "doc-1",
      actorProfileId: "user-2",
      humanConfirmed: true,
    }, { supabase, client });
  } finally {
    releaseAdd();
  }

  const first = await firstPromise;
  const claims = supabase.state.integration_raw_records.filter((row) =>
    row.entity_type === "purchase_expense_export_claim");

  assert.equal(agregarCalls, 1);
  assert.equal(first.status, "success_pending_reconciliation");
  assert.equal(second.status, "blocked");
  assert.ok(second.blockers.some((entry) =>
    entry.code === "zeta_export_claim_already_exists"));
  assert.equal(claims.length, 1);
  assert.equal(
    claims[0].external_key,
    `purchase_expense_invoice:${first.fiscalIdentity.key}`,
  );
});

test("claim durable impide reenvio si falla persistencia despues de Agregar", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase({ failExportAttemptUpsert: true });
  let agregarCalls = 0;
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: [],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    }

    agregarCalls += 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        AgregarOut: {
          Succeed: true,
          Response: { Succeed: true, Mensaje: "OK" },
          Error: null,
        },
      }),
    };
  });

  await assert.rejects(
    exportPurchaseExpenseInvoiceToZeta({
      organizationId: "org-1",
      documentId: "doc-1",
      actorProfileId: "user-1",
    humanConfirmed: true,
    }, { supabase, client }),
    /fallo de persistencia posterior a Agregar/,
  );

  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });
  const claims = supabase.state.integration_raw_records.filter((row) =>
    row.entity_type === "purchase_expense_export_claim");

  assert.equal(agregarCalls, 1);
  assert.equal(retry.status, "blocked");
  assert.ok(retry.blockers.some((entry) =>
    entry.code === "zeta_export_claim_already_exists"));
  assert.equal(claims.length, 1);
  assert.equal(claims[0].metadata_json.status, "reserved_before_add");
});

test("claim nuevo sin intento persistido bloquea el mismo documento aunque corrijan serie y numero", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const onlyMetadata of [false, true]) {
    const supabase = createFakeSupabase({ failExportAttemptUpsert: true }), calls = [];
    const client = successfulEmptyClient(calls);
    const params = { organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1", humanConfirmed: true };
    await assert.rejects(exportPurchaseExpenseInvoiceToZeta(params, { supabase, client }), /fallo de persistencia posterior a Agregar/);
    const claim = supabase.state.integration_raw_records.find((row) => row.entity_type === "purchase_expense_export_claim");
    if (onlyMetadata) delete claim.payload_json.document_id;
    Object.assign(supabase.state.document_drafts[0].fields_json.facts, { series: "B", document_number: "999999" });
    const before = structuredClone(supabase.state), callCount = calls.length;
    const retry = await exportPurchaseExpenseInvoiceToZeta(params, { supabase, client });
    assert.ok(retry.blockers.some((b) => b.code === "zeta_export_claim_already_exists"));
    assert.equal(calls.length, callCount);
    assert.equal(calls.filter((url) => url.endsWith("RESTFacturaProveedorV1Agregar")).length, 1);
    assert.deepEqual(supabase.state, before);
  }
});

test("source_tax_breakdown tiene prioridad sobre line_items OCR para varias tasas", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const fields = supabase.state.document_drafts[0].fields_json;
  fields.facts.subtotal = 1500;
  fields.facts.tax_amount = 270;
  fields.facts.total_amount = 1770;
  fields.source_tax_breakdown = [
    { label: "IVA basico", net_amount: 1000, tax_rate: 22, tax_amount: 220, total_amount: 1220, source: "zeta_received_cfe" },
    { label: "IVA minimo", net_amount: 500, tax_rate: 10, tax_amount: 50, total_amount: 550, source: "zeta_received_cfe" },
  ];
  fields.line_items = [{
    line_number: 1,
    concept_description: "OCR incorrecto",
    net_amount: 1400,
    tax_rate: 22,
    tax_amount: 308,
    total_amount: 1708,
  }];

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
    dryRun: true,
  }, { supabase });

  assert.equal(result.status, "dry_run_ready");
  assert.deepEqual(result.preview.lines.map((line) => line.netAmount), [1000, 500]);
  assert.deepEqual(result.preview.lines.map((line) => line.ivaAmount), [220, 50]);
});

test("en tasa unica los totales confirmados dominan el detalle OCR", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const fields = supabase.state.document_drafts[0].fields_json;
  fields.line_items = [{
    line_number: 1,
    concept_description: "OCR aproximado",
    net_amount: 990,
    tax_rate: 22,
    tax_amount: 217.8,
    total_amount: 1207.8,
  }];

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
    dryRun: true,
  }, { supabase });

  assert.equal(result.status, "dry_run_ready");
  assert.equal(result.preview.lines.length, 1);
  assert.equal(result.preview.lines[0].netAmount, 1000);
  assert.equal(result.preview.lines[0].ivaAmount, 220);
  assert.equal(result.preview.lines[0].totalAmount, 1220);
});

test("IVA corregido por el usuario domina tambien el CodigoIVA de Zeta", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  const fields = supabase.state.document_drafts[0].fields_json;
  fields.facts.subtotal = 1000;
  fields.facts.tax_amount = 100;
  fields.facts.total_amount = 1100;
  fields.line_items = [{
    line_number: 1,
    concept_description: "OCR con tasa equivocada",
    net_amount: 1000,
    tax_rate: 22,
    tax_amount: 220,
    total_amount: 1220,
  }];

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
    dryRun: true,
  }, { supabase });

  assert.equal(result.status, "dry_run_ready");
  assert.equal(result.preview.lines[0].ivaCode, 2);
  assert.equal(result.preview.lines[0].ivaAmount, 100);
  assert.equal(result.preview.lines[0].totalAmount, 1100);
});

test("export real queda bloqueado si la conexion no habilita escritura", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  supabase.state.organization_integration_connections[0].mode = "read_only";
  let calls = 0;
  const client = zetaClient(async () => {
    calls += 1;
    throw new Error("No debe llamar Zeta.");
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_connection_write_not_enabled"));
  assert.equal(calls, 0);
});

test("export real queda bloqueado si el ultimo control de conexion fallo", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  supabase.state.organization_integration_connections[0].status = "error";
  let calls = 0;
  const client = zetaClient(async () => {
    calls += 1;
    throw new Error("No debe llamar Zeta con conexion en error.");
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_connection_not_connected"));
  assert.equal(calls, 0);
});

test("export real queda bloqueado siempre en test_mode", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  supabase.state.organization_integration_connections[0].test_mode = true;
  let calls = 0;
  const client = zetaClient(async () => {
    calls += 1;
    throw new Error("No debe llamar Zeta.");
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "blocked");
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_test_mode_write_blocked"));
  assert.equal(calls, 0);
});

test("AgregarOut interno rechazado no se marca como exito", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let calls = 0;
  const client = zetaClient(async (url) => {
    calls += 1;
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        AgregarOut: {
          Succeed: true,
          Response: { Succeed: false, Mensaje: "Comprobante invalido" },
          Error: null,
        },
      }),
    };
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "zeta_error");
  assert.equal(result.zetaResponse.code, "zeta_factura_proveedor_rejected");
  assert.match(result.zetaResponse.message, /Comprobante invalido/);
  assert.equal(calls, 2);
  assert.equal(supabase.state.audit_log.some((row) => row.action === "zeta_purchase_expense_export_completed"), false);
});

test("respuesta interna ambigua queda timeout_unknown y no reenvia", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let agregarCalls = 0;
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }),
      };
    }
    agregarCalls += 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ AgregarOut: { Succeed: true, Response: { Mensaje: "Sin confirmacion" }, Error: null } }),
    };
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "timeout_unknown");
  assert.equal(retry.status, "timeout_unknown");
  assert.equal(agregarCalls, 1);
});

test("reconciliacion inmediata confirma found_in_zeta y RegistroId", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let queryCalls = 0;
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      queryCalls += 1;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: queryCalls === 1 ? [] : [{
              RegistroId: 777,
              ProveedorCodigo: "PR0031",
              ComprobanteCodigo: 11,
              Serie: "A",
              Numero: 123456,
              MonedaCodigo: 1,
              Total: 1220,
            }],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ AgregarOut: { Succeed: true, Response: { Succeed: true, Mensaje: "OK" }, Error: null } }),
    };
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "found_in_zeta");
  assert.equal(result.duplicate.found, true);
  assert.equal(result.duplicate.registroId, 777);
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.equal(exportRecord.metadata_json.status, "found_in_zeta");
  const savedState = structuredClone(supabase.state);
  let replayCalls = 0;
  const replay = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1",
    humanConfirmed: true, forceResend: true,
  }, { supabase, client: zetaClient(async () => {
    replayCalls++;
    throw new Error("Un comprobante conciliado no puede volver a enviarse.");
  }) });
  assert.equal(replay.status, "found_in_zeta");
  assert.equal(replayCalls, 0);
  assert.equal(Array.isArray(exportRecord.payload_json.request.Data.Movimiento), true);
  assert.deepEqual(supabase.state, savedState);
});

test("falla de QueryCompras posterior no reenvia una factura ya aceptada", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let queryCalls = 0;
  let agregarCalls = 0;
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      queryCalls += 1;
      if (queryCalls === 1) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }),
        };
      }
      throw new Error("QueryCompras temporalmente no disponible");
    }
    agregarCalls += 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ AgregarOut: { Succeed: true, Response: { Succeed: true, Mensaje: "OK" }, Error: null } }),
    };
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "success_pending_reconciliation");
  assert.ok(result.warnings.some((entry) => entry.code === "zeta_purchase_reconciliation_failed"));
  assert.equal(retry.status, "success_pending_reconciliation");
  assert.ok(retry.blockers.some((entry) =>
    entry.code === "zeta_purchase_reconciliation_pending_no_resend"));
  assert.equal(queryCalls, 3);
  assert.equal(agregarCalls, 1);
});

test("reintento pending conserva pending si QueryCompras no encuentra y nunca reenvia", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let queryCalls = 0;
  let agregarCalls = 0;
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      queryCalls += 1;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: [],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    }
    agregarCalls += 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        AgregarOut: {
          Succeed: true,
          Response: { Succeed: true, Mensaje: "OK" },
          Error: null,
        },
      }),
    };
  });

  const sent = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
    forceResend: true,
  }, { supabase, client });

  assert.equal(sent.status, "success_pending_reconciliation");
  assert.equal(retry.status, "success_pending_reconciliation");
  assert.equal(retry.exportable, false);
  assert.equal(queryCalls, 3);
  assert.equal(agregarCalls, 1);
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.equal(exportRecord.metadata_json.status, "success_pending_reconciliation");
});

test("validacion de pending conserva el estado sin consultar Zeta ni escribir reconciliacion", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let queryCalls = 0;
  let agregarCalls = 0;
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      queryCalls += 1;
      const found = queryCalls === 3;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: found ? [{
              RegistroId: 991,
              ProveedorCodigo: "PR0031",
              ComprobanteCodigo: 11,
              Serie: "A",
              Numero: 123456,
              MonedaCodigo: 1,
              Total: 1220,
            }] : [],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    }
    agregarCalls += 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        AgregarOut: {
          Succeed: true,
          Response: { Succeed: true, Mensaje: "OK" },
          Error: null,
        },
      }),
    };
  });

  const sent = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });
  const validation = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
    dryRun: true,
  }, { supabase, client });

  assert.equal(sent.status, "success_pending_reconciliation");
  assert.equal(validation.status, "success_pending_reconciliation");
  assert.equal(validation.dryRun, true);
  assert.equal(validation.duplicate, null);
  assert.equal(queryCalls, 2);
  assert.equal(agregarCalls, 1);
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.equal(exportRecord.metadata_json.status, "success_pending_reconciliation");
});

test("timeout queda timeout_unknown y no reintenta automatico", async () => {
  const {
    exportPurchaseExpenseInvoiceToZeta,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let agregarCalls = 0;
  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  const client = zetaClient(async (url) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }),
      };
    }
    agregarCalls += 1;
    throw abortError;
  });

  const result = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });

  assert.equal(result.status, "timeout_unknown");
  assert.equal(agregarCalls, 1);
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    humanConfirmed: true,
  }, { supabase, client });
  assert.equal(retry.status, "timeout_unknown");
  assert.ok(retry.blockers.some((entry) => entry.code === "zeta_timeout_requires_reconciliation"));
  assert.equal(agregarCalls, 1);
});

test("HTTP 400 conserva diagnostico saneado, reserva e incertidumbre sin reenvio", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const supabase = createFakeSupabase();
  let agregarCalls = 0;
  let wireMovement;
  const client = zetaClient(async (url, init) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      return {
        ok: true, status: 200, statusText: "OK",
        json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true, Error: null } }),
      };
    }
    agregarCalls++;
    wireMovement = JSON.parse(init.body).AgregarIn.Data.Movimiento;
    return new Response(JSON.stringify({ Message: "Error field Tipo", Connection: { EmpresaClave: "secret" } }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  });
  const input = { organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1", humanConfirmed: true };
  const result = await exportPurchaseExpenseInvoiceToZeta(input, { supabase, client });
  assert.equal(result.status, "timeout_unknown");
  assert.equal(result.zetaResponse.status, 400);
  assert.equal(result.zetaResponse.endpointName, "RESTFacturaProveedorV1Agregar");
  assert.match(result.zetaResponse.details.body, /Error field Tipo/);
  assert.doesNotMatch(JSON.stringify(result.zetaResponse), /secret/);
  const attempt = supabase.state.integration_raw_records.find((row) => row.entity_type === "purchase_expense_export_attempt");
  assert.deepEqual(attempt.payload_json.response, result.zetaResponse);
  assert.equal(Array.isArray(wireMovement), false);
  assert.equal(Array.isArray(result.payload.Data.Movimiento), true);
  assert.deepEqual(attempt.payload_json.request, result.payload);
  assert.deepEqual(wireMovement, result.payload.Data.Movimiento[0]);
  assert.equal(attempt.payload_json.fiscal_fingerprint, result.fiscalFingerprint);
  assert.deepEqual(attempt.payload_json.fiscal_identity, result.fiscalIdentity);
  const savedAttempt = structuredClone(attempt);
  const savedClaims = structuredClone(supabase.state.integration_raw_records.filter((row) => row.entity_type === "purchase_expense_export_claim"));
  const audit = supabase.state.audit_log.find((row) => row.action === "zeta_purchase_expense_export_timeout_unknown");
  assert.equal(audit.after_json.status, 400);
  const retry = await exportPurchaseExpenseInvoiceToZeta({ ...input, forceResend: true }, { supabase, client });
  assert.equal(retry.status, "timeout_unknown");
  assert.equal(agregarCalls, 1);
  assert.deepEqual(supabase.state.integration_raw_records.find((row) => row.entity_type === "purchase_expense_export_attempt"), savedAttempt);
  assert.deepEqual(supabase.state.integration_raw_records.filter((row) => row.entity_type === "purchase_expense_export_claim"), savedClaims);
});

test("Succeed ausente es incierto y otros errores no persisten Detail arbitrario", async () => {
  const { exportPurchaseExpenseInvoiceToZeta } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  for (const scenario of [
    { output: { Response: {} }, status: "timeout_unknown", code: "zeta_success_missing" },
    { output: { Succeed: false, Error: { Code: "REJECTED", Message: "Invalid field", Detail: [{ Private: "unknown-sensitive-detail" }] } }, status: "zeta_error", code: "REJECTED" },
  ]) {
    const supabase = createFakeSupabase();
    let calls = 0;
    const client = zetaClient(async (url) => {
      if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
        return { ok: true, status: 200, statusText: "OK", json: async () => ({ QueryComprasOut: { Succeed: true, Response: [], IsLastPage: true } }) };
      }
      calls++;
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ AgregarOut: scenario.output }) };
    });
    const input = { organizationId: "org-1", documentId: "doc-1", actorProfileId: "user-1", humanConfirmed: true };
    const result = await exportPurchaseExpenseInvoiceToZeta(input, { supabase, client });
    assert.equal(result.status, scenario.status);
    assert.equal(result.zetaResponse.code, scenario.code);
    assert.equal(result.zetaResponse.details, undefined);
    assert.doesNotMatch(JSON.stringify(supabase.state.integration_raw_records), /unknown-sensitive-detail/);
    await exportPurchaseExpenseInvoiceToZeta({ ...input, forceResend: true }, { supabase, client });
    assert.equal(calls, 1);
  }
});

test("reconciliacion QueryCompras guarda RegistroId cuando encuentra la factura", async () => {
  const {
    reconcilePurchaseExpenseInvoiceExport,
  } = require("@/modules/integrations/zeta/reconcile/reconcile-purchase-expense-invoice");
  const client = zetaClient(async (url, init) => {
    if (url.endsWith("RESTFacturaProveedorV1QueryCompras")) {
      const body = JSON.parse(init.body);
      assert.equal(body.QueryComprasIn.Data.Filters.ProveedorCodigo, "PR0031");
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          QueryComprasOut: {
            Succeed: true,
            Response: [{
              RegistroId: 777,
              ProveedorCodigo: "PR0031",
              ComprobanteCodigo: 11,
              Serie: "A",
              Numero: 123456,
              MonedaCodigo: 1,
              Total: 1220,
            }],
            IsLastPage: true,
            Error: null,
          },
        }),
      };
    }
    throw new Error("No se esperaba Consulta de Asientos sin ejercicio.");
  });

  const result = await reconcilePurchaseExpenseInvoiceExport({
    client,
    movimiento: {
      CodigoComprobante: 11,
      Serie: "A",
      Numero: 123456,
      Fecha: "2026-04-20",
      CodigoMoneda: 1,
      CodigoProveedor: "PR0031",
      Lineas: [],
    },
    expectedTotal: 1220,
  });

  assert.equal(result.status, "found_in_zeta");
  assert.equal(result.registroId, 777);
});

