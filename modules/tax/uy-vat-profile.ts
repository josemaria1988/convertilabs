export const supportedVatRegimes = [
  "GENERAL",
  "IVA_MINIMO",
  "OTRO",
  "UNKNOWN",
] as const;

export const supportedDgiGroups = [
  "NO_CEDE",
  "CEDE",
  "GC",
  "UNKNOWN",
] as const;

export const supportedCfeStatuses = [
  "ELECTRONIC_ISSUER",
  "NON_ELECTRONIC",
  "UNKNOWN",
] as const;

export const supportedAutomaticVatLegalEntityTypes = [
  "SA",
  "SRL",
  "SAS",
] as const;

export type SupportedVatRegime = (typeof supportedVatRegimes)[number];
export type SupportedDgiGroup = (typeof supportedDgiGroups)[number];
export type SupportedCfeStatus = (typeof supportedCfeStatuses)[number];
export type SupportedAutomaticVatLegalEntityType =
  (typeof supportedAutomaticVatLegalEntityTypes)[number];

export function isSupportedVatRegime(value: string): value is SupportedVatRegime {
  return supportedVatRegimes.includes(value as SupportedVatRegime);
}

export function isSupportedDgiGroup(value: string): value is SupportedDgiGroup {
  return supportedDgiGroups.includes(value as SupportedDgiGroup);
}

export function isSupportedCfeStatus(value: string): value is SupportedCfeStatus {
  return supportedCfeStatuses.includes(value as SupportedCfeStatus);
}

export function isAutomaticUyVatLegalEntityType(
  value: string | null | undefined,
): value is SupportedAutomaticVatLegalEntityType {
  return supportedAutomaticVatLegalEntityTypes.includes(
    (value ?? "") as SupportedAutomaticVatLegalEntityType,
  );
}
