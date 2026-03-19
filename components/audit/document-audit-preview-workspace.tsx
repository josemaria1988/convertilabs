"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyDocumentAuditPreviewDecisionsAction } from "@/app/app/o/[slug]/audit/actions";
import type { DocumentAuditRunDetail } from "@/modules/audit/document-import-audit";
import { formatDocumentRoleLabel, formatLifecycleStatusLabel } from "@/modules/presentation/labels";

type DocumentAuditPreviewWorkspaceProps = {
  slug: string;
  run: DocumentAuditRunDetail | null;
};

const PREVIEW_PAGE_SIZE = 25;

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return [entry];
    }

    if (typeof entry === "string" && entry.trim().length > 0) {
      const parsed = Number(entry);

      if (Number.isFinite(parsed)) {
        return [parsed];
      }
    }

    return [];
  });
}

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    style: "decimal",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function resolveDecisionPill(decision: string) {
  switch (decision) {
    case "accepted":
      return "status-pill status-pill--success";
    case "rejected":
      return "status-pill status-pill--warning";
    case "failed":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

function formatDecisionLabel(decision: string) {
  switch (decision) {
    case "accepted":
      return "Aceptado";
    case "rejected":
      return "Rechazado";
    case "failed":
      return "Con error";
    default:
      return "Pendiente";
  }
}

export function DocumentAuditPreviewWorkspace({
  slug,
  run,
}: DocumentAuditPreviewWorkspaceProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"accept" | "reject" | null>(null);
  const [, startTransition] = useTransition();
  const actionableRows = useMemo(
    () => run?.previewRows.filter((row) => row.decision === "pending" || row.decision === "failed") ?? [],
    [run],
  );
  const actionableRowIds = useMemo(
    () => actionableRows.map((row) => row.rowId),
    [actionableRows],
  );
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const selectionSignature = useMemo(
    () => actionableRowIds.join("|"),
    [actionableRowIds],
  );

  useEffect(() => {
    setSelectedRowIds([]);
    setCurrentPage(1);
  }, [run?.runId, selectionSignature]);

  async function applyDecision(input: {
    mode: "accept" | "reject";
    rowIds: string[];
  }) {
    if (!run || input.rowIds.length === 0) {
      return;
    }

    setBusyAction(input.mode);
    setFeedback(null);

    try {
      const result = await applyDocumentAuditPreviewDecisionsAction({
        slug,
        runId: run.runId,
        acceptRowIds: input.mode === "accept" ? input.rowIds : [],
        rejectRowIds: input.mode === "reject" ? input.rowIds : [],
      });

      setFeedback(result.message);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "No se pudo aplicar la decision sobre el preview.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function toggleSelectedRow(rowId: string) {
    setSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((candidate) => candidate !== rowId)
        : [...current, rowId]);
  }

  function toggleAllActionable() {
    setSelectedRowIds((current) =>
      current.length === actionableRowIds.length
        ? []
        : actionableRowIds);
  }

  if (!run) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[18px] font-semibold text-white">Preview del batch</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Cuando inicies una auditoria documental, aqui vas a ver la estructura detectada, el estado del lote y su trazabilidad.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
          Todavia no hay una corrida seleccionada para revisar.
        </div>
      </section>
    );
  }

  const runWarnings = asStringArray(run.warnings);
  const statusEvents = Array.isArray(run.statusEvents) ? run.statusEvents : [];

  const allActionableSelected =
    actionableRowIds.length > 0
    && selectedRowIds.length === actionableRowIds.length;
  const canModifyRun = run.status === "preview_ready";
  const totalPages = Math.max(1, Math.ceil(run.previewRows.length / PREVIEW_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * PREVIEW_PAGE_SIZE;
  const pageEndIndex = pageStartIndex + PREVIEW_PAGE_SIZE;
  const visiblePreviewRows = run.previewRows.slice(pageStartIndex, pageEndIndex);
  const visibleActionableRowIds = visiblePreviewRows
    .filter((row) => row.decision === "pending" || row.decision === "failed")
    .map((row) => row.rowId);
  const allVisibleActionableSelected =
    visibleActionableRowIds.length > 0
    && visibleActionableRowIds.every((rowId) => selectedRowIds.includes(rowId));
  const visibleFrom = run.previewRows.length === 0 ? 0 : pageStartIndex + 1;
  const visibleTo = Math.min(pageEndIndex, run.previewRows.length);

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[18px] font-semibold text-white">Preview de los documentos detectados</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              {run.fileName} / {formatDocumentRoleLabel(run.ledgerKind)} / {formatLifecycleStatusLabel(run.status)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill status-pill--info">
              {run.previewCounts.total} detectado(s)
            </span>
            <span className="status-pill status-pill--warning">
              {run.previewCounts.pending} pendiente(s)
            </span>
            <span className="status-pill status-pill--success">
              {run.previewCounts.accepted} aceptado(s)
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm">
            <p className="font-semibold text-white">Subida</p>
            <p className="mt-2 text-[color:var(--color-muted)]">{formatDateTime(run.createdAt)}</p>
            <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
              {run.uploadedByDisplay ?? "Usuario del tenant"}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm">
            <p className="font-semibold text-white">Cierre</p>
            <p className="mt-2 text-[color:var(--color-muted)]">{formatDateTime(run.confirmedAt)}</p>
            <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
              {run.confirmedByDisplay ?? "Sin cierre final"}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm">
            <p className="font-semibold text-white">Rango detectado</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {formatDate(run.dateRange.minDate)} a {formatDate(run.dateRange.maxDate)}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm">
            <p className="font-semibold text-white">Documentos materializados</p>
            <p className="mt-2 text-[color:var(--color-muted)]">{run.importedDocuments.length}</p>
          </div>
        </div>

        {runWarnings.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-50/10 p-4 text-sm text-amber-100">
            {runWarnings.join(" ")}
          </div>
        ) : null}

        {run.legacyAuditGap ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            {run.legacyAuditGap}
          </div>
        ) : null}

        {feedback ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            {feedback}
          </div>
        ) : null}
      </section>

      <section className="ui-panel overflow-hidden p-0">
        <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Decision por documento</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Acepta o rechaza filas del preview. Solo lo aceptado se materializa en `documents`.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={!canModifyRun || actionableRowIds.length === 0}
              onClick={toggleAllActionable}
            >
              {allActionableSelected ? "Quitar seleccion global" : "Seleccionar pendientes global"}
            </button>
            <button
              type="button"
              className="ui-button ui-button--primary"
              disabled={!canModifyRun || selectedRowIds.length === 0 || busyAction !== null}
              onClick={() => {
                void applyDecision({
                  mode: "accept",
                  rowIds: selectedRowIds,
                });
              }}
            >
              {busyAction === "accept" ? "Aceptando..." : "Aceptar seleccionados"}
            </button>
            <button
              type="button"
              className="ui-button ui-button--danger"
              disabled={!canModifyRun || selectedRowIds.length === 0 || busyAction !== null}
              onClick={() => {
                void applyDecision({
                  mode: "reject",
                  rowIds: selectedRowIds,
                });
              }}
            >
              {busyAction === "reject" ? "Rechazando..." : "Rechazar seleccionados"}
            </button>
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={!canModifyRun || actionableRowIds.length === 0 || busyAction !== null}
              onClick={() => {
                void applyDecision({
                  mode: "accept",
                  rowIds: actionableRowIds,
                });
              }}
            >
              Aceptar todo
            </button>
            <button
              type="button"
              className="ui-button ui-button--warning"
              disabled={!canModifyRun || actionableRowIds.length === 0 || busyAction !== null}
              onClick={() => {
                void applyDecision({
                  mode: "reject",
                  rowIds: actionableRowIds,
                });
              }}
            >
              Rechazar todo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table min-w-[1240px]">
            <thead>
              <tr>
                <th className="w-12 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allVisibleActionableSelected && visibleActionableRowIds.length > 0}
                    disabled={!canModifyRun || visibleActionableRowIds.length === 0 || busyAction !== null}
                    onChange={() => {
                      if (allVisibleActionableSelected) {
                        setSelectedRowIds((current) =>
                          current.filter((rowId) => !visibleActionableRowIds.includes(rowId)));
                        return;
                      }

                      setSelectedRowIds((current) => Array.from(new Set([
                        ...current,
                        ...visibleActionableRowIds,
                      ])));
                    }}
                  />
                </th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Documento</th>
                <th>Contraparte</th>
                <th>Tipo</th>
                <th>Moneda</th>
                <th className="text-right">Neto</th>
                <th className="text-right">IVA</th>
                <th className="text-right">Total</th>
                <th>Fuente</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {run.previewRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-5 text-sm text-[color:var(--color-muted)]">
                    Todavia no hay filas estructuradas para esta corrida.
                  </td>
                </tr>
              ) : (
                visiblePreviewRows.map((row) => {
                  const isActionable = row.decision === "pending" || row.decision === "failed";
                  const isSelected = selectedRowIds.includes(row.rowId);
                  const sourceRowNumbers = asNumberArray(row.sourceRowNumbers);
                  const rowWarnings = asStringArray(row.warnings);

                  return (
                    <tr key={row.rowId}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isSelected}
                          disabled={!canModifyRun || !isActionable || busyAction !== null}
                          onChange={() => {
                            toggleSelectedRow(row.rowId);
                          }}
                        />
                      </td>
                      <td>
                        <span className={resolveDecisionPill(row.decision)}>
                          {formatDecisionLabel(row.decision)}
                        </span>
                      </td>
                      <td>{formatDate(row.documentDate)}</td>
                      <td>
                        <div className="font-medium text-white">{row.documentNumber ?? row.displayLabel}</div>
                        <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                          {row.displayLabel}
                        </div>
                      </td>
                      <td>
                        <div>{row.counterpartyName ?? "--"}</div>
                        <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                          {row.counterpartyTaxId ?? "--"}
                        </div>
                      </td>
                      <td>
                        <div>{row.documentType}</div>
                        <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                          {formatDocumentRoleLabel(row.documentRole)}
                        </div>
                      </td>
                      <td>{row.currencyCode ?? "--"}</td>
                      <td className="text-right">{formatAmount(row.subtotalAmount)}</td>
                      <td className="text-right">{formatAmount(row.taxAmount)}</td>
                      <td className="text-right">{formatAmount(row.totalAmount)}</td>
                      <td>
                        <div>{row.sheetName}</div>
                        <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                          Filas {sourceRowNumbers.length > 0 ? sourceRowNumbers.join(", ") : "--"}
                        </div>
                      </td>
                      <td>
                        {row.materializedDocumentId ? (
                          <Link
                            href={`/app/o/${slug}/documents/${row.materializedDocumentId}`}
                            className="text-[13px] font-medium text-[color:var(--color-accent)] hover:underline"
                          >
                            Abrir documento
                          </Link>
                        ) : null}
                        {row.failureMessage ? (
                          <div className="mt-1 text-[12px] text-rose-200">
                            {row.failureMessage}
                          </div>
                        ) : rowWarnings.length > 0 ? (
                          <div className="mt-1 text-[12px] text-amber-100">
                            {rowWarnings.join(" ")}
                          </div>
                        ) : (
                          <div className="text-[12px] text-[color:var(--color-muted)]">
                            {row.decisionAt ? `Actualizado ${formatDateTime(row.decisionAt)}` : "Sin observaciones"}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border)] px-4 py-3">
          <p className="text-[13px] text-[color:var(--color-muted)]">
            Mostrando {visibleFrom}-{visibleTo} de {run.previewRows.length} documento(s) detectado(s).
            {selectedRowIds.length > 0 ? ` ${selectedRowIds.length} seleccionado(s).` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={safeCurrentPage <= 1}
              onClick={() => {
                setCurrentPage((page) => Math.max(1, page - 1));
              }}
            >
              Anterior
            </button>
            <span className="ui-button ui-button--primary pointer-events-none">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => {
                setCurrentPage((page) => Math.min(totalPages, page + 1));
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Trazabilidad del batch</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Eventos, materializacion final y acceso rapido a los documentos creados por esta importacion.
            </p>
          </div>
          <span className="ui-filter">{run.importedDocuments.length} documento(s)</span>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-white/6">
            <table className="data-table min-w-[840px]">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Fecha</th>
                  <th>Numero</th>
                  <th>Contraparte</th>
                  <th>Moneda</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {run.importedDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-5 text-sm text-[color:var(--color-muted)]">
                      Este batch todavia no materializo documentos definitivos.
                    </td>
                  </tr>
                ) : (
                  run.importedDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <Link
                          href={`/app/o/${slug}/documents/${document.id}`}
                          className="font-medium text-[color:var(--color-accent)] hover:underline"
                        >
                          {document.originalFilename}
                        </Link>
                      </td>
                      <td>{formatDate(document.documentDate)}</td>
                      <td>{document.documentNumber ?? "--"}</td>
                      <td>{document.counterpartyName ?? "--"}</td>
                      <td>{document.currencyCode ?? "--"}</td>
                      <td className="text-right">{formatAmount(document.totalAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm">
            <p className="font-semibold text-white">Eventos del run</p>
            <div className="mt-3 space-y-2">
              {statusEvents.map((event) => (
                <div key={`${event.code}-${event.createdAt}`} className="ui-subtle-row">
                  <span className="text-white">{event.code}</span>
                  <span>{formatDateTime(event.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
