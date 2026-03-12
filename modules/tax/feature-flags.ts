type UyVatFeatureFlags = {
  mvpEnabled: boolean;
  exportAutoDisabled: boolean;
  mixedUseManualReview: boolean;
  simplifiedRegimeAutoDisabled: boolean;
};

function parseBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function getUyVatFeatureFlags(): UyVatFeatureFlags {
  return {
    mvpEnabled: parseBooleanFlag(process.env.VAT_UY_MVP_ENABLED, true),
    exportAutoDisabled: parseBooleanFlag(process.env.VAT_UY_EXPORT_AUTO_DISABLED, true),
    mixedUseManualReview: parseBooleanFlag(process.env.VAT_UY_MIXED_USE_MANUAL_REVIEW, true),
    simplifiedRegimeAutoDisabled: parseBooleanFlag(
      process.env.VAT_UY_SIMPLIFIED_REGIME_AUTO_DISABLED,
      true,
    ),
  };
}

export type { UyVatFeatureFlags };
