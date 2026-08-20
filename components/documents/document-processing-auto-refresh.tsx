"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type DocumentProcessingAutoRefreshProps = {
  active: boolean;
};

export function DocumentProcessingAutoRefresh({
  active,
}: DocumentProcessingAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
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
  }, [active, router]);

  if (!active) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-blue-300/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
      Estamos leyendo la factura. Esta pantalla se actualiza sola; normalmente demora alrededor de un minuto.
    </div>
  );
}
