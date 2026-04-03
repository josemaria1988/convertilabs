import type { Metadata } from "next";
import { FieldProjectsManager } from "@/components/mobile/field-projects-manager";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  archiveFieldProjectAction,
  createFieldProjectAction,
} from "../actions";
import {
  loadFieldDocumentsCountByCostCenter,
  loadFieldWorkspaceData,
} from "../data";

type OrganizationFieldProjectsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Campo | Proyectos",
};

export default async function OrganizationFieldProjectsPage({
  params,
}: OrganizationFieldProjectsPageProps) {
  const { slug } = await params;
  const { organization } = await requireOrganizationDashboardPage(slug);
  const [workspace, documentsCountByProjectId] = await Promise.all([
    loadFieldWorkspaceData({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      includeArchivedProjects: true,
      limit: 20,
    }),
    loadFieldDocumentsCountByCostCenter(organization.id),
  ]);

  return (
    <FieldProjectsManager
      slug={organization.slug}
      projects={workspace.costCenters}
      documentsCountByProjectId={documentsCountByProjectId}
      createProjectAction={createFieldProjectAction.bind(null, organization.slug)}
      archiveProjectAction={archiveFieldProjectAction.bind(null, organization.slug)}
    />
  );
}
