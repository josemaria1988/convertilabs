"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  failDashboardDocumentUpload,
  finalizeDashboardDocumentUpload,
  prepareDashboardDocumentUpload,
} from "@/app/app/o/[slug]/dashboard/actions";
import { DocumentUploadButton } from "@/components/documents/upload-button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

  parts.push("Ahora puedes procesarlos desde la lista de documentos.");

  return parts.join(" ");
}

export function DocumentUploadDropzone({
  slug,
  panelId = "document-upload-panel",
}: DocumentUploadDropzoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
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
          name: entry.file.name,
          message: entry.validation.message,
        });
      }
    }

    if (acceptedFiles.length === 0) {
      setStatus("error");
      setMessage(buildRejectedFilesMessage(rejectedFiles));
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const uploadedDocumentIds: string[] = [];
    const failureMessages: string[] = [];
    let uploadErrorCount = 0;

    for (const [index, file] of acceptedFiles.entries()) {
      setStatus("uploading");
      setMessage(
        `Subiendo ${index + 1}/${acceptedFiles.length}: ${file.name}${
          rejectedFiles.length > 0 ? ` | ${rejectedFiles.length} rechazado(s)` : ""
        }`,
      );

      const preparedUpload = await prepareDashboardDocumentUpload({
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

      const { error: uploadError } = await supabase.storage
        .from(preparedUpload.storageBucket)
        .uploadToSignedUrl(
          preparedUpload.storagePath,
          preparedUpload.uploadToken,
          file,
          {
            contentType: file.type,
            upsert: false,
          },
        );

      if (uploadError) {
        uploadErrorCount += 1;
        failureMessages.push(uploadError.message);
        await failDashboardDocumentUpload({
          slug,
          documentId: preparedUpload.documentId,
          errorMessage: uploadError.message,
        });
        continue;
      }

      const finalizedUpload = await finalizeDashboardDocumentUpload({
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

    setStatus(rejectedFiles.length > 0 || uploadErrorCount > 0 ? "error" : "success");
    setMessage(buildBatchCompletionMessage({
      totalAccepted: acceptedFiles.length,
      uploadedCount: uploadedDocumentIds.length,
      rejectedCount: rejectedFiles.length,
      uploadErrorCount,
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
            Arrastra uno o varios PDF, JPG o PNG o usa el boton para cargarlos al
            bucket privado. Cada archivo valida MIME y tamano, se guarda por
            separado y queda listo para procesarse despues desde la grilla.
          </p>
        </div>
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
