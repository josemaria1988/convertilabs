export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const marketingNav: NavItem[] = [
  { href: "/product", label: "Producto" },
  { href: "/api", label: "API" },
  { href: "/pricing", label: "Precios" },
  { href: "/about", label: "Nosotros" },
  { href: "/contact", label: "Contacto" },
];

export const workspaceNav: NavItem[] = [
  { href: "/app", label: "Dashboard", description: "Resumen operativo" },
  { href: "/documents", label: "Documents", description: "Captura y validacion" },
  {
    href: "/journal-entries",
    label: "Journal entries",
    description: "Motor contable",
  },
  { href: "/tax", label: "Tax", description: "Calendario y cierres" },
  { href: "/settings", label: "Settings", description: "Configuracion" },
];
