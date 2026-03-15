"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import { AccountingImpactPreview } from "@/components/documents/accounting-impact-preview";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { RuleApplicationCard } from "@/components/documents/rule-application-card";
import type { DocumentReviewPageData } from "@/modules/documents/review";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { HelpHint } from "@/components/ui/help-hint";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type StepCode =
  | "identity"
  | "fields"
  | "amounts"
  | "operation_context"
  | "accounting_context";

type SaveDraftReviewAction = (input: {
  stepCode: StepCode;
  payload: {
    documentRole?: DocumentRoleCandidate;
    documentType?: string;
    operationCategory?: string | null;
    facts?: Partial<Record<keyof DocumentIntakeFactMap, string | number | null>>;
    accountingContext?: {
      userFreeText?: string | null;
      businessPurposeNote?: string | null;
      manualOverrideAccountId?: string | null;
      manualOverrideConceptId?: string | null;
      manualOverrideOperationCategory?: string | null;
      learnedConceptName?: string | null;
    };
  };
}) => Promise<{
  ok: boolean;
  status: string;
  blockers: string[];
}>;

type ConfirmFinalDocumentAction = (input: {
  learning: {
    scope: "none" | "document_override" | "vendor_concept_operation_category" | "vendor_concept" | "concept_global" | "vendor_default";
    learnedConceptName: string | null;
  };
}) => Promise<{
  ok: boolean;
  message: string;
}>;

type CreateReviewAccountAction = (input: {
  code: string;
  name: string;
}) => Promise<{
  ok: boolean;
  message: string;
  account: {
    id: string;
    code: string;
    name: string;
  } | null;
}>;

type ReviewSimpleAction = () => Promise<{
  ok: boolean;
  message: string;
}>;

type ResolveDuplicateAction = (input: {
  action: "confirmed_duplicate" | "false_positive" | "justified_non_duplicate";
  note: string | null;
}) => Promise<{
  ok: boolean;
  message: string;
}>;

type SaveLearningRuleAction = (input: {
  learning: {
    scope: "none" | "document_override" | "vendor_concept_operation_category" | "vendor_concept" | "concept_global" | "vendor_default";
    learnedConceptName: string | null;
  };
}) => Promise<{
  ok: boolean;
  message: string;
  ruleId?: string | null;
}>;

type DocumentReviewWorkspaceProps = {
  pageData: DocumentReviewPageData;
  saveDraftReviewAction: SaveDraftReviewAction;
  postProvisionalDocumentAction: ReviewSimpleAction;
  confirmFinalDocumentAction: ConfirmFinalDocumentAction;
  createReviewAccountAction: CreateReviewAccountAction;
  resolveDuplicateAction: ResolveDuplicateAction;
  runClassificationAction: ReviewSimpleAction;
  saveLearningRuleAction: SaveLearningRuleAction;
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

function getCertaintyClasses(level: "green" | "yellow" | "red") {
  if (level === "green") {
    return "bg-emerald-100 text-emerald-900";
  }

  if (level === "yellow") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-rose-100 text-rose-900";
}

function formatDecisionSource(value: string) {
  return value.replace(/_/g, " ");
}

function formatPostingStatus(value: string | null) {
  switch (value) {
    case "draft":
      return "Borrador";
    case "vat_ready":
      return "Listo para IVA";
    case "posted_provisional":
      return "Posteado provisional";
    case "posted_final":
      return "Posteado final";
    case "locked":
      return "Bloqueado";
    default:
      return value ?? "Sin posteo";
  }
}

function formatWorkflowQueue(value: string) {
  switch (value) {
    case "pending_factual_review":
      return "Pendiente de revision factual";
    case "pending_assignment":
      return "Pendiente de asignacion";
    case "pending_learning_decision":
      return "Pendiente de aprendizaje";
    case "ready_for_provisional_posting":
      return "Listo para posteo provisional";
    case "posted_provisional":
      return "Posteado provisional";
    case "ready_for_final_confirmation":
      return "Listo para confirmacion final";
    case "posted_final":
      return "Posteado final";
    case "reopened_needs_manual_remap":
      return "Reabierto para remap manual";
    default:
      return value.replace(/_/g, " ");
  }
}

function formatClassificationStatus(value: string) {
  switch (value) {
    case "completed":
      return "Completada";
    case "failed":
      return "Fallida";
    case "stale":
      return "Stale";
    case "needs_context":
      return "Falta contexto";
    default:
      return "Pendiente";
  }
}

function formatBlockerFamily(value: string) {
  switch (value) {
    case "documental":
      return "Documental";
    case "fiscal":
      return "Fiscal";
    case "contable":
      return "Contable";
    case "ia":
      return "IA";
    case "duplicados":
      return "Duplicados";
    case "periodo":
      return "Periodo";
    case "razonabilidad_geografica":
      return "Razonabilidad geografica";
    default:
      return value.replace(/_/g, " ");
  }
}

function formatLocationSignalSeverity(value: "info" | "warning" | "high") {
  switch (value) {
    case "high":
      return "Alto";
    case "warning":
      return "Advertencia";
    default:
      return "Informativo";
  }
}

function getLocationSignalSeverityClasses(value: "info" | "warning" | "high") {
  switch (value) {
    case "high":
      return "bg-rose-100 text-rose-900";
    case "warning":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-sky-100 text-sky-900";
  }
}

function formatLocationSignalCode(value: string) {
  switch (value) {
    case "same_city":
      return "Misma ciudad";
    case "same_department_other_city":
      return "Mismo departamento, otra ciudad";
    case "other_department":
      return "Otro departamento";
    case "travel_pattern":
      return "Patron de viaje";
    case "sensitive_merchant_far_from_base":
      return "Comercio sensible lejos de la base";
    case "missing_location_evidence":
      return "Sin evidencia suficiente";
    default:
      return value.replace(/_/g, " ");
  }
}

function getPostingStatusClasses(value: string | null) {
  switch (value) {
    case "posted_final":
      return "bg-emerald-100 text-emerald-900";
    case "posted_provisional":
    case "vat_ready":
      return "bg-amber-100 text-amber-900";
    case "locked":
      return "bg-slate-100 text-slate-900";
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
  postProvisionalDocumentAction,
  confirmFinalDocumentAction,
  createReviewAccountAction,
  resolveDuplicateAction,
  runClassificationAction,
  saveLearningRuleAction,
  reopenDocumentAction,
}: DocumentReviewWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const reviewAccountKindLabel = pageData.draft.documentRole === "sale"
    ? "ingreso"
    : pageData.draft.documentRole === "purchase"
      ? "gasto"
      : "uso manual";
  const [identity, setIdentity] = useState({
    documentRole: pageData.draft.documentRole,
    documentType: pageData.draft.documentType,
  });
  const [facts, setFacts] = useState(() => toEditableFacts(pageData.draft.facts));
  const [operationCategory, setOperationCategory] = useState(
    pageData.draft.operationCategory ?? "",
  );
  const [accountingContext, setAccountingContext] = useState({
    userFreeText: pageData.derived.accountingContext.userFreeText ?? "",
    businessPurposeNote: pageData.derived.accountingContext.businessPurposeNote
      ?? pageData.derived.taxTreatment.businessPurposeNote
      ?? "",
    manualOverrideAccountId: pageData.derived.accountingContext.manualOverrideAccountId ?? "",
    manualOverrideConceptId: pageData.derived.accountingContext.manualOverrideConceptId ?? "",
    manualOverrideOperationCategory:
      pageData.derived.accountingContext.manualOverrideOperationCategory ?? "",
    learnedConceptName: pageData.derived.accountingContext.learnedConceptName ?? "",
  });
  const [availableAccounts, setAvailableAccounts] = useState(pageData.accountingOptions.accounts);
  const [newReviewAccount, setNewReviewAccount] = useState({
    code: "",
    name: "",
  });
  const [sectionStatus, setSectionStatus] = useState<SectionStatusMap>({
    identity: "",
    fields: "",
    amounts: "",
    operation_context: "",
    accounting_context: "",
  });
  const [actionMessage, setActionMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "classify" | "confirm_final" | "post_provisional" | "save_learning" | "reopen" | null
  >(null);
  const [pendingInlineAction, setPendingInlineAction] = useState<"create_account" | null>(null);
  const [pendingDuplicateAction, setPendingDuplicateAction] = useState<
    "confirmed_duplicate" | "false_positive" | "justified_non_duplicate" | null
  >(null);
  const [duplicateNote, setDuplicateNote] = useState("");
  const [learningScope, setLearningScope] = useState<
    "none" | "document_override" | "vendor_concept_operation_category" | "vendor_concept" | "concept_global" | "vendor_default"
  >(pageData.learningSuggestions.recommendedScope);
  const [learnedConceptName, setLearnedConceptName] = useState(
    pageData.derived.accountingContext.learnedConceptName
    ?? pageData.learningSuggestions.suggestedConceptName
    ?? "",
  );

  useEffect(() => {
    setIdentity({
      documentRole: pageData.draft.documentRole,
      documentType: pageData.draft.documentType,
    });
    setFacts(toEditableFacts(pageData.draft.facts));
    setOperationCategory(pageData.draft.operationCategory ?? "");
    setAccountingContext({
      userFreeText: pageData.derived.accountingContext.userFreeText ?? "",
      businessPurposeNote: pageData.derived.accountingContext.businessPurposeNote
        ?? pageData.derived.taxTreatment.businessPurposeNote
        ?? "",
      manualOverrideAccountId: pageData.derived.accountingContext.manualOverrideAccountId ?? "",
      manualOverrideConceptId: pageData.derived.accountingContext.manualOverrideConceptId ?? "",
      manualOverrideOperationCategory:
        pageData.derived.accountingContext.manualOverrideOperationCategory ?? "",
      learnedConceptName: pageData.derived.accountingContext.learnedConceptName ?? "",
    });
    setAvailableAccounts(pageData.accountingOptions.accounts);
    setNewReviewAccount({
      code: "",
      name: "",
    });
    setLearningScope(pageData.learningSuggestions.recommendedScope);
    setLearnedConceptName(
      pageData.derived.accountingContext.learnedConceptName
      ?? pageData.learningSuggestions.suggestedConceptName
      ?? "",
    );
  }, [pageData]);

  function buildAccountingContextPayload(nextAccountingContext = accountingContext) {
    return {
      accountingContext: {
        userFreeText: nextAccountingContext.userFreeText,
        businessPurposeNote: nextAccountingContext.businessPurposeNote,
        manualOverrideAccountId: nextAccountingContext.manualOverrideAccountId || null,
        manualOverrideConceptId: nextAccountingContext.manualOverrideConceptId || null,
        manualOverrideOperationCategory:
          nextAccountingContext.manualOverrideOperationCategory || null,
        learnedConceptName: nextAccountingContext.learnedConceptName || null,
      },
    };
  }

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
    actionKey: "reopen",
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

  function runPostProvisionalAction() {
    setPendingAction("post_provisional");
    setActionMessage("Procesando...");
    startTransition(async () => {
      try {
        const result = await postProvisionalDocumentAction();
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

  function runConfirmFinalAction() {
    setPendingAction("confirm_final");
    setActionMessage("Procesando...");
    startTransition(async () => {
      try {
        const result = await confirmFinalDocumentAction({
          learning: {
            scope: "none",
            learnedConceptName: null,
          },
        });
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

  function runCreateReviewAccount() {
    const code = newReviewAccount.code.trim();
    const name = newReviewAccount.name.trim();

    if (!code || !name) {
      setSectionStatus((current) => ({
        ...current,
        accounting_context: "Completa codigo y nombre para crear la cuenta.",
      }));
      return;
    }

    setPendingInlineAction("create_account");
    setSectionStatus((current) => ({
      ...current,
      accounting_context: "Creando cuenta y recalculando...",
    }));
    setActionMessage("");

    startTransition(async () => {
      try {
        const created = await createReviewAccountAction({
          code,
          name,
        });

        if (!created.ok || !created.account) {
          setSectionStatus((current) => ({
            ...current,
            accounting_context: created.message || "No se pudo crear la cuenta.",
          }));
          setActionMessage(created.message || "No se pudo crear la cuenta.");
          return;
        }

        const nextAccounts = [...availableAccounts.filter((account) => account.id !== created.account?.id), created.account]
          .sort((left, right) => left.code.localeCompare(right.code, "es", {
            numeric: true,
            sensitivity: "base",
          }));
        const nextAccountingContext = {
          ...accountingContext,
          manualOverrideAccountId: created.account.id,
        };

        setAvailableAccounts(nextAccounts);
        setAccountingContext(nextAccountingContext);
        setNewReviewAccount({
          code: "",
          name: "",
        });
        setActionMessage(created.message);

        const saved = await saveDraftReviewAction({
          stepCode: "accounting_context",
          payload: buildAccountingContextPayload(nextAccountingContext),
        });

        setSectionStatus((current) => ({
          ...current,
          accounting_context: saved.ok
            ? "Cuenta creada, override aplicado y borrador recalculado."
            : saved.blockers.join(" ") || "No se pudo recalcular el contexto contable.",
        }));

        if (saved.ok) {
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al crear la cuenta.";
        setSectionStatus((current) => ({
          ...current,
          accounting_context: message,
        }));
        setActionMessage(message);
      } finally {
        setPendingInlineAction(null);
      }
    });
  }

  function runClassification() {
    setPendingAction("classify");
    setActionMessage("Ejecutando clasificacion...");
    startTransition(async () => {
      try {
        const result = await runClassificationAction();
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

  function runSaveLearningRule() {
    setPendingAction("save_learning");
    setActionMessage("Guardando criterio reusable...");
    startTransition(async () => {
      try {
        const result = await saveLearningRuleAction({
          learning: {
            scope: learningScope,
            learnedConceptName: learnedConceptName.trim() || null,
          },
        });
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

  function runDuplicateResolution(
    action: "confirmed_duplicate" | "false_positive" | "justified_non_duplicate",
  ) {
    setPendingDuplicateAction(action);
    setActionMessage("Resolviendo duplicado...");

    startTransition(async () => {
      try {
        const result = await resolveDuplicateAction({
          action,
          note: duplicateNote.trim() || null,
        });
        setActionMessage(result.message);

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Error inesperado.");
      } finally {
        setPendingDuplicateAction(null);
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
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPostingStatusClasses(pageData.document.postingStatus)}`}>
                  {formatPostingStatus(pageData.document.postingStatus)}
                </span>
                {pageData.derived.journalSuggestion.hasProvisionalAccounts ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    <span>Provisional</span>
                    <HelpHint contentKey="cuenta_temporal" />
                  </span>
                ) : null}
              </div>
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
                disabled={!pageData.canRunClassification || isPending}
                onClick={() => {
                  runClassification();
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-5 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "classify" && isPending ? <InlineSpinner /> : null}
                Clasificar ahora
              </button>
              <button
                type="button"
                disabled={!pageData.canPostProvisional || isPending}
                onClick={() => {
                  runPostProvisionalAction();
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-5 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "post_provisional" && isPending ? <InlineSpinner /> : null}
                Postear provisional
              </button>
              <div className="flex items-center">
                <HelpHint contentKey="posteo_provisional" />
              </div>
              <button
                type="button"
                disabled={!pageData.canConfirmFinal || isPending}
                onClick={() => {
                  runConfirmFinalAction();
                }}
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-5 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "confirm_final" && isPending ? <InlineSpinner /> : null}
                Confirmar final
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

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Semaforo</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getCertaintyClasses(pageData.certaintySummary.level)}`}>
                  {pageData.certaintySummary.level}
                </span>
              </div>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.certaintySummary.confidence !== null
                  ? `${Math.round(pageData.certaintySummary.confidence * 100)}%`
                  : "Sin score"}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Warnings: {pageData.certaintySummary.warningCount}
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
              <p className="mt-1 text-[color:var(--color-muted)]">
                Posteo: {formatPostingStatus(pageData.document.postingStatus)}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Workflow</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatWorkflowQueue(pageData.workflowState.queueCode)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Siguiente: {pageData.workflowState.nextRecommendedAction}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Estado de clasificacion</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatClassificationStatus(pageData.workflowState.classificationStatus)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Ultima corrida: {pageData.latestClassificationRun
                  ? formatDate(pageData.latestClassificationRun.createdAt)
                  : "Sin ejecucion explicita"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Cuenta propuesta</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.appliedRule.accountCode && pageData.derived.appliedRule.accountName
                  ? `${pageData.derived.appliedRule.accountCode} - ${pageData.derived.appliedRule.accountName}`
                  : "Pendiente de clasificacion"}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Operacion: {pageData.derived.appliedRule.operationCategory ?? pageData.draft.operationCategory ?? "Sin definir"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
              <p className="font-semibold">Modelo / provider</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.latestClassificationRun?.providerCode ?? pageData.derived.assistantSuggestion.providerCode ?? "sin provider"}
                {" / "}
                {pageData.latestClassificationRun?.modelCode ?? pageData.derived.assistantSuggestion.modelCode ?? "sin modelo"}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Confianza: {pageData.latestClassificationRun?.confidence !== null && pageData.latestClassificationRun?.confidence !== undefined
                  ? `${Math.round(pageData.latestClassificationRun.confidence * 100)}%`
                  : pageData.derived.assistantSuggestion.confidence !== null
                    ? `${Math.round(pageData.derived.assistantSuggestion.confidence * 100)}%`
                    : "Sin score"}
              </p>
            </div>
          </div>

          <div aria-live="polite" className="mt-4 min-h-6 text-sm text-[color:var(--color-muted)]">
            {actionMessage}
          </div>

          {pageData.workflowState.visibleWarnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {pageData.workflowState.visibleWarnings.join(" ")}
            </div>
          ) : null}
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

          {pageData.draft.transactionFamilyResolution ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">Resolucion automatica por identidad</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pageData.draft.transactionFamilyResolution.shouldReview ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                  {pageData.draft.transactionFamilyResolution.source ?? "sin fuente"}
                </span>
              </div>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.draft.transactionFamilyResolution.confidence !== null
                  ? `${Math.round(pageData.draft.transactionFamilyResolution.confidence * 100)}%`
                  : "Sin score"} / {pageData.draft.transactionFamilyResolution.shouldReview ? "requiere revision" : "deterministico"}
              </p>
              {pageData.draft.transactionFamilyResolution.evidence.length > 0 ? (
                <div className="mt-3 space-y-2 text-[color:var(--color-muted)]">
                  {pageData.draft.transactionFamilyResolution.evidence.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              ) : null}
              {pageData.draft.transactionFamilyResolution.warnings.length > 0 ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                  {pageData.draft.transactionFamilyResolution.warnings.join(" ")}
                </div>
              ) : null}
            </div>
          ) : null}

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
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">Contexto contable y proposito empresarial</h3>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              Se pide solo cuando el matching no alcanza. El texto queda auditado y puede disparar una segunda pasada de IA.
            </p>
          </div>

          {pageData.derived.taxTreatment.locationSignalCode !== "none" ? (
            <div className="mb-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">Razonabilidad geografica</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getLocationSignalSeverityClasses(pageData.derived.taxTreatment.locationSignalSeverity)}`}>
                  {formatLocationSignalSeverity(pageData.derived.taxTreatment.locationSignalSeverity)}
                </span>
              </div>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Signal: {formatLocationSignalCode(pageData.derived.taxTreatment.locationSignalCode)}
              </p>
              <p className="mt-2 leading-6 text-[color:var(--color-muted)]">
                {pageData.derived.taxTreatment.locationSignalExplanation
                  ?? "Sin explicacion adicional."}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <p className="text-[color:var(--color-muted)]">
                  Familia sugerida: {pageData.derived.taxTreatment.suggestedExpenseFamily ?? "Sin sugerencia"}
                </p>
                <p className="text-[color:var(--color-muted)]">
                  Perfil fiscal sugerido: {pageData.derived.taxTreatment.suggestedTaxProfileCode ?? "Sin sugerencia"}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">Contexto del gasto</span>
              <textarea
                value={accountingContext.userFreeText}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    userFreeText: event.target.value,
                  }));
                }}
                placeholder="Explica que tipo de gasto es, con que finalidad se incurrio, a que operacion/proyecto/actividad esta vinculado y cualquier otro dato util."
                className="min-h-32 w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
              />
            </label>

            <label className="space-y-2 text-sm md:col-span-2">
              <span className="flex items-center gap-2 font-medium">
                <span>
                  Justificacion de proposito empresarial
                  {pageData.derived.taxTreatment.requiresUserJustification ? " *" : ""}
                </span>
                <HelpHint contentKey="razonabilidad_geografica" tone="warning" />
              </span>
              <textarea
                value={accountingContext.businessPurposeNote}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    businessPurposeNote: event.target.value,
                  }));
                }}
                placeholder="Explica por que el gasto fuera de la base geografica sigue siendo empresarial, a que viaje, cliente, obra o actividad responde y que evidencia contextual lo respalda."
                className="min-h-28 w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
              />
              {pageData.derived.taxTreatment.requiresUserJustification ? (
                <p className="text-xs leading-6 text-amber-900">
                  Este caso requiere nota auditada para confirmar final. El posteo provisional sigue habilitado si el resto del documento esta consistente.
                </p>
              ) : null}
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Override de cuenta</span>
              <select
                value={accountingContext.manualOverrideAccountId}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    manualOverrideAccountId: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <option value="">Sin override</option>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm md:col-span-2">
              <div>
                <p className="font-medium">Crear cuenta nueva desde esta revision</p>
                <p className="mt-1 leading-6 text-[color:var(--color-muted)]">
                  Si la cuenta correcta no existe todavia, puedes crearla aqui como cuenta postable de {reviewAccountKindLabel}
                  {" "}y usarla enseguida como override para este documento.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="font-medium">Codigo de cuenta</span>
                  <input
                    value={newReviewAccount.code}
                    onChange={(event) => {
                      setNewReviewAccount((current) => ({
                        ...current,
                        code: event.target.value,
                      }));
                    }}
                    placeholder={pageData.draft.documentRole === "sale" ? "Ej. 4105" : "Ej. 6105"}
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-medium">Nombre de cuenta</span>
                  <input
                    value={newReviewAccount.name}
                    onChange={(event) => {
                      setNewReviewAccount((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                    }}
                    placeholder={
                      pageData.derived.conceptResolution.primaryConceptLabels[0]
                      ?? (pageData.draft.documentRole === "sale"
                        ? "Ventas plaza gravadas"
                        : "Gastos operativos")
                    }
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    runCreateReviewAccount();
                  }}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
                >
                  {pendingInlineAction === "create_account" && isPending ? <InlineSpinner /> : null}
                  Crear cuenta y usarla
                </button>
              </div>
            </div>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Override de concepto</span>
              <select
                value={accountingContext.manualOverrideConceptId}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    manualOverrideConceptId: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <option value="">Sin override</option>
                {pageData.accountingOptions.concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.code} - {concept.canonicalName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Categoria para override</span>
              <select
                value={accountingContext.manualOverrideOperationCategory}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    manualOverrideOperationCategory: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <option value="">Sin override</option>
                {pageData.operationCategoryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Nombre canonico sugerido</span>
              <input
                value={accountingContext.learnedConceptName}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    learnedConceptName: event.target.value,
                  }));
                  setLearnedConceptName(event.target.value);
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runSave("accounting_context", buildAccountingContextPayload());
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
            >
              Guardar contexto y recalcular
            </button>
          </div>

          {pageData.derived.accountingContext.reasonCodes.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Motivos: {pageData.derived.accountingContext.reasonCodes.join(", ")}
            </div>
          ) : null}

          {pageData.derived.assistantSuggestion.rationale ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Segunda IA</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.assistantSuggestion.rationale}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Estado: {pageData.derived.assistantSuggestion.status}
                {pageData.derived.assistantSuggestion.confidence !== null
                  ? ` / ${Math.round(pageData.derived.assistantSuggestion.confidence * 100)}%`
                  : ""}
              </p>
            </div>
          ) : null}

          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {sectionStatus.accounting_context}
          </p>
        </article>

        <article className="panel p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">Lineas y conceptos</h3>
            <p className="text-sm leading-7 text-[color:var(--color-muted)]">
              El intake intenta extraer articulos o servicios. Si no puede, el draft cae a `amount_breakdown` como degradacion controlada.
            </p>
          </div>

          {pageData.draft.lineItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left uppercase tracking-[0.18em] text-[11px] text-[color:var(--color-muted)]">
                    <th className="pr-4">Linea</th>
                    <th className="pr-4">Descripcion</th>
                    <th className="pr-4">Concepto</th>
                    <th className="pr-4">Neto</th>
                    <th className="pr-4">IVA</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.draft.lineItems.map((line, index) => (
                    <tr key={`${line.line_number ?? index}-${line.concept_description ?? "line"}`}>
                      <td className="rounded-l-2xl border border-r-0 border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                        {line.line_number ?? index + 1}
                      </td>
                      <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                        <div className="font-medium">
                          {line.concept_description ?? "Sin descripcion"}
                        </div>
                        <div className="text-[color:var(--color-muted)]">
                          {line.concept_code ?? "Sin codigo"}
                        </div>
                      </td>
                      <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-[color:var(--color-muted)]">
                        {pageData.derived.conceptResolution.lines.find(
                          (candidate) => candidate.lineNumber === (line.line_number ?? index + 1),
                        )?.matchedConceptName
                          ?? pageData.derived.conceptResolution.lines.find(
                            (candidate) => candidate.lineNumber === (line.line_number ?? index + 1),
                          )?.matchStrategy
                          ?? "Sin match"}
                      </td>
                      <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                        {line.net_amount !== null ? formatMoney(line.net_amount) : "-"}
                      </td>
                      <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                        {line.tax_amount !== null ? formatMoney(line.tax_amount) : "-"}
                      </td>
                      <td className="rounded-r-2xl border border-l-0 border-[color:var(--color-border)] bg-white/70 px-4 py-3">
                        {line.total_amount !== null ? formatMoney(line.total_amount) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm text-[color:var(--color-muted)]">
              {pageData.derived.conceptResolution.fallbackUsed
                ? "No hubo line_items confiables. El draft usa amount_breakdown como fallback."
                : "Todavia no hay conceptos extraidos."}
            </div>
          )}
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
          {pageData.derived.validation.blockerGroups.length > 0 ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {pageData.derived.validation.blockerGroups.map((group) => (
                <div key={group.family}>
                  <p className="font-semibold">{formatBlockerFamily(group.family)}</p>
                  <p className="mt-1 leading-6">{group.blockers.join(" ")}</p>
                </div>
              ))}
            </div>
          ) : null}
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
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Identidad y duplicados</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Estrategia</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.invoiceIdentity?.identityStrategy ?? "Sin identidad usable"}
              </p>
              <p className="mt-2 font-semibold">Clave</p>
              <p className="mt-2 break-all text-[color:var(--color-muted)]">
                {pageData.derived.invoiceIdentity?.invoiceIdentityKey ?? "Sin clave de negocio"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Estado de duplicado</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.invoiceIdentity?.duplicateStatus ?? "clear"}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.invoiceIdentity?.duplicateOfDocumentId
                  ? `Documento relacionado: ${pageData.derived.invoiceIdentity.duplicateOfDocumentId}`
                  : "Sin documento relacionado"}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.invoiceIdentity?.duplicateReason ?? "Sin motivo registrado"}
              </p>
            </div>
          </div>

          {pageData.derived.invoiceIdentity
          && pageData.derived.invoiceIdentity.duplicateStatus !== "clear" ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={duplicateNote}
                onChange={(event) => {
                  setDuplicateNote(event.target.value);
                }}
                placeholder="Agrega una nota si confirmas falso positivo o si quieres continuar con justificacion."
                className="min-h-28 w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    runDuplicateResolution("confirmed_duplicate");
                  }}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
                >
                  {pendingDuplicateAction === "confirmed_duplicate" && isPending ? <InlineSpinner /> : null}
                  Marcar duplicado
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    runDuplicateResolution("false_positive");
                  }}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
                >
                  {pendingDuplicateAction === "false_positive" && isPending ? <InlineSpinner /> : null}
                  Marcar falso positivo
                </button>
                <button
                  type="button"
                  disabled={isPending || !duplicateNote.trim()}
                  onClick={() => {
                    runDuplicateResolution("justified_non_duplicate");
                  }}
                  className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
                >
                  {pendingDuplicateAction === "justified_non_duplicate" && isPending ? <InlineSpinner /> : null}
                  Continuar con justificacion
                </button>
              </div>
            </div>
          ) : null}
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
                Base UYU: {formatMoney(pageData.derived.taxTreatment.taxableAmountUyu)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                IVA UYU: {formatMoney(pageData.derived.taxTreatment.taxAmountUyu)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Bucket: {pageData.derived.taxTreatment.vatBucket ?? "manual"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Instantanea aplicada</p>
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

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <span>Credito fiscal</span>
                <HelpHint contentKey="iva_no_deducible" />
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Categoria: {pageData.derived.taxTreatment.vatCreditCategory}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Deducibilidad: {pageData.derived.taxTreatment.vatDeductibilityStatus}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                IVA deducible UYU: {formatMoney(pageData.derived.taxTreatment.vatDeductibleTaxAmountUyu)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                <span className="inline-flex items-center gap-2">
                  <span>IVA no deducible UYU: {formatMoney(pageData.derived.taxTreatment.vatNondeductibleTaxAmountUyu)}</span>
                  <HelpHint contentKey="iva_no_deducible" />
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Prorrata y nexo</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Nexo con giro: {pageData.derived.taxTreatment.businessLinkStatus}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Coeficiente: {pageData.derived.taxTreatment.vatProrationCoefficient !== null
                  ? `${Math.round(pageData.derived.taxTreatment.vatProrationCoefficient * 100)}%`
                  : "No aplica"}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                <span className="inline-flex items-center gap-2">
                  <span>IVA directo UYU: {formatMoney(pageData.derived.taxTreatment.vatDirectTaxAmountUyu)}</span>
                  <HelpHint contentKey="iva_directo" />
                </span>
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                <span className="inline-flex items-center gap-2">
                  <span>IVA indirecto UYU: {formatMoney(pageData.derived.taxTreatment.vatIndirectTaxAmountUyu)}</span>
                  <HelpHint contentKey="iva_indirecto" />
                </span>
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
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">FX fiscal</h3>
            <HelpHint contentKey="tipo_cambio_fiscal" />
          </div>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Trazabilidad monetaria para IVA y contabilidad en UYU.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Moneda original</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.monetarySnapshot?.currencyCode ?? pageData.derived.journalSuggestion.currencyCode}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Total original: {formatMoney(pageData.derived.monetarySnapshot?.totalAmountOriginal ?? 0)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Total UYU: {formatMoney(pageData.derived.monetarySnapshot?.totalAmountUyu ?? pageData.derived.taxTreatment.totalAmountUyu)}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Fuente</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {pageData.derived.monetarySnapshot?.fx.policyCode ?? "dgi_previous_business_day_interbank"}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                TC aplicado: {pageData.derived.journalSuggestion.fxRate}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                BCU: {pageData.derived.journalSuggestion.fxRateBcuValue ?? "--"}
                {pageData.derived.journalSuggestion.fxRateBcuDateUsed
                  ? ` / ${pageData.derived.journalSuggestion.fxRateBcuDateUsed}`
                  : ""}
              </p>
            </div>
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Sugerencia contable</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            {pageData.derived.journalSuggestion.explanation}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            Precedencia aplicada: {pageData.derived.appliedRule.scope} / {pageData.derived.appliedRule.provenance}
          </p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Modo de posteo: {pageData.derived.journalSuggestion.postingMode} / Template: {pageData.derived.journalSuggestion.templateCode ?? "sin template"}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left uppercase tracking-[0.18em] text-[11px] text-[color:var(--color-muted)]">
                  <th className="pr-4">Cuenta</th>
                  <th className="pr-4">Debito</th>
                  <th className="pr-4">Credito</th>
                  <th className="pr-4">Funcional</th>
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
                    <td className="border-y border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-[color:var(--color-muted)]">
                      {line.functionalDebit || line.functionalCredit
                        ? formatMoney(line.functionalDebit || line.functionalCredit)
                        : "-"}
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
            <p className="mt-2 text-[color:var(--color-muted)]">
              Moneda: {pageData.derived.journalSuggestion.currencyCode} / funcional {pageData.derived.journalSuggestion.functionalCurrencyCode}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              FX: {pageData.derived.journalSuggestion.fxRate} ({pageData.derived.journalSuggestion.fxRateSource})
              {pageData.derived.journalSuggestion.fxRateDate
                ? ` / ${pageData.derived.journalSuggestion.fxRateDate}`
                : ""}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              Balance funcional: {formatMoney(pageData.derived.journalSuggestion.functionalTotalDebit)} / {formatMoney(pageData.derived.journalSuggestion.functionalTotalCredit)}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--color-muted)]">
            La clasificacion ya no queda acoplada al aprendizaje: primero revisas la sugerencia, despues decides si guardas o no una regla reusable.
          </div>
        </article>

        <RuleApplicationCard explanation={pageData.ruleExplanation} />

        <AccountingImpactPreview preview={pageData.accountingImpactPreview} />

        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Guardar criterio para futuras facturas</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Este bloque es explicito y separado de la confirmacion final.
          </p>

          {pageData.learningSuggestions.options.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {pageData.learningSuggestions.options.map((option) => (
                <button
                  key={option.scope}
                  type="button"
                  onClick={() => {
                    setLearningScope(option.scope);
                    if (!learnedConceptName.trim() && pageData.learningSuggestions.suggestedConceptName) {
                      setLearnedConceptName(pageData.learningSuggestions.suggestedConceptName);
                    }
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    learningScope === option.scope
                      ? "border-transparent bg-[color:var(--color-accent)] text-white"
                      : "border-[color:var(--color-border)] bg-white/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{option.label}</span>
                    {option.recommended ? (
                      <span className="rounded-full bg-black/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em]">
                        recomendado
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-2 leading-6 ${
                    learningScope === option.scope
                      ? "text-white/85"
                      : "text-[color:var(--color-muted)]"
                  }`}>
                    {option.reason}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
              Todavia no hay una clasificacion reusable suficientemente estable para guardar como criterio.
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Nombre canonico para aprendizaje</span>
              <input
                value={learnedConceptName}
                onChange={(event) => {
                  setLearnedConceptName(event.target.value);
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                placeholder={pageData.learningSuggestions.suggestedConceptName ?? "Ej. Servicios administrativos"}
              />
            </label>
            <button
              type="button"
              disabled={!pageData.canSaveLearningRule || learningScope === "none" || isPending}
              onClick={() => {
                runSaveLearningRule();
              }}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} self-end px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingAction === "save_learning" && isPending ? <InlineSpinner /> : null}
              Guardar criterio
            </button>
          </div>
        </article>

        <article className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Confianza y trazabilidad</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--color-muted)]">
            <p>Processing run: {pageData.processingRun ? `${pageData.processingRun.provider_code}:${pageData.processingRun.model_code ?? "sin modelo"}` : "sin run"}</p>
            <p>Instantanea: {pageData.ruleSnapshot ? pageData.ruleSnapshot.id : "sin instantanea"}</p>
            <p>Vendor: {pageData.derived.vendorResolution.vendorName ?? pageData.derived.vendorResolution.status}</p>
            <p>Conceptos: {pageData.derived.conceptResolution.primaryConceptLabels.join(", ") || "sin conceptos normalizados"}</p>
            <p>Confirmaciones: {pageData.confirmations.length}</p>
            <p>Creado: {formatDate(pageData.document.createdAt)}</p>
          </div>

          {pageData.decisionLogs.length > 0 ? (
            <div className="mt-5 space-y-3">
              {pageData.decisionLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{log.runType}</p>
                      <p className="text-[color:var(--color-muted)]">
                        {formatDecisionSource(log.decisionSource)}
                        {log.confidenceScore !== null
                          ? ` / ${Math.round(log.confidenceScore * 100)}%`
                          : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getCertaintyClasses(log.certaintyLevel)}`}>
                      {log.certaintyLevel}
                    </span>
                  </div>
                  {log.rationaleText ? (
                    <p className="mt-3 text-[color:var(--color-muted)]">{log.rationaleText}</p>
                  ) : null}
                  {log.warnings.length > 0 ? (
                    <p className="mt-2 text-amber-900">
                      Warnings: {log.warnings.join(" ")}
                    </p>
                  ) : null}
                  {log.metadata?.rule_id ? (
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      Regla aplicada: {String(log.metadata.rule_id)}
                    </p>
                  ) : null}
                  {log.metadata?.rule_created_at ? (
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      Regla creada: {formatDate(String(log.metadata.rule_created_at))}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

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
