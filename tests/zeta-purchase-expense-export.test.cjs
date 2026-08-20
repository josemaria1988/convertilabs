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
      raw("supplier_commercial_data", "PR0031", { Codigo: "PR0031" }),
      raw("document_type", "11", { Codigo: 11, Nombre: "Compra gasto credito", ComprobanteGastos: "S", Activo: "S" }),
      raw("document_type", "12", { Codigo: 12, Nombre: "Compra gasto contado", ComprobanteGastos: "S", Activo: "S" }),
      raw("document_type", "13", { Codigo: 13, Nombre: "Nota gasto", ComprobanteGastos: "S", Activo: "S" }),
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
      if (this.operation === "update") {
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
  }, { supabase, client });

  assert.equal(result.status, "success_pending_reconciliation");
  assert.equal(calls.length, 3);
  assert.equal(calls[1].body.AgregarIn.Data.Movimiento[0].CodigoProveedor, "PR0031");
  assert.equal(
    calls[1].body.AgregarIn.Data.Movimiento[0].Lineas[0].CodigoArticulo,
    "GASTOSVAR",
  );
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.ok(exportRecord);
  assert.equal(exportRecord.metadata_json.status, "success_pending_reconciliation");
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
    `purchase_expense_invoice:${first.fiscalFingerprint}`,
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
    }, { supabase, client }),
    /fallo de persistencia posterior a Agregar/,
  );

  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
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
  }, { supabase, client });
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
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
  }, { supabase, client });

  assert.equal(result.status, "found_in_zeta");
  assert.equal(result.duplicate.found, true);
  assert.equal(result.duplicate.registroId, 777);
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.equal(exportRecord.metadata_json.status, "found_in_zeta");
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
  }, { supabase, client });
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
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
  }, { supabase, client });
  const retry = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
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

test("validacion de pending converge a found_in_zeta sin volver a llamar Agregar", async () => {
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
  }, { supabase, client });
  const validation = await exportPurchaseExpenseInvoiceToZeta({
    organizationId: "org-1",
    documentId: "doc-1",
    actorProfileId: "user-1",
    dryRun: true,
  }, { supabase, client });

  assert.equal(sent.status, "success_pending_reconciliation");
  assert.equal(validation.status, "found_in_zeta");
  assert.equal(validation.dryRun, true);
  assert.equal(validation.duplicate.registroId, 991);
  assert.equal(queryCalls, 3);
  assert.equal(agregarCalls, 1);
  const exportRecord = supabase.state.integration_raw_records.find((row) =>
    row.entity_type === "purchase_expense_export_attempt");
  assert.equal(exportRecord.metadata_json.status, "found_in_zeta");
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

