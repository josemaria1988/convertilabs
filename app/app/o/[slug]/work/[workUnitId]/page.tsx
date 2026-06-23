import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { WorkDetailPage } from "@/components/work/work-detail-page";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  canMutateWorkUnit,
  listWorkUnitDocumentOptions,
  loadWorkUnitDetail,
} from "@/modules/work";
import { listWorkIntakeItems } from "@/modules/work-intake";
import { assignDocumentToCurrentWorkUnitAction } from "../actions";

type OrganizationWorkDetailPageProps = {
  params: Promise<{
    slug: string;
    workUnitId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Detalle de trabajo",
};

export default async function OrganizationWorkDetailPage({
  params,
}: OrganizationWorkDetailPageProps) {
  const { slug, workUnitId } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [workUnit, documentOptions, workIntake] = await Promise.all([
    loadWorkUnitDetail(supabase, {
      organizationId: organization.id,
      workUnitId,
    }),
    listWorkUnitDocumentOptions(supabase, {
      organizationId: organization.id,
      workUnitId,
    }),
    listWorkIntakeItems(supabase, {
      organizationId: organization.id,
      workUnitId,
      includeClosed: true,
      limit: 20,
    }),
  ]);

  if (!workUnit) {
    notFound();
  }

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title={workUnit.name}
      toolbarLabel="Trabajos"
      description="Detalle operativo del trabajo, cliente, documentos y margen."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "work")}
    >
      <WorkDetailPage
        slug={organization.slug}
        workUnit={workUnit}
        canManage={canMutateWorkUnit(organization.role)}
        documentOptions={documentOptions}
        workIntakeItems={workIntake.items}
        assignDocumentAction={assignDocumentToCurrentWorkUnitAction}
      />
    </PrivateDashboardShell>
  );
}
