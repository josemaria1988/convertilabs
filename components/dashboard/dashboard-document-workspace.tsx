"use client";

import { useState, type ReactNode } from "react";
import { InvoiceSheetPreview } from "@/components/dashboard/invoice-sheet-preview";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { LoadingLink } from "@/components/ui/loading-link";
import {
  formatDocumentStatusLabel,
  getDocumentRoleLabel,
  getDocumentRoleVariant,
  getDocumentStatusVariant,
} from "@/modules/documents/status";

type DashboardDocumentWorkspaceItem = {
  id: string;
  processedHref: string | null;
  originalFilename: string;
  mimeType: string | null;
  previewUrl: string | null;
  status: string;
  role: string;
  documentType: string | null;
  documentDate: string | null;
  counterpartyName: string | null;
  documentNumber: string | null;
  documentSeries: string | null;
  taxAmount: number | null;
  totalAmount: number | null;
};

type DashboardDocumentWorkspaceProps = {
  documents: DashboardDocumentWorkspaceItem[];
  organizationSlug: string;
  children: ReactNode;
};

const emptyDocument: DashboardDocumentWorkspaceItem = {
  id: "placeholder-1",
  originalFilename: "Sin documentos cargados",
  counterpartyName: "Bandeja vacia",
  documentType: "Documento fiscal",
  documentDate: "Pendiente",
  status: "queued",
  role: "other",
  processedHref: null,
  previewUrl: null,
  mimeType: null,
  documentNumber: null,
  documentSeries: null,
  taxAmount: null,
  totalAmount: null,
};

function formatAmount(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardDocumentWorkspace({
  documents,
  organizationSlug,
  children,
}: DashboardDocumentWorkspaceProps) {
  const documentRows = documents.length > 0 ? documents : [emptyDocument];
  const [selectedDocumentId, setSelectedDocumentId] = useState(documentRows[0]?.id ?? emptyDocument.id);

  const selectedDocument =
    documentRows.find((document) => document.id === selectedDocumentId)
    ?? documentRows[0]
    ?? emptyDocument;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="space-y-3">
        <div className="ui-panel overflow-hidden p-0">
          <div className="ui-panel-header border-b border-[color:var(--color-border)] px-4 py-3">
            <h2 className="text-[16px] font-semibold text-white">Documentos</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-filter">Escanear</span>
              <span className="ui-filter">Filtrar</span>
              <LoadingLink
                href={`/app/o/${organizationSlug}/documents#document-upload-panel`}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--primary"
              >
                Cargar Documentos
              </LoadingLink>
              <span className="ui-button ui-button--secondary">Importar</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[880px]">
              <thead>
                <tr>
                  <th className="w-8"> </th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Periodo</th>
                  <th>Asiento</th>
                  <th>Sugerencia</th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((document) => (
                  <tr
                    key={document.id}
                    data-selected={document.id === selectedDocument.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedDocumentId(document.id);
                    }}
                  >
                    <td>
                      <span
                        className={`block h-3 w-3 rounded-full border ${
                          document.id === selectedDocument.id
                            ? "border-[#5b84ce] bg-[#5b84ce]"
                            : "border-white/20 bg-white/10"
                        }`}
                      />
                    </td>
                    <td>
                      <div className="font-semibold text-white">
                        {document.counterpartyName ?? document.originalFilename}
                      </div>
                      <div className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        {document.originalFilename}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-[color:var(--color-muted)]">
                        {document.processedHref ? (
                          <LoadingLink
                            href={document.processedHref}
                            pendingLabel="Abriendo..."
                            className="text-white/80"
                          >
                            Abrir revision
                          </LoadingLink>
                        ) : (
                          <span>Draft pendiente</span>
                        )}
                        {document.previewUrl ? (
                          <DocumentOriginalModalTrigger
                            previewUrl={document.previewUrl}
                            mimeType={document.mimeType}
                            originalFilename={document.originalFilename}
                            triggerLabel="Ver original"
                            triggerClassName="text-[13px] text-[color:var(--color-accent-strong)]"
                            modalTitle={document.originalFilename}
                            modalDescription="Archivo original cargado al bucket privado."
                          />
                        ) : null}
                      </div>
                    </td>
                    <td>{document.documentType ?? "Documento fiscal"}</td>
                    <td>{document.documentDate ?? "Pendiente"}</td>
                    <td>
                      <span className={getDocumentRoleVariant(document.role)}>
                        {getDocumentRoleLabel(document.role)}
                      </span>
                    </td>
                    <td>
                      <span className={getDocumentStatusVariant(document.status)}>
                        {formatDocumentStatusLabel(document.status)}
                      </span>
                    </td>
                    <td className="text-right">{formatAmount(document.taxAmount)}</td>
                    <td className="text-right font-semibold text-white">
                      {formatAmount(document.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 pb-3">
            <div className="ui-table-pager">1</div>
          </div>
        </div>

        {children}
      </div>

      <div className="space-y-3">
        <InvoiceSheetPreview
          title={selectedDocument.originalFilename}
          counterpartyName={selectedDocument.counterpartyName}
          documentNumber={selectedDocument.documentNumber}
          documentSeries={selectedDocument.documentSeries}
          documentType={selectedDocument.documentType}
          documentDate={selectedDocument.documentDate}
          taxAmount={selectedDocument.taxAmount}
          totalAmount={selectedDocument.totalAmount}
          previewUrl={selectedDocument.previewUrl}
          mimeType={selectedDocument.mimeType}
        />

        {(selectedDocument.processedHref || selectedDocument.previewUrl) ? (
          <div className="flex flex-wrap gap-2">
            {selectedDocument.processedHref ? (
              <LoadingLink
                href={selectedDocument.processedHref}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary flex-1"
              >
                Abrir revision
              </LoadingLink>
            ) : null}
            {selectedDocument.previewUrl ? (
              <DocumentOriginalModalTrigger
                previewUrl={selectedDocument.previewUrl}
                mimeType={selectedDocument.mimeType}
                originalFilename={selectedDocument.originalFilename}
                triggerLabel="Ver original"
                triggerClassName="ui-button ui-button--primary flex-1"
                modalTitle={selectedDocument.originalFilename}
                modalDescription="Archivo original cargado al bucket privado."
              />
            ) : null}
          </div>
        ) : null}

        <div className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">
              Detalles del Documento
            </h2>
          </div>
          <div className="ui-info-list mt-4">
            <div className="ui-stat-row">
              <span>Estado actual</span>
              <span className="text-white">
                {documents.length > 0
                  ? formatDocumentStatusLabel(selectedDocument.status)
                  : "Sin archivo"}
              </span>
            </div>
            <div className="ui-stat-row">
              <span>Periodo activo</span>
              <span className="text-white">
                {selectedDocument.documentDate ?? "Pendiente"}
              </span>
            </div>
            <div className="ui-stat-row">
              <span>IVA detectado</span>
              <span className="text-white">{formatAmount(selectedDocument.taxAmount)}</span>
            </div>
            <div className="ui-stat-row">
              <span>Total estimado</span>
              <span className="text-white">{formatAmount(selectedDocument.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
