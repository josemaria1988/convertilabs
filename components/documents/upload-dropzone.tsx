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
  | "queued"
  | "success"
  | "error";

type DocumentUploadDropzoneProps = {
  slug: string;
  panelId?: string;
};

type ProcessingStatusResponse = {
  documentId: string;
  runId: string | null;
  documentStatus: string;
  runStatus: string | null;
  providerStatus: string | null;
  draftId: string | null;
  reviewUrl: string | null;
  failureMessage: string | null;
  updatedAt: string;
  isTerminal: boolean;
};

const acceptedMimeLabel = allowedDocumentUploadMimeTypes.join(", ");

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildLiveProcessingMessage(status: ProcessingStatusResponse) {
  switch (status.documentStatus) {
    case "queued":
      return "Documento subido. Encolado para procesamiento...";
    case "extracting":
      return "Procesando el documento en segundo plano...";
    case "draft_ready":
      return "El draft ya esta listo. Refrescando el dashboard...";
    case "needs_review":
      return "El documento quedo listo para revision. Refrescando el dashboard...";
    case "error":
      return status.failureMessage ?? "El procesamiento del documento termino con error.";
    default:
      if (status.runStatus === "processing") {
        return "Procesando el documento en segundo plano...";
      }

      return "El documento sigue procesandose en segundo plano...";
  }
}

async function fetchProcessingStatus(documentId: string) {
  const response = await fetch(`/api/v1/documents/${documentId}/processing-status`, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await response.json() as {
    data?: ProcessingStatusResponse;
    error?: {
      message?: string;
    };
  };

  if (!response.ok || !payload.data) {
    throw new Error(
      payload.error?.message ?? "No pudimos consultar el estado del documento en este momento.",
    );
  }

  return payload.data;
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

  async function handleFile(file: File) {
    setStatus("validating");
    setMessage("");

    const validation = validateDocumentUploadCandidate({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!validation.success) {
      setStatus("error");
      setMessage(validation.message);
      return;
    }

    const preparedUpload = await prepareDashboardDocumentUpload({
      slug,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    if (!preparedUpload.ok) {
      setStatus("error");
      setMessage(preparedUpload.message);
      return;
    }

    setStatus("uploading");
    setMessage(`Subiendo ${file.name}...`);

    const supabase = getSupabaseBrowserClient();
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
      await failDashboardDocumentUpload({
        slug,
        documentId: preparedUpload.documentId,
        errorMessage: uploadError.message,
      });
      setStatus("error");
      setMessage(
        "La metadata se creo, pero la subida al bucket privado fallo. Revisa la fila en el dashboard.",
      );
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    const finalizedUpload = await finalizeDashboardDocumentUpload({
      slug,
      documentId: preparedUpload.documentId,
    });

    if (!finalizedUpload.ok) {
      setStatus("error");
      setMessage(finalizedUpload.message);
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    setStatus("queued");
    setMessage("Documento subido. Encolado para procesamiento...");

    const pollStartedAt = Date.now();

    try {
      while (Date.now() - pollStartedAt < 120_000) {
        const processingStatus = await fetchProcessingStatus(finalizedUpload.documentId);

        if (processingStatus.isTerminal) {
          if (
            processingStatus.documentStatus === "error"
            || processingStatus.runStatus === "error"
          ) {
            setStatus("error");
            setMessage(
              processingStatus.failureMessage
              ?? "El procesamiento del documento termino con error.",
            );
            startTransition(() => {
              router.refresh();
            });
            return;
          }

          setStatus("success");
          setMessage(buildLiveProcessingMessage(processingStatus));
          startTransition(() => {
            router.refresh();
          });
          return;
        }

        setStatus("queued");
        setMessage(buildLiveProcessingMessage(processingStatus));

        const elapsedMs = Date.now() - pollStartedAt;
        await wait(elapsedMs < 30_000 ? 2_000 : 5_000);
      }

      setStatus("idle");
      setMessage(
        "Documento subido y encolado. El procesamiento sigue en segundo plano; actualiza el dashboard en unos segundos si todavia no ves el draft.",
      );
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatus("idle");
      setMessage(
        "Documento subido y encolado. No pudimos consultar el estado en vivo; actualiza el dashboard en unos segundos.",
      );
      startTransition(() => {
        router.refresh();
      });
    }
  }

  const isBusy = status === "uploading" || status === "queued" || isRefreshing;

  return (
    <div
      id={panelId}
      className={`rounded-[1.5rem] border p-6 transition ${
        isDragging
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]/70"
          : "border-dashed border-[color:var(--color-border)] bg-white/58"
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
        const file = event.dataTransfer.files?.[0];

        if (file) {
          void handleFile(file);
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-semibold">Subir documento</p>
          <p className="max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
            Arrastra un PDF, JPG o PNG o usa el boton para cargarlo directo al
            bucket privado. La metadata se crea primero, el procesamiento se
            encola en background y el dashboard se refresca al llegar a un
            estado terminal.
          </p>
        </div>
        <DocumentUploadButton
          label={isBusy ? "Procesando..." : "Seleccionar archivo"}
          accept={acceptedMimeLabel}
          disabled={isBusy}
          isLoading={isBusy}
          onFileSelected={(file) => {
            void handleFile(file);
          }}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm text-[color:var(--color-muted)]">
          MIME: PDF, JPG, PNG
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm text-[color:var(--color-muted)]">
          Limite: {formatUploadSize(maxDocumentUploadBytes)}
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm text-[color:var(--color-muted)]">
          Bucket: {documentsStorageBucket}
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/8">
        <div
          className={`h-full rounded-full transition-all ${
            status === "uploading"
              ? "w-2/3 bg-[color:var(--color-accent)]"
              : status === "queued"
                ? "w-5/6 bg-sky-500"
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
            className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
              status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : status === "error"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-[color:var(--color-border)] bg-white/80 text-[color:var(--color-muted)]"
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

