"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import { AccountingImpactPreview } from "@/components/documents/accounting-impact-preview";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { SettlementMethodCard } from "@/components/documents/settlement-method-card";
import { TemplatePreviewCard } from "@/components/documents/template-preview-card";
import type { DocumentReviewPageData } from "@/modules/documents/review";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  formatAccountTypeLabel,
  formatSettlementEvidenceSourceLabel,
} from "@/modules/presentation/labels";

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
      operationKind?: string | null;
      paymentTerms?: "cash" | "credit" | "unknown" | null;
      settlementMethod?: "cash" | "bank_transfer" | "card" | "check" | "mixed" | "unknown" | null;
      settlementEvidenceSource?:
        | "invoice_document"
        | "receipt_document"
        | "bank_statement"
        | "card_settlement_document"
        | "user_input"
        | "imported_erp"
        | "none"
        | null;
    };
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
    accountType: string;
    isProvisional: boolean;
  } | null;
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

export type DocumentReviewWorkspaceProps = {
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

type ReviewAccountOption = DocumentReviewPageData["accountingOptions"]["accounts"][number];

type SectionStatusMap = {
  manualStage1: string;
  accounting: string;
  facts: string;
};

type PendingAction =
  | "stage1"
  | "classify"
  | "post_provisional"
  | "confirm_final"
  | "reopen"
  | null;

const documentRoleOptions: Array<{ value: DocumentRoleCandidate; label: string }> = [
  { value: "purchase", label: "Compra" },
  { value: "sale", label: "Venta" },
  { value: "other", label: "Otro" },
];

const operationKindOptions = [
  { value: "sale_invoice", label: "Factura de venta" },
  { value: "purchase_invoice", label: "Factura de compra" },
  { value: "customer_receipt", label: "Cobranza / recibo" },
  { value: "supplier_payment", label: "Pago a proveedor" },
  { value: "sale_credit_note", label: "Nota de credito de venta" },
  { value: "purchase_credit_note", label: "Nota de credito de compra" },
] as const;

const paymentTermsOptions = [
  { value: "cash", label: "Contado" },
  { value: "credit", label: "Credito" },
  { value: "unknown", label: "Todavia no lo se" },
] as const;

const settlementMethodOptions = [
  { value: "cash", label: "Caja o efectivo" },
  { value: "bank_transfer", label: "Banco o transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "check", label: "Cheque" },
  { value: "unknown", label: "No lo se todavia" },
] as const;

function normalizeAccountType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isAccountCompatibleWithPrimaryRole(
  account: Pick<ReviewAccountOption, "accountType">,
  primaryRole: string | null,
) {
  const accountType = normalizeAccountType(account.accountType);

  switch (primaryRole) {
    case "revenue_account":
      return accountType === "revenue" || accountType === "income";
    case "expense_account":
      return accountType === "expense";
    case "inventory_account":
    case "fixed_asset_account":
      return accountType === "asset";
    default:
      return true;
  }
}

function getPrimaryAccountUiCopy(input: {
  primaryRole: string | null;
  documentRole: DocumentRoleCandidate;
}) {
  switch (input.primaryRole) {
    case "revenue_account":
      return {
        label: "Cuenta principal de ingresos",
        helper:
          "Usa esta cuenta para explicar que se vendio. No elijas caja, banco, clientes ni IVA.",
        emptyState:
          "No hay cuentas de ingresos disponibles. Puedes crear una cuenta nueva de ingresos si hace falta.",
        visibleTypesLabel: "Se muestran solo cuentas de ingresos.",
        createKindLabel: "ingreso",
      };
    case "expense_account":
      return {
        label: "Cuenta principal de gastos",
        helper:
          "Usa esta cuenta para explicar que se compro o gasto. No elijas banco, proveedores ni IVA.",
        emptyState:
          "No hay cuentas de gastos disponibles. Puedes crear una cuenta nueva de gastos si hace falta.",
        visibleTypesLabel: "Se muestran solo cuentas de gastos.",
        createKindLabel: "gasto",
      };
    case "inventory_account":
      return {
        label: "Cuenta principal de inventario",
        helper:
          "Usa esta cuenta cuando el documento corresponde a mercaderia o inventario.",
        emptyState:
          "No hay cuentas de inventario o activo disponibles. Puedes crear una si hace falta.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles.",
        createKindLabel: "activo",
      };
    case "fixed_asset_account":
      return {
        label: "Cuenta principal de activo",
        helper:
          "Usa esta cuenta cuando el documento corresponde a un activo o bien de uso.",
        emptyState:
          "No hay cuentas de activo disponibles. Puedes crear una si hace falta.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles.",
        createKindLabel: "activo",
      };
    default:
      return {
        label: "Cuenta principal",
        helper:
          input.documentRole === "other"
            ? "Solo completa esta cuenta si el documento necesita una clasificacion manual especial."
            : "Usa esta cuenta para clasificar el concepto principal del documento.",
        emptyState: "No hay cuentas disponibles para esta seleccion.",
        visibleTypesLabel: "Se muestran las cuentas disponibles para este caso.",
        createKindLabel: input.documentRole === "sale" ? "ingreso" : "gasto",
      };
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(parsed);
}

function formatMoney(value: number | null | undefined, currency = "UYU") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Sin score";
  }

  return `${Math.round(value * 100)}%`;
}

function formatFxRate(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function getVisibleFxDisplay(input: {
  currencyCode: string | null | undefined;
  fxRate: number | null | undefined;
  fxRateSource: string | null | undefined;
  fxRateDate: string | null | undefined;
  fxBcuValue: number | null | undefined;
  fxBlockingReasons: string[];
  overrideReason: string | null | undefined;
}) {
  const currencyCode = input.currencyCode?.trim().toUpperCase() || "UYU";

  if (currencyCode === "UYU") {
    return {
      valueText: "0",
      detailText: "Factura en pesos uruguayos. No requiere cotizacion BCU.",
      helperText: "No se aplica conversion porque el documento ya esta expresado en UYU.",
    };
  }

  if (input.fxRateSource === "document_default" && input.fxBlockingReasons.length > 0) {
    return {
      valueText: "pendiente",
      detailText: input.fxBlockingReasons[0],
      helperText: "Se recalcula al guardar, usando el ultimo cierre habil previo del BCU.",
    };
  }

  const visibleRate =
    typeof input.fxBcuValue === "number" && Number.isFinite(input.fxBcuValue) && input.fxBcuValue > 0
      ? input.fxBcuValue
      : input.fxRate;

  if (input.fxRateSource === "manual_override") {
    return {
      valueText: formatFxRate(visibleRate),
      detailText: input.overrideReason
        ? `Tipo de cambio manual auditado. Motivo: ${input.overrideReason}`
        : "Tipo de cambio manual auditado.",
      helperText: input.fxRateDate
        ? `Fecha de referencia: ${formatDate(input.fxRateDate)}`
        : "Fecha de referencia pendiente.",
    };
  }

  return {
    valueText: formatFxRate(visibleRate),
    detailText: input.fxRateDate
      ? `Cotizacion BCU del cierre habil del ${formatDate(input.fxRateDate)}.`
      : "Cotizacion BCU aplicada segun el ultimo cierre habil previo.",
    helperText: "Se usa para valuar la factura y los impuestos en pesos uruguayos.",
  };
}

function formatClassificationStatus(value: string) {
  switch (value) {
    case "completed":
      return "Completa";
    case "failed":
      return "Fallida";
    case "stale":
      return "Vencida";
    case "needs_context":
      return "Necesita contexto";
    default:
      return "Pendiente";
  }
}

function formatPostingStatus(value: string | null) {
  switch (value) {
    case "posted_provisional":
      return "Posteado provisional";
    case "posted_final":
      return "Posteado final";
    default:
      return value ?? "Sin posteo";
  }
}

function formatDraftStatus(value: string) {
  switch (value) {
    case "confirmed":
      return "Confirmado";
    case "ready_for_confirmation":
      return "Listo para confirmar";
    case "open":
      return "Abierto";
    default:
      return value.replace(/_/g, " ");
  }
}

function formatNextRecommendedAction(value: string) {
  switch (value) {
    case "process_extraction":
      return "Procesar extraccion";
    case "retry_extraction":
      return "Reintentar extraccion";
    case "open_review":
      return "Abrir revision";
    case "wait":
      return "Esperar";
    default:
      return value.replace(/_/g, " ");
  }
}

function formatConfirmationType(value: string | null | undefined) {
  switch (value) {
    case "final":
      return "Confirmacion final";
    case "reconfirmation":
      return "Reconfirmacion";
    default:
      return value ? value.replace(/_/g, " ") : "Confirmacion";
  }
}

function toEditableFacts(facts: DocumentIntakeFactMap) {
  return {
    issuer_name: facts.issuer_name ?? "",
    issuer_tax_id: facts.issuer_tax_id ?? "",
    document_number: facts.document_number ?? "",
    series: facts.series ?? "",
    document_date: facts.document_date ?? "",
    subtotal: facts.subtotal?.toString() ?? "",
    tax_amount: facts.tax_amount?.toString() ?? "",
    total_amount: facts.total_amount?.toString() ?? "",
  };
}

function isManualClassificationRequired(pageData: DocumentReviewPageData) {
  return ["failed", "stale", "needs_context"].includes(
    pageData.workflowState.classificationStatus,
  );
}

function isSettlementContextRequired(pageData: DocumentReviewPageData) {
  return pageData.derived.settlementContext.blockers.length > 0;
}

function buildBlockingMessage(blockers: string[]) {
  return blockers.join(" ") || "No se pudo completar la accion.";
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

export function DocumentReviewStagedWorkspace(props: DocumentReviewWorkspaceProps) {
  const {
    pageData,
    saveDraftReviewAction,
    postProvisionalDocumentAction,
    confirmFinalDocumentAction,
    createReviewAccountAction,
    resolveDuplicateAction,
    runClassificationAction,
    reopenDocumentAction,
  } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const startsConfirmedReview =
    pageData.draft.status === "confirmed" || pageData.document.postingStatus === "posted_final";
  const startsReopenedReview = pageData.document.status === "classified_with_open_revision";
  const startsWithForcedManualFlow =
    startsReopenedReview
    || isManualClassificationRequired(pageData)
    || isSettlementContextRequired(pageData);
  const [identity, setIdentity] = useState({
    documentRole: pageData.draft.documentRole,
    documentType: pageData.draft.documentType,
  });
  const [operationCategory, setOperationCategory] = useState(
    pageData.draft.operationCategory ?? "",
  );
  const [facts, setFacts] = useState(() => toEditableFacts(pageData.draft.facts));
  const [accountingContext, setAccountingContext] = useState({
    userFreeText: pageData.derived.accountingContext.userFreeText ?? "",
    businessPurposeNote: pageData.derived.accountingContext.businessPurposeNote
      ?? pageData.derived.taxTreatment.businessPurposeNote
      ?? "",
    manualOverrideAccountId:
      pageData.derived.accountingContext.manualOverrideAccountId ?? "",
    operationKind:
      pageData.derived.accountingContext.operationKind
      ?? pageData.derived.settlementContext.operationKind
      ?? "",
    paymentTerms:
      pageData.derived.accountingContext.paymentTerms
      ?? pageData.derived.settlementContext.paymentTerms,
    settlementMethod:
      pageData.derived.accountingContext.settlementMethod
      ?? pageData.derived.settlementContext.settlementMethod,
    settlementEvidenceSource:
      pageData.derived.accountingContext.settlementEvidenceSource
      ?? pageData.derived.settlementContext.settlementEvidenceSource,
  });
  const [availableAccounts, setAvailableAccounts] = useState(
    pageData.accountingOptions.accounts,
  );
  const [newReviewAccount, setNewReviewAccount] = useState({
    code: "",
    name: "",
  });
  const [sectionStatus, setSectionStatus] = useState<SectionStatusMap>({
    manualStage1: "",
    accounting: "",
    facts: "",
  });
  const [actionMessage, setActionMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingDuplicateAction, setPendingDuplicateAction] = useState<
    "confirmed_duplicate" | "false_positive" | "justified_non_duplicate" | null
  >(null);
  const [pendingInlineAction, setPendingInlineAction] = useState<"create_account" | null>(null);
  const [duplicateNote, setDuplicateNote] = useState("");
  const [showManualFlow, setShowManualFlow] = useState(
    startsConfirmedReview ? false : startsWithForcedManualFlow,
  );
  const [manualStage, setManualStage] = useState<1 | 2>(
    startsReopenedReview ? 2 : 1,
  );
  const [showCreateAccountStage, setShowCreateAccountStage] = useState(false);

  useEffect(() => {
    setIdentity({
      documentRole: pageData.draft.documentRole,
      documentType: pageData.draft.documentType,
    });
    setOperationCategory(pageData.draft.operationCategory ?? "");
    setFacts(toEditableFacts(pageData.draft.facts));
    setAccountingContext({
      userFreeText: pageData.derived.accountingContext.userFreeText ?? "",
      businessPurposeNote: pageData.derived.accountingContext.businessPurposeNote
        ?? pageData.derived.taxTreatment.businessPurposeNote
        ?? "",
      manualOverrideAccountId:
        pageData.derived.accountingContext.manualOverrideAccountId ?? "",
      operationKind:
        pageData.derived.accountingContext.operationKind
        ?? pageData.derived.settlementContext.operationKind
        ?? "",
      paymentTerms:
        pageData.derived.accountingContext.paymentTerms
        ?? pageData.derived.settlementContext.paymentTerms,
      settlementMethod:
        pageData.derived.accountingContext.settlementMethod
        ?? pageData.derived.settlementContext.settlementMethod,
      settlementEvidenceSource:
        pageData.derived.accountingContext.settlementEvidenceSource
        ?? pageData.derived.settlementContext.settlementEvidenceSource,
    });
    setAvailableAccounts(pageData.accountingOptions.accounts);
    if (pageData.draft.status === "confirmed" || pageData.document.postingStatus === "posted_final") {
      setShowManualFlow(false);
      setShowCreateAccountStage(false);
    } else if (
      pageData.document.status === "classified_with_open_revision"
      || isManualClassificationRequired(pageData)
      || isSettlementContextRequired(pageData)
    ) {
      setShowManualFlow(true);
      if (pageData.document.status === "classified_with_open_revision") {
        setManualStage(2);
      }
    }
  }, [pageData]);

  function buildAccountingContextPayload(nextAccountingContext = accountingContext) {
    return {
      accountingContext: {
        userFreeText: nextAccountingContext.userFreeText || null,
        businessPurposeNote: nextAccountingContext.businessPurposeNote || null,
        manualOverrideAccountId:
          nextAccountingContext.manualOverrideAccountId || null,
        operationKind: nextAccountingContext.operationKind || null,
        paymentTerms: nextAccountingContext.paymentTerms || null,
        settlementMethod:
          nextAccountingContext.paymentTerms === "credit"
            ? "unknown"
            : nextAccountingContext.settlementMethod || null,
        settlementEvidenceSource:
          nextAccountingContext.settlementEvidenceSource || null,
      },
    };
  }

  function buildFactPayload() {
    return {
      issuer_name: facts.issuer_name.trim() || null,
      issuer_tax_id: facts.issuer_tax_id.trim() || null,
      document_number: facts.document_number.trim() || null,
      series: facts.series.trim() || null,
      document_date: facts.document_date.trim() || null,
      subtotal: parseOptionalNumber(facts.subtotal),
      tax_amount: parseOptionalNumber(facts.tax_amount),
      total_amount: parseOptionalNumber(facts.total_amount),
    } satisfies Partial<Record<keyof DocumentIntakeFactMap, string | number | null>>;
  }

  function runSaveStageOne(continueToStageTwo: boolean) {
    setPendingAction("stage1");
    setSectionStatus((current) => ({
      ...current,
      manualStage1: "Guardando etapa 1...",
    }));
    setActionMessage("");
    startTransition(async () => {
      try {
        const identityResult = await saveDraftReviewAction({
          stepCode: "identity",
          payload: {
            documentRole: identity.documentRole,
            documentType: identity.documentType.trim(),
          },
        });
        if (!identityResult.ok) {
          const message = buildBlockingMessage(identityResult.blockers);
          setSectionStatus((current) => ({ ...current, manualStage1: message }));
          setActionMessage(message);
          return;
        }
        const operationResult = await saveDraftReviewAction({
          stepCode: "operation_context",
          payload: {
            operationCategory: operationCategory || null,
          },
        });
        if (!operationResult.ok) {
          const message = buildBlockingMessage(operationResult.blockers);
          setSectionStatus((current) => ({ ...current, manualStage1: message }));
          setActionMessage(message);
          return;
        }
        const contextResult = await saveDraftReviewAction({
          stepCode: "accounting_context",
          payload: buildAccountingContextPayload(),
        });
        if (!contextResult.ok) {
          const message = buildBlockingMessage(contextResult.blockers);
          setSectionStatus((current) => ({ ...current, manualStage1: message }));
          setActionMessage(message);
          return;
        }
        const message = continueToStageTwo
          ? "Etapa 1 guardada. Ya puedes pasar a la asignacion contable."
          : "Etapa 1 guardada.";
        setSectionStatus((current) => ({ ...current, manualStage1: message }));
        setActionMessage(message);
        if (continueToStageTwo) {
          setManualStage(2);
        }
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al guardar la etapa 1.";
        setSectionStatus((current) => ({ ...current, manualStage1: message }));
        setActionMessage(message);
      } finally {
        setPendingAction(null);
      }
    });
  }

  function runSaveFacts() {
    setSectionStatus((current) => ({
      ...current,
      facts: "Guardando datos extraidos...",
    }));
    setActionMessage("");
    startTransition(async () => {
      try {
        const result = await saveDraftReviewAction({
          stepCode: "fields",
          payload: {
            facts: buildFactPayload(),
          },
        });
        const message = result.ok
          ? "Datos extraidos guardados."
          : buildBlockingMessage(result.blockers);
        setSectionStatus((current) => ({ ...current, facts: message }));
        setActionMessage(message);
        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al guardar los datos.";
        setSectionStatus((current) => ({ ...current, facts: message }));
        setActionMessage(message);
      }
    });
  }

  function runSaveAccounting() {
    if (selectedAccountIncompatible && selectedAccount && selectedAccountTypeLabel) {
      const message =
        `La cuenta elegida (${selectedAccountLabel}) es de tipo ${selectedAccountTypeLabel.toLowerCase()} `
        + `y no sirve como ${primaryAccountUi.label.toLowerCase()}.`;
      setSectionStatus((current) => ({
        ...current,
        accounting: message,
      }));
      setActionMessage(message);
      return;
    }

    setSectionStatus((current) => ({
      ...current,
      accounting: "Guardando asignacion...",
    }));
    setActionMessage("");
    startTransition(async () => {
      try {
        const result = await saveDraftReviewAction({
          stepCode: "accounting_context",
          payload: buildAccountingContextPayload(),
        });
        const message = result.ok
          ? "Asignacion guardada."
          : buildBlockingMessage(result.blockers);
        setSectionStatus((current) => ({ ...current, accounting: message }));
        setActionMessage(message);
        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al guardar la asignacion.";
        setSectionStatus((current) => ({ ...current, accounting: message }));
        setActionMessage(message);
      }
    });
  }

  function runSimpleAction(
    actionKey: "reopen" | "post_provisional" | "confirm_final" | "classify",
    action: () => Promise<{ ok: boolean; message: string }>,
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

  function runConfirmFinal() {
    runSimpleAction("confirm_final", () =>
      confirmFinalDocumentAction({
        learning: {
          scope: "none",
          learnedConceptName: null,
        },
      })
    );
  }

  function runCreateAccount() {
    const code = newReviewAccount.code.trim();
    const name = newReviewAccount.name.trim();

    if (!code || !name) {
      setSectionStatus((current) => ({
        ...current,
        accounting: "Completa codigo y nombre para crear la cuenta.",
      }));
      return;
    }

    setPendingInlineAction("create_account");
    setSectionStatus((current) => ({
      ...current,
      accounting: "Creando cuenta y aplicandola...",
    }));
    startTransition(async () => {
      try {
        const created = await createReviewAccountAction({ code, name });
        if (!created.ok || !created.account) {
          const message = created.message || "No se pudo crear la cuenta.";
          setSectionStatus((current) => ({ ...current, accounting: message }));
          setActionMessage(message);
          return;
        }
        const nextAccounts = [...availableAccounts, created.account].sort((left, right) =>
          left.code.localeCompare(right.code, "es", { numeric: true, sensitivity: "base" })
        );
        const nextAccountingContext = {
          ...accountingContext,
          manualOverrideAccountId: created.account.id,
        };
        setAvailableAccounts(nextAccounts);
        setAccountingContext(nextAccountingContext);
        setNewReviewAccount({ code: "", name: "" });
        setShowCreateAccountStage(false);
        const saved = await saveDraftReviewAction({
          stepCode: "accounting_context",
          payload: buildAccountingContextPayload(nextAccountingContext),
        });
        const message = saved.ok
          ? "Cuenta creada y asignada al documento."
          : buildBlockingMessage(saved.blockers);
        setSectionStatus((current) => ({ ...current, accounting: message }));
        setActionMessage(message);
        if (saved.ok) {
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al crear la cuenta.";
        setSectionStatus((current) => ({ ...current, accounting: message }));
        setActionMessage(message);
      } finally {
        setPendingInlineAction(null);
      }
    });
  }

  function runDuplicateResolution(
    action: "confirmed_duplicate" | "false_positive" | "justified_non_duplicate",
  ) {
    setPendingDuplicateAction(action);
    setActionMessage("Guardando decision sobre duplicado...");
    startTransition(async () => {
      try {
        const result = await resolveDuplicateAction({
          action,
          note: duplicateNote.trim() || null,
        });
        setActionMessage(result.message);
        if (result.ok) {
          setDuplicateNote("");
          router.refresh();
        }
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Error inesperado.");
      } finally {
        setPendingDuplicateAction(null);
      }
    });
  }

  const classificationRequired = isManualClassificationRequired(pageData);
  const duplicateStatus = pageData.derived.invoiceIdentity?.duplicateStatus ?? "clear";
  const primaryAccountRole = pageData.derived.settlementContext.primaryAccountRole ?? null;
  const primaryAccountUi = getPrimaryAccountUiCopy({
    primaryRole: primaryAccountRole,
    documentRole: pageData.draft.documentRole,
  });
  const compatibleAccounts = availableAccounts.filter((account) =>
    isAccountCompatibleWithPrimaryRole(account, primaryAccountRole),
  );
  const selectedAccount = availableAccounts.find((account) =>
    account.id === accountingContext.manualOverrideAccountId
  );
  const selectedAccountIncompatible = Boolean(
    selectedAccount && !isAccountCompatibleWithPrimaryRole(selectedAccount, primaryAccountRole),
  );
  const selectedAccountLabel = selectedAccount
    ? `${selectedAccount.code} - ${selectedAccount.name}`
    : pageData.derived.appliedRule.accountCode || pageData.derived.appliedRule.accountName
      ? `${pageData.derived.appliedRule.accountCode ?? "--"} - ${pageData.derived.appliedRule.accountName ?? "Cuenta sugerida"}`
      : "Sin cuenta sugerida";
  const editableTotalAmount = parseOptionalNumber(facts.total_amount);
  const totalLabel = editableTotalAmount !== null
    ? formatMoney(
      editableTotalAmount,
      pageData.draft.facts.currency_code
        ?? pageData.derived.monetarySnapshot?.currencyCode
        ?? "UYU",
    )
    : typeof pageData.draft.facts.total_amount === "number"
      ? formatMoney(
        pageData.draft.facts.total_amount,
        pageData.draft.facts.currency_code ?? "UYU",
      )
      : formatMoney(pageData.derived.taxTreatment.totalAmountUyu);
  const visibleFx = getVisibleFxDisplay({
    currencyCode:
      pageData.derived.monetarySnapshot?.currencyCode
      ?? pageData.draft.facts.currency_code
      ?? pageData.derived.journalSuggestion.currencyCode,
    fxRate: pageData.derived.journalSuggestion.fxRate,
    fxRateSource:
      pageData.derived.monetarySnapshot?.fx.source
      ?? pageData.derived.journalSuggestion.fxRateSource,
    fxRateDate:
      pageData.derived.journalSuggestion.fxRateBcuDateUsed
      ?? pageData.derived.journalSuggestion.fxRateDate
      ?? pageData.derived.monetarySnapshot?.fx.bcuDateUsed
      ?? pageData.derived.monetarySnapshot?.fx.documentDate
      ?? null,
    fxBcuValue:
      pageData.derived.journalSuggestion.fxRateBcuValue
      ?? pageData.derived.monetarySnapshot?.fx.bcuValue
      ?? null,
    fxBlockingReasons: pageData.derived.monetarySnapshot?.fx.blockingReasons ?? [],
    overrideReason: pageData.derived.monetarySnapshot?.fx.overrideReason ?? null,
  });
  const selectedAccountTypeLabel = selectedAccount
    ? formatAccountTypeLabel(selectedAccount.accountType)
    : null;
  const isConfirmedReview =
    pageData.draft.status === "confirmed" || pageData.document.postingStatus === "posted_final";
  const latestConfirmation = pageData.confirmations[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
              Revision {pageData.draft.revisionNumber}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
              {pageData.document.originalFilename}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {isConfirmedReview
                ? "La revision ya fue confirmada. Debajo ves el resumen final del proceso y el asiento resultante."
                : "Flujo corto: clasificacion automatica, contexto manual si hace falta, asignacion contable y cierre."}
            </p>
          </div>
          <DocumentOriginalModalTrigger
            previewUrl={pageData.document.previewUrl}
            mimeType={pageData.document.mimeType}
            originalFilename={pageData.document.originalFilename}
            triggerLabel="Ver documento original"
            triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
            modalTitle={pageData.document.originalFilename}
            modalDescription="Archivo original subido por el usuario."
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
            <p className="font-semibold">Documento</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {documentRoleOptions.find((option) => option.value === pageData.draft.documentRole)?.label}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              {pageData.draft.documentType || "Tipo pendiente"}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
            <p className="font-semibold">Monto</p>
            <p className="mt-2 text-[color:var(--color-muted)]">{totalLabel}</p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              Fecha {formatDate(facts.document_date || pageData.document.documentDate)}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              Tipo de cambio: {visibleFx.valueText}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">{visibleFx.detailText}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 text-sm">
            <p className="font-semibold">Posteo</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {formatPostingStatus(pageData.document.postingStatus)}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              {isConfirmedReview
                ? "Revision cerrada"
                : formatNextRecommendedAction(pageData.workflowState.nextRecommendedAction)}
            </p>
          </div>
        </div>

        {actionMessage ? (
          <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--color-muted)]">
            {actionMessage}
          </div>
        ) : null}
      </section>

      {!isConfirmedReview && duplicateStatus !== "clear" ? (
        <section className="panel border-rose-200 bg-rose-50/70 p-6">
          <p className="text-sm font-semibold text-rose-900">
            Posible duplicado: {duplicateStatus.replace(/_/g, " ")}
          </p>
          <textarea
            value={duplicateNote}
            onChange={(event) => {
              setDuplicateNote(event.target.value);
            }}
            className="mt-4 min-h-24 w-full rounded-2xl border border-rose-200 bg-white/90 px-4 py-3 text-sm"
            placeholder="Nota de revision"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runDuplicateResolution("confirmed_duplicate");
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingDuplicateAction === "confirmed_duplicate" && isPending ? <InlineSpinner /> : null}
              Confirmar duplicado
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runDuplicateResolution("false_positive");
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingDuplicateAction === "false_positive" && isPending ? <InlineSpinner /> : null}
              Falso positivo
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runDuplicateResolution("justified_non_duplicate");
              }}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingDuplicateAction === "justified_non_duplicate" && isPending ? <InlineSpinner /> : null}
              Justificar y seguir
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
          {isConfirmedReview ? "Resumen" : "Etapa inicial"}
        </p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.05em]">
              {isConfirmedReview ? "Clasificacion resuelta" : "Clasificacion automatica"}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {isConfirmedReview
                ? "La clasificacion quedo cerrada como parte de la confirmacion final. Si necesitas cambiar algo, reabre la revision."
                : pageData.classificationActionHint}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-900">
            {formatClassificationStatus(pageData.workflowState.classificationStatus)}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">
                {isConfirmedReview ? "Cuenta principal confirmada" : "Cuenta principal sugerida"}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">{selectedAccountLabel}</p>
            </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">Confianza</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {formatPercentage(
                pageData.latestClassificationRun?.confidence
                ?? pageData.derived.assistantSuggestion.confidence,
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
            <p className="font-semibold">Ultimo intento</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {pageData.latestClassificationRun
                ? formatDate(pageData.latestClassificationRun.createdAt)
                : "Sin corridas"}
            </p>
          </div>
        </div>

        {!isConfirmedReview ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!pageData.canRunClassification || isPending}
              onClick={() => {
                runSimpleAction("classify", runClassificationAction);
              }}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingAction === "classify" && isPending ? <InlineSpinner /> : null}
              {classificationRequired ? "Reintentar clasificacion" : "Ejecutar clasificacion"}
            </button>
            {!showManualFlow ? (
              <button
                type="button"
                onClick={() => {
                  setShowManualFlow(true);
                  setManualStage(1);
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
              >
                {pageData.workflowState.classificationStatus === "completed"
                  ? "Ajustar manualmente"
                  : "Abrir clasificacion manual"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {!isConfirmedReview && showManualFlow ? (
        <section className="panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Etapa 1
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            Operacion y cobro/pago
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Primero definimos la operacion, si es contado o credito y, cuando hace falta, el medio real de cobro o pago.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Rol documental</span>
              <select
                value={identity.documentRole}
                onChange={(event) => {
                  setIdentity((current) => ({
                    ...current,
                    documentRole: event.target.value as DocumentRoleCandidate,
                  }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                {documentRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                placeholder="Ej. Factura, nota de credito, recibo"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Categoria operativa</span>
              <select
                value={operationCategory}
                onChange={(event) => {
                  setOperationCategory(event.target.value);
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
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Operacion contable</span>
              <select
                value={accountingContext.operationKind}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    operationKind: event.target.value,
                  }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                <option value="">Selecciona una operacion</option>
                {operationKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Condicion</span>
              <select
                value={accountingContext.paymentTerms}
                onChange={(event) => {
                  const nextPaymentTerms = event.target.value as "cash" | "credit" | "unknown";
                  setAccountingContext((current) => ({
                    ...current,
                    paymentTerms: nextPaymentTerms,
                    settlementMethod:
                      nextPaymentTerms === "credit"
                        ? "unknown"
                        : current.settlementMethod,
                  }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
              >
                {paymentTermsOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {accountingContext.paymentTerms !== "credit" ? (
              <label className="space-y-2 text-sm">
                <span className="font-medium">Medio de cobro/pago</span>
                <select
                  value={accountingContext.settlementMethod}
                  onChange={(event) => {
                    setAccountingContext((current) => ({
                      ...current,
                      settlementMethod: event.target.value as
                        | "cash"
                        | "bank_transfer"
                        | "card"
                        | "check"
                        | "mixed"
                        | "unknown",
                    }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3"
                >
                  {settlementMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/50 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                En operaciones a credito, el medio real de cobro o pago se registra despues.
              </div>
            )}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3 text-sm">
              <p className="font-medium">Fuente de evidencia</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatSettlementEvidenceSourceLabel(accountingContext.settlementEvidenceSource || "none")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TemplatePreviewCard
              templateCode={pageData.derived.settlementContext.templateCode}
              operationKind={pageData.derived.settlementContext.operationKind}
              explanation={pageData.derived.journalSuggestion.explanation}
              requiresFollowupSettlement={pageData.derived.settlementContext.requiresFollowupSettlement}
            />
            <SettlementMethodCard
              paymentTerms={pageData.derived.settlementContext.paymentTerms}
              settlementMethod={pageData.derived.settlementContext.settlementMethod}
              settlementEvidenceSource={pageData.derived.settlementContext.settlementEvidenceSource}
              requiresFollowupSettlement={pageData.derived.settlementContext.requiresFollowupSettlement}
              warning={pageData.derived.settlementContext.warnings[0] ?? null}
            />
          </div>

          <div className="mt-5 grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Contexto del documento</span>
              <textarea
                value={accountingContext.userFreeText}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    userFreeText: event.target.value,
                  }));
                }}
                className="min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                placeholder="Explica que es este documento y a que operacion del negocio pertenece."
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">
                Justificacion empresarial
                {pageData.derived.taxTreatment.requiresUserJustification ? " *" : ""}
              </span>
              <textarea
                value={accountingContext.businessPurposeNote}
                onChange={(event) => {
                  setAccountingContext((current) => ({
                    ...current,
                    businessPurposeNote: event.target.value,
                  }));
                }}
                className="min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm"
                placeholder="Solo si hace falta, explica por que corresponde al negocio."
              />
            </label>
          </div>

          {sectionStatus.manualStage1 ? (
            <p className="mt-4 text-sm text-[color:var(--color-muted)]">
              {sectionStatus.manualStage1}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runSaveStageOne(false);
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingAction === "stage1" && isPending ? <InlineSpinner /> : null}
              Guardar etapa 1
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runSaveStageOne(true);
              }}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingAction === "stage1" && isPending ? <InlineSpinner /> : null}
              Guardar y seguir a etapa 2
            </button>
          </div>

          <details className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-white/55 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Corregir datos extraidos
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Emisor</span>
                <input
                  value={facts.issuer_name}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, issuer_name: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">RUT emisor</span>
                <input
                  value={facts.issuer_tax_id}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, issuer_tax_id: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Numero</span>
                <input
                  value={facts.document_number}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, document_number: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Serie</span>
                <input
                  value={facts.series}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, series: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Fecha</span>
                <input
                  value={facts.document_date}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, document_date: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Subtotal</span>
                <input
                  value={facts.subtotal}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, subtotal: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">IVA</span>
                <input
                  value={facts.tax_amount}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, tax_amount: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Total</span>
                <input
                  value={facts.total_amount}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, total_amount: event.target.value }));
                  }}
                  className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                />
              </label>
            </div>
            <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Valuacion fiscal del monto</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Tipo de cambio: {visibleFx.valueText}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">{visibleFx.detailText}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">{visibleFx.helperText}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Total valorizado en UYU: {formatMoney(pageData.derived.monetarySnapshot?.totalAmountUyu ?? pageData.derived.taxTreatment.totalAmountUyu)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Si cambias la fecha del documento, este dato se recalcula al guardar los datos extraidos.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  runSaveFacts();
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
              >
                Guardar datos extraidos
              </button>
            </div>
            {sectionStatus.facts ? (
              <p className="mt-4 text-sm text-[color:var(--color-muted)]">{sectionStatus.facts}</p>
            ) : null}
          </details>
        </section>
      ) : null}

      {!isConfirmedReview && showManualFlow && manualStage >= 2 ? (
        <section className="panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Etapa 2
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            Cuenta principal y vista previa
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            La cuenta principal alimenta la plantilla. El asiento completo se genera abajo con multiples lineas.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TemplatePreviewCard
              templateCode={pageData.derived.settlementContext.templateCode}
              operationKind={pageData.derived.settlementContext.operationKind}
              explanation={pageData.derived.journalSuggestion.explanation}
              requiresFollowupSettlement={pageData.derived.settlementContext.requiresFollowupSettlement}
            />
            <SettlementMethodCard
              paymentTerms={pageData.derived.settlementContext.paymentTerms}
              settlementMethod={pageData.derived.settlementContext.settlementMethod}
              settlementEvidenceSource={pageData.derived.settlementContext.settlementEvidenceSource}
              requiresFollowupSettlement={pageData.derived.settlementContext.requiresFollowupSettlement}
              warning={pageData.derived.settlementContext.warnings[0] ?? null}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Cuenta principal actual</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{selectedAccountLabel}</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {primaryAccountUi.helper}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">{primaryAccountUi.visibleTypesLabel}</p>
            </div>
            <div className="space-y-2 text-sm">
              <span className="font-medium">{primaryAccountUi.label}</span>
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
                <option value="">Usar sugerencia actual</option>
                {selectedAccountIncompatible && selectedAccount ? (
                  <option value={selectedAccount.id}>
                    Cuenta incompatible: {selectedAccount.code} - {selectedAccount.name}
                  </option>
                ) : null}
                {compatibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                    {account.isProvisional ? " (provisoria)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[color:var(--color-muted)]">{primaryAccountUi.helper}</p>
              {selectedAccountIncompatible && selectedAccountTypeLabel ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  La cuenta elegida actualmente ({selectedAccountLabel}) es de tipo {selectedAccountTypeLabel.toLowerCase()}
                  {" "}y no puede usarse como {primaryAccountUi.label.toLowerCase()}.
                </div>
              ) : null}
              {compatibleAccounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                  {primaryAccountUi.emptyState}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <AccountingImpactPreview preview={pageData.accountingImpactPreview} />
          </div>

          {sectionStatus.accounting ? (
            <p className="mt-4 text-sm text-[color:var(--color-muted)]">
              {sectionStatus.accounting}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runSaveAccounting();
              }}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              Guardar asignacion
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateAccountStage(true);
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
            >
              No encuentro la cuenta correcta
            </button>
            {pageData.canRunClassification ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  runSimpleAction("classify", runClassificationAction);
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "classify" && isPending ? <InlineSpinner /> : null}
                Aplicar clasificacion con este contexto
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isConfirmedReview && showManualFlow && showCreateAccountStage ? (
        <section className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Crear cuenta nueva</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Paso excepcional para evitar un zoologico contable. Solo abre esta opcion si no existe la cuenta correcta.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Codigo</span>
              <input
                value={newReviewAccount.code}
                onChange={(event) => {
                  setNewReviewAccount((current) => ({ ...current, code: event.target.value }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                placeholder={pageData.draft.documentRole === "sale" ? "Ej. 4105" : "Ej. 6105"}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Nombre</span>
              <input
                value={newReviewAccount.name}
                onChange={(event) => {
                  setNewReviewAccount((current) => ({ ...current, name: event.target.value }));
                }}
                className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/90 px-4 py-3"
                placeholder="Nombre de la cuenta"
              />
            </label>
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            La cuenta se crea como cuenta postable de {primaryAccountUi.createKindLabel} y se usa solo en esta revision.
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runCreateAccount();
              }}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingInlineAction === "create_account" && isPending ? <InlineSpinner /> : null}
              Crear cuenta y usarla
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateAccountStage(false);
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
            >
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {isConfirmedReview ? (
        <section className="panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Resultado final
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            Documento confirmado
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Este documento ya fue cerrado contable y fiscalmente para esta revision. Debajo ves el asiento final y el contexto con el que quedo confirmado.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Estado final</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatPostingStatus(pageData.document.postingStatus)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Draft {formatDraftStatus(pageData.draft.status)}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Ultima confirmacion</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {latestConfirmation ? formatConfirmationType(latestConfirmation.type) : "Confirmacion registrada"}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                {latestConfirmation
                  ? `${formatDate(latestConfirmation.confirmedAt)} por ${latestConfirmation.confirmedBy}`
                  : "Sin detalle disponible"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
              <p className="font-semibold">Cuenta principal final</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{selectedAccountLabel}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                {primaryAccountUi.label}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TemplatePreviewCard
              templateCode={pageData.derived.settlementContext.templateCode}
              operationKind={pageData.derived.settlementContext.operationKind}
              explanation={pageData.derived.journalSuggestion.explanation}
              requiresFollowupSettlement={pageData.derived.settlementContext.requiresFollowupSettlement}
            />
            <SettlementMethodCard
              paymentTerms={pageData.derived.settlementContext.paymentTerms}
              settlementMethod={pageData.derived.settlementContext.settlementMethod}
              settlementEvidenceSource={pageData.derived.settlementContext.settlementEvidenceSource}
              requiresFollowupSettlement={pageData.derived.settlementContext.requiresFollowupSettlement}
              warning={pageData.derived.settlementContext.warnings[0] ?? null}
            />
          </div>

          <div className="mt-5">
            <AccountingImpactPreview preview={pageData.accountingImpactPreview} />
          </div>
        </section>
      ) : null}

      <section className="panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
          {isConfirmedReview ? "Revision cerrada" : "Cierre"}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
          {isConfirmedReview ? "Acciones disponibles" : "Siguiente paso del documento"}
        </h3>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
          {isConfirmedReview
            ? "La revision ya fue confirmada. Si necesitas volver a editar etapas o reasignar cuentas, primero reabre la revision."
            : "Solo cuando la clasificacion queda resuelta seguimos con posteo, confirmacion o reapertura."}
        </p>
        {!isConfirmedReview && pageData.derived.validation.blockers.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
            {pageData.derived.validation.blockers.join(" ")}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {!isConfirmedReview ? (
            <>
              <button
                type="button"
                disabled={!pageData.canPostProvisional || isPending}
                onClick={() => {
                  runSimpleAction("post_provisional", postProvisionalDocumentAction);
                }}
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "post_provisional" && isPending ? <InlineSpinner /> : null}
                Postear provisional
              </button>
              <button
                type="button"
                disabled={!pageData.canConfirmFinal || isPending}
                onClick={() => {
                  runConfirmFinal();
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "confirm_final" && isPending ? <InlineSpinner /> : null}
                Confirmar final
              </button>
            </>
          ) : null}
          {pageData.canReopen ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                runSimpleAction("reopen", reopenDocumentAction);
              }}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
            >
              {pendingAction === "reopen" && isPending ? <InlineSpinner /> : null}
              Reabrir revision
            </button>
          ) : null}
        </div>

        <details className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-white/55 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Texto extraido y detalle tecnico</summary>
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
            {pageData.draft.extractedText || "Sin texto extraido."}
          </pre>
        </details>
      </section>
    </div>
  );
}
