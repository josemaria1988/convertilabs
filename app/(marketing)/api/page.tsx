import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "API",
};

const integrationCases = [
  {
    title: "ERPs y sistemas internos",
    description:
      "Para mover documentos, asientos o salidas fiscales sin duplicar reglas de negocio.",
  },
  {
    title: "Estudios y operaciones multiempresa",
    description:
      "Para bajar la friccion entre revisiones, cargas y exportaciones hacia herramientas existentes.",
  },
  {
    title: "Plataformas de software",
    description:
      "Para sumar infraestructura contable y fiscal sin convertir el producto principal en un ERP.",
  },
];

export default function ApiPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="API"
        title="Arrancamos dentro del producto, listos para abrir integraciones despues"
        description="La estrategia inicial es pragmatica: endpoints internos en Next para moverse rapido hoy, con una salida clara hacia API publica cuando el dominio y la carga lo justifiquen."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Conversar integracion
            </Link>
            <Link
              href="/product"
              className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ver producto
            </Link>
          </>
        }
        highlights={[
          { label: "Estado actual", value: "Interna" },
          { label: "Expansion", value: "API publica" },
          { label: "Migracion", value: "Sin rehacer la app" },
        ]}
        aside={
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Punto de partida
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                La API acompana al producto desde el primer dia
              </p>
            </div>

            <code className="block rounded-[1.25rem] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white">
              GET /api/health
            </code>

            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Endpoints internos para autenticacion, monitoreo y operaciones del producto.</p>
              <p>Separacion futura cuando haya colas, webhooks o integraciones de mayor carga.</p>
            </div>
          </div>
        }
      />

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Arquitectura"
          title="Una estrategia simple ahora, sin cerrarnos puertas despues"
          description="La decision inicial no es ideologica. Es una forma eficiente de validar producto, permisos, modelos y flujos antes de partir servicios."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Dentro del repo"
            description="Ideal para iterar rapido mientras se definen casos reales, permisos, entidades y criterios de negocio."
          />
          <SectionCard
            title="Separacion futura"
            description="Cuando aparezcan webhooks, procesos pesados o consumidores externos, se extraen servicios por dominio."
          />
        </div>
      </section>

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Casos de integracion"
          title="Pensado para convivir con otros sistemas"
          description="La API futura no solo mira a la interfaz propia. Tambien habilita integraciones con herramientas de gestion, estudios y productos de terceros."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {integrationCases.map((item) => (
            <SectionCard
              key={item.title}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </section>

      <MarketingCtaBanner
        eyebrow="Integraciones"
        title="Si ya tienes un sistema y necesitas sumar logica contable o fiscal, conversemos."
        description="Podemos revisar si conviene empezar con exportaciones, endpoints internos o una futura API publica segun tu caso."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
            >
              Solicitar reunion
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Consulta%20API%20Convertilabs`}
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
            >
              Escribir por email
            </a>
          </>
        }
      />
    </div>
  );
}
