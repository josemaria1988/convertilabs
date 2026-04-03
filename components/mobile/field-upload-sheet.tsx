"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeFileSha256, uploadFileToSignedUrl } from "@/lib/browser/document-upload-client";
import { normalizeMobileCaptureFile } from "@/lib/browser/mobile-image-normalizer";
import {
  documentsStorageBucket,
  formatUploadSize,
  maxDocumentUploadBytes,
  validateDocumentUploadCandidate,
} from "@/modules/documents/upload";
import type { OrganizationCostCenterSummary } from "@/modules/cost-centers/service";

type UploadStatus = "idle" | "preparing" | "uploading" | "processing" | "success" | "error";

type FieldUploadSheetProps = {
  slug: string;
  costCenters: OrganizationCostCenterSummary[];
  initialCostCenterId?: string | null;
  prepareUploadAction: (input: {
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    fileHash?: string | null;
    sourceSurface?: "mobile_field";
  }) => Promise<{
    ok: boolean;
    message: string;
    documentId?: string;
    signedUploadUrl?: string;
  }>;
  finalizeUploadAction: (input: {
    documentId: string;
  }) => Promise<{
    ok: boolean;
    message: string;
    documentId?: string;
  }>;
  failUploadAction: (input: {
    documentId: string;
    errorMessage?: string;
  }) => Promise<{
    ok: boolean;
    message?: string;
  }>;
  enqueueExtractionsAction: (input: {
    documentIds: string[];
  }) => Promise<{
    ok: boolean;
    queuedCount: number;
    failedCount: number;
    message: string;
  }>;
  assignCostCenterAction: (input: {
    documentId: string;
    costCenterId: string | null;
  }) => Promise<{
    ok: boolean;
    message: string;
  }>;
};

export function FieldUploadSheet({
  costCenters,
  initialCostCenterId = null,
  prepareUploadAction,
  finalizeUploadAction,
  failUploadAction,
  enqueueExtractionsAction,
  assignCostCenterAction,
}: FieldUploadSheetProps) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState(initialCostCenterId ?? "");
  const [isRefreshing, startTransition] = useTransition();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeCostCenters = useMemo(() => costCenters.filter((item) => item.isActive), [costCenters]);

  async function handleFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setStatus("preparing");
    setMessage(`Preparando ${files.length} archivo(s) para subida...`);

    const normalizedFiles = await Promise.all(files.map(async (file) => {
      try {
        return await normalizeMobileCaptureFile(file);
      } catch {
        return file;
      }
    }));
    const acceptedFiles: File[] = [];
    const rejectedMessages: string[] = [];

    for (const file of normalizedFiles) {
      const validation = validateDocumentUploadCandidate({
        name: file.name,
        type: file.type,
        size: file.size,
      });

      if (validation.success) {
        acceptedFiles.push(file);
      } else {
        rejectedMessages.push(`${file.name}: ${validation.message}`);
      }
    }

    if (acceptedFiles.length === 0) {
      setStatus("error");
      setMessage(rejectedMessages[0] ?? "No encontramos archivos validos para subir.");
      return;
    }

    const uploadedDocumentIds: string[] = [];
    const assignmentWarnings: string[] = [];
    const uploadErrors: string[] = [];

    for (const [index, file] of acceptedFiles.entries()) {
      setStatus("uploading");
      setMessage(`Subiendo ${index + 1}/${acceptedFiles.length}: ${file.name}`);

      let fileHash: string | null = null;

      try {
        fileHash = await computeFileSha256(file);
      } catch {
        fileHash = null;
      }

      const preparedUpload = await prepareUploadAction({
        originalFilename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileHash,
        sourceSurface: "mobile_field",
      });

      if (!preparedUpload.ok || !preparedUpload.documentId || !preparedUpload.signedUploadUrl) {
        uploadErrors.push(preparedUpload.message);
        continue;
      }

      const uploadResult = await uploadFileToSignedUrl({
        signedUploadUrl: preparedUpload.signedUploadUrl,
        file,
      });

      if (!uploadResult.ok) {
        uploadErrors.push(uploadResult.message);
        await failUploadAction({
          documentId: preparedUpload.documentId,
          errorMessage: uploadResult.message,
        });
        continue;
      }

      const finalizedUpload = await finalizeUploadAction({
        documentId: preparedUpload.documentId,
      });

      if (!finalizedUpload.ok || !finalizedUpload.documentId) {
        uploadErrors.push(finalizedUpload.message);
        continue;
      }

      if (selectedCostCenterId) {
        const assignmentResult = await assignCostCenterAction({
          documentId: finalizedUpload.documentId,
          costCenterId: selectedCostCenterId,
        });

        if (!assignmentResult.ok) {
          assignmentWarnings.push(assignmentResult.message);
        }
      }

      uploadedDocumentIds.push(finalizedUpload.documentId);
    }

    if (uploadedDocumentIds.length === 0) {
      setStatus("error");
      setMessage(uploadErrors[0] ?? rejectedMessages[0] ?? "No pudimos cargar los documentos seleccionados.");
      return;
    }

    setStatus("processing");
    setMessage("Carga completa. Encolando extraccion para seguir el flujo canonico...");

    const extractionResult = await enqueueExtractionsAction({
      documentIds: uploadedDocumentIds,
    });

    setStatus(extractionResult.failedCount > 0 || uploadErrors.length > 0 ? "error" : "success");
    setMessage([
      `${uploadedDocumentIds.length}/${acceptedFiles.length} archivo(s) quedaron cargado(s) en ${documentsStorageBucket}.`,
      extractionResult.message,
      rejectedMessages.length > 0 ? rejectedMessages[0] : null,
      assignmentWarnings.length > 0 ? assignmentWarnings[0] : null,
      uploadErrors.length > 0 ? uploadErrors[0] : null,
    ].filter(Boolean).join(" "));

    startTransition(() => {
      router.refresh();
    });
  }

  const isBusy = status === "preparing" || status === "uploading" || status === "processing" || isRefreshing;

  return (
    <section className="field-panel">
      <div className="field-panel__header">
        <div>
          <p className="field-panel__eyebrow">Captura</p>
          <h1 className="field-panel__title">Subir documento</h1>
          <p className="field-panel__description">
            Abre la camara o selecciona un archivo. La app usa el mismo bucket privado y la misma extraccion que la web.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-white">Proyecto activo</span>
          <select
            className="field-input"
            value={selectedCostCenterId}
            onChange={(event) => {
              setSelectedCostCenterId(event.target.value);
            }}
            disabled={isBusy}
          >
            <option value="">Sin proyecto</option>
            {activeCostCenters.map((costCenter) => (
              <option key={costCenter.id} value={costCenter.id}>
                {costCenter.name}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-[22px] border border-dashed border-[color:var(--color-border)] bg-[rgba(18,29,60,0.52)] p-5">
          <p className="text-sm font-semibold text-white">Accion principal</p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Saca una foto del comprobante o carga PDF, JPG o PNG dentro del perimetro actual. Las fotos grandes se compactan en el navegador antes de subir.
          </p>
          <button
            type="button"
            className="ui-button ui-button--primary mt-4 min-h-[46px] w-full"
            disabled={isBusy}
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            {isBusy ? "Procesando..." : "Subir documento"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="field-inline-stat">
            Limite por archivo: {formatUploadSize(maxDocumentUploadBytes)}
          </div>
          <div className="field-inline-stat">
            Formatos: PDF, JPG, PNG
          </div>
          <div className="field-inline-stat">
            Proyecto: {selectedCostCenterId ? activeCostCenters.find((item) => item.id === selectedCostCenterId)?.name ?? "Seleccionado" : "Opcional"}
          </div>
        </div>

        {message ? (
          <div className={`rounded-[18px] border px-4 py-3 text-sm leading-7 ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : status === "error"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-[color:var(--color-border)] bg-[rgba(18,29,60,0.72)] text-[color:var(--color-muted)]"
          }`}>
            {message}
          </div>
        ) : null}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void handleFiles(files);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void handleFiles(files);
        }}
      />

      {sheetOpen ? (
        <div className="field-sheet-overlay" role="dialog" aria-modal="true">
          <div className="field-sheet">
            <div className="field-sheet__handle" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="field-panel__eyebrow">Elegir origen</p>
                <h2 className="field-panel__title">Como quieres cargar este documento?</h2>
                <p className="field-panel__description">
                  Puedes abrir la camara trasera o cargar archivos desde el dispositivo.
                </p>
              </div>
              <button
                type="button"
                className="ui-button ui-button--ghost min-h-[38px] px-3"
                onClick={() => {
                  setSheetOpen(false);
                }}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                className="field-sheet__option"
                onClick={() => {
                  setSheetOpen(false);
                  cameraInputRef.current?.click();
                }}
              >
                <span className="field-sheet__option-title">Sacar foto</span>
                <span className="field-sheet__option-body">
                  Prioriza la camara trasera cuando el navegador Android lo soporte.
                </span>
              </button>
              <button
                type="button"
                className="field-sheet__option"
                onClick={() => {
                  setSheetOpen(false);
                  fileInputRef.current?.click();
                }}
              >
                <span className="field-sheet__option-title">Cargar archivo</span>
                <span className="field-sheet__option-body">
                  PDFs e imagenes compatibles con el mismo flujo privado de la web.
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
