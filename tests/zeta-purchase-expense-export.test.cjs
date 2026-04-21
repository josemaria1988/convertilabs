/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createFakeSupabase() {
  let sequence = 0;
  const state = {
    organization_integration_connections: [{
      id: "conn-1",
      organization_id: "org-1",
      provider: "zetasoftware",
      status: "connected",
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
        },
      },
    }],
    integration_raw_records: [
      raw("contact", "PR0031", { Codigo: "PR0031", Nombre: "Los Delfines", RUT: "21.999.888.777", EsProveedor: "S" }),
      raw("supplier_commercial_data", "PR0031", { Codigo: "PR0031" }),
      raw("document_type", "11", { Codigo: 11, Nombre: "Compra gasto credito", ComprobanteGastos: "S", Activo: "S" }),
      raw("document_type", "12", { Codigo: 12, Nombre: "Compra gasto contado", ComprobanteGastos: "S", Activo: "S" }),
      raw("document_type", "13", { Codigo: 13, Nombre: "Nota gasto", ComprobanteGastos: "S", Activo: "S" }),
      raw("concept", "GASTOSVAR", { Codigo: "GASTOSVAR", Nombre: "Gastos varios", ConceptoActivo: "S" }),
      raw("vat_rate", "1", { Codigo: 1, Tasa: 22 }),
      raw("payment_term", "CR", { Codigo: "CR", Nombre: "Credito", Activo: "S" }),
      raw("payment_term", "CO", { Codigo: "CO", Nombre: "Contado", Activo: "S" }),
      raw("payment_method", "1", { Codigo: 1, Nombre: "Efectivo", Activo: "S", RequiereCaja: "N" }),
      raw("currency", "1", { Codigo: 1, CodigoISO: "UYU" }),
    ],
    documents: [{
      id: "doc-1",
      organization_id: "org-1",
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

  function raw(entityType, externalKey, row) {
    return {
      id: `raw-${entityType}-${externalKey}`,
      organization_id: "org-1",
      provider: "zetasoftware",
      entity_type: entityType,
      external_key: externalKey,
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
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    order() {
      return this;
    }

    limit(value) {
      this.limitCount = value;
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
      for (const row of rows) {
        state[this.table].push({ id: row.id || `${this.table}-${++sequence}`, ...row });
      }
      return Promise.resolve({ data: null, error: null });
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
      if (this.operation === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
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
      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount);
      }
      return { data: rows, error: null };
    }

    filterRows() {
      return (state[this.table] || []).filter((row) =>
        this.filters.every((filter) => row[filter.field] === filter.value));
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
  return createZetaRestClient({
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
  }, { supabase, client });

  assert.equal(result.status, "success_pending_reconciliation");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.AgregarIn.Data.Movimiento[0].CodigoProveedor, "PR0031");
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.ok(exportRecord);
  assert.equal(exportRecord.metadata_json.status, "success_pending_reconciliation");
  assert.equal(supabase.state.audit_log.some((row) => row.action === "zeta_purchase_expense_export_completed"), true);
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
  }, { supabase, client });

  assert.equal(result.status, "timeout_unknown");
  assert.equal(agregarCalls, 1);
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
  }, { supabase, client });
  assert.equal(retry.status, "timeout_unknown");
  assert.ok(retry.blockers.some((entry) => entry.code === "zeta_timeout_requires_reconciliation"));
  assert.equal(agregarCalls, 1);
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

