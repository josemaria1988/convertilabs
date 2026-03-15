"use client";

import ReactMarkdown from "react-markdown";
import { DecisionWhyPopover } from "@/components/onboarding/decision-why-popover";
import { HelpHint } from "@/components/ui/help-hint";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import type {
  PresetAiRecommendationOutput,
  PresetComposition,
  PresetHybridRecommendation,
} from "@/modules/accounting/presets/types";

type PresetAiRecommendationCardProps = {
  suggestedComposition: PresetComposition | null;
  hybridRecommendation: PresetHybridRecommendation;
  aiRecommendation: PresetAiRecommendationOutput;
  isSavingDraft: boolean;
  onSaveDraft: () => void;
};

function formatConfidence(value: number | null) {
  if (typeof value !== "number") {
    return "Sin confianza";
  }

  return `${Math.round(value * 100)}%`;
}

function resolveBadgeLabel(source: PresetHybridRecommendation["source"]) {
  switch (source) {
    case "rules_confirmed_by_ai":
      return "Reglas confirmadas por IA";
    case "hybrid_ai_recommended":
      return "IA aplicada";
    case "ai_low_confidence":
      return "Segunda opinion IA";
    default:
      return "IA";
  }
}

export function PresetAiRecommendationCard({
  suggestedComposition,
  hybridRecommendation,
  aiRecommendation,
  isSavingDraft,
  onSaveDraft,
}: PresetAiRecommendationCardProps) {
  const composition = suggestedComposition ?? hybridRecommendation.composition;

  return (
    <article className="rounded-3xl border border-[rgba(124,157,255,0.45)] bg-[linear-gradient(180deg,rgba(71,92,140,0.22),rgba(42,53,82,0.26))] p-5 shadow-[0_14px_40px_rgba(14,19,34,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
              {resolveBadgeLabel(hybridRecommendation.source)}
            </span>
            <DecisionWhyPopover decision={hybridRecommendation.decision} />
          </div>
          <h4 className="text-lg font-semibold text-white">
            {composition?.label ?? "Sugerencia IA sin composicion utilizable"}
          </h4>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--color-muted)]">
            {composition?.description ?? "La IA explico el caso, pero no pudimos mapearlo a una composicion vigente."}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-4 py-3 text-sm">
          <p className="font-medium text-white">Confianza IA</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatConfidence(hybridRecommendation.confidence)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        {composition ? (
          <>
            <span className="rounded-full border border-[color:var(--color-border)] bg-white/8 px-2.5 py-1 text-white/85">
              Base: {composition.basePresetCode}
            </span>
            {composition.overlayCodes.map((overlayCode) => (
              <span
                key={overlayCode}
                className="rounded-full border border-[color:var(--color-border)] bg-white/8 px-2.5 py-1 text-white/85"
              >
                {overlayCode}
              </span>
            ))}
          </>
        ) : null}
      </div>

      {hybridRecommendation.observations.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
          <p className="text-sm font-semibold text-white">Observaciones de la IA</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {hybridRecommendation.observations.map((observation) => (
              <span
                key={observation.key}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white/8 px-3 py-2 text-xs text-white/85"
              >
                <span>{observation.title}</span>
                <HelpHint content={observation} />
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {hybridRecommendation.assistantLetterMarkdown ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-[rgba(12,18,34,0.34)] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-100">
            Carta del asistente
          </p>
          <div className="prose prose-invert mt-4 max-w-none text-sm leading-7">
            <ReactMarkdown>{hybridRecommendation.assistantLetterMarkdown}</ReactMarkdown>
          </div>
        </div>
      ) : null}

      {aiRecommendation.suggestedCostCenters.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Borrador de centros de costo</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">
                La IA no crea entidades reales todavia. Puedes guardar este borrador para retomarlo en la proxima iteracion.
              </p>
            </div>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={hybridRecommendation.costCenterDraftSaved || isSavingDraft}
              className={`${buttonBaseClassName} ${
                hybridRecommendation.costCenterDraftSaved
                  ? buttonSecondaryChromeClassName
                  : buttonPrimaryChromeClassName
              } px-4 py-2 text-sm`}
            >
              {hybridRecommendation.costCenterDraftSaved
                ? "Borrador guardado"
                : isSavingDraft
                  ? "Guardando..."
                  : "Guardar borrador"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {aiRecommendation.suggestedCostCenters.map((costCenter) => (
              <div
                key={`${costCenter.code}-${costCenter.label}`}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm"
              >
                <p className="font-medium text-white">
                  {costCenter.label}
                  <span className="ml-2 text-xs text-[color:var(--color-muted)]">
                    {costCenter.code}
                  </span>
                </p>
                <p className="mt-2 leading-6 text-[color:var(--color-muted)]">
                  {costCenter.rationale}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Agrupacion sugerida: {costCenter.groupingHint}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
