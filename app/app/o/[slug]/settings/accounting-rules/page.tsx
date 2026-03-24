import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { LoadingLink } from "@/components/ui/loading-link";
import { AccountingRuleDetailPanel } from "@/components/rules/accounting-rule-detail-panel";
import { AccountingRulesTable } from "@/components/rules/accounting-rules-table";
import { requireOrganizationAppPage } from "@/modules/auth/server-auth";
import {
  loadAccountingRulesAdminPageData,
  normalizeAccountingRulesAdminFilters,
} from "@/modules/accounting/rules-admin";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type AccountingRulesPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    rule?: string;
    q?: string;
    status?: string;
    scope?: string;
    source?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Reglas contables",
};

function assertAccountingRulesViewerRole(role: string) {
  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
    throw new Error("Tu rol no puede ver la administracion de reglas contables.");
  }
}

export default async function AccountingRulesPage({
  params,
  searchParams,
}: AccountingRulesPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/settings/accounting-rules`,
  );

  assertAccountingRulesViewerRole(organization.role);

  const data = await loadAccountingRulesAdminPageData({
    organizationId: organization.id,
    selectedRuleId:
      typeof resolvedSearchParams.rule === "string" ? resolvedSearchParams.rule : null,
    filters: normalizeAccountingRulesAdminFilters({
      search: typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "",
      status: typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : "all",
      scope: typeof resolvedSearchParams.scope === "string" ? resolvedSearchParams.scope : "all",
      source: typeof resolvedSearchParams.source === "string" ? resolvedSearchParams.source : "all",
    }),
  });
  const canManage = ["owner", "admin", "accountant"].includes(organization.role);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Reglas contables"
      toolbarLabel="Reglas contables"
      description="Gobernanza operativa de reglas, pausa controlada, auditoria visible y detalle por criterio reusable."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "settings")}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="metric-card">
          <span className="metric-card__label">Reglas totales</span>
          <span className="metric-card__value">{data.metrics.total}</span>
          <p className="metric-card__hint">Inventario visible de la organizacion.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Activas</span>
          <span className="metric-card__value">{data.metrics.active}</span>
          <p className="metric-card__hint">Compiten en nuevas corridas.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Pausadas</span>
          <span className="metric-card__value">{data.metrics.paused}</span>
          <p className="metric-card__hint">Fuera de precedencia sin borrar historia.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Reemplazadas</span>
          <span className="metric-card__value">{data.metrics.superseded}</span>
          <p className="metric-card__hint">Quedan auditables para historico.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Desde learning</span>
          <span className="metric-card__value">{data.metrics.createdFromLearning}</span>
          <p className="metric-card__hint">Nacidas desde aprobacion documental.</p>
        </article>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[18px] font-semibold text-white">Superficie operativa dedicada</h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Esta vista no reemplaza Documentos: concentra lifecycle, cobertura y auditoria de reglas reusables.
            </p>
          </div>
          <LoadingLink
            href={`/app/o/${organization.slug}/settings`}
            pendingLabel="Volviendo..."
            className="ui-button ui-button--secondary"
          >
            Volver a Configuracion
          </LoadingLink>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <AccountingRulesTable
          slug={organization.slug}
          filters={data.filters}
          rules={data.rules}
          selectedRuleId={data.selectedRuleId}
        />
        <AccountingRuleDetailPanel
          slug={organization.slug}
          rule={data.selectedRule}
          canManage={canManage}
        />
      </div>
    </PrivateDashboardShell>
  );
}
