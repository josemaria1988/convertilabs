import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { loadZetaCacheStatus } from "@/modules/integrations/zeta/cache/report-cache";

export async function ZetaSoftwareDailyCacheStatus({ organizationId }: { organizationId: string }) {
  const cache = await loadZetaCacheStatus({ supabase: getSupabaseServiceRoleClient(), organizationId }).catch(() => null);
  const lastUpdate = cache?.dataAsOf ? new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Montevideo",
  }).format(new Date(cache.dataAsOf)) : null;
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm text-[color:var(--color-muted)]">
      <p>Los reportes se consultan en la copia de Supabase. La actualización diaria está prevista a las 18:00, hora de Montevideo, con Convertilabs Local encendido.</p>
      <p className="mt-2">{!cache ? "No se pudo leer el estado de la copia."
        : lastUpdate ? `Última copia completa: ${lastUpdate}.` : "Todavía no hay una copia diaria completa."}</p>
      {cache?.reports.some((report) => report.stale) ? <p className="mt-2">Hay datos con más de 24 horas; revisá la fecha antes de usarlos.</p> : null}
      <p className="mt-2">Esta pantalla no consulta Zeta ni verifica credenciales.</p>
    </div>
  );
}
