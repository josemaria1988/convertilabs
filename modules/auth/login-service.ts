import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { logAuthEvent, logSupabaseAuthError } from "@/modules/auth/auth-logging";
import {
  getAuthStateForUser,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";
import {
  type LoginInput,
  validateLoginInput,
} from "@/modules/auth/login-schema";

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type LoginServiceResult =
  | {
      ok: true;
      status: "authenticated";
      message: string;
      redirectTo: string;
    }
  | {
      ok: false;
      status: number;
      error: ApiError;
    };

const invalidCredentialMarkers = [
  "invalid login credentials",
  "invalid_credentials",
];

const pendingConfirmationMarkers = [
  "email not confirmed",
  "signup requires email confirmation",
];

function matchAny(message: string, markers: string[]) {
  const normalized = message.toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

export async function loginUser(input: LoginInput): Promise<LoginServiceResult> {
  const validation = validateLoginInput(input);

  if (!validation.success) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "validation_error",
        message: "Revisa los campos marcados antes de continuar.",
        details: validation.errors,
      },
    };
  }

  const supabase = await getSupabaseServerClient();
  const { email, password, next } = validation.data;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const isPendingConfirmation = matchAny(
      error.message,
      pendingConfirmationMarkers,
    );
    const isInvalidCredentials = matchAny(
      error.message,
      invalidCredentialMarkers,
    );

    logSupabaseAuthError(
      isPendingConfirmation || isInvalidCredentials ? "warn" : "error",
      "login_failed",
      error,
      {
        requestedNext: next ?? null,
      },
    );

    if (isPendingConfirmation) {
      return {
        ok: false,
        status: 401,
        error: {
          code: "email_not_confirmed",
          message:
            "Tu cuenta todavia no confirmo el email. Revisa tu bandeja y vuelve a probar.",
        },
      };
    }

    if (isInvalidCredentials) {
      return {
        ok: false,
        status: 401,
        error: {
          code: "invalid_credentials",
          message: "Email o contrasena invalidos.",
        },
      };
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
        code: "auth_login_failed",
        message: "No se pudo iniciar sesion en este momento.",
      },
    };
  }

  if (!data.user || !data.session) {
    logAuthEvent("error", "login_missing_session", {
      hasUser: Boolean(data.user),
      hasSession: Boolean(data.session),
      requestedNext: next ?? null,
    });

    return {
      ok: false,
      status: 502,
      error: {
        code: "auth_login_failed",
        message: "Supabase no devolvio una sesion valida.",
      },
    };
  }

  const authState = await getAuthStateForUser(supabase, data.user);

  return {
    ok: true,
    status: "authenticated",
    message: "Sesion iniciada. Redirigiendo...",
    redirectTo: resolvePostAuthDestination(authState, next),
  };
}
