"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type StepCode = "identity" | "fields" | "amounts" | "operation_context";

type SaveDraftReviewAction = (input: {
  stepCode: StepCode;
  payload: {
    documentRole?: DocumentRoleCandidate;
    documentType?: string;
    operationCategory?: string | null;
    facts?: Partial<Record<keyof DocumentIntakeFactMap, string | number | null>>;
  };
}) => Promise<{
  ok: boolean;
  status: string;
  blockers: string[];
}>;

type ReviewSimpleAction = () => Promise<{
  ok: boolean;
  message: string;
}>;

type DocumentReviewWorkspaceProps = {
  pageData: {
    document: {
      id: string;
      status: string;
      direction: DocumentRoleCandidate;
      documentType: string | null;
      originalFilename: string;
      mimeType: string | null;
      createdAt: string;
      documentDate: string | null;
      previewUrl: string | null;
      metadataWarnings: string[];
    };
    draft: {
      id: string;
      revisionNumber: number;
      status: string;
      sourceConfidence: number | null;
      extractedText: string;
      warnings: string[];
      facts: DocumentIntakeFactMap;
      amountBreakdown: DocumentIntakeAmountBreakdown[];
      documentRole: DocumentRoleCandidate;
      documentType: string;
      operationCategory: string | null;
    };
    steps: Array<{
      step_code: string;
      status: string;
      stale_reason: string | null;
      last_saved_at: string | null;
      last_confirmed_at: string | null;
    }>;
    derived: {
      taxTreatment: {
        ready: boolean;
        treatmentCode: string;
        label: string;
        vatBucket: string | null;
        taxableAmount: number;
        taxAmount: number;
        rate: number | null;
        explanation: string;
        warnings: string[];
        blockingReasons: string[];
        normativeSummary: string;
        deterministicRuleRefs: Array<{
          id: string | null;
          scope: string | null;
          priority: number | null;
          sourceReference: string | null;
        }>;
      };
      journalSuggestion: {
        ready: boolean;
        isBalanced: boolean;
        totalDebit: number;
        totalCredit: number;
        explanation: string;
        lines: Array<{
          lineNumber: number;
          accountCode: string;
          accountName: string;
          debit: number;
          credit: number;
          provenance: string;
        }>;
        blockingReasons: string[];
      };
      validation: {
        canConfirm: boolean;
        blockers: string[];
      };
    };
    ruleSnapshot: {
      id: string;
      versionNumber: number;
      effectiveFrom: string;
      legalEntityType: string;
      taxRegimeCode: string;
      vatRegime: string;
      dgiGroup: string;
      cfeStatus: string;
      promptSummary: string;
    } | null;
    profileVersion: {
      id: string;
      versionNumber: number;
      effectiveFrom: string;
      legalEntityType: string;
      taxRegimeCode: string;
      vatRegime: string;
      dgiGroup: string;
      cfeStatus: string;
      countryCode: string;
      taxId: string;
    } | null;
    processingRun: {
      id: string;
      status: string;
      provider_code: string;
      model_code: string | null;
      triggered_by: string;
      created_at: string;
      started_at: string | null;
      finished_at: string | null;
      latency_ms: number | null;
      input_tokens: number | null;
      output_tokens: number | null;
      total_tokens: number | null;
      failure_stage: string | null;
      failure_message: string | null;
    } | null;
    revision: {
      id: string;
      revision_number: number;
      status: string;
      opened_at: string;
      reconfirmed_at: string | null;
    } | null;
    confirmations: Array<{
      id: string;
      type: string;
      confirmedAt: string;
      confirmedBy: string;
    }>;
    operationCategoryOptions: Array<{
      code: string;
      label: string;
    }>;
    canConfirm: boolean;
    canReopen: boolean;
  };
  saveDraftReviewAction: SaveDraftReviewAction;
  confirmDocumentAction: ReviewSimpleAction;
  reopenDocumentAction: ReviewSimpleAction;
};

type SectionStatusMap = Record<StepCode, string>;

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 2,
  }).format(value);
}

function getStepClasses(status: string) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-900";
    case "blocked":
      return "bg-rose-100 text-rose-900";
    case "draft_saved":
      return "bg-sky-100 text-sky-900";
    default:
      return "bg-slate-100 text-slate-900";
  }
}

function toEditableFacts(facts: DocumentIntakeFactMap) {
  return {
    issuer_name: facts.issuer_name ?? "",
    issuer_tax_id: facts.issuer_tax_id ?? "",
    receiver_name: facts.receiver_name ?? "",
    receiver_tax_id: facts.receiver_tax_id ?? "",
    document_number: facts.document_number ?? "",
    series: facts.series ?? "",
    currency_code: facts.currency_code ?? "",
    document_date: facts.document_date ?? "",
    due_date: facts.due_date ?? "",
    subtotal: facts.subtotal?.toString() ?? "",
    tax_amount: facts.tax_amount?.toString() ?? "",
    total_amount: facts.total_amount?.toString() ?? "",
  };
}

export function DocumentReviewWorkspace({
  pageData,
  saveDraftReviewAction,
  confirmDocumentAction,
  reopenDocumentAction,
}: DocumentReviewWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [identity, setIdentity] = useState({
    documentRole: pageData.draft.documentRole,
    documentType: pageData.draft.documentType,
  });
  const [facts, setFacts] = useState(() => toEditableFacts(pageData.draft.facts));
  const [operationCategory, setOperationCategory] = useState(
    pageData.draft.operationCategory ?? "",
  );
  const [sectionStatus, setSectionStatus] = useState<SectionStatusMap>({
    identity: "",
    fields: "",
    amounts: "",
    operation_context: "",
  });
  const [actionMessage, setActionMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"confirm" | "reopen" | null>(null);

  useEffect(() => {
    setIdentity({
      documentRole: pageData.draft.documentRole,
      documentType: pageData.draft.documentType,
    });
    setFacts(toEditableFacts(pageData.draft.facts));
    setOperationCategory(pageData.draft.operationCategory ?? "");
  }, [pageData]);

  function runSave(
    stepCode: StepCode,
    payload: Parameters<SaveDraftReviewAction>[0]["payload"],
  ) {
    setSectionStatus((current) => ({
      ...current,
      [stepCode]: "Guardando...",
    }));
    setActionMessage("");

    startTransition(async () => {
      try {
        const result = await saveDraftReviewAction({
          stepCode,
          payload,
        });

        setSectionStatus((current) => ({
          ...current,
          [stepCode]: result.ok
            ? "Borrador guardado"
            : result.blockers.join(" ") || "No se pudo guardar",
        }));

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setSectionStatus((current) => ({
          ...current,
          [stepCode]: error instanceof Error ? error.message : "Error al guardar",
        }));
      }
    });
  }

  function runSimpleAction(
    actionKey: "confirm" | "reopen",
    action: ReviewSimpleAction,
  ) {
    setPendingAction(actionKey);
    setActionMessage("Procesando...");
    startTransition(async () => {
      try {
        const result = await action();
        setActionMessage(result.message);

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Error inesperado.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <article className="panel p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Draft #{pageData.draft.revisionNumber}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                {pageData.document.originalFilename}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                Estado documental: {pageData.document.status}. Estado draft: {pageData.draft.status}.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <DocumentOriginalModalTrigger
                previewUrl={pageData.document.previewUrl}
                mimeType={pageData.document.mimeType}
                originalFilename={pageData.document.originalFilename}
                triggerLabel="Ver documento original"
                triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-5 py-3 text-sm`}
                modalTitle={pageData.document.originalFilename}
                modalDescription="Archivo original subido por el usuario. Se abre en grande para validar el comprobante real sin salir de la revision."
              />
              <button
                type="button"
                disabled={!pageData.canConfirm || isPending}
                onClick={() => {
                  runSimpleAction("confirm", confirmDocumentAction);
                }}
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "confirm" && isPending ? <InlineSpinner /> : null}
                Confirmar documento
              </button>
              <button
                type="button"
                disabled={!pageData.canReopen || isPending}
                onClick={() => {
                  runSimpleAction("reopen", reopenDocumentAction);
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-5 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "reopen" && isPending ? <InlineSpinner /> : null}
                Reabrir revision
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Confianza AI</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.draft.sourceConfidence !== null
                  ? `${Math.round(pageData.draft.sourceConfidence * 100)}%`
                  : "Sin score"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Fecha documento</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.document.documentDate ?? "Pendiente"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Revision activa</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.revision
                  ? `${pageData.revision.revision_number} / ${pageData.revision.status}`
                  : "Sin revision"}
              </p>
            </div>
          </div>

          <div aria-live="polite" className="mt-4 min-h-6 text-sm text-[color:var(--color-muted)]">
            {actionMessage}
          </div>
        </article>

        <article className="panel p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">Identidad</h3>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              Compra y venta se separan desde el primer paso. El guardado corre desde el navegador al cerrar cada campo.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Rol documental</span>
              <select
                value={identity.documentRole}
                onChange={(event) => {
                  const documentRole = event.target.value as DocumentRoleCandidate;
                  setIdentity((current) => ({
                    ...current,
                    documentRole,
                  }));
                  runSave("identity", {
                    documentRole,
                    documentType: identity.documentType,
                  });
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <option value="purchase">purchase</option>
                <option value="sale">sale</option>
                <option value="other">other</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Tipo documental</span>
              <input
                value={identity.documentType}
                onChange={(event) => {
                  setIdentity((current) => ({
                    ...current,
                    documentType: event.target.value,
                  }));
                }}
                onBlur={() => {
                  runSave("identity", identity);
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              />
            </label>
          </div>

          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {sectionStatus.identity}
          </p>
        </article>

        <article className="panel p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">Datos extraidos</h3>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              Cabecera editable con persistencia en borrador.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["issuer_name", "Emisor"],
              ["issuer_tax_id", "RUT emisor"],
              ["receiver_name", "Receptor"],
              ["receiver_tax_id", "RUT receptor"],
              ["document_number", "Numero"],
              ["series", "Serie"],
              ["currency_code", "Moneda"],
              ["document_date", "Fecha"],
              ["due_date", "Vencimiento"],
            ].map(([field, label]) => (
              <label key={field} className="space-y-2 text-sm">
                <span className="font-medium">{label}</span>
                <input
                  value={facts[field as keyof typeof facts]}
                  onChange={(event) => {
                    setFacts((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }));
                  }}
                  onBlur={() => {
                    runSave("fields", {
                      facts: {
                        issuer_name: facts.issuer_name,
                        issuer_tax_id: facts.issuer_tax_id,
                        receiver_name: facts.receiver_name,
                        receiver_tax_id: facts.receiver_tax_id,
                        document_number: facts.document_number,
                        series: facts.series,
                        currency_code: facts.currency_code,
                        document_date: facts.document_date,
                        due_date: facts.due_date,
                      },
                    });
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                />
              </label>
            ))}
          </div>

          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {sectionStatus.fields}
          </p>
        </article>

        <article className="panel p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">Importes y contexto</h3>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              La categoria operacional alimenta IVA y asiento. Si falta, el paso final queda bloqueado.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["subtotal", "Subtotal"],
              ["tax_amount", "IVA"],
              ["total_amount", "Total"],
            ].map(([field, label]) => (
              <label key={field} className="space-y-2 text-sm">
                <span className="font-medium">{label}</span>
                <input
                  value={facts[field as keyof typeof facts]}
                  onChange={(event) => {
                    setFacts((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }));
                  }}
                  onBlur={() => {
                    runSave("amounts", {
                      facts: {
                        subtotal: facts.subtotal,
                        tax_amount: facts.tax_amount,
                        total_amount: facts.total_amount,
                      },
                    });
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Categoria operativa</span>
              <select
                value={operationCategory}
                onChange={(event) => {
                  const value = event.target.value;
                  setOperationCategory(value);
                  runSave("operation_context", {
                    operationCategory: value,
                  });
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <option value="">Selecciona una categoria</option>
                {pageData.operationCategoryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 px-4 py-3 text-sm">
              <p className="font-medium">Totales detectados</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatMoney(pageData.derived.taxTreatment.taxableAmount)} base / {formatMoney(pageData.derived.taxTreatment.taxAmount)} IVA
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {sectionStatus.amounts || sectionStatus.operation_context}
          </p>
        </article>

        <article className="panel p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">Texto extraido</h3>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              Transparencia del intake estructurado que sale de OpenAI y queda congelado en el draft.
            </p>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-3xl border border-[color:var(--color-border)] bg-white/75 p-5 text-xs leading-6 text-[color:var(--color-muted)]">
            {pageData.draft.extractedText || "Sin texto extraido"}
          </pre>
        </article>
      </div>

      <div className="space-y-4">
        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Pasos y bloqueos</h3>
          <div className="mt-4 space-y-3">
            {pageData.steps.map((step) => (
              <div
                key={step.step_code}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{step.step_code}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStepClasses(step.status)}`}>
                    {step.status}
                  </span>
                </div>
                {step.stale_reason ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
                    {step.stale_reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Tratamiento IVA</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            {pageData.derived.taxTreatment.explanation}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">{pageData.derived.taxTreatment.label}</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Base: {formatMoney(pageData.derived.taxTreatment.taxableAmount)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                IVA: {formatMoney(pageData.derived.taxTreatment.taxAmount)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Bucket: {pageData.derived.taxTreatment.vatBucket ?? "manual"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Snapshot aplicado</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.ruleSnapshot
                  ? `v${pageData.ruleSnapshot.versionNumber} - ${pageData.ruleSnapshot.legalEntityType} / ${pageData.ruleSnapshot.taxRegimeCode} / IVA ${pageData.ruleSnapshot.vatRegime}`
                  : "Sin snapshot"}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.taxTreatment.normativeSummary}
              </p>
            </div>
          </div>

          {pageData.derived.taxTreatment.warnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {pageData.derived.taxTreatment.warnings.join(" ")}
            </div>
          ) : null}

          {pageData.derived.validation.blockers.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
              {pageData.derived.validation.blockers.join(" ")}
            </div>
          ) : null}
        </article>

        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Sugerencia contable</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            {pageData.derived.journalSuggestion.explanation}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left uppercase tracking-[0.18em] text-[11px] text-[color:var(--color-muted)]">
                  <th className="pr-4">Cuenta</th>
                  <th className="pr-4">Debito</th>
                  <th className="pr-4">Credito</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {pageData.derived.journalSuggestion.lines.map((line) => (
                  <tr key={line.lineNumber}>
                    <td className="rounded-l-2xl border border-r-0 border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                      <div className="font-medium">{line.accountCode}</div>
                      <div className="text-[color:var(--color-muted)]">{line.accountName}</div>
                    </td>
                    <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                      {line.debit ? formatMoney(line.debit) : "-"}
                    </td>
                    <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                      {line.credit ? formatMoney(line.credit) : "-"}
                    </td>
                    <td className="rounded-r-2xl border border-l-0 border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-[color:var(--color-muted)]">
                      {line.provenance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">
              Balance: {formatMoney(pageData.derived.journalSuggestion.totalDebit)} / {formatMoney(pageData.derived.journalSuggestion.totalCredit)}
            </p>
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Trazabilidad</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
            <p>Processing run: {pageData.processingRun ? `${pageData.processingRun.provider_code}:${pageData.processingRun.model_code ?? "sin modelo"}` : "sin run"}</p>
            <p>Snapshot: {pageData.ruleSnapshot ? pageData.ruleSnapshot.id : "sin snapshot"}</p>
            <p>Confirmaciones: {pageData.confirmations.length}</p>
            <p>Creado: {formatDate(pageData.document.createdAt)}</p>
          </div>

          {pageData.confirmations.length > 0 ? (
            <div className="mt-4 space-y-3">
              {pageData.confirmations.map((confirmation) => (
                <div
                  key={confirmation.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm"
                >
                  {confirmation.type} por {confirmation.confirmedBy} el {formatDate(confirmation.confirmedAt)}
                </div>
              ))}
            </div>
          ) : null}

          {(pageData.draft.warnings.length > 0 || pageData.document.metadataWarnings.length > 0) ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {[...pageData.draft.warnings, ...pageData.document.metadataWarnings].join(" ")}
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}
