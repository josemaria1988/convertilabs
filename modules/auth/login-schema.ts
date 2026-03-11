const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginInput = {
  email: string;
  password: string;
  next?: string;
};

export type LoginField = "email" | "password";
export type LoginFieldErrors = Partial<Record<LoginField, string>>;

export type LoginValidationResult =
  | {
      success: true;
      data: LoginInput;
    }
  | {
      success: false;
      errors: LoginFieldErrors;
    };

export function normalizeLoginInput(input: LoginInput): LoginInput {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    next: input.next?.trim(),
  };
}

export function validateLoginInput(input: LoginInput): LoginValidationResult {
  const normalized = normalizeLoginInput(input);
  const errors: LoginFieldErrors = {};

  if (!emailPattern.test(normalized.email)) {
    errors.email = "Ingresa un email valido.";
  }

  if (!normalized.password) {
    errors.password = "Ingresa tu contrasena.";
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
