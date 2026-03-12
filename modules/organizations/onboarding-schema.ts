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

export type OrganizationOnboardingInput = {
  name: string;
  legalEntityType: string;
  taxId: string;
  taxRegimeCode: string;
};

export type OrganizationOnboardingFieldErrors = {
  name?: string;
  legalEntityType?: string;
  taxId?: string;
  taxRegimeCode?: string;
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

export function validateOrganizationOnboardingInput(
  input: OrganizationOnboardingInput,
): ValidationSuccess | ValidationFailure {
  const name = normalizeOrganizationName(input.name);
  const legalEntityType = input.legalEntityType.trim().toUpperCase();
  const taxId = normalizeTaxId(input.taxId);
  const taxRegimeCode = input.taxRegimeCode.trim().toUpperCase();
  const errors: OrganizationOnboardingFieldErrors = {};

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
