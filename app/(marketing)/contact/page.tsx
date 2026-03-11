import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contacto",
};

const nextSteps = [
  "Compartes contexto del flujo actual y los cuellos de botella.",
  "Revisamos documentos, contabilidad, IVA e integraciones prioritarias.",
  "Definimos si conviene un piloto, una prueba controlada o una propuesta mas amplia.",
];

export default function ContactPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Contacto"
        title="Conversemos sobre pilotos, integraciones y casos reales de operacion"
        description="Si estas evaluando documentos, contabilidad o impuestos para Uruguay, lo mejor es partir de un caso concreto. Desde ahi se ordena alcance, prioridad y forma de implementacion."
        actions={
          <>
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Escribir por email
            </a>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Lista%20de%20espera%20Convertilabs`}
              className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Lista de espera
            </a>
          </>
        }
        highlights={[
          { label: "Canal principal", value: "Email" },
          { label: "Cobertura", value: "Uruguay" },
          { label: "Formato", value: "Pilotos y demos" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Respuesta ideal
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Cuanto mas contexto compartas, mejor podemos orientar la conversacion.</p>
              <p>Especialmente util: volumen documental, impuestos involucrados e integraciones necesarias.</p>
            </div>
          </div>
        }
      />

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Canales"
          title="Tres formas simples de iniciar la conversacion"
          description="No hace falta tener todo resuelto. Alcanza con saber donde hoy se traba la operacion y que resultado quieres mejorar primero."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard
            title="Email"
            description="Canal mas directo para demos, integraciones o consultas sobre alcance."
          >
            <p className="text-lg font-semibold">{siteConfig.contactEmail}</p>
          </SectionCard>
          <SectionCard
            title="Pilotos y diagnostico"
            description="Ideal para bajar el problema real antes de hablar de hoja de ruta, precios o integraciones."
          >
            <p className="text-lg font-semibold">Reunion corta, contexto completo</p>
          </SectionCard>
          <SectionCard
            title="Base operativa"
            description="Producto pensado para desplegar en Vercel y operar con equipos distribuidos."
          >
            <p className="text-lg font-semibold">{siteConfig.location}</p>
          </SectionCard>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.72fr_minmax(0,1fr)]">
        <SectionCard
          title="Proximo paso"
          description="Lo mas util en un primer contacto es revisar un flujo real y ordenar prioridades."
        />

        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <div className="space-y-4">
            {nextSteps.map((item, index) => (
              <div
                key={item}
                className="rounded-[1.4rem] border border-[color:var(--color-border)] bg-white/72 p-4"
              >
                <p className="font-mono text-sm text-[color:var(--color-muted)]">
                  0{index + 1}
                </p>
                <p className="mt-3 text-sm leading-7">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingCtaBanner
        eyebrow="Accion"
        title="Si prefieres empezar por email, respondemos desde un caso concreto."
        description="Comparte el tipo de empresa, el volumen aproximado, los impuestos involucrados y cualquier integracion que ya exista."
        actions={
          <>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Consulta%20Convertilabs`}
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
            >
              Escribir ahora
            </a>
            <Link
              href="/pricing"
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
            >
              Ver precios
            </Link>
          </>
        }
      />
    </div>
  );
}
