"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExpandableSectionCard } from "@/components/ui/expandable-section-card";
import type { OrganizationCostCenterSummary } from "@/modules/cost-centers/service";

type CostCentersSettingsPanelProps = {
  slug: string;
  projects: OrganizationCostCenterSummary[];
  documentsCountByProjectId: Record<string, number>;
  canCreateProjects: boolean;
  canArchiveProjects: boolean;
  createProjectAction: (input: {
    name: string;
    description?: string | null;
  }) => Promise<{
    ok: boolean;
    message: string;
  }>;
  archiveProjectAction: (input: {
    costCenterId: string;
  }) => Promise<{
    ok: boolean;
    message: string;
  }>;
};

function formatArchivedDate(value: string | null) {
  if (!value) {
    return "Archivado recientemente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function CostCentersSettingsPanel({
  slug,
  projects,
  documentsCountByProjectId,
  canCreateProjects,
  canArchiveProjects,
  createProjectAction,
  archiveProjectAction,
}: CostCentersSettingsPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeProjects = projects.filter((project) => project.isActive);
  const archivedProjects = projects.filter((project) => !project.isActive);
  const assignedDocumentsCount = Object.values(documentsCountByProjectId)
    .reduce((total, count) => total + count, 0);

  return (
    <ExpandableSectionCard
      title="Proyectos y centros de costo"
      description="Desktop concentra la administracion completa: crear, archivar, revisar uso historico y dejar visible la asignacion en todo el producto."
      defaultOpen
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <article className="metric-card">
            <span className="metric-card__label">Activos</span>
            <span className="metric-card__value">{activeProjects.length}</span>
            <p className="metric-card__hint">Disponibles para nuevas asignaciones.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Archivados</span>
            <span className="metric-card__value">{archivedProjects.length}</span>
            <p className="metric-card__hint">Se mantienen solo como referencia historica.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Documentos asociados</span>
            <span className="metric-card__value">{assignedDocumentsCount}</span>
            <p className="metric-card__hint">Total de documentos con proyecto visible.</p>
          </article>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
            <div className="space-y-1">
              <h3 className="text-[16px] font-semibold text-white">Crear proyecto</h3>
              <p className="text-sm text-[color:var(--color-muted)]">
                Usa nombres operativos. Desktop mantiene el control total y la app mobile solo reutiliza esta lista para intake de campo.
              </p>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Nombre</span>
                <input
                  value={name}
                  disabled={!canCreateProjects || isPending}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm disabled:bg-white/60"
                  placeholder="Cliente X - Obra Abril 2026"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Descripcion opcional</span>
                <textarea
                  value={description}
                  disabled={!canCreateProjects || isPending}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  className="min-h-[110px] w-full resize-y rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm disabled:bg-white/60"
                  placeholder="Centro, cliente o referencia que el equipo necesita ver en desktop y mobile."
                />
              </label>

              {message ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${
                  message.toLowerCase().includes("no se pudo") || message.toLowerCase().includes("tu rol")
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-emerald-200 bg-emerald-50 text-emerald-950"
                }`}>
                  {message}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="ui-button ui-button--primary w-full sm:w-auto"
                  disabled={!canCreateProjects || isPending}
                  onClick={() => {
                    const trimmedName = name.trim();

                    if (!trimmedName) {
                      setMessage("Escribe un nombre antes de crear el proyecto.");
                      return;
                    }

                    startTransition(async () => {
                      const result = await createProjectAction({
                        name: trimmedName,
                        description,
                      });

                      setMessage(result.message);

                      if (result.ok) {
                        setName("");
                        setDescription("");
                        router.refresh();
                      }
                    });
                  }}
                >
                  {isPending ? "Guardando..." : "Crear proyecto"}
                </button>
                {!canCreateProjects ? (
                  <span className="status-pill status-pill--warning">Solo lectura para tu rol</span>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
            <p className="font-semibold text-white">Regla operativa</p>
            <p className="mt-2">
              Desktop tiene todo: aqui administras la lista completa y en Revision/Documentos puedes corregir la asignacion por documento.
            </p>
            <p className="mt-3">
              Mobile solo usa estos proyectos para capturar, resumir actividad reciente y acelerar intake desde campo.
            </p>
            <p className="mt-3">
              En cuanto un proyecto se archiva deja de ofrecerse para nuevas cargas, pero los documentos historicos mantienen la relacion.
            </p>
            <p className="mt-3 text-xs">
              Ruta actual: `/app/o/{slug}/settings?tab=company`
            </p>
          </aside>
        </div>

        <section className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-semibold text-white">Proyectos activos</h3>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                Quedan visibles en Documentos, Revision, la pantalla de detalle y la app mobile de campo.
              </p>
            </div>
            <div className="rounded-full border border-[color:var(--color-border)] bg-white/60 px-4 py-2 text-sm text-[color:var(--color-muted)]">
              Organizacion: {slug}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {activeProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
                Todavia no hay proyectos activos en esta organizacion.
              </div>
            ) : (
              activeProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                        {project.description ?? "Proyecto sin descripcion adicional."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill status-pill--info">
                        {documentsCountByProjectId[project.id] ?? 0} documento(s)
                      </span>
                      <span className="status-pill status-pill--success">Activo</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="ui-button ui-button--ghost w-full sm:w-auto"
                      disabled={!canArchiveProjects || isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await archiveProjectAction({
                            costCenterId: project.id,
                          });

                          setMessage(result.message);

                          if (result.ok) {
                            router.refresh();
                          }
                        });
                      }}
                    >
                      {isPending ? "Guardando..." : "Archivar"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {archivedProjects.length > 0 ? (
          <section className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
            <div>
              <h3 className="text-[16px] font-semibold text-white">Archivados</h3>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                Se mantienen solo para referencia historica y trazabilidad sobre documentos ya asociados.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {archivedProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                        Archivado {formatArchivedDate(project.archivedAt ?? project.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill status-pill--warning">Archivado</span>
                      <span className="status-pill status-pill--info">
                        {documentsCountByProjectId[project.id] ?? 0} documento(s)
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ExpandableSectionCard>
  );
}
