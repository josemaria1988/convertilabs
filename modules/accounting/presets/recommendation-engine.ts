import { composePresetComposition } from "@/modules/accounting/presets/compose-preset";
import type {
  ActivityCatalogEntry,
  BusinessProfileInput,
} from "@/modules/organizations/activity-types";
import {
  getActivityByCode,
  getActivityHierarchyCodes,
} from "@/modules/organizations/activity-catalog";
import { getSuggestedActivitiesFromText } from "@/modules/organizations/activity-search";
import { getOrganizationTraitByCode } from "@/modules/organizations/traits-catalog";
import { buildPresetRecommendationDecisionComment } from "@/modules/explanations/decision-comment-builder";
import type {
  PresetComposition,
  PresetRecommendationResult,
} from "@/modules/accounting/presets/types";

const basePresetCode = "UY_BASE_SA_GENERAL_V1";

type ActivityOverlayRule = {
  overlayCode: string;
  label: string;
  matchCodes: string[];
};

const activityOverlayRules: ActivityOverlayRule[] = [
  {
    overlayCode: "CIIU_46_WHOLESALE_EQUIPMENT_V1",
    label: "Comercio mayorista",
    matchCodes: ["46"],
  },
  {
    overlayCode: "CIIU_33_REPAIR_INSTALLATION_V1",
    label: "Servicios tecnicos",
    matchCodes: ["33", "4321"],
  },
  {
    overlayCode: "CIIU_47_RETAIL_V1",
    label: "Retail",
    matchCodes: ["47"],
  },
  {
    overlayCode: "CIIU_01_03_AGRO_V1",
    label: "Agro",
    matchCodes: ["01", "02", "03"],
  },
  {
    overlayCode: "CIIU_28_LIGHT_MANUFACTURING_V1",
    label: "Fabricacion liviana",
    matchCodes: ["28"],
  },
];

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function activityMatchesRule(activityCode: string, rule: ActivityOverlayRule) {
  const activity = getActivityByCode(activityCode);

  if (!activity || activity.isSpecialAnnex) {
    return false;
  }

  const hierarchyCodes = new Set(getActivityHierarchyCodes(activity.code));

  return rule.matchCodes.some((matchCode) => hierarchyCodes.has(matchCode));
}

function resolveActivityOverlayCode(activityCode: string) {
  return activityOverlayRules.find((rule) => activityMatchesRule(activityCode, rule))?.overlayCode ?? "";
}

function resolveActivityThemeLabel(activity: ActivityCatalogEntry | null) {
  if (!activity || activity.isSpecialAnnex) {
    return activity?.title ?? "";
  }

  return activityOverlayRules.find((rule) => activityMatchesRule(activity.code, rule))?.label
    ?? activity.title;
}

function resolveTraitOverlayCodes(traits: string[]) {
  return unique(traits.flatMap((trait) => {
    switch (trait) {
      case "imports_goods":
        return ["TRAIT_IMPORTER_V1", "TRAIT_MULTI_CURRENCY_V1"];
      case "exports_goods":
      case "exports_services":
      case "possible_vat_suspenso":
        return ["TRAIT_EXPORTER_V1", "TRAIT_MULTI_CURRENCY_V1"];
      case "mixed_vat_operations":
      case "vat_exempt_or_non_taxed_operations":
        return ["TRAIT_MIXED_VAT_V1"];
      case "multi_currency_operations":
        return ["TRAIT_MULTI_CURRENCY_V1"];
      case "recurring_service_contracts":
        return ["TRAIT_RECURRING_SERVICES_V1"];
      case "public_tenders":
        return ["TRAIT_PUBLIC_TENDERS_V1"];
      default:
        return [];
    }
  }));
}

function formatActivityLabel(activity: ActivityCatalogEntry | null) {
  if (!activity) {
    return "actividad no identificada";
  }

  const suffix = activity.requiresRefinement
    ? " (requiere refinamiento)"
    : activity.isSpecialAnnex
      ? " (caso especial DGI/019)"
      : "";

  return `${activity.displayCode} - ${activity.title}${suffix}`;
}

function buildCompositionLabel(input: {
  primaryActivity: ActivityCatalogEntry | null;
  secondaryActivities: ActivityCatalogEntry[];
  traits: string[];
}) {
  const parts: string[] = [];
  const primaryLabel = resolveActivityThemeLabel(input.primaryActivity);

  if (primaryLabel) {
    parts.push(primaryLabel);
  }

  if (input.secondaryActivities.some((activity) => resolveActivityThemeLabel(activity) === "Servicios tecnicos")) {
    parts.push("Servicios tecnicos");
  }

  if (input.traits.includes("imports_goods")) {
    parts.push("Importador");
  }

  if (input.traits.includes("exports_goods") || input.traits.includes("exports_services")) {
    parts.push("Exportador");
  }

  if (input.traits.includes("multi_currency_operations")) {
    parts.push("Multi-moneda");
  }

  if (input.traits.includes("mixed_vat_operations") || input.traits.includes("vat_exempt_or_non_taxed_operations")) {
    parts.push("IVA mixto");
  }

  return unique(parts).join(" + ") || "Base Uruguay";
}

function buildCapabilities(traits: string[], overlayCodes: string[]) {
  const capabilities: string[] = [];

  if (overlayCodes.includes("TRAIT_IMPORTER_V1")) {
    capabilities.push("Cuentas para proveedores del exterior, mercaderia en transito e IVA importacion.");
  }

  if (overlayCodes.includes("CIIU_33_REPAIR_INSTALLATION_V1")) {
    capabilities.push("Servicios de instalacion, mantenimiento tecnico y materiales aplicados a servicio.");
  }

  if (overlayCodes.includes("TRAIT_MULTI_CURRENCY_V1")) {
    capabilities.push("Multi-moneda con bancos USD y diferencia de cambio.");
  }

  if (overlayCodes.includes("TRAIT_MIXED_VAT_V1")) {
    capabilities.push("Seguimiento de IVA indirecto, no deducible y operativa mixta.");
  }

  if (traits.includes("public_tenders")) {
    capabilities.push("Cuentas para licitaciones, retenciones y organismos publicos.");
  }

  if (traits.includes("recurring_service_contracts")) {
    capabilities.push("Contratos recurrentes, abonos e ingresos diferidos.");
  }

  return capabilities;
}

function buildCompositionFromInput(
  input: BusinessProfileInput,
  overlayCodes: string[],
  primaryActivity: ActivityCatalogEntry | null,
  secondaryActivities: ActivityCatalogEntry[],
) {
  return composePresetComposition({
    basePresetCode,
    overlayCodes,
    label: buildCompositionLabel({
      primaryActivity,
      secondaryActivities,
      traits: input.selectedTraits,
    }),
    description: `Composicion recomendada para ${formatActivityLabel(primaryActivity)} con overlays por actividad y rasgos operativos.`,
    reasons: [
      `Actividad principal: ${formatActivityLabel(primaryActivity)}.`,
      ...secondaryActivities.slice(0, 2).map((activity) => `Actividad secundaria: ${formatActivityLabel(activity)}.`),
      ...input.selectedTraits.slice(0, 3).map((traitCode) => {
        const trait = getOrganizationTraitByCode(traitCode);
        return trait ? `Rasgo operativo: ${trait.label}.` : "";
      }),
    ],
    capabilities: buildCapabilities(input.selectedTraits, overlayCodes),
  });
}

function dedupeCompositions(compositions: PresetComposition[]) {
  const map = new Map<string, PresetComposition>();

  for (const composition of compositions) {
    map.set(composition.code, composition);
  }

  return Array.from(map.values());
}

export function buildPresetRecommendation(input: BusinessProfileInput): PresetRecommendationResult {
  const primaryActivity = getActivityByCode(input.primaryActivityCode);
  const secondaryActivities = unique(input.secondaryActivityCodes)
    .map((code) => getActivityByCode(code))
    .filter((activity): activity is ActivityCatalogEntry => Boolean(activity));
  const primaryOverlay = resolveActivityOverlayCode(input.primaryActivityCode);
  const secondaryOverlays = secondaryActivities
    .map((activity) => resolveActivityOverlayCode(activity.code))
    .filter(Boolean)
    .filter((code) => code !== primaryOverlay);
  const traitOverlays = resolveTraitOverlayCodes(input.selectedTraits);
  const recommendedOverlayCodes = unique([primaryOverlay, ...secondaryOverlays, ...traitOverlays]);
  const recommended = buildCompositionFromInput(
    input,
    recommendedOverlayCodes,
    primaryActivity,
    secondaryActivities,
  );

  const alternativeOverlayCodes = [
    unique([primaryOverlay, ...traitOverlays]),
    unique([primaryOverlay, ...secondaryOverlays]),
  ].filter((overlayCodes) => overlayCodes.length > 0);
  const alternatives = dedupeCompositions(
    alternativeOverlayCodes.map((overlayCodes) =>
      buildCompositionFromInput(
        input,
        overlayCodes,
        primaryActivity,
        secondaryActivities,
      )),
  ).filter((composition) => composition.code !== recommended.code).slice(0, 2);

  const textSuggestions = input.shortDescription
    ? getSuggestedActivitiesFromText(input.shortDescription, 3, { selectableOnly: true })
    : [];
  const explanation = buildPresetRecommendationDecisionComment({
    recommended,
    alternatives,
    summaryLines: textSuggestions.length > 0
      ? [`El texto libre sugiere ${textSuggestions.map((activity) => activity.title).join(", ")}.`]
      : [],
  });

  return {
    recommended,
    alternatives,
    explanation,
    scoreBreakdown: {
      primaryActivity: primaryOverlay ? 60 : 0,
      secondaryActivities: Math.min(secondaryOverlays.length * 10, 20),
      traits: Math.min(traitOverlays.length * 5, 20),
      textDescription: textSuggestions.length > 0 ? 5 : 0,
    },
  };
}
