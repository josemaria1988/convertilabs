import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationJournalEntriesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Asientos",
};

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
        "id, source_document_id, status, reference, description, total_debit, total_credit, created_at",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(7),
    supabase
      .from("accounting_suggestions")
      .select("id, document_id, version_no, explanation, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(7),
  ]);

  const entryRows = ((journalEntries as Array<{
    id: string;
    source_document_id: string | null;
    status: string;
    reference: string | null;
    description: string | null;
    total_debit: number;
    total_credit: number;
  }> | null) ?? []);

  const suggestionRows = ((suggestions as Array<{
    id: string;
    document_id: string;
    version_no: number;
    explanation: string | null;
  }> | null) ?? []);

  const rows = entryRows.length > 0
    ? entryRows.map((entry, index) => ({
      id: entry.id,
      sourceDocumentId: entry.source_document_id,
      code: entry.reference ?? String(318000000 + index * 1000),
      description: entry.description ?? "Asiento sugerido por confirmacion",
      status: entry.status,
      exemptAmount:
        entry.total_credit > entry.total_debit
          ? entry.total_credit - entry.total_debit
          : 0,
      balanceAmount: entry.total_debit,
      totalAmount: entry.total_credit,
    }))
    : suggestionRows.map((suggestion, index) => ({
      id: suggestion.id,
      sourceDocumentId: suggestion.document_id,
      code: `31${String(index).padStart(2, "0")}0000`,
      description: suggestion.explanation ?? `Suggestion v${suggestion.version_no}`,
      status: "suggested",
      exemptAmount: null,
      balanceAmount: null,
      totalAmount: null,
    }));

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Asientos"
      toolbarLabel="Asientos"
      description="Vista compacta de sugerencias y asientos en revision, con tabla densa y tabs visuales como en la referencia."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "journal_entries")}
    >
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="ui-tab" data-current="true">Sugerir</span>
            <span className="ui-tab">En revision</span>
            <span className="ui-tab">Aprobados</span>
          </div>
          <span className="ui-button ui-button--primary">Separar diferencias</span>
        </div>

        <div className="ui-panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th className="w-8"> </th>
                  <th>Cuenta</th>
                  <th>Descripcion</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Exentos</th>
                  <th className="text-right">Importe</th>
                  <th className="w-10 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center text-sm text-[color:var(--color-muted)]">
                      Todavia no hay asientos ni sugerencias para mostrar.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="block h-2.5 w-2.5 rounded-[2px] bg-white/20" />
                      </td>
                      <td>
                        <div className="font-semibold text-white">{row.code}</div>
                        <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {row.status}
                        </div>
                      </td>
                      <td className="text-[color:var(--color-foreground)]">
                        {row.description}
                      </td>
                      <td className="text-right text-white">
                        {formatAmount(row.balanceAmount)}
                      </td>
                      <td className="text-right text-[color:var(--color-muted)]">
                        {formatAmount(row.exemptAmount)}
                      </td>
                      <td className="text-right text-white">
                        {formatAmount(row.totalAmount)}
                      </td>
                      <td className="text-right">
                        {row.sourceDocumentId ? (
                          <Link
                            href={`/app/o/${organization.slug}/documents/${row.sourceDocumentId}`}
                        className="text-[14px] text-white"
                          >
                            &gt;
                          </Link>
                        ) : (
                          <span className="text-[14px] text-[color:var(--color-muted)]">
                            &gt;
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 pb-3">
            <div className="ui-table-pager">1</div>
          </div>
        </div>
      </section>
    </PrivateDashboardShell>
  );
}
