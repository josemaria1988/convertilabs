export type ZetaPaymentTermKind = "cash" | "credit" | "special" | "unknown";

function normalizeCode(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value).trim().toLowerCase();
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sameCode(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  const normalizedLeft = normalizeCode(left);
  const normalizedRight = normalizeCode(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function classifyZetaPaymentTerm(input: {
  code: string | number;
  label?: string | null;
  configuredCashCode?: string | number | null;
  configuredCreditCode?: string | number | null;
  configuredPaidByPartnerCode?: string | number | null;
}): ZetaPaymentTermKind {
  const matchesCash = sameCode(input.code, input.configuredCashCode);
  const matchesCredit = sameCode(input.code, input.configuredCreditCode);

  if (matchesCash && matchesCredit) {
    return "unknown";
  }

  if (matchesCash) {
    return "cash";
  }

  if (matchesCredit) {
    return "credit";
  }

  if (sameCode(input.code, input.configuredPaidByPartnerCode)) {
    return "special";
  }

  const label = normalizeLabel(input.label);
  const looksCash = ["contado", "efectivo", "cash", "inmediato", "anticipado"]
    .some((token) => label.includes(token));
  const looksCredit = ["credito", "credit", "cuota", "plazo", "siif"]
    .some((token) => label.includes(token))
    || /\b\d+\s*dias?\b/.test(label);

  if (looksCash === looksCredit) {
    return "unknown";
  }

  return looksCash ? "cash" : "credit";
}

export function isZetaPaymentTermCompatible(input: {
  kind: ZetaPaymentTermKind;
  paymentTerms: string | null | undefined;
  settlementMethod?: string | null;
}) {
  if (input.paymentTerms !== "cash" && input.paymentTerms !== "credit") {
    return false;
  }

  if (input.kind === "special") {
    return input.settlementMethod === "paid_by_partner";
  }

  return input.kind === input.paymentTerms;
}
