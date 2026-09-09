"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type DocumentProcessingAutoRefreshProps = {
  active: boolean;
  waitingForLocalWorker?: boolean;
};

export function DocumentProcessingAutoRefresh({
  active,
  waitingForLocalWorker = false,
}: DocumentProcessingAutoRefreshProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    if (!active || waitingForLocalWorker) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 4_000);
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, 120_000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [active, waitingForLocalWorker, router]);

  if (waitingForLocalWorker) {
    return (
      <div className="rounded-2xl border border-blue-300/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
        <p>La factura está guardada y espera al trabajador de una PC encendida. Las revisiones automáticas son cada 4 horas.</p>
        <button
          type="button"
          className="ui-button ui-button--secondary mt-3"
          disabled={isRefreshing}
          onClick={() => startTransition(() => router.refresh())}
        >
          {isRefreshing ? "Actualizando..." : "Actualizar estado"}
        </button>
      </div>
    );
  }

  if (!active) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-blue-300/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
      Estamos leyendo la factura. Esta pantalla se actualiza sola; normalmente demora alrededor de un minuto.
    </div>
  );
}
