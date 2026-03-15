/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("organization schema enforces normalized tax id uniqueness and new admin_processing role", () => {
  const enums = read("db/schema/01_enums.sql");
  const tenants = read("db/schema/02_identity_and_tenants.sql");
  const migration = read("supabase/migrations/20260315_doc014_workflow_separation_foundations.sql");

  assert.match(enums, /'admin_processing'/);
  assert.match(tenants, /tax_id_normalized text/);
  assert.match(tenants, /idx_organizations_tax_id_normalized/);
  assert.match(migration, /Request access to the existing tenant instead/);
  assert.match(migration, /create table if not exists public\.document_assignment_runs/i);
});
