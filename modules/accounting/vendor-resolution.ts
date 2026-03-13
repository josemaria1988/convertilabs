import type {
  AccountingVendorRecord,
  DocumentIntakeFactMap,
  VendorResolutionResult,
} from "@/modules/accounting/types";
import {
  normalizeTaxId,
  normalizeTextToken,
} from "@/modules/accounting/normalization";

export function resolveVendorFromFacts(input: {
  facts: DocumentIntakeFactMap;
  vendors: AccountingVendorRecord[];
}) {
  const issuerTaxId = normalizeTaxId(input.facts.issuer_tax_id);
  const issuerName = normalizeTextToken(input.facts.issuer_name);

  if (issuerTaxId) {
    const matches = input.vendors.filter((vendor) => vendor.tax_id_normalized === issuerTaxId);

    if (matches.length === 1) {
      return {
        status: "matched",
        matchStrategy: "tax_id",
        vendorId: matches[0].id,
        vendorName: matches[0].name,
        normalizedTaxId: issuerTaxId,
        normalizedName: issuerName,
        blockingReasons: [],
      } satisfies VendorResolutionResult;
    }

    if (matches.length > 1) {
      return {
        status: "ambiguous",
        matchStrategy: "ambiguous",
        vendorId: null,
        vendorName: null,
        normalizedTaxId: issuerTaxId,
        normalizedName: issuerName,
        blockingReasons: ["Hay multiples proveedores con el mismo tax_id normalizado."],
      } satisfies VendorResolutionResult;
    }
  }

  if (issuerName) {
    const matches = input.vendors.filter((vendor) => vendor.name_normalized === issuerName);

    if (matches.length === 1) {
      return {
        status: "matched",
        matchStrategy: "name",
        vendorId: matches[0].id,
        vendorName: matches[0].name,
        normalizedTaxId: issuerTaxId,
        normalizedName: issuerName,
        blockingReasons: [],
      } satisfies VendorResolutionResult;
    }

    if (matches.length > 1) {
      return {
        status: "ambiguous",
        matchStrategy: "ambiguous",
        vendorId: null,
        vendorName: null,
        normalizedTaxId: issuerTaxId,
        normalizedName: issuerName,
        blockingReasons: ["El nombre del emisor coincide con multiples proveedores."],
      } satisfies VendorResolutionResult;
    }
  }

  return {
    status: "unresolved",
    matchStrategy: "none",
    vendorId: null,
    vendorName: null,
    normalizedTaxId: issuerTaxId,
    normalizedName: issuerName,
    blockingReasons: [],
  } satisfies VendorResolutionResult;
}
