import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";
import { enqueueDocumentProcessing } from "@/modules/documents/processing";
import { documentsStorageBucket, maxDocumentUploadBytes, sanitizeDocumentFilenameBase, validateDocumentUploadCandidate } from "@/modules/documents/upload";
import { recordIntegrationAuditEvent } from "@/modules/integrations/repository";
import { assertLocalUuid, localDocumentReviewUrl, resolveLocalCompanionContext, type LocalCompanionDependencies, type LocalCompanionIdentity } from "./context";

type DocumentCommand = LocalCompanionIdentity & { appUrl?: string };
type DocumentDependencies = LocalCompanionDependencies & { enqueue?: typeof enqueueDocumentProcessing };
type LocalDocumentRow = {
  storage_path: string; storage_bucket: string;
  id: string; status: string; file_hash: string | null; original_filename: string;
  current_processing_run_id: string | null; current_draft_id: string | null;
  metadata: Record<string, unknown> | null; created_at: string; updated_at: string;
};
const documentColumns = "id, status, file_hash, original_filename, storage_path, storage_bucket, current_processing_run_id, current_draft_id, metadata, created_at, updated_at";

export function localDocumentId(organizationId: string, fileHash: string) {
  const bytes = createHash("sha256").update(`convertilabs:local-document:v1:${organizationId}:${fileHash}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function detectLocalDocumentMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  throw new Error("El contenido del archivo no corresponde a PDF, JPG o PNG.");
}

async function readUploadFile(filePath: string) {
  if (!path.isAbsolute(filePath)) throw new Error("filePath debe ser una ruta absoluta.");
  const handle = await open(filePath, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.size > maxDocumentUploadBytes) throw new Error("Selecciona un archivo regular de hasta 20 MB, no vacio.");
    // Bounded read even if another process grows the file after stat.
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== stat.size) throw new Error("El archivo cambio mientras se leia. Volve a intentar con el archivo cerrado.");
    const content = bytes.subarray(0, bytesRead);
    const mimeType = detectLocalDocumentMime(content);
    const originalFilename = path.basename(filePath);
    const validation = validateDocumentUploadCandidate({ name: originalFilename, size: content.length, type: mimeType });
    if (!validation.success) throw new Error(validation.message);
    return { content, mimeType, originalFilename, fileHash: createHash("sha256").update(content).digest("hex") };
  } finally { await handle.close(); }
}

function summarizeDocument(row: LocalDocumentRow, input: DocumentCommand) {
  return {
    documentId: row.id, fileHash: row.file_hash, originalFilename: row.original_filename,
    runId: row.current_processing_run_id, draftId: row.current_draft_id, status: row.status,
    reviewUrl: localDocumentReviewUrl(input.slug, row.id, input.appUrl),
    localAction: row.current_draft_id ? "review" : row.metadata?.processing_provider === "codex_local" && row.current_processing_run_id ? "extract" : null,
    updatedAt: row.updated_at,
  };
}

/** Status deliberately avoids the web loader, which reconciles stale runs and writes. */
export async function loadLocalDocumentStatus(input: DocumentCommand & { documentId: string }, deps: LocalCompanionDependencies = {}) {
  assertLocalUuid(input.documentId, "documentId");
  const context = await resolveLocalCompanionContext(input, deps);
  const { data, error } = await context.supabase.from("documents").select(documentColumns)
    .eq("organization_id", context.organization.id).eq("id", input.documentId).maybeSingle();
  if (error || !data) throw new Error("Documento no encontrado en esta organizacion.");
  const row = data as LocalDocumentRow;
  let run: Record<string, unknown> | null = null;
  if (row.current_processing_run_id) {
    const response = await context.supabase.from("document_processing_runs")
      .select("id, status, provider_status, failure_stage, failure_message, created_at, finished_at")
      .eq("organization_id", context.organization.id).eq("document_id", row.id).eq("id", row.current_processing_run_id).maybeSingle();
    if (response.error) throw new Error("No se pudo leer el estado de procesamiento.");
    run = response.data;
  }
  return { ...summarizeDocument(row, input), run };
}

export async function ingestLocalDocument(input: DocumentCommand & { filePath: string }, deps: DocumentDependencies = {}) {
  const file = await readUploadFile(input.filePath);
  // Validate review URL before any persistent work.
  localDocumentReviewUrl(input.slug, "00000000-0000-0000-0000-000000000000", input.appUrl);
  const context = await resolveLocalCompanionContext({ ...input, requireWrite: true }, deps);
  const readiness = await context.supabase.from("document_processing_runs").select("id, lease_token")
    .eq("organization_id", context.organization.id).limit(1);
  if (readiness.error) throw new Error("El worker local todavía no está habilitado en Supabase. Aplicá primero la migración verificada; no se cargó el archivo.");
  const findExisting = async () => {
    const { data, error } = await context.supabase.from("documents").select(documentColumns)
      .eq("organization_id", context.organization.id).eq("file_hash", file.fileHash)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw new Error("No se pudo verificar duplicacion por hash. No se cargo el archivo.");
    return data as LocalDocumentRow | null;
  };
  const existing = await findExisting();

  // Stable primary key arbitrates simultaneous local ingests across PCs.
  const documentId = localDocumentId(context.organization.id, file.fileHash);
  const extension = file.mimeType === "application/pdf" ? ".pdf" : file.mimeType === "image/png" ? ".png" : ".jpg";
  const filename = sanitizeDocumentFilenameBase(file.originalFilename.replace(/\.[^.]+$/, "")) + extension;
  const storagePath = existing?.id === documentId ? existing.storage_path : `${context.organization.id}/${documentId}/${filename}`;
  const uploadToken = randomUUID();
  const metadata = { ...existing?.metadata, processing_provider: "codex_local", source_surface: "local_companion", local_ingest_version: 1,
    source_file_sha256: file.fileHash, actor_profile_id: context.actorProfileId,
    local_upload_token: uploadToken, local_upload_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() };
  let needsUpload = true;
  if (existing) {
    if (existing.id !== documentId || existing.metadata?.source_surface !== "local_companion"
      || existing.current_processing_run_id || existing.current_draft_id
      || !["uploading", "uploaded", "error"].includes(existing.status)) {
      return { ...summarizeDocument(existing, input), duplicate: true };
    }
    needsUpload = existing.metadata?.local_upload_complete !== true;
    const expires = Date.parse(String(existing.metadata?.local_upload_expires_at ?? ""));
    if (needsUpload && existing.status === "uploading" && Number.isFinite(expires) && expires > Date.now()) {
      return { ...summarizeDocument(existing, input), duplicate: true, message: "Otra carga del mismo archivo sigue activa; se puede retomar al vencer su reserva." };
    }
    const claim = await context.supabase.from("documents").update({ status: needsUpload ? "uploading" : "uploaded", metadata })
      .eq("id", documentId).eq("organization_id", context.organization.id).eq("updated_at", existing.updated_at).select("id").maybeSingle();
    if (claim.error || !claim.data) throw new Error("Otro proceso retomó esta carga. Consultá el estado antes de reintentar.");
  } else {
    const { error: insertError } = await context.supabase.from("documents").insert({
    id: documentId, organization_id: context.organization.id, direction: "unknown", status: "uploading",
    storage_bucket: documentsStorageBucket, storage_path: storagePath, original_filename: file.originalFilename,
    mime_type: file.mimeType, file_size: file.content.length, file_hash: file.fileHash,
    uploaded_by: context.actorProfileId, upload_source: "local_companion", source_type: "manual_upload", metadata,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      const winner = await findExisting();
      if (winner) return { ...summarizeDocument(winner, input), duplicate: true };
    }
    throw new Error("No se pudo reservar el documento local.");
  }
  }
  if (needsUpload) {
    const storage = context.supabase.storage.from(documentsStorageBucket);
    const { error: uploadError } = await storage.upload(storagePath, file.content, { contentType: file.mimeType, upsert: false });
    if (uploadError) {
      // A previous interrupted process may already have uploaded these exact bytes.
      const stored = await storage.download(storagePath);
      const sameFile = !stored.error && stored.data && stored.data.size <= maxDocumentUploadBytes
        && createHash("sha256").update(new Uint8Array(await stored.data.arrayBuffer())).digest("hex") === file.fileHash;
      if (!sameFile) {
        await context.supabase.from("documents").update({ status: "error", metadata: { ...metadata, upload_error: "No se completó la subida del archivo local." } })
          .eq("organization_id", context.organization.id).eq("id", documentId).eq("metadata->>local_upload_token", uploadToken);
        throw new Error(`La subida falló. Volvé a cargar el mismo archivo para retomar el documento ${documentId}.`);
      }
    }
  }
  const finalized = await context.supabase.from("documents").update({ status: "uploaded", metadata: { ...metadata, local_upload_complete: true } })
    .eq("organization_id", context.organization.id).eq("id", documentId).eq("metadata->>local_upload_token", uploadToken).select("id").maybeSingle();
  if (finalized.error || !finalized.data) throw new Error(`Archivo guardado, pero otro proceso retomó el documento ${documentId}. Consultá su estado.`);
  await recordIntegrationAuditEvent(context.supabase, {
    organizationId: context.organization.id, actorUserId: context.actorProfileId, entityType: "document", entityId: documentId,
    action: "local_document_uploaded", metadata: { provider: "codex_local", file_hash: file.fileHash, file_size: file.content.length },
  });
  const queued = await (deps.enqueue ?? enqueueDocumentProcessing)({ documentId, requestedBy: context.actorProfileId, triggeredBy: "upload" });
  return {
    documentId, duplicate: false, fileHash: file.fileHash, originalFilename: file.originalFilename,
    runId: queued.runId, draftId: null, status: queued.status,
    reviewUrl: localDocumentReviewUrl(input.slug, documentId, input.appUrl),
    localAction: queued.ok ? "extract" : null, ...(queued.ok ? {} : { message: queued.message }),
  };
}
