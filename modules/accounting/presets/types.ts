import type {
  DecisionComment,
  HelpHintContent,
} from "@/modules/explanations/types";
import type { BusinessProfileInput } from "@/modules/organizations/activity-types";

export type PresetBundleKind = "base" | "activity_overlay" | "trait_overlay";

export type PresetAccountSeed = {
  code: string;
  name: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  normalSide?: "debit" | "credit";
  semanticKey: string;
  isPostable?: boolean;
  isProvisional?: boolean;
  systemRole?: string;
  externalCode?: string | null;
  statementSection?: string | null;
  natureTag?: string | null;
  functionTag?: string | null;
  cashflowTag?: string | null;
  taxProfileHint?: string | null;
  currencyPolicy?: string | null;
};

export type JournalTemplateSeed = {
  code: string;
  label: string;
  description: string;
};

export type TaxProfileSeed = {
  code: string;
  label: string;
};

export type PresetUiHint = {
  key: string;
  tone: "info" | "warning" | "success";
  message: string;
};

export type PresetBundle = {
  code: string;
  version: string;
  kind: PresetBundleKind;
  label: string;
  description: string;
  compatibleActivityCodes?: string[];
  compatibleTraits?: string[];
  incompatibleTraits?: string[];
  accounts: PresetAccountSeed[];
  journalTemplates: JournalTemplateSeed[];
  taxProfiles: TaxProfileSeed[];
  uiHints?: PresetUiHint[];
};

export type PresetComposition = {
  code: string;
  label: string;
  description: string;
  basePresetCode: string;
  overlayCodes: string[];
  accounts: PresetAccountSeed[];
  journalTemplates: JournalTemplateSeed[];
  taxProfiles: TaxProfileSeed[];
  uiHints: PresetUiHint[];
  reasons: string[];
  capabilities: string[];
};

export type PresetApplicationMode =
  | "recommended"
  | "manual_pick"
  | "external_import"
  | "minimal_temp_only"
  | "hybrid_ai_recommended";

export type PresetRecommendationResult = {
  recommended: PresetComposition;
  alternatives: PresetComposition[];
  explanation: DecisionComment;
  scoreBreakdown: {
    primaryActivity: number;
    secondaryActivities: number;
    traits: number;
    textDescription: number;
  };
};

export type PresetAiObservation = HelpHintContent & {
  suggestedCode?: string | null;
};

export type PresetAiSuggestedCostCenter = {
  code: string;
  label: string;
  rationale: string;
  groupingHint: string;
};

export type PresetAiActivityRecommendation = {
  selectedPrimaryActivityCode: string;
  selectedSecondaryActivityCodes: string[];
  confidence: number;
  rationale: string;
  candidateCodes: string[];
};

export type PresetAiRecommendationOutput = {
  selectedCompositionCode: string;
  confidence: number;
  targetAudienceFit: string;
  keyBenefit: string;
  setupTip: string;
  observations: PresetAiObservation[];
  suggestedCostCenters: PresetAiSuggestedCostCenter[];
};

export type PresetHybridDecisionSource =
  | "rules_only"
  | "rules_confirmed_by_ai"
  | "hybrid_ai_recommended"
  | "ai_low_confidence";

export type PresetHybridRecommendation = {
  source: PresetHybridDecisionSource;
  shouldAutoSelect: boolean;
  composition: PresetComposition;
  selectedCompositionCode: string;
  confidence: number | null;
  decision: DecisionComment;
  assistantLetterMarkdown: string | null;
  observations: PresetAiObservation[];
  suggestedCostCenters: PresetAiSuggestedCostCenter[];
  runId: string | null;
  inputHash: string | null;
  costCenterDraftSaved: boolean;
};

export type PresetAiRunSummary = {
  id: string;
  inputHash: string;
  selectedCompositionCode: string;
  confidence: number | null;
  targetAudienceFit: string | null;
  keyBenefit: string | null;
  setupTip: string | null;
  assistantLetterMarkdown: string | null;
  observations: PresetAiObservation[];
  suggestedCostCenters: PresetAiSuggestedCostCenter[];
  costCenterDraftSaved: boolean;
  status: string;
  createdAt: string;
};

export type PresetAiRouteResponse = {
  runId: string;
  inputHash: string;
  resolvedProfile: BusinessProfileInput;
  activityRecommendation: PresetAiActivityRecommendation | null;
  ruleRecommendation: PresetRecommendationResult;
  aiRecommendation: PresetAiRecommendationOutput;
  hybridRecommendation: PresetHybridRecommendation;
};
