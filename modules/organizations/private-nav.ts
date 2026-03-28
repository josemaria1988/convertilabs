export type OrganizationPrivateSection =
  | "home"
  | "documents"
  | "review"
  | "close"
  | "tax"
  | "settings"
  | "advanced";

type OrganizationPrivateNavItem = {
  href: string;
  label: string;
  description: string;
  icon: "home" | "documents" | "review" | "tax" | "close" | "settings" | "advanced";
  current: boolean;
};

export function buildOrganizationPrivateNavItems(
  organizationSlug: string,
  currentSection: OrganizationPrivateSection,
): OrganizationPrivateNavItem[] {
  return [
    {
      href: `/app/o/${organizationSlug}/dashboard`,
      label: "Inicio",
      description: "Centro de trabajo y prioridades del dia",
      icon: "home",
      current: currentSection === "home",
    },
    {
      href: `/app/o/${organizationSlug}/documents`,
      label: "Documentos",
      description: "Carga de originales e ingreso asistido",
      icon: "documents",
      current: currentSection === "documents",
    },
    {
      href: `/app/o/${organizationSlug}/review`,
      label: "Revision",
      description: "Cola principal por estados operativos",
      icon: "review",
      current: currentSection === "review",
    },
    {
      href: `/app/o/${organizationSlug}/tax`,
      label: "Impuestos",
      description: "Periodo IVA guiado y alertas fiscales",
      icon: "tax",
      current: currentSection === "tax",
    },
    {
      href: `/app/o/${organizationSlug}/close`,
      label: "Cierre",
      description: "Validator mensual y transiciones formales",
      icon: "close",
      current: currentSection === "close",
    },
    {
      href: `/app/o/${organizationSlug}/settings`,
      label: "Configuracion",
      description: "Empresa, perfil fiscal e integraciones",
      icon: "settings",
      current: currentSection === "settings",
    },
    {
      href: `/app/o/${organizationSlug}/advanced`,
      label: "Avanzado",
      description: "Importacion masiva, contabilidad y salidas expertas",
      icon: "advanced",
      current: currentSection === "advanced",
    },
  ];
}
