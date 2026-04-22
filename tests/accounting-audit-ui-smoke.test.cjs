/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function readProjectFile(...segments) {
  return fs.readFileSync(path.join(__dirname, "..", ...segments), "utf8");
}

test("journal entries page renders the full journal entry detail panel", () => {
  const source = readProjectFile("app", "app", "o", "[slug]", "journal-entries", "page.tsx");

  assert.match(source, /loadJournalEntryDetail/);
  assert.match(source, /JournalEntryDetailPanel/);
  assert.match(source, /Asiento materializado/);
});

test("document review exposes the asiento modal with materialized versus preview state", () => {
  const source = readProjectFile("components", "documents", "document-review-rule-workspace.tsx");
  const modalSource = readProjectFile("components", "accounting", "journal-entry-modal-trigger.tsx");

  assert.match(source, /JournalEntryModalTrigger/);
  assert.match(source, /pageData\.journalAuditState/);
  assert.match(modalSource, /Asiento materializado/);
  assert.match(modalSource, /Preview del kernel/);
});

test("vat preview card uses enriched document drilldown and journal links", () => {
  const source = readProjectFile("components", "tax", "vat-run-preview-card.tsx");

  assert.match(source, /formatDocumentTitle/);
  assert.match(source, /Ver comprobante/);
  assert.match(source, /Ver asiento/);
});

test("tax workbench table keeps stable columns instead of squeezing content", () => {
  const source = readProjectFile("app", "app", "o", "[slug]", "tax", "tax-period-workbench.tsx");

  assert.match(source, /overflow-x-auto/);
  assert.match(source, /data-testid="tax-workbench-table"/);
  assert.match(source, /min-w-\[1260px\]/);
  assert.match(source, /minmax\(340px,2\.2fr\)/);
  assert.match(source, /hasFocusPanel \? "mt-4 grid gap-4 xl:grid-cols-\[minmax\(0,1fr\)_360px\]" : "mt-4"/);
  assert.doesNotMatch(source, /La bandeja prioriza la resolucion fiscal del mes/);
});
