/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const { test, assert } = require("./testkit.cjs");
const { ingestEmailAttachments, normalizeCfeDocumentNumber } = require("@/modules/local-companion/email-documents");
const { cfe, envelope, secretCfe, secretAdenda } = require("./helpers/cfe-xml-fixture.cjs");
const org = "10000000-0000-0000-0000-000000000001", actor = "20000000-0000-0000-0000-000000000001";
const message = { mailboxAddress: "example@gmail.com", mailbox: "INBOX", uidValidity: "1", uid: 23, messageId: "test@example.com", receivedAt: "2026-09-11T16:00:00Z" };
function database() {
  const tables = { documents: [], document_drafts: [], document_draft_steps: [], document_revisions: [], document_invoice_identities: [], integration_raw_records: [], document_source_refs: [] };
  const writes = []; let failTable = null;
  const supabase = { from(table) {
    let operation = "select", values, options = {}, single = false, max = Infinity; const filters = [];
    const run = () => {
      if (table === "organizations") return { data: { id: org, slug: "demo", name: "Demo", tax_id: "213554700012" }, error: null };
      if (table === "organization_members") return { data: { role: "owner" }, error: null };
      if (!tables[table]) throw new Error(`Forbidden/unexpected table ${table}`);
      if (operation !== "select") {
        writes.push({ table, operation, values: structuredClone(values) });
        if (table === failTable) { failTable = null; return { data: null, error: { code: "offline" } }; }
      }
      if (operation === "upsert") {
        assert.equal(options.ignoreDuplicates, true, "No evidence/draft overwrite allowed");
        const keys = (options.onConflict ?? "id").split(",");
        for (const value of (Array.isArray(values) ? values : [values])) {
          if (!tables[table].some((row) => keys.every((key) => row[key] === value[key]))) tables[table].push({ current_draft_id: null, ...structuredClone(value) });
        }
        return { data: null, error: null };
      }
      let matched = tables[table].filter((row) => filters.every(([key, value]) => (key.startsWith("metadata->>") ? row.metadata?.[key.slice(11)] : row[key]) === value));
      if (operation === "update") for (const row of matched) Object.assign(row, structuredClone(values));
      matched = matched.slice(0, max); return { data: single ? matched[0] ?? null : matched, error: null };
    };
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, is(key, value) { filters.push([key, value]); return query; },
      limit(value) { max = value; return query; }, maybeSingle() { single = true; return Promise.resolve().then(run); },
      upsert(value, opts) { operation = "upsert"; values = value; options = opts; return query; }, update(value) { operation = "update"; values = value; return query; },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); } };
    return query;
  } };
  return { tables, writes, supabase, failNext(table) { failTable = table; } };
}
async function attachments(files, fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "convertilabs-email-test-"));
  try {
    const entries = files.map(([name, text]) => {
      const bytes = Buffer.from(text), filePath = path.join(directory, name); fs.writeFileSync(filePath, bytes);
      return { filePath, originalFilename: name, mimeType: name.endsWith(".xml") ? "application/xml" : "application/pdf", fileHash: crypto.createHash("sha256").update(bytes).digest("hex") };
    });
    return await fn({ slug: "demo", actorProfileId: actor, message, attachments: entries });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
test("email XML creates an open human-review draft and preserves the original bytes outside Storage", async () => {
  const db = database();
  await attachments([["factura.xml", cfe()]], async (input) => {
    const result = await ingestEmailAttachments(input, db);
    assert.equal(result.documents.length, 1); assert.equal(result.documents[0].status, "needs_review"); assert.deepEqual(result.pending, []);
    assert.equal(db.tables.document_drafts[0].status, "open"); assert.equal(db.tables.document_drafts[0].intake_context_json.settlement_hints.settlement_method_explicit, "unknown");
    assert.equal(Buffer.from(db.tables.integration_raw_records[0].payload_json.original_base64, "base64").toString(), cfe());
    assert.equal(db.tables.documents[0].metadata.binary_available, false); assert.equal(db.tables.documents[0].posting_status, "draft");
    assert.equal(db.tables.document_source_refs[0].raw_record_id, db.tables.integration_raw_records[0].id);
    assert.ok(!db.writes.some((write) => /payment|journal|processing_run/.test(write.table)));
  });
});
test("email replay and UIDVALIDITY changes converge to one XML document with multiple provenance refs", async () => {
  const db = database(); await attachments([["factura.xml", cfe()]], async (input) => {
    const first = await ingestEmailAttachments(input, db);
    const second = await ingestEmailAttachments({ ...input, message: { ...message, uidValidity: "99", uid: 1 } }, db);
    assert.equal(first.documents[0].documentId, second.documents[0].documentId); assert.equal(second.documents[0].duplicate, true);
    assert.equal(db.tables.documents.length, 1); assert.equal(db.tables.document_drafts.length, 1); assert.equal(db.tables.integration_raw_records.length, 1);
    assert.equal(db.tables.document_source_refs.length, 2);
  });
});
test("two concurrent XML ingests preserve one document and draft", async () => {
  const db = database(); await attachments([["factura.xml", cfe()]], async (input) => {
    const results = await Promise.all([ingestEmailAttachments(input, db), ingestEmailAttachments(input, db)]);
    assert.equal(results[0].documents[0].documentId, results[1].documents[0].documentId);
    assert.equal(db.tables.documents.length, 1); assert.equal(db.tables.document_drafts.length, 1); assert.equal(db.tables.document_invoice_identities.length, 1);
  });
});
test("XML A200 reuses existing photo A0000200 without modifying human review or document metadata", async () => {
  const db = database();
  db.tables.documents.push({ id: "30000000-0000-0000-0000-000000000003", organization_id: org, status: "needs_review", current_draft_id: "draft-existing", metadata: { payment: "confirmed", review: "keep" } });
  db.tables.document_drafts.push({ id: "draft-existing", organization_id: org, document_id: db.tables.documents[0].id, fields_json: { facts: { subtotal: 565.57, tax_amount: 124.43, total_amount: 690 } }, reviewed: true });
  db.tables.document_invoice_identities.push({ organization_id: org, document_id: db.tables.documents[0].id, issuer_tax_id_normalized: "220918880014", document_number_normalized: "a0000200", document_date: "2026-09-11", total_amount: "690.00", currency_code: "UYU" });
  const originalDoc = structuredClone(db.tables.documents[0]), originalDraft = structuredClone(db.tables.document_drafts[0]);
  await attachments([["factura.xml", cfe()]], async (input) => {
    const result = await ingestEmailAttachments(input, db); assert.equal(result.documents[0].documentId, originalDoc.id); assert.equal(result.documents[0].duplicate, true);
    assert.deepEqual(result.pending, []); assert.deepEqual(db.tables.documents[0], originalDoc); assert.deepEqual(db.tables.document_drafts[0], originalDraft);
    assert.equal(db.tables.documents.length, 1); assert.ok(db.writes.every((write) => ["integration_raw_records", "document_source_refs"].includes(write.table)));
  });
  assert.equal(normalizeCfeDocumentNumber("A0000200"), normalizeCfeDocumentNumber("A200")); assert.notEqual(normalizeCfeDocumentNumber("B200"), normalizeCfeDocumentNumber("A200"));
});
test("changed XML for same fiscal identity retains both originals and leaves the original draft untouched", async () => {
  const db = database(); await attachments([["first.xml", cfe()]], (input) => ingestEmailAttachments(input, db));
  const originalDraft = structuredClone(db.tables.document_drafts[0]);
  await attachments([["corrected.xml", cfe().replace("Almuerzo &amp; bebida", "Almuerzo corregido")]], async (input) => {
    const result = await ingestEmailAttachments(input, db); assert.equal(result.pending.length, 1);
    assert.equal(db.tables.documents.length, 1); assert.equal(db.tables.integration_raw_records.length, 2); assert.deepEqual(db.tables.document_drafts[0], originalDraft);
    assert.equal(db.tables.document_source_refs.at(-1).metadata_json.differences_pending_review, true);
  });
});
test("interrupted draft creation resumes same reserved XML without overwriting persisted artifacts", async () => {
  const db = database(); db.failNext("document_draft_steps");
  await attachments([["factura.xml", cfe()]], async (input) => {
    await assert.rejects(ingestEmailAttachments(input, db), /persist_failed/);
    assert.equal(db.tables.documents[0].status, "uploading"); const id = db.tables.documents[0].id;
    const result = await ingestEmailAttachments(input, db); assert.equal(result.documents[0].documentId, id);
    assert.equal(result.documents[0].status, "needs_review"); assert.equal(db.tables.documents.length, 1); assert.equal(db.tables.document_drafts.length, 1);
  });
});
test("multiCFE envelope creates one document per CFE, sharing original evidence without file-hash collision", async () => {
  const db = database(); await attachments([["sobre.xml", envelope([cfe(), cfe({ number: "201" })])]], async (input) => {
    const result = await ingestEmailAttachments(input, db); assert.equal(result.documents.length, 2); assert.equal(db.tables.integration_raw_records.length, 1);
    assert.ok(db.tables.documents.every((doc) => doc.file_hash === undefined)); assert.equal(db.tables.document_source_refs.length, 2);
  });
});
test("invalid recipient XML is preserved as raw evidence but creates no invoice or draft", async () => {
  const db = database(); await attachments([["otro.xml", cfe({ rut: "214444440014" })]], async (input) => {
    const result = await ingestEmailAttachments(input, db); assert.equal(result.documents.length, 0); assert.equal(result.pending.length, 1);
    assert.equal(db.tables.integration_raw_records.length, 1); assert.equal(db.tables.documents.length, 0);
  });
});
test("PDF alongside XML is retained pending identity verification and never becomes a second invoice", async () => {
  const db = database(); await attachments([["factura.xml", cfe()], ["factura.pdf", "%PDF-1.7\ninvoice"]], async (input) => {
    const result = await ingestEmailAttachments(input, { ...db, ingest: async () => { throw new Error("Must not enqueue a possible duplicate visual"); } });
    assert.equal(result.documents.length, 1); assert.equal(result.pending.length, 1); assert.equal(db.tables.integration_raw_records.length, 2);
  });
});
test("standalone PDF uses existing local ingest and adds email source without altering its classification", async () => {
  const db = database(); await attachments([["recibo.pdf", "%PDF-1.7\nreceipt"]], async (input) => {
    let calls = 0; const result = await ingestEmailAttachments(input, { ...db, ingest: async () => { calls++; return { documentId: "40000000-0000-0000-0000-000000000001", status: "extracted", duplicate: true }; } });
    assert.equal(calls, 1); assert.equal(result.documents[0].duplicate, true); assert.equal(db.tables.document_source_refs.length, 1);
    assert.equal(db.tables.documents.length, 0); assert.equal(db.tables.document_source_refs[0].metadata_json.original_storage, "document_storage");
  });
});
test("attachment hash change is rejected before any persistent write", async () => {
  const db = database(); await attachments([["factura.xml", cfe()]], async (input) => {
    input.attachments[0].fileHash = "a".repeat(64); await assert.rejects(ingestEmailAttachments(input, db), /changed/); assert.equal(db.writes.length, 0);
  });
});
test("ambiguous existing fiscal identity is retained pending and never creates a third invoice", async () => {
  const db = database();
  for (const documentId of ["photo-one", "photo-two"]) db.tables.document_invoice_identities.push({ organization_id: org, document_id: documentId,
    issuer_tax_id_normalized: "220918880014", document_number_normalized: "a0000200", document_date: "2026-09-11", total_amount: 690, currency_code: "UYU" });
  await attachments([["factura.xml", cfe()]], async (input) => {
    const result = await ingestEmailAttachments(input, db); assert.equal(result.documents.length, 0); assert.equal(result.pending.length, 1);
    assert.equal(db.tables.documents.length, 0); assert.equal(db.tables.integration_raw_records.length, 1);
  });
});
test("invoice identity matches are always scoped to the target organization", async () => {
  const db = database();
  db.tables.document_invoice_identities.push({ organization_id: "other-org", document_id: "other-document", issuer_tax_id_normalized: "220918880014",
    document_number_normalized: "a200", document_date: "2026-09-11", total_amount: 690, currency_code: "UYU" });
  await attachments([["factura.xml", cfe()]], async (input) => {
    const result = await ingestEmailAttachments(input, db); assert.equal(result.documents.length, 1); assert.notEqual(result.documents[0].documentId, "other-document");
    assert.ok(db.tables.document_source_refs.every((source) => source.organization_id === org && source.document_id !== "other-document"));
  });
});

test("secret bank XML materializes once with original email and receiver provenance, still requiring review", async () => {
  const db = database(); const xml = envelope([secretCfe()], secretAdenda({bankWrapper:true,documentType:"02"}));
  await attachments([["bank.xml", xml]], async input => {
    const first = await ingestEmailAttachments(input, db);
    const second = await ingestEmailAttachments(input, db);
    assert.deepEqual(first.pending, []); assert.deepEqual(second.pending, []);
    assert.equal(first.documents[0].documentId, second.documents[0].documentId);
    assert.equal(second.documents[0].duplicate, true);
    assert.equal(db.tables.documents.length, 1); assert.equal(db.tables.document_drafts.length, 1);
    assert.equal(db.tables.document_source_refs.length, 1); assert.equal(db.tables.integration_raw_records.length, 1);
    const draft = db.tables.document_drafts[0], source = db.tables.document_source_refs[0];
    assert.equal(draft.intake_context_json.cfe_xml.receiverIdentity.source, "Adenda/SecretoProfesional/Receptor");
    assert.equal(source.metadata_json.parsed_cfe.source.receiverIdentity.taxId, "213554700012");
    assert.deepEqual(source.metadata_json.message, message);
    assert.equal(source.metadata_json.signature_verified, false); assert.equal(source.metadata_json.requires_review, true);
    assert.equal(draft.confirmed_at, undefined); assert.equal(draft.status, "open");
    assert.equal(draft.intake_context_json.settlement_hints.settlement_method_explicit, "unknown");
    assert.equal(Buffer.from(db.tables.integration_raw_records[0].payload_json.original_base64,"base64").toString(), xml);
    assert.ok(!db.writes.some(write => /payment|journal|processing_run/.test(write.table)));
  });
});

test("wrong bank Adenda identity is retained as raw evidence without document materialization", async () => {
  const db = database();
  await attachments([["bank.xml", envelope([secretCfe()], secretAdenda({number:"201"}))]], async input => {
    const result = await ingestEmailAttachments(input, db);
    assert.equal(result.documents.length, 0); assert.match(result.pending[0].reason, /adenda_fiscal_identity_mismatch/);
    assert.equal(db.tables.integration_raw_records.length, 1); assert.equal(db.tables.documents.length, 0);
    assert.equal(db.tables.document_drafts.length, 0); assert.equal(db.tables.document_source_refs.length, 0);
  });
});
