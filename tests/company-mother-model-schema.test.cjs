/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
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
  const legacyBridgeSql = readProjectFile("db/schema/11_legacy_bridges.sql");
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
  assert.match(canonicalScript, /db\/schema\/11_legacy_bridges\.sql/);
  assert.match(legacyBridgeSql, /legacy_cost_center_bridge/i);
  assert.match(legacyBridgeSql, /legacy_vendor_bridge/i);
  assert.match(legacyBridgeSql, /legacy_customer_bridge/i);
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

test("canonical schema parser handles multiline unique constraints as constraints", async () => {
  const canonicalModuleUrl = pathToFileURL(
    path.join(projectRoot, "scripts/supabase/canonical-schema.mjs"),
  ).href;
  const { extractExpectedSchemaSpec } = await import(canonicalModuleUrl);
  const spec = await extractExpectedSchemaSpec();

  assert.ok(
    spec.columnsByTable.entity_links.includes("relation_type"),
    "entity_links should include real columns",
  );
  assert.ok(
    !spec.columnsByTable.entity_links.includes("unique"),
    "entity_links multiline unique constraint should not be parsed as a column",
  );
  assert.ok(
    spec.uniqueConstraints.some(
      (constraint) =>
        constraint.tableName === "entity_links" &&
        constraint.columns.join(",") ===
          "organization_id,source_entity_type,source_entity_id,target_entity_type,target_entity_id,relation_type",
    ),
    "entity_links multiline unique constraint should be tracked as a unique constraint",
  );
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
  assert.match(resetReadme, /db\/schema\/11_legacy_bridges\.sql/i);
  assert.match(resetReadme, /db\/rls\/supabase_rls_policies\.sql/i);
  assert.match(resetReadme, /20260617_pr01_company_mother_model\.sql/i);
});

test("PR-02 legacy bridge migration materializes work units, parties and canonical links", () => {
  const migrationSql = readProjectFile("supabase/migrations/20260617_pr02_legacy_bridges.sql");
  const schemaSql = readProjectFile("db/schema/11_legacy_bridges.sql");

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /idx_work_units_org_legacy_cost_center_unique/i);
    assert.match(sql, /insert into public\.work_units/i);
    assert.match(sql, /from public\.organization_cost_centers/i);
    assert.match(sql, /update public\.documents as d[\s\S]*set work_unit_id = wu\.id/i);
    assert.match(sql, /insert into public\.entity_links/i);
    assert.match(sql, /insert into public\.parties/i);
    assert.match(sql, /from public\.vendors as v/i);
    assert.match(sql, /from public\.customers as c/i);
    assert.match(sql, /insert into public\.party_roles/i);
    assert.match(sql, /insert into public\.party_identifiers/i);
    assert.match(sql, /update public\.ledger_open_items as loi[\s\S]*set party_id = p\.id/i);
    assert.match(sql, /update public\.ledger_open_items as loi[\s\S]*set work_unit_id = d\.work_unit_id/i);
  }
});

test("03 master data can create parties before legacy vendor and customer tables", () => {
  const masterDataSql = readProjectFile("db/schema/03_master_data.sql");
  const partiesCreateMatch = masterDataSql.match(
    /create table if not exists public\.parties \([\s\S]*?\n\);/i,
  );

  assert.ok(partiesCreateMatch, "parties create table statement should exist");
  assert.doesNotMatch(partiesCreateMatch[0], /references public\.vendors\(id\)/i);
  assert.doesNotMatch(partiesCreateMatch[0], /references public\.customers\(id\)/i);

  assert.ok(
    masterDataSql.indexOf('create table if not exists public.vendors') <
      masterDataSql.indexOf("parties_legacy_vendor_id_fkey"),
    "legacy vendor FK should be added after vendors exists",
  );
  assert.ok(
    masterDataSql.indexOf('create table if not exists public.customers') <
      masterDataSql.indexOf("parties_legacy_customer_id_fkey"),
    "legacy customer FK should be added after customers exists",
  );
});
