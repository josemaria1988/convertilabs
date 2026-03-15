import type { DecisionComment } from "@/modules/explanations/types";
import type { PresetComposition, PresetRecommendationResult } from "@/modules/accounting/presets/types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function buildPresetRecommendationDecisionComment(input: {
  recommended: PresetComposition;
  alternatives: PresetComposition[];
  summaryLines: string[];
}): DecisionComment {
  const impacts = unique(input.recommended.capabilities).slice(0, 4);

  return {
    title: `Plan recomendado: ${input.recommended.label}`,
    summary: input.recommended.description,
    reasons: unique(input.summaryLines.concat(input.recommended.reasons)).slice(0, 4),
    impacts: impacts.length > 0
      ? impacts
      : [
          "Deja una base operable para empezar sin inventar el plan desde cero.",
          "Mantiene compatibilidad con starter accounts y cuentas temporales para no bloquear documentos.",
        ],
    whatCanYouDo: [
      "Aceptar el plan recomendado y empezar con una estructura mas precisa.",
      "Elegir una alternativa cercana si prefieres una configuracion mas conservadora.",
      "Importar tu plan externo y seguir operando mientras tanto con cuentas temporales.",
      "Empezar con minimo + temporales si aun no quieres definir el plan final.",
    ],
    sourceLabel: "Reglas internas de Convertilabs alineadas a CIIU y rasgos operativos de Uruguay.",
    expertNotes: input.alternatives.length > 0
      ? input.alternatives.map((alternative) => `${alternative.label}: ${alternative.overlayCodes.join(", ") || "sin overlays"}`)
      : undefined,
  };
}

export function buildPresetApplicationComment(input: {
  recommendation: PresetRecommendationResult;
  applicationMode: string;
}): DecisionComment {
  const base = buildPresetRecommendationDecisionComment({
    recommended: input.recommendation.recommended,
    alternatives: input.recommendation.alternatives,
    summaryLines: [],
  });

  return {
    ...base,
    summary:
      input.applicationMode === "minimal_temp_only"
        ? "Se guardo el perfil de negocio y se mantuvo una base minima operable con cuentas temporales."
        : input.applicationMode === "external_import"
          ? "Se guardo el perfil de negocio y la organizacion queda lista para importar un plan externo cuando quieras."
          : base.summary,
  };
}
