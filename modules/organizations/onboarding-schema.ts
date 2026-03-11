export const organizationNameMinLength = 2;
export const organizationNameMaxLength = 120;

export type OrganizationOnboardingInput = {
  name: string;
};

export type OrganizationOnboardingFieldErrors = {
  name?: string;
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

export function validateOrganizationOnboardingInput(
  input: OrganizationOnboardingInput,
): ValidationSuccess | ValidationFailure {
  const name = normalizeOrganizationName(input.name);
  const errors: OrganizationOnboardingFieldErrors = {};

  if (!name) {
    errors.name = "Ingresa el nombre de la organizacion.";
  } else if (name.length < organizationNameMinLength) {
    errors.name = `Usa al menos ${organizationNameMinLength} caracteres.`;
  } else if (name.length > organizationNameMaxLength) {
    errors.name = `Usa como maximo ${organizationNameMaxLength} caracteres.`;
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
