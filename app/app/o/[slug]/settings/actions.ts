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
import {
  attachPresetAiRunToOrganization,
  buildPresetAiSettingsOrganizationContext,
  buildHybridPresetApplicationExplanation,
  buildPresetAiInputHash,
  buildPresetAiOutputFromStoredRun,
  derivePresetHybridRecommendation,
  findPresetCompositionByCode,
  loadPresetAiRunForUser,
  resolvePresetApplicationMode,
} from "@/modules/accounting/presets/ai-recommendation";
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

async function resolveSettingsSelectedComposition(input: {
  actorId: string;
  serviceRole: ReturnType<typeof getSupabaseServiceRoleClient>;
  organization: {
    id: string;
    slug: string;
    name: string;
    legalEntityType: string | null;
    taxId: string | null;
    taxRegimeCode: string | null;
    vatRegime: string | null;
    dgiGroup: string | null;
    cfeStatus: string | null;
  };
  recommendation: ReturnType<typeof buildPresetRecommendation>;
  profile: {
    primaryActivityCode: string;
    secondaryActivityCodes: string[];
    selectedTraits: string[];
    shortDescription: string | null | undefined;
  };
  planSetupMode: string;
  selectedPresetComposition: string;
  aiRunId: string | null;
}) {
  if (input.planSetupMode === "hybrid_ai_recommended") {
    if (!input.aiRunId) {
      throw new Error("La recomendacion IA ya no esta vigente. Consulta de nuevo antes de guardar.");
    }

    const aiRun = await loadPresetAiRunForUser(input.serviceRole, {
      runId: input.aiRunId,
      requestedBy: input.actorId,
    });

    if (!aiRun || aiRun.status !== "completed") {
      throw new Error("No encontramos una corrida IA valida para esta recomendacion.");
    }

    const expectedInputHash = buildPresetAiInputHash({
      scope: "settings",
      organizationContext: buildPresetAiSettingsOrganizationContext({
        organizationId: input.organization.id,
        slug: input.organization.slug,
        organizationName: input.organization.name,
        legalEntityType: input.organization.legalEntityType,
        taxId: input.organization.taxId,
        taxRegimeCode: input.organization.taxRegimeCode,
        vatRegime: input.organization.vatRegime,
        dgiGroup: input.organization.dgiGroup,
        cfeStatus: input.organization.cfeStatus,
      }),
      profile: input.profile,
      recommendation: input.recommendation,
    });

    if (aiRun.input_hash !== expectedInputHash) {
      throw new Error("La recomendacion IA quedo desactualizada. Consulta de nuevo antes de guardar.");
    }

    const aiOutput = buildPresetAiOutputFromStoredRun(aiRun);

    if (!aiOutput) {
      throw new Error("La corrida IA no tiene una salida estructurada utilizable.");
    }

    const hybridRecommendation = derivePresetHybridRecommendation({
      recommendation: input.recommendation,
      aiOutput,
      runId: aiRun.id,
      inputHash: aiRun.input_hash,
      costCenterDraftSaved: aiRun.cost_center_draft_saved,
    });

    if (!hybridRecommendation.shouldAutoSelect) {
      throw new Error("La recomendacion IA no alcanzo la confianza necesaria para autoaplicarse.");
    }

    const composition = findPresetCompositionByCode(
      input.recommendation,
      aiOutput.selectedCompositionCode,
    );

    if (!composition) {
      throw new Error("La composicion sugerida por IA ya no coincide con el catalogo actual.");
    }

    if (input.selectedPresetComposition && input.selectedPresetComposition !== composition.code) {
      throw new Error("La composicion elegida ya no coincide con la ultima recomendacion IA.");
    }

    return {
      applicationMode: "hybrid_ai_recommended" as const,
      composition,
      aiRunId: aiRun.id,
      hybridRecommendation,
    };
  }

  const selectedAlternative = input.recommendation.alternatives.find(
    (alternative) => alternative.code === input.selectedPresetComposition,
  ) ?? null;

  if (input.planSetupMode === "alternative" && !selectedAlternative) {
    throw new Error("La alternativa elegida ya no coincide con la recomendacion actual.");
  }

  return {
    applicationMode: resolvePresetApplicationMode({
      planSetupMode: input.planSetupMode,
    }),
    composition: input.planSetupMode === "alternative"
      ? selectedAlternative
      : input.recommendation.recommended,
    aiRunId: null,
    hybridRecommendation: null,
  };
}

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

async function loadOrganizationPresetAiContext(
  serviceRole: ReturnType<typeof getSupabaseServiceRoleClient>,
  organizationId: string,
) {
  const { data, error } = await serviceRole
    .from("organizations")
    .select("name, legal_entity_type, tax_id, tax_regime_code, vat_regime, dgi_group, cfe_status")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "No pudimos cargar el contexto actual de la organizacion.");
  }

  return {
    name: data.name as string,
    legalEntityType: (data.legal_entity_type as string | null) ?? null,
    taxId: (data.tax_id as string | null) ?? null,
    taxRegimeCode: (data.tax_regime_code as string | null) ?? null,
    vatRegime: (data.vat_regime as string | null) ?? null,
    dgiGroup: (data.dgi_group as string | null) ?? null,
    cfeStatus: (data.cfe_status as string | null) ?? null,
  };
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
  const aiRunId = String(formData.get("aiRunId") ?? "").trim() || null;
  const supabase = getSupabaseServiceRoleClient();
  const settingsSnapshot = await loadOrganizationPresetAiContext(supabase, organization.id);
  const selectedCompositionResolution = await resolveSettingsSelectedComposition({
    actorId: authState.user?.id ?? "",
    serviceRole: supabase,
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      legalEntityType: settingsSnapshot.legalEntityType,
      taxId: settingsSnapshot.taxId,
      taxRegimeCode: settingsSnapshot.taxRegimeCode,
      vatRegime: settingsSnapshot.vatRegime,
      dgiGroup: settingsSnapshot.dgiGroup,
      cfeStatus: settingsSnapshot.cfeStatus,
    },
    recommendation,
    profile: {
      primaryActivityCode,
      secondaryActivityCodes,
      selectedTraits,
      shortDescription: shortBusinessDescription,
    },
    planSetupMode,
    selectedPresetComposition,
    aiRunId,
  });
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

  if (
    selectedCompositionResolution.composition
    && (
      selectedCompositionResolution.applicationMode === "recommended"
      || selectedCompositionResolution.applicationMode === "manual_pick"
      || selectedCompositionResolution.applicationMode === "hybrid_ai_recommended"
    )
  ) {
    await applyPresetComposition(supabase, {
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      composition: selectedCompositionResolution.composition,
      source: selectedCompositionResolution.applicationMode,
    });
  }

  if (createdVersion) {
    if (selectedCompositionResolution.aiRunId) {
      await attachPresetAiRunToOrganization(supabase, {
        runId: selectedCompositionResolution.aiRunId,
        organizationId: organization.id,
        businessProfileVersionId: createdVersion.id,
      });
    }

    await recordOrganizationPresetApplication(supabase, {
      organizationId: organization.id,
      actorId: authState.user?.id ?? null,
      businessProfileVersionId: createdVersion.id,
      basePresetCode: (selectedCompositionResolution.composition ?? recommendation.recommended).basePresetCode,
      overlayCodes: (selectedCompositionResolution.composition ?? recommendation.recommended).overlayCodes,
      applicationMode: selectedCompositionResolution.applicationMode,
      aiRunId: selectedCompositionResolution.aiRunId,
      explanation:
        selectedCompositionResolution.applicationMode === "hybrid_ai_recommended"
        && selectedCompositionResolution.hybridRecommendation
        && selectedCompositionResolution.composition
          ? buildHybridPresetApplicationExplanation({
              selectedComposition: selectedCompositionResolution.composition,
              hybridRecommendation: selectedCompositionResolution.hybridRecommendation,
            })
          : buildPresetApplicationComment({
              recommendation,
              applicationMode: selectedCompositionResolution.applicationMode,
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
