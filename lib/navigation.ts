export type NavItem = {
  href: string;
  label: string;
  description?: string;
};

export const marketingNav: NavItem[] = [
  { href: "/contact", label: "Contacto" },
];

export const workspaceNav: NavItem[] = [
  { href: "/dashboard", label: "Inicio", description: "Estado operativo y proximas acciones" },
  { href: "/work", label: "Trabajos", description: "Trabajos y proyectos" },
  { href: "/documents", label: "Documentos", description: "Ingreso y revision" },
  { href: "/money", label: "Tesoreria", description: "Caja, bancos y saldos vivos" },
  { href: "/agenda", label: "Agenda", description: "Tareas y obligaciones" },
  { href: "/advanced", label: "Mas", description: "Contabilidad, IVA, cierre y ajustes" },
];
