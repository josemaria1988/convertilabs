import type { Metadata } from "next";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Organization dashboard",
};

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  return (
    <div className="page-shell space-y-6 py-10">
      <section className="panel px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="eyebrow">Private app</span>
            <h1 className="text-4xl font-semibold tracking-[-0.06em]">
              {organization.name}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
              Primer dashboard privado resuelto por slug de organizacion. El
              acceso queda limitado a miembros activos y este punto ya sirve
              como destino estable despues del onboarding.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/documents"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Ir a documentos
            </Link>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
              >
                Cerrar sesion
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Contexto resuelto"
          description="La app ya conoce la organizacion actual y el usuario autenticado sin depender de estado cliente."
        >
          <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
            <p>Slug: `{organization.slug}`</p>
            <p>Rol actual: `{organization.role}`</p>
            <p>Usuario: {authState.user?.email ?? "sin email"}</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Siguiente capa"
          description="DASH-001 conectara esta entrada privada con shell, estados vacios y lista real de documentos."
        >
          <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
            <p>La ruta ya esta lista para ser el home privado del tenant.</p>
            <p>El guard usa SSR y membership real; un slug ajeno responde como recurso no accesible.</p>
            <p>El siguiente paso natural es poblar este dashboard con documentos y CTA de upload.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
