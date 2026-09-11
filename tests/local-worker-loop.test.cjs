/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { worker, parseCommand } = require("../scripts/local-companion/cli.cjs");
const who = { slug: "fixture", actor: "00000000-0000-0000-0000-000000000001" };
const context = async () => ({ organization: { id: "org" }, supabase: {
  from() { const query = { select() { return query; }, eq() { return query; }, async limit() { return { error: null }; } }; return query; },
} });

test("worker checks official login readiness before claiming any cloud invoice", async () => {
  let claims = 0;
  await assert.rejects(worker(who, new AbortController().signal, {
    doctor: async () => ({ ready: false }), context,
    processNext: async () => { claims++; }, report() {},
  }), /Codex no está listo/);
  assert.equal(claims, 0);
});

test("quota pauses the whole worker and leaves subsequent invoices unclaimed", async () => {
  const controller = new AbortController();
  const messages = [];
  let claims = 0;
  const run = worker(who, controller.signal, {
    doctor: async () => ({ ready: true }), context,
    emailPoll: async () => ({ status: "disabled" }),
    processNext: async () => { claims++; return { claimed: true, status: "error", code: "quota", retryable: false }; },
    report(value) { messages.push(value); if (value.status === "paused") controller.abort(); },
  });
  await run;
  assert.equal(claims, 1);
  assert.ok(messages.some((message) => message.status === "paused"));
});

test("email configuration and connection failures do not stop existing document processing", async () => {
  for (const emailPoll of [async () => ({ status: "pending_configuration" }), async () => { throw new Error("private protocol failure"); }]) {
    let claims = 0;
    const messages = [];
    await worker({ ...who, once: true }, new AbortController().signal, {
      doctor: async () => ({ ready: true }), context, emailPoll,
      processNext: async () => { claims++; return { claimed: false, status: "idle" }; }, report: (value) => messages.push(value),
    });
    assert.equal(claims, 1);
    assert.ok(!JSON.stringify(messages).includes("private protocol failure"));
  }
});

test("worker fails before claiming when the shared queue migration is absent", async () => {
  let claims = 0;
  const offlineContext = async () => {
    const value = await context();
    value.supabase.from = () => {
      const query = { select() { return query; }, eq() { return query; }, async limit() { return { error: { code: "42703" } }; } };
      return query;
    };
    return value;
  };
  await assert.rejects(worker(who, new AbortController().signal, {
    doctor: async () => ({ ready: true }), context: offlineContext,
    processNext: async () => { claims++; }, report() {},
  }), /migración/);
  assert.equal(claims, 0);
});

test("companion rejects unknown switches instead of interpreting arbitrary shell commands", () => {
  assert.throws(() => parseCommand(["worker", "--shell", "anything"]));
  const result = parseCommand(["ingest", "--file", "C:\\a folder\\a & b.png"]);
  assert.equal(result.values.file, "C:\\a folder\\a & b.png");
});
