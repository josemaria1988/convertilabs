import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

const operatingPillars = [
  {
    title: "Documentos en flujo continuo",
    description:
      "Captura, clasificacion y aprobacion desde un mismo pipeline para facturas, recibos y soporte fiscal.",
  },
  {
    title: "Contabilidad preparada para automatizar",
    description:
      "Asientos, reglas y conciliaciones disenadas para escalar antes de partir a microservicios.",
  },
  {
    title: "Capa fiscal conectada",
    description:
      "Calendarios, vencimientos y validaciones sobre los mismos datos operativos del backoffice.",
  },
];

const modulePlan = [
  "auth",
  "organizations",
  "documents",
  "accounting",
  "tax",
  "ai",
];

export default function HomePage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Finance operating system"
        title="Operaciones financieras, documentos y fiscalidad en un solo repo."
        description="Convertilabs arranca como una aplicacion web monolitica en Next.js para moverse rapido. El objetivo es simple: organizar captura documental, contabilidad y tax sin dispersar la logica desde el dia uno."
        actions={
          <>
            <Link
              href="/product"
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white"
            >
              Ver producto
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-[color:var(--color-border)] px-5 py-3 text-sm font-semibold"
            >
              Ver pricing
            </Link>
          </>
        }
        aside={
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Stack inicial
            </p>
            <ul className="space-y-3 text-sm leading-6 text-[color:var(--color-muted)]">
              <li>Next.js + TypeScript + Tailwind</li>
              <li>Supabase o Neon para arrancar rapido</li>
              <li>Vercel para despliegue del front</li>
              <li>API embebida en el repo al principio</li>
            </ul>
            <div className="rounded-2xl bg-[color:var(--color-accent-soft)] p-4">
              <p className="text-sm font-medium text-[color:var(--color-accent-strong)]">
                La estructura ya separa dominios de negocio para que la salida a
                servicios independientes no duela mas adelante.
              </p>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {operatingPillars.map((pillar) => (
          <SectionCard
            key={pillar.title}
            title={pillar.title}
            description={pillar.description}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <SectionCard
          title="Lo que queda listo desde hoy"
          description="El repo ya nace con rutas de marketing, rutas privadas, componentes reutilizables, estilos globales y documentacion inicial."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
              <p className="metric-value font-semibold">7</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                rutas de producto para marketing y app
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4">
              <p className="metric-value font-semibold">6</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                modulos de dominio aislados desde la base
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Modulos"
          description="Cada carpeta dentro de `modules/` representa una frontera clara de negocio."
        >
          <div className="flex flex-wrap gap-2">
            {modulePlan.map((moduleName) => (
              <span
                key={moduleName}
                className="rounded-full border border-[color:var(--color-border)] bg-white/70 px-3 py-2 text-sm"
              >
                {moduleName}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
