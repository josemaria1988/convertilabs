"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  enqueueSelectedDocumentExtractionsAction,
  failDocumentUploadAction,
  finalizeDocumentUploadAction,
  prepareDocumentUploadAction,
} from "@/app/app/o/[slug]/documents/actions";
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
  | "error";

type DocumentUploadDropzoneProps = {
  slug: string;
  panelId?: string;
};

type SelectedUploadFile = {
  file: File;
  validation: ReturnType<typeof validateDocumentUploadCandidate>;
};

const acceptedMimeLabel = allowedDocumentUploadMimeTypes.join(", ");

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
}: DocumentUploadDropzoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [autoProcessAfterUpload, setAutoProcessAfterUpload] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

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

      const preparedUpload = await prepareDocumentUploadAction({
        slug,
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
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

  const isBusy = status === "uploading" || isRefreshing;

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[16px] font-semibold text-white">Cargar documentos</p>
          <p className="max-w-2xl text-[16px] leading-8 text-[color:var(--color-muted)]">
            Arrastra uno o varios PDF, JPG o PNG, carga una carpeta completa o usa
            los botones para ingreso masivo al bucket privado. Cada archivo valida
            MIME y tamano, se guarda por separado y puede encolarse automaticamente
            para extraccion.
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
          <DocumentUploadButton
            label={isBusy ? "Procesando..." : "Cargar carpeta"}
            accept={acceptedMimeLabel}
            disabled={isBusy}
            directory
            className="ui-button ui-button--secondary"
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
          Recomendado para lotes grandes de Rontil.
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
    </div>
  );
}
