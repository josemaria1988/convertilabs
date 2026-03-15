import {
  isSupportedCfeStatus,
  isSupportedDgiGroup,
  isSupportedVatRegime,
  supportedCfeStatuses,
  supportedDgiGroups,
  supportedVatRegimes,
} from "@/modules/tax/uy-vat-profile";

export const organizationNameMinLength = 2;
export const organizationNameMaxLength = 120;
export const supportedLegalEntityTypes = [
  "SA",
  "SRL",
  "SAS",
  "UNIPERSONAL",
] as const;
export const supportedTaxRegimeCodes = [
  "IRAE_GENERAL",
  "IRAE_LITERAL_E",
] as const;
export const supportedPlanSetupModes = [
  "recommended",
  "alternative",
  "external_import",
  "minimal_temp_only",
  "hybrid_ai_recommended",
] as const;

export type OrganizationOnboardingInput = {
  name: string;
  legalEntityType: string;
  taxId: string;
  taxRegimeCode: string;
  vatRegime: string;
  dgiGroup: string;
  cfeStatus: string;
  primaryActivityCode?: string;
  secondaryActivityCodes?: string[];
  selectedTraits?: string[];
  shortBusinessDescription?: string | null;
  planSetupMode?: string;
  selectedPresetComposition?: string | null;
  aiRunId?: string | null;
};

export type OrganizationOnboardingFieldErrors = {
  name?: string;
  legalEntityType?: string;
  taxId?: string;
  taxRegimeCode?: string;
  vatRegime?: string;
  dgiGroup?: string;
  cfeStatus?: string;
  primaryActivityCode?: string;
  secondaryActivityCodes?: string;
  selectedTraits?: string;
  shortBusinessDescription?: string;
  planSetupMode?: string;
  selectedPresetComposition?: string;
  aiRunId?: string;
};

type ValidationSuccess = {
  success: true;
  data: OrganizationOnboardingInput;
};

type ValidationFailure = {
  success: false;
  errors: OrganizationOnboardingFieldErrors;
};

export function normalizeOrganizationName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTaxId(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizeStringArray(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeShortBusinessDescription(value: string | null | undefined) {
  const normalized = normalizeOrganizationName(value ?? "");
  return normalized.length > 0 ? normalized : null;
}

export function validateOrganizationOnboardingInput(
  input: OrganizationOnboardingInput,
  options?: {
    requireBusinessProfile?: boolean;
  },
): ValidationSuccess | ValidationFailure {
  const name = normalizeOrganizationName(input.name);
  const legalEntityType = input.legalEntityType.trim().toUpperCase();
  const taxId = normalizeTaxId(input.taxId);
  const taxRegimeCode = input.taxRegimeCode.trim().toUpperCase();
  const vatRegime = input.vatRegime.trim().toUpperCase();
  const dgiGroup = input.dgiGroup.trim().toUpperCase();
  const cfeStatus = input.cfeStatus.trim().toUpperCase();
  const primaryActivityCode = input.primaryActivityCode?.trim() ?? "";
  const secondaryActivityCodes = normalizeStringArray(input.secondaryActivityCodes);
  const selectedTraits = normalizeStringArray(input.selectedTraits);
  const shortBusinessDescription = normalizeShortBusinessDescription(
    input.shortBusinessDescription,
  );
  const planSetupMode = input.planSetupMode?.trim().toLowerCase() ?? "recommended";
  const selectedPresetComposition = input.selectedPresetComposition?.trim() || null;
  const aiRunId = input.aiRunId?.trim() || null;
  const errors: OrganizationOnboardingFieldErrors = {};
  const requireBusinessProfile = options?.requireBusinessProfile ?? false;

  if (!name) {
    errors.name = "Ingresa el nombre de la organizacion.";
  } else if (name.length < organizationNameMinLength) {
    errors.name = `Usa al menos ${organizationNameMinLength} caracteres.`;
  } else if (name.length > organizationNameMaxLength) {
    errors.name = `Usa como maximo ${organizationNameMaxLength} caracteres.`;
  }

  if (!supportedLegalEntityTypes.includes(legalEntityType as (typeof supportedLegalEntityTypes)[number])) {
    errors.legalEntityType = "Selecciona una forma juridica soportada para V1.";
  }

  if (taxId.length < 8) {
    errors.taxId = "Ingresa un RUT valido para la organizacion.";
  }

  if (!supportedTaxRegimeCodes.includes(taxRegimeCode as (typeof supportedTaxRegimeCodes)[number])) {
    errors.taxRegimeCode = "Selecciona un regimen tributario soportado para V1.";
  }

  if (!isSupportedVatRegime(vatRegime)) {
    errors.vatRegime = "Selecciona un regimen IVA explicito para continuar.";
  }

  if (!isSupportedDgiGroup(dgiGroup)) {
    errors.dgiGroup = "Selecciona el grupo DGI operativo de la organizacion.";
  }

  if (!isSupportedCfeStatus(cfeStatus)) {
    errors.cfeStatus = "Selecciona el estado CFE actual de la organizacion.";
  }

  if (requireBusinessProfile) {
    if (!primaryActivityCode) {
      errors.primaryActivityCode = "Selecciona la actividad principal para recibir una recomendacion usable.";
    }

    if (!supportedPlanSetupModes.includes(planSetupMode as (typeof supportedPlanSetupModes)[number])) {
      errors.planSetupMode = "Selecciona como quieres arrancar el plan de cuentas.";
    }

    if (secondaryActivityCodes.length > 5) {
      errors.secondaryActivityCodes = "Puedes seleccionar hasta 5 actividades secundarias.";
    }

    if (selectedTraits.length === 0) {
      errors.selectedTraits = "Marca al menos un rasgo operativo o fiscal que describa la empresa.";
    }

    if ((planSetupMode === "recommended" || planSetupMode === "alternative") && !selectedPresetComposition) {
      errors.selectedPresetComposition = "No pudimos identificar la composicion elegida. Revisa la recomendacion antes de continuar.";
    }

    if (planSetupMode === "hybrid_ai_recommended") {
      if (!selectedPresetComposition) {
        errors.selectedPresetComposition = "La recomendacion hibrida no tiene una composicion seleccionada valida.";
      }

      if (!aiRunId) {
        errors.aiRunId = "La recomendacion IA ya no esta vigente. Consulta de nuevo antes de continuar.";
      }
    }

    if (shortBusinessDescription && shortBusinessDescription.length > 240) {
      errors.shortBusinessDescription = "Usa una descripcion corta de hasta 240 caracteres.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      name,
      legalEntityType,
      taxId,
      taxRegimeCode,
      vatRegime,
      dgiGroup,
      cfeStatus,
      primaryActivityCode,
      secondaryActivityCodes,
      selectedTraits,
      shortBusinessDescription,
      planSetupMode,
      selectedPresetComposition,
      aiRunId,
    },
  };
}

export function slugifyOrganizationNamePreview(value: string) {
  return normalizeOrganizationName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export {
  supportedVatRegimes,
  supportedDgiGroups,
  supportedCfeStatuses,
};
