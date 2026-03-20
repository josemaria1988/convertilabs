/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("canonical enums and schema include close lifecycle states and validator tables", () => {
  const enumsSql = readProjectFile("db/schema/01_enums.sql");
  const accountingSql = readProjectFile("db/schema/05_accounting.sql");
  const auditSql = readProjectFile("db/schema/07_integrations_and_audit.sql");

  assert.match(enumsSql, /'ready_to_close'/);
  assert.match(enumsSql, /'soft_closed'/);
  assert.match(enumsSql, /'tax_locked'/);
  assert.match(enumsSql, /'hard_closed'/);
  assert.match(enumsSql, /'audit_frozen'/);

  assert.match(accountingSql, /create table if not exists public\.close_check_runs/i);
  assert.match(accountingSql, /create table if not exists public\.close_check_results/i);
  assert.match(accountingSql, /create table if not exists public\.fiscal_period_transition_logs/i);
  assert.match(accountingSql, /status_changed_at timestamptz/i);

  assert.match(auditSql, /create table if not exists public\.system_actors/i);
  assert.match(auditSql, /create table if not exists public\.assistant_runs/i);
  assert.match(auditSql, /create table if not exists public\.assistant_run_evidence_refs/i);
  assert.match(auditSql, /create table if not exists public\.assistant_suggestions/i);
});

test("migration and RLS layer wire close cockpit and assistant traces end to end", () => {
  const migrationSql = readProjectFile("supabase/migrations/20260320_close001_period_close_and_assistant_runs.sql");
  const rlsSql = readProjectFile("db/rls/supabase_rls_policies.sql");

  assert.match(migrationSql, /close_check_runs/i);
  assert.match(migrationSql, /fiscal_period_transition_logs/i);
  assert.match(migrationSql, /assistant_runs/i);
  assert.match(migrationSql, /assistant_suggestions/i);
  assert.match(migrationSql, /system_actors/i);

  assert.match(rlsSql, /alter table public\.fiscal_periods enable row level security/i);
  assert.match(rlsSql, /create policy "close_check_runs_select_member"/i);
  assert.match(rlsSql, /create policy "assistant_runs_select_member"/i);
  assert.match(rlsSql, /create policy "assistant_suggestions_update_processing_roles"/i);
});
