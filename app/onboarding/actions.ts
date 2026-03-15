"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServiceRoleClient, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAuthStateForUser,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";
import { applyPresetComposition } from "@/modules/accounting/preset-apply-service";
import { ensureStarterAccountingSetup } from "@/modules/accounting/starter-accounts";
import { buildPresetApplicationComment } from "@/modules/explanations/decision-comment-builder";
import type { OnboardingActionState } from "@/modules/organizations/onboarding-action-state";
import {
  createOrganizationBusinessProfileVersion,
  recordOrganizationPresetApplication,
} from "@/modules/organizations/business-profiles";
import { getOrganizationFeatureFlags } from "@/modules/organizations/feature-flags";
import {
  validateOrganizationOnboardingInput,
} from "@/modules/organizations/onboarding-schema";
import { buildPresetRecommendation } from "@/modules/accounting/presets/recommendation-engine";

type CreateOrganizationRpcResult = {
  organization_id: string;
  slug: string;
};

function buildActionError(
  message: string,
  fieldErrors = {},
): OnboardingActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
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

function mapCreateOrganizationError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("already belongs to an active organization")) {
    return buildActionError(
      "Tu cuenta ya tiene una organizacion activa. Redirigiendo al espacio privado si corresponde.",
    );
  }

  if (
    normalizedMessage.includes("at least 2 characters")
    || normalizedMessage.includes("at most 120 characters")
    || normalizedMessage.includes("include letters or numbers")
  ) {
    return buildActionError(
      "Revisa el nombre de la organizacion antes de continuar.",
      {
        name: "El nombre debe ser valido para generar un slug estable.",
      },
    );
  }

  if (normalizedMessage.includes("legal entity type is required")) {
    return buildActionError("Falta la forma juridica de la organizacion.", {
      legalEntityType: "Selecciona una forma juridica para continuar.",
    });
  }

  if (normalizedMessage.includes("tax id is required")) {
    return buildActionError("Falta el RUT de la organizacion.", {
      taxId: "Ingresa un RUT valido para continuar.",
    });
  }

  if (normalizedMessage.includes("tax regime code is required")) {
    return buildActionError("Falta el regimen tributario de la organizacion.", {
      taxRegimeCode: "Selecciona un regimen tributario soportado para V1.",
    });
  }

  if (normalizedMessage.includes("vat regime is required")) {
    return buildActionError("Falta el regimen IVA de la organizacion.", {
      vatRegime: "Selecciona un regimen IVA explicito para continuar.",
    });
  }

  if (normalizedMessage.includes("dgi group is required")) {
    return buildActionError("Falta el grupo DGI de la organizacion.", {
      dgiGroup: "Selecciona el grupo DGI para continuar.",
    });
  }

  if (normalizedMessage.includes("cfe status is required")) {
    return buildActionError("Falta el estado CFE de la organizacion.", {
      cfeStatus: "Selecciona el estado CFE para continuar.",
    });
  }

  return buildActionError(
    "No se pudo crear la organizacion en este momento. Intenta de nuevo.",
  );
}

function resolveSelectedComposition(input: {
  recommendation: ReturnType<typeof buildPresetRecommendation>;
  planSetupMode: string | undefined;
  selectedPresetComposition: string | null | undefined;
}) {
  const planSetupMode = input.planSetupMode ?? "recommended";

  if (planSetupMode === "recommended") {
    return {
      applicationMode: "recommended" as const,
      composition: input.recommendation.recommended,
    };
  }

  if (planSetupMode === "alternative") {
    const selected = input.recommendation.alternatives.find(
      (alternative) => alternative.code === input.selectedPresetComposition,
    );

    if (!selected) {
      throw new Error("La alternativa elegida ya no coincide con la recomendacion actual.");
    }

    return {
      applicationMode: "manual_pick" as const,
      composition: selected,
    };
  }

  if (planSetupMode === "external_import") {
    return {
      applicationMode: "external_import" as const,
      composition: null,
    };
  }

  return {
    applicationMode: "minimal_temp_only" as const,
    composition: null,
  };
}

export async function createOrganizationAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const featureFlags = getOrganizationFeatureFlags();
  const validation = validateOrganizationOnboardingInput({
    name: String(formData.get("name") ?? ""),
    legalEntityType: String(formData.get("legalEntityType") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    taxRegimeCode: String(formData.get("taxRegimeCode") ?? ""),
    vatRegime: String(formData.get("vatRegime") ?? ""),
    dgiGroup: String(formData.get("dgiGroup") ?? ""),
    cfeStatus: String(formData.get("cfeStatus") ?? ""),
    primaryActivityCode: String(formData.get("primaryActivityCode") ?? ""),
    secondaryActivityCodes: parseStringArray(formData.get("secondaryActivityCodes")),
    selectedTraits: parseStringArray(formData.get("selectedTraits")),
    shortBusinessDescription: String(formData.get("shortBusinessDescription") ?? ""),
    planSetupMode: String(formData.get("planSetupMode") ?? "recommended"),
    selectedPresetComposition: String(formData.get("selectedPresetComposition") ?? ""),
  }, {
    requireBusinessProfile: featureFlags.onboardingActivityBasedPresetsEnabled,
  });

  if (!validation.success) {
    return buildActionError(
      "Revisa los datos de la organizacion antes de continuar.",
      validation.errors,
    );
  }

  const authState = await getAuthStateForUser(supabase, user);

  if (authState.primaryOrganization) {
    redirect(resolvePostAuthDestination(authState));
  }

  const rpcResult = await supabase
    .rpc("create_organization_with_owner", {
      p_name: validation.data.name,
      p_legal_entity_type: validation.data.legalEntityType,
      p_tax_id: validation.data.taxId,
      p_tax_regime_code: validation.data.taxRegimeCode,
      p_vat_regime: validation.data.vatRegime,
      p_dgi_group: validation.data.dgiGroup,
      p_cfe_status: validation.data.cfeStatus,
    })
    .single();

  const data = rpcResult.data as CreateOrganizationRpcResult | null;

  if (rpcResult.error || !data?.slug) {
    const refreshedAuthState = await getAuthStateForUser(supabase, user);

    if (refreshedAuthState.primaryOrganization) {
      redirect(resolvePostAuthDestination(refreshedAuthState));
    }

    return mapCreateOrganizationError(
      rpcResult.error?.message ?? "Unknown create organization error.",
    );
  }

  const serviceRole = getSupabaseServiceRoleClient();

  if (!featureFlags.onboardingActivityBasedPresetsEnabled) {
    await ensureStarterAccountingSetup(serviceRole, {
      organizationId: data.organization_id,
      actorId: user.id,
    });

    revalidatePath("/app");
    revalidatePath("/onboarding");
    redirect(`/app/o/${data.slug}/dashboard`);
  }

  let destination = `/app/o/${data.slug}/dashboard`;

  try {
    const recommendation = buildPresetRecommendation({
      primaryActivityCode: validation.data.primaryActivityCode ?? "",
      secondaryActivityCodes: validation.data.secondaryActivityCodes ?? [],
      selectedTraits: validation.data.selectedTraits ?? [],
      shortDescription: validation.data.shortBusinessDescription,
    });
    const selectedComposition = resolveSelectedComposition({
      recommendation,
      planSetupMode: validation.data.planSetupMode,
      selectedPresetComposition: validation.data.selectedPresetComposition,
    });
    const createdBusinessProfileVersion = await createOrganizationBusinessProfileVersion(
      serviceRole,
      {
        organizationId: data.organization_id,
        actorId: user.id,
        profile: {
          primaryActivityCode: validation.data.primaryActivityCode ?? "",
          secondaryActivityCodes: validation.data.secondaryActivityCodes ?? [],
          selectedTraits: validation.data.selectedTraits ?? [],
          shortDescription: validation.data.shortBusinessDescription,
        },
        source: "onboarding",
      },
    );

    if (selectedComposition.composition) {
      await applyPresetComposition(serviceRole, {
        organizationId: data.organization_id,
        actorId: user.id,
        composition: selectedComposition.composition,
        source: selectedComposition.applicationMode,
      });
    }

    await ensureStarterAccountingSetup(serviceRole, {
      organizationId: data.organization_id,
      actorId: user.id,
    });

    if (createdBusinessProfileVersion) {
      await recordOrganizationPresetApplication(serviceRole, {
        organizationId: data.organization_id,
        actorId: user.id,
        businessProfileVersionId: createdBusinessProfileVersion.id,
        basePresetCode:
          selectedComposition.composition?.basePresetCode
          ?? recommendation.recommended.basePresetCode,
        overlayCodes:
          selectedComposition.composition?.overlayCodes
          ?? recommendation.recommended.overlayCodes,
        applicationMode: selectedComposition.applicationMode,
        explanation: buildPresetApplicationComment({
          recommendation,
          applicationMode: selectedComposition.applicationMode,
        }),
      });
    }

    revalidatePath("/app");
    revalidatePath("/onboarding");
    if (selectedComposition.applicationMode === "external_import") {
      destination = `/app/o/${data.slug}/imports?focus=chart_of_accounts_import&from=onboarding`;
    }
  } catch {
    await ensureStarterAccountingSetup(serviceRole, {
      organizationId: data.organization_id,
      actorId: user.id,
    });

    revalidatePath("/app");
    revalidatePath("/onboarding");
  }

  redirect(destination);
}
