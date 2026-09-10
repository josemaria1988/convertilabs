/* eslint-disable @typescript-eslint/no-require-imports */
// Offline actual PostgreSQL semantics through the existing private PGlite runtime.
// node tests/zeta-cache-postgres-smoke.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const { PGlite } = require(process.env.CONVERTILABS_PGLITE_MODULE || path.join(root, ".local-companion/qa-sql/node_modules/@electric-sql/pglite"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replaceAll("\r\n", "\n");
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
    const originalSql = read("supabase/migrations/20260909_zeta_daily_cache.sql");
    const pricesSql = read("supabase/migrations/20260910_zeta_sales_prices.sql");
    const earlySql = read("supabase/migrations/20260910_zeta_authorized_early_sync.sql");
    const functionSql = (source, name) => {
      const start = source.indexOf(`create or replace function public.${name}(`);
      assert.ok(start >= 0, `Missing function ${name}`);
      return source.slice(start, source.indexOf("\n$$;", start) + 4).trim();
    };
    const updatedClaim = functionSql(sql, "claim_zeta_daily_sync");
    assert.equal(earlySql.trim(), updatedClaim, "early migration must contain only the claim function");
    assert.equal(sql.replace(updatedClaim, () => functionSql(originalSql, "claim_zeta_daily_sync"))
      .replaceAll("'stock','base-prices','sales-prices'", "'stock','base-prices'"), originalSql,
    "only the claim function and previously authorized sale-price guards may change");
    const updatedFunctions = ["guard_zeta_report_snapshot_page", "publish_zeta_daily_sync"].map((name) => {
      const start = sql.indexOf(`create or replace function public.${name}(`);
      return sql.slice(start, sql.indexOf("\n$$;", start) + 4).trim();
    });
    assert.equal(pricesSql.trim(), updatedFunctions.join("\n\n"));
    await db.exec(originalSql); await db.exec(pricesSql); await db.exec(earlySql); await db.exec(pricesSql); await db.exec(earlySql);
    const privileges = (await db.query(`select
      has_function_privilege('anon', 'public.claim_zeta_daily_sync(uuid,uuid,integer,jsonb)', 'EXECUTE') as anon,
      has_function_privilege('authenticated', 'public.claim_zeta_daily_sync(uuid,uuid,integer,jsonb)', 'EXECUTE') as authenticated,
      has_function_privilege('service_role', 'public.claim_zeta_daily_sync(uuid,uuid,integer,jsonb)', 'EXECUTE') as service`)).rows[0];
    assert.deepEqual(privileges, { anon: false, authenticated: false, service: true });
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
    const claim = async (organization = org, budget = 3, input = {}) => (await db.query("select claim_zeta_daily_sync($1,$2,$3,$4) as value", [organization, actor, budget, JSON.stringify(input)])).rows[0].value;
    const reserve = async (r, organization = org, token = r.leaseToken) => (await db.query("select reserve_zeta_daily_request($1,$2,$3,'RESTFixtureQuery') as value", [organization, r.runId, token])).rows[0].value;
    const publish = async (r, reports, token = r.leaseToken) => (await db.query("select publish_zeta_daily_sync($1,$2,$3,$4) as value", [org, r.runId, token, JSON.stringify({ schemaVersion: 1, reports })])).rows[0].value;
    const fail = async (r) => (await db.query("select fail_zeta_daily_sync($1,$2,$3,'fixture','fixture') as value", [org, r.runId, r.leaseToken])).rows[0].value;
    async function page(r, kind, options = {}) {
      const key = hash(kind).slice(0, 32); const payload = { rows: options.rows ?? [{ Codigo: "000001", amount: 12 }] };
      const metadata = { schemaVersion: 1, snapshotKey: key, page: 1, report: kind };
      await db.query(`insert into integration_raw_records(organization_id,connection_id,provider,stream,entity_type,external_key,payload_json,payload_hash,last_sync_run_id,metadata_json)
        values($1,$2,'zetasoftware',$3,'report_snapshot_page',$4,$5,$6,$7,$8)`,
      [options.organizationId ?? org, options.connectionId ?? connection, `zeta.reports.${kind.replaceAll("-", "_")}`, `${r.runId}:${key}:000001`, JSON.stringify(payload), hash(payload), r.runId, JSON.stringify(metadata)]);
      return { snapshotKey: key, report: kind, endpoint: "RESTFixtureQuery", filters: {}, startedAt: "2026-09-09T21:00:00Z", completedAt: "2026-09-09T21:02:00Z",
        pages: 1, cachePages: 1, rowCount: payload.rows.length, columns: ["Codigo", "amount"], sha256: hash(payload), complete: true };
    }
    const allPages = async (r) => { const result = []; for (const kind of ["sales", "purchases", "articles", "stock"]) result.push(await page(r, kind)); return result; };
    await now("2026-09-09T20:59:59Z");
    assert.equal((await claim()).reason, "outside_window");
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs")).rows[0].n, 0);
    await assert.rejects(claim(otherOrg), /actor/);
    const manualReason = "El usuario autoriza adelantar hoy la sincronizacion de precios de venta.";
    const manualInput = { manualAuthorization: { reason: manualReason }, salesPriceLists: [1] };
    for (const manualAuthorization of [null, true, "approved", [], {}, { reason: 123 }, { reason: "" }, { reason: "corto" },
      { reason: "x".repeat(501) }, { reason: ` ${manualReason}` }, { reason: `${manualReason} ` },
      { reason: `\u00a0${manualReason}` }, { reason: `${manualReason}\n` }, { reason: `Autorizacion\tmanual del usuario` },
      { reason: manualReason, actorUserId: actor }]) {
      await assert.rejects(claim(org, 3, { manualAuthorization }), /manualAuthorization/);
    }
    await assert.rejects(claim(otherOrg, 3, manualInput), /actor/);
    await db.query("update organization_members set role='viewer' where organization_id=$1", [org]);
    await assert.rejects(claim(), /actor/);
    await assert.rejects(claim(org, 3, manualInput), /actor/);
    await db.query("update organization_members set role='owner' where organization_id=$1", [org]);
    await db.query("update organization_members set is_active=false where organization_id=$1", [org]);
    await assert.rejects(claim(org, 3, manualInput), /actor/);
    await db.query("update organization_members set is_active=true where organization_id=$1", [org]);
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs")).rows[0].n, 0, "invalid authorization must never spend a slot");
    await db.exec("set role service_role");
    const first = await claim(org, 3, manualInput); assert.equal(first.claimed, true); assert.equal(first.scheduledDay, "2026-09-09");
    await db.exec("reset role");
    assert.equal(first.manualAuthorized, true);
    const audit = (await db.query("select input_json, metadata_json, initiated_by_user_id from integration_sync_runs where id=$1", [first.runId])).rows[0];
    assert.deepEqual(audit.input_json, manualInput);
    assert.equal(audit.initiated_by_user_id, actor);
    assert.equal(audit.metadata_json.trigger, "user_requested");
    assert.equal(audit.metadata_json.scheduleOverrideApplied, true);
    assert.equal(audit.metadata_json.scheduledHour, 18);
    assert.equal(audit.metadata_json.maxRequests, 3);
    assert.equal(audit.metadata_json.manualAuthorization.reason, manualReason);
    assert.equal(audit.metadata_json.manualAuthorization.actorUserId, actor);
    assert.equal(audit.metadata_json.manualAuthorization.scheduledDay, "2026-09-09");
    assert.equal(audit.metadata_json.manualAuthorization.scope, "advance_today_only");
    assert.equal(Date.parse(audit.metadata_json.manualAuthorization.authorizedAt), Date.parse("2026-09-09T20:59:59Z"));
    assert.equal((await claim(org, 3, manualInput)).reason, "already_attempted");
    await now("2026-09-09T21:00:00Z");
    assert.equal((await claim()).reason, "already_attempted");
    passed("explicit audited authorization advances today's sole attempt; invalid reasons and unauthorized actors remain blocked");
    passed("18:00 Montevideo window remains the default and the normal scheduled run cannot repeat an advanced attempt");
    await assert.rejects(reserve(first, otherOrg), /vigente/);
    await assert.rejects(reserve(first, org, randomUUID()), /vigente/);
    await assert.rejects(reserve(first, org, null), /vigente/);
    for (let i = 1; i <= 3; i++) assert.equal((await reserve(first)).requestNumber, i);
    await assert.rejects(reserve(first), /presupuesto/);
    await fail(first); assert.equal((await claim()).reason, "already_attempted");
    passed("fenced request reservations consume the daily budget even after failures");
    await now("2026-09-10T20:59:59Z"); assert.equal((await claim()).reason, "outside_window");
    await now("2026-09-10T21:00:00Z"); const second = await claim();
    assert.equal(second.manualAuthorized, false, "manual authorization never carries over into the next daily run");
    assert.equal((await db.query("select metadata_json ? 'manualAuthorization' as manual from integration_sync_runs where id=$1", [second.runId])).rows[0].manual, false);
    await assert.rejects(page(second, "stock", { organizationId: otherOrg, connectionId: otherConnection }), /organizacion/);
    await assert.rejects(page(second, "stock", { connectionId: otherConnection }), /organizacion/);
    const reports = await allPages(second);
    const priceReports = [await page(second, "base-prices"), await page(second, "sales-prices")];
    await assert.rejects(publish(second, [...reports, { ...priceReports[1], report: "unsupported-prices" }]), /incompleto/);
    await assert.rejects(publish(second, [...reports, { ...priceReports[1], rowCount: 2 }]), /Faltan paginas/);
    await assert.rejects(publish(second, reports.slice(0, 3)), /requiere ventas/);
    await assert.rejects(publish(second, reports, randomUUID()), /pertenece/);
    const malformed = reports.map((r) => ({ ...r })); delete malformed[0].complete;
    await assert.rejects(publish(second, malformed), /incompleto/);
    await assert.rejects(db.query("select publish_zeta_daily_sync($1,$2,$3,null)", [org, second.runId, second.leaseToken]), /manifiesto/);
    const missingRows = reports.map((r) => ({ ...r, rowCount: 100 }));
    await assert.rejects(publish(second, missingRows), /Faltan paginas/);
    assert.equal((await db.query("select status from integration_sync_runs where id=$1", [second.runId])).rows[0].status, "running");
    assert.equal((await publish(second, [...reports, ...priceReports])).published, true);
    assert.equal((await publish(second, [...reports, ...priceReports])).idempotent, true);
    assert.equal((await fail(second)).failed, false);
    passed("atomic publication accepts complete sales prices, requires four core datasets and rejects missing price pages or unknown reports");
    await assert.rejects(db.query("update integration_raw_records set payload_json='{}' where last_sync_run_id=$1", [second.runId]), /inmutables/);
    await assert.rejects(page(second, "base-prices"), /organizacion/);
    passed("snapshot pages are immutable and cannot be appended after publication");
    await db.query("select set_config('test.actor',$1,false)", [actor]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select count(*)::integer as n from integration_sync_runs")).rows[0].n, 2);
    assert.equal((await db.query("update integration_sync_runs set metadata_json='{}' where id=$1 returning id", [second.runId])).rows.length, 0);
    assert.equal((await db.query("delete from integration_raw_records where last_sync_run_id=$1 returning id", [second.runId])).rows.length, 0);
    await assert.rejects(db.query("select claim_zeta_daily_sync($1,$2,3,'{}')", [org, actor]), /permission denied/);
    await assert.rejects(claim(org, 3, manualInput), /permission denied/);
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
