/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveTransactionFamilyByOrganizationIdentity,
} = require("@/modules/accounting/transaction-family-resolution");

function buildMatch(overrides = {}) {
  return {
    status: "not_matched",
    strategy: "none",
    confidence: 0,
    evidence: [],
    ...overrides,
  };
}

test("transaction family resolves sale deterministically by issuer tax id", () => {
  const result = resolveTransactionFamilyByOrganizationIdentity({
    issuerMatch: buildMatch({
      status: "matched",
      strategy: "tax_id",
      confidence: 1,
    }),
    receiverMatch: buildMatch(),
    modelRoleCandidate: "purchase",
    modelSubtypeCandidate: "customer_invoice",
  });

  assert.equal(result.documentRole, "sale");
  assert.equal(result.documentSubtype, "sale_invoice");
  assert.equal(result.source, "deterministic_tax_id");
  assert.equal(result.shouldReview, false);
});

test("transaction family resolves purchase deterministically by receiver tax id", () => {
  const result = resolveTransactionFamilyByOrganizationIdentity({
    issuerMatch: buildMatch(),
    receiverMatch: buildMatch({
      status: "matched",
      strategy: "tax_id",
      confidence: 1,
    }),
    modelRoleCandidate: "sale",
    modelSubtypeCandidate: "supplier_credit_note",
  });

  assert.equal(result.documentRole, "purchase");
  assert.equal(result.documentSubtype, "purchase_credit_note");
  assert.equal(result.source, "deterministic_tax_id");
});

test("transaction family keeps tentative alias matches visible and reviewable", () => {
  const result = resolveTransactionFamilyByOrganizationIdentity({
    issuerMatch: buildMatch({
      status: "tentative",
      strategy: "token_overlap",
      confidence: 0.81,
    }),
    receiverMatch: buildMatch(),
    modelRoleCandidate: "sale",
    modelSubtypeCandidate: "receipt",
  });

  assert.equal(result.documentRole, "sale");
  assert.equal(result.documentSubtype, "sale_receipt");
  assert.equal(result.shouldReview, true);
  assert.equal(result.source, "deterministic_alias");
});

test("transaction family blocks ambiguous organization identity", () => {
  const result = resolveTransactionFamilyByOrganizationIdentity({
    issuerMatch: buildMatch({
      status: "matched",
      strategy: "tax_id",
      confidence: 1,
    }),
    receiverMatch: buildMatch({
      status: "matched",
      strategy: "exact_alias",
      confidence: 0.92,
    }),
    modelRoleCandidate: "sale",
    modelSubtypeCandidate: "invoice",
  });

  assert.equal(result.documentRole, "other");
  assert.equal(result.shouldReview, true);
  assert.equal(result.source, "ambiguous_identity");
});
