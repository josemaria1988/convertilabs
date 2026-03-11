import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Precios",
};

const tiers = [
  {
    title: "Base piloto",
    description:
      "Para equipos que quieren ordenar documentos, validar el flujo y montar una operacion inicial.",
    price: "USD 299 / mes",
  },
  {
    title: "Operacion",
    description:
      "Incluye asientos, permisos por organizacion y una capa fiscal mas completa sobre el nucleo contable.",
    price: "USD 899 / mes",
  },
  {
    title: "Plataforma",
    description:
      "Integraciones, reglas avanzadas, automatizacion y alcance adaptado al flujo real del cliente.",
    price: "A medida",
  },
];

const scopeFactors = [
  {
    title: "Volumen documental",
    description:
      "Cantidad de documentos, densidad de validaciones y necesidad de OCR o clasificacion asistida.",
  },
  {
    title: "Cobertura fiscal",
    description:
      "Si el alcance queda en IVA o avanza hacia IRAE, Patrimonio, nomina y BPS.",
  },
  {
    title: "Integraciones",
    description:
      "Nivel de exportacion, APIs, conexiones con ERPs y requerimientos operativos del cliente.",
  },
];

export default function PricingPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Precios"
        title="Precios iniciales para pilotos, despliegues tempranos y casos a medida"
        description="Los planes marcan una referencia comercial temprana. El alcance final depende del volumen documental, la cobertura fiscal y el nivel de integracion requerido."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Pedir propuesta
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Consulta%20de%20precios`}
              className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Hablar por email
            </a>
          </>
        }
        highlights={[
          { label: "Entrada", value: "Pilotos" },
          { label: "Escala", value: "Operacion" },
          { label: "Ajuste", value: "A medida" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Como pensamos el alcance
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>No buscamos vender un paquete cerrado que no responda al flujo real.</p>
              <p>La mejor forma de cotizar es entender documentos, impuestos y puntos de integracion.</p>
            </div>
          </div>
        }
      />

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Planes"
          title="Tres niveles para arrancar sin perder flexibilidad"
          description="Puedes tomar esto como una base comercial. El producto todavia esta madurando y el encaje final se ajusta por caso."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <SectionCard
              key={tier.title}
              title={tier.title}
              description={tier.description}
            >
              <p className="text-3xl font-semibold tracking-[-0.05em]">{tier.price}</p>
            </SectionCard>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Variables"
          title="Lo que mas cambia el precio no es la interfaz, sino la complejidad operativa"
          description="El costo real aparece en el detalle del proceso: cantidad de documentos, reglas, cierres, impuestos y sistemas que tienen que convivir."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {scopeFactors.map((factor) => (
            <SectionCard
              key={factor.title}
              title={factor.title}
              description={factor.description}
            />
          ))}
        </div>
      </section>

      <MarketingCtaBanner
        eyebrow="Propuesta"
        title="Si tienes un caso concreto, lo mejor es bajar alcance y prioridades."
        description="En una llamada corta podemos definir si encaja mejor un piloto, una operacion continua o una implementacion mas cercana a plataforma."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
            >
              Solicitar propuesta
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Propuesta%20Convertilabs`}
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
            >
              Enviar contexto
            </a>
          </>
        }
      />
    </div>
  );
}
