import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationAdvancedPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const advancedSections = [
  {
    title: "Importacion y staging",
    description: "Herramientas para lotes asistidos, previews auditados y planillas fuera del loop diario.",
    links: [
      {
        href: "audit",
        label: "Importacion masiva",
        description: "Preview estructurado, decisiones controladas e historico por corrida.",
      },
      {
        href: "imports",
        label: "Imports",
        description: "Entradas auxiliares y planillas de soporte.",
      },
    ],
  },
  {
    title: "Contabilidad experta",
    description: "Superficies para leer el kernel contable, navegar el plan y cruzar documentos con cuentas.",
    links: [
      {
        href: "trial-balance",
        label: "Balance de comprobacion",
        description: "Lectura del read model por cuenta, fuente y periodo.",
      },
      {
        href: "journal-entries",
        label: "Diario",
        description: "Asientos inmutables y trazabilidad de entradas reales.",
      },
      {
        href: "open-items",
        label: "Open items",
        description: "Pendientes de conciliacion y seguimiento operativo.",
      },
      {
        href: "chart-map",
        label: "Mapa contable",
        description: "Impacto documental y arbol del plan.",
      },
    ],
  },
  {
    title: "Automatizacion y salidas",
    description: "Gobernanza de criterios y puentes hacia sistemas externos.",
    links: [
      {
        href: "rules",
        label: "Reglas contables",
        description: "Gobernanza, simulacion y activacion de criterios reutilizables.",
      },
      {
        href: "exports",
        label: "Exports",
        description: "Bridge contable y salidas hacia ERP o estudio.",
      },
      {
        href: "settings",
        label: "Configuracion avanzada",
        description: "Setup experto, presets e integraciones.",
      },
    ],
  },
];

export const metadata: Metadata = {
  title: "Avanzado",
};

export default async function OrganizationAdvancedPage({
  params,
}: OrganizationAdvancedPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Avanzado"
      toolbarLabel="Avanzado"
      description="Entrada unica para las superficies expertas. Las rutas historicas siguen vivas, pero quedan agrupadas fuera del loop principal."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "advanced")}
    >
      <div className="space-y-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
                Superficies expertas
              </h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Usa estas vistas cuando necesites inspeccion profunda, imports asistidos,
                gobernanza o salidas externas. El flujo diario queda en Inicio, Documentos y Revision.
              </p>
            </div>
            <span className="status-pill status-pill--info">Rutas historicas preservadas</span>
          </div>
        </section>

        {advancedSections.map((section) => (
          <section key={section.title} className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">{section.title}</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  {section.description}
                </p>
              </div>
              <span className="ui-filter">{section.links.length}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.links.map((link) => (
                <LoadingLink
                  key={link.href}
                  href={`/app/o/${organization.slug}/${link.href}`}
                  pendingLabel="Abriendo..."
                  className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85"
                >
                  <p className="text-sm font-semibold text-white">{link.label}</p>
                  <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                    {link.description}
                  </p>
                </LoadingLink>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PrivateDashboardShell>
  );
}
