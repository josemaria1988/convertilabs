/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  deriveAccountingRuleLifecycleStatus,
  enrichRuleItemsWithConflicts,
  evaluateDeleteUnusedGuard,
  matchesAccountingRuleSourceFilter,
  normalizeAccountingRulesAdminFilters,
  resolvePrioritySwapTarget,
  resolveSupersedingRuleScopeFields,
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
    vendorId: "all",
    accountId: "all",
    operationCategory: "all",
    onlyWithConflicts: false,
    onlyUnused: false,
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
      vendorId: "all",
      accountId: "all",
      operationCategory: "all",
      onlyWithConflicts: false,
      onlyUnused: false,
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

test("accounting rules admin resolves scoped fields for superseding versions", () => {
  assert.deepEqual(
    resolveSupersedingRuleScopeFields({
      scope: "vendor_concept_operation_category",
      currentDocumentId: "doc-1",
      vendorId: "vendor-1",
      conceptId: "concept-1",
      operationCategory: "goods",
    }),
    {
      documentId: null,
      vendorId: "vendor-1",
      conceptId: "concept-1",
      operationCategory: "goods",
      errors: [],
    },
  );

  const invalid = resolveSupersedingRuleScopeFields({
    scope: "document_override",
    currentDocumentId: null,
    vendorId: null,
    conceptId: null,
    operationCategory: null,
  });

  assert.equal(invalid.documentId, null);
  assert.equal(invalid.errors.length, 1);
  assert.match(invalid.errors[0], /document override/i);
});

test("accounting rules admin blocks delete-unused when there is traceability or descendants", () => {
  assert.deepEqual(
    evaluateDeleteUnusedGuard({
      documentsAppliedCount: 0,
      matchesCount: 0,
      hasAssignmentUsage: false,
      hasDecisionLogUsage: false,
      hasActiveDescendant: false,
    }),
    {
      allowed: true,
      reason: null,
    },
  );

  assert.equal(
    evaluateDeleteUnusedGuard({
      documentsAppliedCount: 1,
      matchesCount: 0,
      hasAssignmentUsage: false,
      hasDecisionLogUsage: false,
      hasActiveDescendant: false,
    }).allowed,
    false,
  );

  assert.equal(
    evaluateDeleteUnusedGuard({
      documentsAppliedCount: 0,
      matchesCount: 0,
      hasAssignmentUsage: false,
      hasDecisionLogUsage: false,
      hasActiveDescendant: true,
    }).reason,
    "No se puede eliminar porque ya tiene una sucesora activa en la misma familia.",
  );
});

test("accounting rules admin enriches visible conflicts within overlapping segments", () => {
  const items = enrichRuleItemsWithConflicts([
    {
      id: "rule-op",
      stableFamilyCode: null,
      versionNumber: 1,
      lifecycleStatus: "active",
      approvalStatus: "approved",
      name: "Proveedor + concepto + op",
      description: null,
      scope: "vendor_concept_operation_category",
      documentRole: "purchase",
      priority: 900,
      vendorId: "vendor-1",
      conceptId: "concept-1",
      accountId: "account-1",
      operationCategory: "goods",
      source: "manual",
      createdFrom: "manual",
      vendorName: "Proveedor 1",
      conceptName: "Compras",
      accountLabel: "6101",
      conditionSummary: [],
      resultSummary: [],
      documentsAppliedCount: 0,
      matchesCount: 0,
      lastMatchedAt: null,
      lastEditedAt: null,
      pauseReason: null,
      sourceDocumentId: null,
      sourceDocumentLabel: null,
      supersedesRuleId: null,
      supersededByRuleId: null,
      hasConflicts: false,
      conflictCount: 0,
      conflictSummary: null,
      segmentKey: "vendor-1::concept-1::goods",
      searchableText: "proveedor",
    },
    {
      id: "rule-vendor-concept",
      stableFamilyCode: null,
      versionNumber: 1,
      lifecycleStatus: "active",
      approvalStatus: "approved",
      name: "Proveedor + concepto",
      description: null,
      scope: "vendor_concept",
      documentRole: "purchase",
      priority: 800,
      vendorId: "vendor-1",
      conceptId: "concept-1",
      accountId: "account-2",
      operationCategory: null,
      source: "manual",
      createdFrom: "manual",
      vendorName: "Proveedor 1",
      conceptName: "Compras",
      accountLabel: "6102",
      conditionSummary: [],
      resultSummary: [],
      documentsAppliedCount: 0,
      matchesCount: 0,
      lastMatchedAt: null,
      lastEditedAt: null,
      pauseReason: null,
      sourceDocumentId: null,
      sourceDocumentLabel: null,
      supersedesRuleId: null,
      supersededByRuleId: null,
      hasConflicts: false,
      conflictCount: 0,
      conflictSummary: null,
      segmentKey: "vendor-1::concept-1",
      searchableText: "proveedor",
    },
  ]);

  assert.equal(items[0].hasConflicts, true);
  assert.equal(items[1].hasConflicts, true);
});

test("accounting rules admin resolves the adjacent priority swap target inside one segment", () => {
  const baseRule = {
    id: "rule-2",
    scope: "vendor_concept",
    document_id: null,
    vendor_id: "vendor-1",
    concept_id: "concept-1",
    operation_category: null,
    document_role: "purchase",
  };
  const result = resolvePrioritySwapTarget({
    rules: [
      {
        id: "rule-1",
        organization_id: "org-1",
        scope: "vendor_concept",
        document_id: null,
        source_document_id: null,
        vendor_id: "vendor-1",
        concept_id: "concept-1",
        document_role: "purchase",
        account_id: "account-1",
        status: "approved",
        vat_profile_json: {},
        tax_profile_code: null,
        operation_category: null,
        linked_operation_type: null,
        template_code: null,
        times_reused: 0,
        times_corrected: 0,
        times_matched: 0,
        times_applied: 0,
        priority: 900,
        source: "manual",
        is_active: true,
        metadata: {},
        created_at: "2026-03-24T10:00:00Z",
      },
      {
        id: "rule-2",
        organization_id: "org-1",
        scope: "vendor_concept",
        document_id: null,
        source_document_id: null,
        vendor_id: "vendor-1",
        concept_id: "concept-1",
        document_role: "purchase",
        account_id: "account-2",
        status: "approved",
        vat_profile_json: {},
        tax_profile_code: null,
        operation_category: null,
        linked_operation_type: null,
        template_code: null,
        times_reused: 0,
        times_corrected: 0,
        times_matched: 0,
        times_applied: 0,
        priority: 800,
        source: "manual",
        is_active: true,
        metadata: {},
        created_at: "2026-03-24T10:00:00Z",
      },
    ],
    baseRule,
    currentRuleId: "rule-2",
    direction: "up",
  });

  assert.equal(result.otherRule.id, "rule-1");
});
