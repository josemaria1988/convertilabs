/* eslint-disable @typescript-eslint/no-require-imports */
// Offline PostgreSQL/RLS check. Uses the same optional PGlite installation as the local queue smoke.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, "..");

async function runSmoke() {
  const { PGlite } = require(process.env.CONVERTILABS_PGLITE_MODULE
    || path.join(root, ".local-companion/qa-sql/node_modules/@electric-sql/pglite"));
  const db = new PGlite();
  const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
  let checks = 0;
  const passed = (message) => { checks++; console.log(`ok - ${message}`); };
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table organizations(id uuid primary key); create table profiles(id uuid primary key);
      create table parties(id uuid primary key); create table work_units(id uuid primary key);
      create table documents(id uuid primary key); create table contacts(id uuid primary key);
      create table integration_raw_records(id uuid primary key);`);
    await db.exec(source("db/schema/01_enums.sql"));
    const members = source("db/schema/02_identity_and_tenants.sql").match(/create table if not exists public\.organization_members \([\s\S]*?\n\);/);
    assert.ok(members);
    await db.exec(members[0]);
    const helpers = source("db/rls/supabase_rls_policies.sql");
    await db.exec(helpers.slice(0, helpers.indexOf("create or replace function public.is_org_creator")));
    const migration = source("supabase/migrations/20260908_internal_operations_schema.sql");
    assert.equal(/^(insert into|update|delete from|truncate|drop table)\b/im.test(migration), false);
    for (const filename of ["12_operations_communications.sql", "13_operational_intelligence.sql", "15_work_intake.sql"]) {
      assert.ok(migration.includes(source(`db/schema/${filename}`).trim()), `Migration drift from ${filename}`);
    }
    await db.exec(migration);
    await db.exec(migration);
    const names = [...migration.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((match) => match[1]);
    assert.equal(names.length, 15);
    const tables = await db.query("select relname,relrowsecurity from pg_class where relname=any($1::text[]) and relnamespace='public'::regnamespace", [names]);
    assert.equal(tables.rows.length, 15);
    assert.ok(tables.rows.every((table) => table.relrowsecurity));
    passed("repair creates all 15 canonical tables with RLS, no DML and idempotent installation");

    const org = randomUUID(); const otherOrg = randomUUID();
    const active = randomUUID(); const inactive = randomUUID(); const viewer = randomUUID(); const outsider = randomUUID();
    await db.query("insert into organizations values ($1),($2)", [org, otherOrg]);
    await db.query("insert into profiles values ($1),($2),($3),($4)", [active, inactive, viewer, outsider]);
    await db.query("insert into organization_members(organization_id,user_id,role,is_active) values($1,$2,'operator',true),($1,$3,'operator',false),($1,$4,'viewer',true)", [org, active, inactive, viewer]);
    await db.query("insert into operational_suggestions(organization_id,suggestion_type) values($1,'task_suggestion'),($2,'task_suggestion')", [org, otherOrg]);
    await db.query("insert into work_intake_items(organization_id,title) values($1,'fixture A'),($2,'fixture B')", [org, otherOrg]);
    await db.exec("grant usage on schema public,auth to authenticated,anon; grant select,insert,update on all tables in schema public to authenticated,anon; set role authenticated");
    const actor = (id) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await actor(active);
    for (const table of ["operational_suggestions", "work_intake_items"]) {
      const visible = await db.query(`select organization_id from ${table}`);
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0].organization_id, org);
    }
    await assert.rejects(db.query("insert into operational_suggestions(organization_id,suggestion_type) values($1,'task_suggestion')", [otherOrg]), /row-level security/);
    await assert.rejects(db.query("insert into work_intake_items(organization_id,title) values($1,'blocked')", [otherOrg]), /row-level security/);
    await db.query("insert into operational_suggestions(organization_id,suggestion_type) values($1,'task_suggestion')", [org]);
    await db.query("insert into work_intake_items(organization_id,title) values($1,'accepted fixture')", [org]);
    assert.equal((await db.query("update operational_suggestions set reason='reviewed' where organization_id=$1 returning id", [org])).rows.length, 2);
    passed("active operators read/write their organization and cannot insert into another tenant");

    for (const id of [inactive, outsider]) {
      await actor(id);
      for (const table of ["operational_suggestions", "work_intake_items"]) assert.equal((await db.query(`select id from ${table}`)).rows.length, 0);
      await assert.rejects(db.query("insert into operational_suggestions(organization_id,suggestion_type) values($1,'task_suggestion')", [org]), /row-level security/);
      assert.equal((await db.query("update operational_suggestions set reason='forbidden' returning id")).rows.length, 0);
    }
    passed("inactive members and outsiders cannot read, insert or update operational data");

    await actor(viewer);
    assert.equal((await db.query("select id from operational_suggestions")).rows.length, 2);
    await assert.rejects(db.query("insert into operational_suggestions(organization_id,suggestion_type) values($1,'task_suggestion')", [org]), /row-level security/);
    await assert.rejects(db.query("insert into work_intake_items(organization_id,title) values($1,'blocked')", [org]), /row-level security/);
    assert.equal((await db.query("update work_intake_items set title='forbidden' returning id")).rows.length, 0);
    await db.exec("reset role; set role anon");
    await actor("");
    for (const table of ["operational_suggestions", "work_intake_items"]) assert.equal((await db.query(`select id from ${table}`)).rows.length, 0);
    passed("viewers remain read-only and anonymous requests see no internal records");
    console.log(`# pass ${checks}; isolated PostgreSQL, no remote data changed`);
  } finally { await db.close(); }
}

if (require.main === module) runSmoke().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { runSmoke };
