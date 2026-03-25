import type { Metadata } from "next";
import { AccountingRuleDetailPanel } from "@/components/rules/accounting-rule-detail-panel";
import { AccountingRulesPageShell } from "@/components/rules/accounting-rules-page-shell";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import { loadAccountingRulesAdminPageData } from "@/modules/accounting/rules-admin";
import {
  loadAccountingRulesPageContext,
  resolveAssistantOpen,
  resolveDetailTab,
  resolveRulesFilters,
  type RulesSearchParams,
} from "../_helpers";

type AccountingRuleDetailPageProps = {
  params: Promise<{
    slug: string;
    ruleId: string;
  }>;
  searchParams?: Promise<RulesSearchParams>;
};

export const metadata: Metadata = {
  title: "Detalle de regla contable",
};

export default async function AccountingRuleDetailPage({
  params,
  searchParams,
}: AccountingRuleDetailPageProps) {
  const { slug, ruleId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = resolveRulesFilters(resolvedSearchParams);
  const activeTab = resolveDetailTab(resolvedSearchParams.tab);
  const assistantOpen =
    resolveAssistantOpen(resolvedSearchParams.assistant)
    || typeof resolvedSearchParams.prompt === "string";
  const { authState, organization, canManage, canDeleteRules } = await loadAccountingRulesPageContext(
    slug,
    `/app/o/${slug}/rules/${ruleId}`,
  );
  const data = await loadAccountingRulesAdminPageData({
    organizationId: organization.id,
    selectedRuleId: ruleId,
    selectedSimulationId:
      typeof resolvedSearchParams.simulation === "string" ? resolvedSearchParams.simulation : null,
    selectedThreadId:
      typeof resolvedSearchParams.thread === "string" ? resolvedSearchParams.thread : null,
  });

  return (
    <AccountingRulesPageShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Detalle de regla contable"
      description="Detalle dedicado con tabs de resumen, impacto, conflictos y auditoría, más análisis IA solo cuando se lo invoca."
    >
      <AccountingRuleDetailPanel
        slug={organization.slug}
        filters={filters}
        backHref={buildRulesAdminHref(organization.slug, {
          mode: "list",
          filters,
        })}
        rule={data.selectedRule}
        canManage={canManage}
        canDeleteRules={canDeleteRules}
        activeTab={activeTab}
        assistantOpen={assistantOpen}
        initialPrompt={typeof resolvedSearchParams.prompt === "string" ? resolvedSearchParams.prompt : null}
      />
    </AccountingRulesPageShell>
  );
}
