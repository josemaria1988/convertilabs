import "server-only";

import { getOpenAIModelConfig } from "@/lib/env";
import { createStructuredOpenAIResponse } from "@/lib/llm/openai-responses";
import type { PresetAiActivityRecommendation } from "@/modules/accounting/presets/types";
import {
  getActivityByCode,
  getActivityChildren,
} from "@/modules/organizations/activity-catalog";
import { searchActivities } from "@/modules/organizations/activity-search";
import type { ActivityCatalogEntry, BusinessProfileInput } from "@/modules/organizations/activity-types";
import { getOrganizationTraitByCode } from "@/modules/organizations/traits-catalog";

const ACTIVITY_AI_SCHEMA_NAME = "convertilabs_ciiu_activity_selection";

const activitySelectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "selectedPrimaryActivityCode",
    "selectedSecondaryActivityCodes",
    "confidence",
    "rationale",
  ],
  properties: {
    selectedPrimaryActivityCode: {
      type: "string",
    },
    selectedSecondaryActivityCodes: {
      type: "array",
      items: {
        type: "string",
      },
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    rationale: {
      type: "string",
    },
  },
} as const;

type ActivityAiAttempt = {
  status: "completed" | "failed" | "skipped";
  modelCode: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  output: PresetAiActivityRecommendation | null;
  failureMessage: string | null;
};

function trimToNull(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeProfile(profile: BusinessProfileInput): BusinessProfileInput {
  const primaryActivityCode = profile.primaryActivityCode.trim();

  return {
    primaryActivityCode,
    secondaryActivityCodes: unique(profile.secondaryActivityCodes)
      .filter((code) => code !== primaryActivityCode),
    selectedTraits: unique(profile.selectedTraits),
    shortDescription: trimToNull(profile.shortDescription) ?? null,
  };
}

function pushSelectableCandidate(
  candidateMap: Map<string, ActivityCatalogEntry>,
  entry: ActivityCatalogEntry | null,
) {
  if (!entry) {
    return;
  }

  if (entry.isSelectable) {
    candidateMap.set(entry.code, entry);
    return;
  }

  for (const child of getActivityChildren(entry.code, {
    selectableOnly: true,
    includeSpecialAnnex: true,
    limit: 12,
  })) {
    candidateMap.set(child.code, child);
  }
}

function buildActivitySelectionCandidates(profile: BusinessProfileInput, limit = 18) {
  const normalizedProfile = normalizeProfile(profile);
  const candidateMap = new Map<string, ActivityCatalogEntry>();
  const manualSelections = [
    getActivityByCode(normalizedProfile.primaryActivityCode),
    ...normalizedProfile.secondaryActivityCodes.map((code) => getActivityByCode(code)),
  ];

  for (const entry of manualSelections) {
    pushSelectableCandidate(candidateMap, entry);
  }

  if (normalizedProfile.shortDescription) {
    for (const result of searchActivities(normalizedProfile.shortDescription, limit, {
      includeSpecialAnnex: true,
      selectableOnly: false,
    })) {
      pushSelectableCandidate(candidateMap, result);
    }
  }

  return Array.from(candidateMap.values()).slice(0, limit);
}

function buildCandidateSummary(entry: ActivityCatalogEntry) {
  return {
    code: entry.code,
    displayCode: entry.displayCode,
    title: entry.title,
    breadcrumb: entry.breadcrumbLabel,
    isSpecialAnnex: entry.isSpecialAnnex,
  };
}

function assertValidActivitySelection(
  value: unknown,
  candidateCodes: string[],
): asserts value is Omit<PresetAiActivityRecommendation, "candidateCodes"> {
  if (!value || typeof value !== "object") {
    throw new Error("La IA no devolvio una clasificacion CIIU estructurada.");
  }

  const parsed = value as Record<string, unknown>;
  const selectedPrimaryActivityCode = trimToNull(parsed.selectedPrimaryActivityCode as string | null);
  const selectedSecondaryActivityCodes = Array.isArray(parsed.selectedSecondaryActivityCodes)
    ? unique(parsed.selectedSecondaryActivityCodes.filter(
        (item): item is string => typeof item === "string",
      ))
    : [];
  const confidence = parsed.confidence;
  const rationale = trimToNull(parsed.rationale as string | null);

  if (!selectedPrimaryActivityCode || !candidateCodes.includes(selectedPrimaryActivityCode)) {
    throw new Error("La IA eligio una actividad principal fuera del set permitido.");
  }

  if (!selectedSecondaryActivityCodes.every((code) => candidateCodes.includes(code))) {
    throw new Error("La IA eligio actividades secundarias fuera del set permitido.");
  }

  if (selectedSecondaryActivityCodes.includes(selectedPrimaryActivityCode)) {
    throw new Error("La IA devolvio la actividad principal tambien como secundaria.");
  }

  if (selectedSecondaryActivityCodes.length > 5) {
    throw new Error("La IA devolvio demasiadas actividades secundarias.");
  }

  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error("La IA devolvio una confianza invalida para la clasificacion CIIU.");
  }

  if (!rationale) {
    throw new Error("La IA devolvio una explicacion vacia para la clasificacion CIIU.");
  }
}

export function applyActivityRecommendationToProfile(input: {
  profile: BusinessProfileInput;
  activityRecommendation: PresetAiActivityRecommendation | null;
}) {
  const normalizedProfile = normalizeProfile(input.profile);
  const activityRecommendation = input.activityRecommendation;

  if (!activityRecommendation) {
    return normalizedProfile;
  }

  return {
    primaryActivityCode: activityRecommendation.selectedPrimaryActivityCode,
    secondaryActivityCodes: unique(activityRecommendation.selectedSecondaryActivityCodes)
      .filter((code) => code !== activityRecommendation.selectedPrimaryActivityCode)
      .slice(0, 5),
    selectedTraits: normalizedProfile.selectedTraits,
    shortDescription: normalizedProfile.shortDescription,
  } satisfies BusinessProfileInput;
}

export async function resolveActivitySelectionWithAi(input: {
  profile: BusinessProfileInput;
}) {
  const normalizedProfile = normalizeProfile(input.profile);
  const modelCode = getOpenAIModelConfig().openAiRulesModel;
  const shortDescription = trimToNull(normalizedProfile.shortDescription);

  if (!shortDescription) {
    return {
      status: "skipped",
      modelCode,
      requestPayload: {},
      responsePayload: {},
      output: null,
      failureMessage: null,
    } satisfies ActivityAiAttempt;
  }

  const candidates = buildActivitySelectionCandidates(normalizedProfile, 20);
  const candidateCodes = candidates.map((candidate) => candidate.code);

  if (candidateCodes.length === 0) {
    return {
      status: "skipped",
      modelCode,
      requestPayload: {
        shortDescription,
        currentProfile: normalizedProfile,
      },
      responsePayload: {},
      output: null,
      failureMessage: null,
    } satisfies ActivityAiAttempt;
  }

  const systemPrompt = [
    "You are the Convertilabs CIIU Rev. 4 Uruguay classification assistant.",
    "You must choose exactly one primary activity from the provided candidates.",
    "You may choose up to 5 secondary activities from the same candidate set.",
    "You must not invent codes or return codes outside the candidate list.",
    "Prefer the most specific official subclase available.",
    "Return public-facing Spanish rationale only, not hidden reasoning.",
  ].join("\n");
  const userPrompt = JSON.stringify(
    {
      shortDescription,
      currentProfile: {
        primaryActivityCode: normalizedProfile.primaryActivityCode || null,
        secondaryActivityCodes: normalizedProfile.secondaryActivityCodes,
        selectedTraits: normalizedProfile.selectedTraits
          .map((code) => getOrganizationTraitByCode(code)?.label ?? code),
      },
      candidateActivities: candidates.map((candidate) => buildCandidateSummary(candidate)),
    },
    null,
    2,
  );

  if (!process.env.OPENAI_API_KEY) {
    return {
      status: "failed",
      modelCode,
      requestPayload: {
        systemPrompt,
        userPrompt,
        candidateCodes,
      },
      responsePayload: {},
      output: null,
      failureMessage: "La clasificacion CIIU por IA no esta disponible porque falta OPENAI_API_KEY.",
    } satisfies ActivityAiAttempt;
  }

  try {
    const response = await createStructuredOpenAIResponse<
      Omit<PresetAiActivityRecommendation, "candidateCodes">
    >({
      model: modelCode,
      schemaName: ACTIVITY_AI_SCHEMA_NAME,
      schema: activitySelectionJsonSchema,
      systemPrompt,
      userPrompt,
      metadata: {
        candidate_count: candidateCodes.length,
      },
    });

    assertValidActivitySelection(response.output, candidateCodes);

    return {
      status: "completed",
      modelCode,
      requestPayload: {
        systemPrompt,
        userPrompt,
        candidateCodes,
      },
      responsePayload: response.rawResponse,
      output: {
        ...response.output,
        selectedSecondaryActivityCodes: response.output.selectedSecondaryActivityCodes.slice(0, 5),
        candidateCodes,
      },
      failureMessage: null,
    } satisfies ActivityAiAttempt;
  } catch (error) {
    return {
      status: "failed",
      modelCode,
      requestPayload: {
        systemPrompt,
        userPrompt,
        candidateCodes,
      },
      responsePayload: {},
      output: null,
      failureMessage: error instanceof Error
        ? error.message
        : "La IA no pudo clasificar la actividad CIIU.",
    } satisfies ActivityAiAttempt;
  }
}
