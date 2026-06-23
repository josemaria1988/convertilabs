/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("work intake schema exists in canonical schema, migration and RLS", () => {
  const schema = read("db/schema/15_work_intake.sql");
  const migration = read("supabase/migrations/20260623_pr07_work_intake_items.sql");
  const rls = read("db/rls/supabase_rls_policies.sql");
  const dbReadme = read("db/README.md");

  for (const sql of [schema, migration]) {
    assert.match(sql, /create table if not exists public\.work_intake_items/i);
    assert.match(sql, /party_id uuid references public\.parties\(id\)/i);
    assert.match(sql, /work_unit_id uuid references public\.work_units\(id\)/i);
    assert.match(sql, /integration_raw_record_id uuid references public\.integration_raw_records\(id\)/i);
    assert.match(sql, /unique.*organization_id.*idempotency_key/is);
    assert.match(sql, /unique.*organization_id.*external_source_key/is);
  }

  assert.match(rls, /alter table public\.work_intake_items enable row level security/i);
  assert.match(rls, /create policy "work_intake_items_select_member"/i);
  assert.match(rls, /create policy "work_intake_items_insert_operations_roles"/i);
  assert.match(dbReadme, /15_work_intake\.sql/i);
});
