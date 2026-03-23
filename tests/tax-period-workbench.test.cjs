/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  deriveTaxPeriodWorkbenchState,
} = require("@/modules/tax/tax-period-workbench");

function buildDocument(overrides = {}) {
  return {
    documentId: "doc-1",
    draftId: "draft-1",
    role: "purchase",
    documentStatus: "classified",
    draftStatus: "confirmed",
    postingStatus: "posted_provisional",
    documentDate: "2026-03-10",
    duplicateStatus: null,
    classificationResolved: true,
    fiscalTreatmentResolved: true,
    hasVatBucket: true,
    vatBucket: "input_creditable",
    taxableAmountUyu: 100,
    taxAmountUyu: 22,
    reviewFlags: [],
    display: {
      counterpartyName: "Antel",
      issuerName: "Antel",
      receiverName: null,
      documentNumber: "A-15482",
      documentType: "e-Ticket",
      currencyCode: "UYU",
      totalAmount: 122,
    },
    previewDecision: {
      ok: true,
      reasonCode: null,
      reason: null,
    },
    runDecision: {
      ok: true,
      reasonCode: null,
      reason: null,
    },
    ...overrides,
  };
}

test("tax workbench marks explicit exclusion above run eligibility", () => {
  const state = deriveTaxPeriodWorkbenchState({
    document: buildDocument(),
    selection: {
      documentId: "doc-1",
      selectionStatus: "excluded_from_period",
      note: "Excluir por NC pendiente",
      decidedBy: "user-1",
      decidedAt: "2026-03-20T10:00:00.000Z",
      metadata: {},
    },
    includedInOfficialRun: false,
  });

  assert.equal(state.taxState, "excluded_from_period");
  assert.match(state.taxStateSummary, /NC pendiente/i);
});

test("tax workbench distinguishes detected documents from fiscal review blockers", () => {
  const detected = deriveTaxPeriodWorkbenchState({
    document: buildDocument({
      previewDecision: {
        ok: false,
        reasonCode: "missing_draft",
        reason: "No tiene draft actual listo para entrar en evaluacion fiscal.",
      },
    }),
    selection: null,
    includedInOfficialRun: false,
  });

  const needsReview = deriveTaxPeriodWorkbenchState({
    document: buildDocument({
      previewDecision: {
        ok: false,
        reasonCode: "classification_unresolved",
        reason: "La clasificacion contable todavia no quedo resuelta.",
      },
    }),
    selection: null,
    includedInOfficialRun: false,
  });

  assert.equal(detected.taxState, "detected_in_period");
  assert.equal(needsReview.taxState, "needs_fiscal_review");
});
