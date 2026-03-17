import type { AccountingImpactPreview } from "@/modules/accounting/accounting-impact-preview";
import type { RuleApplicationExplanation } from "@/modules/accounting/rule-explainer";
import type {
  PostingTemplateCode,
  ReviewJournalSuggestion,
} from "@/modules/accounting/types";

export type ChartMapMode = "tree" | "impact" | "document";

export type ChartMapFilter =
  | "all"
  | "impacted"
  | "provisional"
  | "missing_external_code"
  | "warnings";

export type ChartMapNodeType =
  | "account"
  | "event"
  | "rule"
  | "template"
  | "document";

export type ChartMapEdgeType =
  | "hierarchy"
  | "matches_rule"
  | "uses_template"
  | "impacts"
  | "debit"
  | "credit";

export type ChartMapSeverity = "info" | "warning" | "critical";

export type ChartMapNode = {
  id: string;
  type: ChartMapNodeType;
  label: string;
  status?: "active" | "provisional" | "warning" | "inactive";
  parentId?: string;
  snapshotId: string;
  metadata: Record<string, unknown>;
};

export type ChartMapEdge = {
  id: string;
  type: ChartMapEdgeType;
  source: string;
  target: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

export type ChartMapWarning = {
  code: string;
  severity: ChartMapSeverity;
  message: string;
};

export type ChartMapAccountSummary = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalSide: string;
  isPostable: boolean;
  isProvisional: boolean;
  isActive: boolean;
  parentId: string | null;
  parentCode: string | null;
  systemRole: string | null;
  source: string | null;
  externalCode: string | null;
  taxProfileHint: string | null;
  currencyPolicy: string | null;
  statementSection: string | null;
  functionTag: string | null;
  cashflowTag: string | null;
  usage: {
    childCount: number;
    directRuleCount: number;
    templateCount: number;
    recentPostingCount: number;
  };
  warnings: ChartMapWarning[];
};

export type ChartMapTreeNode = ChartMapAccountSummary & {
  depth: number;
  matchedSearch: boolean;
  highlighted: boolean;
  children: ChartMapTreeNode[];
};

export type ChartMapEventDefinition = {
  id: PostingTemplateCode;
  label: string;
  description: string;
  documentRole: "sale" | "purchase" | "other";
  tags: string[];
};

export type ChartMapEventSummary = ChartMapEventDefinition & {
  matchingRuleCount: number;
  impactedAccountCount: number;
};

export type ChartMapImpactRuleSummary = {
  id: string;
  scope: string;
  priority: number | null;
  source: string | null;
  operationCategory: string | null;
  linkedOperationType: string | null;
  templateCode: PostingTemplateCode | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
};

export type ChartMapImpactView = {
  selectedEvent: ChartMapEventSummary;
  matchingRules: ChartMapImpactRuleSummary[];
  impactedAccounts: ChartMapAccountSummary[];
  nodes: ChartMapNode[];
  edges: ChartMapEdge[];
  warnings: ChartMapWarning[];
};

export type ChartMapDocumentPath = {
  documentId: string;
  label: string;
  direction: string;
  documentType: string | null;
  operationCategory: string | null;
  templateCode: PostingTemplateCode | null;
  appliedRuleScope: string;
  appliedRuleAccountId: string | null;
  appliedRuleAccountLabel: string | null;
  precedenceLadder: Array<{
    code: string;
    label: string;
    active: boolean;
  }>;
  journalSuggestion: ReviewJournalSuggestion;
  accountingImpactPreview: AccountingImpactPreview;
  ruleExplanation: RuleApplicationExplanation;
  nodes: ChartMapNode[];
  edges: ChartMapEdge[];
  warnings: ChartMapWarning[];
};

export type ChartMapPageData = {
  mode: ChartMapMode;
  searchTerm: string;
  filter: ChartMapFilter;
  summary: {
    accountCount: number;
    postableCount: number;
    provisionalCount: number;
    missingExternalCodeCount: number;
    activeRuleCount: number;
    eventCount: number;
  };
  events: ChartMapEventSummary[];
  tree: {
    selectedAccountId: string | null;
    selectedAccount: ChartMapAccountSummary | null;
    highlightedAccountIds: string[];
    nodes: ChartMapTreeNode[];
  };
  impact: ChartMapImpactView | null;
  document: ChartMapDocumentPath | null;
};
