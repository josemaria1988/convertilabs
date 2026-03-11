import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Journal Entries",
};

const journals = [
  { title: "Compras", description: "Reglas contables por proveedor y categoria." },
  { title: "Ventas", description: "Asientos derivados de facturacion y cobros." },
  { title: "Ajustes", description: "Correcciones, accruals y cierres periodicos." },
];

export default async function JournalEntriesPage() {
  await requirePrivateAppPage("/journal-entries");

  return (
    <WorkspaceShell
      activePath="/journal-entries"
      title="Journal entries"
      description="Base del modulo contable para reglas, publicaciones y revisiones."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {journals.map((journal) => (
          <SectionCard
            key={journal.title}
            title={journal.title}
            description={journal.description}
          />
        ))}
      </div>
    </WorkspaceShell>
  );
}
