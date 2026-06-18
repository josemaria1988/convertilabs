/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  const calls = [];
  const rpcCalls = [];

  function createBuilder(table) {
    const state = {
      table,
      filters: [],
      orderCalls: [],
      selectClause: null,
      limitCount: null,
      operation: "select",
      payload: null,
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
      insert(payload) {
        state.operation = "insert";
        state.payload = payload;
        return builder;
      },
      update(payload) {
        state.operation = "update";
        state.payload = payload;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ op: "eq", column, value });
        return builder;
      },
      neq(column, value) {
        state.filters.push({ op: "neq", column, value });
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
      maybeSingle() {
        return execute("maybeSingle");
      },
      single() {
        return execute("single");
      },
      then(resolve, reject) {
        return execute("then").then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    calls,
    rpcCalls,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
      rpc(name, params) {
        rpcCalls.push({ name, params });
        return Promise.resolve({ data: `${name}-result`, error: null });
      },
    },
  };
}

function rowsForDashboard(query) {
  const now = "2026-06-18T10:00:00.000Z";

  if (query.table === "v_open_items_outstanding") {
    return {
      count: 2,
      error: null,
      data: [
        {
          open_item_id: "open-payable",
          counterparty_name: "Proveedor Ruta",
          document_role: "purchase",
          due_date: "2026-06-30",
          days_overdue: 0,
          currency_code: "USD",
          outstanding_amount: 200,
          status: "open",
        },
        {
          open_item_id: "open-receivable",
          counterparty_name: "Cliente Puerto",
          document_role: "sale",
          due_date: "2026-06-28",
          days_overdue: 0,
          currency_code: "USD",
          outstanding_amount: 1000,
          status: "open",
        },
      ],
    };
  }

  if (query.table === "treasury_bank_accounts") {
    return {
      error: null,
      data: [{
        id: "bank-1",
        bank_name: "Banco Test",
        name: "Cuenta USD",
        account_number: "123",
        currency_code: "USD",
        account_type: "checking",
        current_balance: 7000,
        balance_date: "2026-06-18",
        notes: null,
        created_at: now,
        updated_at: now,
      }],
    };
  }

  if (query.table === "treasury_bank_balance_snapshots") {
    return { error: null, data: [] };
  }

  if (query.table === "treasury_vales") {
    return {
      error: null,
      data: [{
        id: "vale-1",
        bank_account_id: "bank-1",
        bank_name: "Banco Test",
        operation_number: "OP-1",
        internal_reference: null,
        currency_code: "USD",
        original_principal: 5000,
        current_principal: 5000,
        status: "active",
        source: "manual",
        source_text: null,
        notes: null,
        created_at: now,
        updated_at: now,
      }],
    };
  }

  if (query.table === "treasury_vale_terms") {
    return {
      error: null,
      data: [{
        id: "term-1",
        vale_id: "vale-1",
        sequence: 1,
        principal_amount: 5000,
        expected_interest_amount: 180,
        expected_fees_amount: 0,
        expected_partial_principal_payment: 0,
        issue_date: "2026-05-25",
        due_date: "2026-06-25",
        planned_action: "renew",
        renewal_offered: true,
        renewal_confirmed: false,
        expected_new_due_date: "2026-07-25",
        expected_new_principal_amount: 5000,
        status: "pending",
        source: "manual",
        source_text: null,
        notes: null,
        created_at: now,
        updated_at: now,
      }],
    };
  }

  if (query.table === "treasury_vale_events") {
    return { error: null, data: [] };
  }

  if (query.table === "treasury_manual_receivables") {
    return {
      error: null,
      data: [{
        id: "manual-1",
        customer_name: "Cliente Manual",
        document_number: "F-1",
        description: null,
        currency_code: "USD",
        amount: 500,
        issue_date: "2026-06-18",
        expected_date: "2026-06-29",
        collected_at: null,
        status: "pending",
        confidence: "probable",
        source: "manual",
        source_text: null,
        notes: null,
        created_at: now,
        updated_at: now,
      }],
    };
  }

  if (query.table === "treasury_reserve_rules") {
    return {
      error: null,
      data: [{
        id: "rule-1",
        currency_code: "USD",
        min_buffer_amount: 1000,
        horizon_days: 45,
        active: true,
      }],
    };
  }

  return { error: null, data: [] };
}

test("treasury repository builds dashboard cash position without adding receivables to current cash", async () => {
  const { loadTreasuryDashboard } = require("@/modules/treasury");
  const { supabase } = createSupabaseStub(rowsForDashboard);

  const dashboard = await loadTreasuryDashboard(supabase, {
    organizationId: "org-1",
    organizationSlug: "rontil",
    today: "2026-06-18",
  });
  const usd = dashboard.currencies.find((summary) => summary.currencyCode === "USD");

  assert.equal(dashboard.isAvailable, true);
  assert.equal(usd.bankBalanceMinor, 700000n);
  assert.equal(usd.conservativeOutflow45Minor, 518000n);
  assert.equal(usd.conservativeAvailableCashMinor, 62000n);
  assert.equal(usd.confirmedReceivables30Minor, 100000n);
  assert.equal(usd.probableReceivables30Minor, 50000n);
  assert.ok(dashboard.alerts.some((alert) => alert.key === "renewal-unconfirmed:term-1"));
});

test("treasury repository createVale creates root, first term and created event", async () => {
  const { createTreasuryVale } = require("@/modules/treasury");
  const { calls, supabase } = createSupabaseStub((query) => {
    if (query.table === "treasury_vales" && query.operation === "insert") {
      return { data: { id: "vale-created" }, error: null };
    }

    if (query.table === "treasury_vale_terms" && query.operation === "insert") {
      return { data: { id: "term-created" }, error: null };
    }

    return { data: null, error: null };
  });

  const valeId = await createTreasuryVale(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    bankName: "Banco Test",
    currencyCode: "USD",
    originalPrincipal: 5000,
    dueDate: "2026-06-25",
    expectedInterestAmount: 180,
    plannedAction: "renew",
  });
  const termInsert = calls.find((call) =>
    call.table === "treasury_vale_terms" && call.operation === "insert");
  const eventInsert = calls.find((call) =>
    call.table === "treasury_vale_events" && call.operation === "insert");

  assert.equal(valeId, "vale-created");
  assert.equal(termInsert.payload.sequence, 1);
  assert.equal(termInsert.payload.created_by, "user-1");
  assert.equal(termInsert.payload.due_date, "2026-06-25");
  assert.equal(eventInsert.payload.event_type, "created");
  assert.equal(eventInsert.payload.vale_term_id, "term-created");
});

test("treasury repository renewal and closure use transactional RPCs", async () => {
  const {
    recordTreasuryValeClosure,
    recordTreasuryValeRenewal,
  } = require("@/modules/treasury");
  const { rpcCalls, supabase } = createSupabaseStub(() => ({ data: null, error: null }));

  await recordTreasuryValeRenewal(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    valeId: "vale-1",
    valeTermId: "term-1",
    eventDate: "2026-06-25",
    interestPaidAmount: 180,
    feesPaidAmount: 0,
    principalPaidAmount: 1000,
    newPrincipalAmount: 4000,
    newDueDate: "2026-07-25",
  });
  await recordTreasuryValeClosure(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    valeId: "vale-2",
    valeTermId: "term-2",
    eventDate: "2026-06-30",
    principalPaidAmount: 5000,
    interestPaidAmount: 180,
    feesPaidAmount: 20,
  });

  assert.deepEqual(rpcCalls.map((call) => call.name), [
    "treasury_record_vale_renewal",
    "treasury_record_vale_closure",
  ]);
  assert.equal(rpcCalls[0].params.p_new_due_date, "2026-07-25");
  assert.equal(rpcCalls[1].params.p_principal_paid_amount, 5000);
});
