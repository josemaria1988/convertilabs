import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { AgendaDashboard } from "@/components/operations/agenda-dashboard";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  canManageOperations,
  loadAgendaDashboard,
} from "@/modules/operations";
import { createAgendaTaskAction } from "./actions";

type OrganizationAgendaPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Agenda",
};

export default async function OrganizationAgendaPage({
  params,
}: OrganizationAgendaPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const data = await loadAgendaDashboard(
    getSupabaseServiceRoleClient(),
    organization.id,
  );

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Agenda"
      toolbarLabel="Agenda"
      description="Tareas, vencimientos y obligaciones operativas de la empresa."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "agenda")}
    >
      <AgendaDashboard
        slug={organization.slug}
        canManage={canManageOperations(organization.role)}
        data={data}
        createTaskAction={createAgendaTaskAction}
      />
    </PrivateDashboardShell>
  );
}
