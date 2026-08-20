/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function raw(entityType, row) {
  return {
    organization_id: "org-1",
    provider: "zetasoftware",
    entity_type: entityType,
    test_mode: false,
    payload_json: { row },
  };
}

function createSupabaseStub() {
  const state = {
    organization_integration_connections: [{
      id: "conn-1",
      organization_id: "org-1",
      provider: "zetasoftware",
      mode: "read_only",
      status: "connected",
      test_mode: false,
      last_connection_test_ok: true,
      config_json: {
        keep_me: { enabled: true },
        purchase_expense_export: {
          concepts: {
            bySupplierCode: { PR001: "TELEF" },
          },
          paymentMethods: {
            bank_transfer: 8,
          },
        },
      },
      encrypted_credentials: "must-not-change",
    }],
    integration_raw_records: [
      raw("document_type", { Codigo: 21, Nombre: "Compra de mercaderia", Tipo: 21, ComprobanteGastos: "N", Activo: "S" }),
      raw("document_type", { Codigo: 121, Nombre: "Gasto credito", Tipo: 21, ComprobanteGastos: "S", Activo: "S" }),
      raw("document_type", { Codigo: 123, Nombre: "Gasto contado", Tipo: 23, ComprobanteGastos: "S", Activo: "S" }),
      raw("document_type", { Codigo: 122, Nombre: "NC gasto", Tipo: 22, ComprobanteGastos: "S", Activo: "S" }),
      raw("concept", { Codigo: "TELEF", Nombre: "Telefonia", ConceptoActivo: "S" }),
      raw("payment_term", { Codigo: "CR", Nombre: "Credito 30 dias", Activo: "S" }),
      raw("payment_term", { Codigo: "CO", Nombre: "Contado", Activo: "S" }),
      raw("payment_method", { Codigo: 1, Nombre: "Efectivo", Activo: "S", RequiereCaja: "S" }),
      raw("payment_method", { Codigo: 8, Nombre: "Transferencia", Activo: "S", RequiereCaja: "N" }),
      raw("currency", { Codigo: 1, Nombre: "Pesos uruguayos", CodigoISO: "UYU" }),
      raw("currency", { Codigo: 2, Nombre: "Dolares", CodigoISO: "USD" }),
      raw("business_location", { Codigo: 1, Nombre: "Casa central", Activo: "S" }),
      raw("user_role", { Codigo: 7, Nombre: "Administracion", UsuarioNombre: "Operador", Activo: "S" }),
      raw("cashbox", { Codigo: 3, Nombre: "Caja principal", Activo: "S" }),
    ],
    audit_log: [],
  };
  const updates = [];

  class Builder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.mutation = "select";
      this.payload = null;
      this.limitCount = null;
      this.rangeFrom = null;
      this.rangeTo = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      return this;
    }

    limit(value) {
      this.limitCount = value;
      return this;
    }

    order() {
      return this;
    }

    range(from, to) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    maybeSingle() {
      const rows = this.filteredRows();
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }

    update(payload) {
      this.mutation = "update";
      this.payload = payload;
      return this;
    }

    insert(payload) {
      this.mutation = "insert";
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

    filteredRows() {
      let rows = state[this.table] ?? [];
      rows = rows.filter((row) => this.filters.every((filter) => row[filter.column] === filter.value));

      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount);
      }

      if (this.rangeFrom !== null && this.rangeTo !== null) {
        rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
      }

      return rows;
    }

    execute() {
      if (this.mutation === "update") {
        const rows = this.filteredRows();
        updates.push({ table: this.table, payload: this.payload });
        rows.forEach((row) => Object.assign(row, this.payload));
        return { data: rows, error: null };
      }

      if (this.mutation === "insert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        state[this.table].push(...rows);
        return { data: rows, error: null };
      }

      return { data: this.filteredRows(), error: null };
    }
  }

  return {
    state,
    updates,
    from(table) {
      return new Builder(table);
    },
  };
}

function validInput(overrides = {}) {
  return {
    organizationId: "org-1",
    actorUserId: "user-1",
    writeEnabled: true,
    purchaseExpenseCreditDocumentCode: "121",
    purchaseExpenseCashDocumentCode: "123",
    supplierCreditNoteExpenseDocumentCode: "122",
    defaultConceptCode: "TELEF",
    creditPaymentTermCode: "CR",
    cashPaymentTermCode: "CO",
    uyuCurrencyCode: "1",
    localCode: "1",
    userCode: "7",
    cashboxCode: "3",
    cashPaymentMethodCode: "1",
    bankTransferPaymentMethodCode: "8",
    cardPaymentMethodCode: "",
    checkPaymentMethodCode: "",
    paidByPartnerPaymentTermCode: "",
    paidByPartnerPaymentMethodCode: "",
    ...overrides,
  };
}

test("configuracion Zeta muestra solo comprobantes de gasto del tipo basico correcto", async () => {
  const {
    loadZetaPurchaseExpenseConfiguration,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();
  const result = await loadZetaPurchaseExpenseConfiguration(supabase, "org-1");

  assert.deepEqual(result.catalogs.creditDocumentTypes.map((row) => row.code), ["121"]);
  assert.deepEqual(result.catalogs.cashDocumentTypes.map((row) => row.code), ["123"]);
  assert.deepEqual(result.catalogs.creditNoteDocumentTypes.map((row) => row.code), ["122"]);
  assert.deepEqual(result.catalogs.uyuCurrencies.map((row) => row.code), ["1"]);
  assert.equal(result.writeEnabled, false);
  assert.equal(result.status, "pending");
});

test("selector documental carga solo conceptos reales activos y unicos", async () => {
  const {
    loadZetaPurchaseExpenseConceptOptions,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();
  supabase.state.integration_raw_records.push(
    raw("concept", { Codigo: "TELEF", Nombre: "Telefonia duplicada", ConceptoActivo: "S" }),
    raw("concept", { Codigo: "INACT", Nombre: "Inactivo", ConceptoActivo: "N" }),
    {
      ...raw("concept", { Codigo: "PRUEBA", Nombre: "Solo test", ConceptoActivo: "S" }),
      test_mode: true,
    },
  );

  const result = await loadZetaPurchaseExpenseConceptOptions(supabase, "org-1");

  assert.deepEqual(result.map((option) => option.code), ["TELEF"]);
});

test("selector documental pagina catalogos reales con mas de 1000 filas", async () => {
  const {
    loadZetaPurchaseExpenseConceptOptions,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();

  for (let index = 0; index < 1005; index += 1) {
    supabase.state.integration_raw_records.push(raw("concept", {
      Codigo: `C${String(index).padStart(4, "0")}`,
      Nombre: `Concepto ${index}`,
      ConceptoActivo: "S",
    }));
  }

  const result = await loadZetaPurchaseExpenseConceptOptions(supabase, "org-1");

  assert.equal(result.length, 1006);
  assert.equal(result.some((option) => option.code === "C1004"), true);
});

test("guardar configuracion Zeta valida catalogos, preserva config y no toca credenciales", async () => {
  const {
    saveZetaPurchaseExpenseConfiguration,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();
  const result = await saveZetaPurchaseExpenseConfiguration(supabase, validInput());
  const connection = supabase.state.organization_integration_connections[0];

  assert.equal(connection.mode, "read_write");
  assert.equal(connection.encrypted_credentials, "must-not-change");
  assert.deepEqual(connection.config_json.keep_me, { enabled: true });
  assert.equal(connection.config_json.purchase_expense_export.documentTypes.purchase_expense_credit, 121);
  assert.equal(connection.config_json.purchase_expense_export.concepts.default, "TELEF");
  assert.equal(connection.config_json.purchase_expense_export.concepts.bySupplierCode.PR001, "TELEF");
  assert.equal(connection.config_json.purchase_expense_export.paymentMethods.bank_transfer, 8);
  assert.equal(connection.config_json.purchase_expense_export.paymentMethods.cash, 1);
  assert.equal(connection.config_json.purchase_expense_export.defaults.userCode, 7);
  assert.equal(result.status, "ready");
  assert.equal(supabase.updates[0].payload.encrypted_credentials, undefined);
  assert.equal(
    supabase.state.audit_log.some((row) => row.action === "zeta_purchase_expense_configuration_saved"),
    true,
  );
});

test("habilitar escritura exige conexion real con prueba exitosa", async () => {
  const {
    saveZetaPurchaseExpenseConfiguration,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();
  const connection = supabase.state.organization_integration_connections[0];

  connection.test_mode = true;
  await assert.rejects(
    () => saveZetaPurchaseExpenseConfiguration(supabase, validInput()),
    /prueba de conexion Zeta exitosa/,
  );

  connection.test_mode = false;
  connection.status = "error";
  await assert.rejects(
    () => saveZetaPurchaseExpenseConfiguration(supabase, validInput()),
    /prueba de conexion Zeta exitosa/,
  );

  connection.status = "connected";
  connection.last_connection_test_ok = false;
  await assert.rejects(
    () => saveZetaPurchaseExpenseConfiguration(supabase, validInput()),
    /prueba de conexion Zeta exitosa/,
  );

  assert.equal(supabase.updates.length, 0);
  assert.equal(supabase.state.audit_log.length, 0);
});

test("concepto global es opcional porque cada factura confirma el suyo", async () => {
  const {
    saveZetaPurchaseExpenseConfiguration,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();
  const result = await saveZetaPurchaseExpenseConfiguration(supabase, validInput({
    defaultConceptCode: "",
  }));
  const concepts = supabase.state.organization_integration_connections[0]
    .config_json.purchase_expense_export.concepts;

  assert.equal(result.status, "ready");
  assert.equal(concepts.default, undefined);
  assert.equal(concepts.bySupplierCode.PR001, "TELEF");
});

test("guardar configuracion Zeta rechaza un comprobante que no es de gastos", async () => {
  const {
    saveZetaPurchaseExpenseConfiguration,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();

  await assert.rejects(
    () => saveZetaPurchaseExpenseConfiguration(supabase, validInput({
      purchaseExpenseCreditDocumentCode: "21",
    })),
    /no cumple el contrato Zeta/,
  );
  assert.equal(supabase.updates.length, 0);
  assert.equal(supabase.state.audit_log.length, 0);
});

test("condicion y forma de pago para socio se guardan juntas", async () => {
  const {
    saveZetaPurchaseExpenseConfiguration,
  } = require("@/modules/integrations/zeta/export/configuration-service");
  const supabase = createSupabaseStub();

  await assert.rejects(
    () => saveZetaPurchaseExpenseConfiguration(supabase, validInput({
      paidByPartnerPaymentMethodCode: "8",
    })),
    /Configura juntas la condicion y la forma de pago/,
  );

  const result = await saveZetaPurchaseExpenseConfiguration(supabase, validInput({
    paidByPartnerPaymentTermCode: "CO",
    paidByPartnerPaymentMethodCode: "8",
  }));
  const config = supabase.state.organization_integration_connections[0]
    .config_json.purchase_expense_export;

  assert.equal(config.paymentTerms.paid_by_partner, "CO");
  assert.equal(config.paymentMethods.paid_by_partner, 8);
  assert.equal(result.current.paidByPartnerPaymentTermCode, "CO");
});
