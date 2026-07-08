import type { Metadata } from "next";
import { FieldActivityList } from "@/components/mobile/field-activity-list";
import { FieldStatusSummary } from "@/components/mobile/field-status-summary";
import { LoadingLink } from "@/components/ui/loading-link";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  buildFieldMobileActivityCards,
  buildFieldMobileSummary,
} from "@/modules/presentation/field-mobile";
import { loadFieldWorkspaceData } from "./data";

type OrganizationFieldHomePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Campo",
};

export default async function OrganizationFieldHomePage({
  params,
}: OrganizationFieldHomePageProps) {
  const { slug } = await params;
  const { organization } = await requireOrganizationDashboardPage(slug);
  const workspace = await loadFieldWorkspaceData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    limit: 48,
  });
  const summaryCards = buildFieldMobileSummary(workspace.documents);
  const recentCards = buildFieldMobileActivityCards({
    items: workspace.documents,
    organizationSlug: organization.slug,
    costCenterNameById: workspace.costCenterNameById,
    workUnitNameById: workspace.workUnitNameById,
    limit: 6,
  });
  const openWorkUnitsCount = workspace.workUnits.length;

  return (
    <div className="space-y-4">
      <section className="field-panel">
        <div className="field-panel__header">
          <div>
            <p className="field-panel__eyebrow">Carril operativo</p>
            <h1 className="field-panel__title">Campo para captura y seguimiento documental</h1>
            <p className="field-panel__description">
              Esta superficie se enfoca en subir comprobantes, ver su estado y vincularlos a trabajos sin abrir la capa experta de IVA, cierre o auditoria.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <LoadingLink
              href={`/app/o/${organization.slug}/field/upload`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--primary min-h-[42px] w-full sm:w-auto"
            >
              Subir documento
            </LoadingLink>
            <LoadingLink
              href={`/app/o/${organization.slug}/field/activity`}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary min-h-[42px] w-full sm:w-auto"
            >
              Ver actividad
            </LoadingLink>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="field-inline-stat">
            Trabajos abiertos: {openWorkUnitsCount}
          </div>
          <div className="field-inline-stat">
            Documentos recientes: {workspace.documents.length}
          </div>
          <div className="field-inline-stat">
            Lo experto sigue en desktop
          </div>
        </div>
      </section>

      <FieldStatusSummary cards={summaryCards} />

      <FieldActivityList
        title="Actividad reciente"
        description="Ultimos documentos que entraron al flujo actual con su estado operativo visible."
        emptyMessage="Todavia no hay actividad reciente. Usa Subir para capturar el primer documento."
        cards={recentCards}
      />

      <section className="field-panel">
        <div className="field-panel__header">
          <div>
            <p className="field-panel__eyebrow">Alcance</p>
            <h2 className="field-panel__title">Que hacer aqui y que dejar para la web</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="field-activity-card">
            <p className="field-activity-card__title">Aqui en mobile</p>
            <p className="field-activity-card__subtitle">
              Captura, procesamiento, clasificacion basica, vinculo a trabajos, actividad reciente y onboarding del equipo de campo.
            </p>
          </article>
          <article className="field-activity-card">
            <p className="field-activity-card__title">En la web completa</p>
            <p className="field-activity-card__subtitle">
              IVA, cierre, auditoria, imports, exports, reglas, mapa contable, journal, balance y superficies avanzadas.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
