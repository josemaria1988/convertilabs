"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canManageOperations,
  createCaptureNote,
  createObligation,
  createProcessWithInitialVersion,
  OBLIGATION_FREQUENCIES,
  PROCESS_CRITICALITIES,
  startProcessRun,
  type ObligationFrequency,
  type ProcessCriticality,
} from "@/modules/operations";

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

async function requireOperationsMutation(slug: string) {
  const context = await requireOrganizationDashboardPage(slug);

  if (!canManageOperations(context.organization.role)) {
    throw new Error("Tu rol no puede modificar procesos.");
  }

  return context;
}

function revalidateOperationsPaths(slug: string) {
  revalidatePath(`/app/o/${slug}/processes`);
  revalidatePath(`/app/o/${slug}/agenda`);
  revalidatePath(`/app/o/${slug}/continuity`);
  revalidatePath(`/app/o/${slug}/dashboard`);
}

export async function createProcessAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOperationsMutation(slug);

  await createProcessWithInitialVersion(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    name: textValue(formData, "name") ?? "",
    category: textValue(formData, "category"),
    description: textValue(formData, "description"),
    criticality: choiceValue(
      textValue(formData, "criticality"),
      PROCESS_CRITICALITIES,
      "medium",
    ) as ProcessCriticality,
    frequency: textValue(formData, "frequency"),
    currentOwnerLabel: textValue(formData, "currentOwnerLabel"),
    futureOwnerLabel: textValue(formData, "futureOwnerLabel"),
    nextRunDate: textValue(formData, "nextRunDate"),
    stepsText: textValue(formData, "stepsText"),
  });

  revalidateOperationsPaths(organization.slug);
}

export async function createObligationAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOperationsMutation(slug);

  await createObligation(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    title: textValue(formData, "title") ?? "",
    description: textValue(formData, "description"),
    obligationType: textValue(formData, "obligationType"),
    frequency: choiceValue(
      textValue(formData, "frequency"),
      OBLIGATION_FREQUENCIES,
      "monthly",
    ) as ObligationFrequency,
    responsibleLabel: textValue(formData, "responsibleLabel"),
    futureOwnerLabel: textValue(formData, "futureOwnerLabel"),
    nextDueDate: textValue(formData, "nextDueDate"),
  });

  revalidateOperationsPaths(organization.slug);
}

export async function createCaptureNoteAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOperationsMutation(slug);

  await createCaptureNote(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    title: textValue(formData, "title"),
    rawText: textValue(formData, "rawText") ?? "",
    source: textValue(formData, "source") ?? "manual",
  });

  revalidateOperationsPaths(organization.slug);
}

export async function startProcessRunAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const processId = textValue(formData, "processId");
  const { authState, organization } = await requireOperationsMutation(slug);

  if (!processId) {
    throw new Error("Selecciona un proceso valido.");
  }

  await startProcessRun(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    processId,
    title: textValue(formData, "title"),
    dueDate: textValue(formData, "dueDate"),
  });

  revalidateOperationsPaths(organization.slug);
}
