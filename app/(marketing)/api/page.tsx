import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

export const metadata: Metadata = {
  title: "API",
};

export default function ApiPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="API strategy"
        title="Al principio la API convive dentro del repo."
        description="La estrategia inicial es pragmatica: route handlers en Next para autenticacion, health checks y endpoints internos. Si la carga o el dominio lo piden, la API se separa mas adelante sin rehacer el frontend."
        aside={
          <div className="space-y-3">
            <p className="text-sm font-semibold">Endpoint inicial</p>
            <code className="block rounded-2xl bg-[color:var(--color-foreground)] px-4 py-3 text-sm text-white">
              GET /api/health
            </code>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Dentro del repo"
          description="Ideal para mover rapido mientras se valida producto, permisos, modelos y workflows."
        />
        <SectionCard
          title="Separacion futura"
          description="Cuando haya procesos pesados, colas, webhooks o integraciones de terceros, se extraen servicios por dominio."
        />
      </div>
    </div>
  );
}
