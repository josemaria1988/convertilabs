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

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAuthNotice(authMessage: string | null) {
  switch (authMessage) {
    case "signed_out":
      return "La sesión se cerró correctamente.";
    case "invalid_confirmation_link":
      return "El enlace de confirmación es inválido o ya expiró. Inicia sesión o solicita un nuevo correo.";
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
    <main className="auth-stage justify-center">
      <section className="panel auth-card w-full max-w-[400px] px-7 py-8 sm:px-9">
        <div className="relative z-10">
          <ConvertilabsLogo />
          <h1 className="mt-8 text-2xl font-semibold tracking-[-0.03em] text-white">
            Iniciar sesión
          </h1>

          {notice ? (
            <div role="status" className="mt-5 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-6 text-amber-950">
              {notice}
            </div>
          ) : null}

          <div className="mt-6">
            <AuthLoginForm nextPath={nextPath} />
          </div>
        </div>
      </section>
    </main>
  );
}
