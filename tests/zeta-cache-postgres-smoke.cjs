/* eslint-disable @typescript-eslint/no-require-imports */
// Offline actual PostgreSQL semantics through the existing private PGlite runtime.
// node tests/zeta-cache-postgres-smoke.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const { PGlite } = require(process.env.CONVERTILABS_PGLITE_MODULE || path.join(root, ".local-companion/qa-sql/node_modules/@electric-sql/pglite"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function table(file, name) {
  const source = read(`db/schema/${file}`); const start = source.indexOf(`create table if not exists public.${name} (`);
  assert.ok(start >= 0); return source.slice(start, source.indexOf("\n);", start) + 3);
}
async function main() {
  const db = new PGlite(); let checks = 0;
  const passed = (label) => { checks++; console.log(`ok - ${label}`); };
  const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table organizations(id uuid primary key); create table profiles(id uuid primary key);`);
    await db.exec(read("db/schema/01_enums.sql"));
    for (const [file, name] of [["02_identity_and_tenants.sql", "organization_members"],
      ...["organization_integration_connections", "integration_sync_runs", "integration_raw_records"].map((name) => ["07_integrations_and_audit.sql", name])]) {
      await db.exec(table(file, name));
    }
    // The existing active-run constraint is part of the canonical contract.
    await db.exec(`create unique index idx_integration_sync_runs_one_active_per_stream on integration_sync_runs
      (organization_id,provider,stream) where status in ('queued','running');`);
    const sql = read("db/schema/17_zeta_daily_cache.sql");
    assert.equal(sql, read("supabase/migrations/20260909_zeta_daily_cache.sql"));
    await db.exec(sql); await db.exec(sql);
    await db.exec(`grant usage on schema public to authenticated,service_role; grant all on all tables in schema public to authenticated,service_role;
      create function public.is_active_member(p_org uuid) returns boolean language sql security definer set search_path=public
      as $$ select exists(select 1 from organization_members where organization_id=p_org and user_id=nullif(current_setting('test.actor',true),'')::uuid and is_active) $$;
      create policy fixture_runs_members on integration_sync_runs for all to authenticated using(is_active_member(organization_id)) with check(is_active_member(organization_id));
      create policy fixture_raw_members on integration_raw_records for all to authenticated using(is_active_member(organization_id)) with check(is_active_member(organization_id));`);
    passed("canonical DDL, existing constraints, restricted policies and migration install twice");
    const actor = randomUUID(); const org = randomUUID(); const otherOrg = randomUUID();
    const connection = randomUUID(); const otherConnection = randomUUID();
    await db.query("insert into organizations values($1),($2)", [org, otherOrg]);
    await db.query("insert into profiles values($1)", [actor]);
    await db.query("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner')", [org, actor]);
    await db.query("insert into organization_integration_connections(id,organization_id,provider,test_mode) values($1,$2,'zetasoftware',false),($3,$4,'zetasoftware',false)", [connection, org, otherConnection, otherOrg]);
    const now = async (instant) => db.exec(`create or replace function public.zeta_daily_sync_now() returns timestamptz language sql volatile set search_path=pg_catalog as $$ select '${instant}'::timestamptz $$;`);
    const claim = async (organization = org, budget = 3) => (await db.query("select claim_zeta_daily_sync($1,$2,$3,'{}') as value", [organization, actor, budget])).rows[0].value;
    const reserve = async (r, organization = org, token = r.leaseToken) => (await db.query("select reserve_zeta_daily_request($1,$2,$3,'RESTFixtureQuery') as value", [organization, r.runId, token])).rows[0].value;
    const publish = async (r, reports, token = r.leaseToken) => (await db.query("select publish_zeta_daily_sync($1,$2,$3,$4) as value", [org, r.runId, token, JSON.stringify({ schemaVersion: 1, reports })])).rows[0].value;
    const fail = async (r) => (await db.query("select fail_zeta_daily_sync($1,$2,$3,'fixture','fixture') as value", [org, r.runId, r.leaseToken])).rows[0].value;
    async function page(r, kind, options = {}) {
      const key = hash(kind).slice(0, 32); const payload = { rows: options.rows ?? [{ Codigo: "000001", amount: 12 }] };
      const metadata = { schemaVersion: 1, snapshotKey: key, page: 1, report: kind };
      await db.query(`insert into integration_raw_records(organization_id,connection_id,provider,stream,entity_type,external_key,payload_json,payload_hash,last_sync_run_id,metadata_json)
        values($1,$2,'zetasoftware',$3,'report_snapshot_page',$4,$5,$6,$7,$8)`,
      [options.organizationId ?? org, options.connectionId ?? connection, `zeta.reports.${kind}`, `${r.runId}:${key}:000001`, JSON.stringify(payload), hash(payload), r.runId, JSON.stringify(metadata)]);
      return { snapshotKey: key, report: kind, endpoint: "RESTFixtureQuery", filters: {}, startedAt: "2026-09-09T21:00:00Z", completedAt: "2026-09-09T21:02:00Z",
        pages: 1, cachePages: 1, rowCount: payload.rows.length, columns: ["Codigo", "amount"], sha256: hash(payload), complete: true };
    }
    const allPages = async (r) => { const result = []; for (const kind of ["sales", "purchases", "articles", "stock"]) result.push(await page(r, kind)); return result; };
    await now("2026-09-09T20:59:59Z");
    assert.equal((await claim()).reason, "outside_window");
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs")).rows[0].n, 0);
    await assert.rejects(claim(otherOrg), /actor/);
    await now("2026-09-09T21:00:00Z");
    await db.query("update organization_members set role='viewer' where organization_id=$1", [org]);
    await assert.rejects(claim(), /actor/);
    await db.query("update organization_members set role='owner' where organization_id=$1", [org]);
    const first = await claim(); assert.equal(first.claimed, true); assert.equal(first.scheduledDay, "2026-09-09");
    assert.equal((await claim()).reason, "already_attempted");
    passed("18:00 Montevideo window, actor permission and one daily attempt across worker restarts");
    await assert.rejects(reserve(first, otherOrg), /vigente/);
    await assert.rejects(reserve(first, org, randomUUID()), /vigente/);
    await assert.rejects(reserve(first, org, null), /vigente/);
    for (let i = 1; i <= 3; i++) assert.equal((await reserve(first)).requestNumber, i);
    await assert.rejects(reserve(first), /presupuesto/);
    await fail(first); assert.equal((await claim()).reason, "already_attempted");
    passed("fenced request reservations consume the daily budget even after failures");
    await now("2026-09-10T21:00:00Z"); const second = await claim();
    await assert.rejects(page(second, "stock", { organizationId: otherOrg, connectionId: otherConnection }), /organizacion/);
    await assert.rejects(page(second, "stock", { connectionId: otherConnection }), /organizacion/);
    const reports = await allPages(second);
    await assert.rejects(publish(second, reports.slice(0, 3)), /requiere ventas/);
    await assert.rejects(publish(second, reports, randomUUID()), /pertenece/);
    const malformed = reports.map((r) => ({ ...r })); delete malformed[0].complete;
    await assert.rejects(publish(second, malformed), /incompleto/);
    await assert.rejects(db.query("select publish_zeta_daily_sync($1,$2,$3,null)", [org, second.runId, second.leaseToken]), /manifiesto/);
    const missingRows = reports.map((r) => ({ ...r, rowCount: 100 }));
    await assert.rejects(publish(second, missingRows), /Faltan paginas/);
    assert.equal((await db.query("select status from integration_sync_runs where id=$1", [second.runId])).rows[0].status, "running");
    assert.equal((await publish(second, reports)).published, true);
    assert.equal((await publish(second, reports)).idempotent, true);
    assert.equal((await fail(second)).failed, false);
    passed("atomic publication requires four complete datasets and preserves status on any invalid manifest");
    await assert.rejects(db.query("update integration_raw_records set payload_json='{}' where last_sync_run_id=$1", [second.runId]), /inmutables/);
    await assert.rejects(page(second, "base-prices"), /organizacion/);
    passed("snapshot pages are immutable and cannot be appended after publication");
    await db.query("select set_config('test.actor',$1,false)", [actor]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs")).rows[0].n, 2);
    assert.equal((await db.query("update integration_sync_runs set metadata_json='{}' where id=$1 returning id", [second.runId])).rows.length, 0);
    assert.equal((await db.query("delete from integration_raw_records where last_sync_run_id=$1 returning id", [second.runId])).rows.length, 0);
    await assert.rejects(db.query("select claim_zeta_daily_sync($1,$2,3,'{}')", [org, actor]), /permission denied/);
    await assert.rejects(db.query("insert into integration_sync_runs(organization_id,provider,stream,status,test_mode) values($1,'zetasoftware','zeta.daily_cache','completed',false)", [org]), /row-level security/);
    await db.query("select set_config('test.actor',$1,false)", [randomUUID()]);
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::integer as n from integration_raw_records")).rows[0].n, 0);
    await db.exec("reset role");
    passed("RLS permits tenant reads but prevents authenticated snapshot forgery, deletion and RPC calls");
    await now("2026-09-11T21:00:00Z"); const third = await claim(); await now("2026-09-12T01:00:01Z");
    await assert.rejects(reserve(third), /vigente/);
    await assert.rejects(publish(third, reports), /no puede publicar/);
    await now("2026-09-12T21:00:00Z"); const fourth = await claim(); assert.equal(fourth.claimed, true);
    assert.equal((await db.query("select status from integration_sync_runs where id=$1", [third.runId])).rows[0].status, "failed");
    assert.equal((await db.query("select id from integration_sync_runs where status='completed'")).rows[0].id, second.runId);
    passed("expired leases cannot send or publish and next-day recovery preserves the last complete snapshot");
    await db.query(`insert into integration_raw_records(organization_id,connection_id,provider,stream,entity_type,external_key,payload_hash)
      values($1,$2,'zetasoftware','zeta.masters.contacts','contact','keep-original','fixture')`, [org, connection]);
    await publish(fourth, await allPages(fourth));
    await now("2026-09-13T21:00:00Z"); const fifth = await claim(); await publish(fifth, await allPages(fifth));
    assert.equal((await db.query("select count(distinct last_sync_run_id)::integer as n from integration_raw_records where entity_type='report_snapshot_page'")).rows[0].n, 2);
    assert.ok((await db.query("select metadata_json->>'cachePrunedAt' as pruned from integration_sync_runs where id=$1", [second.runId])).rows[0].pruned);
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs where status='completed'")).rows[0].n, 3);
    assert.equal((await db.query("select count(*)::integer as n from integration_raw_records where entity_type='contact'")).rows[0].n, 1);
    await now("2026-09-14T21:00:00Z"); const sixth = await claim(); await page(sixth, "stock"); await fail(sixth);
    assert.equal((await db.query("select count(*)::integer as n from integration_raw_records where last_sync_run_id=$1", [sixth.runId])).rows[0].n, 0);
    passed("retention keeps two full copies and run evidence, removes failed staging, and preserves canonical raw records");
    console.log(`# ${checks} PostgreSQL groups passed; no network or Zeta calls.`);
  } finally { await db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
