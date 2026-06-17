"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canManageCommunications,
  createInteractionWithLinks,
  INTERACTION_TYPES,
  type InteractionType,
} from "@/modules/communications";
import {
  addContactToParty,
  canManageDirectory,
  createDirectoryParty,
  PARTY_ROLE_TYPES,
  type PartyRoleType,
} from "@/modules/directory";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function choiceValue<T extends readonly string[]>(
  value: string | null,
  choices: T,
  fallback: T[number],
): T[number] {
  return value && choices.includes(value) ? value : fallback;
}

function roleValues(formData: FormData) {
  return formData.getAll("roleTypes")
    .map((value) => String(value))
    .filter((value): value is PartyRoleType => (PARTY_ROLE_TYPES as readonly string[]).includes(value));
}

async function requireDirectoryMutation(slug: string) {
  const context = await requireOrganizationDashboardPage(slug);

  if (!canManageDirectory(context.organization.role)) {
    throw new Error("Tu rol no puede modificar el directorio.");
  }

  return context;
}

export async function createDirectoryPartyAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireDirectoryMutation(slug);
  const partyId = await createDirectoryParty(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    displayName: textValue(formData, "displayName") ?? "",
    legalName: textValue(formData, "legalName"),
    taxId: textValue(formData, "taxId"),
    countryCode: textValue(formData, "countryCode") ?? "UY",
    defaultCurrencyCode: textValue(formData, "defaultCurrencyCode"),
    roleTypes: roleValues(formData),
  });

  revalidatePath(`/app/o/${organization.slug}/directory`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);

  redirect(`/app/o/${organization.slug}/directory/${partyId}`);
}

export async function addPartyContactAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const partyId = textValue(formData, "partyId");
  const { authState, organization } = await requireDirectoryMutation(slug);

  if (!partyId) {
    throw new Error("Selecciona una party valida.");
  }

  await addContactToParty(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    partyId,
    fullName: textValue(formData, "fullName") ?? "",
    email: textValue(formData, "email"),
    phone: textValue(formData, "phone"),
    mobile: textValue(formData, "mobile"),
    relationshipLabel: textValue(formData, "relationshipLabel"),
    notes: textValue(formData, "notes"),
  });

  revalidatePath(`/app/o/${organization.slug}/directory`);
  revalidatePath(`/app/o/${organization.slug}/directory/${partyId}`);
}

export async function createPartyInteractionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const partyId = textValue(formData, "partyId");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageCommunications(organization.role)) {
    throw new Error("Tu rol no puede registrar interacciones.");
  }

  if (!partyId) {
    throw new Error("Selecciona una party valida.");
  }

  await createInteractionWithLinks(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    partyId,
    contactId: textValue(formData, "contactId"),
    workUnitId: textValue(formData, "workUnitId"),
    documentId: textValue(formData, "documentId"),
    taskId: textValue(formData, "taskId"),
    interactionType: choiceValue(
      textValue(formData, "interactionType"),
      INTERACTION_TYPES,
      "note",
    ) as InteractionType,
    occurredAt: textValue(formData, "occurredAt"),
    subject: textValue(formData, "subject") ?? "",
    summary: textValue(formData, "summary"),
    body: textValue(formData, "body"),
    direction: textValue(formData, "direction"),
  });

  revalidatePath(`/app/o/${organization.slug}/directory`);
  revalidatePath(`/app/o/${organization.slug}/directory/${partyId}`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}
