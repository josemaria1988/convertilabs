/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const { createHash } = require("node:crypto");
const { test, assert } = require("./testkit.cjs");
const bytes = Buffer.from("%PDF-1.4\ninvoice evidence\n");
const fileHash = createHash("sha256").update(bytes).digest("hex");
const input = { slug: "rontil", originalFilename: "invoice.pdf", mimeType: "application/pdf", fileSize: bytes.length,
  fileHash, processingProvider: "codex_local", sourceSurface: "mobile_field" };
const reservation = { document_id: "document-1", storage_bucket: "documents-private", storage_path: "org-1/document-1/invoice.pdf",
  status: "uploading", is_duplicate: true, upload_state: "resume", upload_lease_token: "lease-1" };
const document = { status: "uploading", file_hash: fileHash, file_size: bytes.length, storage_bucket: reservation.storage_bucket,
  storage_path: reservation.storage_path, metadata: { upload_lease_token: "lease-1" }, current_draft_id: null, current_processing_run_id: null };

async function withActions(options, inspect) {
  const calls = []; const filters = [];
  const finishedDocument = { status: "uploaded", current_draft_id: null, current_processing_run_id: null, ...options.finished };
  const user = {
    rpc(name, payload) {
      calls.push({ kind: "rpc", name, payload });
      const result = { data: name === "prepare_document_upload_with_hash" ? { ...reservation, ...options.reservation } : finishedDocument, error: null };
      return { ...result, single: async () => result };
    },
    from(name) {
      assert.equal(name,"documents");
      const query = { select() { return query; }, eq(column,value) { filters.push([column,value]); return query; },
        async maybeSingle() { return { data: { ...document, ...options.document }, error: null }; } };
      return query;
    },
  };
  const service = { storage: { from(bucket) {
    assert.equal(bucket,"documents-private");
    return {
      async download(path) { calls.push({ kind: "download",path }); return options.stored ?? { data: new Blob([bytes]), error: null }; },
      async createSignedUploadUrl(path,settings) { calls.push({ kind: "sign",path,settings }); return { data: { token: "signed-token", signedUrl: "https://storage.invalid/upload" }, error: null }; },
    };
  } } };
  const request = "@/app/app/o/[slug]/documents/actions";
  const originalCacheKeys = new Set(Object.keys(require.cache));
  const filename = require.resolve(request); const previousModule = require.cache[filename]; const previousLoad = Module._load;
  Module._load = function(name,parent,isMain) {
    if(name === "next/cache") return { revalidatePath() {} };
    if(name === "@/lib/supabase/server") return { getSupabaseServerClient: async () => user, getSupabaseServiceRoleClient: () => service };
    if(name === "@/modules/auth/server-auth") return { requireOrganizationDashboardPage: async () => { calls.push({ kind: "auth" }); return { organization: { id: "org-1",role: "owner" }, authState: { user: { id: "actor-1" } } }; } };
    if(name === "@/modules/documents/processing") return { enqueueDocumentProcessing: async () => { throw new Error("Upload preparation must not extract or send ERP data"); } };
    return previousLoad.call(this,name,parent,isMain);
  };
  try {
    delete require.cache[filename];
    const actions = require(request);
    Module._load = previousLoad;
    await inspect(actions,calls,filters);
  } finally {
    Module._load = previousLoad;
    for (const key of Object.keys(require.cache)) if (!originalCacheKeys.has(key)) delete require.cache[key];
    delete require.cache[filename]; if(previousModule) require.cache[filename] = previousModule;
  }
}

test("a stored original with a lost acknowledgement resumes the same reservation without uploading another copy", async () => {
  await withActions({},async (actions,calls) => {
    const result = await actions.prepareDocumentUploadAction(input);
    assert.equal(result.ok,true); assert.equal(result.documentId,"document-1"); assert.equal(result.uploadRequired,false); assert.equal(result.shouldEnqueue,true);
    assert.deepEqual(calls.filter((call) => call.kind === "rpc").map((call) => call.name),["prepare_document_upload_with_hash","finish_document_upload_with_lease"]);
    assert.equal(calls.filter((call) => call.kind === "download").length,1); assert.equal(calls.some((call) => call.kind === "sign"),false);
    assert.equal(calls.find((call) => call.name === "prepare_document_upload_with_hash").payload.p_file_hash,fileHash);
  });
});
test("an interrupted upload with no stored object resumes its original path without permitting overwrites", async () => {
  await withActions({ stored: { data: null,error: { statusCode: "404",message: "not found" } } },async (actions,calls) => {
    const result = await actions.prepareDocumentUploadAction(input);
    assert.equal(result.ok,true); assert.equal(result.uploadRequired,true); assert.equal(result.documentId,"document-1"); assert.equal(result.uploadLeaseToken,"lease-1");
    assert.deepEqual(calls.find((call) => call.kind === "sign"),{ kind: "sign",path: reservation.storage_path,settings: { upsert: false } });
  });
});
test("an existing object with different bytes or unavailable storage blocks recovery without a signed upload", async () => {
  for(const stored of [{ data: new Blob([Buffer.alloc(bytes.length)]),error: null }, { data: null,error: { statusCode: "503",message: "unavailable" } }]) {
    await withActions({ stored },async (actions,calls) => {
      const result = await actions.prepareDocumentUploadAction(input);
      assert.equal(result.ok,false); assert.equal(calls.some((call) => call.kind === "sign"),false);
      assert.ok(calls.find((call) => call.name === "finish_document_upload_with_lease").payload.p_error_message);
    });
  }
});
test("busy and already processed duplicates neither upload nor re-enqueue the original", async () => {
  for(const upload_state of ["busy","existing"]) await withActions({ reservation: { upload_state,upload_lease_token: null } },async (actions,calls) => {
    const result = await actions.prepareDocumentUploadAction(input);
    assert.equal(result.ok,upload_state === "existing"); if(result.ok) assert.equal(result.shouldEnqueue,false);
    assert.equal(calls.some((call) => call.kind === "download" || call.kind === "sign"),false);
    assert.equal(calls.filter((call) => call.kind === "rpc").length,1);
  });
});
test("finalization checks the authenticated organization, owner, lease and stored SHA before allowing enqueue", async () => {
  await withActions({},async (actions,calls,filters) => {
    const result = await actions.finalizeDocumentUploadAction({ slug: "rontil",documentId: "document-1",uploadLeaseToken: "lease-1" });
    assert.equal(result.ok,true); assert.equal(result.shouldEnqueue,true);
    assert.deepEqual(filters,[["id","document-1"],["organization_id","org-1"],["uploaded_by","actor-1"]]);
    assert.equal(calls.filter((call) => call.kind === "download").length,1);
  });
  await withActions({},async (actions,calls) => {
    const result = await actions.finalizeDocumentUploadAction({ slug: "rontil",documentId: "document-1",uploadLeaseToken: "obsolete-lease" });
    assert.equal(result.ok,false); assert.equal(calls.some((call) => call.kind === "download" || call.kind === "rpc"),false);
  });
  await withActions({ stored: { data: new Blob(["wrong file"]),error: null } },async (actions,calls) => {
    const result = await actions.finalizeDocumentUploadAction({ slug: "rontil",documentId: "document-1",uploadLeaseToken: "lease-1" });
    assert.equal(result.ok,false); assert.ok(calls.find((call) => call.kind === "rpc").payload.p_error_message);
  });
});
test("a late successful callback preserves a completed draft and invalid hashes make no remote calls", async () => {
  await withActions({ document: { status: "extracted",current_draft_id: "draft-1" },finished: { status: "extracted",current_draft_id: "draft-1" } },async (actions,calls) => {
    const result = await actions.finalizeDocumentUploadAction({ slug: "rontil",documentId: "document-1",uploadLeaseToken: "lease-1" });
    assert.equal(result.ok,true); assert.equal(result.shouldEnqueue,false); assert.equal(calls.some((call) => call.kind === "download"),false);
  });
  await withActions({},async (actions,calls) => {
    const result = await actions.prepareDocumentUploadAction({ ...input,fileHash: null });
    assert.equal(result.ok,false); assert.deepEqual(calls,[]);
  });
});
