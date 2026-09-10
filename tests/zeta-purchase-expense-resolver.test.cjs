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
    supplierCommercialData: [{ Codigo: "PR0031", Nombre: "Los Delfines", IVA: "N" }],
    documentTypes: [
      { Codigo: 11, Nombre: "Compra gasto credito", ComprobanteGastos: "S", Activo: "S", IVA: "N" },
      { Codigo: 12, Nombre: "Compra gasto contado", ComprobanteGastos: "S", Activo: "S", IVA: "N" },
      { Codigo: 13, Nombre: "Nota credito proveedor gasto", ComprobanteGastos: "S", Activo: "S", IVA: "N" },
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
      { Codigo: "C30", Nombre: "Credito 30 dias", Activo: "S" },
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
    businessLocations: [{ Codigo: 1, Nombre: "Casa central", Activo: "S" }],
    users: [{ Codigo: 42, Nombre: "Usuario API", UsuarioEmail: "api@example.com" }],
    cashboxes: [{ Codigo: 1, Nombre: "Caja principal", LocalCodigo: 1, LocalActivo: "S" }],
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
  assert.equal(movimiento.Fecha, "20260420");
  assert.equal(result.preview.fecha, "2026-04-20");
  assert.equal(movimiento.CodigoComprobante, 11);
  assert.equal(movimiento.CodigoCondicionPago, "CR");
  assert.equal(movimiento.CodigoCaja, 1);
  assert.equal(movimiento.Lineas[0].CodigoArticulo, "ALIMENTOS");
  assert.equal(movimiento.Lineas[0].CodigoIVA, 1);
  assert.equal(movimiento.Lineas[0].CodigoLocalLinea, 1);
  assert.equal(movimiento.Lineas[0].Cantidad, 1);
  assert.equal(movimiento.Lineas[0].PrecioUnitario, 1000);
});

for (const supplierMode of ["S", "M", " m "]) {
  test(`IVA positivo y proveedor ${supplierMode} bloquean precio incluido sin alterar importes revisados`, () => {
    const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
    const data = catalogs({ supplierCommercialData: [{ Codigo: "PR0031", IVA: supplierMode }] });
    data.documentTypes[0].IVA = "N";
    const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(), catalogs: data });

    assert.equal(result.exportable, false);
    assert.equal(result.payload, null);
    assert.ok(result.blockers.some((entry) => entry.code === "zeta_purchase_price_vat_included_unverified"));
    assert.deepEqual(result.preview.lines.map((line) => [line.netAmount, line.ivaAmount, line.totalAmount]), [[1000, 220, 1220]]);
  });
}

for (const supplierMode of ["N", "O"]) {
  test(`Proveedor ${supplierMode} y comprobante sin IVA incluido conservan precio neto`, () => {
    const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
    const data = catalogs({ supplierCommercialData: [{ Codigo: "PR0031", IVA: supplierMode }] });
    data.documentTypes[0].IVA = "N";
    const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(), catalogs: data });

    assert.equal(result.exportable, true);
    assert.equal(result.payload.Data.Movimiento[0].Lineas[0].PrecioUnitario, 1000);
    assert.equal(result.preview.lines[0].ivaAmount, 220);
    assert.equal(result.preview.lines[0].totalAmount, 1220);
  });
}

for (const documentMode of ["S", "M"]) {
  test(`Comprobante ${documentMode} y proveedor N no inventan precedencia de precio con IVA`, () => {
    const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
    const data = catalogs({ supplierCommercialData: [{ Codigo: "PR0031", IVA: "N" }] });
    data.documentTypes[0].IVA = documentMode;
    const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(), catalogs: data });

    assert.equal(result.exportable, false);
    assert.equal(result.payload, null);
    assert.ok(result.blockers.some((entry) => entry.code === "zeta_purchase_price_vat_included_unverified"));
  });
}

for (const exemptSource of ["supplier", "document"]) {
  test(`IVA positivo incompatible con ${exemptSource} exento queda bloqueado`, () => {
    const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
    const data = catalogs({ supplierCommercialData: [{ Codigo: "PR0031", IVA: exemptSource === "supplier" ? "E" : "N" }] });
    data.documentTypes[0].IVA = exemptSource === "document" ? "E" : "N";
    const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(), catalogs: data });

    assert.equal(result.exportable, false);
    assert.ok(result.blockers.some((entry) => entry.code === "zeta_purchase_vat_exempt_conflict"));
    assert.equal(result.preview.lines[0].ivaAmount, 220);
  });
}

for (const supplierMode of ["S", "M", "N", "O", "E"]) {
  test(`IVA cero con proveedor ${supplierMode} conserva el camino sin diferencia entre neto y total`, () => {
    const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
    const data = catalogs({ supplierCommercialData: [{ Codigo: "PR0031", IVA: supplierMode }] });
    data.documentTypes[0].IVA = "S";
    const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
      document: document({ taxAmount: 0, totalAmount: 1000, lines: [{ lineNumber: 1, netAmount: 1000, taxRate: 0, taxAmount: 0, totalAmount: 1000 }] }),
      catalogs: data,
    });

    assert.equal(result.exportable, true);
    assert.equal(result.payload.Data.Movimiento[0].Lineas[0].PrecioUnitario, 1000);
    assert.deepEqual(result.preview.lines.map((line) => [line.netAmount, line.ivaAmount, line.totalAmount]), [[1000, 0, 1000]]);
  });
}

test("El modo IVA incluido de otro proveedor no bloquea la factura revisada", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({ supplierCommercialData: [{ Codigo: "OTHER", IVA: "M" }, { Codigo: "PR0031", IVA: "N" }] }),
  });
  assert.equal(result.exportable, true);
});

for (const [label, supplierRows, documentMode] of [
  ["proveedor sin indicador", [{ Codigo: "PR0031" }], "N"],
  ["comprobante sin indicador", [{ Codigo: "PR0031", IVA: "N" }], undefined],
  ["ambos indicadores ausentes", [{ Codigo: "PR0031" }], undefined],
  ["proveedor con indicador desconocido", [{ Codigo: "PR0031", IVA: "X" }], "N"],
  ["comprobante con indicador desconocido", [{ Codigo: "PR0031", IVA: "N" }], "X"],
  ["proveedor con filas contradictorias", [{ Codigo: "PR0031", IVA: "N" }, { Codigo: "PR0031", IVA: "O" }], "N"],
  ["proveedor con fila adicional incompleta", [{ Codigo: "PR0031", IVA: "N" }, { Codigo: "PR0031" }], "N"],
]) {
  test(`Precio gravado bloqueado si hay ${label}`, () => {
    const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
    const data = catalogs({ supplierCommercialData: supplierRows });
    data.documentTypes[0].IVA = documentMode;
    const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(), catalogs: data });
    assert.equal(result.exportable, false);
    assert.equal(result.payload, null);
    assert.ok(result.blockers.some((entry) => entry.code === "zeta_purchase_price_vat_basis_unknown"));
    assert.deepEqual(result.preview.lines.map((line) => [line.netAmount, line.ivaAmount, line.totalAmount]), [[1000, 220, 1220]]);
  });
}

test("Filas comerciales coincidentes confirman el modo sin IVA incluido", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(), catalogs: catalogs({
    supplierCommercialData: [{ Codigo: "PR0031", IVA: "N" }, { Codigo: "PR0031", IVA: " n " }],
  }) });
  assert.equal(result.exportable, true);
});

test("IVA cero no requiere resolver indicadores de precio ausentes", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const data = catalogs({ supplierCommercialData: [{ Codigo: "PR0031" }] });
  delete data.documentTypes[0].IVA;
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ taxAmount: 0, totalAmount: 1000, lines: [{ lineNumber: 1, netAmount: 1000, taxRate: 0, taxAmount: 0, totalAmount: 1000 }] }),
    catalogs: data,
  });
  assert.equal(result.exportable, true);
  assert.equal(result.payload.Data.Movimiento[0].Lineas[0].PrecioUnitario, 1000);
});

test("condicion de credito exacta confirmada en el documento gana al default", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ zetaPaymentTermCodeOverride: "C30" }),
    catalogs: catalogs(),
  });

  assert.equal(result.blockers.length, 0);
  assert.equal(result.payload.Data.Movimiento[0].CodigoCondicionPago, "C30");
});

test("condicion contado no puede combinarse con comprobante de credito", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ zetaPaymentTermCodeOverride: "CO" }),
    catalogs: catalogs(),
  });

  assert.equal(result.exportable, false);
  assert.equal(
    result.blockers.some((entry) => entry.code === "zeta_payment_term_incompatible"),
    true,
  );
});

test("condicion credito no puede combinarse con comprobante contado", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({
      paymentTerms: "cash",
      settlementMethod: "cash",
      postingTemplateCode: "purchase_expense_cash.v1",
      zetaPaymentTermCodeOverride: "CR",
    }),
    catalogs: catalogs(),
  });

  assert.equal(result.exportable, false);
  assert.equal(
    result.blockers.some((entry) => entry.code === "zeta_payment_term_incompatible"),
    true,
  );
});

test("condicion de pago documental inexistente bloquea sin fallback", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ zetaPaymentTermCodeOverride: "NO-EXISTE" }),
    catalogs: catalogs(),
  });

  assert.equal(result.exportable, false);
  assert.equal(
    result.blockers.some((entry) => entry.code === "zeta_payment_term_not_found"),
    true,
  );
});

test("RUT con varios proveedores Zeta bloquea sin seleccionar el primero", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({
      suppliers: [
        {
          Codigo: "PR0031",
          Nombre: "Los Delfines",
          RUT: "21.999.888.777",
          EsProveedor: "S",
          ContactoActivo: "S",
        },
        {
          Codigo: "PR0099",
          Nombre: "Los Delfines alternativo",
          RUT: "21999888777",
          EsProveedor: "S",
          ContactoActivo: "S",
        },
      ],
      supplierCommercialData: [{ Codigo: "PR0031" }, { Codigo: "PR0099" }],
    }),
  });

  assert.equal(result.exportable, false);
  assert.equal(result.payload, null);
  assert.equal(result.preview.zetaSupplierCode, null);
  const blocker = result.blockers.find((entry) => entry.code === "supplier_ambiguous");
  assert.ok(blocker);
  assert.equal(blocker.field, "supplier");
  assert.match(blocker.message, /RUT/);
  assert.match(blocker.message, /PR0031/);
  assert.match(blocker.message, /PR0099/);
});

test("Nombre con varios proveedores Zeta bloquea sin seleccionar el primero", () => {
  const {
    resolveZetaSupplier,
  } = require("@/modules/integrations/zeta/export/resolve-zeta-supplier");
  const result = resolveZetaSupplier({
    supplierRut: null,
    supplierName: "Proveedor Duplicado",
    contacts: [
      {
        Codigo: "PR0100",
        Nombre: "Proveedor Duplicado",
        EsProveedor: "S",
        ContactoActivo: "S",
      },
      {
        Codigo: "PR0101",
        RazonSocial: " proveedor duplicado ",
        EsProveedor: "S",
        ContactoActivo: "S",
      },
    ],
    supplierCommercialData: [{ Codigo: "PR0100" }, { Codigo: "PR0101" }],
  });

  assert.equal(result.found, false);
  assert.equal(result.zetaSupplierCode, null);
  assert.equal(result.zetaSupplierName, null);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].code, "supplier_ambiguous");
  assert.match(result.blockers[0].message, /nombre/);
});

test("RUT informado sin coincidencia no hace fallback a un proveedor del mismo nombre", () => {
  const {
    resolveZetaSupplier,
  } = require("@/modules/integrations/zeta/export/resolve-zeta-supplier");
  const result = resolveZetaSupplier({
    supplierRut: "21.111.111.111",
    supplierName: "Los Delfines",
    contacts: [{
      Codigo: "PR0031",
      Nombre: "Los Delfines",
      RUT: "21.999.888.777",
      EsProveedor: "S",
      ContactoActivo: "S",
    }],
    supplierCommercialData: [{ Codigo: "PR0031" }],
  });

  assert.equal(result.found, false);
  assert.equal(result.zetaSupplierCode, null);
  assert.equal(result.blockers[0].code, "zeta_supplier_missing");
  assert.match(result.blockers[0].message, /21\.111\.111\.111/);
});

test("Filas repetidas del mismo codigo Zeta no generan falsa ambiguedad", () => {
  const {
    resolveZetaSupplier,
  } = require("@/modules/integrations/zeta/export/resolve-zeta-supplier");
  const result = resolveZetaSupplier({
    supplierRut: "21.999.888.777",
    supplierName: "Los Delfines",
    contacts: [
      {
        Codigo: "PR0031",
        Nombre: "Los Delfines",
        RUT: "21.999.888.777",
        EsProveedor: "S",
        ContactoActivo: "S",
      },
      {
        Codigo: "pr0031",
        RazonSocial: "Los Delfines SA",
        RUT: "21999888777",
        EsProveedor: "S",
        ContactoActivo: "S",
      },
    ],
    supplierCommercialData: [{ Codigo: "PR0031" }],
  });

  assert.equal(result.found, true);
  assert.equal(result.zetaSupplierCode, "PR0031");
  assert.deepEqual(result.blockers, []);
});

test("concepto confirmado en el documento gana al proveedor y al default", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({
      zetaConceptCodeOverride: "GASTOSVAR",
      netAmount: 1500,
      taxAmount: 270,
      totalAmount: 1770,
      lines: [
        { conceptDescription: "Basico", netAmount: 1000, taxRate: 22, taxAmount: 220, totalAmount: 1220 },
        { conceptDescription: "Minimo", netAmount: 500, taxRate: 10, taxAmount: 50, totalAmount: 550 },
      ],
    }),
    catalogs: catalogs(),
  });

  assert.equal(result.blockers.length, 0);
  assert.deepEqual(
    result.payload.Data.Movimiento[0].Lineas.map((line) => line.CodigoArticulo),
    ["GASTOSVAR", "GASTOSVAR"],
  );
});

test("concepto documental inexistente bloquea sin fallback silencioso", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ zetaConceptCodeOverride: "NO-EXISTE" }),
    catalogs: catalogs(),
  });

  assert.equal(result.exportable, false);
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_selected_concept_invalid"));
  assert.equal(result.payload, null);
});

test("Export de compra incluye work_unit como CodigoCentroCosto cuando existe mapping", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({
      workUnitId: "work-1",
      workUnitCode: "NP-2026-001",
      workUnitName: "Trabajo Nueva Palmira",
      workUnitExternalCode: "NP01",
    }),
    catalogs: catalogs(),
  });

  assert.equal(result.blockers.length, 0);
  assert.equal(result.preview.workUnitName, "Trabajo Nueva Palmira");
  assert.equal(result.preview.centroCostoCode, "NP01");
  assert.equal(result.payload.Data.Movimiento[0].CodigoCentroCosto, "NP01");
});

test("proyecto local sin mapping conserva nombre y omite centro Zeta sin bloquear", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ workUnitId: "work-local", workUnitCode: "NP-LOCAL", workUnitName: "Servicio NP" }),
    catalogs: catalogs(),
  });
  assert.equal(result.exportable, true);
  assert.equal(result.preview.workUnitName, "Servicio NP");
  assert.equal(result.preview.centroCostoCode, null);
  assert.equal(Object.hasOwn(result.payload.Data.Movimiento[0], "CodigoCentroCosto"), false);
});

test("identidad de envio no cambia con fecha importe moneda o tipo de comprobante", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const resolve = (changes) => resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document(changes), catalogs: catalogs() });
  const original = resolve({});
  for (const changes of [
    { issueDate: "2026-04-21" },
    { currencyCode: "USD", exchangeRate: 40 },
    { totalAmount: 2440, netAmount: 2000, taxAmount: 440, lines: [{ netAmount: 2000, taxRate: 22, taxAmount: 440, totalAmount: 2440 }] },
    { cfeTypeCode: 112 },
    { paymentTerms: "cash", settlementMethod: "cash" },
    { number: "000123456", series: " a " },
  ]) {
    const changed = resolve(changes);
    assert.equal(changed.exportable, true);
    assert.deepEqual(changed.fiscalIdentity, original.fiscalIdentity);
  }
  assert.notEqual(resolve({ issueDate: "2026-04-21" }).fiscalFingerprint, original.fiscalFingerprint);
  assert.notEqual(resolve({ number: "123457" }).fiscalIdentity.key, original.fiscalIdentity.key);
});

test("identidad preserva codigo opaco del proveedor y rechaza numero inseguro", () => {
  const { buildPurchaseExpenseFiscalIdentity } = require("@/modules/integrations/zeta/export/purchase-expense-resolver");
  const identity = (supplierCode, number = "0001") => buildPurchaseExpenseFiscalIdentity({ supplierCode, series: "A", number });
  assert.notEqual(identity("000104").key, identity("104").key);
  assert.equal(identity("000104").number, "1");
  assert.equal(identity("000104", Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(identity("000104", "1.5"), null);
});

test("tarjeta general 10 no requiere banco numero o marca para compra contado", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const configured = catalogs();
  configured.paymentMethods.push({ Codigo: 10, Nombre: "Tarjeta Emitida", Tipo: "TC", Activo: "S" });
  configured.config.paymentMethods.card = 10;
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ paymentTerms: "cash", settlementMethod: "card" }), catalogs: configured,
  });
  assert.equal(result.exportable, true);
  assert.deepEqual(result.payload.Data.Movimiento[0].FormasPago, [{
    CodigoFormaPago: 10, CodigoMonedaPago: 1, MontoMonedaPago: 1220, MontoMonedaMovimiento: 1220,
  }]);
});

test("grupo de varios articulos de gasto describe el concepto y no solo el primer articulo", () => {
  const { resolveZetaPurchaseExpenseInvoiceFromInputs } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({ document: document({
    netAmount: 1500, taxAmount: 330, totalAmount: 1830,
    lines: [
      { conceptDescription: "Refresco", netAmount: 1000, taxRate: 22, taxAmount: 220, totalAmount: 1220 },
      { conceptDescription: "Comida", netAmount: 500, taxRate: 22, taxAmount: 110, totalAmount: 610 },
    ],
  }), catalogs: catalogs() });
  assert.equal(result.exportable, true);
  assert.equal(result.payload.Data.Movimiento[0].Lineas.length, 1);
  assert.equal(result.payload.Data.Movimiento[0].Lineas[0].Concepto, "Alimentos");
  assert.equal(result.preview.lines[0].totalAmount, 1830);
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

test("Credito exige una caja default valida y sincronizada", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const base = catalogs();
  const withoutConfiguredCashbox = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({
      config: {
        ...base.config,
        defaults: {
          localCode: 1,
          userCode: 42,
        },
      },
    }),
  });
  const withoutSyncedCashbox = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({ cashboxes: [] }),
  });

  assert.equal(withoutConfiguredCashbox.exportable, false);
  assert.ok(withoutConfiguredCashbox.blockers.some((entry) => entry.code === "zeta_cashbox_required"));
  assert.equal(withoutSyncedCashbox.exportable, false);
  assert.ok(withoutSyncedCashbox.blockers.some((entry) => entry.code === "zeta_cashbox_not_found"));
});

test("Caja debe pertenecer al local default configurado", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({
      cashboxes: [{ Codigo: 1, Nombre: "Caja otro local", LocalCodigo: 2, LocalActivo: "S" }],
    }),
  });

  assert.equal(result.exportable, false);
  assert.ok(result.blockers.some((entry) => entry.code === "zeta_cashbox_local_mismatch"));
});

test("Local y usuario operativos deben estar configurados y sincronizados", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const base = catalogs();
  const missingLocal = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({
      config: {
        ...base.config,
        defaults: {
          ...base.config.defaults,
          localCode: undefined,
        },
      },
    }),
  });
  const unsyncedUser = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document(),
    catalogs: catalogs({ users: [] }),
  });

  assert.equal(missingLocal.exportable, false);
  assert.ok(missingLocal.blockers.some((entry) => entry.code === "zeta_local_required"));
  assert.equal(unsyncedUser.exportable, false);
  assert.ok(unsyncedUser.blockers.some((entry) => entry.code === "zeta_user_not_found"));
});

test("Fecha invalida queda bloqueada y Fecha valida usa AAAAMMDD", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const invalid = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ issueDate: "2026-02-30" }),
    catalogs: catalogs(),
  });
  const alreadyCompact = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({ issueDate: "20260420" }),
    catalogs: catalogs(),
  });

  assert.equal(invalid.exportable, false);
  assert.ok(invalid.blockers.some((entry) => entry.code === "zeta_issue_date_invalid"));
  assert.equal(alreadyCompact.payload.Data.Movimiento[0].Fecha, "20260420");
});

test("Notas de cabecera y Concepto respetan limites oficiales sin perder fingerprint interno", () => {
  const {
    resolveZetaPurchaseExpenseInvoiceFromInputs,
  } = require("@/modules/integrations/zeta/export/export-purchase-expense-invoice");
  const result = resolveZetaPurchaseExpenseInvoiceFromInputs({
    document: document({
      documentId: "12345678-abcd-4321-9999-123456789012",
      sourceReference: "Convertilabs document 12345678-abcd-4321-9999-123456789012",
      lines: [{
        lineNumber: 1,
        conceptDescription: "Descripcion de gasto extremadamente larga que supera claramente cincuenta caracteres",
        netAmount: 1000,
        taxRate: 22,
        taxAmount: 220,
        totalAmount: 1220,
      }],
    }),
    catalogs: catalogs(),
  });

  const movimiento = result.payload.Data.Movimiento[0];
  assert.equal(movimiento.Notas, "Convertilabs 12345678");
  assert.ok(movimiento.Notas.length <= 30);
  assert.equal(movimiento.Lineas[0].Concepto.length, 50);
  assert.match(result.fiscalFingerprint, /^sha256:[a-f0-9]{64}$/);
});

