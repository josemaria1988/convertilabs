import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { WorkListPage } from "@/components/work/work-list-page";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  canMutateWorkUnit,
  listOrganizationWorkUnits,
} from "@/modules/work";
import { createOrganizationWorkUnitAction } from "./actions";

type OrganizationWorkPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Trabajos",
};

export default async function OrganizationWorkPage({
  params,
}: OrganizationWorkPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const work = await listOrganizationWorkUnits(
    getSupabaseServiceRoleClient(),
    organization.id,
  );

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Trabajos"
      toolbarLabel="Trabajos"
      description="Trabajos, proyectos y centros de costo conectados al modelo madre."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "work")}
    >
      <WorkListPage
        slug={organization.slug}
        canManage={canMutateWorkUnit(organization.role)}
        isAvailable={work.isAvailable}
        items={work.items}
        customerOptions={work.customerOptions}
        createAction={createOrganizationWorkUnitAction}
      />
    </PrivateDashboardShell>
  );
}
