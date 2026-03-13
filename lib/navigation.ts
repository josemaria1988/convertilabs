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
  { href: "/app", label: "Inicio", description: "Resumen operativo" },
  { href: "/documents", label: "Documentos", description: "Captura y validacion" },
  {
    href: "/journal-entries",
    label: "Asientos",
    description: "Motor contable",
  },
  { href: "/tax", label: "Impuestos", description: "Calendario y cierres" },
  { href: "/settings", label: "Configuracion", description: "Configuracion" },
];
