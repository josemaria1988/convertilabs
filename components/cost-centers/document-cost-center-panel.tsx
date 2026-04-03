"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingLink } from "@/components/ui/loading-link";
import type { OrganizationCostCenterSummary } from "@/modules/cost-centers/service";

type DocumentCostCenterPanelProps = {
  slug: string;
  projects: OrganizationCostCenterSummary[];
  currentCostCenterId: string | null;
  canEdit: boolean;
  assignCostCenterAction: (input: {
    costCenterId: string | null;
  }) => Promise<{
    ok: boolean;
    message: string;
  }>;
};

function formatArchivedLabel(value: string | null) {
  if (!value) {
    return "Archivado recientemente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function DocumentCostCenterPanel({
  slug,
  projects,
  currentCostCenterId,
  canEdit,
  assignCostCenterAction,
}: DocumentCostCenterPanelProps) {
  const router = useRouter();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState(currentCostCenterId ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const activeProjects = projects.filter((project) => project.isActive);
  const currentProject = currentCostCenterId
    ? projects.find((project) => project.id === currentCostCenterId) ?? null
    : null;
  const archivedCurrentProject =
    currentProject && !currentProject.isActive
      ? currentProject
      : null;
  const selectedProject = selectedCostCenterId
    ? projects.find((project) => project.id === selectedCostCenterId) ?? null
    : null;
  const hasChanged = (currentCostCenterId ?? "") !== selectedCostCenterId;

  useEffect(() => {
    setSelectedCostCenterId(currentCostCenterId ?? "");
  }, [currentCostCenterId]);

  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Proyecto / centro de costo</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Desktop concentra la asignacion completa. La app mobile solo captura y resume; aqui puedes corregir o cambiar la asociacion antes del trabajo contable pesado.
          </p>
        </div>
        <LoadingLink
          href={`/app/o/${slug}/settings?tab=company`}
          pendingLabel="Abriendo..."
          className="ui-button ui-button--secondary w-full sm:w-auto"
        >
          Administrar proyectos
        </LoadingLink>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-white">Asignacion actual</span>
            <select
              value={selectedCostCenterId}
              disabled={!canEdit || isPending}
              onChange={(event) => {
                setSelectedCostCenterId(event.target.value);
              }}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm text-slate-950 disabled:bg-white/50"
            >
              <option value="">Sin proyecto</option>
              {activeProjects.length > 0 ? (
                <optgroup label="Activos">
                  {activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {archivedCurrentProject ? (
                <optgroup label="Historico">
                  <option value={archivedCurrentProject.id}>
                    {archivedCurrentProject.name} (archivado)
                  </option>
                </optgroup>
              ) : null}
            </select>
          </label>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {currentProject ? (
                <span className={currentProject.isActive ? "status-pill status-pill--info" : "status-pill status-pill--warning"}>
                  {currentProject.name}
                </span>
              ) : (
                <span className="status-pill status-pill--info">Sin proyecto</span>
              )}
              {!canEdit ? (
                <span className="status-pill status-pill--warning">Solo lectura</span>
              ) : null}
            </div>
            <p className="mt-3 text-[color:var(--color-muted)]">
              {currentProject
                ? currentProject.description ?? "Proyecto sin descripcion adicional."
                : "Este documento todavia no tiene una asociacion operativa."}
            </p>
            {archivedCurrentProject ? (
              <p className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                El proyecto actual esta archivado desde {formatArchivedLabel(archivedCurrentProject.archivedAt ?? archivedCurrentProject.updatedAt)}. Puedes dejarlo historico, quitarlo o mover el documento a un proyecto activo.
              </p>
            ) : null}
          </div>

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
              disabled={!canEdit || !hasChanged || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await assignCostCenterAction({
                    costCenterId: selectedCostCenterId || null,
                  });

                  setMessage(result.message);

                  if (result.ok) {
                    router.refresh();
                  }
                });
              }}
            >
              {isPending ? "Guardando..." : "Guardar proyecto"}
            </button>
            {selectedProject?.description ? (
              <div className="rounded-full border border-[color:var(--color-border)] bg-white/60 px-4 py-2 text-sm text-[color:var(--color-muted)]">
                {selectedProject.description}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
          <p className="font-semibold text-white">Uso recomendado</p>
          <p className="mt-2">
            Asocia el documento a un proyecto cuando necesites separar trabajo por cliente, obra o centro operativo antes de IVA, cierre, journal o auditoria.
          </p>
          <p className="mt-3">
            La asignacion queda visible tambien en la cola de Revision, en Documentos y en el historial mobile de campo.
          </p>
          <p className="mt-3">
            Si no existe el proyecto correcto, crealo desde Configuracion &gt; Empresa sin salir del flujo desktop.
          </p>
        </aside>
      </div>
    </section>
  );
}
