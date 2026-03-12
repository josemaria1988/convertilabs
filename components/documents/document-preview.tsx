type DocumentPreviewProps = {
  previewUrl: string | null;
  mimeType: string | null;
  originalFilename: string;
  variant?: "inline" | "modal";
};

export function DocumentPreview({
  previewUrl,
  mimeType,
  originalFilename,
  variant = "inline",
}: DocumentPreviewProps) {
  const isModal = variant === "modal";
  const pdfSrc =
    isModal && previewUrl
      ? `${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
      : previewUrl;

  if (!previewUrl) {
    return (
      <div
        className={`rounded-3xl border border-dashed border-[color:var(--color-border)] bg-white/55 px-6 text-center text-sm text-[color:var(--color-muted)] ${
          isModal ? "flex h-full items-center justify-center py-10" : "py-16"
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
        className={`w-full rounded-3xl border border-[color:var(--color-border)] bg-white ${
          isModal ? "h-full" : "h-[620px]"
        }`}
        title="Preview del documento"
      />
    );
  }

  return (
    <div
      className={`rounded-3xl border border-[color:var(--color-border)] bg-white ${
        isModal ? "flex h-full items-center justify-center overflow-auto p-4" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={originalFilename}
        className={`w-full object-contain ${
          isModal ? "h-full" : "max-h-[620px] rounded-3xl"
        }`}
      />
    </div>
  );
}
