import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { TreasuryValeDetail } from "@/components/treasury/treasury-vale-detail";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadTreasuryDashboard } from "@/modules/treasury";

type TreasuryValeDetailPageProps = {
  params: Promise<{
    slug: string;
    valeId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Vale tesoreria",
};

export default async function TreasuryValeDetailPage({
  params,
}: TreasuryValeDetailPageProps) {
  const { slug, valeId } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const treasury = await loadTreasuryDashboard(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });

  if (!treasury.isAvailable) {
    notFound();
  }

  const vale = treasury.vales.find((entry) => entry.id === valeId);

  if (!vale) {
    notFound();
  }

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Tesoreria"
      toolbarLabel="Tesoreria"
      description="Detalle operativo de vale bancario, terminos y eventos."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "money")}
    >
      <TreasuryValeDetail slug={organization.slug} vale={vale} today={treasury.today} />
    </PrivateDashboardShell>
  );
}
