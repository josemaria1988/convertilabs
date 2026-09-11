/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Readable } = require("node:stream");
const { pollEmailInbox, selectInvoiceAttachments, resolveEmailInboxConfig } = require("../modules/local-companion/email-inbox.ts");
const { loadEmailInboxEnv } = require("../scripts/local-companion/email-config.cjs");
const { buildCodexEnvironment } = require("../modules/local-companion/codex-process.ts");
const who = { slug: "fixture", actorProfileId: "00000000-0000-0000-0000-000000000001", manual: true };
const config = { enabled: true, address: "fixture@gmail.com", password: "abcdefghijklmnop", mailbox: "INBOX", since: "2026-09-11" };
const context = async () => ({ organization: { id: "00000000-0000-0000-0000-000000000002" } });
const xmlPart = (part = "2", filename = "invoice.xml") => ({ type: "application/octet-stream", disposition: "attachment", dispositionParameters: { filename }, part, size: 30 });
const message = (uid, parts = [xmlPart()]) => ({ uid, bodyStructure: { type: "multipart/mixed", childNodes: parts }, envelope: { subject: "Factura", messageId: `<${uid}@fixture.test>` }, internalDate: new Date("2026-09-11T12:00:00Z") });
function fixture(messages) {
  const calls = [];
  const client = { mailbox: { uidValidity: 123n },
    on() {}, async connect() { calls.push(["connect"]); },
    async getMailboxLock(name, options) { calls.push(["lock", name, options]); return { release() { calls.push(["release"]); } }; },
    async search(query, options) { calls.push(["search", query, options]); return messages.map((item) => item.uid); },
    async fetchOne(uid, query, options) { calls.push(["fetch", uid, query, options]); return messages.find((item) => item.uid === Number(uid)); },
    async download(uid, part, options) { calls.push(["download", uid, part, options]); return { meta: {}, content: Readable.from([Buffer.from(`<CFE id="${uid}"/>`)]) }; },
    async logout() { calls.push(["logout"]); }, close() { calls.push(["close"]); },
  };
  return { client, calls, createClient(options) { calls.push(["options", options]); return client; } };
}
async function temporary(fn) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "convertilabs-email-test-"));
  try { await fn(directory); }
  finally {
    assert.ok(path.resolve(directory).startsWith(path.join(path.resolve(os.tmpdir()), "convertilabs-email-test-")));
    await fs.rm(directory, { recursive: true, force: true });
  }
}
const accepted = async () => ({ documents: [{ documentId: "fixture-document", status: "needs_review", duplicate: false }] });

test("Gmail config requires an application password and fixed inbox, without exposing secrets", () => {
  assert.equal(resolveEmailInboxConfig({}).status, "disabled");
  const input = { CONVERTILABS_EMAIL_ENABLED: "true", CONVERTILABS_EMAIL_ADDRESS: config.address,
    CONVERTILABS_EMAIL_APP_PASSWORD: "abcd efgh ijkl mnop", CONVERTILABS_EMAIL_MAILBOX: "INBOX", CONVERTILABS_EMAIL_SINCE: config.since };
  assert.equal(resolveEmailInboxConfig(input).config.password, config.password);
  for (const patch of [{ CONVERTILABS_EMAIL_APP_PASSWORD: "" }, { CONVERTILABS_EMAIL_MAILBOX: "All Mail" },
    { CONVERTILABS_EMAIL_SINCE: "2026-02-30" }, { CONVERTILABS_EMAIL_ADDRESS: "someone@other.test" }]) {
    const result = resolveEmailInboxConfig({ ...input, ...patch });
    assert.equal(result.status, "pending_configuration"); assert.ok(!JSON.stringify(result).includes(config.password));
  }
});

test("separate email env loads only five keys without mutating or forwarding process env", async () => temporary(async (directory) => {
  const filename = path.join(directory, ".env.email.local");
  await fs.writeFile(filename, `CONVERTILABS_EMAIL_ENABLED=true\nCONVERTILABS_EMAIL_APP_PASSWORD=${config.password}\nOPENAI_API_KEY=not-forwarded\nNODE_OPTIONS=not-forwarded\n`);
  const before = process.env.CONVERTILABS_EMAIL_APP_PASSWORD;
  const loaded = await loadEmailInboxEnv(filename);
  assert.equal(Object.keys(loaded).length, 5); assert.equal(loaded.OPENAI_API_KEY, undefined);
  assert.equal(loaded.CONVERTILABS_EMAIL_APP_PASSWORD, config.password);
  assert.equal(process.env.CONVERTILABS_EMAIL_APP_PASSWORD, before);
  assert.equal(buildCodexEnvironment(loaded).CONVERTILABS_EMAIL_APP_PASSWORD, undefined);
  assert.deepEqual(await loadEmailInboxEnv(path.join(directory, "absent")), {});
}));

test("MIME selection accepts octet-stream XML and skips inline logo images and bodies", () => {
  const parts = selectInvoiceAttachments({ type: "multipart/mixed", childNodes: [xmlPart(),
    { part: "1", type: "text/html" }, { ...xmlPart("3", "logo.png"), type: "image/png", disposition: "inline" },
    { ...xmlPart("4", "factura.pdf"), type: "application/pdf", disposition: "inline" }] });
  assert.deepEqual(parts.map((item) => item.filename), ["invoice.xml", "factura.pdf"]);
  const photos = selectInvoiceAttachments({ type: "multipart/mixed", childNodes: [
    { ...xmlPart("3", "invoice-photo.jpg"), type: "image/jpeg", size: 100000, disposition: "inline" },
    { ...xmlPart("4", "logo.png"), type: "image/png", size: 3000, disposition: "inline" }] });
  assert.deepEqual(photos.map((item) => item.filename), ["invoice-photo.jpg"]);
});

test("Gmail poll uses TLS, readonly mailbox and only attachment parts, then checkpoints complete message", async () => temporary(async (directory) => {
  const mock = fixture([message(10)]); let ingested;
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => { ingested = input; return accepted(); } });
  assert.equal(result.status, "received"); assert.equal(result.readMessages, 1);
  const options = mock.calls.find((item) => item[0] === "options")[1];
  assert.equal(options.host, "imap.gmail.com"); assert.equal(options.secure, true); assert.equal(options.tls.rejectUnauthorized, true);
  assert.equal(options.logger, false); assert.equal(options.emitLogs, false); assert.equal(options.logRaw, false); assert.equal(options.disableAutoIdle, true);
  assert.deepEqual(mock.calls.find((item) => item[0] === "lock")[2], { readOnly: true });
  const query = mock.calls.find((item) => item[0] === "fetch")[2];
  assert.equal(query.source, undefined); assert.equal(query.bodyParts, undefined); assert.equal(query.flags, undefined);
  assert.equal(ingested.message.uid, 10); assert.equal(ingested.message.uidValidity, "123");
  assert.equal(ingested.attachments[0].mimeType, "application/octet-stream");
  assert.ok((await fs.readFile(ingested.attachments[0].filePath, "utf8")).startsWith("<CFE"));
  assert.ok(!JSON.stringify(result).includes(config.password));
  let again = 0;
  const repeat = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async () => { again++; return accepted(); } });
  assert.equal(repeat.readMessages, 0); assert.equal(again, 0);
}));

test("ingest failure is independently recorded and retried without preventing later invoices", async () => temporary(async (directory) => {
  const mock = fixture([message(10), message(11)]);
  const failed = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => { if (input.message.uid === 10) throw new Error(`private ${config.password}`); return accepted(); } });
  assert.equal(failed.status, "pending_review"); assert.ok(!JSON.stringify(failed).includes(config.password));
  assert.equal(mock.calls.filter((item) => item[0] === "fetch").length, 2);
  assert.equal(failed.pending[0].uid, 10); assert.equal(failed.pending[0].retryable, true);
  assert.equal(failed.readMessages, 1);
  const retry = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  assert.equal(retry.readMessages, 1); assert.equal(retry.pending.length, 0);
}));

test("UIDVALIDITY change safely rescans from authorized date and supports lower UIDs", async () => temporary(async (directory) => {
  const mock = fixture([message(10)]);
  await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  mock.client.mailbox.uidValidity = 124n;
  mock.client.search = async (query) => { assert.equal(query.uid, "1:*"); assert.equal(query.since, config.since); return [2]; };
  mock.client.fetchOne = async () => message(2);
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  assert.equal(result.readMessages, 1);
}));

test("ZIP stays backed up and pending while later invoices proceed, without repeated ZIP downloads", async () => temporary(async (directory) => {
  const mock = fixture([message(10, [xmlPart("2", "factura.zip")]), message(11)]);
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => { assert.equal(input.message.uid, 11); return accepted(); } });
  assert.equal(result.status, "pending_review"); assert.equal(result.pending[0].reason, "zip_requires_review");
  assert.equal(result.pending[0].uid, 10); assert.equal(result.readMessages, 1);
  assert.equal(result.pending[0].attachments.length, 1); assert.equal(result.pending[0].retryable, false);
  assert.ok(await fs.stat(result.pending[0].attachments[0].filePath));
  assert.equal(mock.calls.filter((item) => item[0] === "download").length, 2);
  const downloads = mock.calls.filter((item) => item[0] === "download").length;
  await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  assert.equal(mock.calls.filter((item) => item[0] === "download").length, downloads);
}));

test("quarantine survives a UIDVALIDITY reset and PDF/XML suppress attached logos", async () => temporary(async (directory) => {
  const mock = fixture([message(10, [xmlPart("2", "factura.zip")])]);
  await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  mock.client.mailbox.uidValidity = 999n; mock.client.search = async () => [];
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  assert.equal(result.pending[0].uidValidity, "123"); assert.equal(result.status, "pending_review");
  const selected = selectInvoiceAttachments({ type: "multipart/mixed", childNodes: [xmlPart("2", `${"a".repeat(200)}.xml`),
    { ...xmlPart("3", "icon.png"), size: 30000, type: "image/png" }] });
  assert.equal(selected.length, 1); assert.ok(selected[0].filename.endsWith(".xml")); assert.equal(selected[0].filename.length, 120);
}));

test("a substantial invoice photo alongside XML is backed up for identity review, never silently discarded", async () => temporary(async (directory) => {
  const mock = fixture([message(10, [xmlPart(), { ...xmlPart("3", "factura-foto.jpg"), size: 100000, type: "image/jpeg" },
    { ...xmlPart("4", "logo.png"), size: 3000, type: "image/png" }])]);
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => { assert.deepEqual(input.attachments.map((item) => item.originalFilename), ["invoice.xml"]); return accepted(); } });
  assert.equal(result.documents.length, 1); assert.equal(result.pending[0].reason, "image_requires_identity_review");
  assert.equal(result.pending[0].attachments.length, 2); assert.ok(result.pending[0].attachments.some((item) => item.originalFilename === "factura-foto.jpg"));
  assert.deepEqual(mock.calls.filter((item) => item[0] === "download").map((item) => item[2]), ["2", "3"]);
}));

test("oversize attachments and pending parser decisions do not prevent later messages", async () => temporary(async (directory) => {
  const oversized = { ...xmlPart(), size: 21 * 1024 * 1024 };
  const mock = fixture([message(10, [oversized]), message(11), message(12)]);
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => input.message.uid === 11 ? { documents: [], pending: [{ filename: "invoice.xml", reason: "receiver_requires_review" }] } : accepted() });
  assert.equal(result.readMessages, 1); assert.equal(result.pending.length, 2);
  assert.equal(result.pending.find((item) => item.uid === 10).reason, "attachment_size_limit");
  assert.equal(result.pending.find((item) => item.uid === 10).retryable, false);
  assert.equal(result.pending.find((item) => item.uid === 11).details[0].reason, "receiver_requires_review");
  assert.deepEqual(mock.calls.filter((item) => item[0] === "download").map((item) => item[1]), ["11", "12"]);
}));

test("twenty old retry failures cannot monopolize the next batch of new invoices", async () => temporary(async (directory) => {
  const messages = Array.from({ length: 20 }, (_, index) => message(index + 1));
  const mock = fixture(messages);
  await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async () => { throw new Error("transient failure"); } });
  messages.push(...Array.from({ length: 15 }, (_, index) => message(index + 21)));
  const attempted = [];
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => { attempted.push(input.message.uid); if (input.message.uid <= 20) throw new Error("transient failure"); return accepted(); } });
  assert.equal(attempted.length, 20); assert.equal(attempted.filter((uid) => uid > 20).length, 10);
  assert.equal(result.readMessages, 10); assert.equal(result.remainingMessages, 15);
  const lastAttempted = [];
  await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async (input) => { lastAttempted.push(input.message.uid); return accepted(); } });
  assert.ok(lastAttempted.includes(11)); assert.ok(lastAttempted.includes(31));
}));

test("delivery status notifications cannot turn warning icons into invoices", async () => temporary(async (directory) => {
  const dsn = message(10, [xmlPart("2", "warning_triangle.png")]);
  dsn.bodyStructure.type = "multipart/report";
  const mock = fixture([dsn, message(11)]);
  let ingests = 0;
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient,
    ingest: async () => { ingests++; return accepted(); } });
  assert.equal(result.status, "received"); assert.equal(ingests, 1);
  assert.deepEqual(mock.calls.filter((item) => item[0] === "download").map((item) => item[1]), ["11"]);
}));

test("a simultaneous local poll cannot connect twice or steal the active reservation", async () => temporary(async (directory) => {
  const mock = fixture([message(10)]); let unlock;
  const connected = new Promise((resolve) => { mock.client.connect = async () => { resolve(); await new Promise((release) => { unlock = release; }); }; });
  const first = pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  await connected;
  const second = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context,
    createClient: () => assert.fail("No second connection"), ingest: accepted });
  assert.equal(second.status, "already_running"); unlock(); await first;
}));

test("Gmail auth errors are sanitized and never reach raw worker output", async () => temporary(async (directory) => {
  const mock = fixture([]);
  mock.client.connect = async () => { throw Object.assign(new Error(config.password), { authenticationFailed: true }); };
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  assert.equal(result.code, "email_authentication"); assert.ok(!JSON.stringify(result).includes(config.password));
}));

test("cloud observation receives only safe identity after connection and durable ingestion", async () => temporary(async (directory) => {
  const mock = fixture([message(10)]); const observations = [];
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted,
    observe: async (input) => { observations.push(input); return { recorded: true }; } });
  assert.equal(observations.length, 2); assert.equal(observations[0].lastInboundEmailAt, undefined);
  assert.ok(observations[1].lastInboundEmailAt); assert.ok(!JSON.stringify(observations).includes(config.password));
  assert.ok(observations[1].lastInboundEmailAt <= observations[1].observedAt);
  assert.deepEqual(Object.keys(observations[0]).sort(), ["actorProfileId", "mailboxEmail", "observedAt", "slug"]);
  assert.deepEqual(result.cloudObservation, { connectionRecorded: true, inboundRecorded: true });
}));

test("cloud observation failure is explicit without interrupting successful receipt", async () => temporary(async (directory) => {
  const mock = fixture([message(10)]);
  const result = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted,
    observe: async () => { throw new Error(config.password); } });
  assert.equal(result.readMessages, 1); assert.equal(result.cloudObservation.connectionRecorded, false);
  assert.equal(result.cloudObservation.inboundRecorded, false); assert.ok(!JSON.stringify(result).includes(config.password));
}));

test("automatic polling survives restart without reconnecting before four hours, while explicit once may run", async () => temporary(async (directory) => {
  const mock = fixture([message(10)]);
  await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  const skipped = await pollEmailInbox({ ...who, manual: false, config, stateDirectory: directory }, { context,
    createClient: () => assert.fail("No Gmail connection before four hours"), ingest: accepted });
  assert.equal(skipped.status, "skipped_recently_checked");
  assert.equal(Date.parse(skipped.nextCheckAt) - Date.parse(skipped.checkedAt), 4 * 60 * 60 * 1000);
  const manual = await pollEmailInbox({ ...who, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
  assert.equal(manual.status, "received");
  const originalNow = Date.now;
  Date.now = () => originalNow() + 4 * 60 * 60 * 1000 + 1000;
  try {
    const due = await pollEmailInbox({ ...who, manual: false, config, stateDirectory: directory }, { context, createClient: mock.createClient, ingest: accepted });
    assert.equal(due.status, "received");
  } finally { Date.now = originalNow; }
}));
