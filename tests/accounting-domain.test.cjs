/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  normalizeDocumentNumber,
  normalizeTaxId,
  normalizeTextToken,
} = require("@/modules/accounting/normalization");
const {
  buildInvoiceIdentityResult,
  pickSuspiciousInvoiceDuplicateDocumentId,
} = require("@/modules/accounting/invoice-identity");
const {
  resolveVendorFromFacts,
} = require("@/modules/accounting/vendor-resolution");
const {
  resolveDocumentConcepts,
} = require("@/modules/accounting/concept-resolution");

function buildVendor(overrides = {}) {
  return {
    id: "vendor-1",
    organization_id: "org-1",
    name: "Estacion del Centro",
    tax_id: "21-433455-019",
    tax_id_normalized: "21433455019",
    name_normalized: "estacion del centro",
    default_account_id: null,
    default_payment_account_id: null,
    default_tax_profile: null,
    default_operation_category: null,
    metadata: {},
    aliases: [],
    ...overrides,
  };
}

function buildConcept(overrides = {}) {
  return {
    id: "concept-1",
    organization_id: "org-1",
    code: "fuel_and_lubricants",
    canonical_name: "Combustible y lubricantes",
    description: "Nafta, gasoil y lubricantes",
    document_role: "purchase",
    default_account_id: "acct-fuel",
    default_vat_profile_json: {},
    default_operation_category: "fuel_and_lubricants",
    is_active: true,
    metadata: {},
    ...overrides,
  };
}

test("normalization strips formatting and accents for tax ids, names, and document numbers", () => {
  assert.equal(normalizeTaxId("21-433.455/019"), "21433455019");
  assert.equal(normalizeTextToken("  Cafe del Sur  "), "cafe del sur");
  assert.equal(normalizeDocumentNumber("A-001 000123"), "a001000123");
});

test("invoice identity builds a business key and flags duplicates explicitly", () => {
  const result = buildInvoiceIdentityResult({
    facts: {
      issuer_name: "Estacion del Centro",
      issuer_tax_id: "21-433.455/019",
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "1234",
      series: "A",
      currency_code: "uyu",
      document_date: "2026-03-10",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
    fileHashDuplicateDocumentIds: ["doc-older"],
    businessDuplicateDocumentId: "doc-older",
  });

  assert.equal(result.identityStrategy, "tax_id_number_date");
  assert.equal(result.invoiceIdentityKey, "21433455019|a1234|2026-03-10");
  assert.equal(result.duplicateStatus, "suspected_duplicate");
  assert.equal(result.duplicateReason, "file_hash_and_business_identity_match");
  assert.equal(result.shouldBlockConfirmation, true);
});

test("invoice identity falls back to tax id + number + total + currency when date is missing", () => {
  const result = buildInvoiceIdentityResult({
    facts: {
      issuer_name: "Estacion del Centro",
      issuer_tax_id: "21-433.455/019",
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "1234",
      series: "A",
      currency_code: "uyu",
      document_date: null,
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
  });

  assert.equal(result.identityStrategy, "tax_id_number_total_currency");
  assert.equal(result.invoiceIdentityKey, "21433455019|a1234|122.00|UYU");
});

test("invoice identity flags fuzzy business duplicates when issuer and number match but date drifts", () => {
  const duplicateId = pickSuspiciousInvoiceDuplicateDocumentId({
    issuerTaxIdNormalized: "21433455019",
    issuerNameNormalized: "estacion del centro",
    documentNumberNormalized: "a1234",
    documentDate: "2026-03-10",
    totalAmount: 122,
    currencyCode: "UYU",
    candidates: [
      {
        documentId: "doc-nearby",
        issuerTaxIdNormalized: "21433455019",
        issuerNameNormalized: "estacion del centro",
        documentNumberNormalized: "a1234",
        documentDate: "2026-03-12",
        totalAmount: 122,
        currencyCode: "UYU",
      },
    ],
  });
  const result = buildInvoiceIdentityResult({
    facts: {
      issuer_name: "Estacion del Centro",
      issuer_tax_id: "21-433.455/019",
      receiver_name: null,
      receiver_tax_id: null,
      document_number: "1234",
      series: "A",
      currency_code: "uyu",
      document_date: "2026-03-10",
      due_date: null,
      subtotal: 100,
      tax_amount: 22,
      total_amount: 122,
      purchase_category_candidate: null,
      sale_category_candidate: null,
    },
    suspiciousDuplicateDocumentId: duplicateId,
  });

  assert.equal(duplicateId, "doc-nearby");
  assert.equal(result.duplicateStatus, "suspected_duplicate");
  assert.equal(result.duplicateReason, "fuzzy_business_identity_match");
});

test("vendor resolution prefers tax id and uses normalized aliases before name", () => {
  const aliasVendor = buildVendor({
    id: "vendor-2",
    name: "Telecom del Sur",
    tax_id_normalized: "21999999001",
    name_normalized: "telecom del sur sa",
    aliases: [
      {
        id: "alias-1",
        vendor_id: "vendor-2",
        alias_display: "Telecom Sur",
        alias_normalized: "telecom sur",
        source: "manual",
      },
    ],
  });

  const taxIdMatch = resolveVendorFromFacts({
    facts: {
      issuer_tax_id: "21.433.455/019",
      issuer_name: "Estacion Del Centro",
    },
    vendors: [buildVendor()],
  });
  const aliasMatch = resolveVendorFromFacts({
    facts: {
      issuer_tax_id: null,
      issuer_name: "Telecom Sur",
    },
    vendors: [aliasVendor],
  });

  assert.equal(taxIdMatch.status, "matched");
  assert.equal(taxIdMatch.matchStrategy, "tax_id");
  assert.equal(taxIdMatch.vendorId, "vendor-1");
  assert.equal(aliasMatch.status, "matched");
  assert.equal(aliasMatch.matchStrategy, "alias");
  assert.equal(aliasMatch.vendorId, "vendor-2");
});

test("vendor resolution marks ambiguous name collisions as blocking", () => {
  const result = resolveVendorFromFacts({
    facts: {
      issuer_tax_id: null,
      issuer_name: "Servicios Integrales",
    },
    vendors: [
      buildVendor({
        id: "vendor-a",
        name_normalized: "servicios integrales",
      }),
      buildVendor({
        id: "vendor-b",
        name_normalized: "servicios integrales",
      }),
    ],
  });

  assert.equal(result.status, "ambiguous");
  assert.equal(result.matchStrategy, "ambiguous");
  assert.match(result.blockingReasons[0], /multiples proveedores/i);
});

test("concept memory reuses a canonical concept across providers and falls back safely", () => {
  const fuelConcept = buildConcept();
  const vendorSpecific = resolveDocumentConcepts({
    vendorId: "vendor-a",
    concepts: [fuelConcept],
    aliases: [
      {
        id: "alias-a",
        organization_id: "org-1",
        concept_id: "concept-1",
        vendor_id: "vendor-a",
        alias_code_normalized: "fuel95",
        alias_description_normalized: "nafta premium",
        match_scope: "vendor",
        source: "manual",
      },
      {
        id: "alias-org",
        organization_id: "org-1",
        concept_id: "concept-1",
        vendor_id: null,
        alias_code_normalized: null,
        alias_description_normalized: "combustible corporativo",
        match_scope: "organization",
        source: "manual",
      },
    ],
    lineItems: [
      {
        line_number: 1,
        concept_code: "FUEL-95",
        concept_description: "Nafta premium",
        quantity: null,
        unit_amount: null,
        net_amount: 100,
        tax_rate: 22,
        tax_amount: 22,
        total_amount: 122,
      },
    ],
    amountBreakdown: [],
  });
  const organizationWide = resolveDocumentConcepts({
    vendorId: "vendor-b",
    concepts: [fuelConcept],
    aliases: [
      {
        id: "alias-org",
        organization_id: "org-1",
        concept_id: "concept-1",
        vendor_id: null,
        alias_code_normalized: null,
        alias_description_normalized: "combustible corporativo",
        match_scope: "organization",
        source: "manual",
      },
    ],
    lineItems: [
      {
        line_number: 1,
        concept_code: null,
        concept_description: "Combustible corporativo",
        quantity: null,
        unit_amount: null,
        net_amount: 50,
        tax_rate: 22,
        tax_amount: 11,
        total_amount: 61,
      },
    ],
    amountBreakdown: [],
  });
  const fallback = resolveDocumentConcepts({
    vendorId: null,
    concepts: [fuelConcept],
    aliases: [],
    lineItems: [],
    amountBreakdown: [
      {
        label: "Total gravado",
        amount: 122,
        tax_rate: 22,
        tax_code: "IVA",
      },
    ],
  });

  assert.equal(vendorSpecific.lines[0].matchedConceptId, "concept-1");
  assert.equal(vendorSpecific.lines[0].matchStrategy, "vendor_alias_code");
  assert.equal(organizationWide.lines[0].matchedConceptId, "concept-1");
  assert.equal(organizationWide.lines[0].matchStrategy, "organization_alias_description");
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(fallback.lines[0].matchStrategy, "fallback_amount_breakdown");
  assert.equal(fallback.needsUserContext, true);
});
