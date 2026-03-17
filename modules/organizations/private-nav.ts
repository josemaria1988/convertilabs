export type OrganizationPrivateSection =
  | "documents"
  | "tax"
  | "chart-map"
  | "settings";

export function buildOrganizationPrivateNavItems(
  organizationSlug: string,
  currentSection: OrganizationPrivateSection,
) {
  return [
    {
      href: `/app/o/${organizationSlug}/documents`,
      label: "Documentos",
      description: "Bandeja operativa, revision y posting",
      current: currentSection === "documents",
    },
    {
      href: `/app/o/${organizationSlug}/tax`,
      label: "Impuestos",
      description: "IVA mensual, lifecycle y conciliacion",
      current: currentSection === "tax",
    },
    {
      href: `/app/o/${organizationSlug}/chart-map`,
      label: "Mapa contable",
      description: "Arbol, impacto y documentos reales",
      current: currentSection === "chart-map",
    },
    {
      href: `/app/o/${organizationSlug}/settings`,
      label: "Configuracion",
      description: "Perfil fiscal, presets y plan de cuentas",
      current: currentSection === "settings",
    },
  ];
}
