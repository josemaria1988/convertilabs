import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { SectionCard } from "@/components/section-card";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationJournalEntriesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Journal entries",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function OrganizationJournalEntriesPage({
  params,
}: OrganizationJournalEntriesPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const [{ data: journalEntries }, { data: suggestions }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select(
        "id, source_document_id, entry_date, status, reference, description, total_debit, total_credit, created_at",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("accounting_suggestions")
      .select("id, document_id, version_no, status, explanation, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Journal entries"
      description="Cada confirmacion final genera un journal entry en draft y deja su sugerencia contable asociada."
      uploadHref={`/app/o/${organization.slug}/dashboard#document-upload-panel`}
      navItems={buildOrganizationPrivateNavItems(organization.slug, "journal_entries")}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Journal entries draft"
          description="Se crean al confirmar el documento. Si falta mapping en el plan de cuentas, el header igual queda trazado y las lineas quedan pendientes."
        >
          <div className="space-y-3">
            {((journalEntries as Array<{
              id: string;
              source_document_id: string | null;
              entry_date: string;
              status: string;
              reference: string | null;
              description: string | null;
              total_debit: number;
              total_credit: number;
            }> | null) ?? []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{entry.reference ?? entry.id}</p>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">
                    {entry.status}
                  </span>
                </div>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  Debe {formatMoney(entry.total_debit)} / Haber {formatMoney(entry.total_credit)}
                </p>
                <p className="mt-1 text-[color:var(--color-muted)]">
                  {entry.description ?? "Sin descripcion"}
                </p>
                {entry.source_document_id ? (
                  <Link
                    href={`/app/o/${organization.slug}/documents/${entry.source_document_id}`}
                    className="mt-3 inline-flex text-sm font-semibold text-[color:var(--color-accent)]"
                  >
                    Abrir documento origen
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Sugerencias contables"
          description="El sistema guarda la explicacion y el trace fiscal usado para generar el asiento draft."
        >
          <div className="space-y-3">
            {((suggestions as Array<{
              id: string;
              document_id: string;
              version_no: number;
              status: string;
              explanation: string | null;
            }> | null) ?? []).map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    Suggestion v{suggestion.version_no}
                  </p>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                    {suggestion.status}
                  </span>
                </div>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  {suggestion.explanation ?? "Sin explicacion persistida"}
                </p>
                <Link
                  href={`/app/o/${organization.slug}/documents/${suggestion.document_id}`}
                  className="mt-3 inline-flex text-sm font-semibold text-[color:var(--color-accent)]"
                >
                  Abrir draft relacionado
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrivateDashboardShell>
  );
}
