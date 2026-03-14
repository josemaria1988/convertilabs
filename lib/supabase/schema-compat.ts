type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isMissingSupabaseRelationError(
  error: SupabaseErrorLike | null | undefined,
  relationName?: string,
) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(hasText).join(" ");

  const relationPattern = relationName
    ? new RegExp(`(?:public\\.)?${escapeRegExp(relationName)}`, "i")
    : /(table|relation)/i;

  return relationPattern.test(text)
    && /(could not find the table|relation .* does not exist|table .* does not exist|schema cache)/i.test(text);
}
