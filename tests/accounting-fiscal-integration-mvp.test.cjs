/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

test("PR-10 close validator results become actionable blocked tasks", () => {
  const { buildCloseCheckTaskPayloads } = require("@/modules/close/task-suggestions");

  const payloads = buildCloseCheckTaskPayloads({
    organizationId: "org-1",
    actorId: "user-1",
    fiscalPeriodId: "period-2026-06",
    periodCode: "2026-06",
    closeCheckRun: {
      id: "close-run-1",
      results: [
        {
          code: "documents_ready_for_close",
          label: "Documentos listos para cierre",
          family: "documents",
          severity: "blocker",
          status: "blocker",
          message: "2 documentos pendientes.",
          metricValue: 2,
          metadata: {},
        },
        {
          code: "vat_run_closed",
          label: "IVA del periodo finalizado",
          family: "tax",
          severity: "blocker",
          status: "blocker",
          message: "No existe VAT run finalized.",
          metricValue: null,
          metadata: {},
        },
        {
          code: "trial_balance_balanced",
          label: "Trial balance balanceado",
          family: "accounting",
          severity: "info",
          status: "pass",
          message: "Balancea.",
          metricValue: 0,
          metadata: {},
        },
      ],
    },
  });

  assert.equal(payloads.length, 2);
  assert.ok(payloads.every((payload) => payload.status === "blocked"));
  assert.ok(payloads.every((payload) => payload.metadata_json.source === "close_validator"));
  assert.equal(payloads[0].metadata_json.close_check_code, "documents_ready_for_close");
  assert.equal(payloads[1].metadata_json.close_check_code, "vat_run_closed");
});

test("PR-10 Inicio surfaces IVA flags and close blockers as actions", () => {
  const { buildCompanyHomeDashboard } = require("@/modules/presentation/company-home");

  const dashboard = buildCompanyHomeDashboard({
    organizationSlug: "rontil",
    documents: [],
    work: {
      isAvailable: true,
      totalCount: 1,
      recent: [],
    },
    directory: {
      isAvailable: true,
      totalCount: 1,
      recent: [],
    },
    money: {
      isAvailable: true,
      totalCount: 0,
      recent: [],
    },
    operations: {
      isAvailable: true,
      totalTasks: 1,
      blockedTasks: 0,
      dueThisWeek: 0,
      continuityRiskCount: 0,
      rawCaptures: 0,
      latestVatStatus: "draft",
      vatReviewFlags: 3,
      vatTracedDocuments: 7,
      latestCloseStatus: "blocker",
      closeBlockers: 2,
      closeWarnings: 1,
    },
  });

  assert.equal(dashboard.summary.vatReviewFlags, 3);
  assert.equal(dashboard.summary.closeBlockers, 2);
  assert.ok(dashboard.metrics.some((metric) => metric.key === "tax_close"));
  assert.ok(dashboard.actions.some((action) => action.key === "vat_review_flags"));
  assert.ok(dashboard.actions.some((action) => action.key === "close_blockers"));
});

test("PR-10 document posting records mother-model business event codes", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const source = fs.readFileSync(
    path.join(projectRoot, "modules", "documents", "review.ts"),
    "utf8",
  );

  assert.match(source, /eventCode: "document_posted_provisional"/);
  assert.match(source, /eventCode: "document_confirmed"/);
  assert.match(source, /eventCode: "document_posted_final"/);
  assert.match(source, /eventCode: "vat_relevant_document_ready"/);
  assert.match(source, /event_type: "document_posted"|eventType: "document_posted"/);
});
