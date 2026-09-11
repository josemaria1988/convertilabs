/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildCfeInboundForwardingAddress,
  buildCfeEmailRegistrationState,
  formatCfeEmailConnectionStatusLabel,
  getLocalCfeEmailLastProbe,
  recordLocalCfeEmailObservation,
  isValidCfeMailboxEmail,
  normalizeCfeMailboxEmail,
} = require("@/modules/integrations/cfe-email-settings");

test("CFE mailbox normalization keeps a stable lowercase address", () => {
  assert.equal(
    normalizeCfeMailboxEmail("  Facturas.Rontil@Example.COM  "),
    "facturas.rontil@example.com",
  );
  assert.equal(isValidCfeMailboxEmail("facturas@rontil.com.uy"), true);
  assert.equal(isValidCfeMailboxEmail("facturas-rontil"), false);
});

test("CFE forwarding alias is deterministic per organization, user and mailbox", () => {
  const first = buildCfeInboundForwardingAddress({
    organizationId: "org-1",
    userId: "user-1",
    mailboxEmail: "Facturas@Rontil.com.uy",
    domain: "mail.convertilabs.test",
  });
  const second = buildCfeInboundForwardingAddress({
    organizationId: "org-1",
    userId: "user-1",
    mailboxEmail: "facturas@rontil.com.uy",
    domain: "mail.convertilabs.test",
  });

  assert.equal(first, second);
  assert.match(first, /^cfe\+[a-f0-9]{20}@mail\.convertilabs\.test$/);
});

test("CFE email status labels stay explicit in spanish", () => {
  assert.equal(formatCfeEmailConnectionStatusLabel("pending_forwarding"), "Configuracion guardada; recepcion pendiente");
  assert.equal(formatCfeEmailConnectionStatusLabel("active"), "Recepcion no verificada");
  assert.equal(formatCfeEmailConnectionStatusLabel("active", "invalid"), "Recepcion no verificada");
  assert.equal(formatCfeEmailConnectionStatusLabel("active", "2026-09-11T12:00:00Z"), "Recepcion registrada");
  assert.equal(formatCfeEmailConnectionStatusLabel("paused"), "Pausada");
});

test("changing the CFE mailbox resets reception status and preserves old evidence", () => {
  const current = { mailboxEmail: "old@example.com", mailboxEmailNormalized: "old@example.com",
    inboundAddress: "cfe+old@example.test", ingestionMode: "forwarding_alias", status: "active",
    lastInboundEmailAt: "2026-09-10T12:00:00Z", metadata: { preserved: true, mailbox_history: [{ earlier: true }] } };
  const before = structuredClone(current);
  const result = buildCfeEmailRegistrationState({ current, mailboxEmailNormalized: "new@example.com", isActive: true, now: "2026-09-11T12:00:00Z" });
  assert.equal(result.status, "pending_forwarding");
  assert.equal(result.lastInboundEmailAt, null);
  assert.equal(result.metadata.preserved, true);
  assert.deepEqual(result.metadata.mailbox_history, [{ earlier: true }, { mailbox_email: "old@example.com",
    inbound_address: "cfe+old@example.test", ingestion_mode: "forwarding_alias", status: "active",
    last_inbound_email_at: "2026-09-10T12:00:00Z", replaced_at: "2026-09-11T12:00:00Z" }]);
  assert.deepEqual(current, before);
});

test("saving a mailbox never invents reception and preserves an existing connection error", () => {
  const initial = buildCfeEmailRegistrationState({ current: null, mailboxEmailNormalized: "new@example.com", isActive: true, now: "2026-09-11T12:00:00Z" });
  assert.equal(initial.status, "pending_forwarding"); assert.equal(initial.lastInboundEmailAt, null);
  const current = { mailboxEmail: "same@example.com", mailboxEmailNormalized: "same@example.com", inboundAddress: "alias@example.test",
    ingestionMode: "forwarding_alias", status: "error", lastInboundEmailAt: "2026-09-10T12:00:00Z", metadata: {} };
  const result = buildCfeEmailRegistrationState({ current, mailboxEmailNormalized: "same@example.com", isActive: true, now: "2026-09-11T12:00:00Z" });
  assert.equal(result.status, "error"); assert.equal(result.lastInboundEmailAt, current.lastInboundEmailAt);
  const paused = buildCfeEmailRegistrationState({ current, mailboxEmailNormalized: "same@example.com", isActive: false, now: "2026-09-11T12:00:00Z" });
  assert.equal(paused.status, "paused");
});

const mailActor = "00000000-0000-0000-0000-000000000001";
const mailOrg = "00000000-0000-0000-0000-000000000002";
const observation = { slug: "fixture", actorProfileId: mailActor, mailboxEmail: "fixture@gmail.com", observedAt: "2026-09-11T12:00:00Z" };
function emailDatabase(initial = null, options = {}) {
  const db = { row: initial && structuredClone(initial), audits: [], writes: 0 };
  db.from = (table) => {
    assert.ok(["organization_cfe_email_connections", "audit_log"].includes(table), "Email status must not change documents or their review");
    let operation = "select", payload, filters = [];
    const perform = () => {
      if (table === "audit_log") {
        if (options.failAudit) return { error: { message: "private audit error" }, data: null };
        db.audits.push(payload); return { error: null, data: null };
      }
      if (operation === "select") {
        const row = options.owner && filters.some(([key]) => key === "mailbox_email_normalized") ? options.owner : db.row;
        return { data: row && filters.every(([key, value]) => row[key] === value) ? structuredClone(row) : null, error: null };
      }
      if (options.casConflict || (operation === "update" && (!db.row || filters.some(([key, value]) => db.row[key] !== value)))) {
        return { data: null, error: null };
      }
      db.writes++; db.row = { ...db.row, ...structuredClone(payload) }; return { data: { id: db.row.id }, error: null };
    };
    return { select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, limit() { return this; },
      insert(value) { operation = "insert"; payload = value; return this; }, update(value) { operation = "update"; payload = value; return this; },
      async maybeSingle() { return perform(); }, then(resolve, reject) { return Promise.resolve().then(perform).then(resolve, reject); } };
  };
  db.context = async (input) => {
    assert.deepEqual(input, { slug: observation.slug, actorProfileId: mailActor, requireWrite: true });
    if (options.forbidden) throw new Error("private membership error");
    return { supabase: db, actorProfileId: mailActor, role: "owner", organization: { id: mailOrg, slug: "fixture", name: "Fixture" } };
  };
  return db;
}

test("local IMAP observation registers only safe dated evidence, without inventing a received invoice", async () => {
  const db = emailDatabase();
  const result = await recordLocalCfeEmailObservation({ ...observation, unexpectedPassword: "never-store-this" }, { context: db.context });
  assert.deepEqual(result, { recorded: true });
  assert.equal(db.row.ingestion_mode, "local_imap"); assert.equal(db.row.inbound_address, "fixture@gmail.com");
  assert.equal(db.row.status, "verified"); assert.equal(db.row.last_inbound_email_at, null);
  assert.equal(db.row.metadata_json.local_imap.last_probe_at, observation.observedAt);
  assert.ok(!JSON.stringify(db).includes("never-store-this"));
  assert.equal(db.audits.length, 1);
  const mapped = { ingestionMode: "local_imap", mailboxEmailNormalized: observation.mailboxEmail, metadata: db.row.metadata_json };
  assert.equal(getLocalCfeEmailLastProbe(mapped), "2026-09-11T12:00:00.000Z");
  assert.equal(getLocalCfeEmailLastProbe({ ...mapped, mailboxEmailNormalized: "changed@gmail.com" }), null);
});

test("durable email reception and later probes preserve the latest independent receipt and probe dates", async () => {
  const db = emailDatabase();
  await recordLocalCfeEmailObservation({ ...observation, lastInboundEmailAt: observation.observedAt }, { context: db.context });
  const received = db.row.last_inbound_email_at;
  await recordLocalCfeEmailObservation({ ...observation, observedAt: "2026-09-11T16:00:00Z" }, { context: db.context });
  assert.equal(db.row.last_inbound_email_at, received); assert.equal(db.row.status, "active");
  await recordLocalCfeEmailObservation({ ...observation, observedAt: "2026-09-11T10:00:00Z" }, { context: db.context });
  assert.equal(Date.parse(db.row.metadata_json.local_imap.last_probe_at), Date.parse("2026-09-11T16:00:00Z"));
  assert.equal(db.row.last_inbound_email_at, received);
  const prior = structuredClone(db.row);
  await recordLocalCfeEmailObservation({ ...observation, mailboxEmail: "replacement@gmail.com" }, { context: db.context });
  assert.equal(db.row.last_inbound_email_at, null); assert.equal(db.row.status, "verified");
  assert.equal(db.row.metadata_json.mailbox_history[0].last_inbound_email_at, prior.last_inbound_email_at);
  assert.deepEqual(db.row.metadata_json.mailbox_history[0].local_imap, prior.metadata_json.local_imap);
});

test("email status respects membership, mailbox ownership and compare-and-set without leaking failures", async () => {
  for (const options of [{ forbidden: true }, { failAudit: true }, { casConflict: true },
    { owner: { id: "other", organization_id: "other-org", user_id: "other-user", mailbox_email_normalized: observation.mailboxEmail } }]) {
    const db = emailDatabase(null, options);
    const result = await recordLocalCfeEmailObservation(observation, { context: db.context });
    assert.equal(result.recorded, false); assert.equal(db.writes, 0);
    assert.ok(!JSON.stringify(result).includes("private"));
  }
  const invalid = await recordLocalCfeEmailObservation({ ...observation, lastInboundEmailAt: "2026-09-12T12:00:00Z" }, {
    context: async () => assert.fail("Invalid evidence must not access the database"),
  });
  assert.equal(invalid.code, "invalid_observation");
});
