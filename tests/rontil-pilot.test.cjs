/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  RONTIL_PILOT_SCENARIOS,
  buildRontilPilotSummary,
} = require("@/modules/evals/rontil-pilot");

test("rontil pilot manifest covers every required MVP lane", () => {
  assert.equal(RONTIL_PILOT_SCENARIOS.length, 12);
  assert.equal(RONTIL_PILOT_SCENARIOS.some((scenario) => scenario.id === "standard_import"), true);
  assert.equal(RONTIL_PILOT_SCENARIOS.some((scenario) => scenario.id === "dgi_mapping"), true);
});

test("pilot summary is ready only when all scenarios and metrics pass", () => {
  const successfulResults = RONTIL_PILOT_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.id,
    usableExtraction: true,
    correctClassification: true,
    correctBlocking: true,
    correctVat: true,
    reviewMinutes: 8,
    estimatedCostUsd: 0.07,
  }));

  const ready = buildRontilPilotSummary(successfulResults);
  const blocked = buildRontilPilotSummary(successfulResults.slice(0, -1));

  assert.equal(ready.pilotReady, true);
  assert.equal(blocked.pilotReady, false);
  assert.equal(blocked.missingScenarios.length, 1);
});
