import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZetaCredentialOverrides, ZetaRuntimeConfig } from "@/modules/integrations/zeta/client/auth";
import type { ZetaRestClientOptions } from "@/modules/integrations/zeta/client/rest-client";
import { loadZetaCacheStatus } from "@/modules/integrations/zeta/cache/report-cache";

export type ZetaHealthMode = "mock" | "real";
export type ZetaHealthCheckResult = {
  ok: boolean;
  status: "connected" | "paused" | "error" | "disconnected";
  code: string;
  message: string;
  checkedAt: string;
  metadata: Record<string, unknown>;
};

export function resolveZetaHealthMode(input: { mockEnabled: boolean; requestedMode?: string | null }) {
  return input.mockEnabled || input.requestedMode === "mock" || process.env.ZETA_INTEGRATION_MOCK === "1"
    ? "mock" satisfies ZetaHealthMode : "real" satisfies ZetaHealthMode;
}

export async function runZetaHealthCheck(input: {
  isConfigured: boolean; isPaused: boolean; mockEnabled: boolean; requestedMode?: string | null;
  baseUrl?: string | null; envProfile?: string | null; credentialOverrides?: ZetaCredentialOverrides;
  runtime?: ZetaRuntimeConfig; fetchImpl?: ZetaRestClientOptions["fetchImpl"];
  supabase?: SupabaseClient; organizationId?: string;
}): Promise<ZetaHealthCheckResult> {
  const checkedAt = new Date().toISOString();
  if (!input.isConfigured) return { ok: false, status: "disconnected", code: "zeta_connection_missing",
    message: "Guarda una conexion Zetasoftware antes de consultar su estado.", checkedAt, metadata: { health_mode: "not_configured" } };
  if (input.isPaused) return { ok: false, status: "paused", code: "zeta_connection_paused",
    message: "La conexion Zetasoftware esta pausada.", checkedAt, metadata: { health_mode: "paused" } };
  if (resolveZetaHealthMode(input) === "mock") return { ok: true, status: "connected", code: "zeta_mock_health_ok",
    message: "Conexion Zetasoftware validada en modo mock.", checkedAt, metadata: { health_mode: "mock", contract_status: "confirmed_pr_01" } };

  const schedule = "La sincronizacion con Zeta esta prevista diariamente a las 18:00 (America/Montevideo), con Convertilabs Local encendido.";
  const metadata = { health_mode: "supabase_cache", api_requests: 0, live_connection_tested: false };
  if (!input.supabase || !input.organizationId) return { ok: false, status: "disconnected", code: "zeta_daily_sync_required",
    message: `Consulta el estado de la copia de Supabase desde Integraciones. ${schedule}`, checkedAt, metadata };
  try {
    const cacheStatus = await loadZetaCacheStatus({ supabase: input.supabase, organizationId: input.organizationId });
    return { ok: Boolean(cacheStatus.lastCompleteRunId), status: cacheStatus.lastCompleteRunId ? "connected" : "disconnected",
      code: cacheStatus.lastCompleteRunId ? "zeta_cache_available" : "zeta_cache_pending",
      message: `${cacheStatus.lastCompleteRunId ? "Copia de Supabase disponible." : "Todavia no hay una copia diaria completa en Supabase."} ${schedule} Esta consulta no prueba credenciales ni llama a Zeta.`,
      checkedAt, metadata: { ...metadata, cache_status: cacheStatus } };
  } catch {
    return { ok: false, status: "error", code: "zeta_cache_unavailable",
      message: `No se pudo leer el estado de la copia de Supabase. ${schedule} No se consulta Zeta como reemplazo.`, checkedAt, metadata };
  }
}
