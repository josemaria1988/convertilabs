import type { Metadata } from "next";
import { AuthLoginForm } from "@/components/auth-login-form";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import {
  normalizeNextPath,
  redirectAuthenticatedUserFromPublicAuthPage,
} from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Ingreso",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    auth_message?: string | string[];
  }>;
};

const highlights = [
  {
    title: "Procesa facturas y recibos",
    tone: "bg-[#6c93df]",
  },
  {
    title: "Sugiere asientos contables",
    tone: "bg-[#8cc8de]",
  },
  {
    title: "Calcula IVA e impuestos",
    tone: "bg-[#d9b08a]",
  },
];

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAuthNotice(authMessage: string | null) {
  switch (authMessage) {
    case "signed_out":
      return "La sesion se cerro correctamente.";
    case "invalid_confirmation_link":
      return "El enlace de confirmacion es invalido o ya expiro. Inicia sesion o solicita un nuevo correo.";
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
    <div className="auth-stage">
      <div className="auth-grid">
        <section className="panel auth-card min-h-[430px] px-8 py-6 md:px-10 md:py-7">
          <div className="relative z-10 flex h-full flex-col">
            <ConvertilabsLogo />

            <div className="mt-12 grid gap-10 lg:grid-cols-[300px_314px] lg:gap-12">
              <div className="max-w-[300px]">
                <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-white md:text-[24px]">
                  Bienvenido a Convertilabs.
                </h1>

                {notice ? (
                  <div className="mt-5 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-6 text-amber-950">
                    {notice}
                  </div>
                ) : null}

                <div className="mt-6">
                  <AuthLoginForm nextPath={nextPath} />
                </div>
              </div>

              <div className="w-full max-w-[314px] rounded-[6px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(34,42,58,0.9),rgba(29,36,50,0.96))] px-6 py-5">
                <h2 className="max-w-[220px] text-[22px] font-semibold leading-[1.35] tracking-[-0.03em] text-white md:text-[24px]">
                  Automatiza tu Contabilidad e Impuestos
                </h2>

                <div className="mt-6 space-y-3">
                  {highlights.map((item, index) => (
                    <div
                      key={item.title}
                      className="flex min-h-[56px] items-center gap-3 rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                        <span className="text-[13px] font-semibold text-[#162030]">
                          {index + 1}
                        </span>
                      </span>
                      <span className="text-[14px] font-semibold text-white">
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
