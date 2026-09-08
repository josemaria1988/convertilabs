"use client";

import type { DocumentProcessingProvider } from "@/modules/documents/processing-provider";

export function ProcessingProviderSelect({ value, onChange, disabled, allowPaidAPI = true }: {
  value: DocumentProcessingProvider;
  onChange: (value: DocumentProcessingProvider) => void;
  disabled?: boolean;
  allowPaidAPI?: boolean;
}) {
  return (
    <label className="my-4 grid gap-2 text-sm text-[color:var(--color-muted)]">
      <span className="font-medium text-white">Procesar factura con</span>
      <select className="field-input" value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value as DocumentProcessingProvider)}>
        <option value="codex_local">Codex en mi PC · cuenta ChatGPT</option>
        {allowPaidAPI ? <option value="openai">OpenAI API · facturación por uso</option> : null}
      </select>
      <span>{value === "codex_local"
        ? "Queda en espera hasta que una PC conectada la procese. Usa el cupo de ChatGPT y siempre requiere revisión."
        : "Usa la API paga configurada para Convertilabs. Siempre requiere revisión."}</span>
    </label>
  );
}
