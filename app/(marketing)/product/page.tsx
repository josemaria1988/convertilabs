import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Producto",
};

const productAreas = [
  {
    title: "Documentos",
    description:
      "Ingreso multicanal, extraccion asistida y aprobaciones con trazabilidad operativa.",
  },
  {
    title: "Contabilidad",
    description:
      "Reglas de contabilizacion, asientos y cierres preparados para trabajar por organizacion.",
  },
  {
    title: "Impuestos",
    description:
      "Vencimientos, validaciones y criterios fiscales sin sacar datos del flujo principal.",
  },
  {
    title: "Automatizacion",
    description:
      "Clasificacion documental, sugerencias y soporte contextual para acelerar revision y carga.",
  },
  {
    title: "Autenticacion y acceso",
    description:
      "Ingreso, sesiones y permisos para operar con distintos roles sin mezclar responsabilidades.",
  },
  {
    title: "Organizaciones",
    description:
      "Tenancy, configuracion por empresa y reglas compartidas entre clientes, equipos o unidades.",
  },
];

const workflow = [
  "Ingreso y validacion documental",
  "Sugerencia de asientos y reglas",
  "Tratamiento de IVA y criterios fiscales",
  "Exportacion o integracion con terceros",
];

export default function ProductPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Producto"
        title="Una base unica para documentos, contabilidad e impuestos"
        description="El producto se organiza por modulos claros para que la operacion diaria y la evolucion tecnica crezcan sin mezclar interfaz, negocio y reglas fiscales."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Solicitar demo
            </Link>
            <Link
              href="/api"
              className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ver estrategia API
            </Link>
          </>
        }
        highlights={[
          { label: "Modulos base", value: "6" },
          { label: "Flujo central", value: "1 solo sistema" },
          { label: "Cobertura inicial", value: "Uruguay" },
        ]}
        aside={
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Capas del producto
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                Modulos conectados, no pantallas aisladas
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {["auth", "organizations", "documents", "accounting", "tax", "ai"].map(
                (moduleName) => (
                  <div
                    key={moduleName}
                    className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white/82"
                  >
                    {moduleName}
                  </div>
                ),
              )}
            </div>
          </div>
        }
      />

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Estructura"
          title="Cada modulo resuelve una parte critica del problema"
          description="La interfaz es solo la capa visible. Debajo hay fronteras de dominio para documentos, contabilidad, impuestos, acceso y organizacion."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productAreas.map((area) => (
            <SectionCard
              key={area.title}
              title={area.title}
              description={area.description}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.78fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Flujo"
            title="Una operacion encadenada de punta a punta"
            description="La idea es que documentos, asientos e impuestos no vivan en silos. Todo parte de la misma fuente y desemboca en una salida estructurada."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {workflow.map((step, index) => (
            <article key={step} className="panel p-6">
              <p className="font-mono text-sm text-[color:var(--color-muted)]">
                0{index + 1}
              </p>
              <p className="mt-4 text-xl font-semibold tracking-[-0.05em]">{step}</p>
            </article>
          ))}
        </div>
      </section>

      <MarketingCtaBanner
        eyebrow="Proxima conversacion"
        title="Si quieres validar alcance funcional, lo mejor es revisar un caso real."
        description="Podemos bajar el producto a tu operacion actual, ver modulos prioritarios y definir si conviene empezar por documentos, contabilidad o impuestos."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
            >
              Hablar con nosotros
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Consulta%20de%20producto`}
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
