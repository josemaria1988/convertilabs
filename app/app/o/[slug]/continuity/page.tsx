import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { ContinuityDashboard } from "@/components/operations/continuity-dashboard";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadContinuityDashboard } from "@/modules/operations";

type OrganizationContinuityPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Continuidad",
};

export default async function OrganizationContinuityPage({
  params,
}: OrganizationContinuityPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const data = await loadContinuityDashboard(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Continuidad"
      toolbarLabel="Continuidad"
      description="Riesgos de continuidad, dependencias humanas y conocimiento pendiente de estructurar."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "continuity")}
    >
      <ContinuityDashboard slug={organization.slug} data={data} />
    </PrivateDashboardShell>
  );
}
