import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountingRulesPageShell } from "@/components/rules/accounting-rules-page-shell";
import { AccountingRulesTable } from "@/components/rules/accounting-rules-table";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import { loadAccountingRulesAdminPageData } from "@/modules/accounting/rules-admin";
import {
  loadAccountingRulesPageContext,
  resolveAssistantOpen,
  resolveDetailTab,
  resolveRulesFilters,
  type RulesSearchParams,
} from "./_helpers";

type AccountingRulesPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<RulesSearchParams>;
};

export const metadata: Metadata = {
  title: "Reglas contables",
};

export default async function AccountingRulesPage({
  params,
  searchParams,
}: AccountingRulesPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = resolveRulesFilters(resolvedSearchParams);

  if (typeof resolvedSearchParams.rule === "string" && resolvedSearchParams.rule) {
    const tab =
      typeof resolvedSearchParams.simulation === "string"
        ? "impact"
        : resolveAssistantOpen(resolvedSearchParams.assistant) || typeof resolvedSearchParams.thread === "string"
          ? "audit"
          : resolvedSearchParams.conflicts === "1"
            ? "conflicts"
            : resolveDetailTab(resolvedSearchParams.tab);

    redirect(buildRulesAdminHref(slug, {
      mode: "detail",
      ruleId: resolvedSearchParams.rule,
      simulationId: typeof resolvedSearchParams.simulation === "string" ? resolvedSearchParams.simulation : null,
      threadId: typeof resolvedSearchParams.thread === "string" ? resolvedSearchParams.thread : null,
      prompt: typeof resolvedSearchParams.prompt === "string" ? resolvedSearchParams.prompt : null,
      assistant:
        resolveAssistantOpen(resolvedSearchParams.assistant)
        || typeof resolvedSearchParams.prompt === "string"
        || typeof resolvedSearchParams.thread === "string",
      tab,
      filters,
    }));
  }

  const { authState, organization } = await loadAccountingRulesPageContext(
    slug,
    `/app/o/${slug}/rules`,
  );
  const data = await loadAccountingRulesAdminPageData({
    organizationId: organization.id,
    filters,
  });

  return (
    <AccountingRulesPageShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Reglas contables"
      description="Superficie operativa exclusiva para administrar reglas con claridad, lifecycle visible y flujos separados por intención."
    >
      <AccountingRulesTable
        slug={organization.slug}
        filters={data.filters}
        filterOptions={data.filterOptions}
        metrics={{
          total: data.metrics.total,
          active: data.metrics.active,
          paused: data.metrics.paused,
          superseded: data.metrics.superseded,
          createdFromLearning: data.metrics.createdFromLearning,
        }}
        rules={data.rules}
      />
    </AccountingRulesPageShell>
  );
}
