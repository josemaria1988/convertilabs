"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { LoadingLink } from "@/components/ui/loading-link";
import {
  formatAccountRoleCodeLabel,
  formatDecisionSourceLabel,
  formatPostingModeLabel,
  formatPostingTemplateCodeLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";
import { formatCanonicalWorkflowStateLabel } from "@/modules/presentation/product-language";
import {
  formatDocumentOperationalStatusLabel,
  getDocumentOperationalStatusVariant,
} from "@/modules/documents/status";
import type {
  DocumentOriginalPageData,
  DocumentReviewPageData,
  DocumentWorkspaceListItem,
} from "@/modules/documents/review";

type ReviewAction = () => Promise<{ ok: boolean; message: string }>;
type ResolveSuggestionAction = (input: {
  suggestionId: string;
  resolutionStatus: "accepted" | "rejected" | "edited";
  execute?: boolean;
  resolutionComment?: string | null;
}) => Promise<{ ok: boolean; message: string }>;

type SelectedDocumentTrayData =
  | { kind: "review"; pageData: DocumentReviewPageData }
  | { kind: "original"; pageData: DocumentOriginalPageData }
  | null;

type Props = {
  slug: string;
  documents: DocumentWorkspaceListItem[];
  selectedDocumentId: string | null;
  selectedDocument: SelectedDocumentTrayData;
  confirmFinalDocumentAction?: ReviewAction;
  runClassificationAction?: ReviewAction;
  resolveAssistantSuggestionAction?: ResolveSuggestionAction;
};

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
  }).format(parsed);
}

function formatMoney(value: number | null | undefined, currency = "UYU") {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatConfidence(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : "Sin score";
}

function stripMarkdown(value: string | null | undefined) {
  return value
    ? value.replace(/[`*_>#-]/g, " ").replace(/\s+/g, " ").trim()
    : null;
}

function buildTrayHref(slug: string, documentId: string) {
  return `/app/o/${slug}/documents?documentId=${documentId}`;
}

const trayRowGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1.15fr) 96px 100px 102px 142px 120px",
  gap: "12px",
  alignItems: "center",
  width: "100%",
} as const;

function buildDocumentReference(input: {
  documentNumber: string | null | undefined;
  documentSeries: string | null | undefined;
  fallback: string | null | undefined;
}) {
  const number = input.documentNumber?.trim();
  const series = input.documentSeries?.trim();

  if (series && number) {
    return `${series} ${number}`;
  }

  if (number) {
    return number;
  }

  if (series) {
    return series;
  }

  return input.fallback ?? "Sin referencia";
}

export function DocumentOperationalTray({
  slug,
  documents,
  selectedDocumentId,
  selectedDocument,
  confirmFinalDocumentAction,
  runClassificationAction,
  resolveAssistantSuggestionAction,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"assistant" | "classification" | "confirm" | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedWorkspaceDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId],
  );
  const selectedReview = selectedDocument?.kind === "review" ? selectedDocument.pageData : null;
  const selectedOriginal = selectedDocument?.kind === "original" ? selectedDocument.pageData : null;
  const summary = useMemo(() => ({
    actionable: documents.filter((document) => document.operationalBucket === "review").length,
    blocked: documents.filter((document) => document.operationalBucket === "blocked").length,
    ready: documents.filter((document) => document.operationalBucket === "ready_to_post").length,
    completed: documents.filter((document) => document.operationalBucket === "done").length,
  }), [documents]);
  const suggestions = selectedReview?.assistantRail?.suggestions.filter((item) => item.resolutionStatus === "pending") ?? [];
  const visibleAssignments = selectedReview?.accountRoleAssignments
    .filter((assignment) => assignment.accountLabel)
    .slice(0, 5)
    ?? [];
  const prioritySuggestion = suggestions.find((item) =>
    item.actionKind === "run_classification" || item.actionKind === "post_provisional") ?? suggestions[0] ?? null;
  const primaryAction =
    prioritySuggestion && resolveAssistantSuggestionAction
      ? "assistant"
      : selectedReview?.canRunClassification && runClassificationAction
        ? "classification"
        : selectedReview?.canConfirmFinal && confirmFinalDocumentAction
          ? "confirm"
          : null;
  const criteriaText =
    prioritySuggestion?.description
    ?? stripMarkdown(selectedReview?.assistantRail?.latestMessage?.structuredPayload.summaryMd)
    ?? stripMarkdown(selectedReview?.derived.assistantSuggestion.rationale)
    ?? stripMarkdown(selectedReview?.derived.journalSuggestion.explanation)
    ?? "Todavia no hay un criterio visible para este documento.";
  const selectedDocumentReference = selectedWorkspaceDocument
    ? buildDocumentReference({
      documentNumber: selectedWorkspaceDocument.documentNumber,
      documentSeries: selectedWorkspaceDocument.documentSeries,
      fallback: selectedWorkspaceDocument.documentType,
    })
    : "Sin referencia";

  async function handlePrimaryAction() {
    if (!primaryAction) return;
    setPendingAction(primaryAction);
    setMessage("");
    startTransition(async () => {
      try {
        const result = primaryAction === "assistant" && prioritySuggestion && resolveAssistantSuggestionAction
          ? await resolveAssistantSuggestionAction({
            suggestionId: prioritySuggestion.id,
            resolutionStatus: "accepted",
            execute:
              prioritySuggestion.actionKind === "run_classification"
              || prioritySuggestion.actionKind === "post_provisional",
          })
          : primaryAction === "classification" && runClassificationAction
            ? await runClassificationAction()
            : primaryAction === "confirm" && confirmFinalDocumentAction
              ? await confirmFinalDocumentAction()
              : { ok: false, message: "No encontramos una accion disponible para este documento." };

        setMessage(result.message);
        if (result.ok) router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No pudimos completar la accion.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  if (documents.length === 0) {
    return (
      <div className="document-tray-layout">
        <section className="ui-panel">
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">Bandeja Documental Operativa</h1>
          <p className="mt-2 text-[14px] text-[color:var(--color-muted)]">
            Cuando entren documentos veras aqui la factura, la foto si existe, el criterio IA y la sugerencia de cuentas sin salir de la bandeja.
          </p>
          <div className="mt-4 rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-5 py-10 text-sm text-[color:var(--color-muted)]">
            Aun no hay documentos cargados. Usa el ingreso directo o entra por Auditoria para un lote masivo.
          </div>
        </section>
        <aside className="ui-panel">
          <h2 className="text-[15px] font-semibold text-white">Estado de bandeja</h2>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--color-muted)]">
            <div className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">Sin pendientes operativos</div>
            <div className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">Sin bloqueos visibles</div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="document-tray-layout">
      <section className="space-y-3">
        <section className="ui-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">Bandeja Documental Operativa</h1>
              <p className="mt-2 text-[14px] text-[color:var(--color-muted)]">
                La revision vive aqui: seleccionas un documento, ves la factura, entiendes el criterio de IA y decides si confirmarlo o abrir la sugerencia completa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingLink href={`/app/o/${slug}/audit`} pendingLabel="Abriendo..." className="ui-button ui-button--secondary">Ingreso masivo</LoadingLink>
              <LoadingLink href="#document-upload-panel" pendingLabel="Abriendo..." className="ui-button ui-button--primary">Agregar documentos</LoadingLink>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Por revisar", summary.actionable, "Factual y asignacion en una sola bandeja."],
              ["Bloqueados", summary.blocked, "Duplicados, FX y alcance fuera del perimetro."],
              ["Listos", summary.ready, "Casos resueltos para avanzar de etapa."],
              ["Confirmados", summary.completed, "Documentos cerrados con trazabilidad."],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">{label}</p>
                <p className="mt-2 text-[28px] font-semibold tracking-[-0.06em] text-white">{value}</p>
                <p className="mt-2 text-[12px] leading-5 text-[color:var(--color-muted)]">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-panel">
          <div className="document-tray-table">
            <div className="document-tray-table__head" style={trayRowGridStyle}>
              <span>Documento</span>
              <span>Contraparte</span>
              <span>Confianza</span>
              <span>Monto</span>
              <span>Fecha</span>
              <span>Estado</span>
              <span>Accion</span>
            </div>
            <div className="document-tray-table__body">
              {documents.map((document) => {
                const isCurrent = document.id === selectedWorkspaceDocument?.id;

                return (
                  <Fragment key={document.id}>
                    <Link
                      href={buildTrayHref(slug, document.id)}
                      className="document-tray-table__row"
                      style={trayRowGridStyle}
                      data-current={isCurrent ? "true" : undefined}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      <div className="document-tray-table__cell">
                        <p className="font-semibold text-white">{document.originalFilename}</p>
                        <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                          {buildDocumentReference({
                            documentNumber: document.documentNumber,
                            documentSeries: document.documentSeries,
                            fallback: document.documentType,
                          })}
                        </p>
                      </div>
                      <div className="document-tray-table__cell">
                        <p className="text-white">{document.counterpartyName ?? "Contraparte pendiente"}</p>
                        <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                          {document.decisionSource ? formatDecisionSourceLabel(document.decisionSource) : "Sin origen visible"}
                        </p>
                      </div>
                      <div className="document-tray-table__cell text-white">{formatConfidence(document.certaintyConfidence)}</div>
                      <div className="document-tray-table__cell text-white">{formatMoney(document.totalAmount)}</div>
                      <div className="document-tray-table__cell text-white">{formatDate(document.documentDate ?? document.createdAt)}</div>
                      <div className="document-tray-table__cell">
                        <span className={getDocumentOperationalStatusVariant(document.canonicalState)}>
                          {formatDocumentOperationalStatusLabel(document.canonicalState)}
                        </span>
                      </div>
                      <div className="document-tray-table__cell text-white">
                        {document.nextPrimaryActionLabel ?? "Abrir documento"}
                      </div>
                    </Link>

                    {isCurrent && selectedReview ? (
                      <div className="document-tray-table__expanded">
                        <div className="document-tray-expanded">
                          <section className="document-tray-expanded__card">
                            <div className="document-tray-expanded__header">
                              <div>
                                <p className="document-tray-expanded__eyebrow">Factura</p>
                                <h3 className="document-tray-expanded__title">{selectedDocumentReference}</h3>
                              </div>
                              <DocumentOriginalModalTrigger
                                previewUrl={selectedReview.document.previewUrl}
                                mimeType={selectedReview.document.mimeType}
                                originalFilename={selectedReview.document.originalFilename}
                                triggerLabel="Ver original"
                                triggerClassName="ui-button ui-button--secondary"
                                modalTitle={selectedReview.document.originalFilename}
                                modalDescription="Original cargado por la organizacion."
                              />
                            </div>
                            <div className="document-tray-expanded__preview">
                              <DocumentPreview
                                previewUrl={selectedReview.document.previewUrl}
                                mimeType={selectedReview.document.mimeType}
                                originalFilename={selectedReview.document.originalFilename}
                                variant="sheet"
                              />
                            </div>
                            <div className="document-tray-expanded__facts">
                              <div>
                                <span>Contraparte</span>
                                <strong>{selectedReview.derived.vendorResolution.vendorName ?? "Pendiente"}</strong>
                              </div>
                              <div>
                                <span>Fecha</span>
                                <strong>{formatDate(selectedReview.draft.facts.document_date ?? selectedReview.document.documentDate)}</strong>
                              </div>
                              <div>
                                <span>Moneda</span>
                                <strong>{selectedReview.draft.facts.currency_code ?? selectedReview.derived.journalSuggestion.currencyCode ?? "UYU"}</strong>
                              </div>
                              <div>
                                <span>Total</span>
                                <strong>{formatMoney(selectedReview.draft.facts.total_amount, selectedReview.draft.facts.currency_code ?? selectedReview.derived.journalSuggestion.currencyCode ?? "UYU")}</strong>
                              </div>
                            </div>
                          </section>

                          <section className="document-tray-expanded__card">
                            <div className="document-tray-expanded__header">
                              <div>
                                <p className="document-tray-expanded__eyebrow">IA Criterio</p>
                                <h3 className="document-tray-expanded__title">{prioritySuggestion?.title ?? "Criterio IA"}</h3>
                              </div>
                              <span className={getDocumentOperationalStatusVariant(selectedWorkspaceDocument?.canonicalState ?? document.canonicalState)}>
                                {formatDocumentOperationalStatusLabel(selectedWorkspaceDocument?.canonicalState ?? document.canonicalState)}
                              </span>
                            </div>
                            <div className="document-tray-expanded__criteria">
                              <p>{criteriaText}</p>
                              <div className="document-tray-expanded__meta">
                                <span>{formatRuleScopeLabel(selectedReview.derived.appliedRule.scope)}</span>
                                <span>{formatCanonicalWorkflowStateLabel(selectedReview.workflowState.canonicalState)}</span>
                              </div>
                            </div>
                            <div className="document-tray-expanded__actions">
                              <button
                                type="button"
                                disabled={!primaryAction || isPending}
                                onClick={handlePrimaryAction}
                                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
                              >
                                {pendingAction && isPending ? <InlineSpinner /> : null}
                                Confirmar Criterio IA
                              </button>
                              <LoadingLink
                                href={selectedWorkspaceDocument?.processedHref ?? `/app/o/${slug}/documents/${selectedReview.document.id}`}
                                pendingLabel="Abriendo..."
                                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
                              >
                                Revisar Sugerencia
                              </LoadingLink>
                            </div>
                            {message ? (
                              <p className="mt-3 text-sm text-[color:var(--color-muted)]">{message}</p>
                            ) : null}
                          </section>

                          <section className="document-tray-expanded__card">
                            <div className="document-tray-expanded__header">
                              <div>
                                <p className="document-tray-expanded__eyebrow">DOI Sugerencia</p>
                                <h3 className="document-tray-expanded__title">Sugerencia de cuentas</h3>
                              </div>
                            </div>
                            <div className="document-tray-expanded__accounts">
                              {visibleAssignments.length > 0 ? visibleAssignments.map((assignment) => (
                                <div key={`${assignment.roleCode}-${assignment.accountId ?? "missing"}`} className="document-tray-expanded__account">
                                  <p className="document-tray-expanded__account-role">{formatAccountRoleCodeLabel(assignment.roleCode)}</p>
                                  <p className="document-tray-expanded__account-label">{assignment.accountLabel}</p>
                                  <p className="document-tray-expanded__account-meta">
                                    {assignment.provenance ?? (assignment.isProvisional ? "Cuenta provisoria" : "Asignacion vigente")}
                                  </p>
                                </div>
                              )) : selectedReview.derived.journalSuggestion.lines.slice(0, 3).map((line) => (
                                <div key={`line-${line.lineNumber}`} className="document-tray-expanded__account">
                                  <p className="document-tray-expanded__account-role">{(line.linePurpose ?? "linea").replace(/_/g, " ")}</p>
                                  <p className="document-tray-expanded__account-label">{line.accountCode} {line.accountName}</p>
                                  <p className="document-tray-expanded__account-meta">
                                    {line.debit ? `Debe ${formatMoney(line.debit)}` : `Haber ${formatMoney(line.credit)}`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      </div>
                    ) : null}

                    {isCurrent && selectedOriginal ? (
                      <div className="document-tray-table__expanded">
                        <div className="document-tray-expanded document-tray-expanded--original">
                          <section className="document-tray-expanded__card">
                            <div className="document-tray-expanded__header">
                              <div>
                                <p className="document-tray-expanded__eyebrow">Factura</p>
                                <h3 className="document-tray-expanded__title">{selectedDocumentReference}</h3>
                              </div>
                              <DocumentOriginalModalTrigger
                                previewUrl={selectedOriginal.document.previewUrl}
                                mimeType={selectedOriginal.document.mimeType}
                                originalFilename={selectedOriginal.document.originalFilename}
                                triggerLabel="Ver original"
                                triggerClassName="ui-button ui-button--secondary"
                                modalTitle={selectedOriginal.document.originalFilename}
                                modalDescription="Original cargado por la organizacion."
                              />
                            </div>
                            <div className="document-tray-expanded__preview">
                              <DocumentPreview
                                previewUrl={selectedOriginal.document.previewUrl}
                                mimeType={selectedOriginal.document.mimeType}
                                originalFilename={selectedOriginal.document.originalFilename}
                                variant="sheet"
                              />
                            </div>
                          </section>
                          <section className="document-tray-expanded__card">
                            <div className="document-tray-expanded__header">
                              <div>
                                <p className="document-tray-expanded__eyebrow">Estado del documento</p>
                                <h3 className="document-tray-expanded__title">Todavia no tiene draft persistido</h3>
                              </div>
                            </div>
                            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
                              Puedes revisar el original desde la bandeja, pero la sugerencia contable completa aun no esta disponible.
                            </p>
                            <div className="document-tray-expanded__actions">
                              <LoadingLink
                                href={`/app/o/${slug}/documents/${selectedOriginal.document.id}`}
                                pendingLabel="Abriendo..."
                                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm`}
                              >
                                Revisar Sugerencia
                              </LoadingLink>
                            </div>
                          </section>
                        </div>
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </section>
      </section>

      <aside className="space-y-3">
        <section className="ui-panel">
          <h2 className="text-[15px] font-semibold text-white">Estado de bandeja</h2>
          <div className="mt-4 space-y-3 text-sm">
            {[
              ["Accionables", summary.actionable],
              ["Bloqueados", summary.blocked],
              ["Listos", summary.ready],
              ["Confirmados", summary.completed],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <span className="text-[color:var(--color-muted)]">{label}</span>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="ui-panel">
          <h2 className="text-[15px] font-semibold text-white">Kernel contable</h2>
          {selectedReview ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <p className="font-semibold text-white">{formatPostingTemplateCodeLabel(selectedReview.derived.journalSuggestion.templateCode)}</p>
                <p className="mt-2 text-[color:var(--color-muted)]">{formatPostingModeLabel(selectedReview.derived.journalSuggestion.postingMode)}</p>
                <p className="mt-1 text-[color:var(--color-muted)]">Balance: {formatMoney(selectedReview.derived.journalSuggestion.totalDebit)} / {formatMoney(selectedReview.derived.journalSuggestion.totalCredit)}</p>
              </div>
              <div className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <p className="font-semibold text-white">Cuenta principal</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  {selectedReview.derived.appliedRule.accountCode && selectedReview.derived.appliedRule.accountName
                    ? `${selectedReview.derived.appliedRule.accountCode} ${selectedReview.derived.appliedRule.accountName}`
                    : "Sin cuenta principal visible"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
              La sugerencia contable completa aparece cuando el documento ya esta procesado.
            </div>
          )}
        </section>
        <section className="ui-panel">
          <h2 className="text-[15px] font-semibold text-white">IA Analisis de Documento</h2>
          {selectedReview ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <p className="font-semibold text-white">Resumen</p>
                <p className="mt-2 text-[color:var(--color-muted)]">{criteriaText}</p>
              </div>
              <div className="rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                <p className="font-semibold text-white">Senales visibles</p>
                <p className="mt-2 text-[color:var(--color-muted)]">Confianza: {formatConfidence(selectedReview.assistantRail?.latestMessage?.structuredPayload.confidence ?? selectedReview.certaintySummary.confidence)}</p>
                <p className="mt-1 text-[color:var(--color-muted)]">Actualizado: {formatDate(selectedReview.assistantRail?.thread?.lastMessageAt ?? selectedReview.processingRun?.created_at ?? null, true)}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
              El analisis de IA aparece cuando existe un draft revisable para el documento.
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
