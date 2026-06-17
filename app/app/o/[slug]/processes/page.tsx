import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { ProcessesWorkspace } from "@/components/operations/processes-workspace";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  canManageOperations,
  loadOperationsWorkspace,
} from "@/modules/operations";
import {
  createCaptureNoteAction,
  createObligationAction,
  createProcessAction,
  startProcessRunAction,
} from "./actions";

type OrganizationProcessesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Procesos",
};

export default async function OrganizationProcessesPage({
  params,
}: OrganizationProcessesPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const data = await loadOperationsWorkspace(
    getSupabaseServiceRoleClient(),
    organization.id,
  );

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Procesos"
      toolbarLabel="Procesos"
      description="Procesos versionados, obligaciones y captura de conocimiento operativo."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "processes")}
    >
      <ProcessesWorkspace
        slug={organization.slug}
        canManage={canManageOperations(organization.role)}
        data={data}
        createProcessAction={createProcessAction}
        createObligationAction={createObligationAction}
        createCaptureNoteAction={createCaptureNoteAction}
        startProcessRunAction={startProcessRunAction}
      />
    </PrivateDashboardShell>
  );
}
