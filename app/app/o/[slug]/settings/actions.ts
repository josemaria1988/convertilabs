"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  createOrganizationChartAccount,
  updateOrganizationChartAccount,
} from "@/modules/accounting/chart-admin";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  activateOrganizationProfileVersion,
  updateOrganizationBasics,
} from "@/modules/organizations/settings";
import {
  appendSpreadsheetStatusEvent,
  confirmCompletedSpreadsheetImport,
  importChartOfAccountsSpreadsheetDirect,
  materializeSpreadsheetImportRun,
  runSpreadsheetImport,
  updateSpreadsheetImportRun,
} from "@/modules/spreadsheets";

function assertOrganizationManagerRole(role: string) {
  if (!["owner", "admin", "accountant"].includes(role)) {
    throw new Error("Tu rol no puede administrar la organizacion.");
  }
}

export async function activateOrganizationProfileVersionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!["owner", "admin", "accountant", "reviewer"].includes(organization.role)) {
    throw new Error("Tu rol no puede activar versiones de perfil.");
  }

  await activateOrganizationProfileVersion({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    legalEntityType: String(formData.get("legalEntityType") ?? "").trim().toUpperCase(),
    taxId: String(formData.get("taxId") ?? "").replace(/\D+/g, ""),
    taxRegimeCode: String(formData.get("taxRegimeCode") ?? "").trim().toUpperCase(),
    vatRegime: String(formData.get("vatRegime") ?? "").trim().toUpperCase(),
    dgiGroup: String(formData.get("dgiGroup") ?? "").trim().toUpperCase(),
    cfeStatus: String(formData.get("cfeStatus") ?? "").trim().toUpperCase(),
    effectiveFrom: String(formData.get("effectiveFrom") ?? "").trim(),
    changeReason: String(formData.get("changeReason") ?? "").trim(),
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}

export async function updateOrganizationBasicsAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  assertOrganizationManagerRole(organization.role);

  await updateOrganizationBasics({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    name: String(formData.get("name") ?? ""),
    countryCode: String(formData.get("countryCode") ?? ""),
    baseCurrency: String(formData.get("baseCurrency") ?? ""),
    defaultLocale: String(formData.get("defaultLocale") ?? ""),
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}

export async function createOrganizationChartAccountAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  assertOrganizationManagerRole(organization.role);

  await createOrganizationChartAccount({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    accountType: String(formData.get("accountType") ?? ""),
    normalSide: String(formData.get("normalSide") ?? ""),
    isPostable: formData.get("isPostable") === "on",
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
}

export async function updateOrganizationChartAccountAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  assertOrganizationManagerRole(organization.role);

  await updateOrganizationChartAccount({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    accountId,
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    accountType: String(formData.get("accountType") ?? ""),
    normalSide: String(formData.get("normalSide") ?? ""),
    isPostable: formData.get("isPostable") === "on",
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
}

export async function importOrganizationChartSpreadsheetAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  assertOrganizationManagerRole(organization.role);

  const file = formData.get("spreadsheet");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecciona una planilla valida antes de importar.");
  }

  const supabase = getSupabaseServiceRoleClient();
  const bytes = await file.arrayBuffer();

  try {
    const run = await runSpreadsheetImport({
      supabase,
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      preferredMode: "interactive",
    });

    if (run.status !== "completed") {
      throw new Error("La importacion rapida no pudo completarse en modo interactivo.");
    }

    if (run.importType !== "chart_of_accounts_import" && run.importType !== "mixed") {
      throw new Error("La planilla no fue detectada como un import valido de plan de cuentas.");
    }

    const materialized = await materializeSpreadsheetImportRun(supabase, {
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      run,
      selectedSections: ["chart_of_accounts_import"],
    });
    const confirmed = await confirmCompletedSpreadsheetImport({
      supabase,
      organizationId: organization.id,
      runId: run.id,
      actorId: authState.user?.id ?? null,
    });

    await updateSpreadsheetImportRun(supabase, {
      organizationId: organization.id,
      runId: confirmed.id,
      statusEvents: appendSpreadsheetStatusEvent(
        confirmed.statusEvents,
        "materialized",
        materialized.notes.join(" ") || "Plan de cuentas materializado desde configuracion.",
      ),
      metadata: {
        ...confirmed.metadata,
        materialized_sections: materialized.sections,
        materialization_stats: materialized.stats,
        materialization_notes: materialized.notes,
        imported_from_settings: true,
      },
    });
  } catch (error) {
    if (!isMissingSupabaseRelationError(error as { message?: string } | null, "organization_spreadsheet_import_runs")) {
      throw error;
    }

    await importChartOfAccountsSpreadsheetDirect({
      supabase,
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });
  }

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/imports`);
}
