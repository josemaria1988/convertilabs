type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isMissingVatRunImportColumnError(
  error: SupabaseErrorLike | null | undefined,
) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(hasText).join(" ");

  return /vat_runs/i.test(text)
    && /import_vat(_advance)?/i.test(text)
    && /(does not exist|schema cache|could not find)/i.test(text);
}

export function omitVatRunImportColumns<T extends Record<string, unknown>>(
  payload: T,
): Omit<T, "import_vat" | "import_vat_advance"> {
  const clone = { ...payload } as Record<string, unknown>;

  delete clone.import_vat;
  delete clone.import_vat_advance;

  return clone as Omit<T, "import_vat" | "import_vat_advance">;
}
