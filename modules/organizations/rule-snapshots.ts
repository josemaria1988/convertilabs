import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getUyVatFeatureFlags } from "@/modules/tax/feature-flags";

type OrganizationRow = {
  id: string;
  name: string;
  country_code: string;
  legal_entity_type: string | null;
  tax_id: string | null;
  tax_regime_code: string | null;
  vat_regime: string | null;
  dgi_group: string | null;
  cfe_status: string | null;
};

type OrganizationProfileVersionRow = {
  id: string;
  organization_id: string;
  version_number: number;
  status: string;
  effective_from: string;
  effective_to: string | null;
  legal_entity_type: string;
  tax_regime_code: string;
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
  country_code: string;
  tax_id: string;
  profile_summary: string | null;
  profile_json: Record<string, unknown> | null;
};

type TaxRuleRow = {
  id: string;
  organization_id: string | null;
  name: string;
  scope: string;
  priority: number;
  valid_from: string | null;
  valid_to: string | null;
  conditions_json: unknown;
  effects_json: unknown;
  source_reference: string | null;
};

type OrganizationRuleSnapshotRow = {
  id: string;
  organization_id: string;
  profile_version_id: string | null;
  version_number: number;
  effective_from: string;
  effective_to: string | null;
  legal_entity_type: string;
  tax_regime_code: string;
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
  prompt_summary: string;
  rules_json: unknown;
  deterministic_rule_refs_json: unknown;
  snapshot_json: Record<string, unknown> | null;
};

export type MaterializedOrganizationRuleSnapshot = {
  profileVersion: OrganizationProfileVersionRow;
  ruleSnapshot: OrganizationRuleSnapshotRow;
};

function summarizeProfile(profile: {
  legalEntityType: string;
  taxRegimeCode: string;
  vatRegime: string;
  dgiGroup: string;
  cfeStatus: string;
  countryCode: string;
  taxId: string;
}) {
  return [
    `Pais: ${profile.countryCode}.`,
    `Forma juridica: ${profile.legalEntityType}.`,
    `Regimen tributario: ${profile.taxRegimeCode}.`,
    `Regimen IVA: ${profile.vatRegime}.`,
    `Grupo DGI: ${profile.dgiGroup}.`,
    `Estado CFE: ${profile.cfeStatus}.`,
    `RUT de la organizacion: ${profile.taxId}.`,
    "V1 cubre solo IVA y procesamiento documental para Uruguay.",
  ].join(" ");
}

function buildPromptSummary(input: {
  organizationName: string;
  profile: OrganizationProfileVersionRow;
  rules: TaxRuleRow[];
}) {
  const header = [
    `Organizacion: ${input.organizationName}.`,
    `Pais: ${input.profile.country_code}.`,
    `Forma juridica: ${input.profile.legal_entity_type}.`,
    `Regimen tributario: ${input.profile.tax_regime_code}.`,
    `Regimen IVA: ${input.profile.vat_regime}.`,
    `Grupo DGI: ${input.profile.dgi_group}.`,
    `Estado CFE: ${input.profile.cfe_status}.`,
    "Solo aplica IVA de Uruguay para V1.",
    "No inventes criterio legal fuera de las reglas resumidas.",
  ].join(" ");

  const ruleLines = input.rules.length > 0
    ? input.rules.map((rule, index) => (
      `${index + 1}. ${rule.name} [scope=${rule.scope}, priority=${rule.priority}]`
      + `${rule.source_reference ? ` source=${rule.source_reference}` : ""}`
    ))
    : ["No active VAT rules were found for this organization. Extract facts only and mark manual review when needed."];

  return `${header}\n\nReglas relevantes:\n${ruleLines.join("\n")}`;
}

async function getOrganizationRow(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, country_code, legal_entity_type, tax_id, tax_regime_code, vat_regime, dgi_group, cfe_status",
    )
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Organization not found.");
  }

  return data as OrganizationRow;
}

async function getCurrentProfileVersion(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_profile_versions")
    .select(
      "id, organization_id, version_number, status, effective_from, effective_to, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, country_code, tax_id, profile_summary, profile_json",
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OrganizationProfileVersionRow | null) ?? null;
}

async function getNextVersionNumber(
  supabase: SupabaseClient,
  table: "organization_profile_versions" | "organization_rule_snapshots",
  organizationId: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("version_number")
    .eq("organization_id", organizationId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const currentVersion =
    data && typeof data.version_number === "number"
      ? data.version_number
      : 0;

  return currentVersion + 1;
}

async function createBootstrapProfileVersion(
  supabase: SupabaseClient,
  organization: OrganizationRow,
  requestedBy: string | null,
) {
  if (
    !organization.legal_entity_type
    || !organization.tax_id
    || !organization.tax_regime_code
    || !organization.vat_regime
    || !organization.dgi_group
    || !organization.cfe_status
  ) {
    throw new Error(
      "The organization is missing legal_entity_type, tax_id, tax_regime_code or fiscal VAT profile fields. Complete onboarding before processing documents.",
    );
  }

  const versionNumber = await getNextVersionNumber(
    supabase,
    "organization_profile_versions",
    organization.id,
  );
  const effectiveFrom = new Date().toISOString().slice(0, 10);
  const profileSummary = summarizeProfile({
    legalEntityType: organization.legal_entity_type,
    taxRegimeCode: organization.tax_regime_code,
    vatRegime: organization.vat_regime,
    dgiGroup: organization.dgi_group,
    cfeStatus: organization.cfe_status,
    countryCode: organization.country_code,
    taxId: organization.tax_id,
  });

  const { data, error } = await supabase
    .from("organization_profile_versions")
    .insert({
      organization_id: organization.id,
      version_number: versionNumber,
      status: "active",
      effective_from: effectiveFrom,
      legal_entity_type: organization.legal_entity_type,
      tax_regime_code: organization.tax_regime_code,
      vat_regime: organization.vat_regime,
      dgi_group: organization.dgi_group,
      cfe_status: organization.cfe_status,
      country_code: organization.country_code,
      tax_id: organization.tax_id,
      profile_summary: profileSummary,
      profile_json: {
        organization_name: organization.name,
      },
      created_by: requestedBy,
      approved_by: requestedBy,
      approved_at: new Date().toISOString(),
    })
    .select(
      "id, organization_id, version_number, status, effective_from, effective_to, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, country_code, tax_id, profile_summary, profile_json",
    )
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrganizationProfileVersionRow;
}

async function loadRelevantVatRules(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("tax_rules")
    .select(
      "id, organization_id, name, scope, priority, valid_from, valid_to, conditions_json, effects_json, source_reference",
    )
    .eq("tax_type", "VAT")
    .eq("active", true)
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as TaxRuleRow[] | null) ?? [];
}

async function getActiveRuleSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  profileVersionId: string,
) {
  const { data, error } = await supabase
    .from("organization_rule_snapshots")
    .select(
      "id, organization_id, profile_version_id, version_number, effective_from, effective_to, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, prompt_summary, rules_json, deterministic_rule_refs_json, snapshot_json",
    )
    .eq("organization_id", organizationId)
    .eq("profile_version_id", profileVersionId)
    .eq("status", "active")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as OrganizationRuleSnapshotRow | null) ?? null;
}

async function createRuleSnapshot(
  supabase: SupabaseClient,
  organization: OrganizationRow,
  profileVersion: OrganizationProfileVersionRow,
  requestedBy: string | null,
) {
  const rules = await loadRelevantVatRules(supabase, organization.id);
  const versionNumber = await getNextVersionNumber(
    supabase,
    "organization_rule_snapshots",
    organization.id,
  );
  const promptSummary = buildPromptSummary({
    organizationName: organization.name,
    profile: profileVersion,
    rules,
  });
  const deterministicRuleRefs = rules.map((rule) => ({
    id: rule.id,
    scope: rule.scope,
    priority: rule.priority,
    source_reference: rule.source_reference,
  }));
  const flags = getUyVatFeatureFlags();

  const { data, error } = await supabase
    .from("organization_rule_snapshots")
    .insert({
      organization_id: organization.id,
      profile_version_id: profileVersion.id,
      version_number: versionNumber,
      status: "active",
      effective_from: profileVersion.effective_from,
      effective_to: profileVersion.effective_to,
      legal_entity_type: profileVersion.legal_entity_type,
      tax_regime_code: profileVersion.tax_regime_code,
      vat_regime: profileVersion.vat_regime,
      dgi_group: profileVersion.dgi_group,
      cfe_status: profileVersion.cfe_status,
      country_code: profileVersion.country_code,
      prompt_summary: promptSummary,
      rules_json: rules,
      deterministic_rule_refs_json: deterministicRuleRefs,
      snapshot_json: {
        organization_profile: {
          country_code: profileVersion.country_code,
          legal_entity_type: profileVersion.legal_entity_type,
          tax_regime_code: profileVersion.tax_regime_code,
          vat_regime: profileVersion.vat_regime,
          dgi_group: profileVersion.dgi_group,
          cfe_status: profileVersion.cfe_status,
          tax_id: profileVersion.tax_id,
        },
        feature_flags: flags,
        rule_refs: deterministicRuleRefs,
        rule_names: rules.map((rule) => rule.name),
      },
      metadata: {
        materialized_from_profile_version_id: profileVersion.id,
        rule_count: rules.length,
      },
      created_by: requestedBy,
      approved_by: requestedBy,
      approved_at: new Date().toISOString(),
    })
    .select(
      "id, organization_id, profile_version_id, version_number, effective_from, effective_to, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, prompt_summary, rules_json, deterministic_rule_refs_json, snapshot_json",
    )
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrganizationRuleSnapshotRow;
}

export async function materializeOrganizationRuleSnapshot(
  supabase: SupabaseClient,
  organizationId: string,
  requestedBy: string | null,
): Promise<MaterializedOrganizationRuleSnapshot> {
  const organization = await getOrganizationRow(supabase, organizationId);
  const profileVersion =
    (await getCurrentProfileVersion(supabase, organizationId))
    ?? (await createBootstrapProfileVersion(supabase, organization, requestedBy));
  const existingSnapshot = await getActiveRuleSnapshot(
    supabase,
    organizationId,
    profileVersion.id,
  );
  const ruleSnapshot =
    existingSnapshot
    ?? (await createRuleSnapshot(supabase, organization, profileVersion, requestedBy));

  return {
    profileVersion,
    ruleSnapshot,
  };
}
