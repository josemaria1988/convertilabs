export type OrganizationPrivateSection =
  | "home"
  | "work"
  | "documents"
  | "review"
  | "audit"
  | "close"
  | "tax"
  | "money"
  | "agenda"
  | "directory"
  | "processes"
  | "continuity"
  | "settings"
  | "advanced";

type OrganizationPrivateNavItem = {
  href: string;
  label: string;
  description: string;
  icon: "home" | "work" | "tray" | "money" | "agenda" | "more" | "accounting" | "tax" | "audit" | "settings";
  current: boolean;
  mobilePrimary?: boolean;
};

function isDocumentsCurrent(currentSection: OrganizationPrivateSection) {
  return currentSection === "documents" || currentSection === "review";
}

function isMoreCurrent(currentSection: OrganizationPrivateSection) {
  return ["advanced", "audit", "close", "continuity", "directory", "processes", "settings", "tax"].includes(currentSection);
}

export function buildOrganizationPrivateNavItems(
  organizationSlug: string,
  currentSection: OrganizationPrivateSection,
): OrganizationPrivateNavItem[] {
  return [
    {
      href: `/app/o/${organizationSlug}/dashboard`,
      label: "Inicio",
      description: "Estado operativo real de la empresa y proximas acciones",
      icon: "home",
      current: currentSection === "home",
    },
    {
      href: `/app/o/${organizationSlug}/work`,
      label: "Trabajos",
      description: "Trabajos, proyectos y centros de costo conectados al modelo madre",
      icon: "work",
      current: currentSection === "work",
    },
    {
      href: `/app/o/${organizationSlug}/documents`,
      label: "Documentos",
      description: "Ingreso, revision y trazabilidad de comprobantes",
      icon: "tray",
      current: isDocumentsCurrent(currentSection),
    },
    {
      href: `/app/o/${organizationSlug}/money`,
      label: "Dinero",
      description: "Deudores, acreedores, vencimientos y saldos vivos",
      icon: "money",
      current: currentSection === "money",
    },
    {
      href: `/app/o/${organizationSlug}/agenda`,
      label: "Agenda",
      description: "Vencimientos, tareas y obligaciones operativas",
      icon: "agenda",
      current: currentSection === "agenda",
      mobilePrimary: false,
    },
    {
      href: `/app/o/${organizationSlug}/advanced`,
      label: "Mas",
      description: "Contabilidad, IVA, cierre, auditoria, integraciones y ajustes",
      icon: "more",
      current: isMoreCurrent(currentSection),
    },
  ];
}
