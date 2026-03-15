"use client";

import { DecisionWhyPopover } from "@/components/onboarding/decision-why-popover";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import type { DecisionComment } from "@/modules/explanations/types";
import type { PresetComposition } from "@/modules/accounting/presets/types";

type PresetRecommendationCardProps = {
  composition: PresetComposition;
  decision: DecisionComment;
  isSelected: boolean;
  badgeLabel?: string;
  scoreBreakdown: {
    primaryActivity: number;
    secondaryActivities: number;
    traits: number;
    textDescription: number;
  };
  onSelect: () => void;
};

export function PresetRecommendationCard({
  composition,
  decision,
  isSelected,
  badgeLabel = "Recomendado",
  scoreBreakdown,
  onSelect,
}: PresetRecommendationCardProps) {
  return (
    <article
      className={`rounded-3xl border p-5 transition ${
        isSelected
          ? "border-[rgba(124,157,255,0.45)] bg-[rgba(124,157,255,0.14)]"
          : "border-[color:var(--color-border)] bg-white/6"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {badgeLabel}
            </span>
            <DecisionWhyPopover decision={decision} />
          </div>
          <h4 className="text-lg font-semibold text-white">{composition.label}</h4>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--color-muted)]">
            {composition.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          className={`${buttonBaseClassName} ${
            isSelected ? buttonPrimaryChromeClassName : buttonSecondaryChromeClassName
          } px-4 py-2 text-sm`}
        >
          {isSelected ? "Plan elegido" : "Usar este plan"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
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
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
          <p className="text-sm font-semibold text-white">Por que se recomendo</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {composition.reasons.slice(0, 4).map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
          <p className="text-sm font-semibold text-white">Que agrega</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {composition.capabilities.slice(0, 4).map((capability) => (
              <li key={capability}>- {capability}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm">
          <p className="font-medium text-white">Actividad principal</p>
          <p className="mt-1 text-[color:var(--color-muted)]">{scoreBreakdown.primaryActivity}%</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm">
          <p className="font-medium text-white">Secundarias</p>
          <p className="mt-1 text-[color:var(--color-muted)]">{scoreBreakdown.secondaryActivities}%</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm">
          <p className="font-medium text-white">Rasgos</p>
          <p className="mt-1 text-[color:var(--color-muted)]">{scoreBreakdown.traits}%</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm">
          <p className="font-medium text-white">Texto corto</p>
          <p className="mt-1 text-[color:var(--color-muted)]">{scoreBreakdown.textDescription}%</p>
        </div>
      </div>
    </article>
  );
}
