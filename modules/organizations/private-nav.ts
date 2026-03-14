export type OrganizationPrivateSection =
  | "dashboard"
  | "documents"
  | "imports"
  | "journal_entries"
  | "open_items"
  | "tax"
  | "settings";

export function buildOrganizationPrivateNavItems(
  organizationSlug: string,
  currentSection: OrganizationPrivateSection,
) {
  return [
    {
      href: `/app/o/${organizationSlug}/dashboard`,
      label: "Inicio",
      description: "Bandeja operativa y estado del periodo",
      current: currentSection === "dashboard",
    },
    {
      href: `/app/o/${organizationSlug}/documents`,
      label: "Documentos",
      description: "Revision, original y draft persistido",
      current: currentSection === "documents",
    },
    {
      href: `/app/o/${organizationSlug}/imports`,
      label: "Importaciones",
      description: "Planillas, historicos y vista previa canonica",
      current: currentSection === "imports",
    },
    {
      href: `/app/o/${organizationSlug}/journal-entries`,
      label: "Asientos",
      description: "Sugerencias y borradores contables",
      current: currentSection === "journal_entries",
    },
    {
      href: `/app/o/${organizationSlug}/open-items`,
      label: "Saldos abiertos",
      description: "Saldos abiertos a cobrar y pagar",
      current: currentSection === "open_items",
    },
    {
      href: `/app/o/${organizationSlug}/tax`,
      label: "Impuestos",
      description: "IVA mensual y trazabilidad",
      current: currentSection === "tax",
    },
    {
      href: `/app/o/${organizationSlug}/settings`,
      label: "Configuracion",
      description: "Organizacion, perfil fiscal y plan de cuentas",
      current: currentSection === "settings",
    },
  ];
}
