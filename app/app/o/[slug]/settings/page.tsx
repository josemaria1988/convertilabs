import type { Metadata } from "next";
import { PrivateDashboardShell } from "@/components/dashboard/private-dashboard-shell";
import { BusinessProfileSettings } from "@/components/settings/business-profile-settings";
import { SettingsCapabilitiesList } from "@/components/settings/settings-capabilities-list";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { ExpandableSectionCard } from "@/components/ui/expandable-section-card";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  loadOrganizationChartManagementData,
  type ChartAccountType,
} from "@/modules/accounting/chart-admin";
import {
  supportedLegalEntityTypes,
  supportedTaxRegimeCodes,
} from "@/modules/organizations/onboarding-schema";
import { loadOrganizationBusinessProfileData } from "@/modules/organizations/business-profiles";
import { getOrganizationFeatureFlags } from "@/modules/organizations/feature-flags";
import { buildOrganizationPrivateNavItems } from "@/modules/organizations/private-nav";
import { loadOrganizationSettingsData } from "@/modules/organizations/settings";
import { formatCfeEmailConnectionStatusLabel } from "@/modules/integrations/cfe-email-settings";
import {
  supportedCfeStatuses,
  supportedDgiGroups,
  supportedVatRegimes,
} from "@/modules/tax/uy-vat-profile";
import {
  formatAccountTypeLabel,
  formatChartAccountSourceLabel,
  formatLifecycleStatusLabel,
  formatNormalSideLabel,
  formatSystemRoleLabel,
} from "@/modules/presentation/labels";
import {
  activateOrganizationProfileVersionAction,
  applyOrganizationChartPresetAction,
  createOrganizationChartAccountAction,
  importOrganizationChartSpreadsheetAction,
  upsertOrganizationCfeEmailConnectionAction,
  updateOrganizationBasicsAction,
  updateOrganizationChartAccountAction,
} from "./actions";

type OrganizationSettingsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const chartAccountTypeOptions: ChartAccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "memo",
];

const normalSideOptions = ["debit", "credit"] as const;

export const metadata: Metadata = {
  title: "Organizacion",
};

export default async function OrganizationSettingsPage({
  params,
}: OrganizationSettingsPageProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const featureFlags = getOrganizationFeatureFlags();
  const [settings, chart, businessProfile] = await Promise.all([
    loadOrganizationSettingsData(organization.id, authState.user?.id ?? null),
    loadOrganizationChartManagementData(organization.id),
    loadOrganizationBusinessProfileData(organization.id),
  ]);
  const effectiveFromDefault = new Date().toISOString().slice(0, 10);
  const activeProfileJson = (settings.activeProfile?.profile_json ?? {}) as Record<string, unknown>;
  const activeFiscalAddress =
    typeof activeProfileJson.fiscal_address_text === "string"
      ? activeProfileJson.fiscal_address_text
      : "";
  const activeFiscalDepartment =
    typeof activeProfileJson.fiscal_department === "string"
      ? activeProfileJson.fiscal_department
      : "";
  const activeFiscalCity =
    typeof activeProfileJson.fiscal_city === "string"
      ? activeProfileJson.fiscal_city
      : "";
  const activeFiscalPostalCode =
    typeof activeProfileJson.fiscal_postal_code === "string"
      ? activeProfileJson.fiscal_postal_code
      : "";
  const activeLocationRiskPolicy =
    typeof activeProfileJson.location_risk_policy === "string"
      ? activeProfileJson.location_risk_policy
      : "warn_and_require_note";
  const activeTravelRadiusKmPolicy =
    typeof activeProfileJson.travel_radius_km_policy === "number"
      ? String(activeProfileJson.travel_radius_km_policy)
      : "";

  return (
    <PrivateDashboardShell
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userEmail={authState.user?.email}
      userRole={organization.role}
      title="Organizacion"
      description="Perfil de la organizacion, configuracion fiscal versionada y gestion del plan de cuentas con importacion y exportacion desde una sola vista."
      navItems={buildOrganizationPrivateNavItems(organization.slug, "settings")}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <article className="metric-card">
          <span className="metric-card__label">Perfil activo</span>
          <span className="metric-card__value">
            v{settings.activeProfile?.version_number ?? 0}
          </span>
          <p className="metric-card__hint">
            {settings.activeProfile
              ? formatLifecycleStatusLabel(settings.activeProfile.status)
              : "Sin version activa"}
          </p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Instantanea</span>
          <span className="metric-card__value">
            v{settings.activeRuleSnapshot?.version_number ?? 0}
          </span>
          <p className="metric-card__hint">
            {settings.activeRuleSnapshot
              ? formatLifecycleStatusLabel(settings.activeRuleSnapshot.status)
              : "Pendiente"}
          </p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Regimen IVA</span>
          <span className="metric-card__value text-2xl">
            {settings.organization.vatRegime ?? "N/D"}
          </span>
          <p className="metric-card__hint">Control fiscal vigente.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Cuentas activas</span>
          <span className="metric-card__value">
            {chart.summary.activeCount}
          </span>
          <p className="metric-card__hint">Plan de cuentas visible.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Imputables</span>
          <span className="metric-card__value">
            {chart.summary.postableCount}
          </span>
          <p className="metric-card__hint">Usables para sugerencia contable.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Cuentas sistema</span>
          <span className="metric-card__value">
            {chart.summary.systemRoleCount}
          </span>
          <p className="metric-card__hint">Roles estructurales detectados.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Provisionales</span>
          <span className="metric-card__value">
            {chart.summary.provisionalCount}
          </span>
          <p className="metric-card__hint">Pendientes de recategorizacion final.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Con codigo externo</span>
          <span className="metric-card__value">
            {chart.summary.externalCodeCount}
          </span>
          <p className="metric-card__hint">Listas para exportacion ERP.</p>
        </article>
      </section>

      <ExpandableSectionCard
        title="Mapa de configuracion actual"
        description="Resumen de donde vive cada capacidad del sistema hoy, separado entre configuracion, soporte, documentos y salidas contables."
        defaultOpen
      >
        <SettingsCapabilitiesList
          slug={organization.slug}
          showBusinessProfile={featureFlags.onboardingActivityBasedPresetsEnabled}
        />
      </ExpandableSectionCard>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="contents">
          <ExpandableSectionCard
            title="Datos base de la organizacion"
            description="Identidad operativa de la organizacion. Estos datos afectan presentacion, moneda base y configuracion general del espacio."
          >
            <form action={updateOrganizationBasicsAction} className="space-y-4">
              <input type="hidden" name="slug" value={organization.slug} />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Nombre</span>
                  <input
                    name="name"
                    defaultValue={settings.organization.name}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Slug</span>
                  <input
                    value={settings.organization.slug}
                    readOnly
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/60 px-4 py-3 text-[color:var(--color-muted)]"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Pais</span>
                  <input
                    name="countryCode"
                    defaultValue={settings.organization.countryCode}
                    maxLength={2}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 uppercase"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Moneda base</span>
                  <input
                    name="baseCurrency"
                    defaultValue={settings.organization.baseCurrency}
                    maxLength={3}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 uppercase"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Configuracion regional</span>
                  <input
                    name="defaultLocale"
                    defaultValue={settings.organization.defaultLocale}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                RUT: {settings.organization.taxId ?? "Sin definir"} | Forma juridica: {settings.organization.legalEntityType ?? "Sin definir"} | Regimen tributario: {settings.organization.taxRegimeCode ?? "Sin definir"}
              </div>

              <SubmitButton
                pendingLabel="Guardando..."
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`}
              >
                Guardar datos base
              </SubmitButton>
            </form>
          </ExpandableSectionCard>

          <ExpandableSectionCard
            title="Conectar email de eFacturas"
            description="Usa esta conexion para recibir en el sistema directamente los CFE de esta organizacion desde la casilla que cada usuario opera."
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
                <p className="font-semibold text-white">Conexion personal dentro de la organizacion</p>
                <p className="mt-2">
                  Cada usuario puede registrar su propia casilla de CFE para esta organizacion.
                  La casilla queda aislada por organizacion y no puede compartirse con otra empresa.
                </p>
                <p className="mt-2">
                  Metodo inicial recomendado: reenvio automatico desde tu email de CFE hacia un alias
                  seguro generado por Convertilabs.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Estado actual</p>
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    {settings.currentUserCfeEmailConnection
                      ? formatCfeEmailConnectionStatusLabel(
                        settings.currentUserCfeEmailConnection.status,
                      )
                      : "Sin conexion guardada"}
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    Casilla: {settings.currentUserCfeEmailConnection?.mailboxEmail ?? "Sin definir"}
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    Alias de ingreso: {settings.currentUserCfeEmailConnection?.inboundAddress ?? "Se genera al guardar"}
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    Usuario: {authState.user?.email ?? "Sesion autenticada"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">Como usarlo</p>
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    1. Guarda tu casilla de CFE.
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    2. Configura un reenvio automatico desde ese correo hacia el alias de ingreso.
                  </p>
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    3. Los CFEs reenviados quedaran asociados a esta organizacion y a tu conexion.
                  </p>
                </div>
              </div>

              <form action={upsertOrganizationCfeEmailConnectionAction} className="space-y-4">
                <input type="hidden" name="slug" value={organization.slug} />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Nombre de la conexion</span>
                    <input
                      name="connectionLabel"
                      defaultValue={settings.currentUserCfeEmailConnection?.connectionLabel ?? "Casilla principal de eFacturas"}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Email de eFacturas</span>
                    <input
                      type="email"
                      name="mailboxEmail"
                      defaultValue={settings.currentUserCfeEmailConnection?.mailboxEmail ?? authState.user?.email ?? ""}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                      placeholder="facturas@tuempresa.com.uy"
                    />
                  </label>
                </div>

                <label className="inline-flex items-center gap-3 text-sm text-[color:var(--color-muted)]">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={settings.currentUserCfeEmailConnection?.isActive ?? true}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <span>Dejar esta conexion activa para recibir CFE en esta organizacion</span>
                </label>

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                  Alias de ingreso seguro: {settings.currentUserCfeEmailConnection?.inboundAddress ?? "Se genera automaticamente al guardar la conexion por primera vez."}
                </div>

                <SubmitButton
                  pendingLabel="Guardando conexion..."
                  className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`}
                >
                  Guardar conexion de eFacturas
                </SubmitButton>
              </form>
            </div>
          </ExpandableSectionCard>

          {featureFlags.onboardingActivityBasedPresetsEnabled ? (
            <ExpandableSectionCard
              title="Perfil de negocio y recomendacion de plan"
              description="Actividad economica, rasgos operativos y composicion sugerida del plan de cuentas. Cada cambio crea una nueva version hacia adelante sin tocar historicos."
              defaultOpen
            >
              <BusinessProfileSettings
                slug={organization.slug}
                available={businessProfile.available}
                presetAiRecommendationEnabled={featureFlags.presetAiRecommendationEnabled}
                uiHelpHintsEnabled={featureFlags.uiHelpHintsEnabled}
                activeBusinessProfile={businessProfile.activeBusinessProfile}
                activePresetApplication={businessProfile.activePresetApplication}
                activePresetAiRun={businessProfile.activePresetAiRun}
              />
            </ExpandableSectionCard>
          ) : null}

          <ExpandableSectionCard
            title="Perfil fiscal versionado"
            description="Cada activacion crea una nueva version del perfil y materializa una instantanea nueva. Los borradores anteriores quedan congelados con la version previa."
          >
            <div className="space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
              <p>Organizacion: {settings.organization.name}</p>
              <p>Forma juridica: {settings.organization.legalEntityType ?? "Sin definir"}</p>
              <p>Regimen tributario: {settings.organization.taxRegimeCode ?? "Sin definir"}</p>
              <p>Regimen IVA: {settings.organization.vatRegime ?? "Sin definir"}</p>
              <p>Grupo DGI: {settings.organization.dgiGroup ?? "Sin definir"}</p>
              <p>Estado CFE: {settings.organization.cfeStatus ?? "Sin definir"}</p>
              <p>RUT: {settings.organization.taxId ?? "Sin definir"}</p>
              <p>Base geografica: {activeFiscalCity || activeFiscalDepartment
                ? `${activeFiscalCity || "Ciudad sin definir"} / ${activeFiscalDepartment || "Departamento sin definir"}`
                : "Sin definir"}</p>
              <p>Politica geografica: {activeLocationRiskPolicy.replace(/_/g, " ")}</p>
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

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm md:col-span-2">
                  <span className="font-medium">Direccion fiscal</span>
                  <input
                    name="fiscalAddressText"
                    defaultValue={activeFiscalAddress}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Departamento base</span>
                  <input
                    name="fiscalDepartment"
                    defaultValue={activeFiscalDepartment}
                    placeholder="Montevideo"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Ciudad base</span>
                  <input
                    name="fiscalCity"
                    defaultValue={activeFiscalCity}
                    placeholder="Montevideo"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Codigo postal</span>
                  <input
                    name="fiscalPostalCode"
                    defaultValue={activeFiscalPostalCode}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Politica geografica</span>
                  <select
                    name="locationRiskPolicy"
                    defaultValue={activeLocationRiskPolicy}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  >
                    <option value="soft_warn">Solo advertir</option>
                    <option value="warn_and_require_note">Advertir y exigir nota</option>
                    <option value="suggest_non_deductible">Sugerir no deducible</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Radio de viaje (km)</span>
                  <input
                    name="travelRadiusKmPolicy"
                    defaultValue={activeTravelRadiusKmPolicy}
                    placeholder="Opcional"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Motivo del cambio</span>
                <textarea
                  name="changeReason"
                  rows={3}
                  defaultValue="Actualizacion de perfil fiscal desde organizacion."
                  className="w-full rounded-3xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                />
              </label>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Los documentos ya procesados no se recalculan automaticamente. La nueva version impacta en documentos futuros o reprocesados.
              </div>

              <SubmitButton
                pendingLabel="Activando..."
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`}
              >
                Activar nueva version fiscal
              </SubmitButton>
            </form>
          </ExpandableSectionCard>
        </div>

        <div className="contents">
          <ExpandableSectionCard
            title="Instantanea activa"
            description="La IA recibe el resumen materializado de esta instantanea, no toda la normativa cruda."
          >
            {settings.activeRuleSnapshot ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
                  <p className="font-semibold">
                    Instantanea v{settings.activeRuleSnapshot.version_number}
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
                Aun no hay una instantanea activa materializada.
              </div>
            )}
          </ExpandableSectionCard>

          <ExpandableSectionCard
            title="Historial versionado"
            description="Trazabilidad de perfiles e instantaneas para entender por que un borrador viejo no cambia al modificar configuracion."
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
                      v{profile.version_number} - {formatLifecycleStatusLabel(profile.status)}
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
                <p className="text-sm font-semibold">Instantaneas</p>
                {settings.ruleSnapshotHistory.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm"
                  >
                    <p className="font-semibold">
                      v{snapshot.version_number} - {formatLifecycleStatusLabel(snapshot.status)}
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
          </ExpandableSectionCard>
        </div>
      </div>

      <ExpandableSectionCard
        title="Plan de cuentas"
        description="Preset activo, cuentas del sistema, cuentas provisionales y alta/edicion directa para sostener el motor contable."
      >
        <div className="grid items-start gap-4 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <form action={applyOrganizationChartPresetAction} className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
              <input type="hidden" name="slug" value={organization.slug} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Preset recomendado</p>
                <p className="text-sm text-[color:var(--color-muted)]">
                  Aplica un plan base Uruguay NIIF-ready con soporte para importadores, cuentas de sistema y temporales `TEMP-*`.
                </p>
              </div>
              <select
                name="presetCode"
                defaultValue={chart.presets[0]?.code ?? "uy_niif_importadores"}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
              >
                {chart.presets.map((preset) => (
                  <option key={preset.code} value={preset.code}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                {chart.presets[0]?.description ?? "Sin preset configurado."}
              </div>
              <SubmitButton
                pendingLabel="Aplicando..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Aplicar preset al plan actual
              </SubmitButton>
            </form>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
              <p className="font-semibold text-white">Cuentas provisionales pendientes</p>
              <p className="mt-2">
                {chart.summary.provisionalCount > 0
                  ? `${chart.summary.provisionalCount} cuenta(s) temporal(es) lista(s) para recategorizacion.`
                  : "No hay cuentas provisionales activas en este momento."}
              </p>
            </div>

            <form action={createOrganizationChartAccountAction} className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
              <input type="hidden" name="slug" value={organization.slug} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Crear cuenta</p>
                <p className="text-sm text-[color:var(--color-muted)]">
                  Alta manual para sumar nuevas cuentas al plan actual.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  name="code"
                  placeholder="Codigo"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                />
                <input
                  name="name"
                  placeholder="Nombre de la cuenta"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  name="accountType"
                  defaultValue="expense"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                >
                  {chartAccountTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatAccountTypeLabel(option)}
                    </option>
                  ))}
                </select>
                <select
                  name="normalSide"
                  defaultValue="debit"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                >
                  {normalSideOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatNormalSideLabel(option)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    name="isPostable"
                    defaultChecked
                    className="h-4 w-4 rounded border border-[color:var(--color-border)]"
                  />
                  Cuenta imputable
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Codigo externo</span>
                  <input
                    name="externalCode"
                    placeholder="Codigo ERP opcional"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Tax profile hint</span>
                  <input
                    name="taxProfileHint"
                    placeholder="UY_VAT_PURCHASE_BASIC"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <input
                  name="statementSection"
                  placeholder="Seccion EEFF"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                />
                <input
                  name="natureTag"
                  placeholder="Nature tag"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                />
                <input
                  name="functionTag"
                  placeholder="Function tag"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                />
                <input
                  name="cashflowTag"
                  placeholder="Cashflow tag"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                />
                <select
                  name="currencyPolicy"
                  defaultValue="mono_currency"
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                >
                  <option value="mono_currency">Moneda unica</option>
                  <option value="multi_currency">Multimoneda</option>
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="isProvisional"
                  className="h-4 w-4 rounded border border-[color:var(--color-border)]"
                />
                Cuenta provisional / temporal
              </label>
              <SubmitButton
                pendingLabel="Creando..."
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}
              >
                Crear cuenta
              </SubmitButton>
            </form>
          </div>

          <div className="space-y-3">
            {chart.accounts.length > 0 ? (
              chart.accounts.map((account) => (
                <form
                  key={account.id}
                  action={updateOrganizationChartAccountAction}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
                >
                  <input type="hidden" name="slug" value={organization.slug} />
                  <input type="hidden" name="accountId" value={account.id} />

                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {account.code} - {account.name}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                        {formatAccountTypeLabel(account.accountType)} / {formatNormalSideLabel(account.normalSide)} / {account.isPostable ? "Imputable" : "No imputable"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {account.systemRole ? (
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                          {formatSystemRoleLabel(account.systemRole)}
                        </span>
                      ) : null}
                      {account.isProvisional ? (
                        <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                          Provisional
                        </span>
                      ) : null}
                      {account.externalCode ? (
                        <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2.5 py-1 text-sky-100">
                          Ext. {account.externalCode}
                        </span>
                      ) : null}
                      {account.source ? (
                        <span className="rounded-full border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[color:var(--color-muted)]">
                          {formatChartAccountSourceLabel(account.source)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-5">
                    <input
                      name="code"
                      defaultValue={account.code}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                    <input
                      name="name"
                      defaultValue={account.name}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm md:col-span-2"
                    />
                    <select
                      name="accountType"
                      defaultValue={account.accountType}
                      disabled={Boolean(account.systemRole)}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm disabled:bg-white/50"
                    >
                      {chartAccountTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatAccountTypeLabel(option)}
                        </option>
                      ))}
                    </select>
                    <select
                      name="normalSide"
                      defaultValue={account.normalSide}
                      disabled={Boolean(account.systemRole)}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm disabled:bg-white/50"
                    >
                      {normalSideOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatNormalSideLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          name="isPostable"
                          defaultChecked={account.isPostable}
                          disabled={Boolean(account.systemRole)}
                          className="h-4 w-4 rounded border border-[color:var(--color-border)]"
                        />
                        Cuenta imputable
                      </label>
                      {account.parentCode ? (
                        <span className="text-xs text-[color:var(--color-muted)]">
                          Padre: {account.parentCode}
                        </span>
                      ) : null}
                      {account.taxProfileHint ? (
                        <span className="text-xs text-[color:var(--color-muted)]">
                          Perfil fiscal: {account.taxProfileHint}
                        </span>
                      ) : null}
                    </div>
                    <SubmitButton
                      pendingLabel="Guardando..."
                      className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                    >
                      Guardar cuenta
                    </SubmitButton>
                  </div>

                  {account.systemRole ? (
                    <p className="mt-3 text-xs leading-5 text-[color:var(--color-muted)]">
                      Cuenta de sistema. Puedes ajustar codigo y nombre, pero los atributos estructurales se mantienen bloqueados para no romper el flujo contable automatizado.
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <input
                      name="externalCode"
                      defaultValue={account.externalCode ?? ""}
                      placeholder="Codigo externo"
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                    <input
                      name="statementSection"
                      defaultValue={account.statementSection ?? ""}
                      placeholder="Seccion EEFF"
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                    <input
                      name="natureTag"
                      defaultValue={account.natureTag ?? ""}
                      placeholder="Nature tag"
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                    <input
                      name="taxProfileHint"
                      defaultValue={account.taxProfileHint ?? ""}
                      placeholder="Tax profile hint"
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <input
                      name="functionTag"
                      defaultValue={account.functionTag ?? ""}
                      placeholder="Function tag"
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                    <input
                      name="cashflowTag"
                      defaultValue={account.cashflowTag ?? ""}
                      placeholder="Cashflow tag"
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    />
                    <select
                      name="currencyPolicy"
                      defaultValue={account.currencyPolicy ?? "mono_currency"}
                      className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm"
                    >
                      <option value="mono_currency">Moneda unica</option>
                      <option value="multi_currency">Multimoneda</option>
                    </select>
                    <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        name="isProvisional"
                        defaultChecked={account.isProvisional}
                        className="h-4 w-4 rounded border border-[color:var(--color-border)]"
                      />
                      Provisional
                    </label>
                  </div>
                </form>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">
                Aun no hay cuentas activas cargadas en esta organizacion.
              </div>
            )}
          </div>
        </div>
      </ExpandableSectionCard>

      <ExpandableSectionCard
        title="Atajos de soporte y salidas"
        description="Accesos rapidos para importar o exportar el plan, revisar planillas auxiliares y saltar al carril documental correcto sin mezclar operatoria economica con soporte."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          <form action={importOrganizationChartSpreadsheetAction} className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4">
            <input type="hidden" name="slug" value={organization.slug} />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Importacion rapida de plan de cuentas</p>
              <p className="text-sm text-[color:var(--color-muted)]">
                Sube una planilla y te redirigimos a la corrida enfocada para revisar el plan detectado antes de aplicarlo.
              </p>
            </div>
            <input
              type="file"
              name="spreadsheet"
              accept=".csv,.tsv,.xlsx,.xls"
              className="block w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
            />
            <SubmitButton
              pendingLabel="Preparando preview..."
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
            >
              Importar plan desde planilla
            </SubmitButton>
          </form>

          <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
            <div className="space-y-1">
              <p className="font-semibold text-white">Planillas de soporte e historicos</p>
              <p>
                Usa estas vistas cuando necesites cargar historicos IVA, lotes mixtos o revisar vistas previas canonicas fuera del loop principal.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <LoadingLink
                href={`/app/o/${organization.slug}/imports?focus=chart_of_accounts_import`}
                pendingLabel="Abriendo planillas..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Abrir planillas
              </LoadingLink>
              <LoadingLink
                href={`/app/o/${organization.slug}/imports?focus=historical_vat_import`}
                pendingLabel="Abriendo historicos..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Historicos IVA
              </LoadingLink>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
            <div className="space-y-1">
              <p className="font-semibold text-white">Operaciones internacionales</p>
              <p>
                DUA, proveedor exterior y tributos asociados ahora viven dentro de Documentos porque forman parte del mismo evento economico revisable.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <LoadingLink
                href={`/app/o/${organization.slug}/documents?tab=international`}
                pendingLabel="Abriendo operaciones..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Abrir operaciones
              </LoadingLink>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm text-[color:var(--color-muted)]">
            <div className="space-y-1">
              <p className="font-semibold text-white">Bridge y exportacion</p>
              <p>
                Exporta el plan actual o abre el bridge contable cuando haga falta salir hacia un ERP, estudio o planilla externa.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/app/o/${organization.slug}/settings/chart-of-accounts/export`}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Exportar CSV
              </a>
              <LoadingLink
                href={`/app/o/${organization.slug}/exports`}
                pendingLabel="Abriendo exportaciones..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
              >
                Bridge contable
              </LoadingLink>
            </div>
          </div>
        </div>
      </ExpandableSectionCard>
    </PrivateDashboardShell>
  );
}
