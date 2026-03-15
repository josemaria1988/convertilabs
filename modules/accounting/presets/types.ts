import type { DecisionComment } from "@/modules/explanations/types";

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
