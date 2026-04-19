/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const integrationTables = [
  "organization_integration_connections",
  "integration_sync_runs",
  "integration_sync_cursors",
  "integration_raw_records",
  "document_source_refs",
  "integration_entity_links",
];

test("PR-02 canonical schema defines the generic integration persistence layer", () => {
  const schemaSql = readProjectFile("db/schema/07_integrations_and_audit.sql");

  for (const table of integrationTables) {
    assert.match(
      schemaSql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
      `${table} should exist in canonical schema`,
    );
  }

  assert.doesNotMatch(schemaSql, /create table if not exists public\.integration_document_links\b/i);
  assert.match(schemaSql, /unique \(organization_id, provider\)/i);
  assert.match(schemaSql, /unique \(organization_id, provider, stream, cursor_key\)/i);
  assert.match(schemaSql, /unique \(organization_id, provider, entity_type, external_key\)/i);
  assert.match(schemaSql, /unique \(organization_id, provider, source_kind, external_key\)/i);
  assert.match(schemaSql, /unique \(organization_id, provider, external_entity_type, external_key\)/i);
});

test("PR-02 schema keeps test cleanup, monetary envelope and document source provenance", () => {
  const schemaSql = readProjectFile("db/schema/07_integrations_and_audit.sql");

  assert.match(schemaSql, /test_mode boolean not null default true/i);
  assert.match(schemaSql, /test_run_key text/i);
  assert.match(schemaSql, /cleanup_status text not null default 'not_required'/i);
  assert.match(schemaSql, /cleanup_required_by timestamptz/i);
  assert.match(schemaSql, /cleanup_verified_at timestamptz/i);
  assert.match(schemaSql, /cleanup_evidence_json jsonb not null default '\{\}'::jsonb/i);

  assert.match(schemaSql, /document_date date/i);
  assert.match(schemaSql, /currency_code text/i);
  assert.match(schemaSql, /source_exchange_rate numeric\(18,8\)/i);
  assert.match(schemaSql, /source_exchange_rate_date date/i);
  assert.match(schemaSql, /source_exchange_rate_kind text/i);
  assert.match(schemaSql, /source_total_amount numeric\(18,2\)/i);
  assert.match(schemaSql, /source_net_amount numeric\(18,2\)/i);
  assert.match(schemaSql, /source_tax_amount numeric\(18,2\)/i);
  assert.match(schemaSql, /source_monetary_json jsonb not null default '\{\}'::jsonb/i);

  assert.match(schemaSql, /factual_trust_mode text not null default 'external_deterministic'/i);
  assert.match(schemaSql, /bandeja_compatibility_json jsonb not null default '\{\}'::jsonb/i);
  assert.match(schemaSql, /drift_status text not null default 'none'/i);
  assert.match(schemaSql, /documents\(id\) on delete cascade/i);
  assert.match(schemaSql, /external_entity_type text not null/i);
  assert.match(schemaSql, /local_entity_type text not null/i);
  assert.match(schemaSql, /match_method text not null/i);
});

test("PR-02 RLS and incremental migration are wired for integration tables", () => {
  const rlsSql = readProjectFile("db/rls/supabase_rls_policies.sql");
  const migrationSql = readProjectFile("supabase/migrations/20260419_integration_foundation.sql");

  for (const table of integrationTables) {
    assert.match(
      rlsSql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      `${table} should have RLS enabled`,
    );
    assert.match(
      migrationSql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
      `${table} should exist in incremental migration`,
    );
  }

  assert.match(rlsSql, /create policy "organization_integration_connections_select_integration_roles"/i);
  assert.match(rlsSql, /create policy "integration_sync_runs_insert_processing_roles"/i);
  assert.match(rlsSql, /create policy "integration_sync_cursors_update_processing_roles"/i);
  assert.match(rlsSql, /create policy "integration_raw_records_update_processing_roles"/i);
  assert.match(rlsSql, /create policy "document_source_refs_select_member"/i);
  assert.match(rlsSql, /create policy "integration_entity_links_insert_accounting_roles"/i);
  assert.match(migrationSql, /idx_integration_raw_records_payload_hash/i);
  assert.match(migrationSql, /idx_integration_entity_links_local/i);
});
