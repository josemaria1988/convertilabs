import { randomBytes } from "node:crypto";

const providerAliases: Record<string, string> = {
  zeta: "ZETA",
  zeta_software: "ZETA",
  "zeta-software": "ZETA",
  zetasoftware: "ZETA",
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function normalizeIntegrationProviderCode(provider: string) {
  const normalized = provider.trim().toLowerCase();
  const alias = providerAliases[normalized];

  if (alias) {
    return alias;
  }

  return normalized
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizeTestRunSuffix(value?: string | null) {
  const suffix = value?.trim()
    || randomBytes(4).toString("hex");

  return suffix
    .replace(/[^a-z0-9_-]+/gi, "")
    .slice(0, 32)
    .toUpperCase();
}

export function buildIntegrationTestRunKey(input: {
  provider: string;
  now?: Date;
  suffix?: string | null;
}) {
  const now = input.now ?? new Date();
  const yyyy = now.getUTCFullYear();
  const mm = pad2(now.getUTCMonth() + 1);
  const dd = pad2(now.getUTCDate());
  const hh = pad2(now.getUTCHours());
  const min = pad2(now.getUTCMinutes());

  return [
    "CVTLAB",
    normalizeIntegrationProviderCode(input.provider),
    "TST",
    `${yyyy}${mm}${dd}`,
    `${hh}${min}`,
    normalizeTestRunSuffix(input.suffix),
  ].join("-");
}

export function isValidIntegrationTestRunKey(
  value: string | null | undefined,
  provider?: string,
) {
  if (!value) {
    return false;
  }

  const providerCode = provider
    ? normalizeIntegrationProviderCode(provider)
    : "[A-Z0-9_]+";
  const pattern = new RegExp(
    `^CVTLAB-${providerCode}-TST-\\d{8}-\\d{4}-[A-Z0-9_-]{1,32}$`,
  );

  return pattern.test(value.trim());
}
