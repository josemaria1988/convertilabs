import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Nosotros",
};

const principles = [
  {
    title: "Menos capas al comienzo",
    description:
      "Preferimos una base clara y operable antes que una arquitectura grandilocuente que frene el aprendizaje.",
  },
  {
    title: "Dominios antes que paginas",
    description:
      "Documentos, contabilidad e impuestos se modelan como fronteras de negocio, no como vistas sueltas.",
  },
  {
    title: "Uruguay como prioridad",
    description:
      "La propuesta nace desde la realidad normativa y operativa local, no desde un producto generico adaptado despues.",
  },
];

const posture = [
  {
    title: "Lo que queremos evitar",
    description:
      "Flujos partidos entre planillas, correos, ERPs y revisiones manuales que nunca consolidan una fuente de verdad.",
  },
  {
    title: "Lo que buscamos construir",
    description:
      "Una capa operativa que ordene documentos, asientos y criterio fiscal sin obligar a rehacer la operacion cada ano.",
  },
];

export default function AboutPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Nosotros"
        title="Convertilabs nace para ordenar la operacion contable y fiscal con menos friccion"
        description="La tesis es simple: documentos, contabilidad e impuestos comparten demasiados datos como para vivir en silos desde el inicio. El producto se disena desde esa convergencia."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Hablar con nosotros
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
          { label: "Foco", value: "Uruguay" },
          { label: "Prioridad", value: "Operacion real" },
          { label: "Base tecnica", value: "Modular" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Punto de vista
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>El problema no es solo cargar mejor documentos.</p>
              <p>El problema es conectar criterio contable, tratamiento fiscal y salida operativa en un mismo sistema.</p>
            </div>
          </div>
        }
      />

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Principios"
          title="Construido con pragmatismo, orden de dominio y una lectura local del problema"
          description="La apuesta es avanzar rapido sin sacrificar estructura. Por eso priorizamos una base modular, decisiones simples al inicio y foco en Uruguay."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {principles.map((item) => (
            <SectionCard
              key={item.title}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {posture.map((item) => (
          <SectionCard
            key={item.title}
            title={item.title}
            description={item.description}
          />
        ))}
      </section>

      <MarketingCtaBanner
        eyebrow="Contacto"
        title="Si compartes este problema, vale la pena revisar el flujo completo."
        description="Podemos conversar sobre operacion interna, casos de estudio, integraciones o cobertura fiscal prioritaria."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
            >
              Coordinar una llamada
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Conversemos%20sobre%20Convertilabs`}
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
            >
              Enviar email
            </a>
          </>
        }
      />
    </div>
  );
}
