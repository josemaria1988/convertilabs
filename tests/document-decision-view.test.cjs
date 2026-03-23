/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDecisionGateView,
  buildDocumentOperationalHeaderView,
} = require("@/modules/presentation/document-decision-view");

test("decision gate view exposes the blocking reason and suggested action", () => {
  const gate = buildDecisionGateView({
    decision: {
      ok: false,
      reasons: ["La clasificacion contable todavia no quedo resuelta."],
      missingConditions: ["Clasificacion resuelta"],
    },
    readyLabel: "Puede postear provisional",
    blockedLabel: "Todavia no puede postear provisional",
    readySummary: "Listo para provisional.",
    blockedSummary: "Todavia faltan condiciones para el posting provisional.",
  });

  assert.equal(gate.ok, false);
  assert.equal(gate.label, "Todavia no puede postear provisional");
  assert.match(gate.summary, /clasificacion contable/i);
  assert.equal(gate.actionHint, "Resolver clasificacion");
});

test("decision gate view prioritizes fiscal FX guidance over generic blocker copy", () => {
  const gate = buildDecisionGateView({
    decision: {
      ok: false,
      reasons: ["No pudimos consultar la cotizacion BCU para resolver el tipo de cambio fiscal previo al 2026-03-12."],
      missingConditions: ["Sin bloqueos criticos"],
    },
    readyLabel: "Puede confirmar final",
    blockedLabel: "Todavia no puede confirmar final",
    readySummary: "Listo para final.",
    blockedSummary: "Todavia faltan condiciones para la confirmacion final.",
  });

  assert.equal(gate.ok, false);
  assert.match(gate.summary, /cotizacion bcu/i);
  assert.equal(gate.actionHint, "Resolver tipo de cambio fiscal");
});

test("document operational header uses canonical language from the snapshot", () => {
  const header = buildDocumentOperationalHeaderView({
    workflowState: "pending_assignment",
    resolutionSource: "manual",
    resolutionConfidence: 0.82,
    factualReviewResolved: true,
    accountingContextResolved: true,
    classificationResolved: false,
    previewBalanced: true,
    hasTemporaryAccounts: false,
    fiscalTreatmentResolved: true,
    postingState: "draft",
    canPostProvisional: false,
    canConfirmFinal: false,
    provisionalEligibility: {
      ok: false,
      reasons: [],
      missingConditions: ["Clasificacion resuelta"],
    },
    finalEligibility: {
      ok: false,
      reasons: [],
      missingConditions: ["Clasificacion resuelta", "Sin cuentas temporales"],
    },
    vatPreviewEligibility: {
      ok: true,
      reasons: [],
      missingConditions: [],
    },
    vatRunEligibility: {
      ok: false,
      reasons: ["Aun no tiene posting suficiente para entrar en la corrida oficial de IVA."],
      missingConditions: ["Posting suficiente para corrida oficial"],
    },
    blockers: [],
    warnings: [],
    nextBestAction: "Resolver clasificacion",
    checklist: [],
  });

  assert.equal(header.workflowLabel, "Pendiente de asignacion");
  assert.equal(header.resolutionSourceLabel, "Revision manual");
  assert.equal(header.postingStateLabel, "Draft operativo");
  assert.equal(header.confidenceLabel, "82%");
  assert.equal(header.provisional.actionHint, "Resolver clasificacion");
  assert.equal(header.nextBestAction, "Resolver clasificacion");
});
