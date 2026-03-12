import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { SectionCard } from "@/components/section-card";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";

type OrganizationTaxPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Tax",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function OrganizationTaxPage({
  params,
}: OrganizationTaxPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const vatRuns = await loadOrganizationVatRuns(supabase, organization.id);
  const [{ count: normativeSources }, { count: normativeItems }] = await Promise.all([
    supabase
      .from("normative_sources")
      .select("id", {
        count: "exact",
        head: true,
      }),
    supabase
      .from("normative_items")
      .select("id", {
        count: "exact",
        head: true,
      }),
  ]);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Tax"
      description="IVA mensual reconstruido desde documentos confirmados, con trazabilidad a drafts y snapshots organizacionales."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "tax")}
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="IVA mensual"
          description="Cada corrida se reconstruye desde la ultima confirmacion por documento. Si una revision se reabre, el VAT run mantiene la ultima version confirmada hasta reconfirmar."
        >
          {vatRuns.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-6 py-14 text-center text-sm text-[color:var(--color-muted)]">
              Aun no hay VAT runs porque no existen documentos confirmados con fecha valida.
            </div>
          ) : (
            <div className="space-y-4">
              {vatRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-3xl border border-[color:var(--color-border)] bg-white/75 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        Periodo {run.periodLabel}
                      </p>
                      <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                        Neto IVA: {formatMoney(run.netVatPayable)}
                      </p>
                    </div>
                    <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">
                      {run.status}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm">
                      Output IVA: {formatMoney(run.outputVat)}
                    </div>
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm">
                      Credito IVA: {formatMoney(run.inputVatCreditable)}
                    </div>
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm">
                      No deducible: {formatMoney(run.inputVatNonDeductible)}
                    </div>
                  </div>

                  {run.tracedDocuments.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-semibold">Documentos incluidos</p>
                      {run.tracedDocuments.map((document) => (
                        <Link
                          key={`${run.id}-${document.documentId}`}
                          href={`/app/o/${organization.slug}/documents/${document.documentId}`}
                          className="flex items-center justify-between rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm transition hover:bg-white"
                        >
                          <span>
                            {document.role} - {document.documentDate}
                          </span>
                          <span className="text-[color:var(--color-muted)]">
                            IVA {formatMoney(document.taxAmount)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard
            title="Base normativa"
            description="La base interna existe para soportar reglas y prompts resumidos. En runtime la IA no recibe el corpus completo."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm">
                Fuentes registradas: {normativeSources ?? 0}
              </div>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm">
                Items normativos: {normativeItems ?? 0}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm leading-7 text-[color:var(--color-muted)]">
              La publicacion de reglas sigue siendo human-in-the-loop. Esta pantalla expone el resultado operativo en IVA; el backoffice normativo completo sigue siendo la siguiente etapa.
            </div>
          </SectionCard>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
