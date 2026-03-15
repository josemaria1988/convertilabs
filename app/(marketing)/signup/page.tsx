import type { Metadata } from "next";
import { AuthSignupForm } from "@/components/auth-signup-form";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { LoadingLink } from "@/components/ui/loading-link";
import { redirectAuthenticatedUserFromPublicAuthPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

const featureList = [
  "Alta publica sobre Supabase Auth con confirmacion SSR.",
  "Mirror minimo en `public.profiles` para la capa de aplicacion.",
  "Redireccion a onboarding o dashboard segun memberships activas.",
];

export default async function SignupPage() {
  await redirectAuthenticatedUserFromPublicAuthPage();

  return (
    <div className="auth-stage">
      <div className="auth-grid">
        <section className="panel auth-card px-6 py-7 md:px-8 md:py-8">
          <div className="relative z-10 flex h-full flex-col">
            <ConvertilabsLogo subtitle="Alta de usuarios" />

            <div className="mt-12 max-w-md">
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                Crear cuenta
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-white md:text-5xl">
                Activa tu acceso inicial al cockpit privado.
              </h1>
              <p className="mt-5 text-sm leading-7 text-[color:var(--color-muted)] md:text-base">
                Crea tu usuario, confirma tu email si corresponde y entra al flujo de onboarding organizacional con el perfil fiscal base de Uruguay.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {featureList.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.15rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.72)] px-4 py-4 text-sm leading-6 text-[color:var(--color-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-auto pt-10">
              <LoadingLink
                href="/login"
                pendingLabel="Abriendo..."
                className="inline-flex rounded-[0.95rem] border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm font-medium text-[color:var(--color-muted)] transition hover:border-[rgba(124,157,255,0.22)] hover:text-white"
              >
                Ya tengo cuenta
              </LoadingLink>
            </div>
          </div>
        </section>

        <section className="panel px-6 py-7 md:px-8 md:py-8">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Registro
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.06em] text-white">
              Crear acceso de usuario
            </h2>
            <p className="max-w-xl text-sm leading-7 text-[color:var(--color-muted)]">
              El endpoint de signup valida en cliente y servidor, responde de forma controlada y deja el siguiente paso listo para confirmacion o redireccion autentificada.
            </p>
          </div>

          <div className="mt-8 rounded-[1.3rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.64)] p-5 md:p-6">
            <AuthSignupForm />
          </div>
        </section>
      </div>
    </div>
  );
}
