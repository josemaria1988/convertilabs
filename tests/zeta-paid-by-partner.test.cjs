/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function readProjectFile(...segments) {
  return fs.readFileSync(path.join(__dirname, "..", ...segments), "utf8");
}

function baseCatalogs(overrides = {}) {
  return {
    suppliers: [{ Codigo: "PR0031", Nombre: "Los Delfines", RUT: "21.999.888.777", EsProveedor: "S" }],
    supplierCommercialData: [{ Codigo: "PR0031", IVA: "N" }],
    documentTypes: [{ Codigo: 12, Nombre: "Compra gasto contado", ComprobanteGastos: "S", Activo: "S", IVA: "N" }],
    concepts: [{ Codigo: "GASTOSVAR", Nombre: "Gastos varios", ConceptoActivo: "S" }],
    vatRates: [{ Codigo: 1, Nombre: "Basico", Tasa: 22 }],
    paymentTerms: [{ Codigo: "SOC", Nombre: "Pago socio", Activo: "S" }],
    paymentMethods: [{ Codigo: 7, Nombre: "A reintegrar socio", Activo: "S", RequiereCaja: "N" }],
    currencies: [{ Codigo: 1, CodigoISO: "UYU" }],
    businessLocations: [{ Codigo: 1, Nombre: "Casa central", Activo: "S" }],
    users: [{ Codigo: 42, Nombre: "Usuario API", UsuarioEmail: "api@example.com" }],
    cashboxes: [{ Codigo: 1, Nombre: "Caja principal", LocalCodigo: 1, LocalActivo: "S" }],
    config: {
      documentTypes: {
        purchase_expense_cash: 12,
      },
      concepts: {
        default: "GASTOSVAR",
      },
      paymentTerms: {
        paid_by_partner: "SOC",
      },
      paymentMethods: {
        paid_by_partner: 7,
      },
      currencies: {
        UYU: 1,
      },
      defaults: {
        localCode: 1,
        userCode: 42,
        cashboxCode: 1,
      },
    },
    ...overrides,
  };
}

function paidByPartnerDocument() {
  return {
    organizationId: "org-1",
    documentId: "doc-paid",
    documentRole: "purchase",
    documentType: "purchase_invoice",
    postingTemplateCode: "purchase_expense_paid_by_partner.v1",
    operationCategory: "admin_expense",
    paymentTerms: "cash",
    settlementMethod: "paid_by_partner",
    supplierRut: "21.999.888.777",
    supplierName: "Los Delfines",
    series: "A",
    number: "22",
    fiscalIdentityTrusted: true,
    issueDate: "2026-04-20",
    currencyCode: "UYU",
    netAmount: 1000,
    taxAmount: 220,
    totalAmount: 1220,
    lines: [{ conceptDescription: "Gasto", netAmount: 1000, taxRate: 22, taxAmount: 220, totalAmount: 1220 }],
  };
}

test("paid_by_partner usa FormasPago y envia CodigoCaja obligatorio solo en cabecera", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: paidByPartnerDocument(),
    catalogs: baseCatalogs(),
  });

  assert.equal(result.blockers.length, 0);
  const movimiento = result.payload.Data.Movimiento[0];
  assert.equal(movimiento.CodigoCaja, 1);
  assert.equal(movimiento.FormasPago.length, 1);
  assert.equal(movimiento.FormasPago[0].CodigoFormaPago, 7);
  assert.equal(movimiento.FormasPago[0].MontoMonedaPago, 1220);
  assert.ok(result.warnings.some((warning) => warning.code === "zeta_paid_by_partner_no_cash_bank"));
});

test("falta forma de pago paid_by_partner bloquea exportacion", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: paidByPartnerDocument(),
    catalogs: baseCatalogs({
      config: {
        ...baseCatalogs().config,
        paymentMethods: {},
      },
    }),
  });

  assert.equal(result.exportable, false);
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_payment_method_missing"));
  assert.match(result.blockers.find((entry) => entry.code === "zeta_payment_method_missing").message, /socio/i);
});

test("paid_by_partner bloquea si la forma de pago Zeta exige caja", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: paidByPartnerDocument(),
    catalogs: baseCatalogs({
      paymentMethods: [{ Codigo: 7, Nombre: "Socio con caja", Activo: "S", RequiereCaja: "S" }],
    }),
  });

  assert.ok(result.blockers.some((entry) => entry.code === "zeta_paid_by_partner_requires_cashbox"));
});

test("la revision documental conserva paid_by_partner como forma de pago valida", () => {
  const source = readProjectFile("modules", "documents", "review.ts");

  assert.match(
    source,
    /input\.accountingContext\.settlementMethod === "paid_by_partner"/,
  );
});

