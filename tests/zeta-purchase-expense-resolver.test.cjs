/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function catalogs(overrides = {}) {
  return {
    suppliers: [
      {
        Codigo: "PR0031",
        Nombre: "Los Delfines",
        RUT: "21.999.888.777",
        EsProveedor: "S",
        ContactoActivo: "S",
      },
    ],
    supplierCommercialData: [{ Codigo: "PR0031", Nombre: "Los Delfines" }],
    documentTypes: [
      { Codigo: 11, Nombre: "Compra gasto credito", ComprobanteGastos: "S", Activo: "S" },
      { Codigo: 12, Nombre: "Compra gasto contado", ComprobanteGastos: "S", Activo: "S" },
      { Codigo: 13, Nombre: "Nota credito proveedor gasto", ComprobanteGastos: "S", Activo: "S" },
      { Codigo: 99, Nombre: "Compra mercaderia", ComprobanteGastos: "N", TomarParaActualizarCostos: "S", Activo: "S" },
    ],
    concepts: [
      { Codigo: "GASTOSVAR", Nombre: "Gastos varios", ConceptoActivo: "S" },
      { Codigo: "ALIMENTOS", Nombre: "Alimentos", ConceptoActivo: "S" },
    ],
    vatRates: [
      { Codigo: 1, Nombre: "Basico", Tasa: 22 },
      { Codigo: 2, Nombre: "Minimo", Tasa: 10 },
      { Codigo: 3, Nombre: "Exento", Tasa: 0 },
    ],
    paymentTerms: [
      { Codigo: "CR", Nombre: "Credito", Activo: "S" },
      { Codigo: "CO", Nombre: "Contado", Activo: "S" },
      { Codigo: "SOC", Nombre: "Pago socio", Activo: "S" },
    ],
    paymentMethods: [
      { Codigo: 7, Nombre: "A reintegrar socio", Activo: "S", RequiereCaja: "N" },
      { Codigo: 1, Nombre: "Efectivo", Activo: "S", RequiereCaja: "S" },
    ],
    currencies: [
      { Codigo: 1, CodigoISO: "UYU", Nombre: "Pesos" },
      { Codigo: 2, CodigoISO: "USD", Nombre: "Dolares" },
    ],
    cashboxes: [{ Codigo: 1, Nombre: "Caja principal", Activo: "S" }],
    config: {
      documentTypes: {
        purchase_expense_credit: 11,
        purchase_expense_cash: 12,
        supplier_credit_note_expense: 13,
      },
      concepts: {
        default: "GASTOSVAR",
        bySupplierCode: {
          PR0031: "ALIMENTOS",
        },
      },
      paymentTerms: {
        credit: "CR",
        cash: "CO",
        paid_by_partner: "SOC",
      },
      paymentMethods: {
        cash: 1,
        paid_by_partner: 7,
      },
      currencies: {
        UYU: 1,
        USD: 2,
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

function document(overrides = {}) {
  return {
    organizationId: "org-1",
    documentId: "doc-1",
    documentRole: "purchase",
    documentType: "purchase_invoice",
    postingTemplateCode: "purchase_expense_credit.v1",
    operationCategory: "admin_expense",
    paymentTerms: "credit",
    settlementMethod: "unknown",
    supplierRut: "21.999.888.777",
    supplierName: "Los Delfines",
    series: "A",
    number: "123456",
    fiscalIdentityTrusted: true,
    issueDate: "2026-04-20",
    currencyCode: "UYU",
    exchangeRate: null,
    netAmount: 1000,
    taxAmount: 220,
    totalAmount: 1220,
    sourceReference: "CFE A 123456",
    cfeTypeCode: 111,
    lines: [
      {
        lineNumber: 1,
        conceptDescription: "Gastos varios - Los Delfines",
        netAmount: 1000,
        taxRate: 22,
        taxAmount: 220,
        totalAmount: 1220,
      },
    ],
    ...overrides,
  };
}

test("CFE de gasto con proveedor existente genera payload valido para Factura Proveedor", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs(),
  });

  assert.equal(result.status, "dry_run_ready");
  assert.equal(result.blockers.length, 0);

  const movimiento = result.payload.Data.Movimiento[0];
  assert.equal(movimiento.CodigoProveedor, "PR0031");
  assert.notEqual(movimiento.CodigoProveedor, "21.999.888.777");
  assert.equal(movimiento.Serie, "A");
  assert.equal(movimiento.Numero, 123456);
  assert.equal(movimiento.CodigoComprobante, 11);
  assert.equal(movimiento.CodigoCondicionPago, "CR");
  assert.equal(movimiento.Lineas[0].CodigoArticulo, "ALIMENTOS");
  assert.equal(movimiento.Lineas[0].CodigoIVA, 1);
  assert.equal(movimiento.Lineas[0].Cantidad, 1);
  assert.equal(movimiento.Lineas[0].PrecioUnitario, 1000);
});

test("Documento con varias tasas genera lineas agrupadas por concepto e IVA", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({
      netAmount: 1500,
      taxAmount: 270,
      totalAmount: 1770,
      lines: [
        { lineNumber: 1, conceptDescription: "Basico", netAmount: 1000, taxRate: 22, taxAmount: 220, totalAmount: 1220 },
        { lineNumber: 2, conceptDescription: "Minimo", netAmount: 500, taxRate: 10, taxAmount: 50, totalAmount: 550 },
      ],
    }),
    catalogs: catalogs(),
  });

  assert.equal(result.blockers.length, 0);
  assert.equal(result.payload.Data.Movimiento[0].Lineas.length, 2);
  assert.deepEqual(result.payload.Data.Movimiento[0].Lineas.map((line) => line.CodigoIVA), [1, 2]);
});

test("Compra clasificada como mercaderia queda bloqueada en este PR", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({
      postingTemplateCode: "purchase_inventory_credit.v1",
      operationCategory: "goods_resale",
    }),
    catalogs: catalogs(),
  });

  assert.equal(result.exportable, false);
  assert.equal(result.preview.purchaseKind, "merchandise");
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_merchandise_not_supported"));
});

test("Falta proveedor o concepto bloquea exportacion", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const missingSupplier = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ supplierRut: "21.000.000.001", supplierName: "Proveedor Nuevo" }),
    catalogs: catalogs(),
  });
  const missingConcept = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ lines: [{ netAmount: 1000, taxRate: 22, taxAmount: 220, totalAmount: 1220 }] }),
    catalogs: catalogs({
      concepts: [],
      config: {
        ...catalogs().config,
        concepts: {},
      },
    }),
  });

  assert.ok(missingSupplier.blockers.some((entry) => entry.code === "zeta_supplier_missing"));
  assert.ok(missingConcept.blockers.some((entry) => entry.code === "zeta_concept_missing"));
});

test("Numero no confiable bloquea exportacion", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ fiscalIdentityTrusted: false }),
    catalogs: catalogs(),
  });

  assert.ok(result.blockers.some((entry) => entry.code === "zeta_invoice_identity_untrusted"));
});

