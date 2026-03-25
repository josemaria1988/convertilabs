import type { AccountingRulesAdminFilters } from "@/modules/accounting/rules-admin";

type RulesAdminHrefInput = {
  mode?: "list" | "detail" | "new" | "version";
  ruleId?: string | null;
  simulationId?: string | null;
  threadId?: string | null;
  prompt?: string | null;
  tab?: "summary" | "impact" | "conflicts" | "audit" | "more" | null;
  assistant?: boolean;
  filters?: Partial<AccountingRulesAdminFilters> | null;
};

export function buildRulesAdminHref(slug: string, input: RulesAdminHrefInput = {}) {
  const mode = input.mode ?? (input.ruleId ? "detail" : "list");
  const params = new URLSearchParams();
  let pathname = `/app/o/${slug}/rules`;

  if (mode === "detail" && input.ruleId) {
    pathname = `/app/o/${slug}/rules/${input.ruleId}`;
  }

  if (mode === "new") {
    pathname = `/app/o/${slug}/rules/new`;
  }

  if (mode === "version" && input.ruleId) {
    pathname = `/app/o/${slug}/rules/${input.ruleId}/version`;
  }

  if (input.simulationId) {
    params.set("simulation", input.simulationId);
  }

  if (input.threadId) {
    params.set("thread", input.threadId);
  }

  if (input.prompt) {
    params.set("prompt", input.prompt);
  }

  if (input.tab) {
    params.set("tab", input.tab);
  }

  if (input.assistant) {
    params.set("assistant", "1");
  }

  const filters = input.filters ?? null;

  if (filters?.search) {
    params.set("q", filters.search);
  }

  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters?.scope && filters.scope !== "all") {
    params.set("scope", filters.scope);
  }

  if (filters?.source && filters.source !== "all") {
    params.set("source", filters.source);
  }

  if (filters?.vendorId && filters.vendorId !== "all") {
    params.set("vendorId", filters.vendorId);
  }

  if (filters?.accountId && filters.accountId !== "all") {
    params.set("accountId", filters.accountId);
  }

  if (filters?.operationCategory && filters.operationCategory !== "all") {
    params.set("operationCategory", filters.operationCategory);
  }

  if (filters?.onlyWithConflicts) {
    params.set("conflicts", "1");
  }

  if (filters?.onlyUnused) {
    params.set("unused", "1");
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
