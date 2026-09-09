"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProcessingProviderSelect } from "@/components/documents/processing-provider-select";
import type { DocumentProcessingProvider } from "@/modules/documents/processing-provider";
import { computeFileSha256, uploadFileToSignedUrl } from "@/lib/browser/document-upload-client";
import { normalizeMobileCaptureFile } from "@/lib/browser/mobile-image-normalizer";
import {
  buildDescriptiveDocumentFilename,
  documentsStorageBucket,
  formatUploadSize,
  maxDocumentUploadBytes,
  validateDocumentUploadCandidate,
} from "@/modules/documents/upload";

type UploadStatus = "idle" | "preparing" | "uploading" | "processing" | "success" | "error";

type FieldUploadWorkUnitOption = {
  id: string;
  name: string;
  code: string | null;
  kind: string;
  status: string;
  customerName: string | null;
  documentCount: number;
};

type FieldUploadSheetProps = {
  slug: string;
  defaultProcessingProvider?: DocumentProcessingProvider;
  allowPaidAPI?: boolean;
  workUnits: FieldUploadWorkUnitOption[];
  initialWorkUnitId?: string | null;
  prepareUploadAction: (input: {
    processingProvider?: DocumentProcessingProvider;
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
    uploadRequired?: boolean;
    uploadLeaseToken?: string | null;
    shouldEnqueue?: boolean;
  }>;
  finalizeUploadAction: (input: {
    documentId: string;
    uploadLeaseToken?: string | null;
  }) => Promise<{
    ok: boolean;
    message: string;
    documentId?: string;
    shouldEnqueue?: boolean;
  }>;
  failUploadAction: (input: {
    documentId: string;
    uploadLeaseToken?: string | null;
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
  assignWorkUnitAction: (input: {
    documentId: string;
    workUnitId: string | null;
  }) => Promise<{
    ok: boolean;
    message: string;
  }>;
};

export function FieldUploadSheet({
  slug,
  defaultProcessingProvider = "openai",
  allowPaidAPI = true,
  workUnits,
  initialWorkUnitId = null,
  prepareUploadAction,
  finalizeUploadAction,
  failUploadAction,
  enqueueExtractionsAction,
  assignWorkUnitAction,
}: FieldUploadSheetProps) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [processingProvider, setProcessingProvider] = useState(defaultProcessingProvider);
  const [message, setMessage] = useState("");
  const [selectedWorkUnitId, setSelectedWorkUnitId] = useState(initialWorkUnitId ?? "");
  const [descriptiveName, setDescriptiveName] = useState("");
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openWorkUnits = useMemo(() => workUnits, [workUnits]);
  const selectedWorkUnit = useMemo(() =>
    openWorkUnits.find((item) => item.id === selectedWorkUnitId) ?? null,
  [openWorkUnits, selectedWorkUnitId]);

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
    const uploadFilenames = new Map<File, string>();
    const automaticName = `factura-${new Date().toISOString().replace(/[:.]/g, "-")}`;

    for (const [index, file] of normalizedFiles.entries()) {
      const uploadFilename = buildDescriptiveDocumentFilename({
        descriptiveName: descriptiveName || automaticName,
        originalFilename: file.name,
        mimeType: file.type,
        sequenceNumber: normalizedFiles.length > 1 ? index + 1 : null,
      });
      const validation = validateDocumentUploadCandidate({
        name: uploadFilename,
        type: file.type,
        size: file.size,
      });

      if (validation.success) {
        acceptedFiles.push(file);
        uploadFilenames.set(file, uploadFilename);
      } else {
        rejectedMessages.push(`${uploadFilename}: ${validation.message}`);
      }
    }

    if (acceptedFiles.length === 0) {
      setStatus("error");
      setMessage(rejectedMessages[0] ?? "No encontramos archivos validos para subir.");
      return;
    }

    const uploadedDocumentIds: string[] = [];
    const extractionDocumentIds: string[] = [];
    let reusedDocumentCount = 0;
    const assignmentWarnings: string[] = [];
    const uploadErrors: string[] = [];

    for (const [index, file] of acceptedFiles.entries()) {
      const uploadFilename = uploadFilenames.get(file) ?? file.name;
      setStatus("uploading");
      setMessage(`Subiendo ${index + 1}/${acceptedFiles.length}: ${uploadFilename}`);

      let fileHash: string | null = null;

      try {
        fileHash = await computeFileSha256(file);
      } catch {
        fileHash = null;
      }

      const preparedUpload = await prepareUploadAction({
        processingProvider,
        originalFilename: uploadFilename,
        mimeType: file.type,
        fileSize: file.size,
        fileHash,
        sourceSurface: "mobile_field",
      });

      if (!preparedUpload.ok || !preparedUpload.documentId) {
        uploadErrors.push(preparedUpload.message);
        continue;
      }

      if (preparedUpload.uploadRequired === false) {
        uploadedDocumentIds.push(preparedUpload.documentId);
        if (preparedUpload.shouldEnqueue) extractionDocumentIds.push(preparedUpload.documentId);
        reusedDocumentCount += 1;
        continue;
      }
      if (!preparedUpload.signedUploadUrl) {
        uploadErrors.push("No se pudo preparar la subida del original.");
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
          uploadLeaseToken: preparedUpload.uploadLeaseToken,
          errorMessage: uploadResult.message,
        });
        continue;
      }

      const finalizedUpload = await finalizeUploadAction({
        documentId: preparedUpload.documentId,
        uploadLeaseToken: preparedUpload.uploadLeaseToken,
      });

      if (!finalizedUpload.ok || !finalizedUpload.documentId) {
        uploadErrors.push(finalizedUpload.message);
        continue;
      }

      if (selectedWorkUnitId && finalizedUpload.shouldEnqueue) {
        const assignmentResult = await assignWorkUnitAction({
          documentId: finalizedUpload.documentId,
          workUnitId: selectedWorkUnitId,
        });

        if (!assignmentResult.ok) {
          assignmentWarnings.push(assignmentResult.message);
        }
      }

      uploadedDocumentIds.push(finalizedUpload.documentId);
      if (finalizedUpload.shouldEnqueue) extractionDocumentIds.push(finalizedUpload.documentId);
    }

    if (uploadedDocumentIds.length === 0) {
      setStatus("error");
      setMessage(uploadErrors[0] ?? rejectedMessages[0] ?? "No pudimos cargar los documentos seleccionados.");
      return;
    }

    setStatus("processing");
    setMessage("Carga completa. Encolando extraccion para seguir el flujo canonico...");

    const extractionResult = extractionDocumentIds.length > 0 ? await enqueueExtractionsAction({
      documentIds: Array.from(new Set(extractionDocumentIds)),
    }) : { ok: true, queuedCount: 0, failedCount: 0, message: "Se conserva el procesamiento del documento existente." };

    const completedWithoutErrors = extractionResult.failedCount === 0 && uploadErrors.length === 0;

    setStatus(completedWithoutErrors ? "success" : "error");
    setMessage([
      `${uploadedDocumentIds.length}/${acceptedFiles.length} archivo(s) quedaron cargado(s) en ${documentsStorageBucket}.`,
      extractionResult.message,
      reusedDocumentCount > 0 ? `${reusedDocumentCount} documento(s) recuperado(s) sin crear copias ni cambiar su trabajo asociado.` : null,
      rejectedMessages.length > 0 ? rejectedMessages[0] : null,
      assignmentWarnings.length > 0 ? assignmentWarnings[0] : null,
      uploadErrors.length > 0 ? uploadErrors[0] : null,
    ].filter(Boolean).join(" "));

    if (completedWithoutErrors && uploadedDocumentIds.length === 1) {
      router.push(`/app/o/${slug}/documents/${uploadedDocumentIds[0]}?focus=zeta`);
      return;
    }

    router.refresh();
  }

  const isBusy = status === "preparing" || status === "uploading" || status === "processing";

  return (
    <section className="field-panel">
      <div className="field-panel__header">
        <div>
          <p className="field-panel__eyebrow">Factura a Zeta</p>
          <h1 className="field-panel__title">Sacar foto y procesar</h1>
          <p className="field-panel__description">
            Saca una foto legible. La app la guarda en privado, extrae los datos y te lleva directo a la confirmacion antes de enviarla a Zeta.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <ProcessingProviderSelect value={processingProvider} onChange={setProcessingProvider}
          disabled={isBusy} allowPaidAPI={allowPaidAPI} />
        <div className="rounded-[22px] border border-dashed border-[color:var(--color-border)] bg-[rgba(18,29,60,0.52)] p-5">
          <p className="text-sm font-semibold text-white">Una foto, una factura</p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Inclui en la imagen el proveedor, RUT, serie, numero, fecha y totales. Las fotos grandes se compactan automaticamente.
          </p>
          <button
            type="button"
            className="ui-button ui-button--primary mt-4 min-h-[46px] w-full"
            disabled={isBusy}
            onClick={() => {
              cameraInputRef.current?.click();
            }}
          >
            {isBusy ? "Procesando..." : "Sacar foto de factura"}
          </button>
          <button
            type="button"
            className="ui-button ui-button--ghost mt-3 min-h-[42px] w-full"
            disabled={isBusy}
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            Elegir PDF o imagen
          </button>
        </div>

        <details className="rounded-[18px] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.42)] px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Opciones avanzadas (opcionales)
          </summary>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-white">Trabajo abierto</span>
              <select
                className="field-input"
                value={selectedWorkUnitId}
                onChange={(event) => {
                  setSelectedWorkUnitId(event.target.value);
                }}
                disabled={isBusy}
              >
                <option value="">Sin trabajo asignado</option>
                {openWorkUnits.map((workUnit) => (
                  <option key={workUnit.id} value={workUnit.id}>
                    {[workUnit.name, workUnit.code ? `(${workUnit.code})` : null, workUnit.customerName].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-white">Nombre descriptivo</span>
              <input
                className="field-input"
                value={descriptiveName}
                onChange={(event) => {
                  setDescriptiveName(event.target.value);
                }}
                placeholder="Se genera automaticamente"
                disabled={isBusy}
              />
            </label>
          </div>
        </details>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field-inline-stat">
            Limite por archivo: {formatUploadSize(maxDocumentUploadBytes)}
          </div>
          <div className="field-inline-stat">
            Formatos: PDF, JPG, PNG
          </div>
        </div>

        {selectedWorkUnit ? (
          <div className="field-inline-stat">Trabajo opcional: {selectedWorkUnit.name}</div>
        ) : null}

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

    </section>
  );
}
