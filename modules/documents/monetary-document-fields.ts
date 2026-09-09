import type { DocumentIntakeFactMap } from "@/modules/ai/document-intake-contract";
import type { DocumentMonetarySnapshot } from "@/modules/accounting/types";

function finiteAmount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Persist document evidence, without turning calculation defaults into confirmed amounts. */
export function buildDocumentMonetaryFields(input: {
  facts: Pick<DocumentIntakeFactMap, "currency_code" | "subtotal" | "tax_amount" | "total_amount">;
  monetarySnapshot: DocumentMonetarySnapshot | null;
}) {
  const candidateCurrency = input.facts.currency_code?.trim().toUpperCase();
  const currencyCode = candidateCurrency && /^[A-Z]{3}$/.test(candidateCurrency) ? candidateCurrency : null;
  const snapshot = input.monetarySnapshot;
  const snapshotMatchesCurrency = currencyCode !== null && snapshot?.currencyCode === currencyCode;
  const originalAmount = (fact: number | null, derived: number | undefined) => {
    const knownAmount = finiteAmount(fact);
    return knownAmount === null ? null : snapshotMatchesCurrency ? finiteAmount(derived) ?? knownAmount : knownAmount;
  };
  const netOriginal = originalAmount(input.facts.subtotal, snapshot?.netAmountOriginal);
  const taxOriginal = originalAmount(input.facts.tax_amount, snapshot?.taxAmountOriginal);
  const totalOriginal = originalAmount(input.facts.total_amount, snapshot?.totalAmountOriginal);
  const hasUyuConversion = snapshotMatchesCurrency
    && snapshot?.fx.functionalCurrencyCode === "UYU"
    && snapshot.fx.blockingReasons.length === 0
    && typeof snapshot.fx.rate === "number" && Number.isFinite(snapshot.fx.rate) && snapshot.fx.rate > 0;
  const uyuAmount = (original: number | null, derived: number | undefined) => {
    if (original === null || currencyCode === null) return null;
    if (currencyCode === "UYU") return original;
    return hasUyuConversion ? finiteAmount(derived) : null;
  };

  return {
    document_currency_code: currencyCode,
    document_net_amount_original: netOriginal,
    document_tax_amount_original: taxOriginal,
    document_total_amount_original: totalOriginal,
    net_amount_uyu: uyuAmount(netOriginal, snapshot?.netAmountUyu),
    tax_amount_uyu: uyuAmount(taxOriginal, snapshot?.taxAmountUyu),
    total_amount_uyu: uyuAmount(totalOriginal, snapshot?.totalAmountUyu),
  };
}
