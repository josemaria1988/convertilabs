import { attachDocumentToImportOperationAction, createImportOperationAction, updateImportOperationStatusAction } from "@/app/app/o/[slug]/imports/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { getDocumentRoleLabel } from "@/modules/documents/status";
import type { ImportOperationListItem } from "@/modules/imports";
import { formatImportOperationStatusLabel } from "@/modules/presentation/labels";

type RecentDocumentItem = {
  id: string;
  original_filename: string;
  document_type: string | null;
  direction: string;
  created_at: string;
  current_draft_id: string | null;
};

type InternationalOperationsWorkspaceProps = {
  slug: string;
  importOperations: ImportOperationListItem[];
  recentDocuments: RecentDocumentItem[];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InternationalOperationsWorkspace({
  slug,
  importOperations,
  recentDocuments,
}: InternationalOperationsWorkspaceProps) {
  const approvedCount = importOperations.filter((operation) => operation.status === "approved").length;
  const reviewCount = importOperations.filter((operation) => operation.status !== "approved").length;
  const linkedDocumentsCount = importOperations.reduce(
    (sum, operation) => sum + operation.linkedDocuments.length,
    0,
  );
  const detectedTaxesCount = importOperations.reduce(
    (sum, operation) => sum + operation.taxLines.length,
    0,
  );

  return (
    <section className="space-y-4">
      <div className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[18px] font-semibold text-white">Operaciones internacionales</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              DUA, facturas del exterior y tributos asociados viven junto a Documentos porque forman parte del mismo evento economico revisable.
            </p>
          </div>
          <span className="status-pill status-pill--info">Carril documental</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Operaciones abiertas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{reviewCount}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Pendientes de revision o aprobacion.</p>
          </article>
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Operaciones aprobadas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{approvedCount}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Listas para impactos fiscales posteriores.</p>
          </article>
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Documentos vinculados</p>
            <p className="mt-2 text-2xl font-semibold text-white">{linkedDocumentsCount}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">DUA y comprobantes relacionados detectados.</p>
          </article>
          <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Tributos detectados</p>
            <p className="mt-2 text-2xl font-semibold text-white">{detectedTaxesCount}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">Lineas fiscales agregadas por operacion.</p>
          </article>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Nueva operacion internacional</h3>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Crea el contenedor operativo para agrupar DUA, factura comercial, flete, seguro y documentos locales vinculados.
                </p>
              </div>
              <span className="status-pill status-pill--info">Fase 1</span>
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                await createImportOperationAction({
                  slug,
                  formData,
                });
              }}
              className="mt-4 grid gap-3 md:grid-cols-2"
            >
              <input
                name="referenceCode"
                placeholder="Referencia interna"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="duaNumber"
                placeholder="Numero DUA"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="duaYear"
                placeholder="Ano DUA"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="customsBrokerName"
                placeholder="Despachante"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="supplierName"
                placeholder="Proveedor exterior"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="supplierTaxId"
                placeholder="Identificador fiscal proveedor"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                name="currencyCode"
                placeholder="Moneda"
                defaultValue="USD"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                type="date"
                name="operationDate"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px]"
              />
              <input
                type="date"
                name="paymentDate"
                className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-3 text-[14px] md:col-span-2"
              />
              <SubmitButton pendingLabel="Creando..." className="ui-button ui-button--primary md:col-span-2">
                Crear operacion
              </SubmitButton>
            </form>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h3 className="text-[16px] font-semibold text-white">Vincular documentos</h3>
              <span className="ui-filter">{recentDocuments.length} documento(s)</span>
            </div>

            <div className="mt-4 space-y-3">
              {recentDocuments.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Todavia no hay documentos recientes listos para vincular.
                </div>
              ) : importOperations.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">
                  Crea primero una operacion internacional para poder vincular documentos.
                </div>
              ) : (
                recentDocuments.map((document) => (
                  <form
                    key={document.id}
                    action={async (formData: FormData) => {
                      "use server";
                      await attachDocumentToImportOperationAction({
                        slug,
                        formData,
                      });
                    }}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4"
                  >
                    <input type="hidden" name="documentId" value={document.id} />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{document.original_filename}</p>
                        <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                          {document.document_type ?? "Documento sin tipo"} / {getDocumentRoleLabel(document.direction)}
                        </p>
                      </div>
                      <span className="text-[13px] text-[color:var(--color-muted)]">
                        {formatDateTime(document.created_at)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                      <select
                        name="importOperationId"
                        className="rounded-[10px] border border-[color:var(--color-border)] bg-white/80 px-3 py-3 text-[14px]"
                      >
                        {importOperations.map((operation) => (
                          <option key={operation.id} value={operation.id}>
                            {operation.referenceCode ?? operation.duaNumber ?? operation.id}
                          </option>
                        ))}
                      </select>
                      <SubmitButton pendingLabel="Vinculando..." className="ui-button ui-button--secondary">
                        Vincular
                      </SubmitButton>
                    </div>
                  </form>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h3 className="text-[16px] font-semibold text-white">Operaciones cargadas</h3>
            <span className="ui-filter">{importOperations.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {importOperations.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">
                Todavia no hay operaciones internacionales cargadas.
              </div>
            ) : (
              importOperations.map((operation) => (
                <div
                  key={operation.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">
                        {operation.referenceCode ?? operation.duaNumber ?? operation.id}
                      </p>
                      <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        {formatImportOperationStatusLabel(operation.status)} / {operation.currencyCode ?? "sin moneda"}
                      </p>
                      <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                        {operation.status === "ready_for_review"
                          ? "Importacion asistida: puede revisarse y preparar preview, pero no auto-finaliza."
                          : operation.status === "blocked_manual_review"
                            ? "Revision manual obligatoria antes de seguir."
                            : "Operacion internacional en construccion."}
                      </p>
                    </div>
                    <div className="text-right text-[13px] text-[color:var(--color-muted)]">
                      <p>{operation.duaNumber ? `DUA ${operation.duaNumber}` : "Sin DUA"}</p>
                      <p>{operation.supplierName ?? "Proveedor pendiente"}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-3 text-sm">
                      <p className="font-medium text-white">Documentos vinculados</p>
                      <p className="mt-2 text-[color:var(--color-muted)]">
                        {operation.linkedDocuments.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-3 text-sm">
                      <p className="font-medium text-white">Tributos detectados</p>
                      <p className="mt-2 text-[color:var(--color-muted)]">
                        {operation.taxLines.length}
                      </p>
                    </div>
                  </div>

                  {operation.warnings.length > 0 ? (
                    <p className="mt-3 text-[13px] text-amber-100">
                      {operation.warnings.join(" ")}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {operation.status !== "approved" ? (
                      <form
                        action={async () => {
                          "use server";
                          await updateImportOperationStatusAction({
                            slug,
                            importOperationId: operation.id,
                            status: "approved",
                          });
                        }}
                      >
                        <SubmitButton pendingLabel="Aprobando..." className="ui-button ui-button--primary">
                          Aprobar
                        </SubmitButton>
                      </form>
                    ) : null}
                    {operation.status !== "blocked_manual_review" ? (
                      <form
                        action={async () => {
                          "use server";
                          await updateImportOperationStatusAction({
                            slug,
                            importOperationId: operation.id,
                            status: "blocked_manual_review",
                          });
                        }}
                      >
                        <SubmitButton pendingLabel="Bloqueando..." className="ui-button ui-button--secondary">
                          Bloquear
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
