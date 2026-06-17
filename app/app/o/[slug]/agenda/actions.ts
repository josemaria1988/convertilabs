"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canManageOperations,
  createTask,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
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

export async function createAgendaTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageOperations(organization.role)) {
    throw new Error("Tu rol no puede crear tareas.");
  }

  await createTask(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    title: textValue(formData, "title") ?? "",
    description: textValue(formData, "description"),
    status: choiceValue(textValue(formData, "status"), TASK_STATUSES, "pending") as TaskStatus,
    priority: choiceValue(textValue(formData, "priority"), TASK_PRIORITIES, "normal") as TaskPriority,
    dueDate: textValue(formData, "dueDate"),
    partyId: textValue(formData, "partyId"),
    workUnitId: textValue(formData, "workUnitId"),
    documentId: textValue(formData, "documentId"),
    blockedReason: textValue(formData, "blockedReason"),
  });

  revalidatePath(`/app/o/${organization.slug}/agenda`);
  revalidatePath(`/app/o/${organization.slug}/continuity`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}
