/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

const projectRoot = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const motherModelTables = [
  "party_roles",
  "party_identifiers",
  "contacts",
  "party_contacts",
  "work_units",
  "business_events",
  "entity_links",
  "evidence_refs",
];

test("PR-01 canonical SQL defines Convertilabs 2.0 mother model enums and tables", () => {
  const enumsSql = readProjectFile("db/schema/01_enums.sql");
  const schemaSql = readProjectFile("db/schema/10_company_mother_model.sql");
  const canonicalScript = readProjectFile("scripts/supabase/canonical-schema.mjs");

  for (const enumName of [
    "party_role_type",
    "party_identifier_type",
    "work_unit_kind",
    "work_unit_status",
    "business_event_type",
    "entity_type",
    "entity_relation_type",
    "evidence_ref_type",
  ]) {
    assert.match(enumsSql, new RegExp(`create type public\\.${enumName} as enum`, "i"));
  }

  assert.match(enumsSql, /'customer'/i);
  assert.match(enumsSql, /'vendor'/i);
  assert.match(enumsSql, /'job'/i);
  assert.match(enumsSql, /'belongs_to'/i);

  for (const table of motherModelTables) {
    assert.match(
      schemaSql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
      `${table} should exist in canonical mother model schema`,
    );
  }

  assert.match(schemaSql, /alter table public\.parties/i);
  assert.match(schemaSql, /add column if not exists normalized_name text/i);
  assert.match(schemaSql, /add column if not exists metadata_json jsonb not null default '\{\}'::jsonb/i);
  assert.match(schemaSql, /customer_party_id uuid references public\.parties\(id\)/i);
  assert.match(schemaSql, /source_entity_type public\.entity_type not null/i);
  assert.match(schemaSql, /relation_type public\.entity_relation_type not null/i);
  assert.match(canonicalScript, /db\/schema\/10_company_mother_model\.sql/);
});

test("PR-01 adds direct high-traffic foreign keys without deleting legacy bridges", () => {
  const schemaSql = readProjectFile("db/schema/10_company_mother_model.sql");
  const documentsSql = readProjectFile("db/schema/04_documents.sql");

  assert.match(schemaSql, /alter table public\.documents[\s\S]*work_unit_id uuid references public\.work_units\(id\)/i);
  assert.match(schemaSql, /alter table public\.documents[\s\S]*party_id uuid references public\.parties\(id\)/i);
  assert.match(schemaSql, /alter table public\.posting_proposals[\s\S]*work_unit_id uuid references public\.work_units\(id\)/i);
  assert.match(schemaSql, /alter table public\.journal_entries[\s\S]*work_unit_id uuid references public\.work_units\(id\)/i);
  assert.match(schemaSql, /alter table public\.journal_entry_lines[\s\S]*work_unit_id uuid references public\.work_units\(id\)/i);
  assert.match(schemaSql, /alter table public\.ledger_open_items[\s\S]*work_unit_id uuid references public\.work_units\(id\)/i);
  assert.match(schemaSql, /legacy_cost_center_id uuid references public\.organization_cost_centers\(id\)/i);
  assert.match(documentsSql, /cost_center_id uuid references public\.organization_cost_centers\(id\)/i);
});

test("PR-01 RLS and migration cover mother model tables", () => {
  const rlsSql = readProjectFile("db/rls/supabase_rls_policies.sql");
  const migrationSql = readProjectFile("supabase/migrations/20260617_pr01_company_mother_model.sql");

  for (const table of ["parties", ...motherModelTables]) {
    assert.match(
      rlsSql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      `${table} should have RLS enabled in canonical policies`,
    );
    assert.match(
      migrationSql,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      `${table} should have RLS enabled in PR-01 migration`,
    );
  }

  assert.match(rlsSql, /create policy "parties_select_member"/i);
  assert.match(rlsSql, /create policy "work_units_insert_work_roles"/i);
  assert.match(rlsSql, /create policy "business_events_insert_event_roles"/i);
  assert.match(rlsSql, /create policy "entity_links_insert_event_roles"/i);
  assert.match(rlsSql, /create policy "evidence_refs_insert_event_roles"/i);

  for (const table of motherModelTables) {
    assert.match(
      migrationSql,
      new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
      `${table} should be created by PR-01 migration`,
    );
  }
});

test("PR-01 reset runbook documents a clean rebuild path", () => {
  const resetSql = readProjectFile("supabase/reset/00_clean_public_schema.sql");
  const resetReadme = readProjectFile("supabase/reset/README.md");

  assert.match(resetSql, /drop schema if exists public cascade/i);
  assert.match(resetSql, /create schema public/i);
  assert.match(resetSql, /create extension if not exists pgcrypto/i);
  assert.match(resetReadme, /db\/schema\/10_company_mother_model\.sql/i);
  assert.match(resetReadme, /db\/rls\/supabase_rls_policies\.sql/i);
  assert.match(resetReadme, /20260617_pr01_company_mother_model\.sql/i);
});
