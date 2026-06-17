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

  revalidatePath(`/app/o/${organization.slug}/work`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);

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
