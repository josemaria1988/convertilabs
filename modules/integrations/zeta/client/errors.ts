import type { ZetaErrorPayload } from "@/modules/integrations/zeta/contracts/shared";

export class ZetaIntegrationError extends Error {
  code: string;
  status?: number;
  endpointName?: string;
  details?: unknown;

  constructor(input: {
    code: string;
    message: string;
    status?: number;
    endpointName?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ZetaIntegrationError";
    this.code = input.code;
    this.status = input.status;
    this.endpointName = input.endpointName;
    this.details = input.details;
    this.cause = input.cause;
  }
}

function stringifyDetail(detail: unknown) {
  if (!Array.isArray(detail) || detail.length === 0) {
    return null;
  }

  const first = detail[0];

  if (!first || typeof first !== "object") {
    return null;
  }

  const maybeDescription = (first as { Descripcion?: unknown }).Descripcion;

  return typeof maybeDescription === "string" && maybeDescription.trim()
    ? maybeDescription.trim()
    : null;
}

export function normalizeZetaErrorPayload(error: ZetaErrorPayload | null | undefined) {
  const code = typeof error?.Code === "string" && error.Code.trim()
    ? error.Code.trim()
    : "zeta_api_error";
  const detailDescription = stringifyDetail(error?.Detail);
  const message = typeof error?.Message === "string" && error.Message.trim()
    ? error.Message.trim()
    : detailDescription ?? "Zetasoftware devolvio un error sin mensaje.";

  return {
    code,
    message,
    detail: error?.Detail,
  };
}

export function normalizeZetaException(error: unknown) {
  if (error instanceof ZetaIntegrationError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      endpointName: error.endpointName,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "zeta_unexpected_error",
      message: error.message,
    };
  }

  return {
    code: "zeta_unexpected_error",
    message: "Error inesperado al llamar Zetasoftware.",
  };
}
