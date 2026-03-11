"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabaseServerClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { validateDocumentUploadCandidate } from "@/modules/documents/upload";

type PrepareDocumentUploadInput = {
  slug: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

type FinalizeDocumentUploadInput = {
  slug: string;
  documentId: string;
};

type FailDocumentUploadInput = FinalizeDocumentUploadInput & {
  errorMessage?: string;
};

type PrepareDocumentUploadSuccess = {
  ok: true;
  documentId: string;
  storageBucket: string;
  storagePath: string;
  uploadToken: string;
};

type UploadActionError = {
  ok: false;
  message: string;
};

type PrepareDocumentUploadRpcRow = {
  document_id: string;
  storage_bucket: string;
  storage_path: string;
  status: string;
};

function buildDashboardPath(slug: string) {
  return `/app/o/${slug}/dashboard`;
}

export async function prepareDashboardDocumentUpload(
  input: PrepareDocumentUploadInput,
): Promise<PrepareDocumentUploadSuccess | UploadActionError> {
  const validation = validateDocumentUploadCandidate({
    name: input.originalFilename,
    type: input.mimeType,
    size: input.fileSize,
  });

  if (!validation.success) {
    return {
      ok: false,
      message: validation.message,
    };
  }

  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("prepare_document_upload", {
      p_org_id: organization.id,
      p_original_filename: input.originalFilename,
      p_mime_type: input.mimeType,
      p_file_size: input.fileSize,
      p_direction: "purchase",
    })
    .single();

  const row = data as PrepareDocumentUploadRpcRow | null;

  if (error || !row?.document_id || !row.storage_bucket || !row.storage_path) {
    return {
      ok: false,
      message:
        error?.message
        ?? "No se pudo preparar la metadata del documento para la subida.",
    };
  }

  const supabaseAdmin = getSupabaseServiceRoleClient();
  const { data: signedUpload, error: signedUploadError } = await supabaseAdmin.storage
    .from(row.storage_bucket)
    .createSignedUploadUrl(row.storage_path, {
      upsert: false,
    });

  if (signedUploadError || !signedUpload?.token) {
    return {
      ok: false,
      message:
        signedUploadError?.message
        ?? "No se pudo preparar el token de subida al bucket privado.",
    };
  }

  return {
    ok: true,
    documentId: row.document_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    uploadToken: signedUpload.token,
  };
}

export async function finalizeDashboardDocumentUpload(
  input: FinalizeDocumentUploadInput,
): Promise<{ ok: true } | UploadActionError> {
  await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("complete_document_upload", {
    p_document_id: input.documentId,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message
        ?? "El archivo subio, pero no pudimos cerrar el estado del documento.",
    };
  }

  revalidatePath(buildDashboardPath(input.slug));

  return {
    ok: true,
  };
}

export async function failDashboardDocumentUpload(
  input: FailDocumentUploadInput,
): Promise<{ ok: true } | UploadActionError> {
  await requireOrganizationDashboardPage(input.slug);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("fail_document_upload", {
    p_document_id: input.documentId,
    p_error_message: input.errorMessage ?? null,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message
        ?? "No pudimos registrar el error de upload en este momento.",
    };
  }

  revalidatePath(buildDashboardPath(input.slug));

  return {
    ok: true,
  };
}
