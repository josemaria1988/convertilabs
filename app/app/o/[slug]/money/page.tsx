import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { TreasuryWorkspace } from "@/components/treasury/treasury-workspace";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadMoneyDashboard } from "@/modules/money";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadTreasuryDashboard } from "@/modules/treasury";

type OrganizationMoneyPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    party?: string;
    work?: string;
    due?: string;
    tab?: string;
    withdrawalCurrency?: string;
    withdrawalAmount?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Tesoreria",
};

function parseDueFilter(value: string | null | undefined) {
  return value === "overdue" || value === "week" ? value : null;
}

function parseTreasuryTab(value: string | null | undefined) {
  return value === "banks"
    || value === "vales"
    || value === "receivables"
    || value === "open-items"
    || value === "subledger"
    ? value
    : "summary";
}

export default async function OrganizationMoneyPage({
  params,
  searchParams,
}: OrganizationMoneyPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [moneyData, treasuryData] = await Promise.all([
    loadMoneyDashboard(supabase, {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    searchTerm: resolvedSearchParams.q ?? null,
    partyId: resolvedSearchParams.party ?? null,
    workUnitId: resolvedSearchParams.work ?? null,
    dueFilter: parseDueFilter(resolvedSearchParams.due),
    }),
    loadTreasuryDashboard(supabase, {
      organizationId: organization.id,
      organizationSlug: organization.slug,
    }),
  ]);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Tesoreria"
      toolbarLabel="Tesoreria"
      description="Caja bancaria manual, vales, vencimientos, cobros y deudores/acreedores."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "money")}
    >
      <TreasuryWorkspace
        slug={organization.slug}
        data={treasuryData}
        moneyData={moneyData}
        activeTab={parseTreasuryTab(resolvedSearchParams.tab)}
        withdrawalCurrency={resolvedSearchParams.withdrawalCurrency ?? null}
        withdrawalAmount={resolvedSearchParams.withdrawalAmount ?? null}
      />
    </PrivateDashboardShell>
  );
}
