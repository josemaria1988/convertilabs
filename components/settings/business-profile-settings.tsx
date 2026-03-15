"use client";

import { BusinessProfileConfigurator, type PlanSetupMode } from "@/components/onboarding/business-profile-configurator";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { updateOrganizationBusinessProfileAction } from "@/app/app/o/[slug]/settings/actions";
import { buildPresetCompositionCode } from "@/modules/accounting/presets/compose-preset";

type BusinessProfileSettingsProps = {
  slug: string;
  available: boolean;
  uiHelpHintsEnabled: boolean;
  activeBusinessProfile: {
    versionNo: number;
    primaryActivityCode: string | null;
    secondaryActivityCodes: string[];
    selectedTraits: string[];
    shortDescription: string | null;
    source: string;
    createdAt: string;
  } | null;
  activePresetApplication: {
    basePresetCode: string;
    overlayCodes: string[];
    applicationMode: string;
    explanation: Record<string, unknown>;
    appliedAt: string;
  } | null;
};

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatApplicationMode(value: string | null | undefined) {
  switch (value) {
    case "recommended":
      return "Plan recomendado";
    case "manual_pick":
      return "Alternativa elegida";
    case "external_import":
      return "Importacion externa";
    case "minimal_temp_only":
      return "Minimo + temporales";
    default:
      return "Sin aplicar";
  }
}

function toPlanSetupMode(value: string | null | undefined): PlanSetupMode {
  switch (value) {
    case "manual_pick":
      return "alternative";
    case "external_import":
      return "external_import";
    case "minimal_temp_only":
      return "minimal_temp_only";
    default:
      return "recommended";
  }
}

export function BusinessProfileSettings({
  slug,
  available,
  uiHelpHintsEnabled,
  activeBusinessProfile,
  activePresetApplication,
}: BusinessProfileSettingsProps) {
  if (!available) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        Este entorno todavia no tiene aplicadas las tablas de perfil de negocio y presets de onboarding. El resto de la organizacion sigue operando, pero para usar esta vista primero conviene correr la migracion de Step 6.
      </div>
    );
  }

  const explanationReasons = asStringArray(activePresetApplication?.explanation.reasons);
  const explanationImpacts = asStringArray(activePresetApplication?.explanation.impacts);

  return (
    <form action={updateOrganizationBusinessProfileAction} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(290px,0.72fr)]">
        <div className="min-w-0 space-y-5">
          <BusinessProfileConfigurator
            initialProfile={{
              primaryActivityCode: activeBusinessProfile?.primaryActivityCode ?? "",
              secondaryActivityCodes: activeBusinessProfile?.secondaryActivityCodes ?? [],
              selectedTraits: activeBusinessProfile?.selectedTraits ?? [],
              shortDescription: activeBusinessProfile?.shortDescription ?? "",
            }}
            initialPlanSetupMode={toPlanSetupMode(activePresetApplication?.applicationMode)}
            initialSelectedPresetCompositionCode={activePresetApplication
              ? buildPresetCompositionCode(
                  activePresetApplication.basePresetCode,
                  activePresetApplication.overlayCodes,
                )
              : null}
            uiHelpHintsEnabled={uiHelpHintsEnabled}
          />

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              pendingLabel="Guardando perfil..."
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm`}
            >
              Guardar perfil y aplicar hacia adelante
            </SubmitButton>
          </div>
        </div>

        <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Perfil activo</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--color-muted)]">
              <p>Version: v{activeBusinessProfile?.versionNo ?? 0}</p>
              <p>Fuente: {activeBusinessProfile?.source ?? "Sin definir"}</p>
              <p>Actividad principal: {activeBusinessProfile?.primaryActivityCode ?? "Sin definir"}</p>
              <p>Secundarias: {activeBusinessProfile?.secondaryActivityCodes.length ?? 0}</p>
              <p>Rasgos activos: {activeBusinessProfile?.selectedTraits.length ?? 0}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Aplicacion vigente</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--color-muted)]">
              <p>Modo: {formatApplicationMode(activePresetApplication?.applicationMode)}</p>
              <p>Base: {activePresetApplication?.basePresetCode ?? "Sin definir"}</p>
              <p>
                Overlays: {activePresetApplication?.overlayCodes.length
                  ? activePresetApplication.overlayCodes.join(", ")
                  : "Sin overlays"}
              </p>
            </div>
            {explanationReasons.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Motivos guardados
                </p>
                <div className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--color-muted)]">
                  {explanationReasons.map((reason) => (
                    <p key={reason}>- {reason}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {explanationImpacts.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Impactos visibles
                </p>
                <div className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--color-muted)]">
                  {explanationImpacts.map((impact) => (
                    <p key={impact}>- {impact}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm leading-6 text-[color:var(--color-muted)] md:col-span-2 xl:col-span-1">
            Cambiar actividad, rasgos o preset recalcula sugerencias hacia adelante. No reescribe journals historicos ni documentos cerrados.
          </div>

          <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-1">
            <LoadingLink
              href={`/app/o/${slug}/imports?focus=chart_of_accounts_import`}
              pendingLabel="Abriendo importaciones..."
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
            >
              Abrir importaciones avanzadas
            </LoadingLink>
          </div>
        </aside>
      </div>
    </form>
  );
}
