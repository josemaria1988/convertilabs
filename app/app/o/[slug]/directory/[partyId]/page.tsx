import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { PartyProfilePage } from "@/components/directory/party-profile-page";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canManageDirectory,
  loadPartyProfile,
} from "@/modules/directory";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import {
  addPartyContactAction,
  createPartyInteractionAction,
} from "../actions";

type OrganizationPartyProfilePageProps = {
  params: Promise<{
    slug: string;
    partyId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Perfil party",
};

export default async function OrganizationPartyProfilePage({
  params,
}: OrganizationPartyProfilePageProps) {
  const { slug, partyId } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const data = await loadPartyProfile(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    partyId,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Perfil party"
      toolbarLabel="Directorio"
      description="Roles, contactos, trabajos, documentos, dinero, tareas e historial."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "directory")}
    >
      <PartyProfilePage
        slug={organization.slug}
        canManage={canManageDirectory(organization.role)}
        data={data}
        addContactAction={addPartyContactAction}
        createInteractionAction={createPartyInteractionAction}
      />
    </PrivateDashboardShell>
  );
}
