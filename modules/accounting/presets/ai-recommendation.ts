import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIModelConfig } from "@/lib/env";
import { createStructuredOpenAIResponse } from "@/lib/llm/openai-responses";
import type {
  DecisionComment,
} from "@/modules/explanations/types";
import type { BusinessProfileInput } from "@/modules/organizations/activity-types";
import { getActivityByCode } from "@/modules/organizations/activity-catalog";
import { getOrganizationTraitByCode } from "@/modules/organizations/traits-catalog";
import type {
  PresetAiObservation,
  PresetAiRecommendationOutput,
  PresetAiRouteResponse,
  PresetAiRunSummary,
  PresetAiSuggestedCostCenter,
  PresetApplicationMode,
  PresetComposition,
  PresetHybridRecommendation,
  PresetRecommendationResult,
} from "@/modules/accounting/presets/types";

const PRESET_AI_SCHEMA_NAME = "convertilabs_preset_ai_recommendation";
const PRESET_AI_CONFIDENCE_THRESHOLD = 0.75;
const PRESET_AI_USER_LIMIT = 5;
const PRESET_AI_IP_LIMIT = 12;
const PRESET_AI_RATE_WINDOW_MINUTES = 10;

const presetAiRecommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "selectedCompositionCode",
    "confidence",
    "targetAudienceFit",
    "keyBenefit",
    "setupTip",
    "observations",
    "suggestedCostCenters",
  ],
  properties: {
    selectedCompositionCode: {
      type: "string",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    targetAudienceFit: {
      type: "string",
    },
    keyBenefit: {
      type: "string",
    },
    setupTip: {
      type: "string",
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "title",
          "shortLabel",
          "whatIsIt",
          "whyItMatters",
          "impact",
          "whatCanYouDo",
        ],
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          shortLabel: { type: "string" },
          whatIsIt: { type: "string" },
          whyItMatters: { type: "string" },
          impact: { type: "string" },
          whatCanYouDo: { type: "string" },
          sourceLabel: { type: ["string", "null"] },
          expertNotes: {
            type: "array",
            items: {
              type: "string",
            },
          },
          suggestedCode: {
            type: ["string", "null"],
          },
        },
      },
    },
    suggestedCostCenters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "label", "rationale", "groupingHint"],
        properties: {
          code: { type: "string" },
          label: { type: "string" },
          rationale: { type: "string" },
          groupingHint: { type: "string" },
        },
      },
    },
  },
} as const;

type PresetAiOrganizationContext = {
  organizationId?: string | null;
  organizationName?: string | null;
  slug?: string | null;
  legalEntityType?: string | null;
  taxId?: string | null;
  taxRegimeCode?: string | null;
  vatRegime?: string | null;
  dgiGroup?: string | null;
  cfeStatus?: string | null;
};

type PresetAiRequestOrigin = "onboarding" | "settings";

type PresetAiInputSnapshot = {
  scope: PresetAiRequestOrigin;
  organizationContext: Record<string, string>;
  profile: BusinessProfileInput;
  candidateCompositionCodes: string[];
  ruleRecommendedCode: string;
};

type PresetAiOpenAiAttempt = {
  status: "completed" | "failed";
  providerCode: "openai";
  modelCode: string;
  promptHash: string;
  requestPayload: {
    systemPrompt: string;
    userPrompt: string;
    candidateCompositionCodes: string[];
  };
  responsePayload: Record<string, unknown>;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  output: PresetAiRecommendationOutput | null;
  assistantLetterMarkdown: string | null;
  failureMessage: string | null;
};

type PresetAiRunRow = {
  id: string;
  organization_id: string | null;
  business_profile_version_id: string | null;
  requested_by: string | null;
  request_origin: string;
  input_hash: string;
  input_snapshot_json: Record<string, unknown> | null;
  rule_recommendation_json: Record<string, unknown> | null;
  candidate_compositions_json: unknown[] | null;
  selected_composition_code: string | null;
  confidence: number | null;
  target_audience_fit: string | null;
  key_benefit: string | null;
  setup_tip: string | null;
  assistant_letter_markdown: string | null;
  observations_json: unknown[] | null;
  suggested_cost_centers_json: unknown[] | null;
  cost_center_draft_saved: boolean;
  status: string;
  created_at: string;
};

export type StoredPresetAiRun = PresetAiRunRow;
type PresetAiRunSummaryInput = Pick<
  PresetAiRunRow,
  | "id"
  | "input_hash"
  | "selected_composition_code"
  | "confidence"
  | "target_audience_fit"
  | "key_benefit"
  | "setup_tip"
  | "assistant_letter_markdown"
  | "observations_json"
  | "suggested_cost_centers_json"
  | "cost_center_draft_saved"
  | "status"
  | "created_at"
>;

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

function normalizeProfileInput(profile: BusinessProfileInput): BusinessProfileInput {
  return {
    primaryActivityCode: profile.primaryActivityCode.trim(),
    secondaryActivityCodes: unique(profile.secondaryActivityCodes)
      .filter((code) => code !== profile.primaryActivityCode.trim()),
    selectedTraits: unique(profile.selectedTraits),
    shortDescription: trimToNull(profile.shortDescription) ?? null,
  };
}

function normalizeOrganizationContext(context: PresetAiOrganizationContext | null | undefined) {
  const entries = Object.entries({
    organizationId: trimToNull(context?.organizationId),
    organizationName: trimToNull(context?.organizationName),
    slug: trimToNull(context?.slug),
    legalEntityType: trimToNull(context?.legalEntityType)?.toUpperCase() ?? null,
    taxId: trimToNull(context?.taxId)?.replace(/\D+/g, "") ?? null,
    taxRegimeCode: trimToNull(context?.taxRegimeCode)?.toUpperCase() ?? null,
    vatRegime: trimToNull(context?.vatRegime)?.toUpperCase() ?? null,
    dgiGroup: trimToNull(context?.dgiGroup)?.toUpperCase() ?? null,
    cfeStatus: trimToNull(context?.cfeStatus)?.toUpperCase() ?? null,
  }).filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  return Object.fromEntries(entries);
}

function serializeForHash(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function buildPromptHash(payload: {
  systemPrompt: string;
  userPrompt: string;
  candidateCompositionCodes: string[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        systemPrompt: payload.systemPrompt,
        userPrompt: payload.userPrompt,
        candidateCompositionCodes: payload.candidateCompositionCodes,
      }),
    )
    .digest("hex");
}

function summarizeComposition(composition: PresetComposition) {
  return {
    code: composition.code,
    label: composition.label,
    description: composition.description,
    basePresetCode: composition.basePresetCode,
    overlayCodes: composition.overlayCodes,
    reasons: composition.reasons.slice(0, 4),
    capabilities: composition.capabilities.slice(0, 4),
  };
}

function buildBusinessProfileSummary(profile: BusinessProfileInput) {
  const normalizedProfile = normalizeProfileInput(profile);
  const primaryActivity = getActivityByCode(normalizedProfile.primaryActivityCode);
  const secondaryActivities = normalizedProfile.secondaryActivityCodes
    .map((code) => getActivityByCode(code))
    .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity));
  const traits = normalizedProfile.selectedTraits
    .map((code) => getOrganizationTraitByCode(code))
    .filter((trait): trait is NonNullable<typeof trait> => Boolean(trait));

  return {
    primaryActivity: primaryActivity
      ? `${primaryActivity.code} - ${primaryActivity.title}`
      : normalizedProfile.primaryActivityCode || "Sin actividad principal",
    secondaryActivities: secondaryActivities.map((activity) => `${activity.code} - ${activity.title}`),
    traits: traits.map((trait) => trait.label),
    shortDescription: normalizedProfile.shortDescription,
  };
}

function buildObservationNotes(observations: PresetAiObservation[]) {
  return observations.map((observation) => `${observation.title}: ${observation.shortLabel}`);
}

function buildCostCenterNotes(costCenters: PresetAiSuggestedCostCenter[]) {
  return costCenters.map((center) => `${center.label}: ${center.rationale}`);
}

function buildPresetAiDecisionComment(input: {
  composition: PresetComposition;
  aiOutput: PresetAiRecommendationOutput;
  source: PresetHybridRecommendation["source"];
}) {
  const confidenceLabel =
    typeof input.aiOutput.confidence === "number"
      ? `${Math.round(input.aiOutput.confidence * 100)}%`
      : "sin confianza";
  const sourceLabel = input.source === "rules_confirmed_by_ai"
    ? "Reglas internas + OpenAI estructurado (confirmacion)."
    : input.source === "hybrid_ai_recommended"
      ? "Reglas internas + OpenAI estructurado (ajuste aplicado)."
      : "OpenAI estructurado como segunda opinion sobre reglas internas.";

  return {
    title: `Recomendacion IA: ${input.composition.label}`,
    summary: input.aiOutput.targetAudienceFit,
    reasons: [
      input.aiOutput.targetAudienceFit,
      input.aiOutput.keyBenefit,
      `Confianza estimada: ${confidenceLabel}.`,
    ],
    impacts: [
      input.aiOutput.keyBenefit,
      input.aiOutput.setupTip,
      ...input.composition.capabilities.slice(0, 2),
    ].slice(0, 4),
    whatCanYouDo: [
      input.source === "ai_low_confidence"
        ? "Revisa la sugerencia y decide si prefieres mantener la recomendacion por reglas."
        : "Si estas de acuerdo, puedes guardar y aplicar la composicion sugerida.",
      input.aiOutput.setupTip,
      input.aiOutput.suggestedCostCenters.length > 0
        ? "Si te sirven, guarda el borrador de centros de costo para retomarlo despues."
        : "Si algo no coincide con tu operativa, mantente en la recomendacion por reglas o elige una alternativa.",
    ],
    sourceLabel,
    expertNotes: [
      ...buildObservationNotes(input.aiOutput.observations),
      ...buildCostCenterNotes(input.aiOutput.suggestedCostCenters),
    ].slice(0, 6),
  } satisfies DecisionComment;
}

export function buildAssistantLetterMarkdown(input: {
  composition: PresetComposition;
  aiOutput: PresetAiRecommendationOutput;
}) {
  const lines = [
    `**IA**: Basado en tu perfil operativo, seleccione **${input.composition.label}**.`,
    "",
    `**Por que encaja**`,
    `- ${input.aiOutput.targetAudienceFit}`,
    "",
    `**Mayor beneficio**`,
    `- ${input.aiOutput.keyBenefit}`,
    "",
    `**Consejo inicial**`,
    `- ${input.aiOutput.setupTip}`,
  ];

  if (input.aiOutput.suggestedCostCenters.length > 0) {
    lines.push(
      "",
      `**Centros de costo sugeridos**`,
      ...input.aiOutput.suggestedCostCenters.map(
        (center) =>
          `- **${center.label}** (${center.code}): ${center.rationale}. Agrupacion sugerida: ${center.groupingHint}.`,
      ),
    );
  }

  return lines.join("\n");
}

function isValidObservation(value: unknown): value is PresetAiObservation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const observation = value as Record<string, unknown>;

  return [
    observation.key,
    observation.title,
    observation.shortLabel,
    observation.whatIsIt,
    observation.whyItMatters,
    observation.impact,
    observation.whatCanYouDo,
  ].every((field) => typeof field === "string" && field.trim().length > 0)
    && (observation.sourceLabel === undefined
      || observation.sourceLabel === null
      || typeof observation.sourceLabel === "string")
    && (observation.suggestedCode === undefined
      || observation.suggestedCode === null
      || typeof observation.suggestedCode === "string")
    && (observation.expertNotes === undefined || Array.isArray(observation.expertNotes));
}

function isValidSuggestedCostCenter(value: unknown): value is PresetAiSuggestedCostCenter {
  if (!value || typeof value !== "object") {
    return false;
  }

  const costCenter = value as Record<string, unknown>;

  return [
    costCenter.code,
    costCenter.label,
    costCenter.rationale,
    costCenter.groupingHint,
  ].every((field) => typeof field === "string" && field.trim().length > 0);
}

function assertValidPresetAiOutput(
  output: unknown,
  candidateCodes: string[],
): asserts output is PresetAiRecommendationOutput {
  if (!output || typeof output !== "object") {
    throw new Error("La IA no devolvio una recomendacion estructurada valida.");
  }

  const parsed = output as Record<string, unknown>;
  const selectedCompositionCode = trimToNull(parsed.selectedCompositionCode as string | null);
  const confidence = parsed.confidence;
  const targetAudienceFit = trimToNull(parsed.targetAudienceFit as string | null);
  const keyBenefit = trimToNull(parsed.keyBenefit as string | null);
  const setupTip = trimToNull(parsed.setupTip as string | null);
  const observations = Array.isArray(parsed.observations) ? parsed.observations : [];
  const suggestedCostCenters = Array.isArray(parsed.suggestedCostCenters)
    ? parsed.suggestedCostCenters
    : [];

  if (!selectedCompositionCode || !candidateCodes.includes(selectedCompositionCode)) {
    throw new Error("La IA eligio una composicion fuera del set permitido.");
  }

  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error("La IA devolvio una confianza invalida.");
  }

  if (!targetAudienceFit || !keyBenefit || !setupTip) {
    throw new Error("La IA devolvio una explicacion incompleta.");
  }

  if (!observations.every(isValidObservation)) {
    throw new Error("La IA devolvio observaciones con un formato invalido.");
  }

  if (!suggestedCostCenters.every(isValidSuggestedCostCenter)) {
    throw new Error("La IA devolvio centros de costo sugeridos con un formato invalido.");
  }
}

function buildSystemPrompt(input: {
  scope: PresetAiRequestOrigin;
  organizationContext: Record<string, string>;
}) {
  const contextLines = Object.entries(input.organizationContext)
    .map(([key, value]) => `${key}: ${value}`);

  return [
    "You are the Convertilabs preset recommendation assistant for Uruguay.",
    "You must choose exactly one selectedCompositionCode from the provided candidates.",
    "You must not invent preset codes, accounts, overlays, traits, or activities.",
    "You must return public-facing Spanish explanations only. Do not reveal internal chain-of-thought.",
    "Use observations to explain inconsistencies, operational risks, or setup considerations in a tooltip-friendly format.",
    "Use suggestedCostCenters only when they are materially useful for the described business.",
    "",
    `Scope: ${input.scope}`,
    ...contextLines,
  ].join("\n");
}

function buildUserPrompt(input: {
  organizationContext: Record<string, string>;
  profile: BusinessProfileInput;
  recommendation: PresetRecommendationResult;
}) {
  const profileSummary = buildBusinessProfileSummary(input.profile);
  const candidateCompositions = [
    summarizeComposition(input.recommendation.recommended),
    ...input.recommendation.alternatives.map((composition) => summarizeComposition(composition)),
  ];

  return [
    "Contexto de organizacion y negocio:",
    JSON.stringify(
      {
        organizationContext: input.organizationContext,
        businessProfile: profileSummary,
        ruleRecommendation: {
          recommended: summarizeComposition(input.recommendation.recommended),
          alternatives: input.recommendation.alternatives.map((composition) => summarizeComposition(composition)),
          explanation: input.recommendation.explanation,
          scoreBreakdown: input.recommendation.scoreBreakdown,
        },
        candidateCompositions,
      },
      null,
      2,
    ),
  ].join("\n");
}

export function buildPresetAiInputSnapshot(input: {
  scope: PresetAiRequestOrigin;
  organizationContext?: PresetAiOrganizationContext | null;
  profile: BusinessProfileInput;
  recommendation: PresetRecommendationResult;
}) {
  const normalizedProfile = normalizeProfileInput(input.profile);
  const normalizedContext = normalizeOrganizationContext(input.organizationContext);

  return {
    scope: input.scope,
    organizationContext: normalizedContext,
    profile: normalizedProfile,
    candidateCompositionCodes: [
      input.recommendation.recommended.code,
      ...input.recommendation.alternatives.map((composition) => composition.code),
    ],
    ruleRecommendedCode: input.recommendation.recommended.code,
  } satisfies PresetAiInputSnapshot;
}

export function buildPresetAiInputHash(input: {
  scope: PresetAiRequestOrigin;
  organizationContext?: PresetAiOrganizationContext | null;
  profile: BusinessProfileInput;
  recommendation: PresetRecommendationResult;
}) {
  const snapshot = buildPresetAiInputSnapshot(input);

  return createHash("sha256")
    .update(serializeForHash(snapshot))
    .digest("hex");
}

export function findPresetCompositionByCode(
  recommendation: PresetRecommendationResult,
  compositionCode: string,
) {
  return [
    recommendation.recommended,
    ...recommendation.alternatives,
  ].find((composition) => composition.code === compositionCode) ?? null;
}

export function derivePresetHybridRecommendation(input: {
  recommendation: PresetRecommendationResult;
  aiOutput: PresetAiRecommendationOutput;
  runId?: string | null;
  inputHash?: string | null;
  costCenterDraftSaved?: boolean;
  confidenceThreshold?: number;
}) {
  const confidenceThreshold = input.confidenceThreshold ?? PRESET_AI_CONFIDENCE_THRESHOLD;
  const suggestedComposition = findPresetCompositionByCode(
    input.recommendation,
    input.aiOutput.selectedCompositionCode,
  );

  if (!suggestedComposition) {
    throw new Error("La recomendacion IA no corresponde a una composicion conocida.");
  }

  const shouldAutoSelect = input.aiOutput.confidence >= confidenceThreshold;
  const source: PresetHybridRecommendation["source"] =
    shouldAutoSelect
      ? input.aiOutput.selectedCompositionCode === input.recommendation.recommended.code
        ? "rules_confirmed_by_ai"
        : "hybrid_ai_recommended"
      : "ai_low_confidence";
  const effectiveComposition =
    shouldAutoSelect
      ? suggestedComposition
      : input.recommendation.recommended;

  return {
    source,
    shouldAutoSelect,
    composition: effectiveComposition,
    selectedCompositionCode: effectiveComposition.code,
    confidence: input.aiOutput.confidence,
    decision: buildPresetAiDecisionComment({
      composition: suggestedComposition,
      aiOutput: input.aiOutput,
      source,
    }),
    assistantLetterMarkdown: buildAssistantLetterMarkdown({
      composition: suggestedComposition,
      aiOutput: input.aiOutput,
    }),
    observations: input.aiOutput.observations,
    suggestedCostCenters: input.aiOutput.suggestedCostCenters,
    runId: input.runId ?? null,
    inputHash: input.inputHash ?? null,
    costCenterDraftSaved: input.costCenterDraftSaved ?? false,
  } satisfies PresetHybridRecommendation;
}

export function resolvePresetApplicationMode(input: {
  planSetupMode: string;
}): PresetApplicationMode {
  switch (input.planSetupMode) {
    case "alternative":
      return "manual_pick";
    case "external_import":
      return "external_import";
    case "minimal_temp_only":
      return "minimal_temp_only";
    case "hybrid_ai_recommended":
      return "hybrid_ai_recommended";
    default:
      return "recommended";
  }
}

export async function resolvePresetAiRecommendation(input: {
  scope: PresetAiRequestOrigin;
  organizationContext?: PresetAiOrganizationContext | null;
  profile: BusinessProfileInput;
  recommendation: PresetRecommendationResult;
}) {
  const organizationContext = normalizeOrganizationContext(input.organizationContext);
  const modelCode = getOpenAIModelConfig().openAiRulesModel;
  const systemPrompt = buildSystemPrompt({
    scope: input.scope,
    organizationContext,
  });
  const userPrompt = buildUserPrompt({
    organizationContext,
    profile: input.profile,
    recommendation: input.recommendation,
  });
  const candidateCompositionCodes = [
    input.recommendation.recommended.code,
    ...input.recommendation.alternatives.map((composition) => composition.code),
  ];
  const promptHash = buildPromptHash({
    systemPrompt,
    userPrompt,
    candidateCompositionCodes,
  });
  const requestPayload = {
    systemPrompt,
    userPrompt,
    candidateCompositionCodes,
  };

  if (!process.env.OPENAI_API_KEY) {
    return {
      status: "failed",
      providerCode: "openai",
      modelCode,
      promptHash,
      requestPayload,
      responsePayload: {},
      responseId: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      output: null,
      assistantLetterMarkdown: null,
      failureMessage: "La recomendacion IA no esta disponible porque falta OPENAI_API_KEY.",
    } satisfies PresetAiOpenAiAttempt;
  }

  try {
    const response = await createStructuredOpenAIResponse<PresetAiRecommendationOutput>({
      model: modelCode,
      schemaName: PRESET_AI_SCHEMA_NAME,
      schema: presetAiRecommendationJsonSchema,
      systemPrompt,
      userPrompt,
      metadata: {
        scope: input.scope,
        candidate_count: candidateCompositionCodes.length,
      },
    });

    assertValidPresetAiOutput(response.output, candidateCompositionCodes);

    const assistantLetterMarkdown = buildAssistantLetterMarkdown({
      composition: findPresetCompositionByCode(input.recommendation, response.output.selectedCompositionCode)
        ?? input.recommendation.recommended,
      aiOutput: response.output,
    });

    return {
      status: "completed",
      providerCode: "openai",
      modelCode,
      promptHash,
      requestPayload,
      responsePayload: response.rawResponse,
      responseId: response.responseId,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      estimatedCostUsd: response.usage.estimatedCostUsd,
      output: response.output,
      assistantLetterMarkdown,
      failureMessage: null,
    } satisfies PresetAiOpenAiAttempt;
  } catch (error) {
    return {
      status: "failed",
      providerCode: "openai",
      modelCode,
      promptHash,
      requestPayload,
      responsePayload: {},
      responseId: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      output: null,
      assistantLetterMarkdown: null,
      failureMessage:
        error instanceof Error
          ? error.message
          : "La recomendacion IA fallo antes de devolver una salida usable.",
    } satisfies PresetAiOpenAiAttempt;
  }
}

export function hashIpAddress(ipAddress: string | null | undefined) {
  const normalized = trimToNull(ipAddress);

  if (!normalized) {
    return null;
  }

  return createHash("sha256")
    .update(normalized)
    .digest("hex");
}

export async function enforcePresetAiRateLimit(
  supabase: SupabaseClient,
  input: {
    requestedBy: string;
    ipHash: string | null;
  },
) {
  const windowStart = new Date(Date.now() - PRESET_AI_RATE_WINDOW_MINUTES * 60_000).toISOString();
  const [{ count: userCount, error: userError }, ipCountResult] = await Promise.all([
    supabase
      .from("organization_preset_ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("requested_by", input.requestedBy)
      .gte("created_at", windowStart),
    input.ipHash
      ? supabase
          .from("organization_preset_ai_runs")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", input.ipHash)
          .gte("created_at", windowStart)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (userError) {
    throw new Error(userError.message);
  }

  if (ipCountResult.error) {
    throw new Error(ipCountResult.error.message);
  }

  const ipCount = typeof ipCountResult.count === "number" ? ipCountResult.count : 0;
  const userHits = typeof userCount === "number" ? userCount : 0;

  if (userHits >= PRESET_AI_USER_LIMIT || ipCount >= PRESET_AI_IP_LIMIT) {
    return {
      limited: true,
      retryAfterSeconds: PRESET_AI_RATE_WINDOW_MINUTES * 60,
    };
  }

  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}

export async function createPresetAiRunRecord(
  supabase: SupabaseClient,
  input: {
    organizationId?: string | null;
    businessProfileVersionId?: string | null;
    requestedBy: string | null;
    requestOrigin: PresetAiRequestOrigin;
    ipHash: string | null;
    inputHash: string;
    inputSnapshot: PresetAiInputSnapshot;
    recommendation: PresetRecommendationResult;
    aiAttempt: PresetAiOpenAiAttempt;
  },
) {
  const candidateCompositions = [
    summarizeComposition(input.recommendation.recommended),
    ...input.recommendation.alternatives.map((composition) => summarizeComposition(composition)),
  ];
  const { data, error } = await supabase
    .from("organization_preset_ai_runs")
    .insert({
      organization_id: input.organizationId ?? null,
      business_profile_version_id: input.businessProfileVersionId ?? null,
      requested_by: input.requestedBy,
      request_origin: input.requestOrigin,
      ip_hash: input.ipHash,
      input_hash: input.inputHash,
      input_snapshot_json: input.inputSnapshot,
      rule_recommendation_json: {
        recommended: summarizeComposition(input.recommendation.recommended),
        alternatives: input.recommendation.alternatives.map((composition) => summarizeComposition(composition)),
        explanation: input.recommendation.explanation,
        scoreBreakdown: input.recommendation.scoreBreakdown,
      },
      candidate_compositions_json: candidateCompositions,
      selected_composition_code: input.aiAttempt.output?.selectedCompositionCode ?? null,
      confidence: input.aiAttempt.output?.confidence ?? null,
      target_audience_fit: trimToNull(input.aiAttempt.output?.targetAudienceFit) ?? null,
      key_benefit: trimToNull(input.aiAttempt.output?.keyBenefit) ?? null,
      setup_tip: trimToNull(input.aiAttempt.output?.setupTip) ?? null,
      assistant_letter_markdown: input.aiAttempt.assistantLetterMarkdown,
      observations_json: input.aiAttempt.output?.observations ?? [],
      suggested_cost_centers_json: input.aiAttempt.output?.suggestedCostCenters ?? [],
      provider_code: input.aiAttempt.providerCode,
      model_code: input.aiAttempt.modelCode,
      response_id: input.aiAttempt.responseId,
      prompt_hash: input.aiAttempt.promptHash,
      request_payload_json: input.aiAttempt.requestPayload,
      response_json: input.aiAttempt.responsePayload,
      input_tokens: input.aiAttempt.inputTokens,
      output_tokens: input.aiAttempt.outputTokens,
      total_tokens: input.aiAttempt.totalTokens,
      estimated_cost_usd: input.aiAttempt.estimatedCostUsd,
      status: input.aiAttempt.status,
      failure_message: input.aiAttempt.failureMessage,
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo registrar la corrida de recomendacion IA.");
  }

  return data.id as string;
}

export async function loadPresetAiRunForUser(
  supabase: SupabaseClient,
  input: {
    runId: string;
    requestedBy: string;
  },
) {
  const { data, error } = await supabase
    .from("organization_preset_ai_runs")
    .select("id, organization_id, business_profile_version_id, requested_by, request_origin, input_hash, input_snapshot_json, rule_recommendation_json, candidate_compositions_json, selected_composition_code, confidence, target_audience_fit, key_benefit, setup_tip, assistant_letter_markdown, observations_json, suggested_cost_centers_json, cost_center_draft_saved, status, created_at")
    .eq("id", input.runId)
    .eq("requested_by", input.requestedBy)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PresetAiRunRow | null) ?? null;
}

export async function attachPresetAiRunToOrganization(
  supabase: SupabaseClient,
  input: {
    runId: string;
    organizationId: string;
    businessProfileVersionId: string | null;
  },
) {
  const { error } = await supabase
    .from("organization_preset_ai_runs")
    .update({
      organization_id: input.organizationId,
      business_profile_version_id: input.businessProfileVersionId,
    })
    .eq("id", input.runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markPresetAiCostCenterDraftSaved(
  supabase: SupabaseClient,
  input: {
    runId: string;
    requestedBy: string;
  },
) {
  const { data, error } = await supabase
    .from("organization_preset_ai_runs")
    .update({
      cost_center_draft_saved: true,
      cost_center_draft_saved_at: new Date().toISOString(),
      cost_center_draft_saved_by: input.requestedBy,
    })
    .eq("id", input.runId)
    .eq("requested_by", input.requestedBy)
    .select("id, organization_id, business_profile_version_id, requested_by, request_origin, input_hash, input_snapshot_json, rule_recommendation_json, candidate_compositions_json, selected_composition_code, confidence, target_audience_fit, key_benefit, setup_tip, assistant_letter_markdown, observations_json, suggested_cost_centers_json, cost_center_draft_saved, status, created_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PresetAiRunRow | null) ?? null;
}

export function observationFromUnknown(value: unknown): PresetAiObservation | null {
  return isValidObservation(value) ? value : null;
}

export function suggestedCostCenterFromUnknown(value: unknown): PresetAiSuggestedCostCenter | null {
  return isValidSuggestedCostCenter(value) ? value : null;
}

export function toPresetAiRunSummary(row: PresetAiRunSummaryInput | null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    inputHash: row.input_hash,
    selectedCompositionCode: row.selected_composition_code ?? "",
    confidence: row.confidence,
    targetAudienceFit: trimToNull(row.target_audience_fit),
    keyBenefit: trimToNull(row.key_benefit),
    setupTip: trimToNull(row.setup_tip),
    assistantLetterMarkdown: row.assistant_letter_markdown,
    observations: (Array.isArray(row.observations_json) ? row.observations_json : [])
      .map((item) => observationFromUnknown(item))
      .filter((item): item is PresetAiObservation => Boolean(item)),
    suggestedCostCenters: (Array.isArray(row.suggested_cost_centers_json) ? row.suggested_cost_centers_json : [])
      .map((item) => suggestedCostCenterFromUnknown(item))
      .filter((item): item is PresetAiSuggestedCostCenter => Boolean(item)),
    costCenterDraftSaved: row.cost_center_draft_saved,
    status: row.status,
    createdAt: row.created_at,
  } satisfies PresetAiRunSummary;
}

export function buildPresetAiOutputFromStoredRun(run: Pick<
  PresetAiRunRow,
  | "selected_composition_code"
  | "confidence"
  | "target_audience_fit"
  | "key_benefit"
  | "setup_tip"
  | "observations_json"
  | "suggested_cost_centers_json"
>) {
  const selectedCompositionCode = trimToNull(run.selected_composition_code);
  const targetAudienceFit = trimToNull(run.target_audience_fit);
  const keyBenefit = trimToNull(run.key_benefit);
  const setupTip = trimToNull(run.setup_tip);

  if (!selectedCompositionCode || !targetAudienceFit || !keyBenefit || !setupTip) {
    return null;
  }

  return {
    selectedCompositionCode,
    confidence: typeof run.confidence === "number" ? run.confidence : 0,
    targetAudienceFit,
    keyBenefit,
    setupTip,
    observations: (Array.isArray(run.observations_json) ? run.observations_json : [])
      .map((item) => observationFromUnknown(item))
      .filter((item): item is PresetAiObservation => Boolean(item)),
    suggestedCostCenters: (Array.isArray(run.suggested_cost_centers_json) ? run.suggested_cost_centers_json : [])
      .map((item) => suggestedCostCenterFromUnknown(item))
      .filter((item): item is PresetAiSuggestedCostCenter => Boolean(item)),
  } satisfies PresetAiRecommendationOutput;
}

export function buildPresetAiRouteResponse(input: {
  runId: string;
  inputHash: string;
  recommendation: PresetRecommendationResult;
  aiOutput: PresetAiRecommendationOutput;
  hybridRecommendation: PresetHybridRecommendation;
}) {
  return {
    runId: input.runId,
    inputHash: input.inputHash,
    ruleRecommendation: input.recommendation,
    aiRecommendation: input.aiOutput,
    hybridRecommendation: input.hybridRecommendation,
  } satisfies PresetAiRouteResponse;
}

export function buildHybridPresetApplicationExplanation(input: {
  selectedComposition: PresetComposition;
  hybridRecommendation: PresetHybridRecommendation;
}) {
  return {
    title: `Plan aplicado con IA: ${input.selectedComposition.label}`,
    summary: input.hybridRecommendation.decision.summary,
    reasons: [
      ...input.hybridRecommendation.decision.reasons,
      ...input.selectedComposition.reasons,
    ].slice(0, 5),
    impacts: [
      ...input.hybridRecommendation.decision.impacts,
      ...input.selectedComposition.capabilities,
    ].slice(0, 5),
    whatCanYouDo: [
      "La composicion quedo lista para operar hacia adelante.",
      ...input.hybridRecommendation.decision.whatCanYouDo,
    ].slice(0, 4),
    sourceLabel: "Reglas internas + OpenAI estructurado.",
    expertNotes: [
      ...buildObservationNotes(input.hybridRecommendation.observations),
      ...buildCostCenterNotes(input.hybridRecommendation.suggestedCostCenters),
    ].slice(0, 6),
  } satisfies DecisionComment;
}

export {
  PRESET_AI_CONFIDENCE_THRESHOLD,
  PRESET_AI_IP_LIMIT,
  PRESET_AI_RATE_WINDOW_MINUTES,
  PRESET_AI_USER_LIMIT,
};
