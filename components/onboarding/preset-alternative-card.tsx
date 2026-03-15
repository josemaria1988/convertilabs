"use client";

import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import type { PresetComposition } from "@/modules/accounting/presets/types";

type PresetAlternativeCardProps = {
  composition: PresetComposition;
  isSelected: boolean;
  onSelect: () => void;
};

export function PresetAlternativeCard({
  composition,
  isSelected,
  onSelect,
}: PresetAlternativeCardProps) {
  return (
    <article
      className={`rounded-3xl border p-4 transition ${
        isSelected
          ? "border-[rgba(124,157,255,0.45)] bg-[rgba(124,157,255,0.14)]"
          : "border-[color:var(--color-border)] bg-white/6"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{composition.label}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {composition.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
        >
          {isSelected ? "Elegida" : "Elegir"}
        </button>
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
        Overlays
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        {composition.overlayCodes.length > 0 ? (
          composition.overlayCodes.map((overlayCode) => (
            <span
              key={overlayCode}
              className="rounded-full border border-[color:var(--color-border)] bg-white/8 px-2.5 py-1 text-white/85"
            >
              {overlayCode}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-[color:var(--color-border)] bg-white/8 px-2.5 py-1 text-white/85">
            Solo base general
          </span>
        )}
      </div>
    </article>
  );
}
