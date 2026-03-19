export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const marketingNav: NavItem[] = [
  { href: "/contact", label: "Contacto" },
];

export const workspaceNav: NavItem[] = [
  { href: "/documents", label: "Documentos", description: "Captura y validacion" },
  { href: "/audit", label: "Auditoria", description: "Preview y trazabilidad de imports" },
  { href: "/trial-balance", label: "Contabilidad", description: "Balance, diario y open items" },
  { href: "/tax", label: "Impuestos", description: "Calendario y cierres" },
  { href: "/chart-map", label: "Mapa contable", description: "Arbol e impacto" },
  { href: "/settings", label: "Configuracion", description: "Configuracion" },
];
