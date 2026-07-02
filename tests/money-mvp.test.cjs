/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  const calls = [];

  function createBuilder(table) {
    const state = {
      table,
      filters: [],
      orderCalls: [],
      selectClause: null,
      limitCount: null,
    };

    const snapshot = (mode) => ({
      ...state,
      filters: [...state.filters],
      orderCalls: [...state.orderCalls],
      mode,
    });
    const execute = (mode) => {
      const query = snapshot(mode);
      calls.push(query);
      return Promise.resolve(resolver(query));
    };

    const builder = {
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return builder;
      },
      order(column, options) {
        state.orderCalls.push({ column, options });
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      then(resolve, reject) {
        return execute("then").then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    calls,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function hasFilter(query, column, value) {
  return query.filters.some((filter) =>
    filter.column === column && filter.value === value);
}

function moneyRow(overrides = {}) {
  return {
    open_item_id: "open-1",
    party_id: "party-customer",
    work_unit_id: "work-1",
    work_unit_name: "Trabajo Nueva Palmira",
    work_unit_code: "NP-2026-001",
    counterparty_type: "customer",
    counterparty_id: "customer-1",
    counterparty_name: "Cliente Nueva Palmira",
    counterparty_tax_id_normalized: "210000000019",
    source_document_id: "doc-sale",
    document_role: "sale",
    document_type: "sale_invoice",
    issue_date: "2026-06-10",
    due_date: "2026-06-15",
    days_overdue: 2,
    currency_code: "UYU",
    outstanding_amount: 1000,
    status: "open",
    settlement_count: 0,
    ...overrides,
  };
}

test("Money MVP summarizes receivables, payables, overdue and work-unit balances", async () => {
  const { loadMoneyDashboard } = require("@/modules/money");
  const { calls, supabase } = createSupabaseStub((query) => {
    if (query.table === "v_open_items_outstanding") {
      assert.ok(hasFilter(query, "organization_id", "org-1"));
      return {
        data: [
          moneyRow(),
          moneyRow({
            open_item_id: "open-2",
            party_id: "party-vendor",
            counterparty_type: "vendor",
            counterparty_id: "vendor-1",
            counterparty_name: "Proveedor Ruta",
            source_document_id: "doc-purchase",
            document_role: "purchase",
            document_type: "purchase_invoice",
            due_date: "2026-06-20",
            days_overdue: 0,
            outstanding_amount: 400,
            settlement_count: 1,
          }),
        ],
        error: null,
      };
    }

    return { data: [], error: null };
  });

  const data = await loadMoneyDashboard(supabase, {
    organizationId: "org-1",
    organizationSlug: "rontil",
    today: "2026-06-17",
  });

  assert.equal(data.isAvailable, true);
  assert.equal(data.summary.receivableCount, 1);
  assert.equal(data.summary.receivableAmount, 1000);
  assert.equal(data.summary.payableCount, 1);
  assert.equal(data.summary.payableAmount, 400);
  assert.equal(data.summary.overdueCount, 1);
  assert.equal(data.summary.dueSoonCount, 1);
  assert.equal(data.summary.netPosition, 600);
  assert.equal(data.byParty.length, 2);
  assert.equal(data.byWorkUnit[0].label, "Trabajo Nueva Palmira");
  assert.equal(data.byWorkUnit[0].outstandingAmount, 1400);
  assert.ok(calls[0].selectClause.includes("work_unit_id"));
});

test("Money MVP filters by work unit and unavailable read model degrades safely", async () => {
  const { loadMoneyDashboard } = require("@/modules/money");
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "v_open_items_outstanding") {
      assert.ok(hasFilter(query, "work_unit_id", "work-1"));
      return {
        data: [moneyRow()],
        error: null,
      };
    }

    return { data: [], error: null };
  });

  const filtered = await loadMoneyDashboard(supabase, {
    organizationId: "org-1",
    organizationSlug: "rontil",
    workUnitId: "work-1",
    today: "2026-06-17",
  });

  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.summary.workUnitsWithBalance, 1);

  const { supabase: missingSupabase } = createSupabaseStub(() => ({
    data: null,
    error: {
      code: "42P01",
      message: "relation v_open_items_outstanding does not exist",
    },
  }));
  const missing = await loadMoneyDashboard(missingSupabase, {
    organizationId: "org-1",
    organizationSlug: "rontil",
    today: "2026-06-17",
  });

  assert.equal(missing.isAvailable, false);
  assert.equal(missing.items.length, 0);
});

test("Money MVP falls back when production read model lacks work unit columns", async () => {
  const { loadMoneyDashboard } = require("@/modules/money");
  let callCount = 0;
  const { calls, supabase } = createSupabaseStub((query) => {
    callCount += 1;

    if (callCount === 1) {
      return {
        data: null,
        error: {
          code: "PGRST204",
          message: "Could not find the 'work_unit_id' column of 'v_open_items_outstanding' in the schema cache",
        },
      };
    }

    return {
      data: [{
        open_item_id: "open-legacy",
        party_id: "party-customer",
        counterparty_type: "customer",
        counterparty_id: "customer-1",
        counterparty_name: "Cliente Legacy",
        counterparty_tax_id_normalized: "210000000019",
        source_document_id: "doc-sale",
        document_role: "sale",
        document_type: "sale_invoice",
        issue_date: "2026-06-10",
        due_date: "2026-06-20",
        days_overdue: 0,
        currency_code: "UYU",
        outstanding_amount: 1200,
        status: "open",
        settlement_count: 0,
      }],
      error: null,
    };
  });

  const data = await loadMoneyDashboard(supabase, {
    organizationId: "org-1",
    organizationSlug: "rontil",
    today: "2026-06-17",
  });

  assert.equal(data.isAvailable, true);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].workUnitId, undefined);
  assert.equal(data.summary.receivableAmount, 1200);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].selectClause.includes("work_unit_id"));
  assert.ok(!calls[1].selectClause.includes("work_unit_id"));
});

test("PR-06 money read model exposes work unit context in schema and migration", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const schemaSql = fs.readFileSync(
    path.join(projectRoot, "db", "schema", "09_accounting_read_models.sql"),
    "utf8",
  );
  const migrationSql = fs.readFileSync(
    path.join(projectRoot, "supabase", "migrations", "20260617_pr06_money_work_unit_read_model.sql"),
    "utf8",
  );

  for (const sql of [schemaSql, migrationSql]) {
    assert.match(sql, /loi\.work_unit_id/);
    assert.match(sql, /wu\.name as work_unit_name/);
    assert.match(sql, /left join public\.work_units as wu/);
  }
});
