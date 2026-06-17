/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  const calls = [];

  function createBuilder(table) {
    const state = {
      table,
      mutation: null,
      payload: null,
      options: null,
      filters: [],
      inFilters: [],
      orderCalls: [],
      rangeCall: null,
      selectClause: null,
      limitCount: null,
    };

    const snapshot = (mode) => ({
      ...state,
      filters: [...state.filters],
      inFilters: [...state.inFilters],
      orderCalls: [...state.orderCalls],
      rangeCall: state.rangeCall,
      mode,
    });
    const execute = (mode) => {
      const query = snapshot(mode);
      calls.push(query);
      return Promise.resolve(resolver(query));
    };

    const builder = {
      insert(payload) {
        state.mutation = "insert";
        state.payload = payload;
        return builder;
      },
      upsert(payload, options) {
        state.mutation = "upsert";
        state.payload = payload;
        state.options = options;
        return builder;
      },
      update(payload) {
        state.mutation = "update";
        state.payload = payload;
        return builder;
      },
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return builder;
      },
      in(column, values) {
        state.inFilters.push({ column, values });
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
      range(from, to) {
        state.rangeCall = { from, to };
        return builder;
      },
      single() {
        return execute("single");
      },
      maybeSingle() {
        return execute("maybeSingle");
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

function hasInFilter(query, column, values) {
  return query.inFilters.some((filter) =>
    filter.column === column
    && JSON.stringify(filter.values) === JSON.stringify(values));
}

function workUnitRow(overrides = {}) {
  return {
    id: "work-1",
    organization_id: "org-1",
    code: "NP-2026-001",
    name: "Trabajo Nueva Palmira",
    kind: "job",
    status: "active",
    customer_party_id: "party-1",
    start_date: "2026-06-17",
    end_date: null,
    estimated_revenue: 10000,
    estimated_cost: 4000,
    actual_revenue: 7000,
    actual_cost: 2500,
    margin_status: "healthy",
    currency_code: "UYU",
    description: "Primer caso operativo",
    source: "manual",
    created_at: "2026-06-17T10:00:00.000Z",
    updated_at: "2026-06-17T11:00:00.000Z",
    ...overrides,
  };
}

function partyRow(overrides = {}) {
  return {
    id: "party-1",
    display_name: "Cliente Nueva Palmira",
    legal_name: null,
    tax_id: "210000000019",
    status: "active",
    ...overrides,
  };
}

test("Work MVP listing resolves customers and linked document counts", async () => {
  const { listOrganizationWorkUnits } = require("@/modules/work/repository");
  const { calls, supabase } = createSupabaseStub((query) => {
    if (query.table === "work_units") {
      assert.equal(query.mode, "then");
      assert.ok(hasFilter(query, "organization_id", "org-1"));
      return { data: [workUnitRow()], error: null };
    }

    if (query.table === "parties" && hasInFilter(query, "id", ["party-1"])) {
      return { data: [partyRow()], error: null };
    }

    if (query.table === "documents") {
      assert.ok(hasInFilter(query, "work_unit_id", ["work-1"]));
      return {
        data: [
          { id: "doc-1", work_unit_id: "work-1" },
          { id: "doc-2", work_unit_id: "work-1" },
        ],
        error: null,
      };
    }

    if (query.table === "parties") {
      return { data: [partyRow()], error: null };
    }

    return { data: null, error: null };
  });

  const result = await listOrganizationWorkUnits(supabase, "org-1");

  assert.equal(result.isAvailable, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Trabajo Nueva Palmira");
  assert.equal(result.items[0].customer.displayName, "Cliente Nueva Palmira");
  assert.equal(result.items[0].documentCount, 2);
  assert.equal(result.items[0].actualMargin, 4500);
  assert.equal(result.customerOptions.length, 1);
  assert.ok(calls.some((query) =>
    query.table === "work_units" && query.orderCalls[0]?.column === "updated_at"));
});

test("Work MVP detail computes document revenue and cost from linked documents", async () => {
  const { loadWorkUnitDetail } = require("@/modules/work/repository");
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "work_units") {
      assert.equal(query.mode, "maybeSingle");
      assert.ok(hasFilter(query, "organization_id", "org-1"));
      assert.ok(hasFilter(query, "id", "work-1"));
      return { data: workUnitRow({ actual_revenue: 0, actual_cost: 0 }), error: null };
    }

    if (query.table === "documents") {
      assert.ok(hasFilter(query, "work_unit_id", "work-1"));
      return {
        data: [
          {
            id: "doc-sale",
            direction: "sale",
            document_type: "invoice",
            status: "reviewed",
            posting_status: "posted",
            original_filename: "venta.pdf",
            document_date: "2026-06-17",
            document_currency_code: "UYU",
            document_total_amount_original: 7000,
            total_amount_uyu: 7000,
            created_at: "2026-06-17T12:00:00.000Z",
          },
          {
            id: "doc-purchase",
            direction: "purchase",
            document_type: "invoice",
            status: "reviewed",
            posting_status: "posted",
            original_filename: "gasto.pdf",
            document_date: "2026-06-17",
            document_currency_code: "UYU",
            document_total_amount_original: 2500,
            total_amount_uyu: 2500,
            created_at: "2026-06-17T11:30:00.000Z",
          },
        ],
        error: null,
      };
    }

    if (query.table === "parties") {
      return { data: [partyRow()], error: null };
    }

    return { data: null, error: null };
  });

  const detail = await loadWorkUnitDetail(supabase, {
    organizationId: "org-1",
    workUnitId: "work-1",
  });

  assert.ok(detail);
  assert.equal(detail.documents.length, 2);
  assert.equal(detail.documentRevenue, 7000);
  assert.equal(detail.documentCost, 2500);
  assert.equal(detail.documentCount, 2);
});

test("Work MVP creation inserts canonical work unit and business event", async () => {
  const { createWorkUnit } = require("@/modules/work/repository");
  const inserts = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "work_units" && query.mutation === "insert") {
      inserts.push(query);
      return { data: { id: "work-1" }, error: null };
    }

    if (query.table === "business_events" && query.mutation === "insert") {
      inserts.push(query);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });

  const id = await createWorkUnit(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    name: " Trabajo Nueva Palmira ",
    code: "NP-2026-001",
    kind: "job",
    customerPartyId: "party-1",
    startDate: "2026-06-17",
    estimatedRevenue: 10000,
    estimatedCost: 4000,
    currencyCode: "uyu",
    description: " Caso fundacional ",
  });

  assert.equal(id, "work-1");
  const workInsert = inserts.find((query) => query.table === "work_units");
  assert.equal(workInsert.payload.name, "Trabajo Nueva Palmira");
  assert.equal(workInsert.payload.normalized_name, "trabajo nueva palmira");
  assert.equal(workInsert.payload.status, "active");
  assert.equal(workInsert.payload.customer_party_id, "party-1");
  assert.equal(workInsert.payload.currency_code, "UYU");
  assert.equal(workInsert.payload.metadata_json.created_from, "work_mvp");

  const eventInsert = inserts.find((query) => query.table === "business_events");
  assert.equal(eventInsert.payload.event_type, "work_unit_created");
  assert.equal(eventInsert.payload.source_entity_type, "work_unit");
  assert.equal(eventInsert.payload.source_entity_id, "work-1");
  assert.equal(eventInsert.payload.party_id, "party-1");
  assert.equal(eventInsert.payload.work_unit_id, "work-1");
});

test("Work MVP quick customer creation adds party and customer role", async () => {
  const { createCustomerPartyForWorkUnit } = require("@/modules/work/repository");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "parties" && query.mutation === "insert") {
      writes.push(query);
      return { data: { id: "party-1" }, error: null };
    }

    if (query.table === "party_roles" && query.mutation === "upsert") {
      writes.push(query);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });

  const partyId = await createCustomerPartyForWorkUnit(supabase, {
    organizationId: "org-1",
    displayName: " Cliente Nueva Palmira ",
    taxId: "210000000019",
    actorId: "user-1",
  });

  assert.equal(partyId, "party-1");
  const partyInsert = writes.find((query) => query.table === "parties");
  assert.equal(partyInsert.payload.display_name, "Cliente Nueva Palmira");
  assert.equal(partyInsert.payload.tax_id, "210000000019");
  assert.equal(partyInsert.payload.metadata_json.created_from, "work_unit_form");

  const roleUpsert = writes.find((query) => query.table === "party_roles");
  assert.equal(roleUpsert.payload.role_type, "customer");
  assert.equal(roleUpsert.payload.party_id, "party-1");
  assert.equal(roleUpsert.options.onConflict, "organization_id,party_id,role_type");
});

test("Nueva Palmira document association links documents, open items and events to work", async () => {
  const { assignDocumentToWorkUnit } = require("@/modules/work/repository");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "documents" && query.mode === "maybeSingle") {
      return {
        data: {
          id: "doc-sale",
          organization_id: "org-1",
          work_unit_id: null,
          posting_status: "posted_final",
          original_filename: "venta-nueva-palmira.pdf",
          document_date: "2026-06-17",
          party_id: "party-1",
          vendor_party_id: null,
          customer_party_id: "party-1",
        },
        error: null,
      };
    }

    if (query.table === "work_units" && query.mode === "maybeSingle") {
      assert.ok(hasFilter(query, "organization_id", "org-1"));
      assert.ok(hasFilter(query, "id", "work-1"));
      return { data: { id: "work-1", name: "Trabajo Nueva Palmira" }, error: null };
    }

    if (query.table === "ledger_open_items" && query.mode === "then" && !query.mutation) {
      return { data: [{ id: "open-1" }], error: null };
    }

    if (query.mutation === "update" || query.mutation === "upsert" || query.mutation === "insert") {
      writes.push(query);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });

  const result = await assignDocumentToWorkUnit(supabase, {
    organizationId: "org-1",
    documentId: "doc-sale",
    workUnitId: "work-1",
    actorId: "user-1",
  });

  assert.equal(result.workUnitId, "work-1");
  const documentUpdate = writes.find((query) =>
    query.table === "documents" && query.mutation === "update");
  assert.equal(documentUpdate.payload.work_unit_id, "work-1");

  const openItemUpdate = writes.find((query) =>
    query.table === "ledger_open_items" && query.mutation === "update");
  assert.equal(openItemUpdate.payload.work_unit_id, "work-1");

  const settlementUpdate = writes.find((query) =>
    query.table === "ledger_settlement_links"
    && query.mutation === "update"
    && query.inFilters.some((filter) => filter.column === "open_item_id"));
  assert.equal(settlementUpdate.payload.work_unit_id, "work-1");

  const linkUpsert = writes.find((query) =>
    query.table === "entity_links" && query.mutation === "upsert");
  assert.equal(linkUpsert.payload.source_entity_type, "document");
  assert.equal(linkUpsert.payload.target_entity_type, "work_unit");
  assert.equal(linkUpsert.payload.target_entity_id, "work-1");

  const eventInsert = writes.find((query) =>
    query.table === "business_events" && query.mutation === "insert");
  assert.equal(eventInsert.payload.event_type, "other");
  assert.equal(eventInsert.payload.metadata_json.event_code, "document_work_unit_assigned");
  assert.equal(eventInsert.payload.work_unit_id, "work-1");
});
