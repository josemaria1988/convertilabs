import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asRecord,
  asString,
  asStringArray,
  computeTokenOverlapScore,
  normalizeTaxId,
  normalizeTextToken,
} from "@/modules/accounting/normalization";

export type OrganizationIdentityAliasType =
  | "legal_name"
  | "trade_name"
  | "billing_name"
  | "other";

export type OrganizationIdentityAlias = {
  aliasType: OrganizationIdentityAliasType;
  value: string;
  normalizedValue: string;
  source: "organization" | "profile" | "metadata" | "input";
};

export type OrganizationIdentityProfile = {
  organizationId: string;
  legalName: string | null;
  taxId: string | null;
  taxIdNormalized: string | null;
  aliases: OrganizationIdentityAlias[];
};

export type OrganizationIdentityMatch = {
  status: "matched" | "tentative" | "not_matched" | "ambiguous";
  strategy: "tax_id" | "exact_alias" | "token_overlap" | "none" | "ambiguous";
  matchedAlias: string | null;
  normalizedTaxId: string | null;
  normalizedName: string | null;
  confidence: number;
  evidence: string[];
};

type OrganizationRow = {
  id: string;
  name: string;
  tax_id: string | null;
  metadata: Record<string, unknown> | null;
};

type OrganizationProfileVersionRow = {
  profile_json: Record<string, unknown> | null;
  tax_id: string;
};

type OrganizationIdentityInput = {
  organizationId: string;
  legalName: string | null;
  taxId: string | null;
  aliases?: Array<
    string
    | {
        aliasType?: OrganizationIdentityAliasType;
        value: string;
        source?: OrganizationIdentityAlias["source"];
      }
  >;
  metadata?: Record<string, unknown> | null;
  profileJson?: Record<string, unknown> | null;
};

const organizationLegalSuffixPatterns = [
  /\bsociedad por acciones simplificada\b/g,
  /\bsociedad anonima\b/g,
  /\bsociedad limitada\b/g,
  /\bresponsabilidad limitada\b/g,
  /\bcompan[ií]a\b/g,
  /\bcompania\b/g,
  /\blia?mitada\b/g,
  /\banonima\b/g,
  /\bsas\b/g,
  /\bsrl\b/g,
  /\bltda\b/g,
  /\bsa\b/g,
] as const;

function normalizeOrganizationIdentityName(value: string | null | undefined) {
  const normalized = normalizeTextToken(value);

  if (!normalized) {
    return null;
  }

  const stripped = organizationLegalSuffixPatterns.reduce((current, pattern) => (
    current.replace(pattern, " ")
  ), normalized);
  const compact = stripped.replace(/\s+/g, " ").trim();

  return compact || normalized;
}

function buildAlias(
  aliasType: OrganizationIdentityAliasType,
  value: string | null | undefined,
  source: OrganizationIdentityAlias["source"],
) {
  const trimmedValue = value?.trim();
  const normalizedValue = normalizeOrganizationIdentityName(trimmedValue);

  if (!trimmedValue || !normalizedValue) {
    return null;
  }

  return {
    aliasType,
    value: trimmedValue,
    normalizedValue,
    source,
  } satisfies OrganizationIdentityAlias;
}

function extractAliasesFromUnknown(
  value: unknown,
  source: OrganizationIdentityAlias["source"],
) {
  if (typeof value === "string") {
    return [buildAlias("other", value, source)].filter(
      (alias): alias is OrganizationIdentityAlias => alias !== null,
    );
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      const alias = buildAlias("other", entry, source);
      return alias ? [alias] : [];
    }

    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const aliasType =
      record.aliasType === "legal_name"
      || record.aliasType === "trade_name"
      || record.aliasType === "billing_name"
      || record.aliasType === "other"
        ? record.aliasType
        : "other";
    const alias = buildAlias(aliasType, asString(record.value), source);

    return alias ? [alias] : [];
  });
}

function extractAliasesFromRecord(
  value: Record<string, unknown> | null | undefined,
  source: OrganizationIdentityAlias["source"],
) {
  if (!value) {
    return [];
  }

  return [
    buildAlias("trade_name", asString(value.trade_name), source),
    buildAlias("billing_name", asString(value.billing_name), source),
    buildAlias("legal_name", asString(value.legal_name), source),
    buildAlias("other", asString(value.organization_name), source),
    ...extractAliasesFromUnknown(value.identity_aliases, source),
    ...extractAliasesFromUnknown(value.aliases, source),
    ...asStringArray(value.identity_aliases).map((entry) => (
      buildAlias("other", entry, source)
    )),
  ].filter((alias): alias is OrganizationIdentityAlias => alias !== null);
}

export function buildOrganizationIdentityProfile(input: OrganizationIdentityInput) {
  const aliases = [
    buildAlias("legal_name", input.legalName, "organization"),
    ...extractAliasesFromRecord(input.metadata, "metadata"),
    ...extractAliasesFromRecord(input.profileJson, "profile"),
    ...(input.aliases ?? []).flatMap((entry) => {
      if (typeof entry === "string") {
        const alias = buildAlias("other", entry, "input");
        return alias ? [alias] : [];
      }

      const alias = buildAlias(
        entry.aliasType ?? "other",
        entry.value,
        entry.source ?? "input",
      );

      return alias ? [alias] : [];
    }),
  ].filter((alias): alias is OrganizationIdentityAlias => alias !== null);
  const dedupedAliases = Array.from(new Map(
    aliases.map((alias) => [alias.normalizedValue, alias]),
  ).values());

  return {
    organizationId: input.organizationId,
    legalName: input.legalName?.trim() || null,
    taxId: input.taxId?.trim() || null,
    taxIdNormalized: normalizeTaxId(input.taxId),
    aliases: dedupedAliases,
  } satisfies OrganizationIdentityProfile;
}

export function matchOrganizationIdentity(input: {
  identity: OrganizationIdentityProfile;
  partyName: string | null | undefined;
  partyTaxId: string | null | undefined;
}) {
  const normalizedTaxId = normalizeTaxId(input.partyTaxId);
  const normalizedName = normalizeOrganizationIdentityName(input.partyName);

  if (normalizedTaxId && input.identity.taxIdNormalized) {
    if (normalizedTaxId === input.identity.taxIdNormalized) {
      return {
        status: "matched",
        strategy: "tax_id",
        matchedAlias: null,
        normalizedTaxId,
        normalizedName,
        confidence: 1,
        evidence: ["El RUT normalizado coincide con la organizacion."],
      } satisfies OrganizationIdentityMatch;
    }

    return {
      status: "not_matched",
      strategy: "none",
      matchedAlias: null,
      normalizedTaxId,
      normalizedName,
      confidence: 0,
      evidence: ["El RUT presente no coincide con la organizacion."],
    } satisfies OrganizationIdentityMatch;
  }

  if (!normalizedName) {
    return {
      status: "not_matched",
      strategy: "none",
      matchedAlias: null,
      normalizedTaxId,
      normalizedName,
      confidence: 0,
      evidence: ["No hubo nombre ni RUT suficientes para comparar con la organizacion."],
    } satisfies OrganizationIdentityMatch;
  }

  const exactAliasMatch = input.identity.aliases.find((alias) => (
    alias.normalizedValue === normalizedName
  ));

  if (exactAliasMatch) {
    return {
      status: "matched",
      strategy: "exact_alias",
      matchedAlias: exactAliasMatch.value,
      normalizedTaxId,
      normalizedName,
      confidence: 0.92,
      evidence: [`El nombre coincide exactamente con el alias ${exactAliasMatch.value}.`],
    } satisfies OrganizationIdentityMatch;
  }

  const overlapMatches = input.identity.aliases
    .map((alias) => ({
      alias,
      score: computeTokenOverlapScore(alias.normalizedValue, normalizedName),
    }))
    .filter((entry) => entry.score >= 0.75)
    .sort((a, b) => b.score - a.score);

  if (overlapMatches.length > 1 && overlapMatches[0].score === overlapMatches[1].score) {
    return {
      status: "ambiguous",
      strategy: "ambiguous",
      matchedAlias: null,
      normalizedTaxId,
      normalizedName,
      confidence: overlapMatches[0].score,
      evidence: ["Mas de un alias fuerte de la organizacion coincide con el nombre detectado."],
    } satisfies OrganizationIdentityMatch;
  }

  if (overlapMatches.length > 0) {
    const strongestMatch = overlapMatches[0];

    return {
      status: "tentative",
      strategy: "token_overlap",
      matchedAlias: strongestMatch.alias.value,
      normalizedTaxId,
      normalizedName,
      confidence: Math.round(strongestMatch.score * 100) / 100,
      evidence: [
        `El nombre comparte tokens fuertes con el alias ${strongestMatch.alias.value}.`,
      ],
    } satisfies OrganizationIdentityMatch;
  }

  return {
    status: "not_matched",
    strategy: "none",
    matchedAlias: null,
    normalizedTaxId,
    normalizedName,
    confidence: 0,
    evidence: ["No hubo coincidencias fuertes de nombre con la organizacion."],
  } satisfies OrganizationIdentityMatch;
}

export function buildOrganizationIdentityPromptContext(identity: OrganizationIdentityProfile) {
  const aliasLine = identity.aliases.length > 0
    ? identity.aliases.map((alias) => alias.value).join(" | ")
    : "Sin aliases adicionales.";

  return [
    `Organization legal name: ${identity.legalName ?? "unknown"}.`,
    `Organization tax id raw: ${identity.taxId ?? "unknown"}.`,
    `Organization tax id normalized: ${identity.taxIdNormalized ?? "unknown"}.`,
    `Accepted organization aliases: ${aliasLine}.`,
    "When evaluating issuer_matches_organization and receiver_matches_organization, compare names using aliases and normalized RUT first.",
  ].join("\n");
}

export async function loadOrganizationIdentityProfile(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [{ data: organization, error: organizationError }, { data: profileVersion, error: profileError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, tax_id, metadata")
        .eq("id", organizationId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("organization_profile_versions")
        .select("profile_json, tax_id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (organizationError || !organization) {
    throw new Error(organizationError?.message ?? "Organization not found for identity matching.");
  }

  if (profileError) {
    throw new Error(profileError.message);
  }

  const organizationRow = organization as OrganizationRow;
  const profileVersionRow = (profileVersion as OrganizationProfileVersionRow | null) ?? null;

  return buildOrganizationIdentityProfile({
    organizationId: organizationRow.id,
    legalName: organizationRow.name,
    taxId: profileVersionRow?.tax_id ?? organizationRow.tax_id,
    metadata: asRecord(organizationRow.metadata),
    profileJson: asRecord(profileVersionRow?.profile_json),
  });
}
