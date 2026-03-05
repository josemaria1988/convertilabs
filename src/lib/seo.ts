export const SITE_NAME = "ConvertiLab";
export const SITE_URL = "https://www.convertilabs.com";
export const DEFAULT_TITLE =
  "ConvertiLab: Global converters for inches, liters and cubic meters";
export const DEFAULT_DESCRIPTION =
  "Bilingual conversion tools in Spanish and English for inches to millimeters, liters to gallons, and cubic meters.";

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE_URL).toString();
}

export function buildTitle(title?: string): string {
  if (!title) {
    return DEFAULT_TITLE;
  }

  if (title.includes(SITE_NAME)) {
    return title;
  }

  return `${title} | ${SITE_NAME}`;
}
