import "server-only";

import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveLocalCompanionContext, type LocalCompanionIdentity } from "@/modules/local-companion/context";

const cfeEmailConnectionsTable = "organization_cfe_email_connections";

type CfeEmailConnectionRow = {
  id: string;
  organization_id: string;
  user_id: string;
  connection_label: string;
  mailbox_email: string;
  mailbox_email_normalized: string;
  inbound_address: string;
  ingestion_mode: string;
  status: string;
  is_active: boolean;
  last_inbound_email_at: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type UserOrganizationCfeEmailConnection = {
  id: string;
  organizationId: string;
  userId: string;
  connectionLabel: string;
  mailboxEmail: string;
  mailboxEmailNormalized: string;
  inboundAddress: string;
  ingestionMode: string;
  status: string;
  isActive: boolean;
  lastInboundEmailAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    entityId: string | null;
    action: string;
    beforeJson?: Record<string, unknown>;
    afterJson?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  return supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "organization_cfe_email_connection",
      entity_id: input.entityId,
      action: input.action,
      before_json: input.beforeJson ?? null,
      after_json: input.afterJson ?? null,
      metadata: input.metadata ?? {},
    });
}

export function normalizeCfeMailboxEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidCfeMailboxEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeCfeMailboxEmail(value));
}

function resolveCfeIngressDomain(inputDomain?: string | null) {
  const explicitDomain = inputDomain?.trim().toLowerCase()
    || process.env.CFE_EMAIL_INGEST_DOMAIN?.trim().toLowerCase()
    || "";

  if (explicitDomain) {
    return explicitDomain.replace(/^@+/, "");
  }

  try {
    const appHostname = new URL(getPublicEnv().appUrl).hostname
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      !appHostname
      || appHostname === "localhost"
      || appHostname === "127.0.0.1"
      || appHostname === "::1"
    ) {
      return "mail.convertilabs.local";
    }

    return `mail.${appHostname}`;
  } catch {
    return "mail.convertilabs.com";
  }
}

export function buildCfeInboundForwardingAddress(input: {
  organizationId: string;
  userId: string;
  mailboxEmail: string;
  domain?: string | null;
}) {
  const mailboxEmail = normalizeCfeMailboxEmail(input.mailboxEmail);
  const token = createHash("sha256")
    .update(`${input.organizationId}:${input.userId}:${mailboxEmail}`)
    .digest("hex")
    .slice(0, 20);

  return `cfe+${token}@${resolveCfeIngressDomain(input.domain)}`;
}

export function formatCfeEmailConnectionStatusLabel(
  value: string | null | undefined,
  lastInboundEmailAt?: string | null,
) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "active":
      return lastInboundEmailAt && Number.isFinite(Date.parse(lastInboundEmailAt))
        ? "Recepcion registrada"
        : "Recepcion no verificada";
    case "paused":
      return "Pausada";
    case "error":
      return "Con error";
    case "verified":
      return "Lectura verificada; sin recepcion registrada";
    default:
      return "Configuracion guardada; recepcion pendiente";
  }
}

/** Registering an address is not a connection probe. A previous mailbox's
 * inbound evidence must never activate a replacement mailbox. */
export function buildCfeEmailRegistrationState(input: {
  current: Pick<UserOrganizationCfeEmailConnection,
    "mailboxEmail" | "mailboxEmailNormalized" | "inboundAddress" | "ingestionMode" | "status" | "lastInboundEmailAt" | "metadata"> | null;
  mailboxEmailNormalized: string;
  isActive: boolean;
  now: string;
}) {
  const current = input.current;
  const mailboxChanged = Boolean(current && current.mailboxEmailNormalized !== input.mailboxEmailNormalized);
  const lastInboundEmailAt = mailboxChanged ? null : current?.lastInboundEmailAt ?? null;
  const hasInboundEvidence = Boolean(lastInboundEmailAt && Number.isFinite(Date.parse(lastInboundEmailAt)));
  const status = !input.isActive ? "paused"
    : !mailboxChanged && current?.status === "error" ? "error"
      : hasInboundEvidence ? "active" : "pending_forwarding";
  const metadata: Record<string, unknown> = {
    ...current?.metadata,
    setup_source: "organization_settings",
    receives_cfe: true,
  };
  if (mailboxChanged && current) {
    metadata.mailbox_history = [
      ...(Array.isArray(current.metadata.mailbox_history) ? current.metadata.mailbox_history : []),
      { mailbox_email: current.mailboxEmail, inbound_address: current.inboundAddress,
        ingestion_mode: current.ingestionMode, status: current.status,
        last_inbound_email_at: current.lastInboundEmailAt, replaced_at: input.now,
        ...(current.metadata.local_imap ? { local_imap: current.metadata.local_imap } : {}) },
    ];
    delete metadata.local_imap;
  }
  return { status, lastInboundEmailAt, metadata };
}

export function getLocalCfeEmailLastProbe(connection: UserOrganizationCfeEmailConnection | null) {
  if (connection?.ingestionMode !== "local_imap") return null;
  const observation = asRecord(connection.metadata.local_imap);
  const at = observation.last_probe_at;
  return observation.version === 1 && observation.mailbox_email === connection.mailboxEmailNormalized
    && observation.last_probe_status === "verified" && typeof at === "string"
    && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : null;
}

function mapConnectionRow(row: CfeEmailConnectionRow): UserOrganizationCfeEmailConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    connectionLabel: row.connection_label,
    mailboxEmail: row.mailbox_email,
    mailboxEmailNormalized: row.mailbox_email_normalized,
    inboundAddress: row.inbound_address,
    ingestionMode: row.ingestion_mode,
    status: row.status,
    isActive: row.is_active,
    lastInboundEmailAt: row.last_inbound_email_at,
    metadata: asRecord(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadUserOrganizationCfeEmailConnection(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string | null | undefined;
  },
) {
  if (!input.userId) {
    return null;
  }

  const { data, error } = await supabase
    .from(cfeEmailConnectionsTable)
    .select(
      "id, organization_id, user_id, connection_label, mailbox_email, mailbox_email_normalized, inbound_address, ingestion_mode, status, is_active, last_inbound_email_at, metadata_json, created_at, updated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(error, cfeEmailConnectionsTable)) {
      return null;
    }

    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapConnectionRow(data as CfeEmailConnectionRow);
}

async function loadMailboxOwnerByNormalizedEmail(
  supabase: SupabaseClient,
  mailboxEmailNormalized: string,
) {
  const { data, error } = await supabase
    .from(cfeEmailConnectionsTable)
    .select("id, organization_id, user_id")
    .eq("mailbox_email_normalized", mailboxEmailNormalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(error, cfeEmailConnectionsTable)) {
      throw new Error(
        "La configuracion de email de eFacturas aun no esta disponible en esta base. Aplica la migracion nueva y vuelve a intentar.",
      );
    }

    throw new Error(error.message);
  }

  return data as {
    id: string;
    organization_id: string;
    user_id: string;
  } | null;
}

export async function upsertUserOrganizationCfeEmailConnection(input: {
  organizationId: string;
  userId: string;
  actorId: string | null;
  connectionLabel: string;
  mailboxEmail: string;
  isActive: boolean;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const mailboxEmail = input.mailboxEmail.trim();
  const mailboxEmailNormalized = normalizeCfeMailboxEmail(mailboxEmail);
  const connectionLabel = input.connectionLabel.trim() || "Casilla principal de eFacturas";

  if (!isValidCfeMailboxEmail(mailboxEmailNormalized)) {
    throw new Error("Ingresa un email valido para la casilla de CFE.");
  }

  const current = await loadUserOrganizationCfeEmailConnection(supabase, {
    organizationId: input.organizationId,
    userId: input.userId,
  });
  // The web form registers an address; it cannot operate the local IMAP worker.
  if (current?.ingestionMode === "local_imap" && current.mailboxEmailNormalized !== mailboxEmailNormalized) {
    throw new Error("Cambia la casilla del lector en Convertilabs Local. La configuracion de esta PC controla la recepcion.");
  }
  const mailboxOwner = await loadMailboxOwnerByNormalizedEmail(supabase, mailboxEmailNormalized);

  if (mailboxOwner && mailboxOwner.id !== current?.id) {
    if (mailboxOwner.organization_id !== input.organizationId) {
      throw new Error("Ese email de CFE ya esta vinculado a otra organizacion.");
    }

    throw new Error("Ese email de CFE ya fue configurado por otro usuario de esta organizacion.");
  }

  const inboundAddress =
    current && current.mailboxEmailNormalized === mailboxEmailNormalized
      ? current.inboundAddress
      : buildCfeInboundForwardingAddress({
        organizationId: input.organizationId,
        userId: input.userId,
        mailboxEmail: mailboxEmailNormalized,
      });

  const now = new Date().toISOString();
  const isLocalImap = current?.ingestionMode === "local_imap";
  const isActive = isLocalImap ? current.isActive : input.isActive;
  const registration = buildCfeEmailRegistrationState({ current, mailboxEmailNormalized, isActive, now });
  const status = isLocalImap ? current.status : registration.status;
  const payload = {
    organization_id: input.organizationId,
    user_id: input.userId,
    connection_label: connectionLabel,
    mailbox_email: mailboxEmail,
    mailbox_email_normalized: mailboxEmailNormalized,
    inbound_address: inboundAddress,
    ingestion_mode: isLocalImap ? "local_imap" : "forwarding_alias",
    status,
    is_active: isActive,
    last_inbound_email_at: registration.lastInboundEmailAt,
    metadata_json: registration.metadata,
    updated_at: now,
  };

  if (current) {
    const { data, error } = await supabase
      .from(cfeEmailConnectionsTable)
      .update(payload)
      .eq("id", current.id)
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .eq("updated_at", current.updatedAt)
      .select("id")
      .maybeSingle();

    if (error) {
      if (isMissingSupabaseRelationError(error, cfeEmailConnectionsTable)) {
        throw new Error(
          "La configuracion de email de eFacturas aun no esta disponible en esta base. Aplica la migracion nueva y vuelve a intentar.",
        );
      }

      throw new Error(error.message);
    }
    if (!data) throw new Error("La casilla recibio una actualizacion mientras guardabas. Actualiza la pagina y vuelve a intentar.");

    await recordAuditEvent(supabase, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      entityId: current.id,
      action: "organization:cfe_email_connection_updated",
      beforeJson: {
        connection_label: current.connectionLabel,
        mailbox_email: current.mailboxEmail,
        inbound_address: current.inboundAddress,
        status: current.status,
        is_active: current.isActive,
        last_inbound_email_at: current.lastInboundEmailAt,
      },
      afterJson: {
        connection_label: connectionLabel,
        mailbox_email: mailboxEmail,
        inbound_address: inboundAddress,
        status,
        is_active: isActive,
        last_inbound_email_at: registration.lastInboundEmailAt,
      },
      metadata: {
        user_id: input.userId,
      },
    });
  } else {
    const { data, error } = await supabase
      .from(cfeEmailConnectionsTable)
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingSupabaseRelationError(error, cfeEmailConnectionsTable)) {
        throw new Error(
          "La configuracion de email de eFacturas aun no esta disponible en esta base. Aplica la migracion nueva y vuelve a intentar.",
        );
      }

      throw new Error(error.message);
    }

    await recordAuditEvent(supabase, {
      organizationId: input.organizationId,
      actorId: input.actorId,
      entityId: (data as { id: string } | null)?.id ?? null,
      action: "organization:cfe_email_connection_created",
      afterJson: {
        connection_label: connectionLabel,
        mailbox_email: mailboxEmail,
        inbound_address: inboundAddress,
        status,
        is_active: isActive,
      },
      metadata: {
        user_id: input.userId,
      },
    });
  }

  return loadUserOrganizationCfeEmailConnection(supabase, {
    organizationId: input.organizationId,
    userId: input.userId,
  });
}

/** Called only after the local reader has opened INBOX successfully. This
 * records dated evidence, never credentials or a promise of current liveness. */
export async function recordLocalCfeEmailObservation(input: LocalCompanionIdentity & {
  mailboxEmail: string;
  observedAt: string;
  lastInboundEmailAt?: string;
}, deps: { context?: typeof resolveLocalCompanionContext } = {}): Promise<{ recorded: boolean; code?: string }> {
  const mailbox = normalizeCfeMailboxEmail(input.mailboxEmail);
  const validTimestamp = (value: unknown): value is string => typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
  if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(mailbox) || !validTimestamp(input.observedAt)
    || (input.lastInboundEmailAt !== undefined && (!validTimestamp(input.lastInboundEmailAt)
      || Date.parse(input.lastInboundEmailAt) > Date.parse(input.observedAt)))) {
    return { recorded: false, code: "invalid_observation" };
  }
  try {
    const context = await (deps.context ?? resolveLocalCompanionContext)({
      slug: input.slug, actorProfileId: input.actorProfileId, requireWrite: true,
    });
    const { supabase } = context;
    const current = await loadUserOrganizationCfeEmailConnection(supabase, {
      organizationId: context.organization.id, userId: context.actorProfileId,
    });
    const owner = await loadMailboxOwnerByNormalizedEmail(supabase, mailbox);
    if (owner && (owner.organization_id !== context.organization.id
      || owner.user_id !== context.actorProfileId || owner.id !== current?.id)) {
      return { recorded: false, code: "mailbox_already_registered" };
    }
    const now = new Date().toISOString();
    const registration = buildCfeEmailRegistrationState({ current, mailboxEmailNormalized: mailbox, isActive: true, now });
    const previousProbe = current?.mailboxEmailNormalized === mailbox ? getLocalCfeEmailLastProbe(current) : null;
    const latest = (left: string | null, right: string | null) => !left ? right : !right ? left
      : Date.parse(left) >= Date.parse(right) ? left : right;
    const lastProbe = latest(previousProbe, input.observedAt)!;
    const lastInbound = latest(registration.lastInboundEmailAt, input.lastInboundEmailAt ?? null);
    const id = current?.id ?? randomUUID();
    const payload = {
      organization_id: context.organization.id, user_id: context.actorProfileId,
      connection_label: current?.connectionLabel || "Casilla local de eFacturas",
      mailbox_email: mailbox, mailbox_email_normalized: mailbox, inbound_address: mailbox,
      ingestion_mode: "local_imap", is_active: true, status: lastInbound ? "active" : "verified",
      last_inbound_email_at: lastInbound,
      metadata_json: { ...registration.metadata, setup_source: "local_imap",
        local_imap: { version: 1, mailbox_email: mailbox, last_probe_at: lastProbe,
          last_probe_status: "verified", last_observed_by: context.actorProfileId } },
      updated_at: now,
    };
    const audit = await recordAuditEvent(supabase, {
      organizationId: context.organization.id, actorId: context.actorProfileId, entityId: current?.id ?? null,
      action: "organization:cfe_email_local_observation",
      afterJson: { mailbox_email: mailbox, observed_at: input.observedAt,
        last_inbound_email_at: input.lastInboundEmailAt ?? null },
      metadata: { ingestion_mode: "local_imap" },
    });
    if (audit.error) return { recorded: false, code: "observation_audit_failed" };
    const query = current
      ? supabase.from(cfeEmailConnectionsTable).update(payload).eq("id", current.id)
        .eq("organization_id", context.organization.id).eq("user_id", context.actorProfileId).eq("updated_at", current.updatedAt)
      : supabase.from(cfeEmailConnectionsTable).insert({ id, ...payload, created_at: now });
    const result = await query.select("id").maybeSingle();
    if (result.error || !result.data) return { recorded: false, code: "observation_state_changed" };
    return { recorded: true };
  } catch {
    return { recorded: false, code: "observation_not_recorded" };
  }
}
