import type { Metadata } from "next";
import { AccountingRuleEditor } from "@/components/rules/accounting-rule-editor";
import { AccountingRulesPageShell } from "@/components/rules/accounting-rules-page-shell";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import {
  loadAccountingRulesAdminEditorOptions,
  loadAccountingRulesAdminPageData,
} from "@/modules/accounting/rules-admin";
import {
  loadAccountingRulesPageContext,
  resolveRulesFilters,
  type RulesSearchParams,
} from "../../_helpers";

type AccountingRuleVersionPageProps = {
  params: Promise<{
    slug: string;
    ruleId: string;
  }>;
  searchParams?: Promise<RulesSearchParams>;
};

export const metadata: Metadata = {
  title: "Nueva version de regla contable",
};

export default async function AccountingRuleVersionPage({
  params,
  searchParams,
}: AccountingRuleVersionPageProps) {
  const { slug, ruleId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = resolveRulesFilters(resolvedSearchParams);
  const { authState, organization, canManage } = await loadAccountingRulesPageContext(
    slug,
    `/app/o/${slug}/rules/${ruleId}/version`,
  );

  if (!canManage) {
    throw new Error("Tu rol no puede versionar reglas contables.");
  }

  const [pageData, editorOptions] = await Promise.all([
    loadAccountingRulesAdminPageData({
      organizationId: organization.id,
      selectedRuleId: ruleId,
      selectedSimulationId:
        typeof resolvedSearchParams.simulation === "string" ? resolvedSearchParams.simulation : null,
    }),
    loadAccountingRulesAdminEditorOptions(organization.id),
  ]);

  return (
    <AccountingRulesPageShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Nueva version de regla contable"
      description="Versionado forward-only con simulación previa y trazabilidad completa de la regla histórica."
    >
      <AccountingRuleEditor
        slug={organization.slug}
        mode="version"
        backHref={buildRulesAdminHref(organization.slug, {
          mode: "detail",
          ruleId,
          filters,
        })}
        editorOptions={editorOptions}
        rule={pageData.selectedRule}
        initialSimulation={pageData.selectedRule?.selectedSimulation
          ? {
            simulationId: pageData.selectedRule.selectedSimulation.id,
            sampleSize: pageData.selectedRule.selectedSimulation.sampleSize,
            changedDocumentsCount: pageData.selectedRule.selectedSimulation.affectedDocumentsCount,
            examples: pageData.selectedRule.selectedSimulation.examples,
            summary: pageData.selectedRule.selectedSimulation.summary,
          }
          : null}
      />
    </AccountingRulesPageShell>
  );
}
