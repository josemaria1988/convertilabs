import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ingreso",
};

export default function LoginPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Ingreso"
        title="Entrar al espacio privado de Convertilabs"
        description="La pantalla de acceso mantiene el mismo lenguaje visual del sitio publico, pero sigue siendo una interfaz simple hasta integrar autenticacion real."
        highlights={[
          { label: "Acceso", value: "Privado" },
          { label: "Base actual", value: "Maqueta" },
          { label: "Siguiente paso", value: "Autenticacion real" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Que encontraras adentro
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Revision documental, seguimiento de asientos y control fiscal desde una misma operacion.</p>
              <p>Cuando se conecte autenticacion real, esta entrada podra salir con Supabase o el proveedor que corresponda.</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.78fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Acceso"
            title="Un ingreso simple, alineado con el resto del producto"
            description="No estamos implementando autenticacion real todavia. El objetivo de esta pantalla es sostener una experiencia publica consistente mientras madura la base tecnica."
          />

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Documentos y aprobaciones</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                Ingreso, validacion y seguimiento desde un mismo flujo.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Contabilidad e impuestos</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                Asientos, IVA y control tributario sobre la misma base de datos operativa.
              </p>
            </div>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <div className="mb-8 space-y-2">
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Interfaz de acceso
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em]">
              Ingresa con tu cuenta
            </h2>
          </div>

          <form className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                placeholder="equipo@convertilabs.com"
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Contrasena</span>
              <input
                type="password"
                placeholder="........"
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
              />
            </label>

            <button
              type="button"
              className="w-full rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-medium text-white"
            >
              Ingresar
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/contact"
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-4 py-2 font-medium"
            >
              Solicitar acceso
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-4 py-2 font-medium"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>

      <SectionCard
        title="Todavia no tienes acceso?"
        description="Si quieres ver el producto por dentro, escribe a nuestro equipo y cuentanos tu caso. La mejor demo siempre parte de una operacion real."
      >
        <a
          href={`mailto:${siteConfig.contactEmail}?subject=Solicitud%20de%20acceso`}
          className="inline-flex rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
        >
          Pedir acceso por email
        </a>
      </SectionCard>
    </div>
  );
}
