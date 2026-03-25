import { requireOrganizationAppPage } from "@/modules/auth/server-auth";
import {
  normalizeAccountingRulesAdminFilters,
  type AccountingRulesAdminFilters,
} from "@/modules/accounting/rules-admin";

export type RulesSearchParams = {
  rule?: string;
  q?: string;
  status?: string;
  scope?: string;
  source?: string;
  vendorId?: string;
  accountId?: string;
  operationCategory?: string;
  conflicts?: string;
  unused?: string;
  simulation?: string;
  thread?: string;
  prompt?: string;
  tab?: string;
  assistant?: string;
};

export async function loadAccountingRulesPageContext(slug: string, returnTo: string) {
  const { authState, organization } = await requireOrganizationAppPage(slug, returnTo);

  if (!["owner", "admin", "accountant", "reviewer"].includes(organization.role)) {
    throw new Error("Tu rol no puede ver la administracion de reglas contables.");
  }

  return {
    authState,
    organization,
    canManage: ["owner", "admin", "accountant"].includes(organization.role),
    canDeleteRules: ["owner", "admin"].includes(organization.role),
  };
}

export function resolveRulesFilters(searchParams: Partial<RulesSearchParams> | null | undefined): AccountingRulesAdminFilters {
  return normalizeAccountingRulesAdminFilters({
    search: typeof searchParams?.q === "string" ? searchParams.q : "",
    status: typeof searchParams?.status === "string" ? searchParams.status : "all",
    scope: typeof searchParams?.scope === "string" ? searchParams.scope : "all",
    source: typeof searchParams?.source === "string" ? searchParams.source : "all",
    vendorId: typeof searchParams?.vendorId === "string" ? searchParams.vendorId : "all",
    accountId: typeof searchParams?.accountId === "string" ? searchParams.accountId : "all",
    operationCategory:
      typeof searchParams?.operationCategory === "string"
        ? searchParams.operationCategory
        : "all",
    onlyWithConflicts:
      typeof searchParams?.conflicts === "string" ? searchParams.conflicts : "",
    onlyUnused:
      typeof searchParams?.unused === "string" ? searchParams.unused : "",
  });
}

export function resolveDetailTab(value: string | undefined) {
  switch (value) {
    case "impact":
    case "conflicts":
    case "audit":
    case "more":
      return value;
    default:
      return "summary";
  }
}

export function resolveAssistantOpen(value: string | undefined) {
  return value === "1" || value === "true";
}
