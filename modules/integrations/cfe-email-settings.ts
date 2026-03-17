import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

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

export function formatCfeEmailConnectionStatusLabel(value: string | null | undefined) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "active":
      return "Activa";
    case "paused":
      return "Pausada";
    case "error":
      return "Con error";
    default:
      return "Pendiente de reenvio";
  }
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

  const status = input.isActive
    ? current?.lastInboundEmailAt
      ? "active"
      : "pending_forwarding"
    : "paused";
  const payload = {
    organization_id: input.organizationId,
    user_id: input.userId,
    connection_label: connectionLabel,
    mailbox_email: mailboxEmail,
    mailbox_email_normalized: mailboxEmailNormalized,
    inbound_address: inboundAddress,
    ingestion_mode: "forwarding_alias",
    status,
    is_active: input.isActive,
    metadata_json: {
      setup_source: "organization_settings",
      receives_cfe: true,
    },
    updated_at: new Date().toISOString(),
  };

  if (current) {
    const { error } = await supabase
      .from(cfeEmailConnectionsTable)
      .update(payload)
      .eq("id", current.id);

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
      entityId: current.id,
      action: "organization:cfe_email_connection_updated",
      beforeJson: {
        connection_label: current.connectionLabel,
        mailbox_email: current.mailboxEmail,
        inbound_address: current.inboundAddress,
        status: current.status,
        is_active: current.isActive,
      },
      afterJson: {
        connection_label: connectionLabel,
        mailbox_email: mailboxEmail,
        inbound_address: inboundAddress,
        status,
        is_active: input.isActive,
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
        is_active: input.isActive,
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
