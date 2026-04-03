"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoadingLink } from "@/components/ui/loading-link";
import type { OrganizationCostCenterSummary } from "@/modules/cost-centers/service";

type FieldProjectsManagerProps = {
  slug: string;
  projects: OrganizationCostCenterSummary[];
  documentsCountByProjectId: Record<string, number>;
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

export function FieldProjectsManager({
  slug,
  projects,
  documentsCountByProjectId,
  createProjectAction,
  archiveProjectAction,
}: FieldProjectsManagerProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeProjects = projects.filter((project) => project.isActive);
  const archivedProjects = projects.filter((project) => !project.isActive);

  return (
    <div className="space-y-4">
      <section className="field-panel">
        <div className="field-panel__header">
          <div>
            <p className="field-panel__eyebrow">Proyectos</p>
            <h1 className="field-panel__title">Crear proyecto o centro de costo</h1>
            <p className="field-panel__description">
              Usa nombres simples y operativos para agrupar documentos de campo sin abrir un modulo experto.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-white">Nombre</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="field-input"
              placeholder="Servicios TGU Abril 2026"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-white">Descripcion opcional</span>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className="field-input min-h-[110px] resize-y"
              placeholder="Cliente, obra o referencia corta para el equipo."
            />
          </label>
        </div>

        {message ? (
          <div className="mt-4 rounded-[18px] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.72)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
            {message}
          </div>
        ) : null}

        <button
          type="button"
          className="ui-button ui-button--primary mt-4 min-h-[44px] w-full"
          disabled={isPending}
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
      </section>

      <section className="field-panel">
        <div className="field-panel__header">
          <div>
            <p className="field-panel__eyebrow">Activos</p>
            <h2 className="field-panel__title">Proyectos disponibles</h2>
            <p className="field-panel__description">
              Filtra actividad por proyecto o abre la carga con un proyecto ya preseleccionado.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {activeProjects.length === 0 ? (
            <div className="field-empty-state">
              Todavia no hay proyectos activos. Crea el primero para asociar documentos desde la app de campo.
            </div>
          ) : (
            activeProjects.map((project) => (
              <article key={project.id} className="field-activity-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="field-activity-card__title">{project.name}</p>
                    <p className="field-activity-card__subtitle">
                      {project.description ?? "Proyecto sin descripcion adicional."}
                    </p>
                  </div>
                  <span className="status-pill status-pill--info">
                    {documentsCountByProjectId[project.id] ?? 0} documento(s)
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <LoadingLink
                    href={`/app/o/${slug}/field/activity?costCenterId=${project.id}`}
                    pendingLabel="Abriendo..."
                    className="ui-button ui-button--secondary min-h-[42px] w-full"
                  >
                    Ver actividad
                  </LoadingLink>
                  <LoadingLink
                    href={`/app/o/${slug}/field/upload?costCenterId=${project.id}`}
                    pendingLabel="Abriendo..."
                    className="ui-button ui-button--secondary min-h-[42px] w-full"
                  >
                    Usar al subir
                  </LoadingLink>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost min-h-[42px] w-full"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await archiveProjectAction({
                          costCenterId: project.id,
                        });

                        setMessage(result.message);
                        router.refresh();
                      });
                    }}
                  >
                    Archivar
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {archivedProjects.length > 0 ? (
        <section className="field-panel">
          <div className="field-panel__header">
            <div>
              <p className="field-panel__eyebrow">Archivados</p>
              <h2 className="field-panel__title">Historial</h2>
              <p className="field-panel__description">
                Los proyectos archivados no se usan para nuevas cargas, pero los documentos historicos mantienen la relacion.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {archivedProjects.map((project) => (
              <article key={project.id} className="field-activity-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="field-activity-card__title">{project.name}</p>
                    <p className="field-activity-card__subtitle">
                      Archivado {new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(project.archivedAt ?? project.updatedAt))}
                    </p>
                  </div>
                  <span className="status-pill status-pill--warning">Archivado</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
