import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { toPresetAiRunSummary } from "@/modules/accounting/presets/ai-recommendation";
import type {
  PresetAiRunSummary,
  PresetApplicationMode,
} from "@/modules/accounting/presets/types";
import type { DecisionComment } from "@/modules/explanations/types";
import type { BusinessProfileInput } from "@/modules/organizations/activity-types";
import { getActivityByCode } from "@/modules/organizations/activity-catalog";
import { getOrganizationTraitByCode } from "@/modules/organizations/traits-catalog";

type BusinessProfileVersionRow = {
  id: string;
  version_no: number;
  primary_activity_code: string | null;
  short_description: string | null;
  source: string;
  is_current: boolean;
  created_at: string;
};

type BusinessProfileActivityRow = {
  business_profile_version_id: string;
  activity_code: string;
  role: "primary" | "secondary";
  rank: number;
};

type BusinessProfileTraitRow = {
  business_profile_version_id: string;
  trait_code: string;
  enabled: boolean;
};

type PresetApplicationRow = {
  id: string;
  business_profile_version_id: string | null;
  base_preset_code: string;
  overlay_codes_json: string[] | null;
  application_mode: string;
  explanation_json: Record<string, unknown> | null;
  ai_run_id: string | null;
  applied_at: string;
  active: boolean;
};

type LoadedPresetAiRunRow = {
  id: string;
  input_hash: string;
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

export type OrganizationBusinessProfileData = {
  available: boolean;
  activeBusinessProfile: {
    id: string;
    versionNo: number;
    primaryActivityCode: string | null;
    secondaryActivityCodes: string[];
    selectedTraits: string[];
    shortDescription: string | null;
    source: string;
    createdAt: string;
  } | null;
  activePresetApplication: {
    id: string;
    businessProfileVersionId: string | null;
    basePresetCode: string;
    overlayCodes: string[];
    applicationMode: PresetApplicationMode;
    explanation: Record<string, unknown>;
    aiRunId: string | null;
    appliedAt: string;
  } | null;
  activePresetAiRun: PresetAiRunSummary | null;
  profileHistory: Array<{
    id: string;
    versionNo: number;
    primaryActivityCode: string | null;
    source: string;
    createdAt: string;
  }>;
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function computeBusinessFlags(selectedTraits: string[]) {
  const traits = new Set(selectedTraits);

  return {
    has_mixed_vat_operations:
      traits.has("mixed_vat_operations")
      || traits.has("vat_exempt_or_non_taxed_operations"),
    has_imports: traits.has("imports_goods"),
    has_exports:
      traits.has("exports_goods")
      || traits.has("exports_services"),
    is_multi_currency: traits.has("multi_currency_operations"),
  };
}

export async function loadOrganizationBusinessProfileData(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const [versionsResult, presetApplicationsResult] = await Promise.all([
    supabase
      .from("organization_business_profile_versions")
      .select("id, version_no, primary_activity_code, short_description, source, is_current, created_at")
      .eq("organization_id", organizationId)
      .order("version_no", { ascending: false })
      .limit(12),
    supabase
      .from("organization_preset_applications")
      .select("id, business_profile_version_id, base_preset_code, overlay_codes_json, application_mode, explanation_json, ai_run_id, applied_at, active")
      .eq("organization_id", organizationId)
      .order("applied_at", { ascending: false })
      .limit(12),
  ]);

  if (
    isMissingSupabaseRelationError(versionsResult.error, "organization_business_profile_versions")
    || isMissingSupabaseRelationError(presetApplicationsResult.error, "organization_preset_applications")
  ) {
    return {
      available: false,
      activeBusinessProfile: null,
      activePresetApplication: null,
      activePresetAiRun: null,
      profileHistory: [],
    } satisfies OrganizationBusinessProfileData;
  }

  if (versionsResult.error) {
    throw new Error(versionsResult.error.message);
  }

  if (presetApplicationsResult.error) {
    throw new Error(presetApplicationsResult.error.message);
  }

  const versions = (versionsResult.data as BusinessProfileVersionRow[] | null) ?? [];
  const presetApplications = (((presetApplicationsResult.data as PresetApplicationRow[] | null) ?? []));
  const versionIds = versions.map((version) => version.id);
  let activities: BusinessProfileActivityRow[] = [];
  let traits: BusinessProfileTraitRow[] = [];

  if (versionIds.length > 0) {
    const [activitiesResult, traitsResult] = await Promise.all([
      supabase
        .from("organization_business_profile_activities")
        .select("business_profile_version_id, activity_code, role, rank")
        .in("business_profile_version_id", versionIds),
      supabase
        .from("organization_business_profile_traits")
        .select("business_profile_version_id, trait_code, enabled")
        .in("business_profile_version_id", versionIds),
    ]);

    if (isMissingSupabaseRelationError(activitiesResult.error, "organization_business_profile_activities")
      || isMissingSupabaseRelationError(traitsResult.error, "organization_business_profile_traits")) {
      return {
        available: false,
        activeBusinessProfile: null,
        activePresetApplication: null,
        activePresetAiRun: null,
        profileHistory: [],
      } satisfies OrganizationBusinessProfileData;
    }

    if (activitiesResult.error) {
      throw new Error(activitiesResult.error.message);
    }

    if (traitsResult.error) {
      throw new Error(traitsResult.error.message);
    }

    activities = ((activitiesResult.data as BusinessProfileActivityRow[] | null) ?? []);
    traits = ((traitsResult.data as BusinessProfileTraitRow[] | null) ?? []);
  }

  const activeVersion = versions.find((version) => version.is_current) ?? versions[0] ?? null;
  const activePresetApplicationRow =
    presetApplications.find((application) => application.active)
    ?? presetApplications[0]
    ?? null;
  let activePresetAiRun: PresetAiRunSummary | null = null;

  if (activePresetApplicationRow?.ai_run_id) {
    const aiRunResult = await supabase
      .from("organization_preset_ai_runs")
      .select("id, input_hash, selected_composition_code, confidence, target_audience_fit, key_benefit, setup_tip, assistant_letter_markdown, observations_json, suggested_cost_centers_json, cost_center_draft_saved, status, created_at")
      .eq("id", activePresetApplicationRow.ai_run_id)
      .limit(1)
      .maybeSingle();

    if (!isMissingSupabaseRelationError(aiRunResult.error, "organization_preset_ai_runs")) {
      if (aiRunResult.error) {
        throw new Error(aiRunResult.error.message);
      }

      activePresetAiRun = toPresetAiRunSummary((aiRunResult.data as LoadedPresetAiRunRow | null) ?? null);
    }
  }

  return {
    available: true,
    activeBusinessProfile: activeVersion
      ? {
          id: activeVersion.id,
          versionNo: activeVersion.version_no,
          primaryActivityCode: activeVersion.primary_activity_code,
          secondaryActivityCodes: activities
            .filter((activity) =>
              activity.business_profile_version_id === activeVersion.id
              && activity.role === "secondary")
            .sort((left, right) => left.rank - right.rank)
            .map((activity) => activity.activity_code),
          selectedTraits: traits
            .filter((trait) =>
              trait.business_profile_version_id === activeVersion.id
              && trait.enabled)
            .map((trait) => trait.trait_code),
          shortDescription: activeVersion.short_description,
          source: activeVersion.source,
          createdAt: activeVersion.created_at,
        }
      : null,
    activePresetApplication: activePresetApplicationRow
      ? {
          id: activePresetApplicationRow.id,
          businessProfileVersionId: activePresetApplicationRow.business_profile_version_id,
          basePresetCode: activePresetApplicationRow.base_preset_code,
          overlayCodes: activePresetApplicationRow.overlay_codes_json ?? [],
          applicationMode: activePresetApplicationRow.application_mode as PresetApplicationMode,
          explanation: (activePresetApplicationRow.explanation_json ?? {}) as Record<string, unknown>,
          aiRunId: activePresetApplicationRow.ai_run_id,
          appliedAt: activePresetApplicationRow.applied_at,
        }
      : null,
    activePresetAiRun,
    profileHistory: versions.map((version) => ({
      id: version.id,
      versionNo: version.version_no,
      primaryActivityCode: version.primary_activity_code,
      source: version.source,
      createdAt: version.created_at,
    })),
  } satisfies OrganizationBusinessProfileData;
}

export async function createOrganizationBusinessProfileVersion(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    profile: BusinessProfileInput;
    source: "onboarding" | "settings_update" | "admin_correction";
  },
) {
  const versionsResult = await supabase
    .from("organization_business_profile_versions")
    .select("id, version_no, is_current")
    .eq("organization_id", input.organizationId)
    .order("version_no", { ascending: false })
    .limit(20);

  if (isMissingSupabaseRelationError(versionsResult.error, "organization_business_profile_versions")) {
    return null;
  }

  if (versionsResult.error) {
    throw new Error(versionsResult.error.message);
  }

  const versions = (((versionsResult.data as Array<{ id: string; version_no: number; is_current: boolean }> | null) ?? []));
  const currentVersion = versions.find((version) => version.is_current) ?? null;

  if (currentVersion) {
    const { error: disableCurrentError } = await supabase
      .from("organization_business_profile_versions")
      .update({ is_current: false })
      .eq("id", currentVersion.id);

    if (isMissingSupabaseRelationError(disableCurrentError, "organization_business_profile_versions")) {
      return null;
    }

    if (disableCurrentError) {
      throw new Error(disableCurrentError.message);
    }
  }

  const nextVersionNo = versions.length > 0
    ? Math.max(...versions.map((version) => version.version_no)) + 1
    : 1;
  const cleanedSecondaryActivities = unique(input.profile.secondaryActivityCodes)
    .filter((code) => code !== input.profile.primaryActivityCode);
  const cleanedTraits = unique(input.profile.selectedTraits);
  const businessFlags = computeBusinessFlags(cleanedTraits);
  const { data: versionData, error: insertVersionError } = await supabase
    .from("organization_business_profile_versions")
    .insert({
      organization_id: input.organizationId,
      version_no: nextVersionNo,
      primary_activity_code: input.profile.primaryActivityCode,
      short_description: input.profile.shortDescription?.trim() || null,
      source: input.source,
      is_current: true,
      created_by: input.actorId,
      ...businessFlags,
    })
    .select("id")
    .limit(1)
    .single();

  if (isMissingSupabaseRelationError(insertVersionError, "organization_business_profile_versions")) {
    return null;
  }

  if (insertVersionError || !versionData?.id) {
    throw new Error(insertVersionError?.message ?? "No se pudo crear la version del perfil de negocio.");
  }

  const activityRows = [
    {
      business_profile_version_id: versionData.id as string,
      activity_code: input.profile.primaryActivityCode,
      role: "primary" as const,
      rank: 0,
    },
    ...cleanedSecondaryActivities.map((activityCode, index) => ({
      business_profile_version_id: versionData.id as string,
      activity_code: activityCode,
      role: "secondary" as const,
      rank: index + 1,
    })),
  ];
  const traitRows = cleanedTraits.map((traitCode) => ({
    business_profile_version_id: versionData.id as string,
    trait_code: traitCode,
    enabled: true,
  }));

  const { error: insertActivitiesError } = await supabase
    .from("organization_business_profile_activities")
    .insert(activityRows);

  if (isMissingSupabaseRelationError(insertActivitiesError, "organization_business_profile_activities")) {
    return null;
  }

  if (insertActivitiesError) {
    throw new Error(insertActivitiesError.message);
  }

  if (traitRows.length > 0) {
    const { error: insertTraitsError } = await supabase
      .from("organization_business_profile_traits")
      .insert(traitRows);

    if (isMissingSupabaseRelationError(insertTraitsError, "organization_business_profile_traits")) {
      return null;
    }

    if (insertTraitsError) {
      throw new Error(insertTraitsError.message);
    }
  }

  return {
    id: versionData.id as string,
    versionNo: nextVersionNo,
    primaryActivityCode: input.profile.primaryActivityCode,
    secondaryActivityCodes: cleanedSecondaryActivities,
    selectedTraits: cleanedTraits,
    shortDescription: input.profile.shortDescription?.trim() || null,
  };
}

export async function recordOrganizationPresetApplication(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    businessProfileVersionId: string;
    basePresetCode: string;
    overlayCodes: string[];
    applicationMode: PresetApplicationMode;
    explanation: DecisionComment;
    aiRunId?: string | null;
  },
) {
  const { error: disableCurrentError } = await supabase
    .from("organization_preset_applications")
    .update({ active: false })
    .eq("organization_id", input.organizationId)
    .eq("active", true);

  if (isMissingSupabaseRelationError(disableCurrentError, "organization_preset_applications")) {
    return false;
  }

  if (disableCurrentError && !isMissingSupabaseRelationError(disableCurrentError, "organization_preset_applications")) {
    throw new Error(disableCurrentError.message);
  }

  const { error } = await supabase
    .from("organization_preset_applications")
    .insert({
      organization_id: input.organizationId,
      business_profile_version_id: input.businessProfileVersionId,
      base_preset_code: input.basePresetCode,
      overlay_codes_json: input.overlayCodes,
      application_mode: input.applicationMode,
      explanation_json: input.explanation,
      ai_run_id: input.aiRunId ?? null,
      applied_at: new Date().toISOString(),
      applied_by: input.actorId,
      active: true,
    });

  if (isMissingSupabaseRelationError(error, "organization_preset_applications")) {
    return false;
  }

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export function describeBusinessProfile(input: {
  primaryActivityCode: string | null;
  secondaryActivityCodes: string[];
  selectedTraits: string[];
  shortDescription?: string | null;
}) {
  const primaryActivity = getActivityByCode(input.primaryActivityCode);

  return {
    primaryActivityLabel: primaryActivity
      ? `${primaryActivity.code} - ${primaryActivity.title}`
      : "Sin actividad principal",
    secondaryActivityLabels: input.secondaryActivityCodes
      .map((code) => getActivityByCode(code))
      .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity))
      .map((activity) => `${activity.code} - ${activity.title}`),
    traitLabels: input.selectedTraits
      .map((code) => getOrganizationTraitByCode(code))
      .filter((trait): trait is NonNullable<typeof trait> => Boolean(trait))
      .map((trait) => trait.label),
    shortDescription: input.shortDescription?.trim() || null,
  };
}
