import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { MoneyDashboard } from "@/components/money/money-dashboard";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadMoneyDashboard } from "@/modules/money";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationMoneyPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    party?: string;
    work?: string;
    due?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Dinero",
};

function parseDueFilter(value: string | null | undefined) {
  return value === "overdue" || value === "week" ? value : null;
}

export default async function OrganizationMoneyPage({
  params,
  searchParams,
}: OrganizationMoneyPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const data = await loadMoneyDashboard(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    searchTerm: resolvedSearchParams.q ?? null,
    partyId: resolvedSearchParams.party ?? null,
    workUnitId: resolvedSearchParams.work ?? null,
    dueFilter: parseDueFilter(resolvedSearchParams.due),
  });

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Dinero"
      toolbarLabel="Dinero"
      description="Deudores, acreedores, vencimientos y saldos vivos conectados a la operacion."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "money")}
    >
      <MoneyDashboard slug={organization.slug} data={data} />
    </PrivateDashboardShell>
  );
}
