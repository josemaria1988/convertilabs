import type { Metadata } from "next";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import {
  MarketingDesktopMockup,
  MarketingMobileMockup,
} from "@/components/marketing-product-mockups";
import { LoadingLink } from "@/components/ui/loading-link";
import { siteConfig } from "@/lib/site";
import { redirectAuthenticatedUserFromPublicAuthPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Acceso por invitación",
};

const emailHref = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent("Acceso por invitación Convertilabs")}`;

const accessPoints = [
  "Convertilabs no tiene registro público abierto.",
  "La prueba actual se comparte por invitación y sin costo.",
  "La operación completa vive en desktop y la app móvil resuelve captura en campo.",
];

const requestSteps = [
  "Nos escribes con tu caso y el tipo de operación que quieres ordenar.",
  "Revisamos si hoy el sistema ya encaja con tu flujo real.",
  "Si tiene sentido, te compartimos acceso por invitación para probarlo.",
];

export default async function SignupPage() {
  await redirectAuthenticatedUserFromPublicAuthPage();

  return (
    <div className="page-shell space-y-8">
      <section className="grid gap-6 lg:grid-cols-[0.88fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <ConvertilabsLogo subtitle="Acceso por invitación" />

          <div className="mt-10 max-w-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Registro cerrado
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-white md:text-5xl">
              El acceso nuevo se habilita solo por invitación
            </h1>
            <p className="mt-5 text-sm leading-7 text-[color:var(--color-muted)] md:text-base">
              Convertilabs nació como una capa de inteligencia y captura
              operativa para convivir con sistemas contables legacy. Hoy no se
              está comercializando como producto abierto, pero puedes escribirnos
              para pedir acceso y probarlo sin costo.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {accessPoints.map((item) => (
              <div
                key={item}
                className="rounded-[8px] border border-[color:var(--color-border)] bg-[rgba(15,22,29,0.74)] px-4 py-4 text-sm leading-6 text-[color:var(--color-muted)]"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8 flex max-w-sm flex-col items-start gap-3">
            <div className="flex flex-wrap gap-3">
              <a
                href={emailHref}
                className="inline-flex rounded-[8px] bg-[#ff9b4a] px-4 py-3 text-sm font-medium text-[#1d1208] transition hover:brightness-105"
              >
                Solicitar acceso
              </a>
              <LoadingLink
                href="/login"
                pendingLabel="Abriendo..."
                className="inline-flex rounded-[8px] border border-[color:var(--color-border)] bg-transparent px-4 py-3 text-sm font-medium text-[color:var(--color-muted)] transition hover:border-white/18 hover:text-white"
              >
                Ya tengo invitación
              </LoadingLink>
            </div>
            <p className="text-sm leading-6 text-[color:var(--color-muted)]">
              Priorizamos el contacto directo para asegurar que la herramienta se
              adapte a tu flujo de trabajo.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="panel px-6 py-7 md:px-8 md:py-8">
            <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Cómo funciona
            </p>
            <div className="mt-6 space-y-3">
              {requestSteps.map((item, index) => (
                <div
                  key={item}
                  className="rounded-[8px] border border-[color:var(--color-border)] bg-[rgba(15,22,29,0.74)] px-4 py-4"
                >
                  <p className="font-mono text-sm text-[color:var(--color-muted)]">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/82">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <MarketingDesktopMockup className="w-full" />
          <MarketingMobileMockup className="w-full" />
        </div>
      </section>
    </div>
  );
}
