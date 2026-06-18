/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

const projectRoot = path.resolve(__dirname, "..");
const schemaSql = fs.readFileSync(
  path.join(projectRoot, "db", "schema", "14_treasury.sql"),
  "utf8",
);
const migrationSql = fs.readFileSync(
  path.join(projectRoot, "supabase", "migrations", "20260618_pr14_treasury_mvp.sql"),
  "utf8",
);
const rlsSql = fs.readFileSync(
  path.join(projectRoot, "db", "rls", "supabase_rls_policies.sql"),
  "utf8",
);

const treasuryTables = [
  "treasury_bank_accounts",
  "treasury_bank_balance_snapshots",
  "treasury_vales",
  "treasury_vale_terms",
  "treasury_vale_events",
  "treasury_manual_receivables",
  "treasury_reserve_rules",
];

function tableBlock(sql, table) {
  const match = sql.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`, "m"));
  return match ? match[0] : "";
}

test("PR-14 treasury schema and migration declare all MVP tables with tenant audit fields", () => {
  for (const table of treasuryTables) {
    for (const sql of [schemaSql, migrationSql]) {
      const block = tableBlock(sql, table);

      assert.ok(block, `${table} missing`);
      assert.match(block, /organization_id uuid not null/);
      assert.match(block, /created_by uuid references public\.profiles\(id\)/);
      assert.match(block, /created_at timestamptz not null default now\(\)/);
      assert.match(block, /updated_at timestamptz not null default now\(\)/);
    }
  }

  assert.match(schemaSql, /current_balance numeric\(18,2\)/);
  assert.match(schemaSql, /principal_amount numeric\(18,2\)/);
  assert.match(schemaSql, /due_date date not null/);
  assert.match(schemaSql, /expected_date date not null/);
  assert.match(schemaSql, /party_id uuid references public\.parties\(id\)/);
});

test("PR-14 treasury RLS policies exist and do not allow deletes in MVP", () => {
  for (const table of treasuryTables) {
    assert.match(rlsSql, new RegExp(`alter table public\\.${table}\\s+enable row level security`));
    assert.match(rlsSql, new RegExp(`${table}_select_member`));
    assert.match(rlsSql, new RegExp(`${table}_insert_treasury_roles`));
    assert.match(rlsSql, new RegExp(`${table}_update_treasury_roles`));
  }

  assert.match(rlsSql, /'operator'::public\.member_role/);
  assert.doesNotMatch(rlsSql, /on public\.treasury_[\s\S]*for delete/i);
});

test("PR-14 treasury RPCs validate pending periods, non-negative amounts and no include directives", () => {
  for (const sql of [schemaSql, migrationSql]) {
    assert.match(sql, /create or replace function public\.treasury_record_vale_renewal/);
    assert.match(sql, /create or replace function public\.treasury_record_vale_closure/);
    assert.match(sql, /v_term\.status <> 'pending'/);
    assert.match(sql, /Los importes no pueden ser negativos/);
    assert.match(sql, /Nuevo vencimiento obligatorio/);
    assert.match(sql, /for update/);
  }

  assert.doesNotMatch(migrationSql, /\\i\b/);
});
