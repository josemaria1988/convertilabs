export type OrganizationPrivateSection =
  | "home"
  | "documents"
  | "review"
  | "audit"
  | "close"
  | "tax"
  | "settings"
  | "advanced";

type OrganizationPrivateNavItem = {
  href: string;
  label: string;
  description: string;
  icon: "tray" | "accounting" | "tax" | "audit" | "settings";
  current: boolean;
};

function isDocumentsCurrent(currentSection: OrganizationPrivateSection) {
  return currentSection === "home" || currentSection === "documents" || currentSection === "review";
}

function isAccountingCurrent(currentSection: OrganizationPrivateSection) {
  return currentSection === "advanced" || currentSection === "close";
}

export function buildOrganizationPrivateNavItems(
  organizationSlug: string,
  currentSection: OrganizationPrivateSection,
): OrganizationPrivateNavItem[] {
  return [
    {
      href: `/app/o/${organizationSlug}/documents`,
      label: "Bandeja Documental",
      description: "Inicio operativo, revision y criterio de IA por documento",
      icon: "tray",
      current: isDocumentsCurrent(currentSection),
    },
    {
      href: `/app/o/${organizationSlug}/settings?tab=chart`,
      label: "Contabilidad",
      description: "Plan de cuentas, cierres y superficies contables",
      icon: "accounting",
      current: isAccountingCurrent(currentSection),
    },
    {
      href: `/app/o/${organizationSlug}/tax`,
      label: "Impuestos (IVA)",
      description: "Reporte IVA y contraste operativo contra DGI",
      icon: "tax",
      current: currentSection === "tax",
    },
    {
      href: `/app/o/${organizationSlug}/audit`,
      label: "Auditoria",
      description: "Ingreso masivo, staging y control documental",
      icon: "audit",
      current: currentSection === "audit",
    },
    {
      href: `/app/o/${organizationSlug}/settings`,
      label: "Configuracion",
      description: "Empresa, accesos, fiscalidad e integraciones",
      icon: "settings",
      current: currentSection === "settings",
    },
  ];
}
