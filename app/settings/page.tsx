import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "Settings",
};

const areas = [
  "Perfil de organizacion",
  "Permisos y roles",
  "Integraciones",
  "Facturacion",
];

export default function SettingsPage() {
  return (
    <WorkspaceShell
      activePath="/settings"
      title="Settings"
      description="Configuracion del workspace, organizaciones e integraciones."
    >
      <SectionCard
        title="Bloques de configuracion"
        description="Aqui deberian vivir tenancy, branding, reglas compartidas y conexiones externas."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {areas.map((area) => (
            <div
              key={area}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm font-medium"
            >
              {area}
            </div>
          ))}
        </div>
      </SectionCard>
    </WorkspaceShell>
  );
}
