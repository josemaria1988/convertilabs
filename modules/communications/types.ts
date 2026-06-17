import type { InteractionTargetType } from "@/modules/operations";

export const INTERACTION_TYPES = [
  "call",
  "email",
  "whatsapp",
  "meeting",
  "note",
  "visit",
  "message",
  "system_note",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_STATUSES = ["recorded", "needs_follow_up", "closed", "archived"] as const;
export type InteractionStatus = (typeof INTERACTION_STATUSES)[number];

export type InteractionParticipantItem = {
  partyId: string | null;
  contactId: string | null;
  role: string;
};

export type InteractionLinkItem = {
  targetEntityType: InteractionTargetType;
  targetEntityId: string;
  relationType: string;
};

export type InteractionItem = {
  id: string;
  interactionType: InteractionType;
  occurredAt: string;
  subject: string;
  summary: string | null;
  body: string | null;
  direction: string | null;
  status: InteractionStatus;
  participants: InteractionParticipantItem[];
  links: InteractionLinkItem[];
};
