export type DocumentRoleCandidate = "purchase" | "sale" | "other";

export type DocumentIntakeFactMap = {
  issuer_name: string | null;
  issuer_tax_id: string | null;
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

export type DocumentIntakeOutput = {
  extracted_text: string;
  confidence_score: number;
  warnings: string[];
  document_role_candidate: DocumentRoleCandidate;
  document_type_candidate: string;
  operation_category_candidate: string | null;
  facts: DocumentIntakeFactMap;
  amount_breakdown: DocumentIntakeAmountBreakdown[];
  line_items: DocumentIntakeLineItem[];
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

export const documentIntakeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "extracted_text",
    "confidence_score",
    "warnings",
    "document_role_candidate",
    "document_type_candidate",
    "operation_category_candidate",
    "facts",
    "amount_breakdown",
    "line_items",
    "explanations",
  ],
  properties: {
    extracted_text: {
      type: "string",
      description: "Readable text extracted or reconstructed from the document.",
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
    document_role_candidate: {
      type: "string",
      enum: ["purchase", "sale", "other"],
    },
    document_type_candidate: {
      type: "string",
    },
    operation_category_candidate: nullableStringSchema(
      "Suggested purchase or sale category supported by V1.",
    ),
    facts: {
      type: "object",
      additionalProperties: false,
      required: [
        "issuer_name",
        "issuer_tax_id",
        "receiver_name",
        "receiver_tax_id",
        "document_number",
        "series",
        "currency_code",
        "document_date",
        "due_date",
        "subtotal",
        "tax_amount",
        "total_amount",
        "purchase_category_candidate",
        "sale_category_candidate",
      ],
      properties: {
        issuer_name: nullableStringSchema("Issuer or supplier name."),
        issuer_tax_id: nullableStringSchema("Issuer RUT or fiscal identifier."),
        receiver_name: nullableStringSchema("Receiver or customer name."),
        receiver_tax_id: nullableStringSchema("Receiver RUT or fiscal identifier."),
        document_number: nullableStringSchema("Document number."),
        series: nullableStringSchema("Document series if present."),
        currency_code: nullableStringSchema("ISO currency code when detectable."),
        document_date: nullableStringSchema("Document issue date in YYYY-MM-DD when possible."),
        due_date: nullableStringSchema("Due date in YYYY-MM-DD when possible."),
        subtotal: nullableNumberSchema("Subtotal before taxes."),
        tax_amount: nullableNumberSchema("Primary tax amount detected on the document."),
        total_amount: nullableNumberSchema("Grand total."),
        purchase_category_candidate: nullableStringSchema(
          "Suggested V1 purchase category when the role is purchase.",
        ),
        sale_category_candidate: nullableStringSchema(
          "Suggested V1 sale category when the role is sale.",
        ),
      },
    },
    amount_breakdown: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "amount", "tax_rate", "tax_code"],
        properties: {
          label: {
            type: "string",
          },
          amount: nullableNumberSchema("Detected amount for this component."),
          tax_rate: nullableNumberSchema("Detected tax rate, for example 22 or 10."),
          tax_code: nullableStringSchema("Normalized tax code when inferable."),
        },
      },
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "line_number",
          "concept_code",
          "concept_description",
          "quantity",
          "unit_amount",
          "net_amount",
          "tax_rate",
          "tax_amount",
          "total_amount",
        ],
        properties: {
          line_number: nullableNumberSchema("Line number when detectable."),
          concept_code: nullableStringSchema("Vendor or document concept code."),
          concept_description: nullableStringSchema("Goods or service description."),
          quantity: nullableNumberSchema("Quantity for the line item."),
          unit_amount: nullableNumberSchema("Unit amount for the line item."),
          net_amount: nullableNumberSchema("Net amount before taxes."),
          tax_rate: nullableNumberSchema("Tax rate for this line item, for example 22 or 10."),
          tax_amount: nullableNumberSchema("Tax amount for the line item."),
          total_amount: nullableNumberSchema("Line total including taxes when present."),
        },
      },
    },
    explanations: {
      type: "object",
      additionalProperties: false,
      required: ["classification", "facts"],
      properties: {
        classification: {
          type: "string",
        },
        facts: {
          type: "string",
        },
      },
    },
  },
} as const;

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isDocumentIntakeFactMap(value: unknown): value is DocumentIntakeFactMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  const facts = value as Record<string, unknown>;

  return (
    isNullableString(facts.issuer_name)
    && isNullableString(facts.issuer_tax_id)
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
    && explanations !== null
    && typeof explanations.classification === "string"
    && typeof explanations.facts === "string"
  );
}

export function assertDocumentIntakeOutput(value: unknown): asserts value is DocumentIntakeOutput {
  if (!isDocumentIntakeOutput(value)) {
    throw new Error("The OpenAI document intake response did not match the expected schema.");
  }
}
