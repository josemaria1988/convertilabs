import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { materializeOrganizationRuleSnapshot } from "@/modules/organizations/rule-snapshots";

type ProfileVersionRow = {
  id: string;
  version_number: number;
  status: string;
  effective_from: string;
  effective_to: string | null;
  legal_entity_type: string;
  tax_regime_code: string;
  country_code: string;
  tax_id: string;
  profile_summary: string | null;
  change_reason: string | null;
  created_at: string;
};

type RuleSnapshotRow = {
  id: string;
  version_number: number;
  status: string;
  effective_from: string;
  effective_to: string | null;
  legal_entity_type: string;
  tax_regime_code: string;
  prompt_summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type OrganizationSettingsData = {
  organization: {
    id: string;
    slug: string;
    name: string;
    countryCode: string;
    taxId: string | null;
    legalEntityType: string | null;
    taxRegimeCode: string | null;
  };
  activeProfile: ProfileVersionRow | null;
  profileHistory: ProfileVersionRow[];
  activeRuleSnapshot: RuleSnapshotRow | null;
  ruleSnapshotHistory: RuleSnapshotRow[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function previousDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function loadOrganizationRow(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, country_code, tax_id, legal_entity_type, tax_regime_code")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Organizacion no encontrada.");
  }

  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    countryCode: data.country_code as string,
    taxId: (data.tax_id as string | null) ?? null,
    legalEntityType: (data.legal_entity_type as string | null) ?? null,
    taxRegimeCode: (data.tax_regime_code as string | null) ?? null,
  };
}

export async function loadOrganizationSettingsData(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const [organization, profileResult, snapshotResult] = await Promise.all([
    loadOrganizationRow(supabase, organizationId),
    supabase
      .from("organization_profile_versions")
      .select(
        "id, version_number, status, effective_from, effective_to, legal_entity_type, tax_regime_code, country_code, tax_id, profile_summary, change_reason, created_at",
      )
      .eq("organization_id", organizationId)
      .order("version_number", { ascending: false })
      .limit(12),
    supabase
      .from("organization_rule_snapshots")
      .select(
        "id, version_number, status, effective_from, effective_to, legal_entity_type, tax_regime_code, prompt_summary, metadata, created_at",
      )
      .eq("organization_id", organizationId)
      .order("version_number", { ascending: false })
      .limit(12),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (snapshotResult.error) {
    throw new Error(snapshotResult.error.message);
  }

  const profileHistory = ((profileResult.data as ProfileVersionRow[] | null) ?? []);
  const ruleSnapshotHistory = (((snapshotResult.data as RuleSnapshotRow[] | null) ?? [])).map(
    (snapshot) => ({
      ...snapshot,
      metadata: asRecord(snapshot.metadata),
    }),
  );

  return {
    organization,
    activeProfile: profileHistory.find((profile) => profile.status === "active") ?? null,
    profileHistory,
    activeRuleSnapshot:
      ruleSnapshotHistory.find((snapshot) => snapshot.status === "active") ?? null,
    ruleSnapshotHistory,
  } satisfies OrganizationSettingsData;
}

export async function activateOrganizationProfileVersion(input: {
  organizationId: string;
  actorId: string | null;
  legalEntityType: string;
  taxId: string;
  taxRegimeCode: string;
  effectiveFrom: string;
  changeReason: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const settingsData = await loadOrganizationSettingsData(input.organizationId);
  const activeProfile = settingsData.activeProfile;
  const nextProfileVersionNumber = settingsData.profileHistory.length > 0
    ? Math.max(...settingsData.profileHistory.map((profile) => profile.version_number)) + 1
    : 1;

  if (activeProfile) {
    const { error: supersedeProfileError } = await supabase
      .from("organization_profile_versions")
      .update({
        status: "superseded",
        effective_to: previousDay(input.effectiveFrom),
      })
      .eq("id", activeProfile.id);

    if (supersedeProfileError) {
      throw new Error(supersedeProfileError.message);
    }
  }

  if (settingsData.activeRuleSnapshot) {
    const { error: supersedeSnapshotError } = await supabase
      .from("organization_rule_snapshots")
      .update({
        status: "superseded",
        effective_to: previousDay(input.effectiveFrom),
      })
      .eq("id", settingsData.activeRuleSnapshot.id);

    if (supersedeSnapshotError) {
      throw new Error(supersedeSnapshotError.message);
    }
  }

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({
      legal_entity_type: input.legalEntityType,
      tax_id: input.taxId,
      tax_regime_code: input.taxRegimeCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.organizationId);

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  const { error: insertProfileError } = await supabase
    .from("organization_profile_versions")
    .insert({
      organization_id: input.organizationId,
      version_number: nextProfileVersionNumber,
      status: "active",
      effective_from: input.effectiveFrom,
      legal_entity_type: input.legalEntityType,
      tax_regime_code: input.taxRegimeCode,
      country_code: "UY",
      tax_id: input.taxId,
      profile_summary: `Pais: UY. Forma juridica: ${input.legalEntityType}. Regimen: ${input.taxRegimeCode}.`,
      change_reason: input.changeReason,
      profile_json: {
        activated_from_settings: true,
      },
      created_by: input.actorId,
      approved_by: input.actorId,
      approved_at: new Date().toISOString(),
    });

  if (insertProfileError) {
    throw new Error(insertProfileError.message);
  }

  await materializeOrganizationRuleSnapshot(
    supabase,
    input.organizationId,
    input.actorId,
  );
}
