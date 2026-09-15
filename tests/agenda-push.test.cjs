/* eslint-disable @typescript-eslint/no-require-imports */
require("./register-ts.cjs");
const { test, assert, run } = require("./testkit.cjs");
const { createECDH } = require("node:crypto");
const { planAgendaPush, eventKey } = require("../modules/push/agenda.ts");
const { isPushEndpoint, validateSubscription, readVapidConfig, validCronAuthorization, subscriptionStatus, localDay, addDays } = require("../modules/push/validation.ts");
const { deliverPush } = require("../modules/push/dispatch.ts");
const { readPushBody } = require("../modules/push/http.ts");
const ecdh = createECDH("prime256v1"); ecdh.setPrivateKey(Buffer.alloc(32, 1));
const publicKey = ecdh.getPublicKey().toString("base64url");
const config = { publicKey, privateKey: Buffer.alloc(32, 1).toString("base64url"), subject: "mailto:test@example.com" };
const keys = { p256dh: publicKey, auth: Buffer.alloc(16, 2).toString("base64url") };
const day = "2026-09-15";
const obligation = { id: "ob1", title: "Vale BROU", status: "active", frequency: "once", next_due_date: "2026-09-17", party_id: "bank1", metadata_json: { operation_number: "012345", current_due_date: "2026-09-17" } };
const task = { id: "task1", title: "Revisar vale", status: "pending", due_date: day, party_id: "bank1", metadata_json: { task_purpose: "two_day_maturity_reminder", obligation_id: "ob1", operation_number: "012345", maturity_date: "2026-09-17", reminder_date: day } };
const occurrence = { id: "occ1", obligation_id: "ob1", due_date: "2026-09-17", status: "pending", task_id: null };
function plan(overrides = {}) { return planAgendaPush({ day, tasks: [task], obligations: [obligation], occurrences: [occurrence], ...overrides }); }
test("BROU D-2 task and matching loan occurrence produce one reminder on stored task date", () => {
  const result = plan(); assert.equal(result.length, 1); assert.equal(result[0].sourceType, "task");
  assert.match(result[0].body, /17\/09\/2026/);
  assert.equal(plan({ day: "2026-09-13" }).length, 0);
  assert.equal(plan({ tasks: [] })[0].key, result[0].key);
});
test("general tasks notify on their own date and unknown dates never produce alerts", () => {
  const ordinary = { ...task, metadata_json: {}, due_date: day };
  assert.equal(plan({ tasks: [ordinary], occurrences: [] }).length, 1);
  assert.equal(plan({ tasks: [{ ...ordinary, due_date: null }], occurrences: [] }).length, 0);
  assert.equal(plan({ obligations: [{ ...obligation, next_due_date: null, metadata_json: { current_due_date: null } }] }).length, 0);
  assert.equal(plan({ obligations: [{ ...obligation, next_due_date: null, metadata_json: {} }] }).length, 0);
});
test("done/cancelled tasks suppress their paired obligation and duplicate active copies", () => {
  for (const status of ["done", "cancelled"]) {
    const finished = { ...task, id: "finished", status };
    assert.equal(plan({ tasks: [finished] }).length, 0);
    assert.equal(plan({ tasks: [finished, task] }).length, 0);
    assert.equal(plan({ tasks: [task, finished] }).length, 0);
  }
});
test("paused, archived, completed occurrences and renewed dates cannot send stale reminders", () => {
  for (const status of ["paused", "archived"]) assert.equal(plan({ obligations: [{ ...obligation, status }] }).length, 0);
  assert.equal(plan({ tasks: [], occurrences: [{ ...occurrence, status: "done" }] }).length, 0);
  assert.equal(plan({ occurrences: [{ ...occurrence, status: "done" }] }).length, 0);
  assert.equal(plan({ occurrences: [{ ...occurrence, status: "cancelled" }] }).length, 0);
  assert.equal(plan({ occurrences: [{ ...occurrence, status: "blocked" }] }).length, 0);
  assert.equal(plan({ tasks: [{ ...task, metadata_json: { ...task.metadata_json, maturity_date: "2026-09-18" } }], occurrences: [] }).length, 0);
  assert.equal(plan({ obligations: [{ ...obligation, next_due_date: "2026-12-17", metadata_json: { current_due_date: "2026-12-17" } }] }).length, 0);
  const later = plan({ day: "2026-12-15", tasks: [], obligations: [{ ...obligation, next_due_date: "2026-12-17", metadata_json: { operation_number: "012345", current_due_date: "2026-12-17" } }], occurrences: [{ ...occurrence, due_date: "2026-12-17" }] });
  assert.equal(later.length, 1); assert.notEqual(later[0].key, plan()[0].key);
});
test("date arithmetic uses Montevideo calendar across UTC midnight, months and leap years", () => {
  assert.equal(localDay(new Date("2026-09-16T02:59:00Z")), day);
  assert.equal(addDays("2026-12-31", 2), "2027-01-02");
  assert.equal(addDays("2028-02-28", 2), "2028-03-01");
});
test("push endpoint allowlist blocks SSRF, credentials, alternate ports and lookalike hosts", () => {
  for (const endpoint of ["https://fcm.googleapis.com/wp/test", "https://updates.push.services.mozilla.com/wpush/v2/test", "https://web.push.apple.com/test", "https://wns2.notify.windows.com/test"]) assert.equal(isPushEndpoint(endpoint), true);
  for (const endpoint of ["http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.evil.test/a", "https://fcm.googleapis.com@evil.test/a", "https://fcm.googleapis.com:8443/a", "https://fcm.googleapis.com/a#b", "https://evil.test/a", "https://localhost/a"]) assert.equal(isPushEndpoint(endpoint), false, endpoint);
  assert.equal(validateSubscription({ endpoint: "https://fcm.googleapis.com/wp/test", keys }).keys.p256dh, publicKey);
  assert.throws(() => validateSubscription({ endpoint: "https://fcm.googleapis.com/wp/test", keys: { ...keys, auth: "invalid" } }));
});
test("VAPID requires matching keys and cron authorization fails closed", () => {
  assert.ok(readVapidConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: config.publicKey, WEB_PUSH_VAPID_PRIVATE_KEY: config.privateKey, WEB_PUSH_VAPID_SUBJECT: config.subject }));
  assert.equal(readVapidConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: publicKey }), null);
  assert.equal(validCronAuthorization(null, "a".repeat(32)), false);
  assert.equal(validCronAuthorization("Bearer wrong", "a".repeat(32)), false);
  assert.equal(validCronAuthorization(`Bearer ${"a".repeat(32)}`, "a".repeat(32)), true);
});
test("mutation bodies reject cross-site requests, oversized streaming bodies and invalid JSON", async () => {
  const req = (body, origin = "https://app.example.com") => new Request("https://app.example.com/api/v1/push", { method: "POST", headers: { origin, "content-type": "application/json" }, body });
  await assert.rejects(readPushBody(req("{}", "https://evil.test")), /Origen/);
  await assert.rejects(readPushBody(req("x".repeat(13000))), /grande/);
  await assert.rejects(readPushBody(req("[1]")), /JSON/);
  assert.deepEqual(await readPushBody(req('{"slug":"rontil"}')), { slug: "rontil" });
});
function ledger() {
  const claims = new Set(); const outcomes = [];
  return { claims, outcomes, rpc: async (name, input) => {
    if (name === "claim_agenda_push_delivery") {
      const key = `${input.p_subscription_id}:${input.p_event_key}`;
      if (claims.has(key)) return { data: [], error: null };
      claims.add(key); return { data: [{ delivery_id: key, endpoint: "https://fcm.googleapis.com/wp/test", ...keys, auth_key: keys.auth }], error: null };
    }
    outcomes.push(input); return { error: null };
  } };
}
const event = { key: eventKey("fixture"), sourceType: "task", sourceId: "task1", sourceDueDate: day, title: "Agenda", body: "Aviso" };
test("concurrent dispatch claims once and sends only internal agenda URL", async () => {
  const db = ledger(); let sends = 0;
  const input = { supabase: db, config, day, slug: "rontil", subscriptionId: "sub1", event, transport: async (_sub, payload) => { sends++; assert.equal(payload.url, "/app/o/rontil/agenda"); return { statusCode: 201 }; } };
  assert.deepEqual((await Promise.all([deliverPush(input), deliverPush(input)])).sort(), ["accepted", "already_attempted"]);
  assert.equal(sends, 1); assert.equal(db.outcomes[0].p_status, "accepted");
});
test("404/410 deactivate through expired result; rejected and uncertain sends are never retried", async () => {
  for (const code of [404, 410, 429, 503, null]) {
    const db = ledger(); let sends = 0;
    const input = { supabase: db, config, day, slug: "rontil", subscriptionId: "sub1", event, transport: async () => { sends++; throw Object.assign(new Error("private endpoint must not be persisted"), code ? { statusCode: code } : {}); } };
    assert.equal(await deliverPush(input), code === 404 || code === 410 ? "expired" : code ? "failed" : "unknown");
    assert.equal(await deliverPush(input), "already_attempted"); assert.equal(sends, 1);
    assert.doesNotMatch(JSON.stringify(db.outcomes), /private endpoint/);
  }
});
test("missing claim (revoked membership/cancelled source) never reaches push transport", async () => {
  let sends = 0;
  assert.equal(await deliverPush({ supabase: { rpc: async () => ({ data: [] }) }, config, day, slug: "rontil", subscriptionId: "sub1", event, transport: async () => { sends++; return { statusCode: 201 }; } }), "already_attempted");
  assert.equal(sends, 0);
});
test("subscription status requests browser refresh only for expiry or VAPID rotation", () => {
  const row = { enabled: true, vapid_public_key: publicKey, expires_at: null, disabled_reason: null };
  assert.deepEqual(subscriptionStatus(row, publicKey), { subscribed: true, requiresRefresh: false });
  assert.deepEqual(subscriptionStatus({ ...row, enabled: false, disabled_reason: "user_disabled" }, publicKey), { subscribed: false, requiresRefresh: false });
  assert.deepEqual(subscriptionStatus({ ...row, enabled: false, disabled_reason: "provider_expired" }, publicKey), { subscribed: false, requiresRefresh: true });
  assert.deepEqual(subscriptionStatus(row, "rotated"), { subscribed: false, requiresRefresh: true });
  assert.deepEqual(subscriptionStatus({ ...row, expires_at: "2020-01-01T00:00:00Z" }, publicKey), { subscribed: false, requiresRefresh: true });
});
if (require.main === module) run();
