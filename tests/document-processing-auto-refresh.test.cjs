/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { test, assert } = require("./testkit.cjs");

function inspectRefresh(props, inspect) {
  const request = "@/components/documents/document-processing-auto-refresh";
  const resolved = require.resolve(request);
  const oldModule = require.cache[resolved];
  const oldLoad = Module._load;
  const oldWindow = global.window;
  const effects = [];
  const intervals = [];
  const timeouts = [];
  const cleared = [];
  let refreshes = 0;
  const router = { refresh() { refreshes++; } };
  global.window = {
    setInterval(callback, milliseconds) { intervals.push({ callback, milliseconds }); return intervals.length; },
    setTimeout(callback, milliseconds) { timeouts.push({ callback, milliseconds }); return timeouts.length; },
    clearInterval(id) { cleared.push(id); }, clearTimeout() {},
  };
  Module._load = function patchedLoad(name, parent, isMain) {
    if (name === "react") return { ...React, useEffect: (effect) => effects.push(effect),
      useTransition: () => [false, (callback) => callback()] };
    if (name === "next/navigation") return { useRouter: () => router };
    return oldLoad.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[resolved];
    const { DocumentProcessingAutoRefresh } = require(request);
    const element = DocumentProcessingAutoRefresh(props);
    const cleanups = effects.map((effect) => effect()).filter(Boolean);
    inspect({ element, html: renderToStaticMarkup(element), intervals, timeouts, cleared,
      refreshes: () => refreshes, cleanup: () => cleanups.forEach((cleanup) => cleanup()) });
  } finally {
    Module._load = oldLoad;
    if (oldWindow === undefined) delete global.window;
    else global.window = oldWindow;
    delete require.cache[resolved];
    if (oldModule) require.cache[resolved] = oldModule;
  }
}

test("queued local invoice refreshes only on manual click and shows the four-hour wait", () => {
  inspectRefresh({ active: true, waitingForLocalWorker: true }, (state) => {
    assert.equal(state.intervals.length, 0);
    assert.equal(state.timeouts.length, 0);
    assert.equal(state.refreshes(), 0);
    assert.match(state.html, /cada 4 horas/);
    assert.match(state.html, /Actualizar estado/);
    assert.doesNotMatch(state.html, /alrededor de un minuto/);
    const button = state.element.props.children.find((child) => child.type === "button");
    button.props.onClick();
    assert.equal(state.refreshes(), 1);
  });
});

test("active extraction and legacy queue retain bounded refresh and completed work has no timer", () => {
  inspectRefresh({ active: true, waitingForLocalWorker: false }, (state) => {
    assert.equal(state.intervals.length, 1);
    assert.equal(state.intervals[0].milliseconds, 4000);
    assert.equal(state.timeouts[0].milliseconds, 120000);
    state.intervals[0].callback();
    assert.equal(state.refreshes(), 1);
    state.timeouts[0].callback();
    assert.deepEqual(state.cleared, [1]);
    state.cleanup();
  });
  inspectRefresh({ active: false, waitingForLocalWorker: false }, (state) => {
    assert.equal(state.intervals.length, 0);
    assert.equal(state.html, "");
  });
});
