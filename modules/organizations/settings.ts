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
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
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
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
  prompt_summary: string;
  snapshot_json: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type OrganizationSettingsData = {
  organization: {
    id: string;
    slug: string;
    name: string;
    countryCode: string;
    baseCurrency: string;
    defaultLocale: string;
    taxId: string | null;
    legalEntityType: string | null;
    taxRegimeCode: string | null;
    vatRegime: string | null;
    dgiGroup: string | null;
    cfeStatus: string | null;
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

async function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    action: string;
    beforeJson?: Record<string, unknown>;
    afterJson?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "organization",
      entity_id: input.organizationId,
      action: input.action,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      metadata: input.metadata ?? {},
    });
}

async function loadOrganizationRow(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, slug, name, country_code, base_currency, default_locale, tax_id, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status",
    )
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
    baseCurrency: data.base_currency as string,
    defaultLocale: data.default_locale as string,
    taxId: (data.tax_id as string | null) ?? null,
    legalEntityType: (data.legal_entity_type as string | null) ?? null,
    taxRegimeCode: (data.tax_regime_code as string | null) ?? null,
    vatRegime: (data.vat_regime as string | null) ?? null,
    dgiGroup: (data.dgi_group as string | null) ?? null,
    cfeStatus: (data.cfe_status as string | null) ?? null,
  };
}

export async function loadOrganizationSettingsData(organizationId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const [organization, profileResult, snapshotResult] = await Promise.all([
    loadOrganizationRow(supabase, organizationId),
    supabase
      .from("organization_profile_versions")
      .select(
        "id, version_number, status, effective_from, effective_to, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, country_code, tax_id, profile_summary, change_reason, created_at",
      )
      .eq("organization_id", organizationId)
      .order("version_number", { ascending: false })
      .limit(12),
    supabase
      .from("organization_rule_snapshots")
      .select(
        "id, version_number, status, effective_from, effective_to, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, prompt_summary, snapshot_json, metadata, created_at",
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
      snapshot_json: asRecord(snapshot.snapshot_json),
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

export async function updateOrganizationBasics(input: {
  organizationId: string;
  actorId: string | null;
  name: string;
  countryCode: string;
  baseCurrency: string;
  defaultLocale: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const current = await loadOrganizationRow(supabase, input.organizationId);
  const name = input.name.trim();
  const countryCode = input.countryCode.trim().toUpperCase();
  const baseCurrency = input.baseCurrency.trim().toUpperCase();
  const defaultLocale = input.defaultLocale.trim();

  if (name.length < 2) {
    throw new Error("El nombre de la organizacion debe tener al menos 2 caracteres.");
  }

  if (countryCode.length !== 2) {
    throw new Error("El codigo de pais debe tener 2 letras.");
  }

  if (baseCurrency.length !== 3) {
    throw new Error("La moneda base debe tener 3 letras.");
  }

  if (!defaultLocale) {
    throw new Error("La locale por defecto es obligatoria.");
  }

  const patch = {
    name,
    country_code: countryCode,
    base_currency: baseCurrency,
    default_locale: defaultLocale,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", input.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "organization:update_basics",
    beforeJson: {
      name: current.name,
      country_code: current.countryCode,
      base_currency: current.baseCurrency,
      default_locale: current.defaultLocale,
    },
    afterJson: {
      name,
      country_code: countryCode,
      base_currency: baseCurrency,
      default_locale: defaultLocale,
    },
  });
}

export async function activateOrganizationProfileVersion(input: {
  organizationId: string;
  actorId: string | null;
  legalEntityType: string;
  taxId: string;
  taxRegimeCode: string;
  vatRegime: string;
  dgiGroup: string;
  cfeStatus: string;
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
      vat_regime: input.vatRegime,
      dgi_group: input.dgiGroup,
      cfe_status: input.cfeStatus,
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
      vat_regime: input.vatRegime,
      dgi_group: input.dgiGroup,
      cfe_status: input.cfeStatus,
      country_code: "UY",
      tax_id: input.taxId,
      profile_summary:
        `Pais: UY. Forma juridica: ${input.legalEntityType}. `
        + `Regimen tributario: ${input.taxRegimeCode}. `
        + `Regimen IVA: ${input.vatRegime}. `
        + `Grupo DGI: ${input.dgiGroup}. `
        + `Estado CFE: ${input.cfeStatus}.`,
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
