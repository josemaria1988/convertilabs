"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  cancelDocumentSpreadsheetImportAction,
  enqueueSelectedDocumentExtractionsAction,
  failDocumentUploadAction,
  finalizeDocumentUploadAction,
  importDocumentSpreadsheetBatchAction,
  loadDocumentSpreadsheetImportStatusesAction,
  prepareDocumentUploadAction,
} from "@/app/app/o/[slug]/documents/actions";
import {
  forgetPendingDocumentSpreadsheetImportRun,
  readLatestPendingDocumentSpreadsheetImportRunId,
  rememberPendingDocumentSpreadsheetImportRun,
} from "@/components/documents/document-spreadsheet-import-tracker";
import { DocumentUploadButton } from "@/components/documents/upload-button";
import {
  allowedDocumentUploadMimeTypes,
  documentsStorageBucket,
  formatUploadSize,
  maxDocumentUploadBytes,
  validateDocumentUploadCandidate,
} from "@/modules/documents/upload";

type UploadStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "success"
  | "cancelled"
  | "error";

type DocumentUploadDropzoneProps = {
  slug: string;
  panelId?: string;
  showSpreadsheetImport?: boolean;
};

type SpreadsheetLedgerKind = "purchase" | "sale";
type DocumentSpreadsheetImportStatus =
  Awaited<ReturnType<typeof loadDocumentSpreadsheetImportStatusesAction>>[number];

type SelectedUploadFile = {
  file: File;
  validation: ReturnType<typeof validateDocumentUploadCandidate>;
};

const acceptedMimeLabel = allowedDocumentUploadMimeTypes.join(", ");
const acceptedSpreadsheetLabel = ".csv,.tsv,.xlsx,.xls";

function isAcceptedSpreadsheetFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  const normalizedMime = file.type.toLowerCase();

  return (
    normalizedName.endsWith(".csv")
    || normalizedName.endsWith(".tsv")
    || normalizedName.endsWith(".xlsx")
    || normalizedName.endsWith(".xls")
    || normalizedMime.includes("text/csv")
    || normalizedMime.includes("tab-separated")
    || normalizedMime.includes("spreadsheetml.sheet")
    || normalizedMime.includes("ms-excel")
  );
}

function buildRejectedFilesMessage(rejectedFiles: Array<{
  name: string;
  message: string;
}>) {
  if (rejectedFiles.length === 0) {
    return "";
  }

  const preview = rejectedFiles
    .slice(0, 3)
    .map((entry) => `${entry.name}: ${entry.message}`)
    .join(" ");
  const remainingCount = rejectedFiles.length - 3;

  if (remainingCount <= 0) {
    return preview;
  }

  return `${preview} ${remainingCount} archivo(s) mas fueron rechazados.`;
}

function buildBatchFailureMessage(input: {
  failureMessages: string[];
  rejectedFiles: Array<{
    name: string;
    message: string;
  }>;
}) {
  const normalizedFailures = [...new Set(
    input.failureMessages
      .map((message) => message.trim())
      .filter(Boolean),
  )];
  const parts = ["No pudimos cargar documentos en este lote."];

  if (normalizedFailures.length > 0) {
    parts.push(normalizedFailures.slice(0, 2).join(" "));

    if (normalizedFailures.length > 2) {
      parts.push(`${normalizedFailures.length - 2} error(es) adicionales.`);
    }
  }

  const rejectedMessage = buildRejectedFilesMessage(input.rejectedFiles);

  if (rejectedMessage) {
    parts.push(rejectedMessage);
  }

  return parts.join(" ");
}

function buildBatchCompletionMessage(input: {
  totalAccepted: number;
  uploadedCount: number;
  rejectedCount: number;
  uploadErrorCount: number;
  autoProcessRequested: boolean;
  queuedForExtractionCount: number;
  extractionQueueErrorCount: number;
}) {
  const parts = [
    `${input.uploadedCount}/${input.totalAccepted} archivo(s) aceptado(s) quedaron cargado(s) en el bucket privado.`,
  ];

  if (input.rejectedCount > 0) {
    parts.push(`${input.rejectedCount} rechazado(s) en validacion.`);
  }

  if (input.uploadErrorCount > 0) {
    parts.push(`${input.uploadErrorCount} fallaron durante la subida.`);
  }

  if (input.autoProcessRequested) {
    parts.push(`${input.queuedForExtractionCount}/${input.uploadedCount} quedaron en cola para extraccion.`);

    if (input.extractionQueueErrorCount > 0) {
      parts.push(`${input.extractionQueueErrorCount} cargado(s) quedaron sin cola automatica.`);
    }
  } else {
    parts.push("Ahora puedes procesarlos desde la lista de documentos.");
  }

  return parts.join(" ");
}

function formatUploadFileLabel(file: File) {
  return file.webkitRelativePath?.trim() || file.name;
}

async function computeFileSha256(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadFileToSignedUrl(input: {
  signedUploadUrl: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", input.file, input.file.name);

  const response = await fetch(input.signedUploadUrl, {
    method: "PUT",
    body: formData,
    headers: {
      "x-upsert": "false",
    },
  });

  if (response.ok) {
    return {
      ok: true as const,
    };
  }

  const responseText = await response.text();

  try {
    const payload = JSON.parse(responseText) as {
      message?: string;
      error?: string | { message?: string };
    };
    const parsedMessage =
      payload.message
      ?? (typeof payload.error === "string"
        ? payload.error
        : payload.error?.message)
      ?? response.statusText;

    return {
      ok: false as const,
      message: parsedMessage || "No se pudo cargar el archivo al bucket privado.",
    };
  } catch {
    return {
      ok: false as const,
      message: responseText.trim() || response.statusText || "No se pudo cargar el archivo al bucket privado.",
    };
  }
}

export function DocumentUploadDropzone({
  slug,
  panelId = "document-upload-panel",
  showSpreadsheetImport = true,
}: DocumentUploadDropzoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<UploadStatus>("idle");
  const [spreadsheetMessage, setSpreadsheetMessage] = useState("");
  const [activeSpreadsheetRunId, setActiveSpreadsheetRunId] = useState<string | null>(null);
  const [spreadsheetProgressPercent, setSpreadsheetProgressPercent] = useState(0);
  const [spreadsheetLedgerKind, setSpreadsheetLedgerKind] = useState<SpreadsheetLedgerKind>("purchase");
  const [isCancellingSpreadsheet, setIsCancellingSpreadsheet] = useState(false);
  const [autoProcessAfterUpload, setAutoProcessAfterUpload] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    if (activeSpreadsheetRunId) {
      return;
    }

    const latestRunId = readLatestPendingDocumentSpreadsheetImportRunId(slug);

    if (!latestRunId) {
      return;
    }

    setActiveSpreadsheetRunId(latestRunId);
    setSpreadsheetStatus("uploading");
    setSpreadsheetMessage("Retomando el seguimiento de una importacion en segundo plano...");
  }, [activeSpreadsheetRunId, slug]);

  useEffect(() => {
    if (!activeSpreadsheetRunId) {
      return;
    }

    let cancelled = false;

    async function pollActiveSpreadsheetRun() {
      const runId = activeSpreadsheetRunId;

      if (!runId) {
        return;
      }

      const statuses = await loadDocumentSpreadsheetImportStatusesAction({
        slug,
        runIds: [runId],
      });

      if (cancelled || statuses.length === 0) {
        return;
      }

      const runStatus = statuses[0] as DocumentSpreadsheetImportStatus;
      setSpreadsheetProgressPercent(runStatus.progress.percent);
      setSpreadsheetMessage(runStatus.message);

      if (runStatus.isTerminal) {
        forgetPendingDocumentSpreadsheetImportRun(slug, runStatus.runId);
        setSpreadsheetStatus(
          runStatus.status === "cancelled"
            ? "cancelled"
            : runStatus.status === "failed" || runStatus.progress.failedCount > 0
            ? "error"
            : "success",
        );
        setIsCancellingSpreadsheet(false);
        setActiveSpreadsheetRunId(null);
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      setSpreadsheetStatus("uploading");
    }

    void pollActiveSpreadsheetRun();
    const intervalId = window.setInterval(() => {
      void pollActiveSpreadsheetRun();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSpreadsheetRunId, router, slug, startTransition]);

  async function handleFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setStatus("validating");
    setMessage("");

    const selectedFiles: SelectedUploadFile[] = files.map((file) => ({
      file,
      validation: validateDocumentUploadCandidate({
        name: file.name,
        type: file.type,
        size: file.size,
      }),
    }));
    const acceptedFiles: File[] = [];
    const rejectedFiles: Array<{ name: string; message: string }> = [];

    for (const entry of selectedFiles) {
      if (entry.validation.success) {
        acceptedFiles.push(entry.file);
      } else {
        rejectedFiles.push({
          name: formatUploadFileLabel(entry.file),
          message: entry.validation.message,
        });
      }
    }

    if (acceptedFiles.length === 0) {
      setStatus("error");
      setMessage(buildRejectedFilesMessage(rejectedFiles));
      return;
    }

    const uploadedDocumentIds: string[] = [];
    const failureMessages: string[] = [];
    let uploadErrorCount = 0;

    for (const [index, file] of acceptedFiles.entries()) {
      setStatus("uploading");
      setMessage(
        `Subiendo ${index + 1}/${acceptedFiles.length}: ${formatUploadFileLabel(file)}${
          rejectedFiles.length > 0 ? ` | ${rejectedFiles.length} rechazado(s)` : ""
        }`,
      );
      let fileHash: string | null = null;

      try {
        fileHash = await computeFileSha256(file);
      } catch {
        fileHash = null;
      }

      const preparedUpload = await prepareDocumentUploadAction({
        slug,
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileHash,
      });

      if (!preparedUpload.ok) {
        uploadErrorCount += 1;
        failureMessages.push(preparedUpload.message);
        continue;
      }

      const uploadResult = await uploadFileToSignedUrl({
        signedUploadUrl: preparedUpload.signedUploadUrl,
        file,
      });

      if (!uploadResult.ok) {
        uploadErrorCount += 1;
        failureMessages.push(uploadResult.message);
        await failDocumentUploadAction({
          slug,
          documentId: preparedUpload.documentId,
          errorMessage: uploadResult.message,
        });
        continue;
      }

      const finalizedUpload = await finalizeDocumentUploadAction({
        slug,
        documentId: preparedUpload.documentId,
      });

      if (!finalizedUpload.ok) {
        uploadErrorCount += 1;
        failureMessages.push(finalizedUpload.message);
        continue;
      }

      uploadedDocumentIds.push(finalizedUpload.documentId);
    }

    if (uploadedDocumentIds.length === 0) {
      setStatus("error");
      setMessage(buildBatchFailureMessage({
        failureMessages,
        rejectedFiles,
      }));
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    let queuedForExtractionCount = 0;
    let extractionQueueErrorCount = 0;

    if (autoProcessAfterUpload) {
      setMessage(
        `Carga completa. Encolando extraccion para ${uploadedDocumentIds.length} documento(s)...`,
      );

      try {
        const extractionResult = await enqueueSelectedDocumentExtractionsAction({
          slug,
          documentIds: uploadedDocumentIds,
        });

        queuedForExtractionCount = extractionResult.queuedCount;
        extractionQueueErrorCount = extractionResult.failedCount;
      } catch {
        extractionQueueErrorCount = uploadedDocumentIds.length;
      }
    }

    setStatus(
      rejectedFiles.length > 0
      || uploadErrorCount > 0
      || extractionQueueErrorCount > 0
        ? "error"
        : "success",
    );
    setMessage(buildBatchCompletionMessage({
      totalAccepted: acceptedFiles.length,
      uploadedCount: uploadedDocumentIds.length,
      rejectedCount: rejectedFiles.length,
      uploadErrorCount,
      autoProcessRequested: autoProcessAfterUpload,
      queuedForExtractionCount,
      extractionQueueErrorCount,
    }));
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSpreadsheetFiles(files: File[]) {
    const file = files[0];

    if (!file) {
      return;
    }

    if (!isAcceptedSpreadsheetFile(file)) {
      setSpreadsheetStatus("error");
      setSpreadsheetMessage("Selecciona una planilla mensual en formato .csv, .tsv, .xlsx o .xls.");
      return;
    }

    setSpreadsheetProgressPercent(5);
    setSpreadsheetStatus("uploading");
    setSpreadsheetMessage(`Revisando ${file.name} para validar el limite del flujo estandar de ${spreadsheetLedgerKind === "purchase" ? "compras" : "ventas"}...`);

    const formData = new FormData();
    formData.append("slug", slug);
    formData.append("ledgerKind", spreadsheetLedgerKind);
    formData.append("spreadsheet", file, file.name);

    try {
      const result = await importDocumentSpreadsheetBatchAction(formData);

      setSpreadsheetMessage(result.message);
      setSpreadsheetProgressPercent(result.ok ? 10 : 100);

      if (!result.ok || !result.runId) {
        setSpreadsheetStatus("error");
        return;
      }

      rememberPendingDocumentSpreadsheetImportRun(slug, result.runId);
      setActiveSpreadsheetRunId(result.runId);
      setSpreadsheetStatus("uploading");
    } catch (error) {
      setIsCancellingSpreadsheet(false);
      setSpreadsheetStatus("error");
      setSpreadsheetProgressPercent(100);
      setSpreadsheetMessage(
        error instanceof Error
          ? error.message
          : "No se pudo importar la planilla mensual como lote documental.",
      );
    }
  }

  async function handleCancelSpreadsheetImport() {
    const runId = activeSpreadsheetRunId;

    if (!runId || isCancellingSpreadsheet) {
      return;
    }

    setIsCancellingSpreadsheet(true);
    setSpreadsheetMessage("Cancelando la importacion en segundo plano...");

    try {
      const result = await cancelDocumentSpreadsheetImportAction({
        slug,
        runId,
      });

      forgetPendingDocumentSpreadsheetImportRun(slug, runId);
      setActiveSpreadsheetRunId(null);
      setSpreadsheetStatus("cancelled");
      setSpreadsheetProgressPercent(100);
      setSpreadsheetMessage(result.message);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSpreadsheetStatus("error");
      setSpreadsheetMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cancelar la importacion en segundo plano.",
      );
    } finally {
      setIsCancellingSpreadsheet(false);
    }
  }

  const hasActiveSpreadsheetRun = Boolean(activeSpreadsheetRunId);
  const isBusy = status === "uploading" || status === "validating" || isRefreshing;
  const isSpreadsheetBusy =
    spreadsheetStatus === "uploading"
    || isCancellingSpreadsheet
    || hasActiveSpreadsheetRun;

  return (
    <div
      id={panelId}
      className={`rounded-[1.25rem] border p-5 transition ${
        isDragging
          ? "border-[color:var(--color-accent-strong)] bg-[rgba(86,134,255,0.14)]"
          : "border-dashed border-[color:var(--color-border)] bg-[rgba(16,27,55,0.48)]"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      <div className="space-y-6">
        <section>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[16px] font-semibold text-white">Documentos originales</p>
              <p className="max-w-2xl text-[16px] leading-8 text-[color:var(--color-muted)]">
                Arrastra o selecciona PDF, JPG o PNG cuando quieras conservar el comprobante
                original dentro del bucket privado. Cada archivo valida MIME y tamano, se
                guarda por separado y puede encolarse automaticamente para extraccion.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <DocumentUploadButton
                label={isBusy ? "Procesando..." : "Seleccionar archivos"}
                accept={acceptedMimeLabel}
                disabled={isBusy}
                isLoading={isBusy}
                onFilesSelected={(selectedFiles) => {
                  void handleFiles(selectedFiles);
                }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[14px] text-[color:var(--color-muted)]">
            <label className="inline-flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-transparent"
                checked={autoProcessAfterUpload}
                onChange={(event) => {
                  setAutoProcessAfterUpload(event.target.checked);
                }}
                disabled={isBusy}
              />
              <span className="text-white">Encolar extraccion automaticamente despues de subir</span>
            </label>
            <span className="text-[color:var(--color-muted)]">
              Ideal para PDFs o imagenes que luego quieras revisar uno a uno.
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[16px] text-[color:var(--color-muted)]">
              MIME: PDF, JPG, PNG
            </div>
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[16px] text-[color:var(--color-muted)]">
              Limite por archivo: {formatUploadSize(maxDocumentUploadBytes)}
            </div>
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[16px] text-[color:var(--color-muted)]">
              Bucket: {documentsStorageBucket}
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/8">
            <div
              className={`h-full rounded-full transition-all ${
                status === "uploading"
                  ? "w-2/3 bg-[color:var(--color-accent)]"
                  : status === "success"
                    ? "w-full bg-emerald-500"
                    : status === "error"
                      ? "w-full bg-rose-500"
                      : status === "validating"
                        ? "w-1/3 bg-[color:var(--color-warm)]"
                        : "w-0"
              }`}
            />
          </div>

          <div aria-live="polite" className="mt-4 min-h-6">
            {message ? (
              <div
                className={`rounded-[1rem] border px-4 py-3 text-[16px] leading-7 ${
                  status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : status === "error"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : "border-[color:var(--color-border)] bg-[rgba(18,29,60,0.88)] text-[color:var(--color-muted)]"
                }`}
              >
                {message}
              </div>
            ) : null}
          </div>

          {status === "success" || status === "error" || status === "cancelled" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={() => {
                  router.push(`/app/o/${slug}/review`);
                }}
              >
                Ir a Revision
              </button>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() => {
                  setStatus("idle");
                  setMessage("");
                }}
              >
                Seguir cargando
              </button>
            </div>
          ) : null}
        </section>

        {showSpreadsheetImport ? (
          <section className="border-t border-[color:var(--color-border)] pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[16px] font-semibold text-white">Planilla para ingreso masivo en segundo plano</p>
              <p className="max-w-3xl text-[16px] leading-8 text-[color:var(--color-muted)]">
                Usa una exportacion de compras o ventas desde tu ERP legacy.
                El sistema valida primero el lote, rechaza archivos que superen el
                limite estandar de 300 filas y, si pasa el control, lo procesa en
                background con avance visible por bloques.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[220px]">
                <span className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Importar como
                </span>
                <select
                  className="min-h-[48px] w-full rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 text-[15px] text-white outline-none transition focus:border-[color:var(--color-accent)]"
                  value={spreadsheetLedgerKind}
                  disabled={isSpreadsheetBusy}
                  onChange={(event) => {
                    setSpreadsheetLedgerKind(event.target.value === "sale" ? "sale" : "purchase");
                  }}
                >
                  <option value="purchase">Compras del periodo</option>
                  <option value="sale">Ventas del periodo</option>
                </select>
              </label>
              <DocumentUploadButton
                label={isSpreadsheetBusy ? "Procesando en segundo plano..." : "Seleccionar planilla"}
                accept={acceptedSpreadsheetLabel}
                multiple={false}
                disabled={isSpreadsheetBusy}
                isLoading={isSpreadsheetBusy}
                className="ui-button ui-button--secondary"
                onFilesSelected={(selectedFiles) => {
                  void handleSpreadsheetFiles(selectedFiles);
                }}
              />
              {hasActiveSpreadsheetRun ? (
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  disabled={isCancellingSpreadsheet}
                  onClick={() => {
                    void handleCancelSpreadsheetImport();
                  }}
                >
                  {isCancellingSpreadsheet ? "Cancelando..." : "Cancelar importacion"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[16px] text-[color:var(--color-muted)]">
              Formatos: CSV, TSV, XLSX, XLS
            </div>
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[16px] text-[color:var(--color-muted)]">
              Flujo estandar: maximo 300 filas por archivo
            </div>
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[16px] text-[color:var(--color-muted)]">
              Salida: documentos listos para clasificar
            </div>
          </div>

          <div className="mt-5 rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-4 text-[15px] leading-7 text-[color:var(--color-muted)]">
            Columnas tipicas que la IA suele reconocer:
            <span className="ml-2 text-white">Fecha, Tipo, Comprobante, N°, Proveedor o Cliente, Moneda, Total, Saldo.</span>
            <span className="mt-2 block">
              Si el ERP trae otros nombres o cambia el orden, la interpretacion intenta adaptarse sin pedirte una plantilla fija. El control inicial se hace sin gastar IA para evitar corridas demasiado grandes.
            </span>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/8">
            <div
              style={{
                width:
                  spreadsheetStatus === "idle"
                    ? "0%"
                    : `${Math.max(0, Math.min(100, spreadsheetProgressPercent))}%`,
              }}
              className={`h-full rounded-full transition-all ${
                spreadsheetStatus === "uploading"
                  ? "bg-[color:var(--color-accent)]"
                : spreadsheetStatus === "success"
                    ? "bg-emerald-500"
                  : spreadsheetStatus === "cancelled"
                    ? "bg-[color:var(--color-warm)]"
                  : spreadsheetStatus === "error"
                      ? "bg-rose-500"
                      : "bg-transparent"
              }`}
            />
          </div>

          <div aria-live="polite" className="mt-4 min-h-6">
            {spreadsheetMessage ? (
              <div
                className={`rounded-[1rem] border px-4 py-3 text-[16px] leading-7 ${
                  spreadsheetStatus === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : spreadsheetStatus === "cancelled"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : spreadsheetStatus === "error"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : "border-[color:var(--color-border)] bg-[rgba(18,29,60,0.88)] text-[color:var(--color-muted)]"
                }`}
              >
                {spreadsheetMessage}
              </div>
            ) : null}
          </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
