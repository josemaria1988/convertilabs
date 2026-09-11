import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maximumBytes = 5 * 1024 * 1024;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Uses the authenticated user's RLS client; never broadens access with service_role. */
export async function loadEmailXmlOriginal(supabase: SupabaseClient, documentId: string, userId: string) {
  if (!uuid.test(documentId) || !uuid.test(userId)) return null;
  const document = await supabase.from("documents").select("id,organization_id,mime_type,metadata")
    .eq("id", documentId).maybeSingle();
  if (document.error || !document.data || document.data.mime_type !== "application/xml") return null;
  const org = String(document.data.organization_id);
  const metadata = object(document.data.metadata);
  const rawId = metadata.integration_raw_record_id;
  if (metadata.original_storage !== "integration_raw_records" || metadata.binary_available !== false
    || typeof rawId !== "string" || !uuid.test(rawId)) return null;
  const member = await supabase.from("organization_members").select("organization_id")
    .eq("organization_id", org).eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (member.error || !member.data) return null;
  const source = await supabase.from("document_source_refs").select("raw_record_id")
    .eq("organization_id", org).eq("document_id", documentId).eq("provider", "email_inbox")
    .eq("source_kind", "cfe_xml_email").eq("raw_record_id", rawId).limit(1).maybeSingle();
  if (source.error || source.data?.raw_record_id !== rawId) return null;
  const raw = await supabase.from("integration_raw_records").select("payload_hash,payload_json")
    .eq("organization_id", org).eq("id", rawId).eq("provider", "email_inbox")
    .eq("entity_type", "email_attachment").maybeSingle();
  if (raw.error || !raw.data) return null;
  const payload = object(raw.data.payload_json), encoded = payload.original_base64;
  if (payload.encoding !== "base64" || typeof encoded !== "string" || !encoded.length
    || encoded.length > Math.ceil(maximumBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maximumBytes || bytes.toString("base64") !== encoded
    || payload.byte_length !== bytes.length
    || createHash("sha256").update(bytes).digest("hex") !== raw.data.payload_hash) return null;
  const name = String(payload.original_filename ?? "comprobante.xml").split(/[\\/]/).at(-1)!
    .replace(/[\x00-\x1f\x7f]/g, "").slice(0, 160);
  return { bytes, filename: /\.xml$/i.test(name) ? name : "comprobante.xml" };
}
