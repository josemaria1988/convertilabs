import type { Metadata } from "next";
import { DashboardDocumentWorkspace } from "@/components/dashboard/dashboard-document-workspace";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Inicio",
};

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusBucket(status: string) {
  if (["uploading", "queued", "extracting"].includes(status)) {
    return "processing";
  }

  if (["draft_ready", "needs_review", "classified_with_open_revision"].includes(status)) {
    return "review";
  }

  if (["classified", "approved"].includes(status)) {
    return "done";
  }

  return "other";
}

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const serviceRole = getSupabaseServiceRoleClient();
  const [workspaceDocuments, vatRuns, journalDraftCountResult] = await Promise.all([
    listOrganizationWorkspaceDocuments({
      organizationId: organization.id,
      organizationSlug: organization.slug,
    }),
    loadOrganizationVatRuns(serviceRole, organization.id),
    serviceRole
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "draft"),
  ]);

  const latestVatRun = vatRuns[0] ?? null;
  const dashboardDocuments = workspaceDocuments.slice(0, 5);
  const processingCount = workspaceDocuments.filter((document) => getStatusBucket(document.status) === "processing").length;
  const reviewCount = workspaceDocuments.filter((document) => getStatusBucket(document.status) === "review").length;
  const doneCount = workspaceDocuments.filter((document) => getStatusBucket(document.status) === "done").length;
  const completionRate = workspaceDocuments.length > 0
    ? Math.round((doneCount / workspaceDocuments.length) * 100)
    : 0;
  const chartRows = [
    {
      label: "M001",
      blue: Math.max(processingCount + 1, 1),
      green: Math.max(doneCount, 1),
      amber: Math.max(reviewCount, 1),
      line: Math.max(doneCount + reviewCount, 1),
    },
    {
      label: "M002",
      blue: Math.max(reviewCount + 2, 1),
      green: Math.max(doneCount + 1, 1),
      amber: Math.max(processingCount + 1, 1),
      line: Math.max(doneCount + 2, 1),
    },
    {
      label: "M003",
      blue: Math.max(doneCount + 2, 1),
      green: Math.max(processingCount + 1, 1),
      amber: Math.max(reviewCount + 1, 1),
      line: Math.max(doneCount + reviewCount + 1, 1),
    },
    {
      label: "M004",
      blue: Math.max(reviewCount + 1, 1),
      green: Math.max(doneCount + 2, 1),
      amber: Math.max(processingCount, 1),
      line: Math.max(doneCount + 3, 1),
    },
    {
      label: "M005",
      blue: Math.max(doneCount + 1, 1),
      green: Math.max(reviewCount + 1, 1),
      amber: Math.max(processingCount + 2, 1),
      line: Math.max(doneCount + reviewCount + 2, 1),
    },
  ];
  const chartMax = Math.max(
    ...chartRows.flatMap((row) => [row.blue, row.green, row.amber, row.line]),
    1,
  );

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Inicio"
      toolbarLabel="Declaraciones"
      description="Cockpit principal con KPIs, tabla documental densa, preview blanco y resumen fiscal compacto."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "dashboard")}
    >
      <section className="grid gap-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_1.18fr]">
        <article className="metric-card" data-tone="danger">
          <span className="metric-card__label">Documentos Pendientes</span>
          <span className="ui-kpi-badge bg-[rgba(192,98,90,0.92)]">
            En cola
          </span>
          <span className="metric-card__value">{processingCount}</span>
          <p className="metric-card__hint">Subidos y en proceso dentro de la organizacion actual.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Asientos en Revision</span>
          <span className="ui-kpi-badge bg-[rgba(95,157,115,0.92)]">
            Activo
          </span>
          <span className="metric-card__value">{journalDraftCountResult.count ?? 0}</span>
          <p className="metric-card__hint">Drafts contables pendientes de aprobacion final.</p>
        </article>
        <article className="metric-card" data-tone="success">
          <span className="metric-card__label">Estado de IVA</span>
          <span className="ui-kpi-badge bg-[rgba(95,157,115,0.92)]">
            {latestVatRun ? latestVatRun.status : "Sin run"}
          </span>
          <span className="metric-card__value">{completionRate}%</span>
          <p className="metric-card__hint">Documentos integrados en la bandeja reciente.</p>
        </article>
        <article className="metric-card" data-tone="warning">
          <span className="metric-card__label">Proximos Vencimientos</span>
          <div className="mt-4 space-y-3 text-[14px] text-[color:var(--color-muted)]">
            <div className="flex items-center justify-between gap-3">
              <span>Declaracion siguiente</span>
              <span className="text-white">
                {latestVatRun?.periodLabel ?? "Pendiente"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Documentos aprobados</span>
              <span className="text-white">{doneCount}</span>
            </div>
          </div>
        </article>
      </section>

      <DashboardDocumentWorkspace
        documents={dashboardDocuments}
        organizationSlug={organization.slug}
      >
          <div className="grid gap-3 xl:grid-cols-[330px_minmax(0,1fr)]">
            <div className="ui-panel">
              <div className="ui-panel-header">
                <h2 className="text-[16px] font-semibold text-white">Resumen de IVA</h2>
              </div>

              <div className="mt-4">
                <div className="flex h-[138px] items-end gap-4">
                  {chartRows.map((row) => (
                    <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex h-[108px] w-full items-end justify-center gap-1.5">
                        <span
                          className="w-3 rounded-t-[2px] bg-[#5b84ce]"
                          style={{ height: `${(row.blue / chartMax) * 100}%` }}
                        />
                        <span
                          className="w-3 rounded-t-[2px] bg-[#5f9d73]"
                          style={{ height: `${(row.green / chartMax) * 100}%` }}
                        />
                        <span
                          className="w-3 rounded-t-[2px] bg-[#c39a52]"
                          style={{ height: `${(row.amber / chartMax) * 100}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-[color:var(--color-muted)]">
                        {row.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[12px] text-[color:var(--color-muted)]">
                  <span className="inline-block h-2 w-2 rounded-full bg-white" />
                  Tendencia del periodo
                </div>
              </div>
            </div>

            <div className="ui-panel">
              <div className="ui-panel-header">
                <h2 className="text-[16px] font-semibold text-white">
                  Obligaciones Fiscales
                </h2>
                <span className="ui-filter">Mes</span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="ui-subtle-row">
                  <div className="flex items-center gap-3">
                    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                      ✓
                    </span>
                    <span className="text-white">Resumen mensual revisado</span>
                  </div>
                  <span>{formatAmount(latestVatRun?.outputVat ?? null)}</span>
                </div>
                <div className="ui-subtle-row">
                  <div className="flex items-center gap-3">
                    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/10 bg-white/10 text-[12px] text-white">
                      ✓
                    </span>
                    <span className="text-white">Cobros estimados de facturas</span>
                  </div>
                  <span>{formatAmount(latestVatRun?.inputVatCreditable ?? null)}</span>
                </div>
              </div>
            </div>
          </div>
      </DashboardDocumentWorkspace>
    </PrivateDashboardShell>
  );
}
