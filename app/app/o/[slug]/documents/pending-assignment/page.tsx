import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentsWorkspaceTable } from "@/components/documents/documents-workspace-table";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { listOrganizationCostCenters } from "@/modules/cost-centers/service";
import { listPaginatedOrganizationWorkspaceDocuments } from "@/modules/documents/review";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type PendingAssignmentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type PendingAssignmentGroup = {
  key: string;
  counterpartyName: string;
  role: string;
  documentType: string;
  documentCount: number;
  pendingCount: number;
  staleCount: number;
  failedCount: number;
  averageConfidence: number | null;
};

export const metadata: Metadata = {
  title: "Lotes y asignacion",
};

function buildPendingAssignmentGroups(
  items: Awaited<ReturnType<typeof listPaginatedOrganizationWorkspaceDocuments>>["items"],
) {
  const groups = new Map<string, PendingAssignmentGroup>();

  for (const item of items) {
    const key = [
      item.counterpartyName?.trim().toLowerCase() || "sin-contraparte",
      item.role,
      item.documentType?.trim().toLowerCase() || "sin-tipo",
    ].join("|");
    const current = groups.get(key) ?? {
      key,
      counterpartyName: item.counterpartyName ?? "Contraparte pendiente",
      role: item.role,
      documentType: item.documentType ?? "Documento fiscal",
      documentCount: 0,
      pendingCount: 0,
      staleCount: 0,
      failedCount: 0,
      averageConfidence: null,
    };

    current.documentCount += 1;

    if (item.classificationStatus === "ready" || item.classificationStatus === "not_started") {
      current.pendingCount += 1;
    }

    if (item.classificationStatus === "stale") {
      current.staleCount += 1;
    }

    if (item.classificationStatus === "failed") {
      current.failedCount += 1;
    }

    if (typeof item.certaintyConfidence === "number") {
      const previousTotal = (current.averageConfidence ?? 0) * Math.max(current.documentCount - 1, 0);
      current.averageConfidence = (previousTotal + item.certaintyConfidence) / current.documentCount;
    }

    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (right.documentCount !== left.documentCount) {
      return right.documentCount - left.documentCount;
    }

    return left.counterpartyName.localeCompare(right.counterpartyName);
  });
}

function formatConfidence(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Sin score";
  }

  return `${Math.round(value * 100)}%`;
}

export default async function PendingAssignmentPage({
  params,
}: PendingAssignmentPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const canUseQueue = ["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(organization.role);
  const [documentsPage, costCenters] = await Promise.all([
    listPaginatedOrganizationWorkspaceDocuments({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      page: 1,
      pageSize: 200,
      directionFilter: "all",
      sortOrder: "confidence_asc",
    }),
    listOrganizationCostCenters({
      organizationId: organization.id,
      includeArchived: true,
    }),
  ]);
  const pendingItems = documentsPage.items.filter((item) =>
    item.canClassify
    || item.classificationStatus === "failed"
    || item.classificationStatus === "stale");
  const groups = buildPendingAssignmentGroups(pendingItems).slice(0, 12);
  const costCenterNameById = Object.fromEntries(costCenters.map((item) => [item.id, item.name]));

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Lotes y asignacion"
      description="Cola secundaria para agrupar similares y aplicar decisiones por lote cuando haga falta."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "review")}
    >
      <section className="space-y-6">
        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h1 className="text-[18px] font-semibold text-white">Cola de lotes y asignacion</h1>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Agrupa documentos similares para que puedas revisar lotes y disparar clasificacion masiva desde una vista mas enfocada.
              </p>
            </div>
            <Link
              href={`/app/o/${organization.slug}/review`}
              className="ui-button ui-button--secondary w-full sm:w-auto"
            >
              Volver a Revision
            </Link>
          </div>

          {!canUseQueue ? (
            <div className="mt-4 rounded-[18px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[14px] text-amber-50">
              Tu rol puede ver la cola, pero no resolver sugerencias ni ejecutar clasificacion masiva desde aqui.
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="ui-panel">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Documentos en cola
            </p>
            <p className="mt-2 text-[30px] font-semibold text-white">{pendingItems.length}</p>
            <p className="mt-2 text-[14px] text-[color:var(--color-muted)]">
              Casos con clasificacion pendiente, fallida o vencida.
            </p>
          </div>
          <div className="ui-panel">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Grupos similares
            </p>
            <p className="mt-2 text-[30px] font-semibold text-white">{groups.length}</p>
            <p className="mt-2 text-[14px] text-[color:var(--color-muted)]">
              Agrupados por contraparte, rol documental y tipo para facilitar resolucion por lote.
            </p>
          </div>
          <div className="ui-panel">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Accion sugerida
            </p>
            <p className="mt-2 text-[18px] font-semibold text-white">Clasificar seleccionados</p>
            <p className="mt-2 text-[14px] text-[color:var(--color-muted)]">
              Usa la tabla de abajo para seleccionar documentos del mismo grupo y correr clasificacion en lote.
            </p>
          </div>
        </div>

        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Grupos candidatos a lote</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Vista rapida de similares para encontrar proveedores o clientes que merecen el mismo criterio.
              </p>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="mt-4 rounded-[18px] border border-dashed border-[color:var(--color-border)] px-4 py-6 text-[14px] text-[color:var(--color-muted)]">
              No hay documentos pendientes de asignacion ahora mismo.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="rounded-[18px] border border-[color:var(--color-border)] bg-white/5 p-4"
                >
                  <p className="font-semibold text-white">{group.counterpartyName}</p>
                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                    {group.role} / {group.documentType}
                  </p>
                  <p className="mt-3 text-[14px] text-[color:var(--color-muted)]">
                    {group.documentCount} documento(s) similares
                  </p>
                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                    Pendientes: {group.pendingCount} | Vencidos: {group.staleCount} | Fallidos: {group.failedCount}
                  </p>
                  <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                    Confianza media: {formatConfidence(group.averageConfidence)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {canUseQueue ? (
          <DocumentsWorkspaceTable
            slug={organization.slug}
            documents={pendingItems}
            costCenterNameById={costCenterNameById}
            missingFxSummary={{ count: 0, dates: [] }}
          />
        ) : (
          <div className="ui-panel">
            <div className="rounded-[18px] border border-dashed border-[color:var(--color-border)] px-4 py-6 text-[14px] text-[color:var(--color-muted)]">
              Esta cola consultiva del Asistente Contable solo esta disponible para owner, admin, admin_processing,
              accountant y reviewer.
            </div>
          </div>
        )}
      </section>
    </PrivateDashboardShell>
  );
}
