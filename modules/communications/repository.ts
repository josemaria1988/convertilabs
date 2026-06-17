import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  buildInteractionLinkPayload,
  buildInteractionParticipantPayload,
  buildInteractionPayload,
} from "@/modules/communications/service";
import type {
  InteractionItem,
  InteractionLinkItem,
  InteractionParticipantItem,
  InteractionStatus,
  InteractionType,
} from "@/modules/communications/types";
import type { InteractionTargetType } from "@/modules/operations";

type InteractionRow = {
  id: string;
  interaction_type: InteractionType;
  occurred_at: string;
  subject: string;
  summary: string | null;
  body: string | null;
  direction: string | null;
  status: InteractionStatus;
};

type InteractionParticipantRow = {
  interaction_id: string;
  party_id: string | null;
  contact_id: string | null;
  role: string;
};

type InteractionLinkRow = {
  interaction_id: string;
  target_entity_type: InteractionTargetType;
  target_entity_id: string;
  relation_type: string;
};

function isMissingCommunicationsTable(error: unknown) {
  return isMissingSupabaseRelationError(error as { message?: string; code?: string }, "interactions")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "interaction_participants")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "interaction_links");
}

function mapParticipant(row: InteractionParticipantRow): InteractionParticipantItem {
  return {
    partyId: row.party_id,
    contactId: row.contact_id,
    role: row.role,
  };
}

function mapLink(row: InteractionLinkRow): InteractionLinkItem {
  return {
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    relationType: row.relation_type,
  };
}

function mapInteraction(
  row: InteractionRow,
  participantsByInteractionId: Map<string, InteractionParticipantItem[]>,
  linksByInteractionId: Map<string, InteractionLinkItem[]>,
): InteractionItem {
  return {
    id: row.id,
    interactionType: row.interaction_type,
    occurredAt: row.occurred_at,
    subject: row.subject,
    summary: row.summary,
    body: row.body,
    direction: row.direction,
    status: row.status,
    participants: participantsByInteractionId.get(row.id) ?? [],
    links: linksByInteractionId.get(row.id) ?? [],
  };
}

function addLink(
  links: ReturnType<typeof buildInteractionLinkPayload>[],
  input: Parameters<typeof buildInteractionLinkPayload>[0],
) {
  if (!input.targetEntityId) {
    return;
  }

  links.push(buildInteractionLinkPayload(input));
}

export async function createInteractionWithLinks(
  supabase: SupabaseClient,
  input: Parameters<typeof buildInteractionPayload>[0] & {
    partyId?: string | null;
    contactId?: string | null;
    workUnitId?: string | null;
    documentId?: string | null;
    taskId?: string | null;
    openItemId?: string | null;
    processRunId?: string | null;
  },
) {
  const interactionPayload = buildInteractionPayload(input);
  const { data, error } = await supabase
    .from("interactions")
    .insert(interactionPayload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const interactionId = String((data as { id: string }).id);

  if (input.partyId || input.contactId) {
    const { error: participantError } = await supabase
      .from("interaction_participants")
      .insert(buildInteractionParticipantPayload({
        organizationId: input.organizationId,
        interactionId,
        partyId: input.partyId,
        contactId: input.contactId,
        role: "participant",
      }));

    if (participantError) {
      throw new Error(participantError.message);
    }
  }

  const links: ReturnType<typeof buildInteractionLinkPayload>[] = [];

  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "party",
    targetEntityId: input.partyId ?? "",
    relationType: "involves",
  });
  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "contact",
    targetEntityId: input.contactId ?? "",
    relationType: "involves",
  });
  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "work_unit",
    targetEntityId: input.workUnitId ?? "",
    relationType: "discusses",
  });
  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "document",
    targetEntityId: input.documentId ?? "",
    relationType: "discusses",
  });
  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "task",
    targetEntityId: input.taskId ?? "",
    relationType: "related_to",
  });
  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "open_item",
    targetEntityId: input.openItemId ?? "",
    relationType: "related_to",
  });
  addLink(links, {
    organizationId: input.organizationId,
    interactionId,
    targetEntityType: "process_run",
    targetEntityId: input.processRunId ?? "",
    relationType: "related_to",
  });

  if (links.length > 0) {
    const { error: linksError } = await supabase
      .from("interaction_links")
      .insert(links);

    if (linksError) {
      throw new Error(linksError.message);
    }
  }

  return interactionId;
}

export async function listPartyInteractions(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    partyId: string;
  },
): Promise<{
  isAvailable: boolean;
  items: InteractionItem[];
}> {
  const [participantsResult, linksResult] = await Promise.all([
    supabase
      .from("interaction_participants")
      .select("interaction_id")
      .eq("organization_id", input.organizationId)
      .eq("party_id", input.partyId),
    supabase
      .from("interaction_links")
      .select("interaction_id")
      .eq("organization_id", input.organizationId)
      .eq("target_entity_type", "party")
      .eq("target_entity_id", input.partyId),
  ]);

  if (participantsResult.error || linksResult.error) {
    const error = participantsResult.error ?? linksResult.error;

    if (isMissingCommunicationsTable(error)) {
      return {
        isAvailable: false,
        items: [],
      };
    }

    throw new Error(error?.message ?? "No se pudo cargar el historial.");
  }

  const ids = Array.from(new Set([
    ...(((participantsResult.data as Array<{ interaction_id?: string | null }> | null) ?? [])
      .map((row) => row.interaction_id)
      .filter((id): id is string => Boolean(id))),
    ...(((linksResult.data as Array<{ interaction_id?: string | null }> | null) ?? [])
      .map((row) => row.interaction_id)
      .filter((id): id is string => Boolean(id))),
  ]));

  if (ids.length === 0) {
    return {
      isAvailable: true,
      items: [],
    };
  }

  const [interactionsResult, allParticipantsResult, allLinksResult] = await Promise.all([
    supabase
      .from("interactions")
      .select("id, interaction_type, occurred_at, subject, summary, body, direction, status")
      .eq("organization_id", input.organizationId)
      .in("id", ids)
      .order("occurred_at", { ascending: false })
      .limit(80),
    supabase
      .from("interaction_participants")
      .select("interaction_id, party_id, contact_id, role")
      .eq("organization_id", input.organizationId)
      .in("interaction_id", ids),
    supabase
      .from("interaction_links")
      .select("interaction_id, target_entity_type, target_entity_id, relation_type")
      .eq("organization_id", input.organizationId)
      .in("interaction_id", ids),
  ]);

  const error = interactionsResult.error ?? allParticipantsResult.error ?? allLinksResult.error;

  if (error) {
    if (isMissingCommunicationsTable(error)) {
      return {
        isAvailable: false,
        items: [],
      };
    }

    throw new Error(error.message);
  }

  const participantsByInteractionId = new Map<string, InteractionParticipantItem[]>();
  const linksByInteractionId = new Map<string, InteractionLinkItem[]>();

  for (const participant of ((allParticipantsResult.data as InteractionParticipantRow[] | null) ?? [])) {
    const current = participantsByInteractionId.get(participant.interaction_id) ?? [];
    current.push(mapParticipant(participant));
    participantsByInteractionId.set(participant.interaction_id, current);
  }

  for (const link of ((allLinksResult.data as InteractionLinkRow[] | null) ?? [])) {
    const current = linksByInteractionId.get(link.interaction_id) ?? [];
    current.push(mapLink(link));
    linksByInteractionId.set(link.interaction_id, current);
  }

  return {
    isAvailable: true,
    items: ((interactionsResult.data as InteractionRow[] | null) ?? [])
      .map((row) => mapInteraction(row, participantsByInteractionId, linksByInteractionId)),
  };
}
