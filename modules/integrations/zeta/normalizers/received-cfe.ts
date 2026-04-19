import { roundCurrency } from "@/modules/accounting";
import {
  asArray,
  asCurrency,
  asNumber,
  asRecord,
  buildCanonicalPayloadHash,
  compactMetadata,
  firstNumber,
  firstString,
  normalizeCounterpartyName,
  normalizeCounterpartyTaxId,
  normalizeIdentityPart,
  normalizeZetaCurrency,
  parseZetaDate,
  type JsonRecord,
  type ZetaCanonicalDocument,
  type ZetaCanonicalLineItem,
} from "@/modules/integrations/zeta/normalizers/common";

function normalizeCfeExternalKey(summary: JsonRecord) {
  return [
    "cfe_recibido",
    firstString(summary.RUT) ?? "sin-rut",
    firstString(summary.EmisorCFETipo, summary.CFETipo) ?? "sin-tipo",
    firstString(summary.Serie, summary.CFESerie) ?? "sin-serie",
    firstString(summary.Numero, summary.CFENumero) ?? "sin-numero",
  ].join(":");
}

function detailFromPayload(detailPayload: unknown) {
  return asRecord(asRecord(asRecord(detailPayload).Response).CFEDetalle);
}

function inferPurchaseDocumentType(summary: JsonRecord, total: number | null) {
  const label = [
    firstString(summary.EmisorCFETipo, summary.CFETipo),
    firstString(summary.TipoCFENombre),
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    label.includes("nota credito")
    || label.includes("nota de credito")
    || label.includes("102")
    || label.includes("112")
    || (typeof total === "number" && total < 0)
  ) {
    return "purchase_credit_note";
  }

  return "purchase_invoice";
}

function normalizeDetailLine(row: JsonRecord, index: number) {
  const quantity = firstNumber(row.Cantidad);
  const unitAmount = asCurrency(row.PrecioUnitario);
  const total = asCurrency(row.MontoTotal);

  return {
    lineNumber: asNumber(row.NumeroDeLinea) ?? index + 1,
    conceptCode: firstString(row.ItemCodigo),
    description: firstString(row.Nombre, row.Descripcion),
    quantity,
    unitAmount,
    netAmount: total,
    taxRate: null,
    taxAmount: null,
    totalAmount: total,
    metadata: compactMetadata({
      zeta_item_codigo: firstString(row.ItemCodigo),
      zeta_unidad_medida: firstString(row.UnidadMedida),
    }),
  } satisfies ZetaCanonicalLineItem;
}

function fallbackSummaryLine(total: number | null) {
  return {
    lineNumber: 1,
    conceptCode: null,
    description: "CFE recibido Zetasoftware",
    quantity: 1,
    unitAmount: total,
    netAmount: total,
    taxRate: null,
    taxAmount: null,
    totalAmount: total,
    metadata: {
      source: "cfe_recibido_summary_fallback",
    },
  } satisfies ZetaCanonicalLineItem;
}

export function normalizeZetaReceivedCfe(input: {
  summary: JsonRecord;
  detailPayload?: unknown;
}) {
  const summary = input.summary;
  const detail = detailFromPayload(input.detailPayload);
  const emisor = asRecord(detail.Emisor);
  const documento = asRecord(detail.Documento);
  const receptor = asRecord(detail.Receptor);
  const totales = asRecord(detail.Totales);
  const detalleRows = asArray(detail.Detalle).map(asRecord);
  const issueDate = parseZetaDate(firstString(documento.FechaEmision, summary.FechaEmision));
  const dueDate = parseZetaDate(firstString(documento.FechaVencimiento, summary.FechaVencimiento));
  const currencyCode = normalizeZetaCurrency({
    code: firstString(totales.Moneda, summary.Moneda),
    symbol: firstString(totales.Moneda, summary.Moneda),
    name: firstString(totales.Moneda, summary.Moneda),
  });
  const sourceRate = firstNumber(totales.TipoCambio, summary.TipoCambio);
  const tax = firstNumber(totales.MontoCreditosFiscales)
    ?? roundCurrency((firstNumber(totales.MontoIVAMinimo) ?? 0) + (firstNumber(totales.MontoIVABasico) ?? 0));
  const total = firstNumber(totales.MontoAPagar, totales.MontoTotal, summary.MontoAPagar);
  const net = roundCurrency(
    (firstNumber(totales.MontoNoGravado) ?? 0)
    + (firstNumber(totales.MontoExportado) ?? 0)
    + (firstNumber(totales.MontoNetoConIVATasaMinima) ?? 0)
    + (firstNumber(totales.MontoNetoConIVATasaBasica) ?? 0),
  );
  const lines = detalleRows.length > 0
    ? detalleRows.map(normalizeDetailLine)
    : [fallbackSummaryLine(total)];
  const externalKey = normalizeCfeExternalKey(summary);
  const series = firstString(documento.CFESerie, summary.Serie, summary.CFESerie);
  const number = firstString(documento.CFENumero, summary.Numero, summary.CFENumero);
  const humanKey = [series, number].filter(Boolean).join("-") || externalKey;
  const raw = compactMetadata({
    summary,
    detail: input.detailPayload ?? null,
  });
  const issuerTaxId = firstString(emisor.RUT, summary.RUT);
  const warnings = [
    ...(detalleRows.length === 0
      ? ["Zeta no devolvio detalle de lineas para este CFE recibido; se creo una linea resumen."]
      : []),
    ...(!currencyCode ? ["No pudimos mapear la moneda Zeta a ISO para este CFE recibido."] : []),
    ...(currencyCode && currencyCode !== "UYU" && (!sourceRate || sourceRate <= 0)
      ? ["El CFE recibido viene en moneda extranjera sin cotizacion fuente confiable."]
      : []),
    ...(!issueDate ? ["El CFE recibido no trae fecha de emision interpretable."] : []),
  ];

  return {
    provider: "zetasoftware",
    sourceKind: "zeta_received_cfe",
    stream: "zeta.documents.received_cfes",
    entityType: "received_cfe",
    externalKey,
    humanKey,
    payloadHash: buildCanonicalPayloadHash(raw),
    documentRole: "purchase",
    documentType: inferPurchaseDocumentType(summary, total),
    issueDate,
    dueDate,
    series,
    number,
    reference: firstString(documento.InformacionAdicional, summary.InformacionAdicional),
    localCode: firstString(summary.LocalCodigo),
    costCenterExternalCode: null,
    operationCode: null,
    counterparty: {
      role: "vendor",
      externalCode: issuerTaxId,
      name: normalizeCounterpartyName(firstString(summary.DenominacionSocial, emisor.DenominacionSocial)),
      legalName: normalizeCounterpartyName(firstString(summary.DenominacionSocial, emisor.DenominacionSocial)),
      taxId: issuerTaxId,
      taxIdNormalized: normalizeCounterpartyTaxId(issuerTaxId),
    },
    currency: {
      currencyCode,
      zetaCurrencyCode: firstString(totales.Moneda, summary.Moneda),
      sourceRate: sourceRate ?? null,
      sourceRateDate: issueDate,
      sourceRateKind: sourceRate ? "zeta_tipo_cambio_cfe_recibido" : null,
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
      typeCode: firstString(summary.EmisorCFETipo, summary.CFETipo),
      state: firstString(summary.EstadoLocal),
      dgiState: firstString(summary.EstadoDGI),
      receiverState: firstString(summary.EstadoReceptor),
    },
    lines,
    warnings,
    sourcePdfUrl: null,
    raw: {
      ...raw,
      receptor,
    },
  } satisfies ZetaCanonicalDocument;
}

export function buildZetaReceivedCfeIdentityKey(input: ZetaCanonicalDocument) {
  return [
    "purchase",
    input.counterparty.taxIdNormalized ?? normalizeCounterpartyTaxId(input.counterparty.taxId) ?? "no-rut",
    normalizeIdentityPart(input.cfe.typeCode === null ? null : String(input.cfe.typeCode)),
    normalizeIdentityPart(input.series),
    normalizeIdentityPart(input.number),
  ].join("|");
}
