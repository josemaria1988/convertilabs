type LogLevel = "warn" | "error";

type AuthErrorLike = {
  name?: string | null;
  message?: string | null;
  status?: number | null;
  code?: string | null;
};

type AuthLogContext = Record<string, unknown>;

function writeLog(level: LogLevel, event: string, payload: AuthLogContext) {
  const logger = level === "error" ? console.error : console.warn;
  logger(`[auth] ${event}`, payload);
}

export function logAuthEvent(
  level: LogLevel,
  event: string,
  context: AuthLogContext = {},
) {
  writeLog(level, event, context);
}

export function logSupabaseAuthError(
  level: LogLevel,
  event: string,
  error: AuthErrorLike | null | undefined,
  context: AuthLogContext = {},
) {
  writeLog(level, event, {
    ...context,
    authError: error
      ? {
          name: error.name ?? null,
          status: error.status ?? null,
          code: error.code ?? null,
          message: error.message ?? null,
        }
      : null,
  });
}
