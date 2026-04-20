/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function candidate(overrides = {}) {
  return {
    external_code: "5.2.1.01",
    name: "Gastos administrativos",
    display_code_name: "5.2.1.01 Gastos administrativos",
    is_imputable: true,
    external_parent_code: null,
    account_level: 4,
    literal_tributario: null,
    uses_cost_centers: false,
    provider_meta: {
      capitulo: "Egresos",
      grupo_codigo: "GASTOS",
      grupo_nombre: "Gastos",
      codigo_presentacion: "5.2.1",
      moneda_codigo: 1,
      moneda_simbolo: "$",
      moneda_nombre: "Peso Uruguayo",
      moneda_abreviacion: "UYU",
      calcula_dif_cambio: false,
      notas: "",
    },
    ...overrides,
  };
}

function createFakeSupabase(initial = {}) {
  let sequence = 0;
  const state = {
    chart_of_accounts: [...(initial.chart_of_accounts || [])],
    integration_entity_links: [...(initial.integration_entity_links || [])],
  };

  class Builder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.payload = null;
    }

    select() {
      this.operation = "select";
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    in(field, values) {
      this.filters.push({ field, values, kind: "in" });
      return this;
    }

    limit() {
      return this;
    }

    maybeSingle() {
      const rows = this.filterRows();
      return { data: rows[0] || null, error: null };
    }

    insert(payload) {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        state[this.table].push({
          id: row.id || `${this.table}-${++sequence}`,
          ...row,
        });
      }
      return { data: null, error: null };
    }

    update(payload) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload) {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        const existing = state[this.table].find((candidateRow) => {
          if (this.table === "chart_of_accounts") {
            return candidateRow.organization_id === row.organization_id
              && candidateRow.source_provider === row.source_provider
              && candidateRow.external_code === row.external_code;
          }

          return candidateRow.organization_id === row.organization_id
            && candidateRow.provider === row.provider
            && candidateRow.external_entity_type === row.external_entity_type
            && candidateRow.external_key === row.external_key;
        });

        if (existing) {
          Object.assign(existing, row);
        } else {
          state[this.table].push({
            id: row.id || `${this.table}-${++sequence}`,
            ...row,
          });
        }
      }

      return { data: null, error: null };
    }

    then(resolve, reject) {
      try {
        resolve(this.execute());
      } catch (error) {
        reject(error);
      }
    }

    execute() {
      if (this.operation !== "update") {
        return { data: this.filterRows(), error: null };
      }

      const rows = this.filterRows();
      for (const row of rows) {
        Object.assign(row, this.payload);
      }

      return { data: rows, error: null };
    }

    filterRows() {
      return state[this.table].filter((row) =>
        this.filters.every((filter) => {
          if (filter.kind === "in") {
            return filter.values.includes(row[filter.field]);
          }

          return row[filter.field] === filter.value;
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

test("Zeta chart account materialization is idempotent", async () => {
  const { materializeZetaChartAccounts } = require("@/modules/integrations/zeta/services/materialize-chart-accounts");
  const supabase = createFakeSupabase();

  const first = await materializeZetaChartAccounts(supabase, {
    organizationId: "org-1",
    candidates: [candidate()],
    runId: "run-1",
  });
  const second = await materializeZetaChartAccounts(supabase, {
    organizationId: "org-1",
    candidates: [candidate()],
    runId: "run-2",
  });

  assert.equal(first.upserted, 1);
  assert.equal(second.unchanged, 1);
  assert.equal(supabase.state.chart_of_accounts.length, 1);
  assert.equal(supabase.state.chart_of_accounts[0].provider_managed, true);
  assert.equal(supabase.state.chart_of_accounts[0].source_provider, "zetasoftware");
});

test("Zeta chart account materialization never modifies provider_managed false rows", async () => {
  const { materializeZetaChartAccounts } = require("@/modules/integrations/zeta/services/materialize-chart-accounts");
  const supabase = createFakeSupabase({
    chart_of_accounts: [{
      id: "local-zeta-marked",
      organization_id: "org-1",
      code: "5.2.1.01",
      name: "Cuenta protegida",
      account_type: "expense",
      normal_side: "debit",
      is_postable: true,
      is_active: true,
      provider_managed: false,
      source_provider: "zetasoftware",
      external_code: "5.2.1.01",
      metadata: {},
      provider_meta_json: {},
    }],
  });

  const result = await materializeZetaChartAccounts(supabase, {
    organizationId: "org-1",
    candidates: [candidate({ name: "Nuevo nombre Zeta" })],
    runId: "run-1",
  });

  assert.equal(result.conflict, 1);
  assert.equal(supabase.state.chart_of_accounts[0].name, "Cuenta protegida");
  assert.equal(supabase.state.integration_entity_links[0].status, "conflict");
});

test("Zeta chart account materialization records local code conflicts without overwriting", async () => {
  const { materializeZetaChartAccounts } = require("@/modules/integrations/zeta/services/materialize-chart-accounts");
  const supabase = createFakeSupabase({
    chart_of_accounts: [{
      id: "local-account",
      organization_id: "org-1",
      code: "5.2.1.01",
      name: "Cuenta local manual",
      account_type: "expense",
      normal_side: "debit",
      is_postable: true,
      is_active: true,
      provider_managed: false,
      source_provider: null,
      external_code: null,
      metadata: {},
      provider_meta_json: {},
    }],
  });

  const result = await materializeZetaChartAccounts(supabase, {
    organizationId: "org-1",
    candidates: [candidate()],
    runId: "run-1",
  });

  assert.equal(result.conflict, 1);
  assert.equal(supabase.state.chart_of_accounts.length, 1);
  assert.equal(supabase.state.chart_of_accounts[0].name, "Cuenta local manual");
  assert.equal(supabase.state.integration_entity_links[0].local_entity_id, "local-account");
});

test("Zeta chart account materialization counters add up", async () => {
  const { materializeZetaChartAccounts } = require("@/modules/integrations/zeta/services/materialize-chart-accounts");
  const supabase = createFakeSupabase({
    chart_of_accounts: [{
      id: "local-account",
      organization_id: "org-1",
      code: "5.2.1.02",
      name: "Cuenta local manual",
      account_type: "expense",
      normal_side: "debit",
      is_postable: true,
      is_active: true,
      provider_managed: false,
      source_provider: null,
      external_code: null,
      metadata: {},
      provider_meta_json: {},
    }],
  });

  const result = await materializeZetaChartAccounts(supabase, {
    organizationId: "org-1",
    candidates: [
      candidate({ external_code: "5.2.1.01" }),
      candidate({ external_code: "5.2.1.02" }),
    ],
    runId: "run-1",
  });

  assert.equal(result.upserted + result.unchanged + result.conflict + result.failed, 2);
  assert.equal(result.upserted, 1);
  assert.equal(result.conflict, 1);
});
