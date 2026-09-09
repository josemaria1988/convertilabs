import "server-only";
import { getZetaEndpoint, type ZetaEndpointKey } from "./endpoint-registry";

export class ZetaReadPolicyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ZetaReadPolicyError";
    this.code = code;
  }
}

export type ZetaRequestPolicy = {
  organizationId: string;
  purpose: "daily_sync" | "human_export";
  authorize: (key: ZetaEndpointKey) => Promise<void>;
};

/** The reservation must be persisted before HTTP. An uncertain response still
 * consumes its reservation; retries are never implicit or refunded. */
export function createDailyZetaRequestPolicy(input: {
  organizationId: string;
  reserveRequest: (endpoint: string) => Promise<void>;
  minIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}): ZetaRequestPolicy {
  const interval = input.minIntervalMs ?? 1000;
  if (!input.organizationId || !Number.isSafeInteger(interval) || interval < 1000 || interval > 60000) {
    throw new Error("La politica diaria requiere organizacion e intervalo entre 1000 y 60000 ms.");
  }
  const wait = input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? Date.now;
  let lastRequestAt: number | null = null;
  let queue = Promise.resolve();
  const usedDailyBulkEndpoints = new Set<ZetaEndpointKey>();
  return {
    organizationId: input.organizationId,
    purpose: "daily_sync",
    authorize(key) {
      const authorized = queue.then(async () => {
        const endpoint = getZetaEndpoint(key);
        if (endpoint.kind !== "query" && endpoint.kind !== "load") {
          throw new ZetaReadPolicyError("zeta_daily_write_blocked", "La actualizacion diaria no puede escribir en Zeta.");
        }
        if (key === "salesInvoicesDetailedDaily" || key === "facturaProveedorComprasDetalladas") {
          if (usedDailyBulkEndpoints.has(key)) throw new ZetaReadPolicyError("zeta_daily_bulk_already_used", "Este detalle masivo ya se consulto en la actualizacion diaria.");
          usedDailyBulkEndpoints.add(key);
        }
        if (lastRequestAt !== null) {
          const remaining = interval - (now() - lastRequestAt);
          if (remaining > 0) await wait(remaining);
        }
        await input.reserveRequest(endpoint.endpointName);
        lastRequestAt = now();
      });
      // A failed budget/lease stops this policy permanently, including queued calls.
      queue = authorized;
      return authorized;
    },
  };
}

/** Only the existing reviewed expense export may use these live operations.
 * Reports, health checks and unrelated reads are deliberately absent. */
export function createHumanExportZetaRequestPolicy(organizationId: string): ZetaRequestPolicy {
  if (!organizationId) throw new Error("La exportacion Zeta requiere organizacion.");
  const allowed = new Set<ZetaEndpointKey>([
    "facturaProveedorQueryCompras", "asientoLista", "facturaProveedorAgregar",
  ]);
  return {
    organizationId,
    purpose: "human_export",
    async authorize(key) {
      if (!allowed.has(key)) {
        throw new ZetaReadPolicyError("zeta_export_read_blocked", "El envio revisado solo permite comprobar duplicados, enviar y conciliar ese comprobante.");
      }
    },
  };
}

export async function authorizeZetaRequest(input: {
  organizationId?: string;
  requestPolicy?: ZetaRequestPolicy;
}, key: ZetaEndpointKey) {
  const policy = input.requestPolicy;
  if (!policy || !input.organizationId || policy.organizationId !== input.organizationId) {
    throw new ZetaReadPolicyError(
      "zeta_live_read_disabled",
      "Las consultas usan la copia de Supabase. Zeta solo se consulta durante la actualizacion diaria o el envio humano revisado de un comprobante.",
    );
  }
  await policy.authorize(key);
}
