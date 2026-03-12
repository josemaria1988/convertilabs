import type { Metadata } from "next";
import { DashboardDocumentList } from "@/components/dashboard/dashboard-document-list";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { DocumentUploadDropzone } from "@/components/documents/upload-dropzone";
import { SectionCard } from "@/components/section-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { loadOrganizationDashboardDocuments } from "@/modules/documents/dashboard";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Dashboard privado",
};

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const supabase = await getSupabaseServerClient();
  const documentsState = await loadOrganizationDashboardDocuments(
    supabase,
    organization.id,
  );
  const uploadHref = "#document-upload-panel";

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Dashboard"
      description="Inbox privado del tenant actual con upload, intake documental con OpenAI y seguimiento rapido del estado de cada documento."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "dashboard")}
    >
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-4">
          <SectionCard
            title="Ingreso documental"
            description="La subida va a Storage privado y luego dispara procesamiento server-side con OpenAI Responses API usando solo el snapshot de reglas relevante para la organizacion."
          >
            <DocumentUploadDropzone slug={organization.slug} />
          </SectionCard>

          <SectionCard
            title="Documentos recientes"
            description={
              documentsState.status === "populated"
                ? `Lista SSR de la organizacion actual. ${documentsState.totalDocuments} documento(s) cargado(s) con su ultimo estado disponible.`
                : "Estado inicial del tenant para empezar carga documental y seguimiento desde una sola entrada privada."
            }
          >
            {documentsState.status === "error" ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-950">
                {documentsState.message}
              </div>
            ) : null}

            {documentsState.status === "empty" ? (
              <DashboardEmptyState uploadHref={uploadHref} />
            ) : null}

            {documentsState.status === "populated" ? (
              <DashboardDocumentList
                documents={documentsState.documents}
              />
            ) : null}
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard
            title="Contexto resuelto"
            description="El dashboard carga desde servidor con la organizacion correcta y sin exponer informacion de slugs ajenos."
          >
            <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
              <p>Organizacion: {organization.name}</p>
              <p>Slug: {organization.slug}</p>
              <p>Rol actual: {organization.role}</p>
              <p>Usuario: {authState.user?.email ?? "sin email"}</p>
            </div>
          </SectionCard>

          <SectionCard
            title="Upload conectado"
            description="La subida crea metadata, usa el bucket privado y deja trazabilidad del run de procesamiento, snapshot de reglas y salida estructurada del intake."
          >
            <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
              <p>El path de Storage queda fijado como `orgs/&lt;organization_id&gt;/&lt;document_id&gt;/archivo`.</p>
              <p>Los formatos permitidos en Semana 1 son PDF, JPG y PNG, con limite de 20 MB.</p>
              <p>Si la subida falla, el documento queda visible con estado `error` para no perder trazabilidad.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
