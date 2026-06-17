import type { Metadata } from "next";
import { CompanyHomeDashboard } from "@/components/dashboard/company-home-dashboard";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadCompanyHomeDashboard } from "@/modules/presentation/company-home-loader";

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
  const dashboard = await loadCompanyHomeDashboard(supabase, {
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Inicio"
      toolbarLabel="Inicio"
      description="Centro de mando operativo para mirar trabajos, documentos, dinero y proximas acciones reales."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "home")}
    >
      <CompanyHomeDashboard
        data={dashboard}
        organizationSlug={organization.slug}
      />
    </PrivateDashboardShell>
  );
}
