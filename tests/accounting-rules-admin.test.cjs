/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  deriveAccountingRuleLifecycleStatus,
  matchesAccountingRuleSourceFilter,
  normalizeAccountingRulesAdminFilters,
  sortAccountingRuleListItems,
} = require("@/modules/accounting/rules-admin");

test("accounting rules admin normalizes filters conservatively", () => {
  const filters = normalizeAccountingRulesAdminFilters({
    search: "  proveedor x  ",
    status: "paused",
    scope: "vendor_concept",
    source: "learning",
  });

  assert.deepEqual(filters, {
    search: "proveedor x",
    status: "paused",
    scope: "vendor_concept",
    source: "learning",
  });
  assert.deepEqual(
    normalizeAccountingRulesAdminFilters({
      status: "invented",
      scope: "invalid_scope",
      source: "nope",
    }),
    {
      search: "",
      status: "all",
      scope: "all",
      source: "all",
    },
  );
});

test("accounting rules admin derives lifecycle status from legacy flags", () => {
  assert.equal(
    deriveAccountingRuleLifecycleStatus({
      lifecycleStatus: null,
      approvalStatus: "approved",
      isActive: true,
      supersededByRuleId: null,
    }),
    "active",
  );
  assert.equal(
    deriveAccountingRuleLifecycleStatus({
      lifecycleStatus: null,
      approvalStatus: "candidate",
      isActive: false,
      supersededByRuleId: null,
    }),
    "draft",
  );
  assert.equal(
    deriveAccountingRuleLifecycleStatus({
      lifecycleStatus: null,
      approvalStatus: "approved",
      isActive: false,
      supersededByRuleId: "rule-new",
    }),
    "superseded",
  );
});

test("accounting rules admin sorts active rules before paused and by precedence scope", () => {
  const ordered = sortAccountingRuleListItems([
    {
      id: "rule-paused",
      stableFamilyCode: null,
      versionNumber: 1,
      lifecycleStatus: "paused",
      approvalStatus: "approved",
      name: "Proveedor default",
      description: null,
      scope: "vendor_default",
      documentRole: "purchase",
      priority: 700,
      source: "manual",
      createdFrom: "manual",
      vendorName: "Proveedor",
      conceptName: null,
      accountLabel: "6101 - Compras",
      conditionSummary: [],
      resultSummary: [],
      documentsAppliedCount: 0,
      matchesCount: 0,
      lastMatchedAt: null,
      lastEditedAt: "2026-03-20T10:00:00Z",
      pauseReason: "duplicada",
      sourceDocumentId: null,
      sourceDocumentLabel: null,
      supersedesRuleId: null,
      supersededByRuleId: null,
      searchableText: "proveedor default",
    },
    {
      id: "rule-active-concept",
      stableFamilyCode: null,
      versionNumber: 1,
      lifecycleStatus: "active",
      approvalStatus: "approved",
      name: "Concepto global",
      description: null,
      scope: "concept_global",
      documentRole: "purchase",
      priority: 800,
      source: "manual",
      createdFrom: "manual",
      vendorName: null,
      conceptName: "Servicios",
      accountLabel: "6102 - Servicios",
      conditionSummary: [],
      resultSummary: [],
      documentsAppliedCount: 0,
      matchesCount: 0,
      lastMatchedAt: null,
      lastEditedAt: "2026-03-21T10:00:00Z",
      pauseReason: null,
      sourceDocumentId: null,
      sourceDocumentLabel: null,
      supersedesRuleId: null,
      supersededByRuleId: null,
      searchableText: "concepto global",
    },
    {
      id: "rule-active-document",
      stableFamilyCode: null,
      versionNumber: 1,
      lifecycleStatus: "active",
      approvalStatus: "approved",
      name: "Override documento",
      description: null,
      scope: "document_override",
      documentRole: "purchase",
      priority: 1000,
      source: "manual",
      createdFrom: "manual",
      vendorName: null,
      conceptName: null,
      accountLabel: "6103 - Override",
      conditionSummary: [],
      resultSummary: [],
      documentsAppliedCount: 0,
      matchesCount: 0,
      lastMatchedAt: null,
      lastEditedAt: "2026-03-19T10:00:00Z",
      pauseReason: null,
      sourceDocumentId: null,
      sourceDocumentLabel: null,
      supersedesRuleId: null,
      supersededByRuleId: null,
      searchableText: "override documento",
    },
  ]);

  assert.deepEqual(
    ordered.map((item) => item.id),
    ["rule-active-document", "rule-active-concept", "rule-paused"],
  );
});

test("accounting rules admin matches created_from/source filters", () => {
  assert.equal(
    matchesAccountingRuleSourceFilter(
      { createdFrom: "learned_from_approval", source: "learned_from_approval" },
      "learning",
    ),
    true,
  );
  assert.equal(
    matchesAccountingRuleSourceFilter(
      { createdFrom: null, source: "manual" },
      "manual",
    ),
    true,
  );
  assert.equal(
    matchesAccountingRuleSourceFilter(
      { createdFrom: "migration", source: "migration" },
      "imported",
    ),
    false,
  );
});
