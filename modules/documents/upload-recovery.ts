import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maxDocumentUploadBytes } from "./upload";

/** An interrupted acknowledgement never authorizes overwriting an existing original. */
export async function inspectStoredDocumentUpload(input: {
  supabase: Pick<SupabaseClient, "storage">;
  bucket: string;
  path: string;
  fileHash: string;
  fileSize: number;
}): Promise<"match" | "missing" | "mismatch" | "unavailable"> {
  const { data, error } = await input.supabase.storage.from(input.bucket).download(input.path);
  if (error) {
    const status = String((error as { statusCode?: string | number; status?: number }).statusCode
      ?? (error as { status?: number }).status ?? "");
    return status === "404" || (status === "400" && /not found|does not exist/i.test(error.message))
      ? "missing" : "unavailable";
  }
  if (!data || data.size !== input.fileSize || data.size > maxDocumentUploadBytes) return "mismatch";
  const bytes = new Uint8Array(await data.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex") === input.fileHash ? "match" : "mismatch";
}
