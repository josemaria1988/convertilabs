/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { test, assert } = require("./testkit.cjs");
const { buildCompanyHomeDashboard } = require("@/modules/presentation/company-home");

function render(data) {
  const originalLoad = Module._load;
  const path = require.resolve("@/components/dashboard/company-home-dashboard");
  const previous = require.cache[path];
  delete require.cache[path];
  Module._load = function (request, parent, isMain) {
    if (request === "@/components/ui/loading-link") return { LoadingLink({ href, children, ...props }) { delete props.pendingLabel; return React.createElement("a", { href, ...props }, children); } };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { CompanyHomeDashboard } = require(path);
    return renderToStaticMarkup(React.createElement(CompanyHomeDashboard, { data, organizationSlug: "rontil" }));
  } finally {
    Module._load = originalLoad;
    delete require.cache[path];
    if (previous) require.cache[path] = previous;
  }
}

function dashboard(overrides = {}) {
  return buildCompanyHomeDashboard({ organizationSlug: "rontil", documents: [], work: { isAvailable: true, totalCount: 0, recent: [] }, directory: { isAvailable: true, totalCount: 0, recent: [] }, money: { isAvailable: false, totalCount: 0, recent: [] }, ...overrides });
}

test("home UI introduces Inicio before supplier balances and keeps upload, review and work destinations", () => {
  const data = dashboard({ supplierInvoices: { confirmed: [], unconfirmed: [], updatedAt: null, coverage: { status: "complete" } }, documents: [{ id: "doc-1", label: "Factura A200", href: "/app/o/rontil/documents/doc-1", createdAt: "2026-09-11", bucket: "blocked", blockingReason: "Falta confirmar la moneda", nextActionLabel: "Resolver factura" }] });
  const html = render(data);
  assert.ok(html.indexOf(">Inicio</h1>") < html.indexOf("Facturas de proveedores"));
  assert.match(html, /href="\/app\/o\/rontil\/documents#document-upload-panel"/);
  assert.match(html, /href="\/app\/o\/rontil\/documents\/doc-1"/);
  assert.match(html, /Falta confirmar la moneda/);
  assert.match(html, /href="\/app\/o\/rontil\/review"/);
  assert.match(html, /href="\/app\/o\/rontil\/work"/);
  assert.doesNotMatch(html, /Resumen madre|Open items|Parties visibles|text-white|sin indicadores de relleno/);
});

test("home UI never recasts completed documents as pending and keeps access to past work in its empty state", () => {
  const html = render(dashboard({ documents: [{ id: "done", label: "Factura finalizada A100", href: null, createdAt: "2026-09-11", bucket: "done", blockingReason: null, nextActionLabel: null }] }));
  assert.match(html, /No hay documentos pendientes en esta vista/); assert.doesNotMatch(html, /Factura finalizada A100/);
  assert.match(html, /Trabajos activos/); assert.match(html, /No hay trabajos activos/); assert.match(html, /consultar los anteriores en Trabajos/);
  assert.doesNotMatch(html, /UYU|\$\s*700/);
});

test("home UI retains unavailable states instead of rendering invented zero balances or sales charts", () => {
  const data = dashboard({ work: { isAvailable: false, totalCount: 0, recent: [] }, directory: { isAvailable: false, totalCount: 0, recent: [] } });
  data.actions = [];
  const html = render(data);
  assert.match(html, /Sin información disponible/); assert.match(html, /No pudimos obtener los trabajos/);
  assert.match(html, /No hay acciones pendientes detectadas en los datos disponibles/);
  assert.doesNotMatch(html, /UYU|\$ 0|Total ventas|<canvas|<svg/);
});

test("home UI preserves the supplied treasury currency and critical alerts while keeping all action links", () => {
  const data = dashboard({ treasury: { isAvailable: true, currencyCode: "USD", conservativeAvailableCash: -120, alertCount: 2, criticalAlertCount: 1 } });
  data.actions.push({ key: "custom", title: "Revisar pago pendiente", description: "Descripción larga", href: "/app/o/rontil/money?due=overdue", cta: "Ver vencidos", tone: "danger" });
  const html = render(data);
  assert.match(html, /US\$/); assert.match(html, /120/); assert.match(html, /2 alertas de tesorería/);
  assert.match(html, /href="\/app\/o\/rontil\/money\?due=overdue"/); assert.match(html, /Revisar pago pendiente/);
  assert.equal((html.match(/Revisar pago pendiente/g) || []).length, 1);
});

test("home UI renders source labels as text and does not display impossible source dates", () => {
  const html = render(dashboard({ documents: [{ id: "doc", label: "<script>external()</script>", href: "/app/o/rontil/documents/doc", createdAt: "2026-02-30", bucket: "review", blockingReason: null, nextActionLabel: "Revisar" }] }));
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>|30\/02\/2026/); assert.match(html, /Sin fecha/);
});
