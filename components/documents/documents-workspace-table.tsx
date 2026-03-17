"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueDocumentExtractionAction,
  enqueueSelectedDocumentExtractionsAction,
  runDocumentClassificationFromListAction,
  runSelectedDocumentClassificationFromListAction,
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
  manualInterventionBy: string | null;
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
  nextPrimaryAction: "open_review" | "retry_extraction" | "process_extraction" | null;
  nextPrimaryActionLabel: string | null;
  isProcessingStale: boolean;
  canRetryExtraction: boolean;
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

function formatDecisionAuditLabel(document: DocumentsWorkspaceTableItem) {
  if (document.decisionSource === "manual_override") {
    return `Revision intervenida por: ${document.manualInterventionBy ?? "Usuario del equipo"}`;
  }

  return formatDecisionSourceLabel(document.decisionSource);
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
  const classifiableIds = documents
    .filter((document) => document.canClassify)
    .map((document) => document.id);
  const bulkSelectableIds = documents
    .filter((document) => document.canProcessExtraction || document.canClassify)
    .map((document) => document.id);
  const hasExtractionInFlight = documents.some((document) => document.hasExtractionInFlight);
  const selectedProcessableIds = selectedIds.filter((id) => processableIds.includes(id));
  const selectedClassifiableIds = selectedIds.filter((id) => classifiableIds.includes(id));
  const allBulkSelectableSelected =
    bulkSelectableIds.length > 0
    && selectedIds.filter((id) => bulkSelectableIds.includes(id)).length === bulkSelectableIds.length;
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

  async function handleClassifySelected() {
    if (selectedClassifiableIds.length === 0) {
      setNotice({
        tone: "error",
        message: "Selecciona al menos un documento listo para clasificar.",
      });
      return;
    }

    setBusyAction("classify:selected");

    try {
      const result = await runSelectedDocumentClassificationFromListAction({
        slug,
        documentIds: selectedClassifiableIds,
      });

      setNotice({
        tone: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.completedCount > 0) {
        setSelectedIds((current) => current.filter((id) => !selectedClassifiableIds.includes(id)));
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "No pudimos clasificar la seleccion.",
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

  function toggleAllBulkSelectable() {
    if (allBulkSelectableSelected) {
      setSelectedIds((current) => current.filter((id) => !bulkSelectableIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...bulkSelectableIds])));
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

  function renderInlinePrimaryAction(document: DocumentsWorkspaceTableItem) {
    if (document.nextPrimaryAction === "open_review" && document.processedHref) {
      return (
        <LoadingLink
          href={document.processedHref}
          pendingLabel="Abriendo..."
          className="text-[color:var(--color-accent-strong)]"
        >
          {document.nextPrimaryActionLabel}
        </LoadingLink>
      );
    }

    if (
      (document.nextPrimaryAction === "retry_extraction"
        || document.nextPrimaryAction === "process_extraction")
      && document.nextPrimaryActionLabel
    ) {
      return (
        <button
          type="button"
          disabled={isBusy}
          className="text-[13px] text-[color:var(--color-accent-strong)] disabled:opacity-60"
          onClick={() => {
            void handleProcessOne(document.id);
          }}
        >
          {document.nextPrimaryActionLabel}
        </button>
      );
    }

    return <span>Extraccion en curso</span>;
  }

  function renderPrimaryActionButton(document: DocumentsWorkspaceTableItem, processBusy: boolean) {
    if (document.nextPrimaryAction === "open_review" && document.processedHref) {
      return (
        <LoadingLink
          href={document.processedHref}
          pendingLabel="Abriendo..."
          className="ui-button ui-button--primary"
        >
          {document.nextPrimaryActionLabel ?? "Abrir revision"}
        </LoadingLink>
      );
    }

    if (
      document.nextPrimaryAction === "retry_extraction"
      || document.nextPrimaryAction === "process_extraction"
    ) {
      return (
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={isBusy}
          onClick={() => {
            void handleProcessOne(document.id);
          }}
        >
          {processBusy
            ? document.canRetryExtraction
              ? "Reintentando..."
              : "Procesando..."
            : document.nextPrimaryActionLabel ?? "Procesar"}
        </button>
      );
    }

    return null;
  }

  return (
    <div className="ui-panel overflow-hidden p-0">
      <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Bandeja operativa</h2>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
            Selecciona varios documentos para extraer o clasificar en lote desde la misma bandeja.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasExtractionInFlight ? (
            <span className="status-pill status-pill--warning">Auto-refresco activo</span>
          ) : null}
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={selectedClassifiableIds.length === 0 || isBusy}
            onClick={() => {
              void handleClassifySelected();
            }}
          >
            {busyAction === "classify:selected" ? "Clasificando..." : "Clasificar seleccionados"}
          </button>
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
                    checked={allBulkSelectableSelected}
                    disabled={bulkSelectableIds.length === 0 || isBusy}
                    onChange={toggleAllBulkSelectable}
                    aria-label="Seleccionar documentos accionables"
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
                const canSelect = document.canProcessExtraction || document.canClassify;

                return (
                  <tr key={document.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-transparent"
                        checked={isSelected}
                        disabled={!canSelect || isBusy}
                        onChange={() => {
                          toggleRow(document.id, canSelect);
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
                        {renderInlinePrimaryAction(document)}
                        <DocumentOriginalModalTrigger
                          previewUrl={document.previewUrl}
                          mimeType={document.mimeType}
                          originalFilename={document.originalFilename}
                          triggerLabel={document.previewUrl ? "Ver original" : "Ver detalle"}
                          triggerClassName="text-[13px] text-[color:var(--color-accent-strong)]"
                          modalTitle={document.originalFilename}
                          modalDescription={
                            document.previewUrl
                              ? "Archivo original cargado al bucket privado."
                              : "Documento creado desde importacion estructurada. No tiene archivo binario original dentro del bucket."
                          }
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
                        {formatDecisionAuditLabel(document)}
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
                        {renderPrimaryActionButton(document, processBusy)}
                        {document.canClassify ? (
                          <button
                            type="button"
                            className="ui-button ui-button--ghost"
                            disabled={isBusy}
                            onClick={() => {
                              void handleClassify(document.id);
                            }}
                          >
                            {classifyBusy ? "Clasificando..." : "Clasificar"}
                          </button>
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
