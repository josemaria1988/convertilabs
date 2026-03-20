export const canonicalFiscalPeriodStatuses = [
  "open",
  "ready_to_close",
  "soft_closed",
  "tax_locked",
  "hard_closed",
  "audit_frozen",
] as const;

export type CanonicalFiscalPeriodStatus = (typeof canonicalFiscalPeriodStatuses)[number];

export type LegacyFiscalPeriodStatus =
  | "review"
  | "closed"
  | "locked";

export type FiscalPeriodStatus =
  | CanonicalFiscalPeriodStatus
  | LegacyFiscalPeriodStatus;

export function normalizeFiscalPeriodStatus(
  value: string | null | undefined,
): CanonicalFiscalPeriodStatus {
  switch (value) {
    case "ready_to_close":
    case "soft_closed":
    case "tax_locked":
    case "hard_closed":
    case "audit_frozen":
    case "open":
      return value;
    case "review":
      return "ready_to_close";
    case "closed":
      return "hard_closed";
    case "locked":
      return "tax_locked";
    default:
      return "open";
  }
}

export function isFiscalPeriodLockedForPosting(input: {
  status: string | null | undefined;
  lockedAt?: string | null | undefined;
}) {
  if (typeof input.lockedAt === "string" && input.lockedAt.trim()) {
    return true;
  }

  const normalized = normalizeFiscalPeriodStatus(input.status);

  return [
    "soft_closed",
    "tax_locked",
    "hard_closed",
    "audit_frozen",
  ].includes(normalized);
}

export function isFiscalPeriodMutableForDocument(
  status: string | null | undefined,
) {
  const normalized = normalizeFiscalPeriodStatus(status);

  return normalized === "open" || normalized === "ready_to_close";
}

export function getFiscalPeriodDocumentMutationErrorMessage(
  status: string | null | undefined,
  periodCode: string | null | undefined,
) {
  const normalized = normalizeFiscalPeriodStatus(status);
  const label = periodCode?.trim() || "sin codigo";

  switch (normalized) {
    case "soft_closed":
      return `El periodo contable ${label} esta soft_closed y no acepta nuevo posting documental.`;
    case "tax_locked":
      return `El periodo contable ${label} esta tax_locked y requiere reapertura formal antes de mutar documentos.`;
    case "hard_closed":
      return `El periodo contable ${label} esta hard_closed y no puede mutarse desde el flujo documental.`;
    case "audit_frozen":
      return `El periodo contable ${label} esta audit_frozen y solo admite lectura.`;
    default:
      return `El periodo contable ${label} no admite mutaciones documentales.`;
  }
}
