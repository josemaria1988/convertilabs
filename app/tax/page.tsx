import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Tax",
};

const obligations = [
  "IVA mensual",
  "Retenciones",
  "Cierres y declaraciones",
];

export default async function TaxPage() {
  await requirePrivateAppPage("/tax");

  return (
    <WorkspaceShell
      activePath="/tax"
      title="Tax"
      description="Vista base para compliance, calendario fiscal y chequeos de datos antes de declarar."
    >
      <SectionCard
        title="Obligaciones activas"
        description="La informacion fiscal debe colgar del mismo core documental y contable para evitar reconciliaciones manuales."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {obligations.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm font-medium"
            >
              {item}
            </div>
          ))}
        </div>
      </SectionCard>
    </WorkspaceShell>
  );
}
