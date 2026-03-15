import { getPresetBundleByCode } from "@/modules/accounting/presets/catalog";
import type { PresetBundle, PresetComposition } from "@/modules/accounting/presets/types";
import {
  mergePresetAccounts,
  mergePresetJournalTemplates,
  mergePresetTaxProfiles,
  mergePresetUiHints,
} from "@/modules/accounting/presets/validate-preset";

export function buildPresetCompositionCode(basePresetCode: string, overlayCodes: string[]) {
  return [basePresetCode, ...overlayCodes.slice().sort()].join("__");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function composePresetComposition(input: {
  basePresetCode: string;
  overlayCodes: string[];
  label?: string;
  description?: string;
  reasons?: string[];
  capabilities?: string[];
}) {
  const basePreset = getPresetBundleByCode(input.basePresetCode);

  if (!basePreset) {
    throw new Error("No se encontro el preset base solicitado.");
  }

  const overlays = unique(input.overlayCodes)
    .map((code) => getPresetBundleByCode(code))
    .filter((bundle): bundle is PresetBundle => Boolean(bundle));
  const bundles = [basePreset, ...overlays];

  const accounts = mergePresetAccounts(bundles);
  const journalTemplates = mergePresetJournalTemplates(bundles);
  const taxProfiles = mergePresetTaxProfiles(bundles);
  const uiHints = mergePresetUiHints(bundles);
  const overlayLabels = overlays.map((bundle) => bundle.label.replace(/^Overlay /i, "").trim());
  const label =
    input.label
    ?? (overlayLabels.length > 0
      ? overlayLabels.join(" + ")
      : basePreset.label);
  const description =
    input.description
    ?? `Composicion ${label} sobre ${basePreset.label.toLowerCase()}.`;

  return {
    code: buildPresetCompositionCode(basePreset.code, overlays.map((bundle) => bundle.code)),
    label,
    description,
    basePresetCode: basePreset.code,
    overlayCodes: overlays.map((bundle) => bundle.code),
    accounts,
    journalTemplates,
    taxProfiles,
    uiHints,
    reasons: input.reasons ?? bundles.map((bundle) => bundle.description).slice(0, 4),
    capabilities: input.capabilities ?? unique(overlays.map((bundle) => bundle.description)).slice(0, 4),
  } satisfies PresetComposition;
}
