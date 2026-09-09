/* eslint-disable @typescript-eslint/no-require-imports */
// Offline PostgreSQL verification. PGlite serializes one backend; this is not a multibackend stress test.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
require("./register-ts.cjs");
const { localDocumentId } = require("@/modules/local-companion/documents");
const root = path.resolve(__dirname, "..");
const { PGlite } = require(process.env.CONVERTILABS_PGLITE_MODULE || path.join(root, ".local-companion/qa-sql/node_modules/@electric-sql/pglite"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function main() {
  const db = new PGlite();
  let checks = 0;
  const passed = (name) => { checks++; console.log(`ok - ${name}`); };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
      create table organizations(id uuid primary key); create table profiles(id uuid primary key);
      create table organization_cost_centers(id uuid primary key);
      create table organization_members(organization_id uuid, user_id uuid, role text, is_active boolean default true);
      create function is_org_member(p_org uuid) returns boolean language sql stable as $$ select exists(select 1 from organization_members where organization_id=p_org and user_id=auth.uid() and is_active) $$;`);
    await db.exec(read("db/schema/01_enums.sql"));
    const documents = read("db/schema/04_documents.sql");
    await db.exec(documents.slice(0, documents.indexOf("\n);") + 3));
    await db.exec("alter table documents add column current_draft_id uuid, add column current_processing_run_id uuid;");
    const org = randomUUID(); const otherOrg = randomUUID(); const actor = randomUUID(); const otherActor = randomUUID();
    await db.query("insert into organizations values ($1),($2)", [org, otherOrg]);
    await db.query("insert into profiles values ($1),($2)", [actor, otherActor]);
    await db.query("insert into organization_members values ($1,$2,'owner',true)", [org, actor]);
    const historical = [];
    for (let index = 0; index < 6; index++) {
      const id = randomUUID(); historical.push(id);
      await db.query("insert into documents(id,organization_id,storage_path,original_filename,file_hash,status,uploaded_by) values($1,$2,$3,'historical.pdf',$4,'approved',$5)",
        [id, org, `${org}/${id}/original.pdf`, hash(index < 2 ? "legacy-same-hash" : `legacy-${index}`), actor]);
    }
    const before = (await db.query("select to_jsonb(d) as row from documents d order by id")).rows;
    const sql = read("db/schema/18_document_upload_identity.sql");
    assert.equal(sql, read("supabase/migrations/20260909_document_upload_identity.sql"));
    await db.exec(sql); await db.exec(sql);
    assert.deepEqual((await db.query("select to_jsonb(d) as row from documents d order by id")).rows, before);
    passed("migration installs twice and preserves six historical rows including preexisting same-hash duplicates");
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [actor]);
    const prepare = async (fileHash, source = "mobile_field", organizationId = org) => (await db.query(
      "select * from prepare_document_upload_with_hash($1,'invoice.pdf','application/pdf',20,$2,'codex_local',$3)", [organizationId, fileHash, source])).rows[0];
    const uniqueHash = hash("same bytes from phone and desktop");
    const same = await Promise.all([prepare(uniqueHash, "mobile_field"), prepare(uniqueHash, "web")]);
    assert.equal(same[0].document_id, same[1].document_id);
    assert.equal(same[0].document_id, localDocumentId(org, uniqueHash));
    assert.equal(same.filter((item) => !item.is_duplicate).length, 1);
    assert.equal(same.find((item) => item.is_duplicate).upload_state, "busy");
    assert.equal((await db.query("select count(*)::int as count from documents where organization_id=$1 and file_hash=$2", [org, uniqueHash])).rows[0].count, 1);
    passed("phone and web reserve one shared identity and one original");

    for (const first of ["local", "mobile"]) {
      const fileHash = hash(`cross-source-${first}`); const id = localDocumentId(org, fileHash);
      const cliInsert = () => db.query("insert into documents(id,organization_id,status,storage_path,original_filename,file_hash,uploaded_by,upload_source) values($1,$2,'uploading',$3,'renamed.pdf',$4,$5,'local_companion') on conflict(id) do nothing", [id,org,`${org}/${id}/renamed.pdf`,fileHash,actor]);
      const tasks = first === "local" ? [cliInsert(), prepare(fileHash)] : [prepare(fileHash), cliInsert()];
      await Promise.all(tasks);
      const rows = (await db.query("select id from documents where organization_id=$1 and file_hash=$2", [org,fileHash])).rows;
      assert.deepEqual(rows, [{ id }]);
    }
    passed("CLI primary-key reservation and mobile RPC elect one original in either arrival order");
    const oldDuplicate = await prepare(hash("legacy-same-hash"));
    assert.ok(historical.includes(oldDuplicate.document_id)); assert.equal(oldDuplicate.is_duplicate, true);
    assert.equal((await db.query("select count(*)::int as count from documents where file_hash=$1",[hash("legacy-same-hash")])).rows[0].count,2);
    passed("existing historical originals are reused without imposing a failing unique hash index");
    await assert.rejects(prepare(uniqueHash, "mobile_field", otherOrg), /Not allowed/);
    await assert.rejects(prepare("not-a-sha"), /Invalid/);
    await assert.rejects(db.query("select * from prepare_document_upload_with_hash($1,'invoice.pdf',null,20,$2)",[org,hash("null mime")]), /Invalid/);
    await db.query("update organization_members set role='viewer' where organization_id=$1",[org]);
    await assert.rejects(prepare(hash("viewer")), /Not allowed/);
    await db.query("update organization_members set role='owner',is_active=false where organization_id=$1",[org]);
    await assert.rejects(prepare(hash("inactive")), /Not allowed/);
    await db.query("update organization_members set is_active=true where organization_id=$1",[org]);
    await db.query("insert into organization_members values ($1,$2,'owner',true)",[otherOrg,actor]);
    const scoped = await prepare(uniqueHash,"mobile_field",otherOrg);
    assert.notEqual(scoped.document_id,same[0].document_id);
    passed("tenant membership, inactive/viewer access and invalid hash reject before insertion");
    const recoveryHash = hash("interrupted phone upload");
    const reserved = await prepare(recoveryHash);
    const finish = (id, token, error = null) => db.query("select finish_document_upload_with_lease($1,$2,$3)",[id,token,error]);
    await db.query("update organization_members set role='viewer' where organization_id=$1",[org]);
    await assert.rejects(finish(reserved.document_id,reserved.upload_lease_token),/reserva/);
    await db.query("update organization_members set role='owner' where organization_id=$1",[org]);
    await finish(reserved.document_id, reserved.upload_lease_token, "lost connection");
    const recovered = await prepare(recoveryHash,"web");
    assert.equal(recovered.document_id,reserved.document_id); assert.equal(recovered.upload_state,"resume");
    assert.notEqual(recovered.upload_lease_token,reserved.upload_lease_token);
    await assert.rejects(finish(reserved.document_id,reserved.upload_lease_token,"late callback"),/reserva/);
    await db.query("update documents set metadata=jsonb_set(metadata,'{upload_lease_expires_at}',to_jsonb((now()-interval '1 minute')::text)) where id=$1",[reserved.document_id]);
    const afterExpiry = await prepare(recoveryHash);
    assert.equal(afterExpiry.document_id,reserved.document_id); assert.equal(afterExpiry.upload_state,"resume");
    await assert.rejects(finish(reserved.document_id,recovered.upload_lease_token),/reserva/);
    await finish(reserved.document_id,afterExpiry.upload_lease_token);
    const lostEnqueue = await prepare(recoveryHash);
    assert.equal(lostEnqueue.document_id,reserved.document_id); assert.equal(lostEnqueue.upload_state,"resume");
    await finish(reserved.document_id,lostEnqueue.upload_lease_token);
    await db.query("update documents set status='extracted',current_draft_id=$2 where id=$1",[reserved.document_id,randomUUID()]);
    const alreadyExtracted = await prepare(recoveryHash);
    assert.equal(alreadyExtracted.upload_state,"existing"); assert.equal(alreadyExtracted.upload_lease_token,null);
    assert.equal((await db.query("select count(*)::int as count from documents where file_hash=$1",[recoveryHash])).rows[0].count,1);
    passed("failed, expired and lost-acknowledgement retries recover one ID; stale leases and repeated extracted uploads cannot reset it");
    const doc = same[0].document_id;
    const docLease = same.find((item) => item.upload_state === "upload").upload_lease_token;
    // Old clients have no lease and cannot invalidate a current reservation.
    await db.query("select complete_document_upload($1)",[doc]);
    await db.query("select fail_document_upload($1,'late network failure')",[doc]);
    assert.equal((await db.query("select status from documents where id=$1",[doc])).rows[0].status,"uploading");
    await finish(doc,docLease);
    await finish(doc,docLease,"late network failure");
    assert.equal((await db.query("select status from documents where id=$1",[doc])).rows[0].status,"uploaded");
    for(const status of ["queued","extracting","approved"]) {
      await db.query("update documents set status=$2,current_processing_run_id=$3 where id=$1",[doc,status,randomUUID()]);
      await db.query("select complete_document_upload($1)",[doc]);
      await db.query("select fail_document_upload($1,'late failure')",[doc]);
      await finish(doc,docLease); await finish(doc,docLease,"late callback");
      assert.equal((await db.query("select status from documents where id=$1",[doc])).rows[0].status,status);
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherActor]);
    await assert.rejects(db.query("select complete_document_upload($1)",[doc]),/could not be finalized/);
    await assert.rejects(finish(doc,docLease),/reserva/);
    passed("late complete/fail callbacks preserve queued, processing and approved states and enforce ownership");
    await assert.rejects(db.query("select * from prepare_document_upload($1,'old.pdf','application/pdf',20)",[org]),/requiere SHA-256/);
    for (const signature of ["prepare_document_upload_with_hash(uuid,text,text,bigint,text,text,text)","finish_document_upload_with_lease(uuid,uuid,text)"]) {
      for (const role of ["anon","authenticated","service_role"]) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed",[role,signature])).rows[0].allowed,role === "authenticated");
      }
    }
    for (const role of ["anon","authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1,'enqueue_local_document_upload_once(uuid,uuid,uuid,text,uuid)','EXECUTE') as allowed",[role])).rows[0].allowed,false);
    }
    passed("hashless legacy uploads are blocked and Supabase-style default grants leave upload RPCs authenticated-only");
    console.log(`# pass ${checks}`);
  } finally { await db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode=1; });
