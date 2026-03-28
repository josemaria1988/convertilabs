export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const marketingNav: NavItem[] = [
  { href: "/contact", label: "Contacto" },
];

export const workspaceNav: NavItem[] = [
  { href: "/dashboard", label: "Inicio", description: "Centro de trabajo" },
  { href: "/documents", label: "Documentos", description: "Carga e ingreso" },
  { href: "/review", label: "Revision", description: "Cola principal de trabajo" },
  { href: "/tax", label: "Impuestos", description: "Flujo guiado del periodo" },
  { href: "/close", label: "Cierre", description: "Validacion y transiciones" },
  { href: "/settings", label: "Configuracion", description: "Empresa y setup" },
  { href: "/advanced", label: "Avanzado", description: "Superficies expertas" },
];
