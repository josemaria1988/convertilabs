export type OrganizationPrivateSection =
  | "dashboard"
  | "documents"
  | "journal_entries"
  | "tax"
  | "settings";

export function buildOrganizationPrivateNavItems(
  organizationSlug: string,
  currentSection: OrganizationPrivateSection,
) {
  return [
    {
      href: `/app/o/${organizationSlug}/dashboard`,
      label: "Dashboard",
      description: "Inbox privado y intake documental",
      current: currentSection === "dashboard",
    },
    {
      href: `/app/o/${organizationSlug}/documents`,
      label: "Documents",
      description: "Revision, draft y confirmacion",
      current: currentSection === "documents",
    },
    {
      href: `/app/o/${organizationSlug}/journal-entries`,
      label: "Journal entries",
      description: "Sugerencias y borradores contables",
      current: currentSection === "journal_entries",
    },
    {
      href: `/app/o/${organizationSlug}/tax`,
      label: "Tax",
      description: "IVA mensual y trazabilidad",
      current: currentSection === "tax",
    },
    {
      href: `/app/o/${organizationSlug}/settings`,
      label: "Settings",
      description: "Perfil fiscal y snapshots",
      current: currentSection === "settings",
    },
  ];
}
