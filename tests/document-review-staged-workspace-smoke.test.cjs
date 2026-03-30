/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

test("document review workspace consumes the guided route presenter", () => {
  const filePath = path.join(
    __dirname,
    "..",
    "components",
    "documents",
    "document-review-staged-workspace.tsx",
  );
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /buildDocumentReviewGuidedRoute/);
  assert.match(source, /const guidedRoute = buildDocumentReviewGuidedRoute\(/);
  assert.match(source, /const reviewSteps = guidedRoute\.reviewSteps;/);
  assert.doesNotMatch(source, /const reviewSteps = \[/);
  assert.doesNotMatch(source, /!showManualFlow\s*\?\s*"pending"/);
});
