"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueDocumentExtractionAction,
  enqueueSelectedDocumentExtractionsAction,
  runDocumentClassificationFromListAction,
} from "@/app/app/o/[slug]/documents/actions";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { LoadingLink } from "@/components/ui/loading-link";
import {
  formatDecisionSourceLabel,
  formatDuplicateStatusLabel,
} from "@/modules/presentation/labels";
import { getDocumentRoleLabel, getDocumentRoleVariant } from "@/modules/documents/status";

type DocumentsWorkspaceTableItem = {
  id: string;
  processedHref: string | null;
  originalFilename: string;
  mimeType: string | null;
  previewUrl: string | null;
  status: string;
  role: string;
  documentType: string | null;
  createdAt: string;
  documentDate: string | null;
  counterpartyName: string | null;
  documentNumber: string | null;
  documentSeries: string | null;
  taxAmount: number | null;
  totalAmount: number | null;
  hasProcessedDraft: boolean;
  certaintyLevel: "green" | "yellow" | "red" | null;
  certaintyConfidence: number | null;
  duplicateStatus: string | null;
  decisionSource: string | null;
  storageStatus: "stored" | "upload_error";
  storageStatusLabel: string;
  storageFailureMessage: string | null;
  extractionStatus: "uploaded" | "queued" | "extracting" | "extracted" | "error";
  extractionStatusLabel: string;
  extractionFailureMessage: string | null;
  classificationStatus: "not_started" | "ready" | "failed" | "completed";
  classificationStatusLabel: string;
  classificationFailureMessage: string | null;
  canProcessExtraction: boolean;
  canClassify: boolean;
  hasExtractionInFlight: boolean;
};

type DocumentsWorkspaceTableProps = {
  slug: string;
  documents: DocumentsWorkspaceTableItem[];
};

type NoticeTone = "success" | "error" | "info";

function formatAmount(value: number | null) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getCertaintyClasses(level: "green" | "yellow" | "red" | null) {
  if (level === "green") {
    return "status-pill status-pill--success";
  }

  if (level === "yellow") {
    return "status-pill status-pill--warning";
  }

  if (level === "red") {
    return "status-pill status-pill--danger";
  }

  return "status-pill status-pill--info";
}

function formatCertaintyLabel(level: "green" | "yellow" | "red" | null) {
  if (level === "green") {
    return "Alta";
  }

  if (level === "yellow") {
    return "Media";
  }

  if (level === "red") {
    return "Baja";
  }

  return "s/d";
}

function getStageStatusClasses(
  status:
    | "stored"
    | "upload_error"
    | "uploaded"
    | "queued"
    | "extracting"
    | "extracted"
    | "error"
    | "not_started"
    | "ready"
    | "failed"
    | "completed",
) {
  if (["stored", "extracted", "completed"].includes(status)) {
    return "status-pill status-pill--success";
  }

  if (["queued", "extracting", "ready"].includes(status)) {
    return "status-pill status-pill--warning";
  }

  if (["upload_error", "error", "failed"].includes(status)) {
    return "status-pill status-pill--danger";
  }

  return "status-pill status-pill--info";
}

function getNoticeClasses(tone: NoticeTone) {
  if (tone === "success") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  }

  if (tone === "error") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-50";
  }

  return "border-[color:var(--color-border)] bg-white/5 text-[color:var(--color-muted)]";
}

export function DocumentsWorkspaceTable({
  slug,
  documents,
}: DocumentsWorkspaceTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const processableIds = documents
    .filter((document) => document.canProcessExtraction)
    .map((document) => document.id);
  const hasExtractionInFlight = documents.some((document) => document.hasExtractionInFlight);
  const selectedProcessableIds = selectedIds.filter((id) => processableIds.includes(id));
  const allProcessableSelected =
    processableIds.length > 0 && selectedProcessableIds.length === processableIds.length;
  const isBusy = busyAction !== null || isPending;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => documents.some((document) => document.id === id)));
  }, [documents]);

  useEffect(() => {
    if (!hasExtractionInFlight) {
      return;
    }

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasExtractionInFlight, router, startTransition]);

  async function handleProcessOne(documentId: string) {
    setBusyAction(`process:${documentId}`);

    try {
      const result = await enqueueDocumentExtractionAction({
        slug,
        documentId,
      });

      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos encolar la extraccion documental.",
      });
    } finally {
      setBusyAction(null);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function handleProcessSelected() {
    if (selectedProcessableIds.length === 0) {
      setNotice({
        tone: "error",
        message: "Selecciona al menos un documento pendiente de extraccion.",
      });
      return;
    }

    setBusyAction("process:selected");

    try {
      const result = await enqueueSelectedDocumentExtractionsAction({
        slug,
        documentIds: selectedProcessableIds,
      });

      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.queuedCount > 0) {
        setSelectedIds([]);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos encolar la extraccion seleccionada.",
      });
    } finally {
      setBusyAction(null);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function handleClassify(documentId: string) {
    setBusyAction(`classify:${documentId}`);

    try {
      const result = await runDocumentClassificationFromListAction({
        slug,
        documentId,
      });

      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos ejecutar la clasificacion contable.",
      });
    } finally {
      setBusyAction(null);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  function toggleAllProcessable() {
    if (allProcessableSelected) {
      setSelectedIds((current) => current.filter((id) => !processableIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...processableIds])));
  }

  function toggleRow(documentId: string, enabled: boolean) {
    if (!enabled) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]);
  }

  return (
    <div className="ui-panel overflow-hidden p-0">
      <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Bandeja operativa</h2>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
            Carga, extraccion y clasificacion ahora viven en etapas separadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasExtractionInFlight ? (
            <span className="status-pill status-pill--warning">Auto-refresco activo</span>
          ) : null}
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={selectedProcessableIds.length === 0 || isBusy}
            onClick={() => {
              void handleProcessSelected();
            }}
          >
            {busyAction === "process:selected" ? "Procesando..." : "Procesar seleccionados"}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="border-b border-[color:var(--color-border)] px-4 py-3">
          <div className={`rounded-[14px] border px-4 py-3 text-[14px] ${getNoticeClasses(notice.tone)}`}>
            {notice.message}
          </div>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-[color:var(--color-muted)]">
          Aun no hay documentos en esta organizacion.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1260px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                    checked={allProcessableSelected}
                    disabled={processableIds.length === 0 || isBusy}
                    onChange={toggleAllProcessable}
                    aria-label="Seleccionar documentos procesables"
                  />
                </th>
                <th>Archivo</th>
                <th>Contraparte</th>
                <th>Estado por etapa</th>
                <th>Tipo</th>
                <th>Confianza</th>
                <th className="text-right">Monto</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const isSelected = selectedIds.includes(document.id);
                const processBusy = busyAction === `process:${document.id}`;
                const classifyBusy = busyAction === `classify:${document.id}`;

                return (
                  <tr key={document.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-transparent"
                        checked={isSelected}
                        disabled={!document.canProcessExtraction || isBusy}
                        onChange={() => {
                          toggleRow(document.id, document.canProcessExtraction);
                        }}
                        aria-label={`Seleccionar ${document.originalFilename}`}
                      />
                    </td>
                    <td>
                      <div className="font-semibold text-white">
                        {document.originalFilename}
                      </div>
                      <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        {document.documentDate ?? document.createdAt}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[color:var(--color-muted)]">
                        {document.processedHref ? (
                          <LoadingLink
                            href={document.processedHref}
                            pendingLabel="Abriendo..."
                            className="text-[color:var(--color-accent-strong)]"
                          >
                            Abrir revision
                          </LoadingLink>
                        ) : (
                          <span>Draft pendiente</span>
                        )}
                        <DocumentOriginalModalTrigger
                          previewUrl={document.previewUrl}
                          mimeType={document.mimeType}
                          originalFilename={document.originalFilename}
                          triggerLabel="Ver original"
                          triggerClassName="text-[13px] text-[color:var(--color-accent-strong)]"
                          modalTitle={document.originalFilename}
                          modalDescription="Archivo original cargado al bucket privado."
                        />
                      </div>
                    </td>
                    <td>
                      <div className="text-white">
                        {document.counterpartyName ?? "Contraparte pendiente"}
                      </div>
                      <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        {document.documentNumber
                          ? `${document.documentSeries ? `${document.documentSeries}-` : ""}${document.documentNumber}`
                          : document.documentType ?? "Documento fiscal"}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2 text-[13px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[color:var(--color-muted)]">Almacenamiento</span>
                          <span className={getStageStatusClasses(document.storageStatus)}>
                            {document.storageStatusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[color:var(--color-muted)]">Extraccion</span>
                          <span className={getStageStatusClasses(document.extractionStatus)}>
                            {document.extractionStatusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[color:var(--color-muted)]">Clasificacion</span>
                          <span className={getStageStatusClasses(document.classificationStatus)}>
                            {document.classificationStatusLabel}
                          </span>
                        </div>
                        {document.storageFailureMessage ? (
                          <div className="text-rose-200">{document.storageFailureMessage}</div>
                        ) : null}
                        {document.extractionFailureMessage ? (
                          <div className="text-rose-200">{document.extractionFailureMessage}</div>
                        ) : null}
                        {document.classificationFailureMessage ? (
                          <div className="text-amber-100">{document.classificationFailureMessage}</div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={getDocumentRoleVariant(document.role)}>
                        {getDocumentRoleLabel(document.role)}
                      </span>
                      <div className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                        {formatDecisionSourceLabel(document.decisionSource)}
                      </div>
                      {document.duplicateStatus && document.duplicateStatus !== "clear" ? (
                        <div className="mt-1 text-[13px] text-amber-900">
                          {formatDuplicateStatusLabel(document.duplicateStatus)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={getCertaintyClasses(document.certaintyLevel)}>
                        {formatCertaintyLabel(document.certaintyLevel)}
                      </span>
                      <div className="mt-2 text-[13px] text-[color:var(--color-muted)]">
                        {document.certaintyConfidence !== null
                          ? `${Math.round(document.certaintyConfidence * 100)}%`
                          : "Sin score"}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="font-semibold text-white">
                        {formatAmount(document.totalAmount)}
                      </div>
                      <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        IVA {formatAmount(document.taxAmount)}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {document.canProcessExtraction ? (
                          <button
                            type="button"
                            className="ui-button ui-button--secondary"
                            disabled={isBusy}
                            onClick={() => {
                              void handleProcessOne(document.id);
                            }}
                          >
                            {processBusy ? "Procesando..." : "Procesar"}
                          </button>
                        ) : null}
                        {document.canClassify ? (
                          <button
                            type="button"
                            className="ui-button ui-button--primary"
                            disabled={isBusy}
                            onClick={() => {
                              void handleClassify(document.id);
                            }}
                          >
                            {classifyBusy ? "Clasificando..." : "Clasificar"}
                          </button>
                        ) : null}
                        {document.processedHref ? (
                          <LoadingLink
                            href={document.processedHref}
                            pendingLabel="Abriendo..."
                            className="ui-button ui-button--ghost"
                          >
                            Revision
                          </LoadingLink>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
