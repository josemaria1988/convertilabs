import { roundCurrency } from "@/modules/accounting";
import {
  asArray,
  asCurrency,
  asNumber,
  asRecord,
  asString,
  buildCanonicalPayloadHash,
  compactMetadata,
  firstNumber,
  firstString,
  normalizeCounterpartyName,
  normalizeCounterpartyTaxId,
  normalizeIdentityPart,
  normalizeZetaCurrency,
  parseZetaDate,
  signedAmount,
  type JsonRecord,
  type ZetaCanonicalDocument,
  type ZetaCanonicalLineItem,
} from "@/modules/integrations/zeta/normalizers/common";

function normalizeSalesExternalKey(summary: JsonRecord) {
  const registroId = firstString(summary.RegistroId);

  if (registroId) {
    return `factura_cliente:${registroId}`;
  }

  return [
    "factura_cliente",
    firstString(summary.ComprobanteCodigo) ?? "comprobante",
    firstString(summary.Serie) ?? "sin-serie",
    firstString(summary.Numero) ?? "sin-numero",
    parseZetaDate(summary.Fecha) ?? "sin-fecha",
    firstString(summary.ClienteCodigo) ?? "sin-cliente",
    firstString(summary.LocalCodigo) ?? "sin-local",
  ].join(":");
}

function inferSalesDocumentType(summary: JsonRecord, total: number | null) {
  const label = [
    asString(summary.ComprobanteNombre),
    asString(summary.ComprobanteTipoNombre),
    asString(summary.TipoCFENombre),
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    label.includes("nota credito")
    || label.includes("nota de credito")
    || (typeof total === "number" && total < 0)
  ) {
    return "sale_credit_note";
  }

  return "sale_invoice";
}

function detailRowsFromPayload(detailPayload: unknown) {
  const response = asRecord(asRecord(detailPayload).Response);
  return asArray(response.VentasDetalladas).map(asRecord);
}

function lineSign(summary: JsonRecord, row: JsonRecord) {
  const explicitSign = asNumber(row.FacturaSigno);

  if (typeof explicitSign === "number" && explicitSign < 0) {
    return -1;
  }

  const total = signedAmount({
    signed: summary.TotalSigno,
    unsigned: summary.Total,
  });

  return typeof total === "number" && total < 0 ? -1 : 1;
}

function normalizeDetailLine(summary: JsonRecord, row: JsonRecord, index: number) {
  const sign = lineSign(summary, row);
  const net = asCurrency(row.LineaSubtotal);
  const tax = asCurrency(row.LineaIVA);
  const total = asCurrency(row.LineaTotal);

  return {
    lineNumber: index + 1,
    conceptCode: firstString(row.ArticuloCodigo, row.ConceptoCodigo),
    description: firstString(
      row.LineaConcepto,
      row.ArticuloNombre,
      row.ConceptoNombre,
      summary.Notas,
      summary.ComprobanteNombre,
    ),
    quantity: firstNumber(row.LineaCantidad),
    unitAmount: asCurrency(row.LineaPrecio),
    netAmount: typeof net === "number" ? roundCurrency(net * sign) : null,
    taxRate: firstNumber(row.IVATasa),
    taxAmount: typeof tax === "number" ? roundCurrency(tax * sign) : null,
    totalAmount: typeof total === "number" ? roundCurrency(total * sign) : null,
    metadata: compactMetadata({
      zeta_iva_codigo: firstString(row.IVACodigo),
      zeta_iva_nombre: firstString(row.IVANombre),
      zeta_articulo_codigo: firstString(row.ArticuloCodigo),
      zeta_concepto_codigo: firstString(row.ConceptoCodigo),
    }),
  } satisfies ZetaCanonicalLineItem;
}

function fallbackSummaryLine(summary: JsonRecord) {
  return {
    lineNumber: 1,
    conceptCode: firstString(summary.ComprobanteCodigo),
    description: firstString(summary.Notas, summary.ComprobanteNombre, "Venta Zetasoftware"),
    quantity: 1,
    unitAmount: signedAmount({
      signed: summary.SubtotalSigno,
      unsigned: summary.Subtotal,
    }),
    netAmount: signedAmount({
      signed: summary.SubtotalSigno,
      unsigned: summary.Subtotal,
    }),
    taxRate: null,
    taxAmount: signedAmount({
      signed: summary.IVASigno,
      unsigned: summary.IVA,
    }),
    totalAmount: signedAmount({
      signed: summary.TotalSigno,
      unsigned: summary.Total,
    }),
    metadata: {
      source: "query_ventas_summary_fallback",
    },
  } satisfies ZetaCanonicalLineItem;
}

export function normalizeZetaSalesInvoice(input: {
  summary: JsonRecord;
  detailPayload?: unknown;
  pdfUrl?: string | null;
}) {
  const summary = input.summary;
  const detailRows = detailRowsFromPayload(input.detailPayload);
  const firstDetail = detailRows[0] ?? {};
  const issueDate = parseZetaDate(firstString(firstDetail.FacturaFecha, summary.Fecha));
  const dueDate = null;
  const currencyCode = normalizeZetaCurrency({
    code: firstString(firstDetail.MonedaCodigo, summary.MonedaCodigo),
    symbol: firstString(firstDetail.MonedaSimbolo, summary.MonedaSimbolo),
  });
  const sourceRate = firstNumber(firstDetail.Cotizacion, summary.CotizacionEspecial);
  const net = signedAmount({
    signed: summary.SubtotalSigno,
    unsigned: summary.Subtotal,
    sign: firstDetail.FacturaSigno,
  });
  const tax = signedAmount({
    signed: summary.IVASigno,
    unsigned: summary.IVA,
    sign: firstDetail.FacturaSigno,
  });
  const total = signedAmount({
    signed: summary.TotalSigno,
    unsigned: summary.Total,
    sign: firstDetail.FacturaSigno,
  });
  const lines = detailRows.length > 0
    ? detailRows.map((row, index) => normalizeDetailLine(summary, row, index))
    : [fallbackSummaryLine(summary)];
  const externalKey = normalizeSalesExternalKey(summary);
  const series = firstString(firstDetail.FacturaSerie, summary.Serie);
  const number = firstString(firstDetail.FacturaNumero, summary.Numero);
  const humanKey = [series, number].filter(Boolean).join("-") || externalKey;
  const raw = compactMetadata({
    summary,
    detail: input.detailPayload ?? null,
  });
  const warnings = [
    ...(detailRows.length === 0
      ? ["Zeta no devolvio detalle de lineas para esta venta; se creo una linea resumen."]
      : []),
    ...(!currencyCode ? ["No pudimos mapear la moneda Zeta a ISO para esta venta."] : []),
    ...(currencyCode && currencyCode !== "UYU" && (!sourceRate || sourceRate <= 0)
      ? ["La venta viene en moneda extranjera sin cotizacion fuente confiable."]
      : []),
    ...(!issueDate ? ["La venta no trae fecha de comprobante interpretable."] : []),
  ];

  return {
    provider: "zetasoftware",
    sourceKind: "zeta_sales",
    stream: "zeta.documents.sales",
    entityType: "sales_invoice",
    externalKey,
    humanKey,
    payloadHash: buildCanonicalPayloadHash(raw),
    documentRole: "sale",
    documentType: inferSalesDocumentType(summary, total),
    issueDate,
    dueDate,
    series,
    number,
    reference: firstString(firstDetail.FacturaReferencia, summary.Referencia),
    localCode: firstString(firstDetail.LocalCodigo, summary.LocalCodigo),
    costCenterExternalCode: firstString(firstDetail.CentroCostosCodigo, summary.CentroCostosCodigo),
    operationCode: firstString(firstDetail.FacturaReferencia, summary.Referencia),
    counterparty: {
      role: "customer",
      externalCode: firstString(firstDetail.ClienteCodigo, summary.ClienteCodigo),
      name: normalizeCounterpartyName(firstString(firstDetail.ClienteNombre, summary.ClienteNombre)),
      legalName: normalizeCounterpartyName(firstString(firstDetail.ClienteRazonSocial, summary.ClienteRazonSocial)),
      taxId: null,
      taxIdNormalized: normalizeCounterpartyTaxId(null),
    },
    currency: {
      currencyCode,
      zetaCurrencyCode: firstString(firstDetail.MonedaCodigo, summary.MonedaCodigo),
      sourceRate: sourceRate ?? null,
      sourceRateDate: issueDate,
      sourceRateKind: sourceRate ? "zeta_cotizacion_especial" : null,
      fxStatus: currencyCode === "UYU"
        ? "same_currency"
        : sourceRate && sourceRate > 0
          ? "source_rate_ok"
          : "missing_rate_blocked",
    },
    amounts: {
      net,
      tax,
      total,
    },
    cfe: {
      typeCode: firstString(summary.TipodeCFECodigo),
      state: firstString(summary.Emitido),
      dgiState: null,
      receiverState: null,
    },
    lines,
    warnings,
    sourcePdfUrl: input.pdfUrl ?? null,
    raw,
  } satisfies ZetaCanonicalDocument;
}

export function buildZetaSalesInvoiceIdentityKey(input: ZetaCanonicalDocument, issuerTaxId: string | null) {
  return [
    "sale",
    normalizeCounterpartyTaxId(issuerTaxId) ?? "org",
    normalizeIdentityPart(input.series),
    normalizeIdentityPart(input.number),
    input.amounts.total ?? "no-total",
    input.currency.currencyCode ?? "no-currency",
  ].join("|");
}
