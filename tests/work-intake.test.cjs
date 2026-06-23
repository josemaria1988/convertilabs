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
      selectClause: null,
      limitCount: null,
    };

    const snapshot = (mode) => ({
      ...state,
      filters: [...state.filters],
      inFilters: [...state.inFilters],
      orderCalls: [...state.orderCalls],
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
      update(payload) {
        state.mutation = "update";
        state.payload = payload;
        return builder;
      },
      upsert(payload, options) {
        state.mutation = "upsert";
        state.payload = payload;
        state.options = options;
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

function intakeRow(overrides = {}) {
  return {
    id: "intake-1",
    organization_id: "org-1",
    source_type: "email",
    source_ref_id: "message-1",
    integration_raw_record_id: null,
    interaction_id: null,
    external_source_key: "message-1",
    idempotency_key: "message-1",
    raw_text: "Necesito cotizar Nueva Palmira",
    title: "Cotizacion Nueva Palmira",
    description: "Necesito cotizar Nueva Palmira",
    customer_name: "Cliente SA",
    customer_email: "cliente@example.com",
    customer_phone: null,
    party_id: "party-1",
    contact_id: null,
    work_unit_id: "work-1",
    location_text: "Nueva Palmira",
    estimated_amount: 12000,
    currency_code: "UYU",
    requested_date: "2026-06-23",
    status: "linked_to_work",
    priority: "normal",
    assigned_to_member_id: null,
    next_action: "Llamar al cliente",
    due_date: "2026-06-24",
    metadata_json: {},
    created_by: "user-1",
    created_at: "2026-06-23T10:00:00.000Z",
    updated_at: "2026-06-23T10:00:00.000Z",
    ...overrides,
  };
}

test("work intake builds normalized web and email payloads", () => {
  const {
    buildEmailWorkIntakeInput,
    buildRontilWebWorkIntakeInput,
    validateRontilWebWorkIntakePayload,
  } = require("@/modules/work-intake");
  const webPayload = {
    quote_id: "Q-100",
    customer: {
      name: " Cliente Nueva Palmira ",
      email: "CLIENTE@EXAMPLE.COM",
      phone: "(099) 123 456",
    },
    text: " Cotizar entrega ",
    total: "12.500,75",
    currency: "uyu",
    location: "Nueva Palmira",
  };
  const validation = validateRontilWebWorkIntakePayload(webPayload);

  assert.equal(validation.ok, true);

  const webInput = buildRontilWebWorkIntakeInput({
    organizationId: "org-1",
    payload: webPayload,
    integrationRawRecordId: "raw-1",
    idempotencyKey: "idem-1",
  });

  assert.equal(webInput.sourceType, "web_form");
  assert.equal(webInput.sourceRefId, "Q-100");
  assert.equal(webInput.customerEmail, "cliente@example.com");
  assert.equal(webInput.customerPhone, "099123456");
  assert.equal(webInput.estimatedAmount, 12500.75);
  assert.equal(webInput.currencyCode, "UYU");
  assert.equal(webInput.status, "needs_review");

  const emailInput = buildEmailWorkIntakeInput({
    organizationId: "org-1",
    messageId: "<message-1@example.com>",
    subject: "Nueva Palmira",
    from: "ventas@cliente.com",
    bodyText: "Solicito cotizacion",
  });

  assert.equal(emailInput.sourceType, "email");
  assert.equal(emailInput.idempotencyKey, "<message-1@example.com>");
  assert.equal(emailInput.customerEmail, "ventas@cliente.com");
  assert.equal(emailInput.status, "needs_review");
});

test("work intake rejects web payloads without content or customer signal", () => {
  const { validateRontilWebWorkIntakePayload } = require("@/modules/work-intake");

  assert.deepEqual(validateRontilWebWorkIntakePayload(null), {
    ok: false,
    code: "invalid_payload",
    message: "El payload debe ser un objeto JSON.",
  });
  assert.equal(validateRontilWebWorkIntakePayload({ customer_name: "Cliente" }).code, "missing_content");
  assert.equal(validateRontilWebWorkIntakePayload({ text: "Cotizar" }).code, "missing_customer");
});

test("work intake create-or-reuse preserves idempotency and writes business event", async () => {
  const { createOrReuseWorkIntakeItem } = require("@/modules/work-intake");
  const writes = [];
  const { calls, supabase } = createSupabaseStub((query) => {
    if (query.table === "work_intake_items" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "work_intake_items" && query.mutation === "insert") {
      writes.push(query);
      return { data: { id: "intake-1" }, error: null };
    }

    if (query.table === "business_events" && query.mutation === "insert") {
      writes.push(query);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });

  const result = await createOrReuseWorkIntakeItem(supabase, {
    organizationId: "org-1",
    sourceType: "web_form",
    title: "Nueva Palmira",
    customerName: "Cliente SA",
    idempotencyKey: "idem-1",
    externalSourceKey: "Q-100",
    createdBy: "user-1",
  });

  assert.deepEqual(result, { id: "intake-1", created: true });
  assert.ok(calls.some((query) =>
    query.table === "work_intake_items" && hasFilter(query, "idempotency_key", "idem-1")));

  const intakeInsert = writes.find((query) => query.table === "work_intake_items");
  assert.equal(intakeInsert.payload.title, "Nueva Palmira");
  assert.equal(intakeInsert.payload.status, "captured");
  assert.equal(intakeInsert.payload.customer_name, "Cliente SA");

  const eventInsert = writes.find((query) => query.table === "business_events");
  assert.equal(eventInsert.payload.event_type, "administrative_decision_recorded");
  assert.equal(eventInsert.payload.metadata_json.event_code, "work_intake_created");
  assert.equal(eventInsert.payload.metadata_json.work_intake_item_id, "intake-1");
});

test("work intake create-or-reuse returns duplicate without inserting", async () => {
  const { createOrReuseWorkIntakeItem } = require("@/modules/work-intake");
  const { calls, supabase } = createSupabaseStub((query) => {
    if (query.table === "work_intake_items" && query.mode === "maybeSingle") {
      return { data: { id: "intake-existing" }, error: null };
    }

    throw new Error(`Unexpected query ${query.table}`);
  });

  const result = await createOrReuseWorkIntakeItem(supabase, {
    organizationId: "org-1",
    title: "Nueva Palmira",
    idempotencyKey: "idem-1",
  });

  assert.deepEqual(result, { id: "intake-existing", created: false });
  assert.equal(calls.length, 1);
});

test("work intake follow-up task links task to party and work unit", async () => {
  const { createWorkIntakeFollowUpTask } = require("@/modules/work-intake");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "work_intake_items" && query.mode === "maybeSingle") {
      return { data: intakeRow(), error: null };
    }

    if (query.table === "parties") {
      return {
        data: [{ id: "party-1", display_name: "Cliente SA", legal_name: null }],
        error: null,
      };
    }

    if (query.table === "work_units") {
      return {
        data: [{ id: "work-1", name: "Nueva Palmira", code: "NP" }],
        error: null,
      };
    }

    if (query.table === "tasks" && query.mutation === "insert") {
      writes.push(query);
      return { data: { id: "task-1" }, error: null };
    }

    if (query.table === "business_events" && query.mutation === "insert") {
      writes.push(query);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });

  const taskId = await createWorkIntakeFollowUpTask(supabase, {
    organizationId: "org-1",
    intakeId: "intake-1",
    dueDate: "2026-06-25",
    actorId: "user-1",
  });

  assert.equal(taskId, "task-1");
  const taskInsert = writes.find((query) => query.table === "tasks");
  assert.equal(taskInsert.payload.title, "Llamar al cliente");
  assert.equal(taskInsert.payload.party_id, "party-1");
  assert.equal(taskInsert.payload.work_unit_id, "work-1");
  assert.equal(taskInsert.payload.metadata_json.work_intake_item_id, "intake-1");
});
