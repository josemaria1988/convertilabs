import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export const metadata: Metadata = {
  title: "Documents",
};

const pipeline = [
  "Inbox unificado",
  "Clasificacion",
  "Extraccion",
  "Aprobacion",
  "Publicacion contable",
];

export default async function DocumentsPage() {
  await requirePrivateAppPage("/documents");

  return (
    <WorkspaceShell
      activePath="/documents"
      title="Documents"
      description="Pantalla base para ingestion, validacion y aprobacion documental."
    >
      <SectionCard
        title="Pipeline documental"
        description="Este modulo puede arrancar con OCR + reglas y mas adelante sumar AI para enriquecimiento y deteccion de excepciones."
      >
        <div className="grid gap-3 md:grid-cols-5">
          {pipeline.map((step) => (
            <div
              key={step}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm font-medium"
            >
              {step}
            </div>
          ))}
        </div>
      </SectionCard>
    </WorkspaceShell>
  );
}
