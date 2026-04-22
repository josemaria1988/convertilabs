/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

test("Zeta sales normalizer maps Facturas de Clientes into canonical VAT-ready facts", () => {
  const {
    normalizeZetaSalesInvoice,
    buildZetaSalesInvoiceIdentityKey,
  } = require("@/modules/integrations/zeta/normalizers/sales");
  const normalized = normalizeZetaSalesInvoice({
    summary: {
      RegistroId: 987,
      Fecha: "15/03/2026",
      ComprobanteCodigo: "FAC",
      ComprobanteNombre: "Factura contado",
      Serie: "A",
      Numero: 1234,
      ClienteCodigo: "CLI-10",
      ClienteNombre: "Cliente Uno",
      ClienteRazonSocial: "Cliente Uno SA",
      MonedaSimbolo: "$",
      CotizacionEspecial: 1,
      LocalCodigo: "01",
      CentroCostosCodigo: "OBRA-7",
      Referencia: "MARZO",
      Subtotal: 1000,
      IVA: 220,
      Total: 1220,
      TipodeCFECodigo: 111,
      Emitido: "S",
    },
    detailPayload: {
      Response: {
        VentasDetalladas: [
          {
            FacturaFecha: "2026-03-15T00:00:00",
            FacturaSerie: "A",
            FacturaNumero: 1234,
            MonedaSimbolo: "$",
            Cotizacion: 1,
            FacturaSigno: 1,
            ClienteCodigo: "CLI-10",
            ClienteNombre: "Cliente Uno",
            ArticuloCodigo: "SERV-1",
            LineaConcepto: "Servicio mensual",
            LineaCantidad: 1,
            LineaPrecio: 1000,
            LineaSubtotal: 1000,
            LineaIVA: 220,
            LineaTotal: 1220,
            IVATasa: 22,
          },
        ],
      },
    },
  });

  assert.equal(normalized.sourceKind, "zeta_sales");
  assert.equal(normalized.stream, "zeta.documents.sales");
  assert.equal(normalized.externalKey, "factura_cliente:987");
  assert.equal(normalized.documentRole, "sale");
  assert.equal(normalized.documentType, "sale_invoice");
  assert.equal(normalized.issueDate, "2026-03-15");
  assert.equal(normalized.currency.currencyCode, "UYU");
  assert.equal(normalized.amounts.total, 1220);
  assert.equal(normalized.taxBreakdown.length, 1);
  assert.equal(normalized.taxBreakdown[0].label, "IVA basico 22%");
  assert.equal(normalized.taxBreakdown[0].taxAmount, 220);
  assert.equal(normalized.lines.length, 1);
  assert.equal(normalized.lines[0].taxRate, 22);
  assert.equal(normalized.warnings.length, 0);
  assert.equal(
    buildZetaSalesInvoiceIdentityKey(normalized, "21.433.455.019"),
    "sale|21433455019|a|1234|1220|UYU",
  );
});

test("Zeta received CFE normalizer maps purchases with fiscal credit totals", () => {
  const {
    normalizeZetaReceivedCfe,
    buildZetaReceivedCfeIdentityKey,
  } = require("@/modules/integrations/zeta/normalizers/received-cfe");
  const normalized = normalizeZetaReceivedCfe({
    summary: {
      RUT: "21.999.888.777",
      DenominacionSocial: "Proveedor SA",
      EmisorCFETipo: 111,
      Serie: "B",
      Numero: 456,
      FechaEmision: "2026-03-20",
      FechaVencimiento: "2026-04-20",
      Moneda: "UYU",
      TipoCambio: 1,
      MontoAPagar: 610,
      EstadoLocal: "RECIBIDO",
      EstadoDGI: "ACEPTADO",
      EstadoReceptor: "ACEPTADO",
    },
    detailPayload: {
      Response: {
        CFEDetalle: {
          Emisor: {
            RUT: "21.999.888.777",
            DenominacionSocial: "Proveedor SA",
          },
          Documento: {
            FechaEmision: "20/03/2026",
            FechaVencimiento: "20/04/2026",
            CFESerie: "B",
            CFENumero: 456,
          },
          Totales: {
            Moneda: "UYU",
            TipoCambio: 1,
            MontoNetoConIVATasaBasica: 500,
            MontoIVABasico: 110,
            MontoCreditosFiscales: 110,
            MontoAPagar: 610,
          },
          Detalle: [
            {
              NumeroDeLinea: 1,
              ItemCodigo: "GASTO-1",
              Nombre: "Gasto gravado",
              Cantidad: 1,
              PrecioUnitario: 500,
              MontoTotal: 500,
            },
          ],
        },
      },
    },
  });

  assert.equal(normalized.sourceKind, "zeta_received_cfe");
  assert.equal(normalized.stream, "zeta.documents.received_cfes");
  assert.equal(normalized.externalKey, "cfe_recibido:21.999.888.777:111:B:456");
  assert.equal(normalized.documentRole, "purchase");
  assert.equal(normalized.documentType, "purchase_invoice");
  assert.equal(normalized.issueDate, "2026-03-20");
  assert.equal(normalized.dueDate, "2026-04-20");
  assert.equal(normalized.counterparty.taxIdNormalized, "21999888777");
  assert.equal(normalized.currency.currencyCode, "UYU");
  assert.equal(normalized.amounts.net, 500);
  assert.equal(normalized.amounts.tax, 110);
  assert.equal(normalized.amounts.total, 610);
  assert.equal(normalized.taxBreakdown.length, 1);
  assert.equal(normalized.taxBreakdown[0].label, "IVA basico 22%");
  assert.equal(normalized.taxBreakdown[0].netAmount, 500);
  assert.equal(normalized.taxBreakdown[0].taxAmount, 110);
  assert.equal(normalized.lines.length, 1);
  assert.equal(normalized.warnings.length, 0);
  assert.equal(
    buildZetaReceivedCfeIdentityKey(normalized),
    "purchase|21999888777|111|b|456",
  );
});

test("Zeta received CFE normalizer preserves mixed VAT from CFE totals without recomputing", () => {
  const {
    normalizeZetaReceivedCfe,
  } = require("@/modules/integrations/zeta/normalizers/received-cfe");
  const normalized = normalizeZetaReceivedCfe({
    summary: {
      RUT: "21.111.222.333",
      DenominacionSocial: "Sergio Morin",
      EmisorCFETipo: 111,
      Serie: "M",
      Numero: 77,
      FechaEmision: "2026-04-10",
      Moneda: "UYU",
      TipoCambio: 1,
      MontoAPagar: 782,
    },
    detailPayload: {
      Response: {
        CFEDetalle: {
          Emisor: {
            RUT: "21.111.222.333",
            DenominacionSocial: "Sergio Morin",
          },
          Documento: {
            FechaEmision: "10/04/2026",
            CFESerie: "M",
            CFENumero: 77,
          },
          Totales: {
            Moneda: "UYU",
            TipoCambio: 1,
            MontoNetoConIVATasaMinima: 200,
            MontoIVAMinimo: 20,
            MontoNetoConIVATasaBasica: 400,
            MontoIVABasico: 88,
            MontoAPagar: 708,
          },
          Detalle: [],
        },
      },
    },
  });

  assert.equal(normalized.amounts.net, 600);
  assert.equal(normalized.amounts.tax, 108);
  assert.equal(normalized.amounts.total, 708);
  assert.deepEqual(
    normalized.taxBreakdown.map((entry) => ({
      label: entry.label,
      netAmount: entry.netAmount,
      taxRate: entry.taxRate,
      taxAmount: entry.taxAmount,
      totalAmount: entry.totalAmount,
    })),
    [
      {
        label: "IVA minimo 10%",
        netAmount: 200,
        taxRate: 10,
        taxAmount: 20,
        totalAmount: 220,
      },
      {
        label: "IVA basico 22%",
        netAmount: 400,
        taxRate: 22,
        taxAmount: 88,
        totalAmount: 488,
      },
    ],
  );
});

test("Zeta received CFE normalizer does not invent VAT when fiscal totals are missing", () => {
  const {
    normalizeZetaReceivedCfe,
  } = require("@/modules/integrations/zeta/normalizers/received-cfe");
  const normalized = normalizeZetaReceivedCfe({
    summary: {
      RUT: "21.444.555.666",
      DenominacionSocial: "Proveedor sin detalle",
      EmisorCFETipo: 111,
      Serie: "S",
      Numero: 9,
      FechaEmision: "2026-04-11",
      Moneda: "UYU",
      TipoCambio: 1,
      MontoAPagar: 1220,
    },
    detailPayload: {
      Response: {
        CFEDetalle: {
          Detalle: [],
        },
      },
    },
  });

  assert.equal(normalized.amounts.net, null);
  assert.equal(normalized.amounts.tax, null);
  assert.equal(normalized.amounts.total, 1220);
  assert.equal(normalized.taxBreakdown.length, 0);
  assert.ok(normalized.warnings.some((warning) => warning.includes("no se recalculo IVA")));
});
