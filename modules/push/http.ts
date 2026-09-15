import "server-only";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { eventKey } from "./agenda";
import { deliverPush } from "./dispatch";
import { localDay, PUSH_SCHEDULE, PushError, readVapidConfig, subscriptionStatus, validateIdentity, validateSubscription } from "./validation";

export function pushJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
export function pushFailure(error: unknown) {
  return pushJson({ ok: false, message: error instanceof PushError ? error.message : "No se pudo completar la operación de notificaciones." }, error instanceof PushError ? error.status : 500);
}
export async function readPushBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new PushError(403, "Origen no autorizado.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new PushError(415, "Se requiere JSON.");
  if (Number(request.headers.get("content-length") ?? 0) > 12288) throw new PushError(413, "Suscripción demasiado grande.");
  if (!request.body) throw new PushError(400, "Faltan los datos de la suscripción.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 12288) { await reader.cancel(); throw new PushError(413, "Suscripción demasiado grande."); }
      chunks.push(part.value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
    return body as Record<string, unknown>;
  } catch (error) { if (error instanceof PushError) throw error; throw new PushError(400, "JSON no válido."); }
}
async function context(slug: unknown, deviceId: unknown) {
  const identity = validateIdentity(slug, deviceId);
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) throw new PushError(401, "Iniciá sesión para configurar los avisos.");
  const org = await client.from("organizations").select("id,slug,organization_members!inner(user_id,is_active)")
    .eq("slug", identity.slug).eq("organization_members.user_id", auth.data.user.id).eq("organization_members.is_active", true).maybeSingle();
  if (org.error || !org.data) throw new PushError(403, "No tenés acceso a esta empresa.");
  return { ...identity, client, userId: auth.data.user.id, organizationId: org.data.id as string };
}
export async function pushStatus(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const ctx = await context(query.get("slug"), query.get("deviceId"));
    const config = readVapidConfig(); const configured = !!config && (process.env.CRON_SECRET?.length ?? 0) >= 32;
    const existing = await ctx.client.from("web_push_subscriptions").select("enabled,vapid_public_key,expires_at,disabled_reason,endpoint_hash")
      .eq("organization_id", ctx.organizationId).eq("user_id", ctx.userId).eq("device_id", ctx.deviceId).maybeSingle();
    if (existing.error) throw new Error("push_status_failed");
    return pushJson({ ok: true, configured, publicKey: config?.publicKey ?? null,
      ...subscriptionStatus(existing.data, config?.publicKey ?? null), subscriptionEndpointHash: existing.data?.endpoint_hash ?? null, schedule: PUSH_SCHEDULE });
  } catch (error) { return pushFailure(error); }
}
export async function mutatePush(request: Request, action: "subscribe" | "disable" | "test") {
  try {
    const body = await readPushBody(request); const ctx = await context(body.slug, body.deviceId);
    if (action === "disable") {
      const result = await ctx.client.rpc("disable_web_push_subscription", { p_organization_id: ctx.organizationId, p_device_id: ctx.deviceId });
      if (result.error) throw new Error("push_disable_failed");
      return pushJson({ ok: true, subscribed: false });
    }
    const config = readVapidConfig();
    if (!config || (process.env.CRON_SECRET?.length ?? 0) < 32) throw new PushError(503, "El envío de avisos todavía no está configurado.");
    if (action === "subscribe") {
      const subscription = validateSubscription(body.subscription);
      const result = await ctx.client.rpc("register_web_push_subscription", { p_organization_id: ctx.organizationId, p_device_id: ctx.deviceId,
        p_endpoint: subscription.endpoint, p_p256dh: subscription.keys.p256dh, p_auth_key: subscription.keys.auth,
        p_vapid_public_key: config.publicKey, p_expires_at: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null });
      if (result.error) throw new PushError(400, "No se pudo registrar este dispositivo. Revisá los permisos e intentá nuevamente.");
      return pushJson({ ok: true, subscribed: true });
    }
    const existing = await ctx.client.from("web_push_subscriptions").select("id").eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId).eq("device_id", ctx.deviceId).eq("enabled", true).eq("vapid_public_key", config.publicKey).maybeSingle();
    if (existing.error || !existing.data) throw new PushError(409, "Primero activá las notificaciones de este dispositivo.");
    const day = localDay();
    const status = await deliverPush({ supabase: getSupabaseServiceRoleClient(), config, subscriptionId: existing.data.id, day, slug: ctx.slug,
      event: { key: eventKey(`test:${day}`), sourceType: "test", sourceId: null, sourceDueDate: day,
        title: "Convertilabs · Prueba", body: "Los avisos de la Agenda están activados en este dispositivo." } });
    if (status !== "accepted" && status !== "already_attempted") throw new PushError(502, status === "expired" ? "La suscripción venció. Volvé a activar los avisos." : "No se pudo confirmar el envío. La prueba no se repite automáticamente.");
    return pushJson({ ok: true, status, message: status === "accepted" ? "Prueba aceptada por el proveedor de notificaciones." : "La prueba de hoy ya fue intentada en este dispositivo." });
  } catch (error) { return pushFailure(error); }
}
