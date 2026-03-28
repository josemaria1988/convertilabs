/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test, assert } = require("./testkit.cjs");

const projectRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(projectRoot, "scripts", "pilot-summary.cjs");
const readyFixturePath = path.join(projectRoot, "docs", "samples", "rontil-pilot-demo-ready.json");
const blockedFixturePath = path.join(projectRoot, "docs", "samples", "rontil-pilot-demo-blocked.json");

function runPilotSummary(fixturePath) {
  return spawnSync(process.execPath, [scriptPath, fixturePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

test("pilot summary cli passes for the labeled ready demo sample", () => {
  const result = runPilotSummary(readyFixturePath);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Pilot gate: PASS/);
  assert.match(result.stdout, /Coverage: 100\.0% \(12\/12\)/);
  assert.match(result.stdout, /sample\/demo only/i);
});

test("pilot summary cli fails with metrics and missing scenarios for the blocked demo sample", () => {
  const result = runPilotSummary(blockedFixturePath);

  assert.equal(result.status, 2);
  assert.match(result.stdout, /Pilot gate: FAIL/);
  assert.match(result.stdout, /Missing scenarios: dgi_mapping/);
  assert.match(result.stdout, /Classification issues: credit_note/);
  assert.match(result.stdout, /Blocking issues: duplicates/);
  assert.match(result.stdout, /VAT issues: standard_import/);
});
