import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPartyCreatePayload,
  buildPartyIdentifierPayload,
  normalizePartyIdentifierValue,
  normalizePartyName,
} from "@/modules/directory/service";
import type { PartyIdentifierType } from "@/modules/directory/types";
import {
  integrationTables,
  upsertIntegrationEntityLink,
} from "@/modules/integrations/repository";
import {
  normalizeZetaContact,
  type ZetaContactCandidate,
} from "@/modules/integrations/zeta/normalizers/contact";
import type { JsonRecord } from "@/modules/integrations/zeta/normalizers/common";

type PartyRow = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  tax_id_normalized: string | null;
  country_code: string | null;
  source: string | null;
  status: string | null;
  metadata_json: JsonRecord | null;
};

export type ZetaContactMaterializationSummary = {
  seen: number;
  created: number;
  updated: number;
  skipped: number;
  rolesUpserted: number;
  identifiersUpserted: number;
  linksUpserted: number;
  failed: number;
  warnings: string[];
};

export type ZetaContactMaterializationProgress = {
  stage: "zeta_contacts_materialization";
  seen: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  rolesUpserted: number;
  identifiersUpserted: number;
  linksUpserted: number;
  failed: number;
};

const provider = "zetasoftware";

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function mergeZetaMetadata(existing: JsonRecord | null | undefined, contact: ZetaContactCandidate) {
  return {
    ...asRecord(existing),
    integration_provider: provider,
    integration_status: contact.status === "active" ? "synced" : "inactive_at_source",
    zeta_external_key: contact.externalKey,
    zeta_contact_code: contact.externalKey,
    zeta_contact_roles: contact.roles,
    zeta_registered_at: contact.registeredAt,
    zeta_contact_address: {
      country_code: contact.countryCode,
      department: contact.department,
      city: contact.city,
      address: contact.address,
      postal_code: contact.postalCode,
    },
    zeta_contact_emails: contact.emails,
    zeta_last_synced_at: nowIso(),
  };
}

function shouldUseZetaName(row: PartyRow | null) {
  if (!row) {
    return true;
  }

  const source = row.source ?? "";

  return source === provider
    || source === "zeta"
    || !compactText(row.display_name)
    || !compactText(row.legal_name);
}

async function findLinkedParty(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    externalKey: string;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.entityLinks)
    .select("local_entity_id")
    .eq("organization_id", input.organizationId)
    .eq("provider", provider)
    .eq("external_entity_type", "contact")
    .eq("external_key", input.externalKey)
    .eq("local_entity_type", "party")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const partyId = (data as { local_entity_id?: string | null } | null)?.local_entity_id;

  return partyId ?? null;
}

async function loadPartyById(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    partyId: string;
  },
) {
  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, tax_id_normalized, country_code, source, status, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.partyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PartyRow | null) ?? null;
}

async function findPartyByTaxId(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    taxIdNormalized: string | null;
  },
) {
  if (!input.taxIdNormalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, tax_id_normalized, country_code, source, status, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("tax_id_normalized", input.taxIdNormalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PartyRow | null) ?? null;
}

async function findPartyByZetaCode(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    externalKey: string;
  },
) {
  const normalizedCode = normalizePartyIdentifierValue("zeta_contact_code", input.externalKey);

  if (!normalizedCode) {
    return null;
  }

  const { data, error } = await supabase
    .from("party_identifiers")
    .select("party_id")
    .eq("organization_id", input.organizationId)
    .eq("identifier_type", "zeta_contact_code")
    .eq("identifier_value_normalized", normalizedCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const partyId = (data as { party_id?: string | null } | null)?.party_id;

  return partyId
    ? loadPartyById(supabase, {
        organizationId: input.organizationId,
        partyId,
      })
    : null;
}

async function findPartyByZetaMetadata(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    externalKey: string;
  },
) {
  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, tax_id_normalized, country_code, source, status, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("metadata_json->>zeta_external_key", input.externalKey)
    .limit(2);

  if (error) {
    throw new Error(error.message);
  }

  const activeMatches = ((data as PartyRow[] | null) ?? []).filter((row) =>
    row.status !== "archived");

  return activeMatches.length === 1 ? activeMatches[0] : null;
}

async function findPartyByExactName(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    normalizedName: string | null;
  },
) {
  if (!input.normalizedName) {
    return null;
  }

  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name, tax_id, tax_id_normalized, country_code, source, status, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("normalized_name", input.normalizedName)
    .limit(2);

  if (error) {
    throw new Error(error.message);
  }

  const activeMatches = ((data as PartyRow[] | null) ?? []).filter((row) =>
    row.status !== "archived");

  return activeMatches.length === 1 ? activeMatches[0] : null;
}

type PartyResolution = {
  party: PartyRow | null;
  matchMethod: string;
  confidence: number;
};

async function resolveExistingParty(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    contact: ZetaContactCandidate;
  },
): Promise<PartyResolution> {
  const linkedPartyId = await findLinkedParty(supabase, {
    organizationId: input.organizationId,
    externalKey: input.contact.externalKey,
  });

  if (linkedPartyId) {
    return {
      party: await loadPartyById(supabase, {
        organizationId: input.organizationId,
        partyId: linkedPartyId,
      }),
      matchMethod: "existing_zeta_contact_link",
      confidence: 0.99,
    };
  }

  const taxMatch = await findPartyByTaxId(supabase, {
    organizationId: input.organizationId,
    taxIdNormalized: input.contact.taxIdNormalized,
  });

  if (taxMatch) {
    return {
      party: taxMatch,
      matchMethod: "rut_or_document_exact",
      confidence: 0.98,
    };
  }

  const zetaCodeMatch = await findPartyByZetaCode(supabase, {
    organizationId: input.organizationId,
    externalKey: input.contact.externalKey,
  });

  if (zetaCodeMatch) {
    return {
      party: zetaCodeMatch,
      matchMethod: "zeta_contact_code",
      confidence: 0.92,
    };
  }

  const zetaMetadataMatch = await findPartyByZetaMetadata(supabase, {
    organizationId: input.organizationId,
    externalKey: input.contact.externalKey,
  });

  if (zetaMetadataMatch) {
    return {
      party: zetaMetadataMatch,
      matchMethod: "zeta_metadata_external_key",
      confidence: 0.9,
    };
  }

  if (!input.contact.taxIdNormalized) {
    const nameMatch = await findPartyByExactName(supabase, {
      organizationId: input.organizationId,
      normalizedName: normalizePartyName(input.contact.displayName),
    });

    if (nameMatch) {
      return {
        party: nameMatch,
        matchMethod: "name_exact_without_tax_id",
        confidence: 0.82,
      };
    }
  }

  return {
    party: null,
    matchMethod: "created_from_zeta_contact",
    confidence: 0.78,
  };
}

async function createParty(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    contact: ZetaContactCandidate;
    actorUserId?: string | null;
  },
) {
  const payload = buildPartyCreatePayload({
    organizationId: input.organizationId,
    displayName: input.contact.displayName,
    legalName: input.contact.legalName ?? input.contact.displayName,
    taxId: input.contact.taxId,
    countryCode: input.contact.countryCode ?? "UY",
    source: provider,
    metadata: mergeZetaMetadata({}, input.contact),
    actorId: input.actorUserId ?? null,
  });
  const { data, error } = await supabase
    .from("parties")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return String((data as { id: string }).id);
}

async function updateParty(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    contact: ZetaContactCandidate;
    party: PartyRow;
    actorUserId?: string | null;
  },
) {
  const useZetaName = shouldUseZetaName(input.party);
  const displayName = useZetaName
    ? input.contact.displayName
    : compactText(input.party.display_name) ?? input.contact.displayName;
  const legalName = useZetaName
    ? input.contact.legalName ?? input.contact.displayName
    : compactText(input.party.legal_name) ?? input.contact.legalName ?? input.contact.displayName;
  const { error } = await supabase
    .from("parties")
    .update({
      display_name: displayName,
      legal_name: legalName,
      normalized_name: normalizePartyName(displayName),
      tax_id: input.contact.taxId ?? input.party.tax_id,
      tax_id_normalized: input.contact.taxIdNormalized ?? input.party.tax_id_normalized,
      country_code: input.contact.countryCode ?? input.party.country_code ?? "UY",
      source: input.party.source ?? provider,
      status: input.party.status === "archived" ? "archived" : input.contact.status,
      metadata_json: mergeZetaMetadata(input.party.metadata_json, input.contact),
      updated_by: input.actorUserId ?? null,
      updated_at: nowIso(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.party.id);

  if (error) {
    throw new Error(error.message);
  }
}

function buildRolePayloads(input: {
  organizationId: string;
  partyId: string;
  contact: ZetaContactCandidate;
  actorUserId?: string | null;
}) {
  return input.contact.roles.map((roleType) => ({
    organization_id: input.organizationId,
    party_id: input.partyId,
    role_type: roleType,
    status: input.contact.status === "active" ? "active" : "archived",
    metadata_json: {
      provider,
      source: "RESTContactosV3Query",
      zeta_external_key: input.contact.externalKey,
    },
    created_by: input.actorUserId ?? null,
    updated_at: nowIso(),
  }));
}

function identifierPayload(input: {
  organizationId: string;
  partyId: string;
  type: PartyIdentifierType;
  value: string | null;
  isPrimary?: boolean;
  actorUserId?: string | null;
  metadata?: JsonRecord;
}) {
  if (!input.value) {
    return null;
  }

  if (!normalizePartyIdentifierValue(input.type, input.value)) {
    return null;
  }

  return buildPartyIdentifierPayload({
    organizationId: input.organizationId,
    partyId: input.partyId,
    identifierType: input.type,
    identifierValue: input.value,
    countryCode: input.type === "rut" || input.type === "tax_id" ? "UY" : null,
    isPrimary: input.isPrimary ?? false,
    source: provider,
    metadata: input.metadata,
    actorId: input.actorUserId ?? null,
  });
}

function buildIdentifierPayloads(input: {
  organizationId: string;
  partyId: string;
  contact: ZetaContactCandidate;
  actorUserId?: string | null;
}) {
  const identifiers = [
    identifierPayload({
      organizationId: input.organizationId,
      partyId: input.partyId,
      type: "zeta_contact_code",
      value: input.contact.externalKey,
      metadata: { provider, source: "RESTContactosV3Query" },
      actorUserId: input.actorUserId,
    }),
    input.contact.taxIdentifierType
      ? identifierPayload({
          organizationId: input.organizationId,
          partyId: input.partyId,
          type: input.contact.taxIdentifierType,
          value: input.contact.taxId,
          isPrimary: true,
          metadata: { provider, zeta_external_key: input.contact.externalKey },
          actorUserId: input.actorUserId,
        })
      : null,
    input.contact.roles.includes("customer")
      ? identifierPayload({
          organizationId: input.organizationId,
          partyId: input.partyId,
          type: "zeta_customer_code",
          value: input.contact.externalKey,
          metadata: { provider, zeta_external_key: input.contact.externalKey },
          actorUserId: input.actorUserId,
        })
      : null,
    input.contact.roles.includes("vendor")
      ? identifierPayload({
          organizationId: input.organizationId,
          partyId: input.partyId,
          type: "zeta_supplier_code",
          value: input.contact.externalKey,
          metadata: { provider, zeta_external_key: input.contact.externalKey },
          actorUserId: input.actorUserId,
        })
      : null,
  ];

  return identifiers.filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));
}

async function upsertRoles(
  supabase: SupabaseClient,
  payloads: JsonRecord[],
) {
  if (payloads.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("party_roles")
    .upsert(payloads, {
      onConflict: "organization_id,party_id,role_type",
    });

  if (error) {
    throw new Error(error.message);
  }

  return payloads.length;
}

async function upsertIdentifiers(
  supabase: SupabaseClient,
  payloads: JsonRecord[],
) {
  if (payloads.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("party_identifiers")
    .upsert(payloads, {
      onConflict: "organization_id,identifier_type,identifier_value_normalized",
    });

  if (error) {
    throw new Error(error.message);
  }

  return payloads.length;
}

async function materializeOneContact(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    contact: ZetaContactCandidate;
    runId?: string | null;
    actorUserId?: string | null;
  },
) {
  const resolution = await resolveExistingParty(supabase, {
    organizationId: input.organizationId,
    contact: input.contact,
  });
  const existing = resolution.party;
  let partyId = existing?.id ?? null;
  let created = false;

  if (!partyId) {
    partyId = await createParty(supabase, {
      organizationId: input.organizationId,
      contact: input.contact,
      actorUserId: input.actorUserId,
    });
    created = true;
  } else if (existing) {
    await updateParty(supabase, {
      organizationId: input.organizationId,
      contact: input.contact,
      party: existing,
      actorUserId: input.actorUserId,
    });
  }

  const rolesUpserted = await upsertRoles(
    supabase,
    buildRolePayloads({
      organizationId: input.organizationId,
      partyId,
      contact: input.contact,
      actorUserId: input.actorUserId,
    }),
  );
  const identifiersUpserted = await upsertIdentifiers(
    supabase,
    buildIdentifierPayloads({
      organizationId: input.organizationId,
      partyId,
      contact: input.contact,
      actorUserId: input.actorUserId,
    }),
  );

  await upsertIntegrationEntityLink(supabase, {
    organizationId: input.organizationId,
    provider,
    externalEntityType: "contact",
    externalKey: input.contact.externalKey,
    localEntityType: "party",
    localEntityId: partyId,
    matchMethod: created ? "created_from_zeta_contact" : resolution.matchMethod,
    confidence: created ? 0.78 : resolution.confidence,
    status: input.contact.status === "active" ? "active" : "inactive",
    createdByRunId: input.runId ?? null,
    metadata: {
      contact_name: input.contact.displayName,
      contact_tax_id: input.contact.taxId,
      contact_roles: input.contact.roles,
      source: "RESTContactosV3Query",
    },
  });

  return {
    created,
    rolesUpserted,
    identifiersUpserted,
  };
}

export async function materializeZetaContacts(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    contacts: unknown[];
    runId?: string | null;
    actorUserId?: string | null;
    includeInactive?: boolean;
    progressEvery?: number | null;
    onProgress?: (progress: ZetaContactMaterializationProgress) => void | Promise<void>;
  },
): Promise<ZetaContactMaterializationSummary> {
  const summary: ZetaContactMaterializationSummary = {
    seen: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    rolesUpserted: 0,
    identifiersUpserted: 0,
    linksUpserted: 0,
    failed: 0,
    warnings: [],
  };
  const includeInactive = input.includeInactive ?? true;
  const total = input.contacts.length;
  const progressEvery = Math.max(1, Math.trunc(input.progressEvery ?? 100));

  const emitProgress = async (force = false) => {
    if (!input.onProgress) {
      return;
    }

    if (!force && summary.seen % progressEvery !== 0) {
      return;
    }

    await input.onProgress({
      stage: "zeta_contacts_materialization",
      seen: summary.seen,
      total,
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
      rolesUpserted: summary.rolesUpserted,
      identifiersUpserted: summary.identifiersUpserted,
      linksUpserted: summary.linksUpserted,
      failed: summary.failed,
    });
  };

  for (const raw of input.contacts) {
    const contact = normalizeZetaContact(raw);
    summary.seen += 1;

    if (contact.status !== "active" && !includeInactive) {
      summary.skipped += 1;
      await emitProgress();
      continue;
    }

    try {
      const result = await materializeOneContact(supabase, {
        organizationId: input.organizationId,
        contact,
        runId: input.runId,
        actorUserId: input.actorUserId,
      });

      if (result.created) {
        summary.created += 1;
      } else {
        summary.updated += 1;
      }

      summary.rolesUpserted += result.rolesUpserted;
      summary.identifiersUpserted += result.identifiersUpserted;
      summary.linksUpserted += 1;
    } catch (error) {
      summary.failed += 1;
      summary.warnings.push(
        error instanceof Error
          ? `Contacto Zeta ${contact.externalKey}: ${error.message}`
          : `Contacto Zeta ${contact.externalKey}: no se pudo materializar.`,
      );
    }

    await emitProgress();
  }

  await emitProgress(true);

  return summary;
}
