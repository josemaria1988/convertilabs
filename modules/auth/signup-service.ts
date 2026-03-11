import "server-only";
import { getPublicEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAuthStateForUser,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";
import {
  type SignupInput,
  validateSignupInput,
} from "@/modules/auth/signup-schema";

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type SignupServiceResult =
  | {
      ok: true;
      status: "signup_requested" | "signed_in";
      email: string;
      message: string;
      nextStep: "check_email" | "redirect";
      redirectTo?: string;
    }
  | {
      ok: false;
      status: number;
      error: ApiError;
    };

const duplicateSignupMarkers = [
  "user already registered",
  "already been registered",
  "user_already_exists",
];

function buildEmailRedirectTo() {
  const { appUrl } = getPublicEnv();
  const redirectUrl = new URL("/auth/confirm", appUrl);

  return redirectUrl.toString();
}

function buildSuccess(email: string): SignupServiceResult {
  return {
    ok: true,
    status: "signup_requested",
    email,
    message:
      "Revisa tu correo para confirmar el acceso. Si tu proyecto no exige confirmacion por email, la cuenta ya quedo creada.",
    nextStep: "check_email",
  };
}

function isDuplicateSignupError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return duplicateSignupMarkers.some((marker) =>
    normalizedMessage.includes(marker),
  );
}

export async function signupUser(input: SignupInput): Promise<SignupServiceResult> {
  const validation = validateSignupInput(input);

  if (!validation.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "validation_error",
        message: "Corrige los campos marcados e intenta de nuevo.",
        details: validation.errors,
      },
    };
  }

  const supabase = await getSupabaseServerClient();
  const { fullName, email, password } = validation.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: buildEmailRedirectTo(),
    },
  });

  if (error) {
    if (isDuplicateSignupError(error.message)) {
      return buildSuccess(email);
    }

    if (error.status === 429) {
      return {
        ok: false,
        status: 429,
        error: {
          code: "rate_limited",
          message: "Demasiados intentos. Espera un momento antes de volver a probar.",
        },
      };
    }

    return {
      ok: false,
      status: 502,
      error: {
        code: "auth_signup_failed",
        message: "No se pudo crear la cuenta en este momento.",
      },
    };
  }

  if (!data.user && !data.session) {
    return {
      ok: false,
      status: 502,
      error: {
        code: "auth_signup_failed",
        message: "Supabase no devolvio un resultado valido para el alta.",
      },
    };
  }

  if (data.user && data.session) {
    const authState = await getAuthStateForUser(supabase, data.user);

    return {
      ok: true,
      status: "signed_in",
      email,
      message: "Cuenta creada. Redirigiendo al espacio privado.",
      nextStep: "redirect",
      redirectTo: resolvePostAuthDestination(authState),
    };
  }

  return buildSuccess(email);
}
