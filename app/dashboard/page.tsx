import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

const snapshot = [
  { label: "Documentos pendientes", value: "128" },
  { label: "Asientos sugeridos", value: "42" },
  { label: "Alertas fiscales", value: "5" },
];

const queues = [
  "Facturas a validar por OCR",
  "Recibos listos para contabilizar",
  "Vencimientos del mes por revisar",
];

export default async function DashboardPage() {
  await requirePrivateAppPage("/dashboard");

  return (
    <WorkspaceShell
      activePath="/dashboard"
      title="Dashboard"
      description="Resumen de actividad y visibilidad del estado operativo del sistema."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {snapshot.map((item) => (
          <SectionCard
            key={item.label}
            title={item.value}
            description={item.label}
          />
        ))}
      </div>

      <SectionCard
        title="Colas activas"
        description="Primer bloque que deberia conectarse a datos reales cuando se integre documents, accounting y tax."
      >
        <div className="space-y-3">
          {queues.map((queue) => (
            <div
              key={queue}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm"
            >
              {queue}
            </div>
          ))}
        </div>
      </SectionCard>
    </WorkspaceShell>
  );
}
