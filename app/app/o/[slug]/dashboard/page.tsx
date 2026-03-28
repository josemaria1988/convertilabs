import type { Metadata } from "next";
import { OrganizationWorkCenter } from "@/components/dashboard/organization-work-center";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listAllOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { loadMissingFxDocumentsSummary } from "@/modules/documents/spreadsheet-fx-resolution";
import {
  evaluateOrganizationLaunchScope,
  formatLaunchSupportLevelLabel,
} from "@/modules/launch/scope";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Inicio",
};

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [documents, missingFxSummary, organizationScopeRow] = await Promise.all([
    listAllOrganizationWorkspaceDocuments({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      sortOrder: "date_desc",
    }),
    loadMissingFxDocumentsSummary({
      organizationId: organization.id,
      supabase,
    }),
    supabase
      .from("organizations")
      .select("country_code, legal_entity_type, tax_regime_code, vat_regime")
      .eq("id", organization.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (organizationScopeRow.error) {
    throw new Error(organizationScopeRow.error.message);
  }

  const organizationScope = evaluateOrganizationLaunchScope({
    countryCode: organizationScopeRow.data?.country_code ?? "UY",
    legalEntityType: organizationScopeRow.data?.legal_entity_type ?? null,
    taxRegimeCode: organizationScopeRow.data?.tax_regime_code ?? null,
    vatRegime: organizationScopeRow.data?.vat_regime ?? null,
  });
  const supportLevelTone =
    organizationScope.supportLevel === "automatic"
      ? "success"
      : organizationScope.supportLevel === "assisted_only"
        ? "warning"
        : "danger";

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Inicio"
      toolbarLabel="Inicio"
      description="Centro de trabajo diario para orientar carga, revision, impuestos, cierre y superficies expertas."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "home")}
    >
      <OrganizationWorkCenter
        slug={organization.slug}
        documents={documents}
        supportLevelLabel={formatLaunchSupportLevelLabel(organizationScope.supportLevel)}
        supportLevelTone={supportLevelTone}
        supportReasons={organizationScope.reasons}
        missingFxSummary={missingFxSummary}
      />
    </PrivateDashboardShell>
  );
}
