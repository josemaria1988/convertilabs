/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  const calls = [];

  function createBuilder(table) {
    const state = {
      table,
      mutation: null,
      payload: null,
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

test("PR-07 task payload keeps canonical status, priority and links", () => {
  const { buildTaskPayload } = require("@/modules/operations");

  const payload = buildTaskPayload({
    organizationId: "org-1",
    actorId: "user-1",
    title: "  Llamar al cliente  ",
    status: "blocked",
    priority: "urgent",
    dueDate: "2026-06-20",
    partyId: "party-1",
    workUnitId: "work-1",
    documentId: "doc-1",
    blockedReason: "Falta confirmacion",
  });

  assert.equal(payload.title, "Llamar al cliente");
  assert.equal(payload.status, "blocked");
  assert.equal(payload.priority, "urgent");
  assert.equal(payload.party_id, "party-1");
  assert.equal(payload.work_unit_id, "work-1");
  assert.equal(payload.document_id, "doc-1");
  assert.equal(payload.blocked_reason, "Falta confirmacion");
});

test("PR-08 creates a process with a published version and ordered steps", async () => {
  const { createProcessWithInitialVersion } = require("@/modules/operations");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.mutation) {
      writes.push(query);
    }

    if (query.table === "processes" && query.mutation === "insert") {
      return { data: { id: "process-1" }, error: null };
    }

    if (query.table === "process_versions" && query.mutation === "insert") {
      return { data: { id: "version-1" }, error: null };
    }

    return { data: null, error: null };
  });

  const processId = await createProcessWithInitialVersion(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    name: " Pago a proveedores ",
    criticality: "critical",
    currentOwnerLabel: "Mama",
    stepsText: "1. Revisar facturas\n2. Confirmar saldos\n3. Ejecutar pago",
  });

  assert.equal(processId, "process-1");
  const processInsert = writes.find((query) => query.table === "processes");
  assert.equal(processInsert.payload.name, "Pago a proveedores");
  assert.equal(processInsert.payload.criticality, "critical");
  assert.equal(processInsert.payload.current_owner_label, "Mama");

  const versionInsert = writes.find((query) => query.table === "process_versions");
  assert.equal(versionInsert.payload.process_id, "process-1");
  assert.equal(versionInsert.payload.status, "published");

  const stepsInsert = writes.find((query) => query.table === "process_steps");
  assert.equal(stepsInsert.payload.length, 3);
  assert.equal(stepsInsert.payload[0].title, "Revisar facturas");
  assert.equal(stepsInsert.payload[2].step_number, 3);
});

test("PR-08 starts a process run from the latest published version", async () => {
  const { startProcessRun } = require("@/modules/operations");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.mutation) {
      writes.push(query);
    }

    if (query.table === "processes" && query.mode === "single") {
      assert.ok(hasFilter(query, "organization_id", "org-1"));
      assert.ok(hasFilter(query, "id", "process-1"));
      return { data: { id: "process-1", name: "Pago a proveedores" }, error: null };
    }

    if (query.table === "process_versions" && query.mode === "maybeSingle") {
      return { data: { id: "version-1", version_number: 1 }, error: null };
    }

    if (query.table === "process_runs" && query.mutation === "insert") {
      return { data: { id: "run-1" }, error: null };
    }

    if (query.table === "process_steps" && query.mode === "then") {
      return {
        data: [
          { id: "step-1", step_number: 1, title: "Revisar facturas" },
          { id: "step-2", step_number: 2, title: "Confirmar saldos" },
        ],
        error: null,
      };
    }

    return { data: null, error: null };
  });

  const runId = await startProcessRun(supabase, {
    organizationId: "org-1",
    processId: "process-1",
    dueDate: "2026-06-30",
    actorId: "user-1",
  });

  assert.equal(runId, "run-1");
  const runInsert = writes.find((query) => query.table === "process_runs");
  assert.equal(runInsert.payload.process_version_id, "version-1");
  assert.equal(runInsert.payload.title, "Pago a proveedores");
  assert.equal(runInsert.payload.status, "running");

  const runStepsInsert = writes.find((query) => query.table === "process_run_steps");
  assert.equal(runStepsInsert.payload.length, 2);
  assert.equal(runStepsInsert.payload[0].process_run_id, "run-1");
  assert.equal(runStepsInsert.payload[1].title, "Confirmar saldos");
});

test("PR-08 continuity detects critical undocumented process without future owner", () => {
  const { deriveContinuityRiskSignals } = require("@/modules/operations");

  const risks = deriveContinuityRiskSignals({
    organizationSlug: "rontil",
    processes: [
      {
        id: "process-1",
        name: "Pago a proveedores",
        category: null,
        description: null,
        criticality: "critical",
        status: "active",
        frequency: "monthly",
        currentOwnerLabel: "Mama",
        futureOwnerLabel: null,
        nextRunDate: null,
        publishedVersionCount: 0,
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
    ],
    obligations: [],
    tasks: [
      {
        id: "task-1",
        title: "Conseguir clave",
        description: null,
        status: "blocked",
        priority: "high",
        dueDate: null,
        partyId: null,
        partyName: null,
        workUnitId: null,
        workUnitName: null,
        documentId: null,
        documentName: null,
        blockedReason: "La sabe una sola persona",
        createdAt: "2026-06-17T00:00:00.000Z",
      },
    ],
    captureNotes: [
      {
        id: "note-1",
        title: "Proceso oral",
        rawText: "Solo mama sabe como hacerlo",
        source: "manual",
        status: "captured",
        partyId: null,
        workUnitId: null,
        documentId: null,
        createdAt: "2026-06-17T00:00:00.000Z",
      },
    ],
  });

  assert.ok(risks.some((risk) => risk.key === "process-undocumented-process-1"));
  assert.ok(risks.some((risk) => risk.key === "process-no-future-owner-process-1"));
  assert.ok(risks.some((risk) => risk.key === "blocked-task-task-1"));
  assert.ok(risks.some((risk) => risk.key === "raw-capture-note-1"));
});

test("PR-07 to PR-09 schema and migration define operations and communications tables", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const schemaSql = fs.readFileSync(
    path.join(projectRoot, "db", "schema", "12_operations_communications.sql"),
    "utf8",
  );
  const migrationSql = fs.readFileSync(
    path.join(projectRoot, "supabase", "migrations", "20260617_pr07_pr09_operations_communications.sql"),
    "utf8",
  );

  for (const sql of [schemaSql, migrationSql]) {
    assert.match(sql, /create table if not exists public\.tasks/);
    assert.match(sql, /constraint tasks_status_check check \(status in \('pending', 'in_progress', 'blocked', 'done', 'cancelled'\)\)/);
    assert.match(sql, /create table if not exists public\.process_versions/);
    assert.match(sql, /create table if not exists public\.obligations/);
    assert.match(sql, /create table if not exists public\.capture_notes/);
    assert.match(sql, /create table if not exists public\.continuity_risks/);
    assert.match(sql, /create table if not exists public\.interactions/);
    assert.match(sql, /create table if not exists public\.interaction_links/);
    assert.match(sql, /alter table public\.tasks enable row level security/);
  }

  assert.doesNotMatch(migrationSql, /\\i\s/);
});
