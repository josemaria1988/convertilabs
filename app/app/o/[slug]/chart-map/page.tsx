import type { Metadata } from "next";
import { AccountingImpactPreview } from "@/components/documents/accounting-impact-preview";
import { RuleApplicationCard } from "@/components/documents/rule-application-card";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { ChartImpactCanvas } from "@/components/chart-map/chart-impact-canvas";
import { ChartInspector } from "@/components/chart-map/chart-inspector";
import { ChartMapShell } from "@/components/chart-map/chart-map-shell";
import { ChartMapToolbar } from "@/components/chart-map/chart-map-toolbar";
import { ChartTreePanel } from "@/components/chart-map/chart-tree-panel";
import { DocumentImpactBanner } from "@/components/chart-map/document-impact-banner";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadChartMapPageData } from "@/modules/accounting/chart-map";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationChartMapPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    mode?: string;
    eventId?: string;
    accountId?: string;
    documentId?: string;
    search?: string;
    filter?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Mapa contable",
};

export default async function OrganizationChartMapPage({
  params,
  searchParams,
}: OrganizationChartMapPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const pageData = await loadChartMapPageData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    actorId: authState.user?.id ?? null,
    userRole: organization.role as
      | "owner"
      | "admin"
      | "admin_processing"
      | "accountant"
      | "reviewer"
      | "operator"
      | "viewer"
      | "developer",
    mode: resolvedSearchParams.mode ?? null,
    eventId: resolvedSearchParams.eventId ?? null,
    accountId: resolvedSearchParams.accountId ?? null,
    documentId: resolvedSearchParams.documentId ?? null,
    searchTerm: resolvedSearchParams.search ?? null,
    filter: resolvedSearchParams.filter ?? null,
  });
  const selectedEventId = pageData.impact?.selectedEvent.id ?? pageData.events[0]?.id ?? null;
  const selectedAccountId = pageData.tree.selectedAccountId;
  const documentId = pageData.document?.documentId ?? resolvedSearchParams.documentId ?? null;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Mapa contable"
      toolbarLabel="Mapa contable"
      description="Vista coordinada del plan, las reglas reutilizables y el impacto de documentos reales sin mezclar estructura con historicos."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "chart-map")}
    >
      <ChartMapShell
        summaryCards={(
          <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold text-white">Cuentas</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{pageData.summary.accountCount}</p>
            </article>
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold text-white">Postables</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{pageData.summary.postableCount}</p>
            </article>
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold text-white">Provisionales</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{pageData.summary.provisionalCount}</p>
            </article>
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold text-white">Sin externalCode</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{pageData.summary.missingExternalCodeCount}</p>
            </article>
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold text-white">Reglas activas</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{pageData.summary.activeRuleCount}</p>
            </article>
            <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold text-white">Eventos</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{pageData.summary.eventCount}</p>
            </article>
          </section>
        )}
        toolbar={(
          <ChartMapToolbar
            organizationSlug={organization.slug}
            mode={pageData.mode}
            selectedEventId={selectedEventId}
            selectedAccountId={selectedAccountId}
            documentId={documentId}
            searchTerm={pageData.searchTerm}
            filter={pageData.filter}
          />
        )}
        main={(
          <>
            {pageData.mode === "impact" ? (
              <>
                <ChartImpactCanvas
                  organizationSlug={organization.slug}
                  mode={pageData.mode}
                  selectedEventId={selectedEventId}
                  selectedAccountId={selectedAccountId}
                  documentId={documentId}
                  searchTerm={pageData.searchTerm}
                  filter={pageData.filter}
                  events={pageData.events}
                  impact={pageData.impact}
                />
                <ChartTreePanel
                  organizationSlug={organization.slug}
                  mode={pageData.mode}
                  selectedEventId={selectedEventId}
                  selectedAccountId={selectedAccountId}
                  documentId={documentId}
                  searchTerm={pageData.searchTerm}
                  filter={pageData.filter}
                  nodes={pageData.tree.nodes}
                />
              </>
            ) : null}

            {pageData.mode === "tree" ? (
              <ChartTreePanel
                organizationSlug={organization.slug}
                mode={pageData.mode}
                selectedEventId={selectedEventId}
                selectedAccountId={selectedAccountId}
                documentId={documentId}
                searchTerm={pageData.searchTerm}
                filter={pageData.filter}
                nodes={pageData.tree.nodes}
              />
            ) : null}

            {pageData.mode === "document" ? (
              pageData.document ? (
                <>
                  <DocumentImpactBanner document={pageData.document} />
                  <RuleApplicationCard explanation={pageData.document.ruleExplanation} />
                  <AccountingImpactPreview preview={pageData.document.accountingImpactPreview} />
                  <ChartTreePanel
                    organizationSlug={organization.slug}
                    mode={pageData.mode}
                    selectedEventId={selectedEventId}
                    selectedAccountId={selectedAccountId}
                    documentId={documentId}
                    searchTerm={pageData.searchTerm}
                    filter={pageData.filter}
                    nodes={pageData.tree.nodes}
                  />
                </>
              ) : (
                <section className="ui-panel">
                  <div className="ui-panel-header">
                    <div>
                      <h2 className="text-[16px] font-semibold text-white">Modo documento</h2>
                      <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                        Abre esta vista desde la revision documental para ver el camino exacto de un documento real.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-8 text-sm text-[color:var(--color-muted)]">
                    Todavia no hay un documento seleccionado o el draft persistido aun no esta listo para explicarlo en el mapa.
                  </div>
                </section>
              )
            ) : null}
          </>
        )}
        aside={(
          <ChartInspector
            mode={pageData.mode}
            summary={pageData.summary}
            selectedAccount={pageData.tree.selectedAccount}
            impact={pageData.impact}
            document={pageData.document}
          />
        )}
      />
    </PrivateDashboardShell>
  );
}
