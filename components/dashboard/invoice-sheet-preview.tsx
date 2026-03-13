import { DocumentPreview } from "@/components/documents/document-preview";

type InvoiceSheetPreviewProps = {
  title?: string;
  counterpartyName?: string | null;
  documentType?: string | null;
  documentDate?: string | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  previewUrl?: string | null;
  mimeType?: string | null;
};

const moneyFormatter = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "0,00";
  }

  return moneyFormatter.format(value);
}

function getInvoiceCode(title: string | undefined) {
  if (!title) {
    return "1534";
  }

  const match = title.match(/(\d{3,6})/);
  return match?.[1] ?? "1534";
}

export function InvoiceSheetPreview({
  title,
  counterpartyName,
  documentType,
  documentDate,
  taxAmount,
  totalAmount,
  previewUrl,
  mimeType,
}: InvoiceSheetPreviewProps) {
  return (
    <div className="ui-invoice-sheet ui-invoice-sheet--preview">
      <div className="border-b border-[color:var(--paper-line)] pb-3">
        <p className="text-[12px] uppercase tracking-[0.18em] text-[#7b7f88]">
          Documento fiscal
        </p>
        <h3 className="mt-3 text-[29px] font-semibold tracking-[-0.04em] text-[#161a21]">
          Factura N&deg; {getInvoiceCode(title)}
        </h3>
        <p className="mt-2 text-[13px] text-[#60646d]">
          {counterpartyName ?? "Proveedor identificado"}
        </p>
      </div>

      <div className="ui-invoice-sheet__preview-frame mt-4">
        <DocumentPreview
          previewUrl={previewUrl ?? null}
          mimeType={mimeType ?? null}
          originalFilename={title ?? "Documento fiscal"}
          variant="sheet"
        />
      </div>

      <div className="mt-4 space-y-0.5">
        <div className="ui-invoice-sheet__row">
          <span>Tipo</span>
          <span>{documentType ?? "Factura electronica"}</span>
        </div>
        <div className="ui-invoice-sheet__row">
          <span>Fecha</span>
          <span>{documentDate ?? "11/2023"}</span>
        </div>
        <div className="ui-invoice-sheet__row">
          <span>Subtotal</span>
          <span>{formatAmount((totalAmount ?? 0) - (taxAmount ?? 0))}</span>
        </div>
        <div className="ui-invoice-sheet__row">
          <span>IVA</span>
          <span>{formatAmount(taxAmount)}</span>
        </div>
        <div className="ui-invoice-sheet__row">
          <span>Retenciones</span>
          <span>0,00</span>
        </div>
      </div>

      <div className="ui-invoice-sheet__total">
        <span>Total</span>
        <span>{formatAmount(totalAmount)}</span>
      </div>
    </div>
  );
}
