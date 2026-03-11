export const signupPasswordMinLength = 12;

const signupPasswordMaxLength = 128;
const fullNameMinLength = 2;
const fullNameMaxLength = 120;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
};

export type SignupField = keyof SignupInput;

export type SignupFieldErrors = Partial<Record<SignupField, string>>;

export type SignupValidationResult =
  | {
      success: true;
      data: SignupInput;
    }
  | {
      success: false;
      errors: SignupFieldErrors;
    };

export function normalizeSignupInput(input: SignupInput): SignupInput {
  return {
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
}

export function validateSignupInput(input: SignupInput): SignupValidationResult {
  const normalized = normalizeSignupInput(input);
  const errors: SignupFieldErrors = {};

  if (normalized.fullName.length < fullNameMinLength) {
    errors.fullName = "Ingresa tu nombre completo.";
  } else if (normalized.fullName.length > fullNameMaxLength) {
    errors.fullName = "El nombre es demasiado largo.";
  }

  if (!emailPattern.test(normalized.email)) {
    errors.email = "Ingresa un email valido.";
  }

  if (normalized.password.length < signupPasswordMinLength) {
    errors.password = `La contrasena debe tener al menos ${signupPasswordMinLength} caracteres.`;
  } else if (normalized.password.length > signupPasswordMaxLength) {
    errors.password = "La contrasena es demasiado larga.";
  } else if (!/[A-Za-z]/.test(normalized.password) || !/\d/.test(normalized.password)) {
    errors.password = "Usa una contrasena con letras y numeros.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: normalized,
  };
}
