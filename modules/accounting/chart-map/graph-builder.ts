import type {
  ChartMapAccountSummary,
  ChartMapDocumentPath,
  ChartMapEdge,
  ChartMapEdgeType,
  ChartMapEventSummary,
  ChartMapFilter,
  ChartMapImpactRuleSummary,
  ChartMapNode,
  ChartMapTreeNode,
  ChartMapWarning,
} from "@/modules/accounting/chart-map/types";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function buildAccountTreeNode(
  account: ChartMapAccountSummary,
  accountsByParentId: Map<string | null, ChartMapAccountSummary[]>,
  highlightedAccountIds: Set<string>,
  depth: number,
): ChartMapTreeNode {
  const children = (accountsByParentId.get(account.id) ?? [])
    .map((child) => buildAccountTreeNode(
      child,
      accountsByParentId,
      highlightedAccountIds,
      depth + 1,
    ));

  return {
    ...account,
    depth,
    matchedSearch: false,
    highlighted: highlightedAccountIds.has(account.id),
    children,
  } satisfies ChartMapTreeNode;
}

function applyTreeFilters(
  node: ChartMapTreeNode,
  searchTerm: string,
  filter: ChartMapFilter,
): ChartMapTreeNode | null {
  const normalizedSearch = normalizeSearch(searchTerm);
  const searchMatches =
    normalizedSearch.length === 0
    || node.code.toLowerCase().includes(normalizedSearch)
    || node.name.toLowerCase().includes(normalizedSearch)
    || (node.externalCode ?? "").toLowerCase().includes(normalizedSearch)
    || (node.taxProfileHint ?? "").toLowerCase().includes(normalizedSearch);
  const filterMatches =
    filter === "all"
    || (filter === "impacted" && node.highlighted)
    || (filter === "provisional" && node.isProvisional)
    || (filter === "missing_external_code" && node.isPostable && !node.externalCode)
    || (filter === "warnings" && node.warnings.length > 0);
  const filteredChildren = node.children
    .map((child) => applyTreeFilters(child, searchTerm, filter))
    .filter((child): child is ChartMapTreeNode => Boolean(child));
  const includeNode = (searchMatches && filterMatches) || filteredChildren.length > 0;

  if (!includeNode) {
    return null;
  }

  return {
    ...node,
    matchedSearch: searchMatches,
    children: filteredChildren,
  } satisfies ChartMapTreeNode;
}

export function buildChartMapTree(input: {
  accounts: ChartMapAccountSummary[];
  searchTerm: string;
  filter: ChartMapFilter;
  highlightedAccountIds: string[];
}) {
  const accountsByParentId = new Map<string | null, ChartMapAccountSummary[]>();

  for (const account of input.accounts) {
    const key = account.parentId;
    const bucket = accountsByParentId.get(key) ?? [];
    bucket.push(account);
    accountsByParentId.set(key, bucket);
  }

  const highlightedAccountIds = new Set(input.highlightedAccountIds);
  const roots = input.accounts
    .filter((account) => !account.parentId || !input.accounts.some((candidate) => candidate.id === account.parentId))
    .map((account) => buildAccountTreeNode(account, accountsByParentId, highlightedAccountIds, 0))
    .map((node) => applyTreeFilters(node, input.searchTerm, input.filter))
    .filter((node): node is ChartMapTreeNode => Boolean(node));

  return roots;
}

function buildNodeStatus(input: {
  warnings: ChartMapWarning[];
  isProvisional?: boolean;
}) {
  if (input.isProvisional) {
    return "provisional" as const;
  }

  if (input.warnings.some((warning) => warning.severity !== "info")) {
    return "warning" as const;
  }

  return "active" as const;
}

function pushImpactEdge(
  edges: ChartMapEdge[],
  source: string,
  target: string,
  type: ChartMapEdgeType,
  label?: string,
) {
  edges.push({
    id: `${source}:${type}:${target}`,
    type,
    source,
    target,
    label,
    metadata: {},
  });
}

export function buildImpactGraph(input: {
  selectedEvent: ChartMapEventSummary;
  matchingRules: ChartMapImpactRuleSummary[];
  impactedAccounts: ChartMapAccountSummary[];
}) {
  const nodes: ChartMapNode[] = [
    {
      id: `event:${input.selectedEvent.id}`,
      type: "event",
      label: input.selectedEvent.label,
      status: "active",
      snapshotId: "live",
      metadata: {
        description: input.selectedEvent.description,
        tags: input.selectedEvent.tags,
      },
    },
    {
      id: `template:${input.selectedEvent.id}`,
      type: "template",
      label: input.selectedEvent.label,
      status: "active",
      snapshotId: "live",
      metadata: {
        templateCode: input.selectedEvent.id,
      },
    },
  ];
  const edges: ChartMapEdge[] = [];

  pushImpactEdge(
    edges,
    `event:${input.selectedEvent.id}`,
    `template:${input.selectedEvent.id}`,
    "uses_template",
    "template",
  );

  for (const rule of input.matchingRules) {
    nodes.push({
      id: `rule:${rule.id}`,
      type: "rule",
      label: rule.scope,
      status: "active",
      snapshotId: "live",
      metadata: {
        priority: rule.priority,
        source: rule.source,
        operationCategory: rule.operationCategory,
      },
    });
    pushImpactEdge(
      edges,
      `event:${input.selectedEvent.id}`,
      `rule:${rule.id}`,
      "matches_rule",
      "regla",
    );
    pushImpactEdge(
      edges,
      `rule:${rule.id}`,
      `template:${input.selectedEvent.id}`,
      "uses_template",
      "template",
    );
  }

  for (const account of input.impactedAccounts) {
    nodes.push({
      id: `account:${account.id}`,
      type: "account",
      label: `${account.code} - ${account.name}`,
      status: buildNodeStatus({
        warnings: account.warnings,
        isProvisional: account.isProvisional,
      }),
      parentId: account.parentId ?? undefined,
      snapshotId: "live",
      metadata: {
        code: account.code,
        accountType: account.accountType,
        isPostable: account.isPostable,
      },
    });
    pushImpactEdge(
      edges,
      `template:${input.selectedEvent.id}`,
      `account:${account.id}`,
      "impacts",
      account.normalSide === "debit" ? "Debe" : "Haber",
    );
  }

  const warnings: ChartMapWarning[] = [];

  if (input.matchingRules.length === 0) {
    warnings.push({
      code: "no_matching_rules",
      severity: "warning",
      message: "Todavia no hay reglas activas enlazadas de forma explicita a este evento.",
    });
  }

  if (input.impactedAccounts.some((account) => account.isProvisional)) {
    warnings.push({
      code: "provisional_accounts",
      severity: "warning",
      message: "El evento usa al menos una cuenta provisional dentro del mapa actual.",
    });
  }

  return {
    nodes,
    edges,
    warnings,
  };
}

export function buildDocumentGraph(input: {
  document: ChartMapDocumentPath;
}) {
  return {
    nodes: input.document.nodes,
    edges: input.document.edges,
    warnings: input.document.warnings,
  };
}
