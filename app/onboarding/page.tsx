import type { Metadata } from "next";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { OrganizationOnboardingForm } from "@/components/organization-onboarding-form";
import { requireOnboardingPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Onboarding",
};

const onboardingChecks = [
  "Crear tenant con slug unico y membership owner.",
  "Capturar forma juridica, RUT y perfil fiscal base.",
  "Materializar snapshot inicial para intake y IVA.",
  "Entrar directo al cockpit privado de la organizacion.",
];

export default async function OnboardingPage() {
  const { user } = await requireOnboardingPage();

  return (
    <div className="auth-stage">
      <div className="auth-grid">
        <section className="panel auth-card px-6 py-7 md:px-8 md:py-8">
          <div className="relative z-10 flex h-full flex-col">
            <ConvertilabsLogo subtitle="Onboarding organizacional" />

            <div className="mt-12 max-w-md">
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                Tenant inicial
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-white md:text-5xl">
                Crea la primera organizacion del workspace.
              </h1>
              <p className="mt-5 text-sm leading-7 text-[color:var(--color-muted)] md:text-base">
                {user?.email
                  ? `Tu sesion ya esta lista como ${user.email}.`
                  : "Tu sesion ya esta lista."}{" "}
                El siguiente paso es abrir el contexto multi-tenant real que usara documentos, asientos, IVA y snapshots.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {onboardingChecks.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.15rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.72)] px-4 py-4 text-sm leading-6 text-[color:var(--color-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-auto rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6">
              Los documentos ya existentes no se recalculan al cambiar el perfil despues. Cada version futura queda congelada con su snapshot correspondiente.
            </div>
          </div>
        </section>

        <section className="panel px-6 py-7 md:px-8 md:py-8">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Configuracion inicial
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.06em] text-white">
              Alta del tenant y perfil fiscal base
            </h2>
            <p className="max-w-xl text-sm leading-7 text-[color:var(--color-muted)]">
              La operacion corre en servidor mediante una transaccion controlada: crea la organizacion, asigna ownership y deja listo el perfil inicial para Uruguay.
            </p>
          </div>

          <div className="mt-8 rounded-[1.3rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.64)] p-5 md:p-6">
            <OrganizationOnboardingForm userEmail={user?.email} />
          </div>

          <form action="/logout" method="post" className="mt-6">
            <button
              type="submit"
              className="inline-flex rounded-[0.95rem] border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm font-medium text-[color:var(--color-muted)] transition hover:border-[rgba(124,157,255,0.22)] hover:text-white"
            >
              Cerrar sesion
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
