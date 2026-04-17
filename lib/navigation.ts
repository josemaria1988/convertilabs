export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const marketingNav: NavItem[] = [
  { href: "/contact", label: "Contacto" },
];

export const workspaceNav: NavItem[] = [
  { href: "/documents", label: "Bandeja Documental", description: "Inicio operativo y revision" },
  { href: "/settings?tab=chart", label: "Contabilidad", description: "Plan de cuentas" },
  { href: "/tax", label: "Impuestos (IVA)", description: "Reporte y estado del IVA" },
  { href: "/audit", label: "Auditoria", description: "Ingreso masivo documental" },
  { href: "/settings", label: "Configuracion", description: "Empresa e integraciones" },
];
