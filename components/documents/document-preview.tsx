type DocumentPreviewProps = {
  previewUrl: string | null;
  mimeType: string | null;
  originalFilename: string;
  variant?: "inline" | "modal" | "sheet";
};

export function DocumentPreview({
  previewUrl,
  mimeType,
  originalFilename,
  variant = "inline",
}: DocumentPreviewProps) {
  const isModal = variant === "modal";
  const isSheet = variant === "sheet";
  const pdfSrc =
    (isModal || isSheet) && previewUrl
      ? `${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
      : previewUrl;

  if (!previewUrl) {
    return (
      <div
        className={`text-center text-sm text-[color:var(--color-muted)] ${
          isModal
            ? "flex h-full items-center justify-center rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white/55 px-6 py-10"
            : isSheet
              ? "flex h-full items-center justify-center bg-white px-5 py-8"
              : "rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white/55 px-6 py-16"
        }`}
      >
        No pudimos generar un preview firmado para este archivo.
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={pdfSrc ?? undefined}
        className={`w-full bg-white ${
          isModal
            ? "h-full rounded-3xl border border-[color:var(--color-border)]"
            : isSheet
              ? "h-full border-0"
              : "h-[420px] rounded-3xl border border-[color:var(--color-border)]"
        }`}
        title="Preview del documento"
      />
    );
  }

  return (
    <div
      className={`bg-white ${
        isModal
          ? "flex h-full items-center justify-center overflow-auto rounded-3xl border border-[color:var(--color-border)] p-4"
          : isSheet
            ? "flex h-full items-start justify-center overflow-auto"
            : "rounded-3xl border border-[color:var(--color-border)]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={originalFilename}
        className={`w-full object-contain ${
          isModal
            ? "h-full"
            : isSheet
              ? "min-h-full"
              : "max-h-[420px] rounded-3xl"
        }`}
      />
    </div>
  );
}
