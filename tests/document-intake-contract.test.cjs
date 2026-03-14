/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  assertDocumentIntakeOutput,
} = require("@/modules/ai/document-intake-contract");

test("document intake contract accepts the v2 organization-aware payload", () => {
  const payload = {
    extracted_text: "Factura A 123",
    confidence_score: 0.87,
    warnings: [],
    transaction_family_candidate: "sale",
    document_subtype_candidate: "customer_invoice",
    issuer_matches_organization: {
      status: "matched",
      strategy: "tax_id",
      matched_alias: null,
      normalized_tax_id: "21433455019",
      normalized_name: "rontil",
      confidence: 1,
      evidence: ["RUT exacto."],
    },
    receiver_matches_organization: {
      status: "not_matched",
      strategy: "none",
      matched_alias: null,
      normalized_tax_id: "21999999001",
      normalized_name: "cliente sa",
      confidence: 0,
      evidence: ["No coincide."],
    },
    certainty_breakdown_json: {
      extraction_confidence: 0.87,
      organization_identity_confidence: 1,
      line_items_confidence: 0.9,
      warning_count: 0,
      warning_flags: [],
    },
    document_role_candidate: "sale",
    document_type_candidate: "customer_invoice",
    operation_category_candidate: "taxed_basic_22",
    facts: {
      issuer_name: "Rontil SAS",
      issuer_tax_id: "21-433455-019",
      receiver_name: "Cliente SA",
      receiver_tax_id: "21-999999-001",
      document_number: "123",
      series: "A",
      currency_code: "UYU",
      document_date: "2026-03-14",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: null,
      sale_category_candidate: "taxed_basic_22",
    },
    amount_breakdown: [
      {
        label: "IVA 22%",
        amount: 22,
        tax_rate: 22,
        tax_code: "IVA",
      },
    ],
    line_items: [
      {
        line_number: 1,
        concept_code: "SKU-1",
        concept_description: "Servicio",
        quantity: 1,
        unit_amount: 100,
        net_amount: 100,
        tax_rate: 22,
        tax_amount: 22,
        total_amount: 122,
      },
    ],
    explanations: {
      classification: "El emisor coincide con la organizacion.",
      facts: "Se detectaron emisor, receptor y totales.",
    },
  };

  assert.doesNotThrow(() => {
    assertDocumentIntakeOutput(payload);
  });
});
