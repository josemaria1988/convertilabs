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

type UploadStatus = "idle" | "validating" | "uploading" | "success" | "error";

type DocumentUploadDropzoneProps = {
  slug: string;
  panelId?: string;
};

const acceptedMimeLabel = allowedDocumentUploadMimeTypes.join(", ");

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
      await failDashboardDocumentUpload({
        slug,
        documentId: preparedUpload.documentId,
        errorMessage: finalizedUpload.message,
      });
      setStatus("error");
      setMessage(finalizedUpload.message);
      startTransition(() => {
        router.refresh();
      });
      return;
    }

    setStatus("success");
    setMessage("Documento subido. Refrescando el dashboard...");
    startTransition(() => {
      router.refresh();
    });
  }

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
            bucket privado. La metadata se crea primero y el dashboard se
            refresca al terminar.
          </p>
        </div>
        <DocumentUploadButton
          label={status === "uploading" ? "Subiendo..." : "Seleccionar archivo"}
          accept={acceptedMimeLabel}
          disabled={status === "uploading" || isRefreshing}
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
              ? "w-3/4 bg-[color:var(--color-accent)]"
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
