import {
  findUyLocationByCity,
  inferUyCityFromText,
  inferUyDepartmentFromText,
  normalizeUyDepartment,
} from "@/modules/accounting/uy-location-registry";

function normalizeToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export function extractIssuerBranchCode(value: string | null | undefined) {
  const source = value ?? "";
  const match = source.match(/\b(?:sucursal|local|branch|tienda)\s*[:#-]?\s*([a-z0-9-]{1,12})/i);
  return match?.[1]?.trim() ?? null;
}

export function parseUyIssuerLocation(input: {
  issuerAddressRaw: string | null;
  issuerDepartment: string | null;
  issuerCity: string | null;
  issuerBranchCode: string | null;
  locationExtractionConfidence: number | null;
}) {
  const normalizedDepartment =
    normalizeUyDepartment(input.issuerDepartment)
    ?? inferUyDepartmentFromText(input.issuerAddressRaw);
  const exactCity = findUyLocationByCity({
    city: input.issuerCity,
    department: normalizedDepartment,
  });
  const inferredCity =
    exactCity
    ?? inferUyCityFromText({
      text: input.issuerAddressRaw ?? input.issuerCity,
      department: normalizedDepartment,
    });
  const branchCode =
    normalizeToken(input.issuerBranchCode)
    ?? extractIssuerBranchCode(input.issuerAddressRaw);
  const confidence =
    typeof input.locationExtractionConfidence === "number"
      ? input.locationExtractionConfidence
      : exactCity || normalizedDepartment || branchCode
        ? 0.7
        : 0;

  return {
    issuerAddressRaw: normalizeToken(input.issuerAddressRaw),
    issuerDepartment: normalizedDepartment,
    issuerCity: exactCity?.city ?? inferredCity?.city ?? normalizeToken(input.issuerCity),
    issuerBranchCode: branchCode,
    locationExtractionConfidence: Math.max(0, Math.min(1, confidence)),
  };
}
