import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DirectoryPage } from "@/components/directory/directory-page";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canManageDirectory,
  listDirectoryParties,
  PARTY_ROLE_TYPES,
  type PartyRoleType,
} from "@/modules/directory";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { createDirectoryPartyAction } from "./actions";

type OrganizationDirectoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    role?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Directorio",
};

function parseRoleFilter(value: string | null | undefined): PartyRoleType | null {
  if (value && (PARTY_ROLE_TYPES as readonly string[]).includes(value)) {
    return value as PartyRoleType;
  }

  return null;
}

export default async function OrganizationDirectoryPage({
  params,
  searchParams,
}: OrganizationDirectoryPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const roleFilter = parseRoleFilter(resolvedSearchParams.role);
  const searchTerm = resolvedSearchParams.q?.trim() || null;
  const data = await listDirectoryParties(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    searchTerm,
    roleFilter,
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Directorio"
      toolbarLabel="Directorio"
      description="Parties, contactos e historial operativo vinculado."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "directory")}
    >
      <DirectoryPage
        slug={organization.slug}
        canManage={canManageDirectory(organization.role)}
        data={data}
        searchTerm={searchTerm}
        roleFilter={roleFilter}
        createPartyAction={createDirectoryPartyAction}
      />
    </PrivateDashboardShell>
  );
}
