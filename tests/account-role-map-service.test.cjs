/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function account(overrides = {}) {
  return {
    id: overrides.id || "acct-1",
    organization_id: overrides.organization_id || "org-1",
    code: overrides.code || "5.2.1",
    name: overrides.name || "Gastos administrativos",
    account_type: overrides.account_type || "expense",
    normal_side: overrides.normal_side || "debit",
    is_postable: true,
    is_active: true,
    provider_managed: true,
    source_provider: "zetasoftware",
    external_code: overrides.external_code || overrides.code || "5.2.1",
    is_imputable: true,
    literal_tributario: null,
    provider_meta_json: {},
    metadata: {},
    ...overrides,
  };
}

function createFakeSupabase(initial = {}) {
  let sequence = 0;
  const state = {
    chart_of_accounts: [...(initial.chart_of_accounts || [])],
    account_role_bindings: [...(initial.account_role_bindings || [])],
    organization_integration_connections: initial.organization_integration_connections || [
      {
        id: "conn-1",
        organization_id: "org-1",
        provider: "zetasoftware",
        status: "connected",
      },
    ],
    audit_log: [...(initial.audit_log || [])],
  };

  class Builder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.payload = null;
      this.upsertConflict = null;
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value, kind: "eq" });
      return this;
    }

    in(field, values) {
      this.filters.push({ field, values, kind: "in" });
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    maybeSingle() {
      const rows = this.filterRows();
      return Promise.resolve({ data: rows[0] || null, error: null });
    }

    single() {
      if (this.operation === "upsert") {
        const result = this.execute();
        return Promise.resolve({
          data: Array.isArray(result.data) ? result.data[0] || null : result.data,
          error: result.error,
        });
      }

      const rows = this.filterRows();
      return Promise.resolve({ data: rows[0] || null, error: null });
    }

    insert(payload) {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        state[this.table].push({
          id: row.id || `${this.table}-${++sequence}`,
          ...row,
        });
      }

      return Promise.resolve({ data: null, error: null });
    }

    update(payload) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload, options = {}) {
      this.operation = "upsert";
      this.payload = payload;
      this.upsertConflict = options.onConflict;
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
        const saved = [];

        for (const row of rows) {
          let existing = null;

          if (this.table === "account_role_bindings") {
            existing = state[this.table].find((candidate) =>
              candidate.organization_id === row.organization_id
              && candidate.binding_key === row.binding_key,
            );
          }

          if (existing) {
            Object.assign(existing, row);
            saved.push(existing);
          } else {
            const inserted = {
              id: row.id || `${this.table}-${++sequence}`,
              created_at: "2026-04-19T00:00:00Z",
              ...row,
            };
            state[this.table].push(inserted);
            saved.push(inserted);
          }
        }

        return { data: saved, error: null };
      }

      return { data: this.filterRows(), error: null };
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

test("account role map rejects non imputable accounts", async () => {
  const {
    upsertAccountRoleMapping,
  } = require("@/modules/accounting/account-role-map-service");
  const supabase = createFakeSupabase({
    chart_of_accounts: [
      account({
        id: "acct-non-imputable",
        is_imputable: false,
      }),
    ],
  });

  await assert.rejects(
    upsertAccountRoleMapping(supabase, {
      organizationId: "org-1",
      accountRoleCode: "purchase_expense_default",
      chartAccountId: "acct-non-imputable",
      actorProfileId: "user-1",
    }),
    /cuentas imputables/i,
  );
});

test("account role map rejects accounts from another organization", async () => {
  const {
    upsertAccountRoleMapping,
  } = require("@/modules/accounting/account-role-map-service");
  const supabase = createFakeSupabase({
    chart_of_accounts: [
      account({
        id: "acct-other",
        organization_id: "org-2",
      }),
    ],
  });

  await assert.rejects(
    upsertAccountRoleMapping(supabase, {
      organizationId: "org-1",
      accountRoleCode: "purchase_expense_default",
      chartAccountId: "acct-other",
      actorProfileId: "user-1",
    }),
    /no existe en esta organizacion/i,
  );
});

test("account role map upsert is idempotent and records audit", async () => {
  const {
    upsertAccountRoleMapping,
    listAccountRoleMappings,
  } = require("@/modules/accounting/account-role-map-service");
  const supabase = createFakeSupabase({
    chart_of_accounts: [account({ id: "acct-expense" })],
  });

  await upsertAccountRoleMapping(supabase, {
    organizationId: "org-1",
    accountRoleCode: "purchase_expense_default",
    chartAccountId: "acct-expense",
    actorProfileId: "user-1",
  });
  await upsertAccountRoleMapping(supabase, {
    organizationId: "org-1",
    accountRoleCode: "purchase_expense_default",
    chartAccountId: "acct-expense",
    actorProfileId: "user-1",
  });
  const mappings = await listAccountRoleMappings(supabase, {
    organizationId: "org-1",
  });

  assert.equal(supabase.state.account_role_bindings.length, 1);
  assert.equal(supabase.state.audit_log.length, 2);
  assert.equal(
    mappings.find((entry) => entry.accountRoleCode === "purchase_expense_default").account.id,
    "acct-expense",
  );
});

test("account role map suggestions are not saved automatically", async () => {
  const {
    suggestAccountRoleMappings,
  } = require("@/modules/accounting/account-role-map-service");
  const supabase = createFakeSupabase({
    chart_of_accounts: [
      account({
        id: "acct-payable",
        code: "2.1.1",
        name: "Proveedores comerciales",
        account_type: "liability",
        normal_side: "credit",
      }),
    ],
  });
  const suggestions = await suggestAccountRoleMappings(supabase, {
    organizationId: "org-1",
  });

  assert.ok(suggestions.some((entry) => entry.accountRoleCode === "accounts_payable"));
  assert.equal(supabase.state.account_role_bindings.length, 0);
});

test("local account in Zeta organization returns bridge warning", async () => {
  const {
    upsertAccountRoleMapping,
  } = require("@/modules/accounting/account-role-map-service");
  const supabase = createFakeSupabase({
    chart_of_accounts: [
      account({
        id: "acct-local",
        provider_managed: false,
        source_provider: null,
        external_code: null,
      }),
    ],
  });
  const saved = await upsertAccountRoleMapping(supabase, {
    organizationId: "org-1",
    accountRoleCode: "purchase_expense_default",
    chartAccountId: "acct-local",
    actorProfileId: "user-1",
  });

  assert.ok(saved.warnings.includes("local_account_not_bridge_ready"));
});
