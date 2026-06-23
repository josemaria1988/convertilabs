"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  assignDocumentToWorkUnit,
  canMutateWorkUnit,
  createCustomerPartyForWorkUnit,
  createWorkUnit,
} from "@/modules/work";
import {
  canManageWorkIntake,
  createOrReuseWorkIntakeItem,
  createWorkIntakeFollowUpTask,
  linkWorkIntakeToParty,
  linkWorkIntakeToWorkUnit,
  loadWorkIntakeItem,
  parseWorkIntakeSourceType,
  parseWorkIntakeStatus,
  updateWorkIntakeStatus,
} from "@/modules/work-intake";
import {
  WORK_UNIT_KINDS,
  type WorkUnitKind,
} from "@/modules/work/types";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function numberValue(formData: FormData, key: string) {
  const raw = textValue(formData, key);

  if (!raw) {
    return null;
  }

  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} debe ser un numero valido.`);
  }

  return parsed;
}

function parseWorkUnitKind(value: string | null): WorkUnitKind {
  if (value && (WORK_UNIT_KINDS as readonly string[]).includes(value)) {
    return value as WorkUnitKind;
  }

  return "job";
}

function revalidateWorkSurfaces(slug: string, workUnitId?: string | null) {
  revalidatePath(`/app/o/${slug}/work`);
  revalidatePath(`/app/o/${slug}/dashboard`);
  revalidatePath(`/app/o/${slug}/agenda`);

  if (workUnitId) {
    revalidatePath(`/app/o/${slug}/work/${workUnitId}`);
  }
}

export async function createOrganizationWorkUnitAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canMutateWorkUnit(organization.role)) {
    throw new Error("Tu rol no puede crear trabajos.");
  }

  const supabase = getSupabaseServiceRoleClient();
  const existingCustomerPartyId = textValue(formData, "customerPartyId");
  const newCustomerName = textValue(formData, "newCustomerName");
  const newCustomerTaxId = textValue(formData, "newCustomerTaxId");
  const customerPartyId = existingCustomerPartyId
    ?? (newCustomerName
      ? await createCustomerPartyForWorkUnit(supabase, {
        organizationId: organization.id,
        displayName: newCustomerName,
        taxId: newCustomerTaxId,
        actorId: authState.user?.id ?? null,
      })
      : null);
  const workUnitId = await createWorkUnit(supabase, {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    name: textValue(formData, "name") ?? "",
    code: textValue(formData, "code"),
    kind: parseWorkUnitKind(textValue(formData, "kind")),
    status: "active",
    customerPartyId,
    startDate: textValue(formData, "startDate"),
    endDate: textValue(formData, "endDate"),
    estimatedRevenue: numberValue(formData, "estimatedRevenue"),
    estimatedCost: numberValue(formData, "estimatedCost"),
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    description: textValue(formData, "description"),
  });

  revalidateWorkSurfaces(organization.slug, workUnitId);

  redirect(`/app/o/${organization.slug}/work/${workUnitId}`);
}

export async function assignDocumentToCurrentWorkUnitAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const documentId = textValue(formData, "documentId");
  const workUnitId = textValue(formData, "workUnitId");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canMutateWorkUnit(organization.role)) {
    throw new Error("Tu rol no puede asociar documentos a trabajos.");
  }

  if (!documentId || !workUnitId) {
    throw new Error("Selecciona un documento y un trabajo valido.");
  }

  await assignDocumentToWorkUnit(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    documentId,
    workUnitId,
    actorId: authState.user?.id ?? null,
  });

  revalidatePath(`/app/o/${organization.slug}/work`);
  revalidatePath(`/app/o/${organization.slug}/work/${workUnitId}`);
  revalidatePath(`/app/o/${organization.slug}/documents`);
  revalidatePath(`/app/o/${organization.slug}/money`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}

export async function createWorkIntakeItemAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageWorkIntake(organization.role)) {
    throw new Error("Tu rol no puede cargar solicitudes.");
  }

  const supabase = getSupabaseServiceRoleClient();

  await createOrReuseWorkIntakeItem(supabase, {
    organizationId: organization.id,
    createdBy: authState.user?.id ?? null,
    sourceType: parseWorkIntakeSourceType(textValue(formData, "sourceType")),
    title: textValue(formData, "title") ?? "",
    description: textValue(formData, "description"),
    rawText: textValue(formData, "description"),
    customerName: textValue(formData, "customerName"),
    customerEmail: textValue(formData, "customerEmail"),
    customerPhone: textValue(formData, "customerPhone"),
    locationText: textValue(formData, "locationText"),
    estimatedAmount: numberValue(formData, "estimatedAmount"),
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    dueDate: textValue(formData, "dueDate"),
    nextAction: textValue(formData, "nextAction") ?? "Revisar solicitud",
    status: "captured",
    metadata: {
      created_from: "work_intake_manual_form",
    },
  });

  revalidateWorkSurfaces(organization.slug);
}

export async function linkWorkIntakeToPartyAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const intakeId = textValue(formData, "intakeId");
  const partyId = textValue(formData, "partyId");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageWorkIntake(organization.role)) {
    throw new Error("Tu rol no puede asociar solicitudes.");
  }

  if (!intakeId || !partyId) {
    throw new Error("Selecciona una solicitud y un cliente valido.");
  }

  await linkWorkIntakeToParty(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    intakeId,
    partyId,
    actorId: authState.user?.id ?? null,
  });

  revalidateWorkSurfaces(organization.slug);
}

export async function linkWorkIntakeToWorkUnitAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const intakeId = textValue(formData, "intakeId");
  const workUnitId = textValue(formData, "workUnitId");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageWorkIntake(organization.role)) {
    throw new Error("Tu rol no puede asociar solicitudes.");
  }

  if (!intakeId || !workUnitId) {
    throw new Error("Selecciona una solicitud y un trabajo valido.");
  }

  await linkWorkIntakeToWorkUnit(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    intakeId,
    workUnitId,
    actorId: authState.user?.id ?? null,
  });

  revalidateWorkSurfaces(organization.slug, workUnitId);
}

export async function convertWorkIntakeToWorkUnitAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const intakeId = textValue(formData, "intakeId");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageWorkIntake(organization.role) || !canMutateWorkUnit(organization.role)) {
    throw new Error("Tu rol no puede convertir solicitudes en trabajos.");
  }

  if (!intakeId) {
    throw new Error("Selecciona una solicitud valida.");
  }

  const supabase = getSupabaseServiceRoleClient();
  const intake = await loadWorkIntakeItem(supabase, {
    organizationId: organization.id,
    intakeId,
  });

  if (!intake) {
    throw new Error("Solicitud no encontrada.");
  }

  if (intake.workUnitId) {
    redirect(`/app/o/${organization.slug}/work/${intake.workUnitId}`);
  }

  const workUnitId = await createWorkUnit(supabase, {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    name: intake.locationText
      ? `${intake.title} - ${intake.locationText}`
      : intake.title,
    kind: "job",
    status: "active",
    customerPartyId: intake.partyId,
    startDate: intake.requestedDate,
    estimatedRevenue: intake.estimatedAmount,
    currencyCode: intake.currencyCode,
    description: intake.description ?? intake.rawText,
    metadata: {
      created_from: "work_intake_conversion",
      work_intake_item_id: intake.id,
      intake_source_type: intake.sourceType,
      external_source_key: intake.externalSourceKey,
    },
  });

  await linkWorkIntakeToWorkUnit(supabase, {
    organizationId: organization.id,
    intakeId,
    workUnitId,
    status: "converted_to_work",
    actorId: authState.user?.id ?? null,
  });

  revalidateWorkSurfaces(organization.slug, workUnitId);

  redirect(`/app/o/${organization.slug}/work/${workUnitId}`);
}

export async function createWorkIntakeFollowUpTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const intakeId = textValue(formData, "intakeId");
  const dueDate = textValue(formData, "dueDate");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageWorkIntake(organization.role)) {
    throw new Error("Tu rol no puede crear tareas de seguimiento.");
  }

  if (!intakeId) {
    throw new Error("Selecciona una solicitud valida.");
  }

  await createWorkIntakeFollowUpTask(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    intakeId,
    dueDate,
    actorId: authState.user?.id ?? null,
  });

  revalidateWorkSurfaces(organization.slug);
}

export async function updateWorkIntakeStatusAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const intakeId = textValue(formData, "intakeId");
  const status = parseWorkIntakeStatus(textValue(formData, "status"));
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!canManageWorkIntake(organization.role)) {
    throw new Error("Tu rol no puede cambiar el estado de solicitudes.");
  }

  if (!intakeId) {
    throw new Error("Selecciona una solicitud valida.");
  }

  await updateWorkIntakeStatus(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    intakeId,
    status,
    actorId: authState.user?.id ?? null,
  });

  revalidateWorkSurfaces(organization.slug);
}
