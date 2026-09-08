import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type LocalCompanionIdentity = { slug: string; actorProfileId: string };
export type LocalCompanionContext = {
  supabase: SupabaseClient;
  organization: { id: string; slug: string; name: string };
  actorProfileId: string;
  role: string;
};
export type LocalCompanionDependencies = { supabase?: SupabaseClient };

export function assertLocalUuid(value: string, label: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} debe ser un UUID explicito.`);
  }
}

/** Administrative pilot: the OS user controls the credential-bearing process.
 * An actor argument is audit attribution, not a replacement for user login.
 */
export async function resolveLocalCompanionContext(
  input: LocalCompanionIdentity & { requireWrite?: boolean },
  deps: LocalCompanionDependencies = {},
): Promise<LocalCompanionContext> {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(input.slug)) {
    throw new Error("Indica un slug de organizacion valido y explicito.");
  }
  assertLocalUuid(input.actorProfileId, "actorProfileId");
  const supabase = deps.supabase ?? getSupabaseServiceRoleClient();
  const { data: organization, error: organizationError } = await supabase.from("organizations")
    .select("id, slug, name").eq("slug", input.slug).maybeSingle();
  if (organizationError || !organization) {
    throw new Error("No se pudo resolver la organizacion indicada.");
  }
  const { data: member, error: memberError } = await supabase.from("organization_members")
    .select("role").eq("organization_id", organization.id)
    .eq("user_id", input.actorProfileId).eq("is_active", true).maybeSingle();
  if (memberError || !member) {
    throw new Error("El actor indicado no es un miembro activo de esta organizacion.");
  }
  const writeRoles = ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator", "developer"];
  if (input.requireWrite && !writeRoles.includes(member.role)) {
    throw new Error("El rol del actor no permite cargar o procesar documentos.");
  }
  return { supabase, organization, actorProfileId: input.actorProfileId, role: member.role };
}

export function localDocumentReviewUrl(slug: string, documentId: string, appUrl?: string) {
  assertLocalUuid(documentId, "documentId");
  const pathname = `/app/o/${encodeURIComponent(slug)}/documents/${documentId}`;
  if (!appUrl) return pathname;
  const base = new URL(appUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))) {
    throw new Error("La URL debe usar HTTPS o HTTP de loopback local.");
  }
  if (base.username || base.password) throw new Error("La URL no debe contener credenciales.");
  return new URL(pathname, base.origin).toString();
}
