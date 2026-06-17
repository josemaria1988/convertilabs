import type {
  PartyCreatePayload,
  PartyIdentifierPayload,
  PartyIdentifierType,
  PartyRolePayload,
  PartyRoleType,
} from "@/modules/directory/types";
import {
  buildPartyCreatePayload,
  buildPartyIdentifierPayload,
  buildPartyRolePayload,
} from "@/modules/directory/service";

export type LegacyVendorRow = {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string | null;
  tax_id_normalized: string | null;
  name_normalized?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LegacyCustomerRow = {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string | null;
  tax_id_normalized: string | null;
  name_normalized?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LegacyPartyBridgePayload = {
  party: PartyCreatePayload & {
    legacy_vendor_id?: string | null;
    legacy_customer_id?: string | null;
    metadata: Record<string, unknown>;
  };
  role: PartyRolePayload;
  identifier: PartyIdentifierPayload | null;
};

function asMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function buildIdentifier(input: {
  organizationId: string;
  partyId: string;
  taxId: string | null;
  taxIdNormalized: string | null;
  source: string;
  actorId?: string | null;
}) {
  const value = input.taxId ?? input.taxIdNormalized;

  if (!value) {
    return null;
  }

  return buildPartyIdentifierPayload({
    organizationId: input.organizationId,
    partyId: input.partyId,
    identifierType: "rut" satisfies PartyIdentifierType,
    identifierValue: value,
    countryCode: "UY",
    isPrimary: true,
    source: input.source,
    actorId: input.actorId ?? null,
  });
}

function buildLegacyPartyPayload(input: {
  id: string;
  organizationId: string;
  name: string;
  taxId: string | null;
  taxIdNormalized: string | null;
  roleType: PartyRoleType;
  source: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
}) {
  const party = buildPartyCreatePayload({
    organizationId: input.organizationId,
    displayName: input.name,
    legalName: input.name,
    taxId: input.taxId ?? input.taxIdNormalized,
    countryCode: "UY",
    source: input.source,
    metadata: {
      ...asMetadata(input.metadata),
      legacy_source_table: input.roleType === "vendor" ? "vendors" : "customers",
      legacy_entity_id: input.id,
    },
    actorId: input.actorId ?? null,
  });

  return {
    party,
    role: buildPartyRolePayload({
      organizationId: input.organizationId,
      partyId: "__party_id__",
      roleType: input.roleType,
      metadata: {
        source: input.source,
      },
      actorId: input.actorId ?? null,
    }),
    identifier: buildIdentifier({
      organizationId: input.organizationId,
      partyId: "__party_id__",
      taxId: input.taxId,
      taxIdNormalized: input.taxIdNormalized,
      source: input.source,
      actorId: input.actorId ?? null,
    }),
  };
}

export function buildPartyBridgePayloadFromLegacyVendor(
  row: LegacyVendorRow,
  actorId?: string | null,
): LegacyPartyBridgePayload {
  const payload = buildLegacyPartyPayload({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    taxId: row.tax_id,
    taxIdNormalized: row.tax_id_normalized,
    roleType: "vendor",
    source: "legacy_vendor_bridge",
    metadata: row.metadata,
    actorId,
  });

  return {
    party: {
      ...payload.party,
      legacy_vendor_id: row.id,
      metadata: payload.party.metadata_json,
    },
    role: payload.role,
    identifier: payload.identifier,
  };
}

export function buildPartyBridgePayloadFromLegacyCustomer(
  row: LegacyCustomerRow,
  actorId?: string | null,
): LegacyPartyBridgePayload {
  const payload = buildLegacyPartyPayload({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    taxId: row.tax_id,
    taxIdNormalized: row.tax_id_normalized,
    roleType: "customer",
    source: "legacy_customer_bridge",
    metadata: row.metadata,
    actorId,
  });

  return {
    party: {
      ...payload.party,
      legacy_customer_id: row.id,
      metadata: payload.party.metadata_json,
    },
    role: payload.role,
    identifier: payload.identifier,
  };
}

export function bindLegacyPartyPayloadIds(
  payload: LegacyPartyBridgePayload,
  partyId: string,
): LegacyPartyBridgePayload {
  return {
    party: payload.party,
    role: {
      ...payload.role,
      party_id: partyId,
    },
    identifier: payload.identifier
      ? {
          ...payload.identifier,
          party_id: partyId,
        }
      : null,
  };
}
