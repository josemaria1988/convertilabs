import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { dispatchAgendaPush } from "@/modules/push/dispatch";
import { pushJson } from "@/modules/push/http";
import { readVapidConfig, validCronAuthorization } from "@/modules/push/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!validCronAuthorization(request.headers.get("authorization"))) return pushJson({ ok: false, message: "No autorizado." }, 401);
  const config = readVapidConfig();
  if (!config) return pushJson({ ok: false, message: "Notificaciones sin configurar." }, 503);
  try {
    const summary = await dispatchAgendaPush({ supabase: getSupabaseServiceRoleClient(), config });
    const ok = summary.errors + summary.failed + summary.unknown === 0;
    return pushJson({ ok, ...summary }, ok ? 200 : 500);
  } catch { return pushJson({ ok: false, message: "No se pudo completar la corrida de notificaciones." }, 500); }
}
