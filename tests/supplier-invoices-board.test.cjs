/* eslint-disable @typescript-eslint/no-require-imports */
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { test, assert } = require("./testkit.cjs");
const { SupplierInvoicesBoard, filterSupplierInvoiceGroups } = require("@/components/money/supplier-invoices-board");

function invoice(overrides = {}) {
  return { id: "invoice-one", number: "A0000200", issuedAt: "2026-09-11", dueAt: "2026-09-20", dueState: "due_soon", currency: "UYU", amount: "690.00",
    reviewHref: "/app/o/demo/documents/10000000-0000-4000-8000-000000000001", ...overrides };
}
function group(overrides = {}) {
  return { id: "party-one", name: "Proveedor de prueba", taxId: "210000000010", totals: [{ currency: "UYU", amount: "690.00" }], invoices: [invoice()], ...overrides };
}
function props(overrides = {}) { return { confirmed: [], unconfirmed: [], updatedAt: "2026-09-11T18:00:00Z", coverage: { status: "complete" }, ...overrides }; }
const render = (data) => renderToStaticMarkup(React.createElement(SupplierInvoicesBoard, data));

test("supplier invoice board keeps confirmed balances and received amounts under distinct prominent headings", () => {
  const html = render(props({ confirmed: [group()], unconfirmed: [group({ id: "party-two", name: "Recibidas por revisar", invoices: [invoice({ id: "invoice-two", number: "B200" })] })] }));
  assert.match(html, /Facturas de proveedores/); assert.match(html, /Pendientes de pago/); assert.match(html, /Por confirmar/);
  assert.match(html, /Saldo pendiente/); assert.match(html, /Importe por verificar/); assert.match(html, /Facturas recibidas en Convertilabs/);
  assert.match(html, /cómo se pagó/); assert.doesNotMatch(html, /Marcar como pagad|Enviar a Zeta|Registrar pago/);
});
test("supplier board renders separate currencies and exact decimal strings without a converted total", () => {
  const html = render(props({ confirmed: [group({ totals: [{ currency: "UYU", amount: "9007199254740993.01" }, { currency: "USD", amount: "190.50" }],
    invoices: [invoice({ amount: "9007199254740993.01" }), invoice({ id: "dollar", amount: "190.50", currency: "USD" })] })] }));
  assert.match(html, /UYU 9\.007\.199\.254\.740\.993,01/); assert.match(html, /USD 190,50/);
  assert.doesNotMatch(html, /Total general|Equivalente|9\.007\.199\.254\.741\.183/);
});
test("supplier board exposes invoice dates, due status and review links inside accessible expandable cards", () => {
  const html = render(props({ confirmed: [group({ invoices: [invoice({ dueState: "overdue", dueAt: "2026-09-10" }), invoice({ id: "soon" }), invoice({ id: "missing", dueAt: null, dueState: "no_due_date" })] })] }));
  assert.match(html, /<details/); assert.match(html, /<summary/); assert.match(html, /Factura A0000200/);
  assert.match(html, /11\/09\/2026/); assert.match(html, /10\/09\/2026/); assert.match(html, /1 vencida/); assert.match(html, /1 próxima/); assert.match(html, /1 sin vencimiento/);
  assert.match(html, /href="\/app\/o\/demo\/documents\/10000000-0000-4000-8000-000000000001"/);
  assert.match(html, /aria-label="Revisar factura A0000200"/); assert.match(html, /min-h-11/);
});
test("supplier search ignores case and accents and accepts formatted RUT without merging similar names", () => {
  const groups = [group({ id: "one", name: "Ferretería del Sur", taxId: "211234560019" }), group({ id: "two", name: "Ferreteria del Norte", taxId: "212222220019" })];
  assert.deepEqual(filterSupplierInvoiceGroups(groups, "FERRETERIA SUR").map((row) => row.id), ["one"]);
  assert.deepEqual(filterSupplierInvoiceGroups(groups, "21.123.456.001-9").map((row) => row.id), ["one"]);
  assert.deepEqual(filterSupplierInvoiceGroups(groups, "no existe"), []); assert.deepEqual(filterSupplierInvoiceGroups(groups, "."), []);
  assert.equal(filterSupplierInvoiceGroups(groups, "  "), groups); assert.equal(groups.length, 2);
});
test("supplier board never substitutes zero or UYU for unknown invoice amount and currency", () => {
  const html = render(props({ unconfirmed: [group({ totals: [], invoices: [invoice({ amount: null, currency: null }), invoice({ id: "missing-currency", amount: "12.30", currency: null })] })] }));
  assert.match(html, /Importe por confirmar/); assert.match(html, /12,30 · Moneda por confirmar/); assert.doesNotMatch(html, /UYU|0,00/);
});
test("supplier board reports honest empty, partial coverage and unavailable states", () => {
  const empty = render(props()); assert.match(empty, /No hay facturas en este grupo entre los registros disponibles/);
  const partial = render(props({ coverage: { status: "partial", message: "Falta revisar algunos comprobantes recibidos." } }));
  assert.match(partial, /Información parcial/); assert.match(partial, /Falta revisar algunos comprobantes recibidos/);
  const unavailable = render(props({ coverage: { status: "unavailable" }, updatedAt: null }));
  assert.match(unavailable, /Información no disponible/); assert.match(unavailable, /Sin datos/); assert.doesNotMatch(unavailable, /0 facturas/);
  assert.match(unavailable, /Fecha de actualización no disponible/);
});
test("supplier board keeps available rows when a source fails and never reveals technical error contents", () => {
  const html = render(props({ confirmed: [group()], error: "database password=secret fail", coverage: { status: "partial" } }));
  assert.match(html, /role="alert"/); assert.match(html, /No pudimos cargar toda la información/); assert.match(html, /Proveedor de prueba/);
  assert.doesNotMatch(html, /password|secret|database/);
});
test("supplier board only displays paid and inbox counts when the read model explicitly provides them", () => {
  const base = render(props()); assert.doesNotMatch(base, /pago registrado|antes de aparecer aquí/);
  const html = render(props({ excludedPaidCount: 3, inboxPendingCount: 1, inboxPendingHref: "/app/o/demo/documents" }));
  assert.match(html, /3 facturas con pago registrado/); assert.match(html, /1 comprobante recibido necesita/);
  assert.match(html, /href="\/app\/o\/demo\/documents"/); assert.match(html, /Revisar recibidos/);
});
test("supplier board escapes source strings and refuses non-internal review links", () => {
  const html = render(props({ unconfirmed: [group({ name: '<script>alert("x")</script>', invoices: [invoice({ reviewHref: "javascript:alert(1)", reason: '<img src=x onerror="secret">' })] })] }));
  assert.match(html, /&lt;script&gt;/); assert.match(html, /&lt;img/); assert.match(html, /Revisión no disponible/);
  assert.doesNotMatch(html, /<script>|<img |href="javascript:/);
});
test("supplier board retains separate fiscal groups with the same displayed supplier name", () => {
  const html = render(props({ confirmed: [group(), group({ id: "another-party", taxId: "212222220019" })] }));
  assert.equal((html.match(/data-supplier-id=/g) ?? []).length, 2); assert.match(html, /RUT 210000000010/); assert.match(html, /RUT 212222220019/);
});
test("supplier board does not turn invalid dates into a valid displayed due date", () => {
  const html = render(props({ unconfirmed: [group({ invoices: [invoice({ issuedAt: "2026-02-30", dueAt: "invalid" })] })] }));
  assert.match(html, /Por confirmar/); assert.doesNotMatch(html, /30\/02\/2026|>invalid</);
});
test("supplier board gives the populated section full width and keeps the empty section compact and first", () => {
  const html = render(props({ unconfirmed: [group(), group({ id: "second", name: "Segundo proveedor" })] }));
  assert.doesNotMatch(html, /lg:grid-cols-2/); assert.match(html, /md:grid-cols-2/);
  assert.match(html, /border-dashed[^\"]*px-3 py-2/);
  assert.ok(html.indexOf("Pendientes de pago") < html.indexOf("Por confirmar"));
  const both = render(props({ confirmed: [group()], unconfirmed: [group({ id: "second" })] }));
  assert.match(both, /lg:grid-cols-2/); assert.doesNotMatch(both, /md:grid-cols-2/);
  const onlyOne = render(props({ unconfirmed: [group()] }));
  assert.doesNotMatch(onlyOne, /(?:md|lg):grid-cols-2/);
});
