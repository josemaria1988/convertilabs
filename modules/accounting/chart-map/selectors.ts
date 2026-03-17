import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  loadOrganizationChartManagementData,
  type OrganizationChartAccount,
} from "@/modules/accounting/chart-admin";
import {
  buildChartMapTree,
  buildImpactGraph,
} from "@/modules/accounting/chart-map/graph-builder";
import {
  findChartMapEvent,
  listChartMapEvents,
  pickDefaultChartMapEvent,
} from "@/modules/accounting/chart-map/event-taxonomy";
import type {
  ChartMapAccountSummary,
  ChartMapDocumentPath,
  ChartMapFilter,
  ChartMapImpactRuleSummary,
  ChartMapMode,
  ChartMapPageData,
  ChartMapWarning,
} from "@/modules/accounting/chart-map/types";
import { loadActiveAccountingRules } from "@/modules/accounting/repository";
import type { PostingTemplateCode } from "@/modules/accounting/types";
import {
  formatAccountTypeLabel,
  formatNormalSideLabel,
  formatPostingTemplateCodeLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";
import {
  loadDocumentReviewPageData,
  MissingPersistedDraftError,
} from "@/modules/documents/review";

type ChartMapUserRole =
  | "owner"
  | "admin"
  | "admin_processing"
  | "accountant"
  | "reviewer"
  | "operator"
  | "viewer"
  | "developer";

function uniqueWarnings(warnings: ChartMapWarning[]) {
  return warnings.filter((warning, index, array) =>
    array.findIndex((candidate) => candidate.code === warning.code && candidate.message === warning.message) === index);
}

function buildAccountWarnings(account: OrganizationChartAccount, directRuleCount: number) {
  const warnings: ChartMapWarning[] = [];

  if (account.isProvisional) {
    warnings.push({
      code: "provisional_account",
      severity: "warning",
      message: "Cuenta provisional. Conviene reemplazarla antes del cierre final.",
    });
  }

  if (account.isPostable && !account.externalCode) {
    warnings.push({
      code: "missing_external_code",
      severity: "warning",
      message: "No tiene externalCode; puede afectar bridge o exportaciones contables.",
    });
  }

  if (account.isPostable && !account.taxProfileHint) {
    warnings.push({
      code: "missing_tax_profile_hint",
      severity: "info",
      message: "No tiene taxProfileHint explicito en metadata.",
    });
  }

  if (account.isPostable && directRuleCount === 0) {
    warnings.push({
      code: "unused_in_rules",
      severity: "info",
      message: "No aparece referenciada por reglas activas reutilizables.",
    });
  }

  return uniqueWarnings(warnings);
}

async function loadRecentPostingCountsByAccountId(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceDate = since.toISOString().slice(0, 10);
  const { data: entries, error: entriesError } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("organization_id", organizationId)
    .gte("entry_date", sinceDate)
    .limit(1000);

  if (entriesError) {
    throw new Error(entriesError.message);
  }

  const entryIds = ((entries as Array<{ id: string }> | null) ?? []).map((entry) => entry.id);

  if (entryIds.length === 0) {
    return new Map<string, number>();
  }

  const counts = new Map<string, number>();

  for (let index = 0; index < entryIds.length; index += 250) {
    const chunk = entryIds.slice(index, index + 250);
    const { data: lines, error: linesError } = await supabase
      .from("journal_entry_lines")
      .select("account_id")
      .in("journal_entry_id", chunk);

    if (linesError) {
      throw new Error(linesError.message);
    }

    for (const line of ((lines as Array<{ account_id: string }> | null) ?? [])) {
      counts.set(line.account_id, (counts.get(line.account_id) ?? 0) + 1);
    }
  }

  return counts;
}

function buildImpactRuleSummaries(input: {
  activeRules: Awaited<ReturnType<typeof loadActiveAccountingRules>>;
  accountsById: Map<string, ChartMapAccountSummary>;
}) {
  return input.activeRules.map((rule) => {
    const account = rule.account_id ? input.accountsById.get(rule.account_id) ?? null : null;

    return {
      id: rule.id,
      scope: formatRuleScopeLabel(rule.scope),
      priority: rule.priority,
      source: rule.source,
      operationCategory: rule.operation_category,
      linkedOperationType: rule.linked_operation_type,
      templateCode: rule.template_code as PostingTemplateCode | null,
      accountId: account?.id ?? rule.account_id,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
    } satisfies ChartMapImpactRuleSummary;
  });
}

function doesRuleMatchEvent(
  eventId: PostingTemplateCode,
  eventRole: "sale" | "purchase" | "other",
  rule: ChartMapImpactRuleSummary,
) {
  if (rule.templateCode === eventId) {
    return true;
  }

  if (rule.templateCode) {
    return false;
  }

  if (eventRole === "other") {
    return false;
  }

  const operationHints = [rule.operationCategory, rule.linkedOperationType]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (eventId.includes("sale") && operationHints.includes("sale")) {
    return true;
  }

  if (eventId.includes("purchase") && operationHints.includes("purchase")) {
    return true;
  }

  return false;
}

function buildDocumentPath(input: {
  pageData: Awaited<ReturnType<typeof loadDocumentReviewPageData>>;
}) {
  const { pageData } = input;
  const templateCode = pageData.derived.journalSuggestion.templateCode;
  const ruleScope = pageData.derived.appliedRule.scope;
  const nodes = [
    {
      id: `document:${pageData.document.id}`,
      type: "document" as const,
      label: pageData.document.originalFilename,
      status: "active" as const,
      snapshotId: "live",
      metadata: {
        direction: pageData.document.direction,
        documentType: pageData.document.documentType,
      },
    },
    {
      id: `rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}`,
      type: "rule" as const,
      label: formatRuleScopeLabel(ruleScope),
      status: pageData.derived.appliedRule.accountIsProvisional ? "provisional" as const : "active" as const,
      snapshotId: "live",
      metadata: {
        scope: ruleScope,
        provenance: pageData.derived.appliedRule.provenance,
      },
    },
    ...(templateCode
      ? [{
          id: `template:${templateCode}`,
          type: "template" as const,
          label: formatPostingTemplateCodeLabel(templateCode),
          status: "active" as const,
          snapshotId: "live",
          metadata: {
            templateCode,
          },
        }]
      : []),
    ...pageData.derived.journalSuggestion.lines
      .filter((line) => line.accountId)
      .map((line) => ({
        id: `account:${line.accountId}`,
        type: "account" as const,
        label: `${line.accountCode} - ${line.accountName}`,
        status: line.isProvisional ? "provisional" as const : "active" as const,
        snapshotId: "live",
        metadata: {
          side: line.debit > 0 ? "debit" : "credit",
          amount: line.debit > 0 ? line.debit : line.credit,
          linePurpose: line.linePurpose,
        },
      })),
  ];
  const edges = [
    {
      id: `document:${pageData.document.id}:matches_rule:rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}`,
      type: "matches_rule" as const,
      source: `document:${pageData.document.id}`,
      target: `rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}`,
      label: "resolucion",
      metadata: {},
    },
    ...(templateCode
      ? [{
          id: `rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}:uses_template:template:${templateCode}`,
          type: "uses_template" as const,
          source: `rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}`,
          target: `template:${templateCode}`,
          label: "template",
          metadata: {},
        }]
      : []),
    ...pageData.derived.journalSuggestion.lines
      .filter((line) => line.accountId)
      .map((line) => ({
        id: `${templateCode ? `template:${templateCode}` : `rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}`}:${line.debit > 0 ? "debit" : "credit"}:account:${line.accountId}`,
        type: (line.debit > 0 ? "debit" : "credit") as "debit" | "credit",
        source: templateCode
          ? `template:${templateCode}`
          : `rule:${pageData.derived.appliedRule.ruleId ?? "manual_review"}`,
        target: `account:${line.accountId}`,
        label: line.debit > 0 ? "Debe" : "Haber",
        metadata: {
          amount: line.debit > 0 ? line.debit : line.credit,
          linePurpose: line.linePurpose,
        },
      })),
  ];
  const precedenceOrder = [
    "document_override",
    "vendor_concept_operation_category",
    "vendor_concept",
    "concept_global",
    "vendor_default",
    "assistant",
    "manual_review",
  ];
  const warnings: ChartMapWarning[] = uniqueWarnings([
    ...pageData.accountingImpactPreview.warnings.map((warning) => ({
      code: "document_impact_warning",
      severity: "warning" as const,
      message: warning,
    })),
    ...pageData.ruleExplanation.riskNotes.map((warning) => ({
      code: "document_risk_note",
      severity: "warning" as const,
      message: warning,
    })),
  ]);

  return {
    documentId: pageData.document.id,
    label: pageData.document.originalFilename,
    direction: pageData.document.direction,
    documentType: pageData.document.documentType,
    operationCategory: pageData.draft.operationCategory,
    templateCode,
    appliedRuleScope: formatRuleScopeLabel(ruleScope),
    appliedRuleAccountId: pageData.derived.appliedRule.accountId,
    appliedRuleAccountLabel:
      pageData.derived.appliedRule.accountCode && pageData.derived.appliedRule.accountName
        ? `${pageData.derived.appliedRule.accountCode} - ${pageData.derived.appliedRule.accountName}`
        : null,
    precedenceLadder: precedenceOrder.map((code) => ({
      code,
      label: formatRuleScopeLabel(code),
      active: code === ruleScope,
    })),
    journalSuggestion: pageData.derived.journalSuggestion,
    accountingImpactPreview: pageData.accountingImpactPreview,
    ruleExplanation: pageData.ruleExplanation,
    nodes,
    edges,
    warnings,
  } satisfies ChartMapDocumentPath;
}

export async function loadChartMapPageData(input: {
  organizationId: string;
  organizationSlug: string;
  actorId: string | null;
  userRole: ChartMapUserRole;
  mode?: string | null;
  eventId?: string | null;
  accountId?: string | null;
  documentId?: string | null;
  searchTerm?: string | null;
  filter?: string | null;
}) {
  const mode: ChartMapMode =
    input.mode === "tree" || input.mode === "impact" || input.mode === "document"
      ? input.mode
      : input.documentId
        ? "document"
        : "impact";
  const filter: ChartMapFilter =
    input.filter === "impacted"
    || input.filter === "provisional"
    || input.filter === "missing_external_code"
    || input.filter === "warnings"
      ? input.filter
      : "all";
  const [chartData, recentPostingCountsByAccountId] = await Promise.all([
    loadOrganizationChartManagementData(input.organizationId),
    loadRecentPostingCountsByAccountId(input.organizationId),
  ]);
  const supabase = getSupabaseServiceRoleClient();
  const activeRules = await loadActiveAccountingRules(
    supabase,
    input.organizationId,
    null,
  );
  const directRuleCountByAccountId = new Map<string, number>();
  const templateCodesByAccountId = new Map<string, Set<string>>();

  for (const rule of activeRules) {
    directRuleCountByAccountId.set(
      rule.account_id,
      (directRuleCountByAccountId.get(rule.account_id) ?? 0) + 1,
    );

    if (rule.template_code) {
      const bucket = templateCodesByAccountId.get(rule.account_id) ?? new Set<string>();
      bucket.add(rule.template_code);
      templateCodesByAccountId.set(rule.account_id, bucket);
    }
  }

  const childCountByParentId = new Map<string, number>();

  for (const account of chartData.accounts) {
    if (account.parentId) {
      childCountByParentId.set(
        account.parentId,
        (childCountByParentId.get(account.parentId) ?? 0) + 1,
      );
    }
  }

  const accounts = chartData.accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    accountType: formatAccountTypeLabel(account.accountType),
    normalSide: formatNormalSideLabel(account.normalSide),
    isPostable: account.isPostable,
    isProvisional: account.isProvisional,
    isActive: account.isActive,
    parentId: account.parentId,
    parentCode: account.parentCode,
    systemRole: account.systemRole,
    source: account.source,
    externalCode: account.externalCode,
    taxProfileHint: account.taxProfileHint,
    currencyPolicy: account.currencyPolicy,
    statementSection: account.statementSection,
    functionTag: account.functionTag,
    cashflowTag: account.cashflowTag,
    usage: {
      childCount: childCountByParentId.get(account.id) ?? 0,
      directRuleCount: directRuleCountByAccountId.get(account.id) ?? 0,
      templateCount: templateCodesByAccountId.get(account.id)?.size ?? 0,
      recentPostingCount: recentPostingCountsByAccountId.get(account.id) ?? 0,
    },
    warnings: buildAccountWarnings(account, directRuleCountByAccountId.get(account.id) ?? 0),
  } satisfies ChartMapAccountSummary));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const impactRules = buildImpactRuleSummaries({
    activeRules,
    accountsById,
  });
  const events = listChartMapEvents().map((event) => {
    const matchingRules = impactRules.filter((rule) => doesRuleMatchEvent(
      event.id,
      event.documentRole,
      rule,
    ));
    const impactedAccounts = Array.from(new Set(
      matchingRules.map((rule) => rule.accountId).filter((accountId): accountId is string => Boolean(accountId)),
    ));

    return {
      ...event,
      matchingRuleCount: matchingRules.length,
      impactedAccountCount: impactedAccounts.length,
    };
  });
  const selectedEvent = findChartMapEvent(input.eventId)
    ?? pickDefaultChartMapEvent(new Set(
      impactRules
        .map((rule) => rule.templateCode)
        .filter((templateCode): templateCode is PostingTemplateCode => Boolean(templateCode)),
    ));
  const selectedEventSummary = selectedEvent
    ? events.find((event) => event.id === selectedEvent.id) ?? null
    : null;
  const impact = selectedEventSummary
    ? (() => {
        const matchingRules = impactRules.filter((rule) => doesRuleMatchEvent(
          selectedEventSummary.id,
          selectedEventSummary.documentRole,
          rule,
        ));
        const impactedAccounts = Array.from(new Set(
          matchingRules.map((rule) => rule.accountId).filter((accountId): accountId is string => Boolean(accountId)),
        )).map((accountId) => accountsById.get(accountId)).filter((account): account is ChartMapAccountSummary => Boolean(account));
        const graph = buildImpactGraph({
          selectedEvent: selectedEventSummary,
          matchingRules,
          impactedAccounts,
        });

        return {
          selectedEvent: selectedEventSummary,
          matchingRules,
          impactedAccounts,
          nodes: graph.nodes,
          edges: graph.edges,
          warnings: graph.warnings,
        };
      })()
    : null;
  let document: ChartMapDocumentPath | null = null;

  if (input.documentId) {
    try {
      const pageData = await loadDocumentReviewPageData({
        organizationId: input.organizationId,
        organizationSlug: input.organizationSlug,
        documentId: input.documentId,
        actorId: input.actorId,
        userRole: input.userRole,
      });
      document = buildDocumentPath({
        pageData,
      });
    } catch (error) {
      if (!(error instanceof MissingPersistedDraftError)) {
        throw error;
      }
    }
  }

  const highlightedAccountIds =
    mode === "document" && document
      ? Array.from(new Set(
          document.journalSuggestion.lines
            .map((line) => line.accountId)
            .filter((accountId): accountId is string => Boolean(accountId)),
        ))
      : impact?.impactedAccounts.map((account) => account.id) ?? [];
  const selectedAccount =
    (input.accountId ? accountsById.get(input.accountId) ?? null : null)
    ?? (mode === "document" && document?.appliedRuleAccountId
      ? accountsById.get(document.appliedRuleAccountId) ?? null
      : null)
    ?? (highlightedAccountIds[0] ? accountsById.get(highlightedAccountIds[0]) ?? null : null)
    ?? accounts[0]
    ?? null;
  const treeNodes = buildChartMapTree({
    accounts,
    searchTerm: input.searchTerm ?? "",
    filter,
    highlightedAccountIds,
  });

  return {
    mode,
    searchTerm: input.searchTerm?.trim() ?? "",
    filter,
    summary: {
      accountCount: accounts.length,
      postableCount: accounts.filter((account) => account.isPostable).length,
      provisionalCount: accounts.filter((account) => account.isProvisional).length,
      missingExternalCodeCount: accounts.filter((account) => account.isPostable && !account.externalCode).length,
      activeRuleCount: impactRules.length,
      eventCount: events.length,
    },
    events,
    tree: {
      selectedAccountId: selectedAccount?.id ?? null,
      selectedAccount,
      highlightedAccountIds,
      nodes: treeNodes,
    },
    impact,
    document,
  } satisfies ChartMapPageData;
}
