/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require('./testkit.cjs');
const { createHash } = require('node:crypto');
const { loadEmailXmlOriginal } = require('../modules/documents/email-original.ts');
const doc = '10000000-0000-4000-8000-000000000001';
const org = '10000000-0000-4000-8000-000000000002';
const user = '10000000-0000-4000-8000-000000000003';
const rawId = '10000000-0000-4000-8000-000000000004';
const bytes = Buffer.from('<?xml version="1.0"?><CFE>original íntegro</CFE>');
function fixture() {
  const tables = {
    documents: [{ id: doc, organization_id: org, mime_type: 'application/xml', metadata: {
      original_storage: 'integration_raw_records', binary_available: false, integration_raw_record_id: rawId,
    } }],
    organization_members: [{ organization_id: org, user_id: user, is_active: true }],
    document_source_refs: [{ organization_id: org, document_id: doc, provider: 'email_inbox', source_kind: 'cfe_xml_email', raw_record_id: rawId }],
    integration_raw_records: [{ id: rawId, organization_id: org, provider: 'email_inbox', entity_type: 'email_attachment',
      payload_hash: createHash('sha256').update(bytes).digest('hex'), payload_json: {
        original_base64: bytes.toString('base64'), encoding: 'base64', byte_length: bytes.length, original_filename: 'factura.xml',
      } }],
  };
  const calls = [];
  const db = { from(table) {
    const filters = [];
    const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, limit() { return query; },
      async maybeSingle() { calls.push({ table, filters });
        return { data: tables[table].find(row => filters.every(([key, value]) => row[key] === value)) ?? null, error: null };
      },
    }; return query;
  } };
  return { tables, db, calls };
}
test('Email original returns exact verified bytes through scoped read queries', async () => {
  const f = fixture(); const result = await loadEmailXmlOriginal(f.db, doc, user);
  assert.deepEqual(result.bytes, bytes); assert.equal(result.filename, 'factura.xml');
  for (const call of f.calls.filter(x => x.table !== 'documents')) {
    assert.ok(call.filters.some(([key, value]) => key === 'organization_id' && value === org));
  }
});
test('Email original rejects inactive membership before reading invoice bytes', async () => {
  const f = fixture(); f.tables.organization_members[0].is_active = false;
  assert.equal(await loadEmailXmlOriginal(f.db, doc, user), null);
  assert.ok(!f.calls.some(x => x.table === 'integration_raw_records'));
});
test('Email original rejects a different user or document', async () => {
  const f = fixture(); assert.equal(await loadEmailXmlOriginal(f.db, doc, rawId), null);
  assert.equal(await loadEmailXmlOriginal(f.db, rawId, user), null);
});
test('Email original requires a source link for the same document and organization', async () => {
  for (const field of ['organization_id', 'document_id', 'provider', 'raw_record_id']) {
    const f = fixture(); f.tables.document_source_refs[0][field] = 'different';
    assert.equal(await loadEmailXmlOriginal(f.db, doc, user), null);
    assert.ok(!f.calls.some(x => x.table === 'integration_raw_records'));
  }
});
test('Email original cannot read a raw row in another organization', async () => {
  const f = fixture(); f.tables.integration_raw_records[0].organization_id = rawId;
  assert.equal(await loadEmailXmlOriginal(f.db, doc, user), null);
});
test('Email original refuses corrupted hashes, lengths or base64 encodings', async () => {
  for (const change of [
    row => { row.payload_hash = '0'.repeat(64); },
    row => { row.payload_json.byte_length++; },
    row => { row.payload_json.original_base64 += '!'; },
    row => { row.payload_json.original_base64 += '\n'; },
  ]) { const f = fixture(); change(f.tables.integration_raw_records[0]); assert.equal(await loadEmailXmlOriginal(f.db, doc, user), null); }
});
test('Email original sanitizes header filenames without changing attachment bytes', async () => {
  const f = fixture(); f.tables.integration_raw_records[0].payload_json.original_filename = '../../evil\r\nname.xml';
  const result = await loadEmailXmlOriginal(f.db, doc, user);
  assert.equal(result.filename, 'evilname.xml'); assert.deepEqual(result.bytes, bytes);
});
test('Email original rejects invalid IDs and ordinary storage images without database byte reads', async () => {
  const f = fixture(); assert.equal(await loadEmailXmlOriginal(f.db, '../secret', user), null);
  assert.equal(f.calls.length, 0); f.tables.documents[0].mime_type = 'image/png';
  assert.equal(await loadEmailXmlOriginal(f.db, doc, user), null);
  assert.ok(!f.calls.some(x => x.table === 'integration_raw_records'));
});
