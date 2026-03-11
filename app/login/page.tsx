import type { Metadata } from "next";
import Link from "next/link";
import { AuthLoginForm } from "@/components/auth-login-form";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import {
  normalizeNextPath,
  redirectAuthenticatedUserFromPublicAuthPage,
} from "@/modules/auth/server-auth";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ingreso",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    auth_message?: string | string[];
  }>;
};

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAuthNotice(authMessage: string | null) {
  switch (authMessage) {
    case "signed_out":
      return {
        tone: "success" as const,
        message: "La sesion se cerro correctamente.",
      };
    case "invalid_confirmation_link":
      return {
        tone: "error" as const,
        message:
          "El enlace de confirmacion es invalido o ya expiro. Inicia sesion o solicita un nuevo correo.",
      };
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = normalizeNextPath(readSearchParam(params.next));
  await redirectAuthenticatedUserFromPublicAuthPage(nextPath);
  const notice = getAuthNotice(readSearchParam(params.auth_message) ?? null);

  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Ingreso"
        title="Entrar al espacio privado de Convertilabs"
        description="El login ahora usa Supabase SSR con cookies de sesion, refresh via middleware y redireccion limpia hacia el espacio autenticado."
        highlights={[
          { label: "Acceso", value: "Privado" },
          { label: "Sesion", value: "SSR + cookies" },
          { label: "Confirmacion", value: "/auth/confirm" },
        ]}
        aside={
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">
              Que encontraras adentro
            </p>
            <div className="space-y-3 text-sm leading-7 text-white/72">
              <p>Revision documental, seguimiento de asientos y control fiscal desde una misma operacion.</p>
              <p>El ingreso ya persiste la sesion en cookies SSR y protege las rutas privadas sin depender de estado cliente suelto.</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.78fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Acceso"
            title="Un ingreso simple, alineado con el resto del producto"
            description="La autenticacion ya corre sobre Supabase SSR y deja listo el salto a onboarding o al dashboard privado de la organizacion segun el estado organizacional del usuario."
          />

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Documentos y aprobaciones</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                Ingreso, validacion y seguimiento desde un mismo flujo.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
              <p className="text-sm font-semibold">Confirmacion SSR</p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                Los enlaces de email confirman la cuenta en `/auth/confirm`, canjean el `token_hash` y aterrizan con sesion valida.
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
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              Si tu usuario todavia no tiene memberships activas, esta sesion te llevara al onboarding.
            </p>
          </div>

          {notice ? (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                notice.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              {notice.message}
            </div>
          ) : null}

          <AuthLoginForm nextPath={nextPath} />

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
        description="Si quieres ver el producto por dentro, crea tu cuenta ahora o escribe a nuestro equipo para preparar un acceso asistido."
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
