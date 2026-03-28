import type { ReactNode } from "react";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type AccountingRulesPageShellProps = {
  organizationName: string;
  organizationSlug: string;
  userEmail?: string | null;
  userRole: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AccountingRulesPageShell({
  organizationName,
  organizationSlug,
  userEmail,
  userRole,
  title,
  description,
  children,
}: AccountingRulesPageShellProps) {
  return (
    <PrivateDashboardShell
      organizationName={organizationName}
      organizationSlug={organizationSlug}
      userEmail={userEmail}
      userRole={userRole}
      title={title}
      toolbarLabel="Reglas contables"
      description={description}
      navItems={buildOrganizationPrivateNavItems(organizationSlug, "advanced")}
    >
      {children}
    </PrivateDashboardShell>
  );
}
