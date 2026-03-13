import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { SectionCard } from "@/components/section-card";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
} from "@/components/ui/button-styles";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { supportedLegalEntityTypes, supportedTaxRegimeCodes } from "@/modules/organizations/onboarding-schema";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadOrganizationSettingsData } from "@/modules/organizations/settings";
import {
  supportedCfeStatuses,
  supportedDgiGroups,
  supportedVatRegimes,
} from "@/modules/tax/uy-vat-profile";
import { activateOrganizationProfileVersionAction } from "./actions";

type OrganizationSettingsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Configuracion",
};

export default async function OrganizationSettingsPage({
  params,
}: OrganizationSettingsPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const settings = await loadOrganizationSettingsData(organization.id);
  const effectiveFromDefault = new Date().toISOString().slice(0, 10);

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Configuracion"
      description="Perfil versionado del tenant, snapshots de reglas por organizacion y advertencia explicita de que los drafts viejos quedan congelados con la configuracion previa."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "settings")}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <span className="metric-card__label">Perfil activo</span>
          <span className="metric-card__value">
            v{settings.activeProfile?.version_number ?? 0}
          </span>
          <p className="metric-card__hint">
            {settings.activeProfile?.status ?? "Sin version activa"}
          </p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Snapshot</span>
          <span className="metric-card__value">
            v{settings.activeRuleSnapshot?.version_number ?? 0}
          </span>
          <p className="metric-card__hint">
            {settings.activeRuleSnapshot?.status ?? "Pendiente de materializacion"}
          </p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Regimen IVA</span>
          <span className="metric-card__value text-2xl">
            {settings.organization.vatRegime ?? "N/D"}
          </span>
          <p className="metric-card__hint">Se usa para gating fiscal del MVP.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Historial</span>
          <span className="metric-card__value">
            {settings.profileHistory.length}
          </span>
          <p className="metric-card__hint">Versiones persistidas del perfil fiscal.</p>
        </article>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Perfil activo"
          description="El onboarding carga el minimo fiscal V1. Desde aqui se activan nuevas versiones del perfil que materializan nuevos snapshots."
        >
            <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
              <p>Organizacion: {settings.organization.name}</p>
              <p>Pais: {settings.organization.countryCode}</p>
              <p>Forma juridica: {settings.organization.legalEntityType ?? "Sin definir"}</p>
              <p>Regimen tributario: {settings.organization.taxRegimeCode ?? "Sin definir"}</p>
              <p>Regimen IVA: {settings.organization.vatRegime ?? "Sin definir"}</p>
              <p>Grupo DGI: {settings.organization.dgiGroup ?? "Sin definir"}</p>
              <p>Estado CFE: {settings.organization.cfeStatus ?? "Sin definir"}</p>
              <p>RUT: {settings.organization.taxId ?? "Sin definir"}</p>
            </div>

          <form action={activateOrganizationProfileVersionAction} className="mt-6 space-y-4">
            <input type="hidden" name="slug" value={organization.slug} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Forma juridica</span>
                <select
                  name="legalEntityType"
                  defaultValue={settings.activeProfile?.legal_entity_type ?? "SAS"}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                >
                  {supportedLegalEntityTypes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Regimen tributario</span>
                <select
                  name="taxRegimeCode"
                  defaultValue={settings.activeProfile?.tax_regime_code ?? "IRAE_GENERAL"}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                >
                  {supportedTaxRegimeCodes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Regimen IVA</span>
                <select
                  name="vatRegime"
                  defaultValue={settings.activeProfile?.vat_regime ?? "GENERAL"}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                >
                  {supportedVatRegimes.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Grupo DGI</span>
                <select
                  name="dgiGroup"
                  defaultValue={settings.activeProfile?.dgi_group ?? "NO_CEDE"}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                >
                  {supportedDgiGroups.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Estado CFE</span>
                <select
                  name="cfeStatus"
                  defaultValue={settings.activeProfile?.cfe_status ?? "ELECTRONIC_ISSUER"}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                >
                  {supportedCfeStatuses.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">RUT</span>
                <input
                  name="taxId"
                  defaultValue={settings.activeProfile?.tax_id ?? settings.organization.taxId ?? ""}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Vigencia</span>
                <input
                  type="date"
                  name="effectiveFrom"
                  defaultValue={effectiveFromDefault}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Motivo del cambio</span>
              <textarea
                name="changeReason"
                rows={3}
                defaultValue="Actualizacion de perfil fiscal desde configuracion."
                className="w-full rounded-3xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              />
            </label>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Los drafts existentes no se recalculan automaticamente. Quedan congelados y solo los documentos nuevos usan la nueva configuracion.
            </div>

            <SubmitButton
              pendingLabel="Activando..."
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`}
            >
              Activar nueva version
            </SubmitButton>
          </form>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard
            title="Snapshots activos"
            description="La IA recibe solo el resumen relevante de este snapshot, nunca toda la normativa DGI."
          >
            {settings.activeRuleSnapshot ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">
                    Snapshot v{settings.activeRuleSnapshot.version_number}
                  </p>
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    {settings.activeRuleSnapshot.legal_entity_type} / {settings.activeRuleSnapshot.tax_regime_code}
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    IVA {settings.activeRuleSnapshot.vat_regime} / DGI {settings.activeRuleSnapshot.dgi_group} / CFE {settings.activeRuleSnapshot.cfe_status}
                  </p>
                </div>
                <pre className="max-h-[260px] overflow-auto rounded-3xl border border-[color:var(--color-border)] bg-white/75 p-5 text-xs leading-6 text-[color:var(--color-muted)]">
                  {settings.activeRuleSnapshot.prompt_summary}
                </pre>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">
                Aun no hay un snapshot activo materializado.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Historial"
            description="Versionado por vigencia para perfil y snapshot, con trazabilidad suficiente para entender por que un draft viejo no cambia."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Perfiles</p>
                {settings.profileHistory.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm"
                  >
                    <p className="font-semibold">
                      v{profile.version_number} - {profile.status}
                    </p>
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      {profile.legal_entity_type} / {profile.tax_regime_code}
                    </p>
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      IVA {profile.vat_regime} / DGI {profile.dgi_group} / CFE {profile.cfe_status}
                    </p>
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      Desde {profile.effective_from}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Rule snapshots</p>
                {settings.ruleSnapshotHistory.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm"
                  >
                    <p className="font-semibold">
                      v{snapshot.version_number} - {snapshot.status}
                    </p>
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      {snapshot.legal_entity_type} / {snapshot.tax_regime_code}
                    </p>
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      IVA {snapshot.vat_regime} / DGI {snapshot.dgi_group} / CFE {snapshot.cfe_status}
                    </p>
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      Desde {snapshot.effective_from}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PrivateDashboardShell>
  );
}
