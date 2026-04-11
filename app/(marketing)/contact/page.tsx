import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Acceso por invitación",
};

const emailHref = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent("Acceso por invitación Convertilabs")}`;

const nextSteps = [
  "Nos cuentas tu operación, el volumen documental y dónde hoy se acumula trabajo manual.",
  "Te decimos con honestidad si Convertilabs ya encaja para tu equipo en desktop, móvil o ambos carriles.",
  "Si tiene sentido, te habilitamos acceso por invitación para probarlo sin costo.",
];

const usefulContext = [
  "Qué tipo de empresa o estudio eres.",
  "Si el mayor dolor está en documentos, IVA, auditoría o cierre mensual.",
  "Si tu equipo trabaja fijo en escritorio, en calle o mezclando ambos carriles.",
];

export default function ContactPage() {
  return (
    <div className="page-shell space-y-8">
      <PageHero
        eyebrow="Acceso por invitación"
        title="Conversemos primero y, si encaja, te damos acceso para probarlo sin costo"
        description="Convertilabs no se está comercializando como producto abierto. Nació como una capa de inteligencia y captura operativa para convivir con sistemas contables legacy, y hoy se comparte por invitación con equipos que quieren evaluar si encaja en su flujo real."
        actions={
          <div className="flex max-w-sm flex-col items-start gap-3">
            <div className="flex flex-wrap gap-3">
              <a
                href={emailHref}
                className="rounded-[8px] bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
              >
                Solicitar acceso
              </a>
              <Link
                href="/"
                className="rounded-[8px] border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver inicio
              </Link>
            </div>
            <p className="text-sm leading-6 text-white/52">
              Priorizamos el contacto directo para asegurar que la herramienta se
              adapte a tu flujo de trabajo.
            </p>
          </div>
        }
        highlights={[
          { label: "Acceso", value: "Solo por invitación" },
          { label: "Costo", value: "Prueba sin costo" },
          { label: "Cobertura", value: "Uruguay" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Punto de partida
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Nació dentro de una empresa de importaciones y servicios técnicos.</p>
              <p>
                Por eso la conversación siempre parte del flujo real, no de una
                demo vacía.
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SectionCard
          title="Email directo"
          description="Si quieres evaluar acceso por invitación, este es el canal principal."
        >
          <p className="text-lg font-semibold">{siteConfig.contactEmail}</p>
        </SectionCard>
        <SectionCard
          title="Estado actual"
          description="Hoy funciona en beta privada y no tiene comercialización abierta."
        >
          <p className="text-lg font-semibold">Acceso selectivo y sin costo</p>
        </SectionCard>
        <SectionCard
          title="Formato"
          description="Primero revisamos tu caso. Si encaja, abrimos una prueba guiada sobre tu flujo real."
        >
          <p className="text-lg font-semibold">Diagnóstico corto + invitación</p>
        </SectionCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_minmax(0,1fr)]">
        <SectionCard
          title="Cómo avanza"
          description="Buscamos ver rápido si el producto ya te sirve en documentos, IVA, auditoría o captura de campo."
        />

        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <div className="space-y-4">
            {nextSteps.map((item, index) => (
              <div
                key={item}
                className="rounded-[8px] border border-[color:var(--color-border)] bg-[rgba(15,22,29,0.74)] p-4"
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Lo más útil para escribirnos
          </p>
          <div className="mt-6 space-y-3">
            {usefulContext.map((item) => (
              <div
                key={item}
                className="rounded-[8px] border border-[color:var(--color-border)] bg-[rgba(15,22,29,0.74)] px-4 py-4 text-sm leading-6"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Qué te vamos a responder
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-[color:var(--color-muted)]">
            <p>
              Si ya cubrimos tu caso hoy en el carril desktop, en la app móvil de
              campo o en ambos.
            </p>
            <p>
              Qué nivel de automatización puedes esperar realmente y dónde sigue
              siendo importante la revisión humana.
            </p>
            <p>
              Si conviene darte acceso para probarlo ahora o si todavía no es el
              momento correcto.
            </p>
          </div>
        </div>
      </section>

      <MarketingCtaBanner
        eyebrow="Invitación"
        title="Si quieres probarlo, escríbenos y vemos si tiene sentido habilitarte acceso"
        description="No hay pricing público ni alta abierta. Hoy compartimos Convertilabs por invitación con equipos que quieran evaluar esta capa de inteligencia y captura operativa sobre una operación real y sin costo."
        actions={
          <div className="flex max-w-sm flex-col items-start gap-3">
            <div className="flex flex-wrap gap-3">
              <a
                href={emailHref}
                className="rounded-[8px] bg-[#ff9b4a] px-5 py-3 text-sm font-semibold text-[#1d1208] transition hover:brightness-105"
              >
                Solicitar acceso
              </a>
              <Link
                href="/login"
                className="rounded-[8px] border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ya tengo invitación
              </Link>
            </div>
            <p className="text-sm leading-6 text-white/52">
              Priorizamos el contacto directo para asegurar que la herramienta se
              adapte a tu flujo de trabajo.
            </p>
          </div>
        }
      />
    </div>
  );
}
