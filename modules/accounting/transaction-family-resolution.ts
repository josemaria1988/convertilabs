import type { DocumentRoleCandidate } from "@/modules/ai/document-intake-contract";

type TransactionFamilyMatch = {
  status: "matched" | "tentative" | "not_matched" | "ambiguous";
  strategy: "tax_id" | "exact_alias" | "token_overlap" | "none" | "ambiguous";
  confidence: number;
  evidence: string[];
};

export type TransactionFamilyResolutionSource =
  | "deterministic_tax_id"
  | "deterministic_alias"
  | "ambiguous_identity"
  | "model_fallback"
  | "manual_override";

export type TransactionFamilyResolution = {
  documentRole: DocumentRoleCandidate;
  documentSubtype: string;
  source: TransactionFamilyResolutionSource;
  confidence: number;
  shouldReview: boolean;
  warnings: string[];
  evidence: string[];
};

type DocumentSubtypeKind =
  | "invoice"
  | "credit_note"
  | "receipt"
  | "payment_support"
  | "other";

function dedupeStrings(values: string[]) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

function normalizeSubtypeKind(candidate: string | null | undefined): DocumentSubtypeKind {
  const normalized = (candidate ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!normalized) {
    return "invoice";
  }

  if (
    normalized.includes("credit_note")
    || normalized.includes("credit note")
    || normalized.includes("nota de credito")
    || normalized.includes("nota_credito")
  ) {
    return "credit_note";
  }

  if (
    normalized.includes("payment_support")
    || normalized.includes("payment support")
    || normalized.includes("payment voucher")
    || normalized.includes("pago")
  ) {
    return "payment_support";
  }

  if (
    normalized.includes("receipt")
    || normalized.includes("recibo")
    || normalized.includes("cobro")
    || normalized.includes("collection")
  ) {
    return "receipt";
  }

  if (
    normalized.includes("invoice")
    || normalized.includes("factura")
    || normalized.includes("supplier_invoice")
    || normalized.includes("customer_invoice")
  ) {
    return "invoice";
  }

  return "other";
}

function mapSubtypeForRole(
  role: DocumentRoleCandidate,
  kind: DocumentSubtypeKind,
  fallbackCandidate: string | null | undefined,
) {
  if (role === "purchase") {
    if (kind === "credit_note") {
      return "purchase_credit_note";
    }

    if (kind === "payment_support" || kind === "receipt") {
      return "purchase_payment_support";
    }

    if (kind === "invoice") {
      return "purchase_invoice";
    }
  }

  if (role === "sale") {
    if (kind === "credit_note") {
      return "sale_credit_note";
    }

    if (kind === "payment_support" || kind === "receipt") {
      return "sale_receipt";
    }

    if (kind === "invoice") {
      return "sale_invoice";
    }
  }

  return fallbackCandidate?.trim() || "other_document";
}

function isStrongMatch(match: TransactionFamilyMatch) {
  return match.status === "matched";
}

function isTentativeMatch(match: TransactionFamilyMatch) {
  return match.status === "tentative";
}

function describeMatch(side: "issuer" | "receiver", match: TransactionFamilyMatch) {
  if (match.status === "matched" && match.strategy === "tax_id") {
    return `El ${side} coincide por RUT normalizado con la organizacion.`;
  }

  if (match.status === "matched") {
    return `El ${side} coincide por alias fuerte con la organizacion.`;
  }

  if (match.status === "tentative") {
    return `El ${side} coincide tentativamente por alias/nombre con la organizacion.`;
  }

  if (match.status === "ambiguous") {
    return `El ${side} tiene coincidencias ambiguas con la identidad de la organizacion.`;
  }

  return `El ${side} no coincide con la organizacion.`;
}

export function resolveTransactionFamilyByOrganizationIdentity(input: {
  issuerMatch: TransactionFamilyMatch;
  receiverMatch: TransactionFamilyMatch;
  modelRoleCandidate: DocumentRoleCandidate;
  modelSubtypeCandidate: string | null | undefined;
}) {
  const subtypeKind = normalizeSubtypeKind(input.modelSubtypeCandidate);
  const evidence = [
    describeMatch("issuer", input.issuerMatch),
    describeMatch("receiver", input.receiverMatch),
  ];
  const warnings: string[] = [];

  if (isStrongMatch(input.issuerMatch) && isStrongMatch(input.receiverMatch)) {
    warnings.push(
      "Emisor y receptor coinciden con la organizacion; la familia transaccional requiere revision.",
    );

    return {
      documentRole: "other",
      documentSubtype: mapSubtypeForRole("other", subtypeKind, input.modelSubtypeCandidate),
      source: "ambiguous_identity",
      confidence: Math.max(input.issuerMatch.confidence, input.receiverMatch.confidence),
      shouldReview: true,
      warnings,
      evidence,
    } satisfies TransactionFamilyResolution;
  }

  if (isStrongMatch(input.issuerMatch)) {
    return {
      documentRole: "sale",
      documentSubtype: mapSubtypeForRole("sale", subtypeKind, input.modelSubtypeCandidate),
      source: input.issuerMatch.strategy === "tax_id"
        ? "deterministic_tax_id"
        : "deterministic_alias",
      confidence: input.issuerMatch.confidence,
      shouldReview: false,
      warnings,
      evidence,
    } satisfies TransactionFamilyResolution;
  }

  if (isStrongMatch(input.receiverMatch)) {
    return {
      documentRole: "purchase",
      documentSubtype: mapSubtypeForRole("purchase", subtypeKind, input.modelSubtypeCandidate),
      source: input.receiverMatch.strategy === "tax_id"
        ? "deterministic_tax_id"
        : "deterministic_alias",
      confidence: input.receiverMatch.confidence,
      shouldReview: false,
      warnings,
      evidence,
    } satisfies TransactionFamilyResolution;
  }

  if (input.issuerMatch.status === "ambiguous" || input.receiverMatch.status === "ambiguous") {
    warnings.push(
      "La identidad de organizacion quedo ambigua y fuerza revision manual de compra/venta.",
    );

    return {
      documentRole: "other",
      documentSubtype: mapSubtypeForRole("other", subtypeKind, input.modelSubtypeCandidate),
      source: "ambiguous_identity",
      confidence: Math.max(input.issuerMatch.confidence, input.receiverMatch.confidence),
      shouldReview: true,
      warnings,
      evidence,
    } satisfies TransactionFamilyResolution;
  }

  if (isTentativeMatch(input.issuerMatch) && !isTentativeMatch(input.receiverMatch)) {
    warnings.push(
      "La venta se resolvio tentativamente por alias fuerte y conviene validarla en revision.",
    );

    return {
      documentRole: "sale",
      documentSubtype: mapSubtypeForRole("sale", subtypeKind, input.modelSubtypeCandidate),
      source: "deterministic_alias",
      confidence: input.issuerMatch.confidence,
      shouldReview: true,
      warnings,
      evidence,
    } satisfies TransactionFamilyResolution;
  }

  if (isTentativeMatch(input.receiverMatch) && !isTentativeMatch(input.issuerMatch)) {
    warnings.push(
      "La compra se resolvio tentativamente por alias fuerte y conviene validarla en revision.",
    );

    return {
      documentRole: "purchase",
      documentSubtype: mapSubtypeForRole("purchase", subtypeKind, input.modelSubtypeCandidate),
      source: "deterministic_alias",
      confidence: input.receiverMatch.confidence,
      shouldReview: true,
      warnings,
      evidence,
    } satisfies TransactionFamilyResolution;
  }

  warnings.push(
    input.modelRoleCandidate === "purchase" || input.modelRoleCandidate === "sale"
      ? "La identidad de organizacion no alcanzo para resolver compra/venta; se usa el candidato del modelo."
      : "La identidad de organizacion no resolvio una familia transaccional confiable.",
  );

  return {
    documentRole: input.modelRoleCandidate,
    documentSubtype: mapSubtypeForRole(
      input.modelRoleCandidate,
      subtypeKind,
      input.modelSubtypeCandidate,
    ),
    source: "model_fallback",
    confidence: Math.max(input.issuerMatch.confidence, input.receiverMatch.confidence, 0.55),
    shouldReview:
      input.modelRoleCandidate === "other"
      || (input.issuerMatch.status === "not_matched" && input.receiverMatch.status === "not_matched"),
    warnings: dedupeStrings(warnings),
    evidence,
  } satisfies TransactionFamilyResolution;
}
