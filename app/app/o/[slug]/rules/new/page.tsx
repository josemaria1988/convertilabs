import type { Metadata } from "next";
import { AccountingRuleEditor } from "@/components/rules/accounting-rule-editor";
import { AccountingRulesPageShell } from "@/components/rules/accounting-rules-page-shell";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import { loadAccountingRulesAdminEditorOptions } from "@/modules/accounting/rules-admin";
import {
  loadAccountingRulesPageContext,
  resolveRulesFilters,
  type RulesSearchParams,
} from "../_helpers";

type AccountingRuleNewPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<RulesSearchParams>;
};

export const metadata: Metadata = {
  title: "Nueva regla contable",
};

export default async function AccountingRuleNewPage({
  params,
  searchParams,
}: AccountingRuleNewPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = resolveRulesFilters(resolvedSearchParams);
  const { authState, organization, canManage } = await loadAccountingRulesPageContext(
    slug,
    `/app/o/${slug}/rules/new`,
  );

  if (!canManage) {
    throw new Error("Tu rol no puede crear reglas contables.");
  }

  const editorOptions = await loadAccountingRulesAdminEditorOptions(organization.id);

  return (
    <AccountingRulesPageShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Nueva regla contable"
      description="Flujo dedicado para crear reglas nuevas sin superponer detalle, lifecycle o análisis consultivo."
    >
      <AccountingRuleEditor
        slug={organization.slug}
        mode="create"
        backHref={buildRulesAdminHref(organization.slug, {
          mode: "list",
          filters,
        })}
        editorOptions={editorOptions}
      />
    </AccountingRulesPageShell>
  );
}
