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
        description="El alta de usuario ya se conecta con Supabase Auth. El siguiente paso es completar el flujo real de ingreso y sesion sobre esta misma base."
        highlights={[
          { label: "Acceso", value: "Privado" },
          { label: "Alta", value: "Activa" },
          { label: "Siguiente paso", value: "Sesion real" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Que encontraras adentro
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Revision documental, seguimiento de asientos y control fiscal desde una misma operacion.</p>
              <p>La creacion de cuentas ya corre sobre Supabase. El ingreso interactivo todavia no esta habilitado en esta pantalla.</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.78fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Acceso"
            title="Un ingreso simple, alineado con el resto del producto"
            description="La autenticacion ya empezo a integrarse por el alta de usuario. Esta pantalla conserva el lugar del login mientras cerramos el manejo real de sesion."
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
              disabled
              className="w-full rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-medium text-white opacity-70"
            >
              Ingreso disponible pronto
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/signup"
              className="rounded-full bg-[color:var(--color-accent)] px-4 py-2 font-medium text-white"
            >
              Crear cuenta
            </Link>
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
        description="Si quieres ver el producto por dentro, puedes crear tu cuenta ahora o escribir a nuestro equipo para preparar un acceso asistido."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
          >
            Crear cuenta
          </Link>
          <a
            href={`mailto:${siteConfig.contactEmail}?subject=Solicitud%20de%20acceso`}
            className="inline-flex rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
          >
            Pedir acceso por email
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
