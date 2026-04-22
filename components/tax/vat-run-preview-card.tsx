import type { VatRunPreview } from "@/modules/tax/vat-run-preview";

type VatRunPreviewCardProps = {
  preview: VatRunPreview;
  organizationSlug?: string | null;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(normalized));
}

function formatDocumentTitle(document: {
  documentId: string;
  display: {
    documentNumber: string | null;
    counterpartyName: string | null;
    documentType: string | null;
  };
}) {
  const number = document.display.documentNumber ?? document.documentId.slice(0, 8);
  const counterparty = document.display.counterpartyName ?? "Sin contraparte";
  const type = document.display.documentType ? `${document.display.documentType} ` : "";

  return `${type}${number} / ${counterparty}`;
}

function buildDocumentHref(organizationSlug: string | null | undefined, documentId: string) {
  return organizationSlug ? `/app/o/${organizationSlug}/documents/${documentId}` : null;
}

function buildJournalHref(
  organizationSlug: string | null | undefined,
  period: string,
  journalEntryId: string | null,
) {
  return organizationSlug && journalEntryId
    ? `/app/o/${organizationSlug}/journal-entries?period=${period}&entry=${journalEntryId}`
    : null;
}

export function VatRunPreviewCard({ preview, organizationSlug }: VatRunPreviewCardProps) {
  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">VAT Preview</h2>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
            Simulacion no definitiva para {preview.period}.
          </p>
        </div>
        <span className="ui-filter">No definitiva</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[13px] text-[color:var(--color-muted)]">Debito</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatAmount(preview.totals.outputVat)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[13px] text-[color:var(--color-muted)]">Credito</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatAmount(preview.totals.inputVatCreditable)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[13px] text-[color:var(--color-muted)]">No deducible</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatAmount(preview.totals.inputVatNonDeductible)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[13px] text-[color:var(--color-muted)]">Neto</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatAmount(preview.totals.netVatPayable)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-white">Incluidos</p>
          <div className="mt-2 space-y-2">
            {preview.includedDocuments.length > 0 ? preview.includedDocuments.slice(0, 8).map((document) => {
              const documentHref = buildDocumentHref(organizationSlug, document.documentId);
              const journalHref = buildJournalHref(organizationSlug, preview.period, document.journalEntryId);

              return (
              <div key={document.documentId} className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{formatDocumentTitle(document)}</p>
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      {formatDate(document.documentDate)} / {document.role} / IVA {formatAmount(document.taxAmount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {documentHref ? (
                      <a href={documentHref} className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]">
                        Ver comprobante
                      </a>
                    ) : null}
                    {journalHref ? (
                      <a href={journalHref} className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]">
                        Ver asiento {document.journalEntryNumber ? `#${document.journalEntryNumber}` : ""}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
              );
            }) : (
              <div className="text-sm text-[color:var(--color-muted)]">No hay documentos incluidos.</div>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Excluidos</p>
          <div className="mt-2 space-y-2">
            {preview.excludedDocuments.length > 0 ? preview.excludedDocuments.slice(0, 8).map((document) => {
              const documentHref = buildDocumentHref(organizationSlug, document.documentId);
              const journalHref = buildJournalHref(organizationSlug, preview.period, document.journalEntryId);

              return (
              <div key={document.documentId} className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{formatDocumentTitle(document)}</p>
                    <p className="mt-1 text-[color:var(--color-muted)]">{document.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {documentHref ? (
                      <a href={documentHref} className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]">
                        Ver comprobante
                      </a>
                    ) : null}
                    {journalHref ? (
                      <a href={journalHref} className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]">
                        Ver asiento {document.journalEntryNumber ? `#${document.journalEntryNumber}` : ""}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
              );
            }) : (
              <div className="text-sm text-[color:var(--color-muted)]">No hay exclusiones para el periodo.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm text-[color:var(--color-muted)]">
        Diferencia contra corrida oficial: debito {formatAmount(preview.officialRunComparison.deltaOutputVat)} / credito {formatAmount(preview.officialRunComparison.deltaInputVatCreditable)} / neto {formatAmount(preview.officialRunComparison.deltaNetVatPayable)}.
      </div>

      {preview.warnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {preview.warnings.join(" ")}
        </div>
      ) : null}
    </section>
  );
}
