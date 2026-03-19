export type DocumentRoleCandidate = "purchase" | "sale" | "other";

export type DocumentIntakeOrganizationMatchStatus =
  | "matched"
  | "tentative"
  | "not_matched"
  | "ambiguous";

export type DocumentIntakeOrganizationMatchStrategy =
  | "tax_id"
  | "exact_alias"
  | "token_overlap"
  | "none"
  | "ambiguous";

export type DocumentIntakeOrganizationMatch = {
  status: DocumentIntakeOrganizationMatchStatus;
  strategy: DocumentIntakeOrganizationMatchStrategy;
  matched_alias: string | null;
  normalized_tax_id: string | null;
  normalized_name: string | null;
  confidence: number;
  evidence: string[];
};

export type DocumentIntakeCertaintyBreakdown = {
  extraction_confidence: number;
  organization_identity_confidence: number;
  line_items_confidence: number;
  warning_count: number;
  warning_flags: string[];
};

export type DocumentIntakeFactMap = {
  issuer_name: string | null;
  issuer_tax_id: string | null;
  issuer_address_raw: string | null;
  issuer_department: string | null;
  issuer_city: string | null;
  issuer_branch_code: string | null;
  merchant_category_hints: string[];
  location_extraction_confidence: number | null;
  receiver_name: string | null;
  receiver_tax_id: string | null;
  document_number: string | null;
  series: string | null;
  currency_code: string | null;
  document_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  purchase_category_candidate: string | null;
  sale_category_candidate: string | null;
};

export type DocumentIntakeAmountBreakdown = {
  label: string;
  amount: number | null;
  tax_rate: number | null;
  tax_code: string | null;
};

export type DocumentIntakeLineItem = {
  line_number: number | null;
  concept_code: string | null;
  concept_description: string | null;
  quantity: number | null;
  unit_amount: number | null;
  net_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_amount: number | null;
};

export type DocumentIntakePaymentTerms = "cash" | "credit" | "unknown";

export type DocumentIntakeSettlementMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "check"
  | "mixed"
  | "unknown";

export type DocumentIntakeOutput = {
  extracted_text: string;
  confidence_score: number;
  warnings: string[];
  transaction_family_candidate: DocumentRoleCandidate;
  document_subtype_candidate: string;
  issuer_matches_organization: DocumentIntakeOrganizationMatch;
  receiver_matches_organization: DocumentIntakeOrganizationMatch;
  certainty_breakdown_json: DocumentIntakeCertaintyBreakdown;
  document_role_candidate: DocumentRoleCandidate;
  document_type_candidate: string;
  operation_category_candidate: string | null;
  facts: DocumentIntakeFactMap;
  amount_breakdown: DocumentIntakeAmountBreakdown[];
  line_items: DocumentIntakeLineItem[];
  paymentTerms: DocumentIntakePaymentTerms | null;
  settlementMethodExplicit: DocumentIntakeSettlementMethod | null;
  settlementMethodEvidenceText: string | null;
  hasReceiptLanguage: boolean;
  hasCardVoucherLanguage: boolean;
  hasBankTransferReference: boolean;
  explanations: {
    classification: string;
    facts: string;
  };
};

function nullableStringSchema(description: string) {
  return {
    type: ["string", "null"],
    description,
  };
}

function nullableNumberSchema(description: string) {
  return {
    type: ["number", "null"],
    description,
  };
}

function strictObjectSchema<const T extends Record<string, unknown>>(properties: T) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  } as const;
}

const organizationMatchSchema = strictObjectSchema({
  status: {
    type: "string",
    enum: ["matched", "tentative", "not_matched", "ambiguous"],
  },
  strategy: {
    type: "string",
    enum: ["tax_id", "exact_alias", "token_overlap", "none", "ambiguous"],
  },
  matched_alias: nullableStringSchema("Alias usado cuando la identidad de la organizacion coincide."),
  normalized_tax_id: nullableStringSchema("RUT normalizado comparado contra la organizacion."),
  normalized_name: nullableStringSchema("Nombre normalizado de la contraparte comparado contra la organizacion."),
  confidence: {
    type: "number",
    minimum: 0,
    maximum: 1,
  },
  evidence: {
    type: "array",
    items: {
      type: "string",
    },
  },
});

const certaintyBreakdownSchema = strictObjectSchema({
  extraction_confidence: {
    type: "number",
    minimum: 0,
    maximum: 1,
  },
  organization_identity_confidence: {
    type: "number",
    minimum: 0,
    maximum: 1,
  },
  line_items_confidence: {
    type: "number",
    minimum: 0,
    maximum: 1,
  },
  warning_count: {
    type: "number",
    minimum: 0,
  },
  warning_flags: {
    type: "array",
    items: {
      type: "string",
    },
  },
});

const factsSchema = strictObjectSchema({
  issuer_name: nullableStringSchema("Nombre del emisor o proveedor."),
  issuer_tax_id: nullableStringSchema("RUT o identificador fiscal del emisor."),
  issuer_address_raw: nullableStringSchema(
    "Direccion completa del emisor cuando el documento tiene evidencia textual suficiente.",
  ),
  issuer_department: nullableStringSchema(
    "Departamento de Uruguay inferido desde la direccion del emisor solo cuando la evidencia es suficiente.",
  ),
  issuer_city: nullableStringSchema(
    "Ciudad de Uruguay inferida desde la direccion del emisor solo cuando la evidencia es suficiente.",
  ),
  issuer_branch_code: nullableStringSchema(
    "Codigo de local o sucursal del emisor cuando el documento lo expone.",
  ),
  merchant_category_hints: {
    type: "array",
    description: "Pistas normalizadas de rubro comercial derivadas del nombre del comercio o del texto del documento.",
    items: {
      type: "string",
    },
  },
  location_extraction_confidence: nullableNumberSchema(
    "Puntaje de confianza para la extraccion de ubicacion del emisor.",
  ),
  receiver_name: nullableStringSchema("Nombre del receptor o cliente."),
  receiver_tax_id: nullableStringSchema("RUT o identificador fiscal del receptor."),
  document_number: nullableStringSchema("Numero del documento."),
  series: nullableStringSchema("Serie del documento si aparece."),
  currency_code: nullableStringSchema("Codigo ISO de moneda cuando sea detectable."),
  document_date: nullableStringSchema("Fecha de emision del documento en YYYY-MM-DD cuando sea posible."),
  due_date: nullableStringSchema("Fecha de vencimiento en YYYY-MM-DD cuando sea posible."),
  subtotal: nullableNumberSchema("Subtotal antes de impuestos."),
  tax_amount: nullableNumberSchema("Monto principal de impuestos detectado en el documento."),
  total_amount: nullableNumberSchema("Total general."),
  purchase_category_candidate: nullableStringSchema(
    "Categoria V1 sugerida para compras cuando el rol documental sea compra.",
  ),
  sale_category_candidate: nullableStringSchema(
    "Categoria V1 sugerida para ventas cuando el rol documental sea venta.",
  ),
});

const amountBreakdownEntrySchema = strictObjectSchema({
  label: {
    type: "string",
  },
  amount: nullableNumberSchema("Monto detectado para este componente."),
  tax_rate: nullableNumberSchema("Tasa de impuesto detectada, por ejemplo 22 o 10."),
  tax_code: nullableStringSchema("Codigo fiscal normalizado cuando sea inferible."),
});

const lineItemSchema = strictObjectSchema({
  line_number: nullableNumberSchema("Numero de linea cuando sea detectable."),
  concept_code: nullableStringSchema("Codigo de concepto del proveedor o del documento."),
  concept_description: nullableStringSchema("Descripcion del bien o servicio."),
  quantity: nullableNumberSchema("Cantidad de la linea."),
  unit_amount: nullableNumberSchema("Importe unitario de la linea."),
  net_amount: nullableNumberSchema("Importe neto antes de impuestos."),
  tax_rate: nullableNumberSchema("Tasa de impuesto de la linea, por ejemplo 22 o 10."),
  tax_amount: nullableNumberSchema("Monto de impuesto de la linea."),
  total_amount: nullableNumberSchema("Total de la linea incluyendo impuestos cuando figure."),
});

const explanationsSchema = strictObjectSchema({
  classification: {
    type: "string",
  },
  facts: {
    type: "string",
  },
});

export const documentIntakeJsonSchema = strictObjectSchema({
  extracted_text: {
    type: "string",
    description: "Texto legible extraido o reconstruido desde el documento.",
  },
  confidence_score: {
    type: "number",
    minimum: 0,
    maximum: 1,
  },
  warnings: {
    type: "array",
    items: {
      type: "string",
    },
  },
  transaction_family_candidate: {
    type: "string",
    enum: ["purchase", "sale", "other"],
  },
  document_subtype_candidate: {
    type: "string",
  },
  issuer_matches_organization: organizationMatchSchema,
  receiver_matches_organization: organizationMatchSchema,
  certainty_breakdown_json: certaintyBreakdownSchema,
  document_role_candidate: {
    type: "string",
    enum: ["purchase", "sale", "other"],
    description: "Alias legado que se mantiene por compatibilidad con borradores persistidos.",
  },
  document_type_candidate: {
    type: "string",
    description: "Alias legado que se mantiene por compatibilidad con borradores persistidos.",
  },
  operation_category_candidate: nullableStringSchema(
    "Categoria sugerida de compra o venta soportada por V1.",
  ),
  facts: factsSchema,
  amount_breakdown: {
    type: "array",
    items: amountBreakdownEntrySchema,
  },
  line_items: {
    type: "array",
    items: lineItemSchema,
  },
  paymentTerms: {
    type: ["string", "null"],
    enum: ["cash", "credit", "unknown", null],
    description:
      "Condicion de pago del documento. Usa cash si el propio documento prueba contado; credit si prueba credito o vencimiento diferido; null si el documento no aporta evidencia suficiente; unknown solo si la evidencia es contradictoria.",
  },
  settlementMethodExplicit: {
    type: ["string", "null"],
    enum: ["cash", "bank_transfer", "card", "check", "mixed", "unknown", null],
    description:
      "Medio explicito de cobro o pago probado por el propio documento. Si solo hay una cuenta bancaria o leyenda de transferencia, usa bank_transfer. Si el documento no aporta evidencia suficiente, usa null.",
  },
  settlementMethodEvidenceText: nullableStringSchema(
    "Fragmento textual breve que justifica el medio de cobro o pago detectado, por ejemplo 'PAGO: Contado' o 'Datos para Transferencia: BROU CTA CTE USD ...'.",
  ),
  hasReceiptLanguage: {
    type: "boolean",
    description:
      "True cuando el documento contiene lenguaje tipico de recibo o cobranza.",
  },
  hasCardVoucherLanguage: {
    type: "boolean",
    description:
      "True cuando el documento contiene lenguaje tipico de POS o tarjeta.",
  },
  hasBankTransferReference: {
    type: "boolean",
    description:
      "True cuando el documento contiene datos de cuenta bancaria, transferencia, BROU, CTA/CTA CTE, IBAN, SWIFT o texto equivalente.",
  },
  explanations: explanationsSchema,
});

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isOrganizationMatch(value: unknown): value is DocumentIntakeOrganizationMatch {
  if (!value || typeof value !== "object") {
    return false;
  }

  const match = value as Record<string, unknown>;

  return (
    (
      match.status === "matched"
      || match.status === "tentative"
      || match.status === "not_matched"
      || match.status === "ambiguous"
    )
    && (
      match.strategy === "tax_id"
      || match.strategy === "exact_alias"
      || match.strategy === "token_overlap"
      || match.strategy === "none"
      || match.strategy === "ambiguous"
    )
    && isNullableString(match.matched_alias)
    && isNullableString(match.normalized_tax_id)
    && isNullableString(match.normalized_name)
    && typeof match.confidence === "number"
    && Array.isArray(match.evidence)
    && match.evidence.every((entry) => typeof entry === "string")
  );
}

function isCertaintyBreakdown(value: unknown): value is DocumentIntakeCertaintyBreakdown {
  if (!value || typeof value !== "object") {
    return false;
  }

  const breakdown = value as Record<string, unknown>;

  return (
    typeof breakdown.extraction_confidence === "number"
    && typeof breakdown.organization_identity_confidence === "number"
    && typeof breakdown.line_items_confidence === "number"
    && typeof breakdown.warning_count === "number"
    && Array.isArray(breakdown.warning_flags)
    && breakdown.warning_flags.every((entry) => typeof entry === "string")
  );
}

function isDocumentIntakeFactMap(value: unknown): value is DocumentIntakeFactMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  const facts = value as Record<string, unknown>;

  return (
    isNullableString(facts.issuer_name)
    && isNullableString(facts.issuer_tax_id)
    && isNullableString(facts.issuer_address_raw)
    && isNullableString(facts.issuer_department)
    && isNullableString(facts.issuer_city)
    && isNullableString(facts.issuer_branch_code)
    && isStringArray(facts.merchant_category_hints)
    && isNullableNumber(facts.location_extraction_confidence)
    && isNullableString(facts.receiver_name)
    && isNullableString(facts.receiver_tax_id)
    && isNullableString(facts.document_number)
    && isNullableString(facts.series)
    && isNullableString(facts.currency_code)
    && isNullableString(facts.document_date)
    && isNullableString(facts.due_date)
    && isNullableNumber(facts.subtotal)
    && isNullableNumber(facts.tax_amount)
    && isNullableNumber(facts.total_amount)
    && isNullableString(facts.purchase_category_candidate)
    && isNullableString(facts.sale_category_candidate)
  );
}

function isAmountBreakdown(value: unknown): value is DocumentIntakeAmountBreakdown {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.label === "string"
    && isNullableNumber(entry.amount)
    && isNullableNumber(entry.tax_rate)
    && isNullableString(entry.tax_code)
  );
}

function isLineItem(value: unknown): value is DocumentIntakeLineItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    isNullableNumber(entry.line_number)
    && isNullableString(entry.concept_code)
    && isNullableString(entry.concept_description)
    && isNullableNumber(entry.quantity)
    && isNullableNumber(entry.unit_amount)
    && isNullableNumber(entry.net_amount)
    && isNullableNumber(entry.tax_rate)
    && isNullableNumber(entry.tax_amount)
    && isNullableNumber(entry.total_amount)
  );
}

export function isDocumentIntakeOutput(value: unknown): value is DocumentIntakeOutput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const output = value as Record<string, unknown>;
  const explanations =
    output.explanations && typeof output.explanations === "object"
      ? (output.explanations as Record<string, unknown>)
      : null;

  return (
    typeof output.extracted_text === "string"
    && typeof output.confidence_score === "number"
    && Array.isArray(output.warnings)
    && output.warnings.every((warning) => typeof warning === "string")
    && (
      output.transaction_family_candidate === "purchase"
      || output.transaction_family_candidate === "sale"
      || output.transaction_family_candidate === "other"
    )
    && typeof output.document_subtype_candidate === "string"
    && isOrganizationMatch(output.issuer_matches_organization)
    && isOrganizationMatch(output.receiver_matches_organization)
    && isCertaintyBreakdown(output.certainty_breakdown_json)
    && (
      output.document_role_candidate === "purchase"
      || output.document_role_candidate === "sale"
      || output.document_role_candidate === "other"
    )
    && typeof output.document_type_candidate === "string"
    && isNullableString(output.operation_category_candidate)
    && isDocumentIntakeFactMap(output.facts)
    && Array.isArray(output.amount_breakdown)
    && output.amount_breakdown.every((entry) => isAmountBreakdown(entry))
    && Array.isArray(output.line_items)
    && output.line_items.every((entry) => isLineItem(entry))
    && (
      output.paymentTerms === null
      || output.paymentTerms === undefined
      || output.paymentTerms === "cash"
      || output.paymentTerms === "credit"
      || output.paymentTerms === "unknown"
    )
    && (
      output.settlementMethodExplicit === null
      || output.settlementMethodExplicit === undefined
      || output.settlementMethodExplicit === "cash"
      || output.settlementMethodExplicit === "bank_transfer"
      || output.settlementMethodExplicit === "card"
      || output.settlementMethodExplicit === "check"
      || output.settlementMethodExplicit === "mixed"
      || output.settlementMethodExplicit === "unknown"
    )
    && isNullableString(output.settlementMethodEvidenceText)
    && typeof output.hasReceiptLanguage === "boolean"
    && typeof output.hasCardVoucherLanguage === "boolean"
    && typeof output.hasBankTransferReference === "boolean"
    && explanations !== null
    && typeof explanations.classification === "string"
    && typeof explanations.facts === "string"
  );
}

export function assertDocumentIntakeOutput(value: unknown): asserts value is DocumentIntakeOutput {
  if (!isDocumentIntakeOutput(value)) {
    throw new Error("La respuesta de ingesta documental de OpenAI no coincide con el esquema esperado.");
  }
}
