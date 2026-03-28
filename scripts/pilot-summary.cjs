#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
require("../tests/register-ts.cjs");

const fs = require("node:fs");
const path = require("node:path");

const {
  RONTIL_PILOT_SCENARIOS,
  RONTIL_PILOT_THRESHOLDS,
  buildRontilPilotSummary,
  isPilotScenarioId,
} = require("@/modules/evals/rontil-pilot");

function usage() {
  console.error("Usage: npm run pilot:summary -- <path/to/results.json>");
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value) {
  return `$${value.toFixed(4)}`;
}

function formatScenarioList(values) {
  return values.length > 0 ? values.join(", ") : "none";
}

function parseResultsPayload(rawValue) {
  if (Array.isArray(rawValue)) {
    return {
      label: null,
      sample: false,
      results: rawValue,
    };
  }

  if (!rawValue || typeof rawValue !== "object") {
    throw new Error("The JSON payload must be an array or an object with a results array.");
  }

  const payload = rawValue;
  const results = Array.isArray(payload.results) ? payload.results : null;

  if (!results) {
    throw new Error("The JSON payload is missing a results array.");
  }

  return {
    label: typeof payload.label === "string" ? payload.label : null,
    sample: payload.sample === true || payload.kind === "demo_sample",
    evidenceNote: typeof payload.evidenceNote === "string" ? payload.evidenceNote : null,
    results,
  };
}

function normalizeBoolean(value, fieldName, scenarioId) {
  if (typeof value !== "boolean") {
    throw new Error(`Scenario ${scenarioId}: ${fieldName} must be boolean.`);
  }

  return value;
}

function normalizeNumber(value, fieldName, scenarioId) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Scenario ${scenarioId}: ${fieldName} must be a finite number.`);
  }

  return value;
}

function normalizeScenarioResults(rawResults) {
  const seen = new Set();

  return rawResults.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Result at index ${index} must be an object.`);
    }

    const scenarioId = typeof entry.scenarioId === "string" ? entry.scenarioId : "";

    if (!isPilotScenarioId(scenarioId)) {
      throw new Error(`Result at index ${index} has unknown scenarioId: ${scenarioId || "<empty>"}.`);
    }

    if (seen.has(scenarioId)) {
      throw new Error(`Duplicate scenarioId detected: ${scenarioId}.`);
    }

    seen.add(scenarioId);

    return {
      scenarioId,
      usableExtraction: normalizeBoolean(entry.usableExtraction, "usableExtraction", scenarioId),
      correctClassification: normalizeBoolean(entry.correctClassification, "correctClassification", scenarioId),
      correctBlocking: normalizeBoolean(entry.correctBlocking, "correctBlocking", scenarioId),
      correctVat: normalizeBoolean(entry.correctVat, "correctVat", scenarioId),
      reviewMinutes: normalizeNumber(entry.reviewMinutes, "reviewMinutes", scenarioId),
      estimatedCostUsd: normalizeNumber(entry.estimatedCostUsd, "estimatedCostUsd", scenarioId),
    };
  });
}

function collectScenarioIssues(results) {
  return {
    extraction: results.filter((result) => !result.usableExtraction).map((result) => result.scenarioId),
    classification: results.filter((result) => !result.correctClassification).map((result) => result.scenarioId),
    blocking: results.filter((result) => !result.correctBlocking).map((result) => result.scenarioId),
    vat: results.filter((result) => !result.correctVat).map((result) => result.scenarioId),
  };
}

function printSummary(input) {
  const { sourcePath, label, sample, evidenceNote, summary, results } = input;
  const issues = collectScenarioIssues(results);

  console.log(`Pilot gate: ${summary.pilotReady ? "PASS" : "FAIL"}`);
  console.log(`Source: ${sourcePath}`);

  if (label) {
    console.log(`Label: ${label}`);
  }

  if (sample) {
    console.log("Evidence note: sample/demo only. Do not treat this file as production pilot evidence.");
  } else if (evidenceNote) {
    console.log(`Evidence note: ${evidenceNote}`);
  }

  console.log("");
  console.log(`Coverage: ${formatPercent(summary.coverage)} (${results.length}/${RONTIL_PILOT_SCENARIOS.length})`);
  console.log(`Usable extraction: ${formatPercent(summary.usableExtractionRate)} (threshold ${formatPercent(RONTIL_PILOT_THRESHOLDS.usableExtractionRate)})`);
  console.log(`Correct classification: ${formatPercent(summary.correctClassificationRate)} (threshold ${formatPercent(RONTIL_PILOT_THRESHOLDS.correctClassificationRate)})`);
  console.log(`Correct blocking: ${formatPercent(summary.correctBlockingRate)} (threshold ${formatPercent(RONTIL_PILOT_THRESHOLDS.correctBlockingRate)})`);
  console.log(`Correct VAT: ${formatPercent(summary.correctVatRate)} (threshold ${formatPercent(RONTIL_PILOT_THRESHOLDS.correctVatRate)})`);
  console.log(`Average review minutes: ${summary.averageReviewMinutes.toFixed(2)} (threshold <= ${RONTIL_PILOT_THRESHOLDS.averageReviewMinutes.toFixed(2)})`);
  console.log(`Average cost USD: ${formatUsd(summary.averageCostUsd)}`);
  console.log(`Missing scenarios: ${formatScenarioList(summary.missingScenarios)}`);
  console.log(`Extraction issues: ${formatScenarioList(issues.extraction)}`);
  console.log(`Classification issues: ${formatScenarioList(issues.classification)}`);
  console.log(`Blocking issues: ${formatScenarioList(issues.blocking)}`);
  console.log(`VAT issues: ${formatScenarioList(issues.vat)}`);
}

function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  try {
    const payload = parseResultsPayload(parsed);
    const results = normalizeScenarioResults(payload.results);
    const summary = buildRontilPilotSummary(results);

    printSummary({
      sourcePath: resolvedPath,
      label: payload.label,
      sample: payload.sample,
      evidenceNote: payload.evidenceNote,
      summary,
      results,
    });

    process.exitCode = summary.pilotReady ? 0 : 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
