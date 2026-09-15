/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { assert, test } = require("./testkit.cjs");
const { classifyPushSupport, getPushDeviceId, decodePushPublicKey, preparePushSubscription, matchesRegisteredPushEndpoint, pushEndpointHash } = require("../modules/pwa/push-browser.ts");

const supportedBrowser = {
  userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/131",
  maxTouchPoints: 5,
  standalone: false,
  secureContext: true,
  localDevelopment: false,
  notifications: true,
  serviceWorker: true,
  pushManager: true,
};

test("push: Android browser and installed app do not receive an iOS install instruction", () => {
  assert.equal(classifyPushSupport(supportedBrowser), "supported");
  assert.equal(classifyPushSupport({ ...supportedBrowser, standalone: true }), "supported");
});

test("push: iPhone and desktop-mode iPad require Home Screen only when not already installed", () => {
  for (const userAgent of ["Mozilla/5.0 (iPhone) Safari", "Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari"]) {
    const device = { ...supportedBrowser, userAgent };
    assert.equal(classifyPushSupport(device), "ios-install");
    assert.equal(classifyPushSupport({ ...device, standalone: true }), "supported");
  }
  assert.equal(classifyPushSupport({ ...supportedBrowser, userAgent: "Macintosh Safari", maxTouchPoints: 0 }), "supported");
});

test("push: local development, insecure contexts and unsupported browsers are distinct", () => {
  assert.equal(classifyPushSupport({ ...supportedBrowser, localDevelopment: true }), "local");
  assert.equal(classifyPushSupport({ ...supportedBrowser, secureContext: false }), "insecure");
  assert.equal(classifyPushSupport({ ...supportedBrowser, pushManager: false }), "unsupported");
});

test("push: stable device identity survives refresh, invalid identities are replaced and storage errors stay visible", () => {
  const entries = new Map();
  const storage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  let created = 0;
  const create = () => { created += 1; return "4d7cac6c-6ca9-40bd-a149-e9359b47e9b5"; };
  assert.equal(getPushDeviceId(storage, create), getPushDeviceId(storage, create));
  assert.equal(created, 1);
  entries.set("convertilabs.push.device-id", "invalid");
  getPushDeviceId(storage, create);
  assert.equal(created, 2);
  assert.throws(() => getPushDeviceId({ ...storage, getItem: () => { throw Error("Storage denied"); } }, create), /Storage denied/);
});

test("push: public key decoder preserves base64url bytes", () => {
  const bytes = Buffer.from([4, 255, 239, 1, 99]);
  assert.deepEqual(Array.from(decodePushPublicKey(bytes.toString("base64url"))), Array.from(bytes));
});

test("push: activation reuses a valid browser subscription shared by other organizations", async () => {
  const key = new Uint8Array([4, 12, 34]);
  const existing = { options: { applicationServerKey: key.buffer }, unsubscribe: () => { throw Error("Must not unsubscribe a valid endpoint"); } };
  const result = await preparePushSubscription({ getSubscription: async () => existing, subscribe: () => { throw Error("Must reuse"); } }, Buffer.from(key).toString("base64url"), false);
  assert.equal(result.subscription, existing);
  assert.equal(result.replaced, false);
});

test("push: a replaced endpoint does not falsely show another organization as subscribed", async () => {
  const original = { endpoint: "https://fcm.googleapis.com/old" };
  const replacement = { endpoint: "https://fcm.googleapis.com/new" };
  const recordedHash = await pushEndpointHash(original.endpoint);
  assert.equal(await matchesRegisteredPushEndpoint(original, recordedHash), true);
  assert.equal(await matchesRegisteredPushEndpoint(replacement, recordedHash), false);
  assert.equal(await matchesRegisteredPushEndpoint(null, recordedHash), false);
  assert.equal(await matchesRegisteredPushEndpoint(replacement, null), false);
});

test("push: reactivating another organization with an expired old row keeps the already renewed endpoint", async () => {
  const key = new Uint8Array([4, 12, 34]);
  const originalHash = await pushEndpointHash("https://fcm.googleapis.com/expired");
  const fresh = {
    endpoint: "https://fcm.googleapis.com/fresh",
    options: { applicationServerKey: key.buffer },
    unsubscribe: () => { throw Error("Must retain another organization's valid endpoint"); },
  };
  const result = await preparePushSubscription({ getSubscription: async () => fresh, subscribe: () => { throw Error("Must reuse"); } }, Buffer.from(key).toString("base64url"), true, originalHash);
  assert.equal(result.subscription, fresh);
  assert.equal(result.replaced, false);
});

test("push: explicit reactivation replaces expired endpoints and obsolete VAPID bindings", async () => {
  for (const expired of [true, false]) {
    const currentKey = new Uint8Array([4, 12, 34]);
    const oldKey = expired ? currentKey : new Uint8Array([4, 1, 2]);
    const calls = [];
    const fresh = { endpoint: "fresh" };
    const manager = {
      getSubscription: async () => ({ options: { applicationServerKey: oldKey.buffer }, unsubscribe: async () => { calls.push("unsubscribe"); return true; } }),
      subscribe: async (options) => { calls.push("subscribe"); assert.deepEqual(Array.from(options.applicationServerKey), Array.from(currentKey)); assert.equal(options.userVisibleOnly, true); return fresh; },
    };
    const result = await preparePushSubscription(manager, Buffer.from(currentKey).toString("base64url"), expired);
    assert.deepEqual(calls, ["unsubscribe", "subscribe"]);
    assert.equal(result.subscription, fresh);
    assert.equal(result.replaced, true);
  }
});

test("push: refresh failure is reported without returning the expired subscription as active", async () => {
  const key = new Uint8Array([4, 12, 34]);
  const manager = {
    getSubscription: async () => ({ options: { applicationServerKey: key.buffer }, unsubscribe: async () => { throw Error("Cannot unsubscribe"); } }),
    subscribe: () => { throw Error("Must not subscribe after failure"); },
  };
  await assert.rejects(preparePushSubscription(manager, Buffer.from(key).toString("base64url"), true), /Cannot unsubscribe/);
});

function workerHarness(existingNotifications = []) {
  const listeners = {};
  const calls = { shown: [], opened: [], focused: 0, cache: 0, fetched: 0 };
  const windows = [];
  const scope = {
    self: {
      location: { origin: "https://www.convertilabs.com" },
      addEventListener: (name, handler) => { listeners[name] = handler; },
      registration: {
        getNotifications: async () => existingNotifications,
        showNotification: async (title, options) => calls.shown.push({ title, options }),
      },
      clients: {
        matchAll: async () => windows,
        openWindow: async (url) => calls.opened.push(url),
      },
    },
    URL,
    Response,
    caches: { open: async () => { calls.cache += 1; throw Error("Unexpected private cache access"); } },
    fetch: async () => { calls.fetched += 1; return new Response("Network only"); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8"), scope);
  async function dispatch(name, data = {}) {
    let pending;
    listeners[name]({ ...data, waitUntil: (value) => { pending = value; }, respondWith: (value) => { pending = value; } });
    await pending;
  }
  return { calls, windows, dispatch };
}

test("push worker: displays a trusted agenda target and stable deduplication tag without caching", async () => {
  const worker = workerHarness();
  await worker.dispatch("push", { data: { json: () => ({ title: "Vence en 2 días", body: "Revisá la agenda", tag: "agenda:123:2026-09-21", url: "/app/o/rontil-s-a/agenda?redirect=https://external.test" }) } });
  assert.equal(worker.calls.shown.length, 1);
  const notification = worker.calls.shown[0];
  assert.equal(notification.options.data.url, "https://www.convertilabs.com/app/o/rontil-s-a/agenda");
  assert.equal(notification.options.tag, "agenda:123:2026-09-21");
  assert.equal(notification.options.renotify, false);
  assert.equal(worker.calls.cache, 0);
  assert.equal(worker.calls.fetched, 0);
});

test("push worker: a displayed notification with the same tag is not shown twice", async () => {
  const worker = workerHarness([{ tag: "same" }]);
  await worker.dispatch("push", { data: { json: () => ({ tag: "same" }) } });
  assert.equal(worker.calls.shown.length, 0);
});

test("push worker: invalid payloads produce a generic visible notification", async () => {
  const worker = workerHarness();
  await worker.dispatch("push", { data: { json: () => { throw Error("Invalid JSON"); } } });
  assert.equal(worker.calls.shown[0].title, "Convertilabs · Agenda");
  assert.equal(worker.calls.shown[0].options.data.url, "https://www.convertilabs.com/app");
});

test("push worker: clicks reject external URLs, credentials, redirect routes and script URLs", async () => {
  for (const url of ["https://external.test/app/o/rontil-s-a/agenda", "//external.test/", "https://name@www.convertilabs.com/app/o/rontil-s-a/agenda", "/auth/callback?next=https://external.test", "javascript:alert(1)"]) {
    const worker = workerHarness();
    let closed = false;
    await worker.dispatch("notificationclick", { notification: { data: { url }, close: () => { closed = true; } } });
    assert.equal(closed, true);
    assert.deepEqual(worker.calls.opened, ["https://www.convertilabs.com/app"]);
  }
});

test("push worker: clicks focus an existing Agenda window instead of opening a duplicate", async () => {
  const worker = workerHarness();
  const url = "https://www.convertilabs.com/app/o/rontil-s-a/agenda";
  worker.windows.push({ url, focus: async () => { worker.calls.focused += 1; } });
  await worker.dispatch("notificationclick", { notification: { data: { url }, close: () => {} } });
  assert.equal(worker.calls.focused, 1);
  assert.equal(worker.calls.opened.length, 0);
});

test("push worker: authenticated APIs are not intercepted and private navigations remain network-only", async () => {
  const worker = workerHarness();
  await worker.dispatch("fetch", { request: { method: "GET", url: "https://www.convertilabs.com/api/v1/push", mode: "cors" } });
  assert.equal(worker.calls.fetched, 0);
  await worker.dispatch("fetch", { request: { method: "GET", url: "https://www.convertilabs.com/app/o/rontil-s-a/agenda", mode: "navigate" } });
  assert.equal(worker.calls.fetched, 1);
  assert.equal(worker.calls.cache, 0);
});
