/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");
const { resolveLocalCompanionContext, localDocumentReviewUrl } = require("@/modules/local-companion/context");
const { serializeZetaReportCsv, validateLocalZetaReportFilters } = require("@/modules/local-companion/zeta-reports");
const { ingestLocalDocument, loadLocalDocumentStatus, localDocumentId, detectLocalDocumentMime } = require("@/modules/local-companion/documents");

const organizationId = "10000000-0000-0000-0000-000000000001";
const actorProfileId = "20000000-0000-0000-0000-000000000001";
const identity = { slug: "demo", actorProfileId };

function db(options = {}) {
  const state = { documents: [], audits: [], uploads: [], writes: 0, queries: [], ...options };
  const supabase = {
    from(table) {
      let operation = "select"; let payload; let maximum = Infinity; let single = false;
      const filters = [];
      const execute = () => {
        state.queries.push({ table, operation, filters });
        if (operation !== "select") state.writes++;
        if (table === "organizations") return { data: { id: organizationId, slug: "demo", name: "Demo" }, error: null };
        if (table === "organization_members") return { data: state.inactive ? null : { role: state.role ?? "owner" }, error: null };
        if (table === "audit_log") { state.audits.push(payload); return { data: null, error: null }; }
        if (table === "document_processing_runs") return { data: null, error: null };
        if (table !== "documents") throw new Error(`Unexpected table ${table}`);
        if (operation === "insert") {
          if (state.documents.some((row) => row.id === payload.id)) return { data: null, error: { code: "23505" } };
          state.documents.push({ current_processing_run_id: null, current_draft_id: null, created_at: "2026-09-07", updated_at: "2026-09-07", ...payload });
          return { data: null, error: null };
        }
        const matches = state.documents.filter((row) => filters.every(([key, value]) =>
          (key.startsWith("metadata->>") ? row.metadata?.[key.slice(11)] : row[key]) === value));
        if (operation === "update") {
          for (const row of matches) Object.assign(row, payload, { updated_at: new Date().toISOString() });
          return { data: single ? matches[0] ?? null : matches, error: null };
        }
        const rows = matches.slice(0, maximum);
        return { data: single ? rows[0] ?? null : rows, error: null };
      };
      const query = {
        select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, order() { return query; },
        limit(value) { maximum = value; return query; }, maybeSingle() { single = true; return Promise.resolve(execute()); },
        insert(value) { operation = "insert"; payload = value; return query; }, update(value) { operation = "update"; payload = value; return query; },
        then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      return query;
    },
    storage: { from(bucket) { return {
      async upload(key, bytes, options) { state.uploads.push({ bucket, key, bytes: bytes.length, options }); return { error: state.uploadFailure ? { message: "offline" } : null }; },
      async download() { return { data: state.storedFile ? new Blob([state.storedFile]) : null, error: state.storedFile ? null : { message: "missing" } }; },
    }; } },
  };
  return { supabase, state };
}

test("local companion rejects inactive actors and viewer mutations before writing", async () => {
  const inactive = db({ inactive: true });
  await assert.rejects(resolveLocalCompanionContext(identity, inactive), /miembro activo/);
  const viewer = db({ role: "viewer" });
  await assert.rejects(resolveLocalCompanionContext({ ...identity, requireWrite: true }, viewer), /no permite/);
  assert.equal(inactive.state.writes + viewer.state.writes, 0);
  assert.ok(viewer.state.queries.find((q) => q.table === "organization_members").filters.some(([key, value]) => key === "organization_id" && value === organizationId));
});

test("local report validates exact dates, documented filters and text price identifiers", () => {
  assert.throws(() => validateLocalZetaReportFilters("sales", { FechaDesde: "2026-02-30", FechaHasta: "2026-03-01" }), /fecha real/);
  assert.throws(() => validateLocalZetaReportFilters("sales", {}), /requiere/);
  assert.throws(() => validateLocalZetaReportFilters("stock", { Connection: {} }), /no permitido/);
  assert.throws(() => validateLocalZetaReportFilters("base-prices", { ArticuloCodigo: 1, PrecioBaseCodigo: "001" }), /ceros/);
  assert.deepEqual(validateLocalZetaReportFilters("base-prices", { ArticuloCodigo: "0001", PrecioBaseCodigo: "002" }), { ArticuloCodigo: "0001", PrecioBaseCodigo: "002" });
});

test("local CSV protects formulas and zero-prefixed identifiers while JSON stays exact", () => {
  const report = { columns: ["CodigoArticulo", "Nombre", "StockActual"], rows: [{ CodigoArticulo: "0001", Nombre: '=HYPERLINK("bad")', StockActual: -2 }] };
  const csv = serializeZetaReportCsv(report);
  assert.ok(csv.includes("'0001"));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"-2"'));
  assert.equal(report.rows[0].CodigoArticulo, "0001");
});

test("local document MIME follows bytes and identity is deterministic per organization", () => {
  assert.equal(detectLocalDocumentMime(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.throws(() => detectLocalDocumentMime(Buffer.from("a.jpg")), /contenido/);
  const hash = "a".repeat(64);
  assert.equal(localDocumentId(organizationId, hash), localDocumentId(organizationId, hash));
  assert.notEqual(localDocumentId(organizationId, hash), localDocumentId(actorProfileId, hash));
});

test("local ingest uploads once, queues codex_local and reuses same hash without new writes", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "convertilabs-local-test-"));
  try {
    const filePath = path.join(directory, "invoice.pdf");
    fs.writeFileSync(filePath, "%PDF-1.7\nlocal-test");
    const database = db();
    let queued = 0;
    const deps = { ...database, enqueue: async ({ documentId }) => {
      queued++;
      const doc = database.state.documents.find((row) => row.id === documentId);
      assert.equal(doc.metadata.processing_provider, "codex_local");
      doc.current_processing_run_id = actorProfileId;
      doc.status = "queued";
      return { ok: true, documentId, runId: actorProfileId, status: "queued" };
    } };
    const first = await ingestLocalDocument({ ...identity, filePath, appUrl: "http://127.0.0.1:4319" }, deps);
    const before = database.state.writes;
    const second = await ingestLocalDocument({ ...identity, filePath }, deps);
    assert.equal(first.documentId, second.documentId);
    assert.equal(first.localAction, "extract");
    assert.equal(second.duplicate, true);
    assert.equal(queued, 1);
    assert.equal(database.state.uploads.length, 1);
    assert.equal(database.state.writes, before);
    assert.equal(database.state.audits[0].actor_user_id, actorProfileId);
    assert.match(first.reviewUrl, /^http:\/\/127\.0\.0\.1:4319\/app\/o\/demo\/documents\//);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("local ingest resumes failed upload and interruption after storage without duplicate documents", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "convertilabs-resume-test-"));
  try {
    const filePath = path.join(directory, "invoice.pdf");
    const content = Buffer.from("%PDF-1.7\nexplicit synthetic fixture");
    fs.writeFileSync(filePath, content);
    const database = db({ uploadFailure: true });
    const deps = { ...database, enqueue: async ({ documentId }) => {
      const doc = database.state.documents.find((row) => row.id === documentId);
      doc.current_processing_run_id = actorProfileId;
      return { ok: true, documentId, runId: actorProfileId, status: "queued" };
    } };
    await assert.rejects(ingestLocalDocument({ ...identity, filePath }, deps), /subida falló/);
    assert.equal(database.state.documents.length, 1);
    assert.equal(database.state.documents[0].status, "error");
    // The remote storage accepted the previous upload but the PC lost its response.
    database.state.storedFile = content;
    const resumed = await ingestLocalDocument({ ...identity, filePath }, deps);
    assert.equal(resumed.status, "queued");
    assert.equal(database.state.documents.length, 1);
    assert.equal(database.state.documents[0].direction, "unknown");
    assert.equal(database.state.documents[0].metadata.local_upload_complete, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("local ingest does not take an upload whose reservation is still active", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "convertilabs-active-upload-"));
  try {
    const filePath = path.join(directory, "invoice.pdf");
    fs.writeFileSync(filePath, "%PDF-1.7\nfixture");
    const database = db({ uploadFailure: true });
    await assert.rejects(ingestLocalDocument({ ...identity, filePath }, database), /subida falló/);
    database.state.documents[0].status = "uploading";
    const writes = database.state.writes;
    const result = await ingestLocalDocument({ ...identity, filePath }, database);
    assert.equal(result.duplicate, true);
    assert.match(result.message, /sigue activa/);
    assert.equal(database.state.writes, writes);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("local status cannot read a document in another organization and never reconciles", async () => {
  const database = db({ documents: [{ id: actorProfileId, organization_id: actorProfileId }] });
  await assert.rejects(loadLocalDocumentStatus({ ...identity, documentId: actorProfileId }, database), /esta organizacion/);
  assert.equal(database.state.writes, 0);
});

test("local review links forbid credentials and insecure remote origins", () => {
  assert.throws(() => localDocumentReviewUrl("demo", actorProfileId, "http://example.com"), /HTTPS/);
  assert.throws(() => localDocumentReviewUrl("demo", actorProfileId, "https://user:password@example.com"), /credenciales/);
});
