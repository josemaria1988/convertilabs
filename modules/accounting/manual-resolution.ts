export type ManualResolutionContextLike = {
  manualOverrideAccountId?: string | null;
  manualRoleOverrides?: Record<string, string | null | undefined> | null;
  manualOverrideConceptId?: string | null;
  manualOverrideOperationCategory?: string | null;
};

function hasNonEmptyString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasManualRoleOverride(
  manualRoleOverrides: ManualResolutionContextLike["manualRoleOverrides"],
) {
  return Object.values(manualRoleOverrides ?? {}).some((value) => hasNonEmptyString(value));
}

export function hasManualClassificationResolution(
  context: ManualResolutionContextLike | null | undefined,
) {
  if (!context) {
    return false;
  }

  return Boolean(
    hasNonEmptyString(context.manualOverrideAccountId)
    || hasManualRoleOverride(context.manualRoleOverrides)
    || hasNonEmptyString(context.manualOverrideConceptId)
    || hasNonEmptyString(context.manualOverrideOperationCategory),
  );
}
