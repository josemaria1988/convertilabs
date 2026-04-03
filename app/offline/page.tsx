import type { Metadata } from "next";
import { LoadingLink } from "@/components/ui/loading-link";

export const metadata: Metadata = {
  title: "Sin conexion",
};

export default function OfflinePage() {
  return (
    <main className="page-shell">
      <section className="field-offline-card">
        <p className="field-offline-card__eyebrow">Modo offline</p>
        <h1 className="field-offline-card__title">No pudimos cargar Convertilabs en este momento.</h1>
        <p className="field-offline-card__description">
          La app de campo no guarda datos privados ni respuestas sensibles para uso offline.
          Cuando vuelvas a tener conexion, recarga para seguir con la carga y revision.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LoadingLink
            href="/mobile"
            pendingLabel="Reintentando..."
            className="ui-button ui-button--primary min-h-[44px] px-5"
          >
            Reintentar
          </LoadingLink>
          <LoadingLink
            href="/app"
            pendingLabel="Abriendo..."
            className="ui-button ui-button--secondary min-h-[44px] px-5"
          >
            Ir a la web completa
          </LoadingLink>
        </div>
      </section>
    </main>
  );
}
