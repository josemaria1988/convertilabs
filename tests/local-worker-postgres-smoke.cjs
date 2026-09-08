/* eslint-disable @typescript-eslint/no-require-imports */
// Offline PostgreSQL engine smoke. PGlite runs one backend; this checks concurrent
// request dispatch, fencing and transactional behavior, not multi-backend load.
// npm install --prefix .local-companion/qa-sql --no-save --ignore-scripts @electric-sql/pglite
// node tests/local-worker-postgres-smoke.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const modulePath = process.env.CONVERTILABS_PGLITE_MODULE
  || path.join(root, ".local-companion/qa-sql/node_modules/@electric-sql/pglite");

function source(name) { return fs.readFileSync(path.join(root, "db/schema", name), "utf8"); }
function table(file, name) {
  const sql = source(file);
  const start = sql.indexOf(`create table if not exists public.${name} (`);
  assert.ok(start >= 0, `Canonical table not found: ${name}`);
  const end = sql.indexOf("\n);", start);
  assert.ok(end > start);
  return sql.slice(start, end + 3);
}

async function runSmoke() {
  const { PGlite } = require(modulePath);
  const db = new PGlite();
  let checks = 0;
  function passed(name) { checks++; console.log(`ok - ${name}`); }
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_user::text $$;
      create table public.organizations (id uuid primary key);
      create table public.profiles (id uuid primary key);
      create table public.organization_cost_centers (id uuid primary key);
      create table public.organization_profile_versions (id uuid primary key);
      create table public.vendors (id uuid primary key);
    `);
    await db.exec(source("01_enums.sql"));
    for (const [file, name] of [
      ["02_identity_and_tenants.sql", "organization_members"],
      ["04_documents.sql", "documents"],
      ["04_documents.sql", "document_extractions"],
      ["08_document_ai_pipeline.sql", "organization_rule_snapshots"],
      ["08_document_ai_pipeline.sql", "document_processing_runs"],
      ["08_document_ai_pipeline.sql", "document_field_candidates"],
      ["08_document_ai_pipeline.sql", "document_classification_candidates"],
      ["08_document_ai_pipeline.sql", "document_drafts"],
      ["08_document_ai_pipeline.sql", "document_draft_steps"],
      ["08_document_ai_pipeline.sql", "document_revisions"],
      ["08_document_ai_pipeline.sql", "document_invoice_identities"],
      ["07_integrations_and_audit.sql", "ai_decision_logs"],
    ]) await db.exec(table(file, name));
    const pipeline = source("08_document_ai_pipeline.sql");
    const documentAlter = pipeline.match(/alter table public\.documents\s+add column if not exists current_processing_run_id[\s\S]*?;/);
    assert.ok(documentAlter);
    await db.exec(documentAlter[0]);
    const workerSql = source("16_local_document_worker.sql");
    await db.exec(workerSql);
    // Verify idempotent DDL installation as well as CREATE FUNCTION parse/runtime.
    await db.exec(workerSql);
    await db.exec("grant usage on schema public to service_role; grant all on all tables in schema public to service_role;");
    passed("canonical table constraints and worker migration load twice in PostgreSQL");

    const orgA = randomUUID(); const orgB = randomUUID(); const actor = randomUUID();
    const snapA = randomUUID(); const snapB = randomUUID();
    await db.query("insert into organizations values ($1),($2)", [orgA, orgB]);
    await db.query("insert into profiles values ($1)", [actor]);
    await db.query("insert into organization_members(organization_id,user_id,role) values ($1,$3,'owner'),($2,$3,'owner')", [orgA, orgB, actor]);
    for (const [id, org] of [[snapA, orgA], [snapB, orgB]]) await db.query(`insert into organization_rule_snapshots
      (id,organization_id,version_number,effective_from,legal_entity_type,tax_regime_code,prompt_summary)
      values ($1,$2,1,'2026-09-07','fixture','fixture','offline test')`, [id, org]);
    const hash = (text) => createHash("sha256").update(text).digest("hex");
    const createDocument = async (org, fileHash) => {
      const id = randomUUID();
      await db.query(`insert into documents(id,organization_id,status,storage_path,original_filename,file_hash,uploaded_by)
        values ($1,$2,'uploaded',$3,'fixture.pdf',$4,$5)`, [id, org, `${org}/${id}/fixture.pdf`, fileHash, actor]);
      return id;
    };
    const enqueue = async (org, doc, snap) => (await db.query("select enqueue_local_document_processing($1,$2,$3,'upload',$4) as id", [org, doc, actor, snap])).rows[0].id;
    const claim = async (org, worker) => (await db.query("select claim_local_document_processing($1,$2) as value", [org, worker])).rows[0].value;
    const heartbeat = async (org, run, worker, token) => (await db.query("select heartbeat_local_document_processing($1,$2,$3,$4) as value", [org, run, worker, token])).rows[0].value;
    const fail = async (org, run, worker, token, retry) => (await db.query("select fail_local_document_processing($1,$2,$3,$4,'fixture failure','fixture_stage',$5) as value", [org, run, worker, token, retry])).rows[0].value;
    const complete = async (org, run, worker, token, payload) => (await db.query("select complete_local_document_processing($1,$2,$3,$4,$5::jsonb) as value", [org, run, worker, token, JSON.stringify(payload)])).rows[0].value;
    const count = async (name, doc) => Number((await db.query(`select count(*)::int as count from ${name} where document_id=$1`, [doc])).rows[0].count);
    const payload = (fileHash, key = "supplier:invoice:001") => ({
      file_hash: fileHash, model_code: "offline-fixture", latency_ms: 1,
      output: { transaction_family_candidate: "purchase", document_subtype_candidate: "supplier_invoice", confidence_score: 0.9, extracted_text: "Synthetic invoice", operation_category_candidate: "expense", line_items: [] },
      intake_context: {}, fields: {}, warnings: [], field_candidates: [], classification_candidates: [], steps: [],
      invoice_identity: { issuer_tax_id_normalized: "210000000010", document_number_normalized: "001", document_date: "2026-09-07", total_amount: 122, currency_code: "UYU", identity_strategy: "rut_number", invoice_identity_key: key, duplicate_status: "clear" },
      decision_log: { decision_source: "model", confidence_score: 0.9, certainty_level: "yellow", evidence_json: {}, rationale_text: "Offline fixture", warnings_json: [], metadata_json: {} },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, diagnostics: {},
    });
    const docA1 = await createDocument(orgA, hash("A1"));
    const docA2 = await createDocument(orgA, hash("A2"));
    const docB1 = await createDocument(orgB, hash("A1"));
    await db.query("update organization_members set is_active=false where organization_id=$1", [orgA]);
    await assert.rejects(enqueue(orgA, docA1, snapA), /solicitante/);
    await db.query("update organization_members set is_active=true,role='viewer' where organization_id=$1", [orgA]);
    await assert.rejects(enqueue(orgA, docA1, snapA), /solicitante/);
    await db.query("update organization_members set role='owner' where organization_id=$1", [orgA]);
    await db.query("update documents set posting_status='posted_final' where id=$1", [docA1]);
    await assert.rejects(enqueue(orgA, docA1, snapA), /estado actual/);
    await db.query("update documents set posting_status='draft' where id=$1", [docA1]);
    passed("inactive actors, viewers and posted documents cannot enqueue even through the RPC");
    const runA1 = await enqueue(orgA, docA1, snapA);
    assert.equal(await enqueue(orgA, docA1, snapA), runA1);
    await assert.rejects(db.query("insert into document_processing_runs(organization_id,document_id,run_number,provider_code) values($1,$2,99,'openai')", [orgA, docA1]), /document_processing_already_active/);
    await assert.rejects(enqueue(orgA, docA2, snapB), /Snapshot ajeno/);
    await assert.rejects(enqueue(orgA, docB1, snapA));
    const runA2 = await enqueue(orgA, docA2, snapA);
    await enqueue(orgB, docB1, snapB);
    passed("enqueue is idempotent, active provider collision and foreign organization are rejected");

    const claims = await Promise.all([claim(orgA, "worker-1"), claim(orgA, "worker-2")]);
    assert.equal(new Set(claims.map((row) => row.id)).size, 2);
    assert.deepEqual(new Set(claims.map((row) => row.id)), new Set([runA1, runA2]));
    assert.equal(await claim(orgA, "worker-3"), null);
    assert.ok(claims.every((row) => row.organization_id === orgA));
    const initial = claims.find((row) => row.id === runA1);
    const second = claims.find((row) => row.id === runA2);
    passed("simultaneously dispatched claims return distinct leases and no foreign work");

    await db.query("update document_processing_runs set lease_expires_at=now()-interval '1 second' where id=$1", [runA1]);
    assert.equal(await heartbeat(orgA, runA1, initial.lease_owner, initial.lease_token), false);
    const reclaimed = await claim(orgA, "worker-recovered");
    assert.equal(reclaimed.id, runA1);
    assert.notEqual(reclaimed.lease_token, initial.lease_token);
    assert.equal(reclaimed.attempt_count, 2);
    assert.equal(await fail(orgA, runA1, initial.lease_owner, initial.lease_token, true), false);
    await assert.rejects(complete(orgA, runA1, initial.lease_owner, initial.lease_token, payload(hash("A1"))), /local_lease_lost/);
    assert.equal(await heartbeat(orgA, runA1, reclaimed.lease_owner, reclaimed.lease_token), true);
    assert.equal(await heartbeat(orgB, runA1, reclaimed.lease_owner, reclaimed.lease_token), false);
    await assert.rejects(complete(orgB, runA1, reclaimed.lease_owner, reclaimed.lease_token, payload(hash("A1"))));
    await assert.rejects(complete(orgA, runA1, reclaimed.lease_owner, reclaimed.lease_token, payload(hash("modified-file"))), /hash de la carga original/);
    passed("expired leases reclaim with new token and stale or cross-tenant writers are fenced");

    const invalidPayload = payload(hash("A1")); invalidPayload.steps = [{ step_code: "identity", status: "invalid_step_status", snapshot_json: {} }];
    await assert.rejects(complete(orgA, runA1, reclaimed.lease_owner, reclaimed.lease_token, invalidPayload), /invalid input value for enum/);
    assert.equal(await count("document_extractions", docA1), 0);
    assert.equal(await count("document_drafts", docA1), 0);
    assert.equal((await db.query("select status from document_processing_runs where id=$1", [runA1])).rows[0].status, "processing");
    passed("completion failure rolls back extraction, draft and final state atomically");

    const first = await complete(orgA, runA1, reclaimed.lease_owner, reclaimed.lease_token, payload(hash("A1")));
    const repeat = await complete(orgA, runA1, reclaimed.lease_owner, reclaimed.lease_token, payload(hash("A1")));
    assert.equal(first.status, "extracted"); assert.equal(first.draftId, repeat.draftId);
    for (const name of ["document_extractions", "document_drafts", "document_revisions", "document_invoice_identities", "ai_decision_logs"]) assert.equal(await count(name, docA1), 1);
    const finalDoc = (await db.query("select status,posting_status,metadata from documents where id=$1", [docA1])).rows[0];
    assert.equal(finalDoc.status, "extracted"); assert.equal(finalDoc.posting_status, "draft"); assert.equal(finalDoc.metadata.review_required, true);
    passed("successful completion persists exactly one reviewed draft and repeat is idempotent");

    const fiscalDuplicate = await complete(orgA, runA2, second.lease_owner, second.lease_token, payload(hash("A2")));
    assert.equal(fiscalDuplicate.status, "skipped"); assert.equal(await count("document_drafts", docA2), 0);
    const docHashDuplicate = await createDocument(orgA, hash("A1")); await enqueue(orgA, docHashDuplicate, snapA);
    const hashClaim = await claim(orgA, "worker-hash");
    const hashDuplicate = await complete(orgA, hashClaim.id, hashClaim.lease_owner, hashClaim.lease_token, payload(hash("A1"), "unique-key"));
    assert.equal(hashDuplicate.status, "skipped"); assert.equal(await count("document_drafts", docHashDuplicate), 0);
    const orgBClaim = await claim(orgB, "worker-b");
    const independent = await complete(orgB, orgBClaim.id, orgBClaim.lease_owner, orgBClaim.lease_token, payload(hash("A1")));
    assert.equal(independent.status, "extracted");
    passed("file and fiscal duplicates do not create drafts and dedup stays within organization");

    const retryDoc = await createDocument(orgA, hash("retry")); const retryRun = await enqueue(orgA, retryDoc, snapA);
    const retry1 = await claim(orgA, "worker-retry");
    assert.equal(await fail(orgA, retryRun, retry1.lease_owner, retry1.lease_token, true), true);
    assert.equal(await claim(orgA, "worker-retry"), null);
    await db.query("update document_processing_runs set available_at=now()-interval '1 second' where id=$1", [retryRun]);
    const retry2 = await claim(orgA, "worker-retry"); assert.equal(retry2.attempt_count, 2);
    await db.query("update document_processing_runs set lease_expires_at=now()-interval '1 second' where id=$1", [retryRun]);
    const retry3 = await claim(orgA, "worker-retry"); assert.equal(retry3.attempt_count, 3);
    await db.query("update document_processing_runs set lease_expires_at=now()-interval '1 second' where id=$1", [retryRun]);
    assert.equal(await claim(orgA, "worker-retry"), null);
    const exhausted = (await db.query("select status,failure_stage from document_processing_runs where id=$1", [retryRun])).rows[0];
    assert.equal(exhausted.status, "error"); assert.equal(exhausted.failure_stage, "local_attempts_exhausted");
    passed("retry backoff and three-attempt exhaustion produce visible error without endless lease");

    const humanDoc = await createDocument(orgA, hash("human-approved"));
    const humanRun = await enqueue(orgA, humanDoc, snapA); const humanClaim = await claim(orgA, "worker-human");
    await db.query("update documents set posting_status='posted_final' where id=$1", [humanDoc]);
    await assert.rejects(complete(orgA, humanRun, humanClaim.lease_owner, humanClaim.lease_token, payload(hash("human-approved"), "human-invoice")), /local_run_superseded/);
    await db.query("update documents set status='approved' where id=$1", [humanDoc]);
    assert.equal(await fail(orgA, humanRun, humanClaim.lease_owner, humanClaim.lease_token, false), true);
    assert.equal((await db.query("select status from documents where id=$1", [humanDoc])).rows[0].status, "approved");
    const exhaustedHumanDoc = await createDocument(orgA, hash("human-exhausted"));
    const exhaustedHumanRun = await enqueue(orgA, exhaustedHumanDoc, snapA); await claim(orgA, "worker-human");
    await db.query("update documents set status='approved' where id=$1", [exhaustedHumanDoc]);
    await db.query("update document_processing_runs set attempt_count=3,lease_expires_at=now()-interval '1 second' where id=$1", [exhaustedHumanRun]);
    assert.equal(await claim(orgA, "worker-human"), null);
    assert.equal((await db.query("select status from documents where id=$1", [exhaustedHumanDoc])).rows[0].status, "approved");
    passed("late completion, failure and exhausted lease cannot overwrite a human-approved document");

    for (const role of ["anon", "authenticated"]) {
      const privileges = await db.query(`select proname, has_function_privilege($1, p.oid, 'execute') as allowed from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in
        ('enqueue_local_document_processing','claim_local_document_processing','heartbeat_local_document_processing','fail_local_document_processing','complete_local_document_processing')`, [role]);
      assert.equal(privileges.rows.length, 5); assert.ok(privileges.rows.every((row) => !row.allowed));
    }
    await db.exec("set role authenticated");
    await assert.rejects(claim(orgA, "browser"), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal(await claim(orgA, "trusted-local"), null);
    await db.exec("reset role");
    passed("browser roles cannot execute RPCs and service_role can execute through explicit grants");
    console.log(`# pass ${checks}; PostgreSQL engine: PGlite (single backend), no remote database contacted`);
  } finally { await db.close(); }
}

if (require.main === module) runSmoke().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { runSmoke };
