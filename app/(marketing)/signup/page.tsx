import type { Metadata } from "next";
import Link from "next/link";
import { AuthSignupForm } from "@/components/auth-signup-form";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { redirectAuthenticatedUserFromPublicAuthPage } from "@/modules/auth/server-auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default async function SignupPage() {
  await redirectAuthenticatedUserFromPublicAuthPage();

  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Alta"
        title="Crea tu cuenta y conecta tu acceso a Supabase"
        description="El alta ya crea usuarios reales en Supabase Auth y deja lista la confirmacion por email hacia un flujo SSR con cookies de sesion."
        highlights={[
          { label: "Backend", value: "/api/v1/auth/signup" },
          { label: "Proveedor", value: "Supabase Auth" },
          { label: "Control", value: "SSR + validacion server-side" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Que hace este flujo
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Crea el usuario en Supabase sin exponer claves de servidor en el cliente.</p>
              <p>Guarda nombre y avatar como metadata para espejarlos en `public.profiles` via trigger minimo.</p>
              <p>Devuelve mensajes genericos para no ampliar la superficie de enumeracion y redirige si la cuenta queda autenticada al instante.</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.78fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Identidad"
            title="Alta publica con criterio de producto y seguridad"
            description="La documentacion ya definia Supabase Auth como base de sesion para la app web. El flujo ahora queda conectado con confirmacion SSR, `profiles` y redirects post-auth."
          />

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Validacion consistente</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                El cliente y el backend comparten la misma politica minima de nombre, email y contrasena.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Respuesta controlada</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                El endpoint responde con un contrato JSON estable y evita confirmar si un email ya estaba registrado.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Mirror de `profiles`</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                `auth.users` se refleja en `public.profiles` con trigger minimo, RLS y backfill para usuarios ya existentes.
              </p>
            </div>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <div className="mb-8 space-y-2">
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Crear cuenta
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em]">
              Alta inicial de usuario
            </h2>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              Si el proyecto exige confirmacion por email, veras el estado de espera y el enlace aterrizara en `/auth/confirm`. Si no, entraras directo al onboarding o al dashboard privado de tu organizacion.
            </p>
          </div>

          <AuthSignupForm />

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-4 py-2 font-medium"
            >
              Ir a ingreso
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-4 py-2 font-medium"
            >
              Hablar con el equipo
            </Link>
          </div>
        </div>
      </section>

      <SectionCard
        title="Necesitas alta asistida?"
        description="Si prefieres que el equipo prepare el acceso inicial o el entorno organizacional, puedes solicitarlo por correo."
      >
        <a
          href={`mailto:${siteConfig.contactEmail}?subject=Alta%20de%20usuario%20Convertilabs`}
          className="inline-flex rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
        >
          Solicitar alta asistida
        </a>
      </SectionCard>
    </div>
  );
}
