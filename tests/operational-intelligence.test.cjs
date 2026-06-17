/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(seed = {}) {
  const calls = [];
  const state = {
    operational_suggestions: seed.operational_suggestions ?? [],
    tasks: seed.tasks ?? [],
    entity_links: seed.entity_links ?? [],
  };

  function createBuilder(table) {
    const query = {
      table,
      mutation: null,
      payload: null,
      filters: [],
      selectClause: null,
      limitCount: null,
    };

    function snapshot(mode) {
      return {
        ...query,
        filters: [...query.filters],
        mode,
      };
    }

    function applyFilters(rows) {
      return rows.filter((row) =>
        query.filters.every((filter) => row[filter.column] === filter.value));
    }

    function execute(mode) {
      const call = snapshot(mode);
      calls.push(call);

      if (query.mutation === "insert") {
        const rows = Array.isArray(query.payload) ? query.payload : [query.payload];
        const saved = rows.map((row, index) => ({
          id: row.id ?? `${table}-${state[table].length + index + 1}`,
          ...row,
        }));
        state[table].push(...saved);
        return Promise.resolve({
          data: mode === "single" ? saved[0] : saved,
          error: null,
        });
      }

      if (query.mutation === "update") {
        const rows = applyFilters(state[table]);
        for (const row of rows) {
          Object.assign(row, query.payload);
        }
        return Promise.resolve({
          data: mode === "single" ? rows[0] ?? null : rows,
          error: null,
        });
      }

      const rows = applyFilters(state[table]);
      return Promise.resolve({
        data: mode === "maybeSingle" || mode === "single" ? rows[0] ?? null : rows,
        error: null,
      });
    }

    const builder = {
      insert(payload) {
        query.mutation = "insert";
        query.payload = payload;
        return builder;
      },
      update(payload) {
        query.mutation = "update";
        query.payload = payload;
        return builder;
      },
      select(selectClause) {
        query.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        query.filters.push({ column, value });
        return builder;
      },
      limit(value) {
        query.limitCount = value;
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
    state,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function suggestion(overrides = {}) {
  return {
    id: "sug-1",
    organization_id: "org-1",
    suggestion_type: "task_suggestion",
    source_entity_type: "document",
    source_entity_id: "doc-1",
    suggested_action_json: {
      action: "create_task",
      title: "Revisar IVA de documento",
      priority: "high",
      documentId: "doc-1",
    },
    confidence: 0.84,
    reason: "El documento tiene flags fiscales.",
    required_evidence_json: ["document"],
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    result_entity_type: null,
    result_entity_id: null,
    expires_at: null,
    metadata_json: {},
    created_by: "user-1",
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
    ...overrides,
  };
}

test("PR-12 creating an IA suggestion does not mutate business entities", async () => {
  const { createOperationalSuggestion, buildTaskSuggestionAction } = require("@/modules/intelligence");
  const { state, supabase } = createSupabaseStub();

  const id = await createOperationalSuggestion(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    suggestionType: "task_suggestion",
    sourceEntityType: "document",
    sourceEntityId: "doc-1",
    suggestedAction: buildTaskSuggestionAction({
      title: "Revisar documento",
      documentId: "doc-1",
    }),
    confidence: 0.7,
    reason: "Documento sin trabajo.",
  });

  assert.equal(id, "operational_suggestions-1");
  assert.equal(state.operational_suggestions.length, 1);
  assert.equal(state.tasks.length, 0);
  assert.equal(state.entity_links.length, 0);
});

test("PR-12 rejecting a suggestion is traced without materializing actions", async () => {
  const { reviewOperationalSuggestion } = require("@/modules/intelligence");
  const { state, supabase } = createSupabaseStub({
    operational_suggestions: [suggestion()],
  });

  await reviewOperationalSuggestion(supabase, {
    organizationId: "org-1",
    suggestionId: "sug-1",
    status: "rejected",
    actorId: "user-2",
    reviewNote: "No aplica.",
  });

  assert.equal(state.operational_suggestions[0].status, "rejected");
  assert.equal(state.operational_suggestions[0].reviewed_by, "user-2");
  assert.equal(state.operational_suggestions[0].review_note, "No aplica.");
  assert.equal(state.tasks.length, 0);
});

test("PR-12 accepting a task suggestion creates a linked task", async () => {
  const { acceptOperationalSuggestion } = require("@/modules/intelligence");
  const { state, supabase } = createSupabaseStub({
    operational_suggestions: [suggestion()],
  });

  const result = await acceptOperationalSuggestion(supabase, {
    organizationId: "org-1",
    suggestionId: "sug-1",
    actorId: "user-2",
  });

  assert.equal(result.entityType, "task");
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].title, "Revisar IVA de documento");
  assert.equal(state.tasks[0].document_id, "doc-1");
  assert.equal(state.tasks[0].metadata_json.suggestion_id, "sug-1");
  assert.equal(state.operational_suggestions[0].status, "accepted");
  assert.equal(state.operational_suggestions[0].result_entity_type, "task");
});

test("PR-12 accepting a work unit suggestion creates an entity link", async () => {
  const { acceptOperationalSuggestion, buildWorkUnitAssignmentSuggestionAction } = require("@/modules/intelligence");
  const { state, supabase } = createSupabaseStub({
    operational_suggestions: [
      suggestion({
        suggestion_type: "work_unit_assignment_suggestion",
        suggested_action_json: buildWorkUnitAssignmentSuggestionAction({
          documentId: "doc-1",
          workUnitId: "work-1",
          confidence: 0.91,
        }),
      }),
    ],
  });

  const result = await acceptOperationalSuggestion(supabase, {
    organizationId: "org-1",
    suggestionId: "sug-1",
    actorId: "user-2",
  });

  assert.equal(result.entityType, "entity_link");
  assert.equal(state.entity_links.length, 1);
  assert.equal(state.entity_links[0].source_entity_type, "document");
  assert.equal(state.entity_links[0].target_entity_type, "work_unit");
  assert.equal(state.entity_links[0].target_entity_id, "work-1");
});

test("PR-12 suggestions are scoped by organization", async () => {
  const { acceptOperationalSuggestion } = require("@/modules/intelligence");
  const { supabase } = createSupabaseStub({
    operational_suggestions: [suggestion()],
  });

  await assert.rejects(
    () => acceptOperationalSuggestion(supabase, {
      organizationId: "org-2",
      suggestionId: "sug-1",
      actorId: "user-2",
    }),
    /no encontrada/i,
  );
});

test("PR-12 company status brief cites real links", () => {
  const { buildCompanyStatusBrief } = require("@/modules/intelligence");
  const brief = buildCompanyStatusBrief({
    fallbackHref: "/app/o/rontil/documents",
    actions: [
      {
        title: "Resolver 2 blocker(s) de cierre",
        description: "Cierre bloqueado.",
        href: "/app/o/rontil/close",
      },
      {
        title: "Revisar 1 flag(s) de IVA",
        description: "Tax flag.",
        href: "/app/o/rontil/tax",
      },
    ],
  });

  assert.match(brief.answer, /Resolver 2 blocker/);
  assert.deepEqual(brief.links.map((link) => link.href), [
    "/app/o/rontil/close",
    "/app/o/rontil/tax",
  ]);
});

test("PR-12 schema and migration define reviewable operational suggestions", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const schemaSql = fs.readFileSync(
    path.join(projectRoot, "db", "schema", "13_operational_intelligence.sql"),
    "utf8",
  );
  const migrationSql = fs.readFileSync(
    path.join(projectRoot, "supabase", "migrations", "20260617_pr12_operational_intelligence.sql"),
    "utf8",
  );

  for (const sql of [schemaSql, migrationSql]) {
    assert.match(sql, /create table if not exists public\.operational_suggestions/);
    assert.match(sql, /work_unit_assignment_suggestion/);
    assert.match(sql, /task_suggestion/);
    assert.match(sql, /status in \('pending', 'accepted', 'rejected', 'expired'\)/);
    assert.match(sql, /alter table public\.operational_suggestions enable row level security/);
  }
});
