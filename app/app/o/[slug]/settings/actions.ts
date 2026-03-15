"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  applyOrganizationChartPreset,
  createOrganizationChartAccount,
  updateOrganizationChartAccount,
} from "@/modules/accounting/chart-admin";
import { applyPresetComposition } from "@/modules/accounting/preset-apply-service";
import { ensureStarterAccountingSetup } from "@/modules/accounting/starter-accounts";
import { buildPresetApplicationComment } from "@/modules/explanations/decision-comment-builder";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { buildPresetRecommendation } from "@/modules/accounting/presets/recommendation-engine";
import {
  createOrganizationBusinessProfileVersion,
  recordOrganizationPresetApplication,
} from "@/modules/organizations/business-profiles";
import {
  activateOrganizationProfileVersion,
  updateOrganizationBasics,
} from "@/modules/organizations/settings";
import {
  importChartOfAccountsSpreadsheetDirect,
  runSpreadsheetImport,
} from "@/modules/spreadsheets";

function assertOrganizationManagerRole(role: string) {
  if (!["owner", "admin", "accountant"].includes(role)) {
    throw new Error("Tu rol no puede administrar la organizacion.");
  }
}

function parseStringArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
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
    fiscalAddressText: String(formData.get("fiscalAddressText") ?? ""),
    fiscalDepartment: String(formData.get("fiscalDepartment") ?? ""),
    fiscalCity: String(formData.get("fiscalCity") ?? ""),
    fiscalPostalCode: String(formData.get("fiscalPostalCode") ?? ""),
    locationRiskPolicy: String(formData.get("locationRiskPolicy") ?? "warn_and_require_note"),
    travelRadiusKmPolicy: String(formData.get("travelRadiusKmPolicy") ?? ""),
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

export async function updateOrganizationBusinessProfileAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  assertOrganizationManagerRole(organization.role);

  const primaryActivityCode = String(formData.get("primaryActivityCode") ?? "").trim();
  const secondaryActivityCodes = parseStringArray(formData.get("secondaryActivityCodes"));
  const selectedTraits = parseStringArray(formData.get("selectedTraits"));
  const shortBusinessDescription = String(formData.get("shortBusinessDescription") ?? "");

  if (!primaryActivityCode) {
    throw new Error("Selecciona una actividad principal antes de guardar el perfil.");
  }

  if (secondaryActivityCodes.length > 5) {
    throw new Error("Puedes guardar hasta 5 actividades secundarias.");
  }

  if (selectedTraits.length === 0) {
    throw new Error("Marca al menos un rasgo operativo o fiscal antes de guardar.");
  }

  const recommendation = buildPresetRecommendation({
    primaryActivityCode,
    secondaryActivityCodes,
    selectedTraits,
    shortDescription: shortBusinessDescription,
  });
  const selectedPresetComposition = String(formData.get("selectedPresetComposition") ?? "").trim();
  const planSetupMode = String(formData.get("planSetupMode") ?? "recommended").trim().toLowerCase();
  const selectedAlternative = recommendation.alternatives.find(
    (alternative) => alternative.code === selectedPresetComposition,
  ) ?? null;

  if (planSetupMode === "alternative" && !selectedAlternative) {
    throw new Error("La alternativa elegida ya no coincide con la recomendacion actual.");
  }

  const selectedComposition = planSetupMode === "alternative"
    ? selectedAlternative
    : recommendation.recommended;
  const applicationMode =
    planSetupMode === "alternative"
      ? "manual_pick"
      : planSetupMode === "external_import"
        ? "external_import"
        : planSetupMode === "minimal_temp_only"
          ? "minimal_temp_only"
          : "recommended";
  const supabase = getSupabaseServiceRoleClient();
  const createdVersion = await createOrganizationBusinessProfileVersion(supabase, {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    profile: {
      primaryActivityCode,
      secondaryActivityCodes,
      selectedTraits,
      shortDescription: shortBusinessDescription,
    },
    source: "settings_update",
  });

  if (selectedComposition && (applicationMode === "recommended" || applicationMode === "manual_pick")) {
    await applyPresetComposition(supabase, {
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      composition: selectedComposition,
      source: applicationMode,
    });
  }

  if (createdVersion) {
    await recordOrganizationPresetApplication(supabase, {
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      businessProfileVersionId: createdVersion.id,
      basePresetCode: (selectedComposition ?? recommendation.recommended).basePresetCode,
      overlayCodes: (selectedComposition ?? recommendation.recommended).overlayCodes,
      applicationMode,
      explanation: buildPresetApplicationComment({
        recommendation,
        applicationMode,
      }),
    });
  }

  await ensureStarterAccountingSetup(supabase, {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
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
    isProvisional: formData.get("isProvisional") === "on",
    externalCode: String(formData.get("externalCode") ?? ""),
    statementSection: String(formData.get("statementSection") ?? ""),
    natureTag: String(formData.get("natureTag") ?? ""),
    functionTag: String(formData.get("functionTag") ?? ""),
    cashflowTag: String(formData.get("cashflowTag") ?? ""),
    taxProfileHint: String(formData.get("taxProfileHint") ?? ""),
    currencyPolicy: String(formData.get("currencyPolicy") ?? ""),
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
    isProvisional: formData.get("isProvisional") === "on",
    externalCode: String(formData.get("externalCode") ?? ""),
    statementSection: String(formData.get("statementSection") ?? ""),
    natureTag: String(formData.get("natureTag") ?? ""),
    functionTag: String(formData.get("functionTag") ?? ""),
    cashflowTag: String(formData.get("cashflowTag") ?? ""),
    taxProfileHint: String(formData.get("taxProfileHint") ?? ""),
    currencyPolicy: String(formData.get("currencyPolicy") ?? ""),
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

    redirect(`/app/o/${organization.slug}/imports?run=${run.id}&focus=chart_of_accounts_import`);
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

export async function applyOrganizationChartPresetAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const presetCode = String(formData.get("presetCode") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  assertOrganizationManagerRole(organization.role);

  await applyOrganizationChartPreset({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    presetCode: presetCode as "uy_niif_importadores",
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}
