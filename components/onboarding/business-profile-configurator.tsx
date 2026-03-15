"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { ActivityCodeSearch } from "@/components/onboarding/activity-code-search";
import { PresetAiRecommendationCard } from "@/components/onboarding/preset-ai-recommendation-card";
import { PresetAlternativeCard } from "@/components/onboarding/preset-alternative-card";
import { PresetRecommendationCard } from "@/components/onboarding/preset-recommendation-card";
import { SecondaryActivitiesSelector } from "@/components/onboarding/secondary-activities-selector";
import { TraitChecklist } from "@/components/onboarding/trait-checklist";
import { HelpHint } from "@/components/ui/help-hint";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import type {
  PresetAiRecommendationOutput,
  PresetAiRouteResponse,
  PresetAiRunSummary,
  PresetComposition,
  PresetHybridRecommendation,
} from "@/modules/accounting/presets/types";
import type { DecisionComment } from "@/modules/explanations/types";
import type { BusinessProfileInput } from "@/modules/organizations/activity-types";
import { getActivityByCode } from "@/modules/organizations/activity-catalog";
import { getSuggestedActivitiesFromText } from "@/modules/organizations/activity-search";
import { buildPresetRecommendation } from "@/modules/accounting/presets/recommendation-engine";

export type PlanSetupMode =
  | "recommended"
  | "alternative"
  | "external_import"
  | "minimal_temp_only"
  | "hybrid_ai_recommended";

type BusinessProfileConfiguratorProps = {
  initialProfile?: Partial<BusinessProfileInput>;
  initialPlanSetupMode?: PlanSetupMode;
  initialSelectedPresetCompositionCode?: string | null;
  initialPresetAiRun?: PresetAiRunSummary | null;
  presetAiRecommendationEnabled?: boolean;
  scope?: "onboarding" | "settings";
  organizationSlug?: string | null;
  organizationContext?: {
    organizationName?: string | null;
    legalEntityType?: string | null;
    taxId?: string | null;
    taxRegimeCode?: string | null;
    vatRegime?: string | null;
    dgiGroup?: string | null;
    cfeStatus?: string | null;
  };
  onReadyToSaveHighlightChange?: (isReady: boolean) => void;
  uiHelpHintsEnabled?: boolean;
  fieldErrors?: {
    primaryActivityCode?: string;
    secondaryActivityCodes?: string;
    selectedTraits?: string;
    shortBusinessDescription?: string;
    planSetupMode?: string;
    selectedPresetComposition?: string;
    aiRunId?: string;
  };
};

type AiState = {
  runId: string | null;
  inputHash: string | null;
  aiRecommendation: PresetAiRecommendationOutput | null;
  hybridRecommendation: PresetHybridRecommendation | null;
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
    case "hybrid_ai_recommended":
      return "La IA ya dejo una composicion validada dentro del catalogo y el formulario quedo listo para guardar y aplicar.";
    default:
      return "Aplicaremos la recomendacion principal y, ademas, mantendremos cuentas tecnicas y temporales para no bloquear el flujo.";
  }
}

function findCompositionByCode(
  compositions: PresetComposition[],
  compositionCode: string | null | undefined,
) {
  return compositions.find((composition) => composition.code === compositionCode) ?? null;
}

function buildClientHybridDecision(input: {
  composition: PresetComposition;
  aiRecommendation: PresetAiRecommendationOutput;
  source: PresetHybridRecommendation["source"];
}) {
  const confidenceLabel =
    typeof input.aiRecommendation.confidence === "number"
      ? `${Math.round(input.aiRecommendation.confidence * 100)}%`
      : "sin confianza";

  return {
    title: `Recomendacion IA: ${input.composition.label}`,
    summary: input.aiRecommendation.targetAudienceFit,
    reasons: [
      input.aiRecommendation.targetAudienceFit,
      input.aiRecommendation.keyBenefit,
      `Confianza estimada: ${confidenceLabel}.`,
    ],
    impacts: [
      input.aiRecommendation.keyBenefit,
      input.aiRecommendation.setupTip,
      ...input.composition.capabilities.slice(0, 2),
    ].slice(0, 4),
    whatCanYouDo: [
      input.source === "ai_low_confidence"
        ? "Puedes mantener la recomendacion por reglas o revisar esta sugerencia como segunda opinion."
        : "El formulario ya quedo preparado para guardar y aplicar esta composicion.",
      input.aiRecommendation.setupTip,
    ],
    sourceLabel: "Reglas internas + OpenAI estructurado.",
    expertNotes: input.aiRecommendation.observations.map(
      (observation) => `${observation.title}: ${observation.shortLabel}`,
    ),
  } satisfies DecisionComment;
}

function buildInitialAiState(input: {
  recommendation: ReturnType<typeof buildPresetRecommendation>;
  initialPresetAiRun: PresetAiRunSummary | null | undefined;
  initialPlanSetupMode: PlanSetupMode;
}) {
  const run = input.initialPresetAiRun;

  if (!run?.selectedCompositionCode || !run.targetAudienceFit || !run.keyBenefit || !run.setupTip) {
    return {
      runId: null,
      inputHash: null,
      aiRecommendation: null,
      hybridRecommendation: null,
    } satisfies AiState;
  }

  const aiRecommendation = {
    selectedCompositionCode: run.selectedCompositionCode,
    confidence: typeof run.confidence === "number" ? run.confidence : 0,
    targetAudienceFit: run.targetAudienceFit,
    keyBenefit: run.keyBenefit,
    setupTip: run.setupTip,
    observations: run.observations,
    suggestedCostCenters: run.suggestedCostCenters,
  } satisfies PresetAiRecommendationOutput;
  const candidateCompositions = [
    input.recommendation.recommended,
    ...input.recommendation.alternatives,
  ];
  const aiComposition = findCompositionByCode(candidateCompositions, run.selectedCompositionCode);

  if (!aiComposition) {
    return {
      runId: run.id,
      inputHash: run.inputHash,
      aiRecommendation,
      hybridRecommendation: null,
    } satisfies AiState;
  }

  const source: PresetHybridRecommendation["source"] =
    input.initialPlanSetupMode === "hybrid_ai_recommended"
      ? run.selectedCompositionCode === input.recommendation.recommended.code
        ? "rules_confirmed_by_ai"
        : "hybrid_ai_recommended"
      : "ai_low_confidence";
  const effectiveComposition =
    input.initialPlanSetupMode === "hybrid_ai_recommended"
      ? aiComposition
      : input.recommendation.recommended;

  return {
    runId: run.id,
    inputHash: run.inputHash,
    aiRecommendation,
    hybridRecommendation: {
      source,
      shouldAutoSelect: input.initialPlanSetupMode === "hybrid_ai_recommended",
      composition: effectiveComposition,
      selectedCompositionCode: effectiveComposition.code,
      confidence: run.confidence,
      decision: buildClientHybridDecision({
        composition: aiComposition,
        aiRecommendation,
        source,
      }),
      assistantLetterMarkdown: run.assistantLetterMarkdown,
      observations: run.observations,
      suggestedCostCenters: run.suggestedCostCenters,
      runId: run.id,
      inputHash: run.inputHash,
      costCenterDraftSaved: run.costCenterDraftSaved,
    },
  } satisfies AiState;
}

export function BusinessProfileConfigurator({
  initialProfile,
  initialPlanSetupMode = "recommended",
  initialSelectedPresetCompositionCode,
  initialPresetAiRun,
  presetAiRecommendationEnabled = false,
  scope = "onboarding",
  organizationSlug,
  organizationContext,
  onReadyToSaveHighlightChange,
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
  const deferredShortBusinessDescription = useDeferredValue(shortBusinessDescription);
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
  const profileSignature = useMemo(
    () =>
      JSON.stringify({
        scope,
        organizationSlug,
        organizationContext,
        primaryActivityCode,
        secondaryActivityCodes,
        selectedTraits,
        shortBusinessDescription,
      }),
    [
      organizationContext,
      organizationSlug,
      primaryActivityCode,
      scope,
      secondaryActivityCodes,
      selectedTraits,
      shortBusinessDescription,
    ],
  );
  const [aiState, setAiState] = useState<AiState>(() =>
    buildInitialAiState({
      recommendation,
      initialPresetAiRun,
      initialPlanSetupMode,
    }),
  );
  const [aiProfileSignature, setAiProfileSignature] = useState<string | null>(
    initialPresetAiRun ? profileSignature : null,
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [isConsultingAi, startConsultingAi] = useTransition();
  const [isSavingDraft, startSavingDraft] = useTransition();
  const textSuggestions = useMemo(
    () =>
      deferredShortBusinessDescription.trim()
        ? getSuggestedActivitiesFromText(deferredShortBusinessDescription, 3)
        : [],
    [deferredShortBusinessDescription],
  );
  const selectedPrimaryActivity = getActivityByCode(primaryActivityCode);
  const aiSuggestedComposition = aiState.aiRecommendation
    ? findCompositionByCode(selectableCompositions, aiState.aiRecommendation.selectedCompositionCode)
    : null;

  useEffect(() => {
    const codes = new Set(selectableCompositions.map((composition) => composition.code));

    if (!codes.has(selectedPresetCompositionCode)) {
      setSelectedPresetCompositionCode(recommendation.recommended.code);
      if (planSetupMode === "alternative" || planSetupMode === "hybrid_ai_recommended") {
        setPlanSetupMode("recommended");
      }
    }
  }, [planSetupMode, recommendation.recommended.code, selectableCompositions, selectedPresetCompositionCode]);

  useEffect(() => {
    if (!aiProfileSignature || aiProfileSignature === profileSignature) {
      return;
    }

    setAiState({
      runId: null,
      inputHash: null,
      aiRecommendation: null,
      hybridRecommendation: null,
    });
    setAiProfileSignature(null);
    setAiError(null);

    if (planSetupMode === "hybrid_ai_recommended") {
      setPlanSetupMode("recommended");
      setSelectedPresetCompositionCode(recommendation.recommended.code);
    }
  }, [aiProfileSignature, planSetupMode, profileSignature, recommendation.recommended.code]);

  useEffect(() => {
    onReadyToSaveHighlightChange?.(
      planSetupMode === "hybrid_ai_recommended"
      && Boolean(aiState.hybridRecommendation?.shouldAutoSelect),
    );
  }, [aiState.hybridRecommendation?.shouldAutoSelect, onReadyToSaveHighlightChange, planSetupMode]);

  function chooseRecommended() {
    setPlanSetupMode("recommended");
    setSelectedPresetCompositionCode(recommendation.recommended.code);
  }

  function chooseAlternative(code: string) {
    setPlanSetupMode("alternative");
    setSelectedPresetCompositionCode(code);
  }

  function handleAiConsult() {
    setAiError(null);

    startConsultingAi(async () => {
      const response = await fetch("/api/preset-ai-recommendation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope,
          slug: organizationSlug,
          organizationContext,
          profile: {
            primaryActivityCode,
            secondaryActivityCodes,
            selectedTraits,
            shortDescription: shortBusinessDescription,
          },
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload) {
        setAiError(
          typeof payload?.message === "string"
            ? payload.message
            : "No pudimos consultar la recomendacion IA en este momento.",
        );
        return;
      }

      const data = payload as PresetAiRouteResponse;

      setAiState({
        runId: data.runId,
        inputHash: data.inputHash,
        aiRecommendation: data.aiRecommendation,
        hybridRecommendation: data.hybridRecommendation,
      });
      setAiProfileSignature(profileSignature);

      if (data.hybridRecommendation.shouldAutoSelect) {
        setPlanSetupMode("hybrid_ai_recommended");
        setSelectedPresetCompositionCode(data.hybridRecommendation.selectedCompositionCode);
      } else if (planSetupMode === "hybrid_ai_recommended") {
        setPlanSetupMode("recommended");
        setSelectedPresetCompositionCode(recommendation.recommended.code);
      }
    });
  }

  function handleSaveCostCenterDraft() {
    if (!aiState.runId) {
      return;
    }

    setAiError(null);

    startSavingDraft(async () => {
      const response = await fetch("/api/preset-ai-recommendation/cost-center-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: aiState.runId,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.run) {
        setAiError(
          typeof payload?.message === "string"
            ? payload.message
            : "No pudimos guardar el borrador de centros de costo.",
        );
        return;
      }

      setAiState((current) => ({
        ...current,
        hybridRecommendation: current.hybridRecommendation
          ? {
              ...current.hybridRecommendation,
              costCenterDraftSaved: true,
            }
          : current.hybridRecommendation,
      }));
    });
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
      <input type="hidden" name="aiRunId" value={aiState.runId ?? ""} />

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
                Recomendacion de plan
              </h3>
              {uiHelpHintsEnabled ? <HelpHint contentKey="plan_recomendado" /> : null}
            </div>
            <p className="text-sm leading-6 text-[color:var(--color-muted)]">
              El sistema compone una base Uruguay con overlays por actividad y rasgos. Puedes aceptar la sugerencia, elegir una alternativa, importar tu plan o arrancar con minimo + temporales.
            </p>
          </div>

          {presetAiRecommendationEnabled ? (
            <button
              type="button"
              onClick={handleAiConsult}
              disabled={isConsultingAi}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
            >
              {isConsultingAi ? "Consultando IA..." : "Consultar IA"}
            </button>
          ) : (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm text-[color:var(--color-muted)]">
              La recomendacion IA esta desactivada en este entorno.
            </div>
          )}
        </div>

        {aiError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {aiError}
          </div>
        ) : null}
        {fieldErrors?.aiRunId ? (
          <p className="text-sm text-amber-800">{fieldErrors.aiRunId}</p>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Recomendacion por reglas
          </p>
          <PresetRecommendationCard
            composition={recommendation.recommended}
            decision={recommendation.explanation}
            isSelected={planSetupMode === "recommended"}
            badgeLabel="Reglas"
            scoreBreakdown={recommendation.scoreBreakdown}
            onSelect={chooseRecommended}
          />
        </div>

        {aiState.hybridRecommendation && aiState.aiRecommendation ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-100">
              Recomendacion hibrida IA
            </p>
            <PresetAiRecommendationCard
              suggestedComposition={aiSuggestedComposition}
              hybridRecommendation={aiState.hybridRecommendation}
              aiRecommendation={aiState.aiRecommendation}
              isSavingDraft={isSavingDraft}
              onSaveDraft={handleSaveCostCenterDraft}
            />
          </div>
        ) : null}

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

        <div className={`rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4 transition ${
          planSetupMode === "hybrid_ai_recommended"
            ? "shadow-[0_0_0_1px_rgba(124,157,255,0.3),0_14px_40px_rgba(41,63,117,0.18)]"
            : ""
        }`}>
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
