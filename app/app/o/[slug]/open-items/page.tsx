import type { Metadata } from "next";
import Link from "next/link";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationOpenItemsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Open items",
};

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function OrganizationOpenItemsPage({
  params,
}: OrganizationOpenItemsPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("ledger_open_items")
    .select("id, source_document_id, counterparty_type, document_role, document_type, currency_code, outstanding_amount, original_amount, status, issue_date, due_date")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const openItems = ((data as Array<{
    id: string;
    source_document_id: string | null;
    counterparty_type: string;
    document_role: string;
    document_type: string | null;
    currency_code: string;
    outstanding_amount: number;
    original_amount: number;
    status: string;
    issue_date: string | null;
    due_date: string | null;
  }> | null) ?? []);
  const openCount = openItems.filter((item) => item.status !== "settled").length;
  const receivableCount = openItems.filter((item) => item.counterparty_type === "customer").length;
  const payableCount = openItems.filter((item) => item.counterparty_type === "vendor").length;

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Open items"
      toolbarLabel="Open items"
      description="Vista compacta de saldos abiertos a cobrar y pagar, con enlace al documento origen."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "open_items")}
    >
      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="ui-panel p-4">
            <p className="text-sm font-semibold text-white">Abiertos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{openCount}</p>
          </div>
          <div className="ui-panel p-4">
            <p className="text-sm font-semibold text-white">AR</p>
            <p className="mt-2 text-2xl font-semibold text-white">{receivableCount}</p>
          </div>
          <div className="ui-panel p-4">
            <p className="text-sm font-semibold text-white">AP</p>
            <p className="mt-2 text-2xl font-semibold text-white">{payableCount}</p>
          </div>
        </div>

        <div className="ui-panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Tipo</th>
                  <th>Moneda</th>
                  <th className="text-right">Original</th>
                  <th className="text-right">Pendiente</th>
                  <th>Estado</th>
                  <th>Fechas</th>
                  <th className="text-right">Origen</th>
                </tr>
              </thead>
              <tbody>
                {openItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center text-sm text-[color:var(--color-muted)]">
                      Todavia no hay open items para mostrar.
                    </td>
                  </tr>
                ) : (
                  openItems.map((item) => (
                    <tr key={item.id}>
                      <td className="text-white">{item.document_role}</td>
                      <td>{item.document_type ?? item.counterparty_type}</td>
                      <td>{item.currency_code}</td>
                      <td className="text-right text-white">{formatAmount(item.original_amount)}</td>
                      <td className="text-right text-white">{formatAmount(item.outstanding_amount)}</td>
                      <td>{item.status}</td>
                      <td className="text-[13px] text-[color:var(--color-muted)]">
                        {item.issue_date ?? "sin emision"}
                        {item.due_date ? ` / vto ${item.due_date}` : ""}
                      </td>
                      <td className="text-right">
                        {item.source_document_id ? (
                          <Link
                            href={`/app/o/${organization.slug}/documents/${item.source_document_id}`}
                            className="text-white"
                          >
                            abrir
                          </Link>
                        ) : (
                          <span className="text-[color:var(--color-muted)]">n/a</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PrivateDashboardShell>
  );
}
