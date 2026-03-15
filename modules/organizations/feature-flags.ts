type OnboardingFeatureFlags = {
  onboardingActivityBasedPresetsEnabled: boolean;
  uiHelpHintsEnabled: boolean;
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

export function getOrganizationFeatureFlags(): OnboardingFeatureFlags {
  return {
    onboardingActivityBasedPresetsEnabled: parseBooleanFlag(
      process.env.ONBOARDING_ACTIVITY_BASED_PRESETS_ENABLED,
      true,
    ),
    uiHelpHintsEnabled: parseBooleanFlag(
      process.env.UI_HELP_HINTS_ENABLED,
      true,
    ),
  };
}

export type { OnboardingFeatureFlags };
