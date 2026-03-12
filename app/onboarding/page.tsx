import type { Metadata } from "next";
import { OrganizationOnboardingForm } from "@/components/organization-onboarding-form";
import { SectionCard } from "@/components/section-card";
import { requireOnboardingPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Onboarding",
};

const onboardingChecks = [
  "Crear tenant con slug unico",
  "Asignar membership owner",
  "Capturar forma juridica, RUT y regimen fiscal base",
  "Entrar al dashboard privado de la org",
];

export default async function OnboardingPage() {
  const { user } = await requireOnboardingPage();

  return (
    <div className="page-shell space-y-6 py-10">
      <section className="panel px-6 py-8 md:px-8">
        <div className="space-y-3">
          <span className="eyebrow">Onboarding</span>
          <h1 className="text-4xl font-semibold tracking-[-0.06em]">
            Crea tu organizacion inicial
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
            {user?.email
              ? `Tu sesion ya esta lista como ${user.email}.`
              : "Tu sesion ya esta lista."}{" "}
            El siguiente paso es abrir el primer contexto multi-tenant real:
            crear la organizacion, asignarte ownership y llevarte al dashboard
            privado de esa org.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-6 md:p-8">
          <div className="mb-8 space-y-2">
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Organizacion
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em]">
              Alta inicial del tenant
            </h2>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              La creacion se ejecuta en servidor mediante una operacion atomica
              que inserta la organizacion, su perfil base fiscal y tu
              membership owner en la misma transaccion logica.
            </p>
          </div>

          <OrganizationOnboardingForm userEmail={user?.email} />
        </div>

        <div className="space-y-4">
          <SectionCard
            title="Que queda resuelto"
            description="ORG-001 habilita el ingreso a la app privada con un slug de organizacion estable desde el primer dia."
          >
            <div className="space-y-3">
              {onboardingChecks.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Criterio de producto"
            description="La organizacion no se crea desde el trigger de auth.users para no acoplar el signup a una operacion mas larga o fallable."
          >
            <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
              <p>El usuario se autentica primero; el tenant se crea despues con contexto y validacion propios.</p>
              <p>El slug se genera en servidor y resuelve colisiones con sufijo incremental.</p>
              <p>Sin membership activa, las rutas privadas siguen redirigiendo a esta pantalla.</p>
            </div>
          </SectionCard>

          <SectionCard
            title="Salir de la sesion"
            description="Si no quieres continuar con esta cuenta, puedes cerrar la sesion desde aqui."
          >
            <form action="/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
              >
                Cerrar sesion
              </button>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
