"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityCodeSearch } from "@/components/onboarding/activity-code-search";
import { PresetAlternativeCard } from "@/components/onboarding/preset-alternative-card";
import { PresetRecommendationCard } from "@/components/onboarding/preset-recommendation-card";
import { SecondaryActivitiesSelector } from "@/components/onboarding/secondary-activities-selector";
import { TraitChecklist } from "@/components/onboarding/trait-checklist";
import { HelpHint } from "@/components/ui/help-hint";
import type { BusinessProfileInput } from "@/modules/organizations/activity-types";
import { getActivityByCode } from "@/modules/organizations/activity-catalog";
import { getSuggestedActivitiesFromText } from "@/modules/organizations/activity-search";
import { buildPresetRecommendation } from "@/modules/accounting/presets/recommendation-engine";

export type PlanSetupMode =
  | "recommended"
  | "alternative"
  | "external_import"
  | "minimal_temp_only";

type BusinessProfileConfiguratorProps = {
  initialProfile?: Partial<BusinessProfileInput>;
  initialPlanSetupMode?: PlanSetupMode;
  initialSelectedPresetCompositionCode?: string | null;
  uiHelpHintsEnabled?: boolean;
  fieldErrors?: {
    primaryActivityCode?: string;
    secondaryActivityCodes?: string;
    selectedTraits?: string;
    shortBusinessDescription?: string;
    planSetupMode?: string;
    selectedPresetComposition?: string;
  };
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function serializeJson(value: string[]) {
  return JSON.stringify(value);
}

function describePlanMode(planSetupMode: PlanSetupMode) {
  switch (planSetupMode) {
    case "alternative":
      return "Aplicaremos una alternativa cercana, manteniendo starter accounts y cuentas temporales disponibles.";
    case "external_import":
      return "La organizacion queda operable con minimo + temporales y podras importar tu plan desde planilla enseguida.";
    case "minimal_temp_only":
      return "Arrancas con una estructura minima, TEMP-* y procesamiento activo sin definir el plan final hoy.";
    default:
      return "Aplicaremos la recomendacion principal y, ademas, mantendremos cuentas tecnicas y temporales para no bloquear el flujo.";
  }
}

export function BusinessProfileConfigurator({
  initialProfile,
  initialPlanSetupMode = "recommended",
  initialSelectedPresetCompositionCode,
  uiHelpHintsEnabled = true,
  fieldErrors,
}: BusinessProfileConfiguratorProps) {
  const [primaryActivityCode, setPrimaryActivityCode] = useState(
    initialProfile?.primaryActivityCode ?? "",
  );
  const [secondaryActivityCodes, setSecondaryActivityCodes] = useState(
    unique(initialProfile?.secondaryActivityCodes ?? []),
  );
  const [selectedTraits, setSelectedTraits] = useState(
    unique(initialProfile?.selectedTraits ?? []),
  );
  const [shortBusinessDescription, setShortBusinessDescription] = useState(
    initialProfile?.shortDescription ?? "",
  );
  const recommendation = useMemo(
    () =>
      buildPresetRecommendation({
        primaryActivityCode,
        secondaryActivityCodes,
        selectedTraits,
        shortDescription: shortBusinessDescription,
      }),
    [primaryActivityCode, secondaryActivityCodes, selectedTraits, shortBusinessDescription],
  );
  const selectableCompositions = useMemo(
    () => [recommendation.recommended, ...recommendation.alternatives],
    [recommendation],
  );
  const [planSetupMode, setPlanSetupMode] = useState<PlanSetupMode>(initialPlanSetupMode);
  const [selectedPresetCompositionCode, setSelectedPresetCompositionCode] = useState(
    initialSelectedPresetCompositionCode ?? recommendation.recommended.code,
  );
  const textSuggestions = useMemo(
    () =>
      shortBusinessDescription.trim()
        ? getSuggestedActivitiesFromText(shortBusinessDescription, 3)
        : [],
    [shortBusinessDescription],
  );
  const selectedPrimaryActivity = getActivityByCode(primaryActivityCode);

  useEffect(() => {
    const codes = new Set(selectableCompositions.map((composition) => composition.code));

    if (!codes.has(selectedPresetCompositionCode)) {
      setSelectedPresetCompositionCode(recommendation.recommended.code);
      if (planSetupMode === "alternative") {
        setPlanSetupMode("recommended");
      }
    }
  }, [planSetupMode, recommendation.recommended.code, selectableCompositions, selectedPresetCompositionCode]);

  function chooseRecommended() {
    setPlanSetupMode("recommended");
    setSelectedPresetCompositionCode(recommendation.recommended.code);
  }

  function chooseAlternative(code: string) {
    setPlanSetupMode("alternative");
    setSelectedPresetCompositionCode(code);
  }

  return (
    <div className="space-y-8">
      <input type="hidden" name="primaryActivityCode" value={primaryActivityCode} />
      <input
        type="hidden"
        name="secondaryActivityCodes"
        value={serializeJson(secondaryActivityCodes)}
      />
      <input type="hidden" name="selectedTraits" value={serializeJson(selectedTraits)} />
      <input
        type="hidden"
        name="shortBusinessDescription"
        value={shortBusinessDescription}
      />
      <input type="hidden" name="planSetupMode" value={planSetupMode} />
      <input
        type="hidden"
        name="selectedPresetComposition"
        value={selectedPresetCompositionCode}
      />

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Actividad economica
          </p>
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
            Actividad principal y secundarias
          </h3>
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            Usamos la actividad principal como ancla del plan recomendado y las secundarias para sumar overlays sin inventar un plan distinto por cada empresa.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <ActivityCodeSearch
            label="Actividad principal"
            value={primaryActivityCode}
            onSelect={(code) => {
              setPrimaryActivityCode(code);
              setSecondaryActivityCodes((current) => current.filter((value) => value !== code));
            }}
            helpHintKey={uiHelpHintsEnabled ? "actividad_principal" : undefined}
            placeholder="Busca por codigo, rubro o palabra comun"
            error={fieldErrors?.primaryActivityCode}
            suggestedActivities={textSuggestions}
          />

          <div className="rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">Lectura actual del negocio</p>
              {uiHelpHintsEnabled ? (
                <HelpHint contentKey="actividad_principal" />
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-muted)]">
              {selectedPrimaryActivity
                ? `Tomamos ${selectedPrimaryActivity.title} como rubro principal y lo usamos para elegir la capa contable mas fuerte del plan sugerido.`
                : "Todavia no elegiste una actividad principal. Si ya describiste el negocio abajo, usaremos eso solo para sugerirte opciones, no para elegir por ti."}
            </p>
            {textSuggestions.length > 0 && !selectedPrimaryActivity ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Sugeridas por tu descripcion
                </p>
                <div className="flex flex-wrap gap-2">
                  {textSuggestions.map((activity) => (
                    <button
                      key={activity.code}
                      type="button"
                      onClick={() => {
                        setPrimaryActivityCode(activity.code);
                      }}
                      className="rounded-full border border-[color:var(--color-border)] bg-white/8 px-3 py-2 text-xs text-white transition hover:bg-white/14"
                    >
                      {activity.code} - {activity.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <SecondaryActivitiesSelector
          value={secondaryActivityCodes}
          primaryActivityCode={primaryActivityCode}
          onChange={setSecondaryActivityCodes}
          error={fieldErrors?.secondaryActivityCodes}
          helpHintKey={uiHelpHintsEnabled ? "actividades_secundarias" : undefined}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
              Rasgos operativos y fiscales
            </h3>
            {uiHelpHintsEnabled ? <HelpHint contentKey="rasgos_operativos" /> : null}
          </div>
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            Marca solo lo que hoy es real o material. Esto ajusta la recomendacion sin bloquear el onboarding.
          </p>
        </div>
        <TraitChecklist
          value={selectedTraits}
          onChange={setSelectedTraits}
        />
        {fieldErrors?.selectedTraits ? (
          <p className="text-sm text-amber-800">{fieldErrors.selectedTraits}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
            Descripcion corta opcional
          </h3>
          {uiHelpHintsEnabled ? <HelpHint contentKey="descripcion_negocio" /> : null}
        </div>
        <textarea
          value={shortBusinessDescription}
          onChange={(event) => {
            setShortBusinessDescription(event.target.value);
          }}
          rows={3}
          placeholder="Importamos equipos, vendemos repuestos y hacemos instalacion y mantenimiento en todo el pais."
          className="w-full rounded-3xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--color-accent)]"
        />
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          Este texto solo sirve para desempatar o sugerir actividades si estas dudando. Nunca autoaplica un plan por si solo.
        </p>
        {fieldErrors?.shortBusinessDescription ? (
          <p className="text-sm text-amber-800">{fieldErrors.shortBusinessDescription}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
            Recomendacion de plan
          </h3>
          {uiHelpHintsEnabled ? <HelpHint contentKey="plan_recomendado" /> : null}
        </div>
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          El sistema compone una base Uruguay con overlays por actividad y rasgos. Puedes aceptar la sugerencia, elegir una alternativa, importar tu plan o arrancar con minimo + temporales.
        </p>

        <PresetRecommendationCard
          composition={recommendation.recommended}
          decision={recommendation.explanation}
          isSelected={planSetupMode === "recommended"}
          scoreBreakdown={recommendation.scoreBreakdown}
          onSelect={chooseRecommended}
        />

        {recommendation.alternatives.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendation.alternatives.map((composition) => (
              <PresetAlternativeCard
                key={composition.code}
                composition={composition}
                isSelected={
                  planSetupMode === "alternative"
                  && selectedPresetCompositionCode === composition.code
                }
                onSelect={() => {
                  chooseAlternative(composition.code);
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setPlanSetupMode("external_import");
              setSelectedPresetCompositionCode(recommendation.recommended.code);
            }}
            className={`rounded-3xl border px-4 py-4 text-left transition ${
              planSetupMode === "external_import"
                ? "border-[rgba(124,157,255,0.45)] bg-[rgba(124,157,255,0.14)]"
                : "border-[color:var(--color-border)] bg-white/6 hover:bg-white/8"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Importar mi plan de cuentas</span>
              {uiHelpHintsEnabled ? <HelpHint contentKey="importar_plan_externo" /> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
              Deja la organizacion operable hoy y te lleva a completar el plan desde planilla sin callejon sin salida.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPlanSetupMode("minimal_temp_only");
              setSelectedPresetCompositionCode(recommendation.recommended.code);
            }}
            className={`rounded-3xl border px-4 py-4 text-left transition ${
              planSetupMode === "minimal_temp_only"
                ? "border-[rgba(124,157,255,0.45)] bg-[rgba(124,157,255,0.14)]"
                : "border-[color:var(--color-border)] bg-white/6 hover:bg-white/8"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Empezar con minimo + temporales</span>
              {uiHelpHintsEnabled ? <HelpHint contentKey="minimo_temporales" /> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
              Ideal si quieres arrancar ya y definir el plan fino mas adelante sin frenar documentos ni IVA.
            </p>
          </button>
        </div>

        <div className="rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4">
          <p className="text-sm font-semibold text-white">Decision actual</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {describePlanMode(planSetupMode)}
          </p>
        </div>

        {fieldErrors?.planSetupMode ? (
          <p className="text-sm text-amber-800">{fieldErrors.planSetupMode}</p>
        ) : null}
        {fieldErrors?.selectedPresetComposition ? (
          <p className="text-sm text-amber-800">{fieldErrors.selectedPresetComposition}</p>
        ) : null}
      </section>
    </div>
  );
}
