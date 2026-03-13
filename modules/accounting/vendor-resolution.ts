import type {
  AccountingVendorRecord,
  VendorResolutionResult,
} from "@/modules/accounting/types";
import {
  normalizeTaxId,
  normalizeTextToken,
} from "@/modules/accounting/normalization";

function dedupeVendors(vendors: AccountingVendorRecord[]) {
  const seen = new Set<string>();

  return vendors.filter((vendor) => {
    if (seen.has(vendor.id)) {
      return false;
    }

    seen.add(vendor.id);
    return true;
  });
}

function buildResult(input: {
  status: VendorResolutionResult["status"];
  matchStrategy: VendorResolutionResult["matchStrategy"];
  issuerTaxId: string | null;
  issuerName: string | null;
  matches: AccountingVendorRecord[];
  blockingReasons: string[];
}) {
  const [firstMatch] = input.matches;

  return {
    status: input.status,
    matchStrategy: input.matchStrategy,
    vendorId: input.status === "matched" ? firstMatch.id : null,
    vendorName: input.status === "matched" ? firstMatch.name : null,
    normalizedTaxId: input.issuerTaxId,
    normalizedName: input.issuerName,
    defaultAccountId: input.status === "matched" ? firstMatch.default_account_id : null,
    defaultPaymentAccountId:
      input.status === "matched" ? firstMatch.default_payment_account_id : null,
    defaultTaxProfile: input.status === "matched" ? firstMatch.default_tax_profile : null,
    defaultOperationCategory:
      input.status === "matched" ? firstMatch.default_operation_category : null,
    candidates: input.matches.map((vendor) => ({
      vendorId: vendor.id,
      vendorName: vendor.name,
      matchStrategy: input.matchStrategy,
    })),
    blockingReasons: input.blockingReasons,
  } satisfies VendorResolutionResult;
}

export function resolveVendorFromFacts(input: {
  facts: {
    issuer_tax_id: string | null;
    issuer_name: string | null;
  };
  vendors: AccountingVendorRecord[];
}) {
  const issuerTaxId = normalizeTaxId(input.facts.issuer_tax_id);
  const issuerName = normalizeTextToken(input.facts.issuer_name);

  if (issuerTaxId) {
    const matches = dedupeVendors(
      input.vendors.filter((vendor) => vendor.tax_id_normalized === issuerTaxId),
    );

    if (matches.length === 1) {
      return buildResult({
        status: "matched",
        matchStrategy: "tax_id",
        issuerTaxId,
        issuerName,
        matches,
        blockingReasons: [],
      });
    }

    if (matches.length > 1) {
      return buildResult({
        status: "ambiguous",
        matchStrategy: "ambiguous",
        issuerTaxId,
        issuerName,
        matches,
        blockingReasons: ["Hay multiples proveedores con el mismo tax_id normalizado."],
      });
    }
  }

  if (issuerName) {
    const aliasMatches = dedupeVendors(
      input.vendors.filter((vendor) =>
        vendor.aliases.some((alias) => alias.alias_normalized === issuerName)),
    );

    if (aliasMatches.length === 1) {
      return buildResult({
        status: "matched",
        matchStrategy: "alias",
        issuerTaxId,
        issuerName,
        matches: aliasMatches,
        blockingReasons: [],
      });
    }

    if (aliasMatches.length > 1) {
      return buildResult({
        status: "ambiguous",
        matchStrategy: "ambiguous",
        issuerTaxId,
        issuerName,
        matches: aliasMatches,
        blockingReasons: ["El alias del emisor coincide con multiples proveedores."],
      });
    }

    const nameMatches = dedupeVendors(
      input.vendors.filter((vendor) => vendor.name_normalized === issuerName),
    );

    if (nameMatches.length === 1) {
      return buildResult({
        status: "matched",
        matchStrategy: "name",
        issuerTaxId,
        issuerName,
        matches: nameMatches,
        blockingReasons: [],
      });
    }

    if (nameMatches.length > 1) {
      return buildResult({
        status: "ambiguous",
        matchStrategy: "ambiguous",
        issuerTaxId,
        issuerName,
        matches: nameMatches,
        blockingReasons: ["El nombre del emisor coincide con multiples proveedores."],
      });
    }
  }

  return buildResult({
    status: "unresolved",
    matchStrategy: "none",
    issuerTaxId,
    issuerName,
    matches: [],
    blockingReasons: [],
  });
}
