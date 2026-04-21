import { createHash } from "node:crypto";
import {
  normalizeConceptCode,
  normalizeCurrencyCode,
  normalizeDocumentNumber,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting";
import type {
  ZetaFacturaProveedorFormaPago,
  ZetaFacturaProveedorLinea,
  ZetaFacturaProveedorMovimiento,
} from "@/modules/integrations/zeta/contracts/factura-proveedor";
import { resolveZetaPurchaseKind } from "@/modules/integrations/zeta/export/resolve-purchase-kind";
import { resolveZetaSupplier } from "@/modules/integrations/zeta/export/resolve-zeta-supplier";
import type {
  ZetaCatalogRow,
  ZetaOperationalMappingsConfig,
  ZetaPurchaseExpenseCatalogs,
  ZetaPurchaseExpenseDocumentInput,
  ZetaPurchaseExpenseDocumentLineInput,
  ZetaPurchaseExportBlocker,
  ZetaPurchaseExportWarning,
  ZetaPurchaseInvoiceExportPreview,
  ZetaPurchaseInvoiceExportPreviewLine,
  ZetaPurchaseInvoiceExportResolution,
} from "@/modules/integrations/zeta/export/types";

const MONEY_TOLERANCE = 0.05;

type ResolvedSourceLine = Required<Pick<
  ZetaPurchaseExpenseDocumentLineInput,
  "lineNumber"
>> & ZetaPurchaseExpenseDocumentLineInput & {
  description: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  conceptCode: string;
  conceptName: string | null;
  ivaCode: number;
};

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value.replace(",", "."));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function isInactive(row: ZetaCatalogRow) {
  const active = normalizeTextToken(firstText(row.Activo, row.ConceptoActivo, row.ContactoActivo));

  return active === "n" || active === "no" || active === "false" || active === "0" || active === "inactivo";
}

function isYes(value: unknown) {
  const normalized = normalizeTextToken(firstText(value));

  return normalized === "s" || normalized === "si" || normalized === "yes" || normalized === "true";
}

function rowCode(row: ZetaCatalogRow) {
  return firstText(row.Codigo, row.CodigoIVA, row.MonedaCodigo, row.ProveedorCodigo);
}

function findByCode(rows: ZetaCatalogRow[], code: string | number | null | undefined) {
  if (code === null || code === undefined || code === "") {
    return null;
  }

  const normalized = String(code).trim();

  return rows.find((row) => rowCode(row) === normalized) ?? null;
}

function codeNumber(value: unknown) {
  const parsed = firstNumber(value);

  return typeof parsed === "number" ? Math.trunc(parsed) : null;
}

function compactRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as T;
}

function addBlocker(
  blockers: ZetaPurchaseExportBlocker[],
  code: string,
  message: string,
  field?: string,
) {
  blockers.push(compactRecord({ code, message, field }));
}

function deriveTaxRate(line: ZetaPurchaseExpenseDocumentLineInput) {
  if (typeof line.taxRate === "number" && Number.isFinite(line.taxRate)) {
    return line.taxRate;
  }

  if (
    typeof line.netAmount === "number"
    && Math.abs(line.netAmount) > 0.009
    && typeof line.taxAmount === "number"
  ) {
    return roundCurrency((line.taxAmount / line.netAmount) * 100);
  }

  if ((line.taxAmount ?? 0) === 0) {
    return 0;
  }

  return null;
}

function formatRateKey(rate: number) {
  return Number.isInteger(rate) ? String(rate) : String(roundCurrency(rate));
}

function resolveVatCode(input: {
  rate: number;
  catalogs: ZetaPurchaseExpenseCatalogs;
}) {
  const mapped = input.catalogs.config?.vatRates?.[formatRateKey(input.rate)];
  const mappedRow = findByCode(input.catalogs.vatRates, mapped);

  if (mappedRow) {
    return codeNumber(rowCode(mappedRow));
  }

  const byRate = input.catalogs.vatRates.find((row) =>
    Math.abs((firstNumber(row.Tasa, row.Porcentaje, row.IVA) ?? -999) - input.rate) <= 0.001
    && !isInactive(row));

  return byRate ? codeNumber(rowCode(byRate)) : null;
}

function resolveCurrency(input: {
  currencyCode: string | null;
  catalogs: ZetaPurchaseExpenseCatalogs;
}) {
  const iso = normalizeCurrencyCode(input.currencyCode) ?? "UYU";
  const mapped = input.catalogs.config?.currencies?.[iso]
    ?? input.catalogs.config?.defaults?.currencyCode;
  const mappedRow = findByCode(input.catalogs.currencies, mapped);

  if (mappedRow) {
    return {
      iso,
      code: codeNumber(rowCode(mappedRow)),
      row: mappedRow,
    };
  }

  const byIso = input.catalogs.currencies.find((row) =>
    normalizeCurrencyCode(firstText(row.CodigoISO, row.ISO, row.Abreviacion)) === iso
    && !isInactive(row));

  return {
    iso,
    code: byIso ? codeNumber(rowCode(byIso)) : null,
    row: byIso ?? null,
  };
}

function documentTypeMappingCode(input: ZetaPurchaseExpenseDocumentInput) {
  const normalizedType = normalizeTextToken(input.documentType);
  const template = normalizeTextToken(input.postingTemplateCode);

  if (
    normalizedType?.includes("credit_note")
    || normalizedType?.includes("nota credito")
    || template?.includes("supplier_credit_note")
  ) {
    return "supplier_credit_note_expense" as const;
  }

  if (input.paymentTerms === "credit") {
    return "purchase_expense_credit" as const;
  }

  return "purchase_expense_cash" as const;
}

function resolveDocumentType(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  catalogs: ZetaPurchaseExpenseCatalogs;
  blockers: ZetaPurchaseExportBlocker[];
}) {
  const mappingCode = documentTypeMappingCode(input.document);
  const zetaCode = input.catalogs.config?.documentTypes?.[mappingCode];

  if (!zetaCode) {
    addBlocker(
      input.blockers,
      "zeta_purchase_expense_document_type_missing",
      `Falta mapear el comprobante Zeta para ${mappingCode}.`,
      "comprobante",
    );
    return {
      mappingCode,
      code: null,
      row: null,
    };
  }

  const row = findByCode(input.catalogs.documentTypes, zetaCode);

  if (!row) {
    addBlocker(
      input.blockers,
      "zeta_purchase_expense_document_type_not_found",
      `El comprobante Zeta ${zetaCode} no esta sincronizado o no existe.`,
      "comprobante",
    );
    return {
      mappingCode,
      code: codeNumber(zetaCode),
      row: null,
    };
  }

  if (isInactive(row)) {
    addBlocker(
      input.blockers,
      "zeta_purchase_expense_document_type_inactive",
      `El comprobante Zeta ${zetaCode} esta inactivo.`,
      "comprobante",
    );
  }

  if (!isYes(row.ComprobanteGastos)) {
    addBlocker(
      input.blockers,
      "zeta_purchase_expense_document_type_not_expense",
      "El comprobante Zeta mapeado no esta confirmado como comprobante de gastos.",
      "comprobante",
    );
  }

  return {
    mappingCode,
    code: codeNumber(rowCode(row)),
    row,
  };
}

function resolvePaymentTerm(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  catalogs: ZetaPurchaseExpenseCatalogs;
  blockers: ZetaPurchaseExportBlocker[];
}) {
  const key = input.document.settlementMethod === "paid_by_partner"
    ? "paid_by_partner"
    : input.document.paymentTerms ?? "unknown";
  const code = input.catalogs.config?.paymentTerms?.[key]
    ?? input.catalogs.config?.defaults?.paymentTermCode;

  if (!code) {
    addBlocker(
      input.blockers,
      "zeta_payment_term_missing",
      "Falta mapear la condicion de pago Zeta para esta compra.",
      "payment_terms",
    );
    return null;
  }

  const row = findByCode(input.catalogs.paymentTerms, code);

  if (!row) {
    addBlocker(
      input.blockers,
      "zeta_payment_term_not_found",
      `La condicion de pago Zeta ${code} no esta sincronizada o no existe.`,
      "payment_terms",
    );
  } else if (isInactive(row)) {
    addBlocker(
      input.blockers,
      "zeta_payment_term_inactive",
      `La condicion de pago Zeta ${code} esta inactiva.`,
      "payment_terms",
    );
  }

  return code;
}

function resolvePaymentMethod(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  catalogs: ZetaPurchaseExpenseCatalogs;
  currencyCode: number | null;
  blockers: ZetaPurchaseExportBlocker[];
  warnings: ZetaPurchaseExportWarning[];
}) {
  const settlementMethod = input.document.settlementMethod ?? "unknown";

  if (input.document.paymentTerms === "credit" && settlementMethod !== "paid_by_partner") {
    return {
      code: null,
      formasPago: undefined,
      paidByPartnerMessage: null,
      cashboxCode: undefined,
    };
  }

  if (settlementMethod === "unknown" || settlementMethod === "mixed") {
    addBlocker(
      input.blockers,
      "zeta_payment_method_unknown",
      "Falta resolver la forma de pago Zeta para esta compra.",
      "payment_method",
    );
    return {
      code: null,
      formasPago: undefined,
      paidByPartnerMessage: null,
      cashboxCode: undefined,
    };
  }

  const mapped = settlementMethod === "paid_by_partner"
    ? input.catalogs.config?.paidByPartnerPaymentMethodCode
      ?? input.catalogs.config?.paymentMethods?.paid_by_partner
    : input.catalogs.config?.paymentMethods?.[settlementMethod];

  if (!mapped) {
    const message = settlementMethod === "paid_by_partner"
      ? "Falta mapear la forma de pago Zeta para compras pagadas por socio / a reintegrar."
      : "Falta mapear la forma de pago Zeta para esta compra.";

    addBlocker(input.blockers, "zeta_payment_method_missing", message, "payment_method");
    return {
      code: null,
      formasPago: undefined,
      paidByPartnerMessage: null,
      cashboxCode: undefined,
    };
  }

  const row = findByCode(input.catalogs.paymentMethods, mapped);

  if (!row) {
    addBlocker(
      input.blockers,
      "zeta_payment_method_not_found",
      `La forma de pago Zeta ${mapped} no esta sincronizada o no existe.`,
      "payment_method",
    );
  } else if (isInactive(row)) {
    addBlocker(
      input.blockers,
      "zeta_payment_method_inactive",
      `La forma de pago Zeta ${mapped} esta inactiva.`,
      "payment_method",
    );
  }

  if (settlementMethod === "paid_by_partner") {
    if (isYes(row?.RequiereCaja)) {
      addBlocker(
        input.blockers,
        "zeta_paid_by_partner_requires_cashbox",
        "La forma de pago Zeta configurada para reintegro a socio exige caja. Ajusta la configuracion en Zeta o mapea otra forma de pago.",
        "payment_method",
      );
    }

    input.warnings.push({
      code: "zeta_paid_by_partner_no_cash_bank",
      message: "Esta compra no usara Caja ni Banco de Rontil. Se enviara con la forma de pago configurada para reintegro a socio.",
    });
  }

  let cashboxCode: number | undefined;

  if (settlementMethod !== "paid_by_partner" && isYes(row?.RequiereCaja)) {
    const configured = input.catalogs.config?.defaults?.cashboxCode;

    if (!configured) {
      addBlocker(
        input.blockers,
        "zeta_cashbox_required",
        "Zeta requiere caja para esta forma de pago y no hay caja default configurada.",
        "cashbox",
      );
    } else {
      cashboxCode = configured;
    }
  }

  const total = roundCurrency(input.document.totalAmount ?? 0);
  const paymentMethodCode = codeNumber(rowCode(row ?? { Codigo: mapped }));
  const formasPago: ZetaFacturaProveedorFormaPago[] | undefined =
    paymentMethodCode && input.currencyCode && total !== 0
      ? [{
        CodigoFormaPago: paymentMethodCode,
        CodigoMonedaPago: input.currencyCode,
        MontoMonedaPago: total,
        MontoMonedaMovimiento: total,
      }]
      : undefined;

  return {
    code: paymentMethodCode,
    formasPago,
    paidByPartnerMessage: settlementMethod === "paid_by_partner"
      ? "Esta compra no usara Caja ni Banco de Rontil. Se enviara con la forma de pago configurada para reintegro a socio."
      : null,
    cashboxCode,
  };
}

function resolveConceptCode(input: {
  line: ZetaPurchaseExpenseDocumentLineInput;
  supplierCode: string | null;
  catalogs: ZetaPurchaseExpenseCatalogs;
}) {
  const detectedCode = firstText(input.line.conceptCode);
  const detectedKey = normalizeConceptCode(detectedCode)
    ?? normalizeConceptCode(input.line.conceptDescription);
  const fromDetected = detectedKey
    ? input.catalogs.config?.concepts?.byDetectedConcept?.[detectedKey]
    : null;
  const fromSupplier = input.supplierCode
    ? input.catalogs.config?.concepts?.bySupplierCode?.[input.supplierCode]
    : null;
  const candidates = [
    detectedCode,
    fromDetected,
    fromSupplier,
    input.catalogs.config?.concepts?.default,
  ].filter(Boolean) as string[];

  for (const code of candidates) {
    const row = findByCode(input.catalogs.concepts, code);

    if (row && !isInactive(row)) {
      return {
        code: firstText(row.Codigo) ?? code,
        name: firstText(row.Nombre, row.ConceptoNombre),
        row,
      };
    }
  }

  return null;
}

function buildSourceLines(document: ZetaPurchaseExpenseDocumentInput) {
  const cleanLines = document.lines.filter((line) =>
    typeof line.netAmount === "number"
    || typeof line.totalAmount === "number"
    || typeof line.taxAmount === "number");

  if (cleanLines.length > 0) {
    return cleanLines;
  }

  return [{
    lineNumber: 1,
    conceptDescription: "Compra de gasto",
    netAmount: document.netAmount ?? (
      typeof document.totalAmount === "number" && typeof document.taxAmount === "number"
        ? roundCurrency(document.totalAmount - document.taxAmount)
        : null
    ),
    taxAmount: document.taxAmount ?? 0,
    totalAmount: document.totalAmount ?? null,
  }] satisfies ZetaPurchaseExpenseDocumentLineInput[];
}

function resolveSourceLines(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  catalogs: ZetaPurchaseExpenseCatalogs;
  supplierCode: string | null;
  blockers: ZetaPurchaseExportBlocker[];
}) {
  const resolved: ResolvedSourceLine[] = [];

  for (const [index, line] of buildSourceLines(input.document).entries()) {
    const concept = resolveConceptCode({
      line,
      supplierCode: input.supplierCode,
      catalogs: input.catalogs,
    });

    if (!concept) {
      addBlocker(
        input.blockers,
        "zeta_concept_missing",
        "Falta mapear el concepto Zeta para esta compra de gasto.",
        "concept",
      );
      continue;
    }

    const taxRate = deriveTaxRate(line);

    if (typeof taxRate !== "number") {
      addBlocker(
        input.blockers,
        "zeta_vat_rate_missing",
        "Falta la tasa de IVA deterministica para una linea de la compra.",
        "vat",
      );
      continue;
    }

    const ivaCode = resolveVatCode({
      rate: taxRate,
      catalogs: input.catalogs,
    });

    if (!ivaCode) {
      addBlocker(
        input.blockers,
        "zeta_vat_code_missing",
        `Falta mapear la tasa de IVA ${formatRateKey(taxRate)}% a un CodigoIVA Zeta.`,
        "vat",
      );
      continue;
    }

    const netAmount = roundCurrency(
      line.netAmount
      ?? (
        typeof line.totalAmount === "number" && typeof line.taxAmount === "number"
          ? line.totalAmount - line.taxAmount
          : 0
      ),
    );
    const taxAmount = roundCurrency(line.taxAmount ?? (netAmount * taxRate) / 100);
    const totalAmount = roundCurrency(line.totalAmount ?? netAmount + taxAmount);

    resolved.push({
      ...line,
      lineNumber: line.lineNumber ?? index + 1,
      description: firstText(line.conceptDescription) ?? concept.name ?? concept.code,
      netAmount,
      taxAmount,
      totalAmount,
      taxRate,
      conceptCode: concept.code,
      conceptName: concept.name,
      ivaCode,
    });
  }

  return resolved;
}

function buildGroupedExpenseLines(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  sourceLines: ResolvedSourceLine[];
}) {
  const groups = new Map<string, ResolvedSourceLine>();

  for (const line of input.sourceLines) {
    const key = `${line.conceptCode}::${line.ivaCode}`;
    const current = groups.get(key);

    if (current) {
      current.netAmount = roundCurrency(current.netAmount + line.netAmount);
      current.taxAmount = roundCurrency(current.taxAmount + line.taxAmount);
      current.totalAmount = roundCurrency(current.totalAmount + line.totalAmount);
      current.description = current.description || line.description;
    } else {
      groups.set(key, { ...line });
    }
  }

  const cfeRef = [
    input.document.cfeTypeCode ? `CFE ${input.document.cfeTypeCode}` : "CFE",
    input.document.series,
    input.document.number,
  ].filter(Boolean).join(" ");

  return [...groups.values()].map((line) => ({
    zetaLine: {
      CodigoArticulo: line.conceptCode,
      Concepto: line.description.slice(0, 80),
      Cantidad: 1,
      PrecioUnitario: roundCurrency(line.netAmount),
      Descuento1: 0,
      Descuento2: 0,
      Descuento3: 0,
      CodigoIVA: line.ivaCode,
      Notas: cfeRef.slice(0, 80),
    } satisfies ZetaFacturaProveedorLinea,
    previewLine: {
      conceptCode: line.conceptCode,
      conceptName: line.conceptName,
      description: line.description,
      quantity: 1,
      unitPrice: roundCurrency(line.netAmount),
      ivaCode: line.ivaCode,
      netAmount: roundCurrency(line.netAmount),
      ivaAmount: roundCurrency(line.taxAmount),
      totalAmount: roundCurrency(line.totalAmount),
    } satisfies ZetaPurchaseInvoiceExportPreviewLine,
  }));
}

function parseDocumentNumber(value: string | number | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  const normalized = normalizeDocumentNumber(value);

  if (!normalized || !/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function fiscalFingerprint(input: {
  supplierRut: string | null;
  cfeTypeCode: string | number | null | undefined;
  series: string | null;
  number: number | null;
  issueDate: string | null;
  totalAmount: number | null | undefined;
  currencyCode: string | null;
}) {
  const parts = [
    input.supplierRut ?? "sin-rut",
    input.cfeTypeCode ?? "sin-tipo",
    input.series ?? "sin-serie",
    input.number ?? "sin-numero",
    input.issueDate ?? "sin-fecha",
    typeof input.totalAmount === "number" ? roundCurrency(input.totalAmount) : "sin-total",
    input.currencyCode ?? "sin-moneda",
  ];

  return `sha256:${createHash("sha256").update(parts.join("|"), "utf8").digest("hex")}`;
}

function emptyPreview(document: ZetaPurchaseExpenseDocumentInput): ZetaPurchaseInvoiceExportPreview {
  return {
    supplierName: document.supplierName,
    supplierRut: document.supplierRut,
    zetaSupplierCode: null,
    comprobanteCode: null,
    comprobanteName: null,
    fecha: document.issueDate,
    serie: document.series,
    numero: parseDocumentNumber(document.number),
    monedaCode: null,
    cotizacion: document.exchangeRate ?? null,
    conditionCode: null,
    paymentMethodCode: null,
    purchaseKind: "unknown",
    lines: [],
    paidByPartnerMessage: null,
  };
}

export function resolveZetaPurchaseExpenseInvoicePayload(input: {
  document: ZetaPurchaseExpenseDocumentInput;
  catalogs: ZetaPurchaseExpenseCatalogs;
}): ZetaPurchaseInvoiceExportResolution {
  const blockers: ZetaPurchaseExportBlocker[] = [];
  const warnings: ZetaPurchaseExportWarning[] = [];
  const document = input.document;
  const preview = emptyPreview(document);

  if (document.documentRole !== "purchase") {
    addBlocker(blockers, "zeta_purchase_only", "Zeta solo exporta compras en este flujo.", "document_role");
  }

  if (!document.series) {
    addBlocker(blockers, "zeta_series_missing", "Falta serie confirmada para exportar a Zeta.", "series");
  }

  const numero = parseDocumentNumber(document.number);

  if (!numero) {
    addBlocker(blockers, "zeta_number_missing", "Falta numero confirmado para exportar a Zeta.", "number");
  }

  if (document.fiscalIdentityTrusted === false) {
    addBlocker(blockers, "zeta_invoice_identity_untrusted", "El numero de comprobante no es confiable. Confirmalo antes de exportar.", "number");
  }

  if (!document.issueDate) {
    addBlocker(blockers, "zeta_issue_date_missing", "Falta fecha de emision para exportar a Zeta.", "issue_date");
  }

  if (typeof document.totalAmount !== "number") {
    addBlocker(blockers, "zeta_total_missing", "Falta total del documento para exportar a Zeta.", "total");
  }

  const supplier = resolveZetaSupplier({
    supplierRut: document.supplierRut,
    supplierName: document.supplierName,
    contacts: input.catalogs.suppliers,
    supplierCommercialData: input.catalogs.supplierCommercialData,
  });
  blockers.push(...supplier.blockers);
  preview.zetaSupplierCode = supplier.zetaSupplierCode;
  preview.supplierName = supplier.zetaSupplierName ?? document.supplierName;

  const comprobante = resolveDocumentType({
    document,
    catalogs: input.catalogs,
    blockers,
  });
  preview.comprobanteCode = comprobante.code;
  preview.comprobanteName = firstText(comprobante.row?.Nombre);

  const purchaseKind = resolveZetaPurchaseKind({
    selectedTemplateCode: document.postingTemplateCode,
    operationCategory: document.operationCategory,
    comprobante: comprobante.row,
    cfeSignals: document.lines.map((line) =>
      [line.conceptCode, line.conceptDescription].filter(Boolean).join(" ")),
  });
  preview.purchaseKind = purchaseKind;

  if (purchaseKind === "merchandise") {
    addBlocker(
      blockers,
      "zeta_merchandise_not_supported",
      "Esta factura parece ser una compra de mercaderia. Para exportarla a Zeta se requiere resolver articulos de stock. Esta fase todavia no exporta mercaderia.",
      "purchase_kind",
    );
  } else if (purchaseKind === "unknown") {
    addBlocker(
      blockers,
      "zeta_purchase_kind_unknown",
      "No se pudo confirmar si la compra es gasto o mercaderia. Este caso queda asistido o bloqueado, nunca automatico.",
      "purchase_kind",
    );
  }

  const currency = resolveCurrency({
    currencyCode: document.currencyCode,
    catalogs: input.catalogs,
  });
  preview.monedaCode = currency.code;

  if (!currency.code) {
    addBlocker(
      blockers,
      "zeta_currency_missing",
      "Falta mapear la moneda Zeta para esta compra.",
      "currency",
    );
  }

  if (currency.iso !== "UYU" && (!document.exchangeRate || document.exchangeRate <= 0)) {
    addBlocker(
      blockers,
      "zeta_exchange_rate_missing",
      "La compra esta en moneda extranjera y falta cotizacion confiable.",
      "exchange_rate",
    );
  }

  const conditionCode = resolvePaymentTerm({
    document,
    catalogs: input.catalogs,
    blockers,
  });
  preview.conditionCode = conditionCode;

  const payment = resolvePaymentMethod({
    document,
    catalogs: input.catalogs,
    currencyCode: currency.code,
    blockers,
    warnings,
  });
  preview.paymentMethodCode = payment.code;
  preview.paidByPartnerMessage = payment.paidByPartnerMessage;

  const sourceLines = resolveSourceLines({
    document,
    catalogs: input.catalogs,
    supplierCode: supplier.zetaSupplierCode,
    blockers,
  });
  const grouped = buildGroupedExpenseLines({ document, sourceLines });
  preview.lines = grouped.map((line) => line.previewLine);

  const groupedNet = roundCurrency(preview.lines.reduce((sum, line) => sum + line.netAmount, 0));
  const groupedTax = roundCurrency(preview.lines.reduce((sum, line) => sum + line.ivaAmount, 0));
  const groupedTotal = roundCurrency(groupedNet + groupedTax);

  if (
    typeof document.totalAmount === "number"
    && Math.abs(groupedTotal - roundCurrency(document.totalAmount)) > MONEY_TOLERANCE
  ) {
    addBlocker(
      blockers,
      "zeta_amount_mismatch",
      "Los importes agrupados por concepto e IVA no coinciden con el total esperado dentro de la tolerancia.",
      "amounts",
    );
  }

  const fingerprint = fiscalFingerprint({
    supplierRut: document.supplierRut,
    cfeTypeCode: document.cfeTypeCode,
    series: document.series,
    number: numero,
    issueDate: document.issueDate,
    totalAmount: document.totalAmount,
    currencyCode: document.currencyCode,
  });

  const canBuildPayload =
    blockers.length === 0
    && comprobante.code !== null
    && numero !== null
    && document.issueDate !== null
    && supplier.zetaSupplierCode !== null
    && currency.code !== null
    && grouped.length > 0;
  const movimiento: ZetaFacturaProveedorMovimiento | null = canBuildPayload
    ? compactRecord({
      CodigoComprobante: comprobante.code as number,
      Serie: document.series ?? undefined,
      Numero: numero as number,
      Fecha: document.issueDate as string,
      CodigoMoneda: currency.code as number,
      Cotizacion: currency.iso === "UYU" ? undefined : document.exchangeRate ?? undefined,
      CodigoProveedor: supplier.zetaSupplierCode as string,
      CodigoCondicionPago: conditionCode ?? undefined,
      Notas: document.sourceReference ?? fingerprint,
      CodigoLocal: input.catalogs.config?.defaults?.localCode,
      CodigoUsuario: input.catalogs.config?.defaults?.userCode,
      CodigoCaja: payment.cashboxCode,
      Lineas: grouped.map((line) => line.zetaLine),
      FormasPago: payment.formasPago,
    })
    : null;

  return {
    documentId: document.documentId,
    exportable: Boolean(movimiento),
    mode: movimiento ? "automatic" : blockers.length > 0 ? "blocked" : "assisted",
    status: movimiento ? "dry_run_ready" : "blocked",
    blockers,
    warnings,
    payload: movimiento
      ? {
        Data: {
          Movimiento: [movimiento],
        },
      }
      : null,
    preview,
    fiscalFingerprint: fingerprint,
  };
}

export function normalizeZetaPurchaseExpenseConfig(value: unknown): ZetaOperationalMappingsConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as ZetaOperationalMappingsConfig;
}
