"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import { AccountingImpactPreview } from "@/components/documents/accounting-impact-preview";
import { DocumentAccountingAssistantRail } from "@/components/documents/document-accounting-assistant-rail";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import { RuleApplicationCard } from "@/components/documents/rule-application-card";
import { SettlementMethodCard } from "@/components/documents/settlement-method-card";
import { TemplatePreviewCard } from "@/components/documents/template-preview-card";
import { AccountingTemplateCard } from "@/components/mobile/accounting-template-card";
import { CTAButton } from "@/components/mobile/cta-button";
import { MobileWizard } from "@/components/mobile/mobile-wizard";
import { StatusBadge } from "@/components/mobile/status-badge";
import type {
  AccountRoleCode,
  ApprovalLearningInput,
  ManualAccountRoleOverrides,
} from "@/modules/accounting";
import { getJournalTemplateByCode } from "@/modules/accounting/journal-templates";
import type { DocumentReviewPageData } from "@/modules/documents/review";
import {
  buildDocumentOperationalHeaderView,
} from "@/modules/presentation/document-decision-view";
import { buildDocumentReviewGuidedRoute } from "@/modules/presentation/document-review-guided-route";
import { formatLaunchSupportLevelLabel } from "@/modules/launch/scope";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { LoadingLink } from "@/components/ui/loading-link";
import {
  formatAccountRoleCodeLabel,
  formatAccountTypeLabel,
  formatDocumentRoleLabel,
  formatOperationKindLabel,
  formatPaymentTermsLabel,
  formatPostingTemplateCodeLabel,
  formatSettlementEvidenceSourceLabel,
  formatSettlementMethodLabel,
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
      manualRoleOverrides?: ManualAccountRoleOverrides | null;
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

type SaveLearningRuleAction = (input: {
  learning: ApprovalLearningInput;
}) => Promise<{
  ok: boolean;
  message: string;
  ruleId: string | null;
}>;

type ResolveAssistantSuggestionAction = (input: {
  suggestionId: string;
  resolutionStatus: "accepted" | "rejected" | "edited";
  execute?: boolean;
  resolutionComment?: string | null;
}) => Promise<{
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

type ConfirmManualAssignmentAction = (input: {
  manualRoleOverrides?: ManualAccountRoleOverrides | null;
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
  account: ReviewAccountOption | null;
}>;

type ResolveDuplicateAction = (input: {
  action: "confirmed_duplicate" | "false_positive" | "justified_non_duplicate";
  note: string | null;
}) => Promise<{
  ok: boolean;
  message: string;
}>;

export type DocumentReviewWorkspaceProps = {
  pageData: DocumentReviewPageData;
  saveDraftReviewAction: SaveDraftReviewAction;
  postProvisionalDocumentAction: ReviewSimpleAction;
  confirmFinalDocumentAction: ConfirmFinalDocumentAction;
  confirmManualAssignmentAction: ConfirmManualAssignmentAction;
  createReviewAccountAction: CreateReviewAccountAction;
  saveLearningRuleAction: SaveLearningRuleAction;
  resolveDuplicateAction: ResolveDuplicateAction;
  runClassificationAction: ReviewSimpleAction;
  reopenDocumentAction: ReviewSimpleAction;
  refreshAssistantAction: ReviewSimpleAction;
  resolveAssistantSuggestionAction: ResolveAssistantSuggestionAction;
};

type ReviewAccountOption = DocumentReviewPageData["accountingOptions"]["accounts"][number];
type ReviewManualRoleOverrides = Partial<Record<AccountRoleCode, string>>;

type SectionStatusMap = {
  manualStage1: string;
  accounting: string;
  facts: string;
};

type PendingAction =
  | "stage1"
  | "classify"
  | "confirm_manual_assignment"
  | "post_provisional"
  | "confirm_final"
  | "save_learning"
  | "reopen"
  | null;

const surfaceCardClassName = "border border-[color:var(--color-border)] surface-card-dark";
const surfaceCardSoftClassName = "border border-[color:var(--color-border)] surface-card-dark-soft";
const surfaceCardSubtleClassName = "border border-[color:var(--color-border)] surface-card-dark-subtle";
const dashedSurfaceCardClassName =
  "border border-dashed border-[color:var(--color-border)] surface-card-dark-subtle";
const inputSurfaceClassName =
  "w-full rounded-2xl border border-[color:var(--color-border)] input-surface-dark px-4 py-3";
const neutralBadgeClassName = "rounded-full badge-dark-neutral px-3 py-1 text-xs font-semibold";
const successBadgeClassName = "rounded-full badge-dark-success px-3 py-1 text-xs font-semibold";
const warningBadgeClassName = "rounded-full badge-dark-warning px-3 py-1 text-xs font-semibold";

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

function isAccountCompatibleWithRole(
  account: Pick<ReviewAccountOption, "accountType">,
  roleCode: AccountRoleCode | null,
) {
  const accountType = normalizeAccountType(account.accountType);

  switch (roleCode) {
    case "revenue_account":
      return accountType === "revenue" || accountType === "income";
    case "expense_account":
      return accountType === "expense";
    case "inventory_account":
    case "fixed_asset_account":
    case "accounts_receivable_account":
    case "cash_account":
    case "bank_account":
    case "card_clearing_account":
    case "check_clearing_account":
    case "cash_sales_unidentified_account":
    case "input_vat_account":
      return accountType === "asset";
    case "accounts_payable_account":
    case "output_vat_account":
    case "cash_purchases_unidentified_account":
      return accountType === "liability";
    case "bank_fees_account":
      return accountType === "expense";
    case "fx_difference_account":
      return true;
    default:
      return true;
  }
}

function getAccountRoleUiCopy(input: {
  roleCode: AccountRoleCode | null;
  documentRole: DocumentRoleCandidate;
}) {
  switch (input.roleCode) {
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
    case "output_vat_account":
      return {
        label: "Cuenta de IVA ventas",
        helper:
          "Corresponde al IVA debito fiscal de la venta. No uses ingresos, banco ni clientes.",
        emptyState: "No hay cuentas de IVA ventas disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de pasivo compatibles con IVA ventas.",
        createKindLabel: "pasivo",
      };
    case "input_vat_account":
      return {
        label: "Cuenta de IVA compras",
        helper:
          "Corresponde al IVA credito fiscal de la compra. No uses gasto, banco ni proveedores.",
        emptyState: "No hay cuentas de IVA compras disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con IVA compras.",
        createKindLabel: "activo",
      };
    case "accounts_receivable_account":
      return {
        label: "Cuenta de clientes",
        helper:
          "Usa la cuenta que representa el saldo a cobrar del cliente en ventas a credito.",
        emptyState: "No hay cuentas de clientes disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con clientes.",
        createKindLabel: "activo",
      };
    case "accounts_payable_account":
      return {
        label: "Cuenta de proveedores",
        helper:
          "Usa la cuenta que representa el saldo a pagar al proveedor en compras a credito.",
        emptyState: "No hay cuentas de proveedores disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de pasivo compatibles con proveedores.",
        createKindLabel: "pasivo",
      };
    case "cash_account":
      return {
        label: "Cuenta de caja",
        helper:
          "Usa la cuenta real por donde entra o sale el efectivo del documento contado.",
        emptyState: "No hay cuentas de caja disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con caja.",
        createKindLabel: "activo",
      };
    case "bank_account":
      return {
        label: "Cuenta bancaria",
        helper:
          "Usa la cuenta real del banco o transferencia que cobra o paga este documento.",
        emptyState: "No hay cuentas bancarias disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con bancos.",
        createKindLabel: "activo",
      };
    case "card_clearing_account":
      return {
        label: "Cuenta de tarjetas a cobrar",
        helper:
          "Usa la cuenta puente o de clearing donde queda la venta hasta que liquide la tarjeta.",
        emptyState: "No hay cuentas de clearing de tarjeta disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con tarjetas a cobrar.",
        createKindLabel: "activo",
      };
    case "check_clearing_account":
      return {
        label: "Cuenta de cheques",
        helper:
          "Usa la cuenta donde se controlan cheques recibidos o entregados hasta su efectivizacion.",
        emptyState: "No hay cuentas de cheques disponibles para este documento.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con cheques.",
        createKindLabel: "activo",
      };
    case "cash_sales_unidentified_account":
      return {
        label: "Cuenta provisoria de cobro",
        helper:
          "Se usa cuando la venta fue contado pero el medio exacto de cobro todavia no quedo resuelto.",
        emptyState: "No hay cuentas provisorias para cobros a identificar disponibles.",
        visibleTypesLabel: "Se muestran cuentas de activo compatibles con clearing provisorio.",
        createKindLabel: "activo",
      };
    case "cash_purchases_unidentified_account":
      return {
        label: "Cuenta provisoria de pago",
        helper:
          "Se usa cuando la compra fue contado pero el medio exacto de pago todavia no quedo resuelto.",
        emptyState: "No hay cuentas provisorias para pagos a identificar disponibles.",
        visibleTypesLabel: "Se muestran cuentas de pasivo compatibles con clearing provisorio.",
        createKindLabel: "pasivo",
      };
    default:
      return {
        label: input.roleCode ? formatAccountRoleCodeLabel(input.roleCode) : "Cuenta contable",
        helper:
          input.documentRole === "other"
            ? "Solo completa esta cuenta si el documento necesita una clasificacion manual especial."
            : "Elige la cuenta que corresponde a este rol dentro del asiento contable.",
        emptyState: "No hay cuentas disponibles para este rol.",
        visibleTypesLabel: "Se muestran las cuentas disponibles para este caso.",
        createKindLabel: input.documentRole === "sale" ? "ingreso" : "gasto",
      };
  }
}

function formatLinePurpose(value: string | null) {
  switch (value) {
    case "main":
      return "Concepto principal";
    case "tax":
      return "IVA";
    case "counterparty":
      return "Contrapartida";
    case "settlement":
      return "Cobro o pago";
    default:
      return "Linea contable";
  }
}

function buildInitialManualRoleOverrides(
  pageData: DocumentReviewPageData,
): ReviewManualRoleOverrides {
  const storedOverrides = pageData.derived.accountingContext.manualRoleOverrides ?? {};
  const next: ReviewManualRoleOverrides = {};

  for (const assignment of pageData.accountRoleAssignments) {
    next[assignment.roleCode] = storedOverrides[assignment.roleCode] ?? "";
  }

  const primaryRole = pageData.derived.settlementContext.primaryAccountRole;

  if (
    primaryRole
    && !next[primaryRole]
    && pageData.derived.accountingContext.manualOverrideAccountId
  ) {
    next[primaryRole] = pageData.derived.accountingContext.manualOverrideAccountId;
  }

  return next;
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

  if (input.fxRateSource === "document_import") {
    return {
      valueText: formatFxRate(visibleRate),
      detailText: input.fxRateDate
        ? `Cotizacion importada desde planilla con fecha ${formatDate(input.fxRateDate)}.`
        : "Cotizacion importada desde planilla.",
      helperText: "Se respeta la cotizacion explicitamente informada por el ERP de origen.",
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

function buildActionableDecisionMessage(input: {
  reasons: string[];
  missingConditions: string[];
  fallback: string;
}) {
  return input.reasons[0]
    ?? (input.missingConditions[0] ? `Falta: ${input.missingConditions[0]}.` : input.fallback);
}

function getChecklistToneClasses(input: {
  done: boolean;
  severity: "info" | "warning" | "blocking";
}) {
  if (input.done) {
    return {
      badge: "badge-dark-success",
      row: "border-emerald-400/25 surface-card-state-success",
    };
  }

  if (input.severity === "blocking") {
    return {
      badge: "badge-dark-danger",
      row: "border-rose-400/25 surface-card-state-danger",
    };
  }

  if (input.severity === "warning") {
    return {
      badge: "badge-dark-warning",
      row: "border-amber-400/25 surface-card-state-warning",
    };
  }

  return {
    badge: "badge-dark-neutral",
    row: "border-[color:var(--color-border)] surface-card-dark-soft",
  };
}

function getReviewStepClasses(status: "done" | "current" | "pending") {
  if (status === "done") {
    return {
      card: "border-emerald-400/25 surface-card-state-success",
      badge: "badge-dark-success",
    };
  }

  if (status === "current") {
    return {
      card: "border-[rgba(94,130,184,0.32)] surface-card-state-accent",
      badge: "badge-dark-accent",
    };
  }

  return {
    card: "border-[color:var(--color-border)] surface-card-dark-soft",
    badge: "badge-dark-neutral",
  };
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
    confirmManualAssignmentAction,
    createReviewAccountAction,
    saveLearningRuleAction,
    resolveDuplicateAction,
    runClassificationAction,
    reopenDocumentAction,
    refreshAssistantAction,
    resolveAssistantSuggestionAction,
  } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const startsConfirmedReview =
    pageData.draft.status === "confirmed"
    || pageData.document.postingStatus === "posted_final"
    || pageData.document.postingStatus === "locked";
  const startsReopenedReview = pageData.document.status === "classified_with_open_revision";
  const startsWithForcedManualFlow =
    startsReopenedReview
    || isManualClassificationRequired(pageData)
    || isSettlementContextRequired(pageData);
  const initialDuplicateStatus = pageData.derived.invoiceIdentity?.duplicateStatus ?? "clear";
  const shouldStartMobileOnFacts =
    startsWithForcedManualFlow
    || pageData.workflowState.stepStatuses.factual !== "completed"
    || pageData.certaintySummary.level !== "green"
    || initialDuplicateStatus !== "clear";
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
    manualRoleOverrides: buildInitialManualRoleOverrides(pageData),
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
  const [learningScope, setLearningScope] = useState<ApprovalLearningInput["scope"]>(
    pageData.learningSuggestions.recommendedScope,
  );
  const [learnedConceptName, setLearnedConceptName] = useState(
    pageData.derived.accountingContext.learnedConceptName
    ?? pageData.learningSuggestions.suggestedConceptName
    ?? "",
  );
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
  const [mobileStep, setMobileStep] = useState<1 | 2>(
    shouldStartMobileOnFacts ? 1 : 2,
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
      manualRoleOverrides: buildInitialManualRoleOverrides(pageData),
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
    setLearningScope(pageData.learningSuggestions.recommendedScope);
    setLearnedConceptName(
      pageData.derived.accountingContext.learnedConceptName
      ?? pageData.learningSuggestions.suggestedConceptName
      ?? "",
    );
    if (
      pageData.draft.status === "confirmed"
      || pageData.document.postingStatus === "posted_final"
      || pageData.document.postingStatus === "locked"
    ) {
      setShowManualFlow(false);
      setMobileStep(2);
      setShowCreateAccountStage(false);
    } else if (
      pageData.document.status === "classified_with_open_revision"
      || isManualClassificationRequired(pageData)
      || isSettlementContextRequired(pageData)
    ) {
      setShowManualFlow(true);
      setMobileStep(1);
    } else {
      setMobileStep(
        pageData.workflowState.stepStatuses.factual !== "completed"
          || pageData.certaintySummary.level !== "green"
          || (pageData.derived.invoiceIdentity?.duplicateStatus ?? "clear") !== "clear"
          ? 1
          : 2,
      );
    }
  }, [pageData]);

  function buildAccountingContextPayload(nextAccountingContext = accountingContext) {
    const manualRoleOverrides = Object.fromEntries(
      pageData.accountRoleAssignments.map((assignment) => ([
        assignment.roleCode,
        nextAccountingContext.manualRoleOverrides[assignment.roleCode]?.trim() || null,
      ])),
    ) as ManualAccountRoleOverrides;
    const primaryRole = pageData.derived.settlementContext.primaryAccountRole;

    return {
      accountingContext: {
        userFreeText: nextAccountingContext.userFreeText || null,
        businessPurposeNote: nextAccountingContext.businessPurposeNote || null,
        manualOverrideAccountId:
          primaryRole
            ? manualRoleOverrides[primaryRole] ?? null
            : null,
        manualRoleOverrides,
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
          ? "Etapa 1 guardada. El asiento se recalcula con este contexto."
          : "Etapa 1 guardada.";
        setSectionStatus((current) => ({ ...current, manualStage1: message }));
        setActionMessage(message);
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

  function runSaveMobileStepOne() {
    setPendingAction("stage1");
    setSectionStatus((current) => ({
      ...current,
      facts: "Guardando confirmacion factual...",
      manualStage1: "Guardando contexto del documento...",
    }));
    setActionMessage("");

    startTransition(async () => {
      try {
        const factsResult = await saveDraftReviewAction({
          stepCode: "fields",
          payload: {
            facts: buildFactPayload(),
          },
        });

        if (!factsResult.ok) {
          const message = buildBlockingMessage(factsResult.blockers);
          setSectionStatus((current) => ({
            ...current,
            facts: message,
            manualStage1: message,
          }));
          setActionMessage(message);
          return;
        }

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

        const message = "Paso 1 guardado. Ya puedes confirmar la decision contable.";
        setSectionStatus((current) => ({
          ...current,
          facts: "Datos factuales guardados.",
          manualStage1: message,
        }));
        setActionMessage(message);
        setMobileStep(2);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al guardar el paso 1.";
        setSectionStatus((current) => ({
          ...current,
          facts: message,
          manualStage1: message,
        }));
        setActionMessage(message);
      } finally {
        setPendingAction(null);
      }
    });
  }

  function runSaveAccounting() {
    const invalidOverride = pageData.accountRoleAssignments
      .map((assignment) => {
        const overrideId = accountingContext.manualRoleOverrides[assignment.roleCode]?.trim() || "";

        if (!overrideId) {
          return null;
        }

        const account = availableAccounts.find((candidate) => candidate.id === overrideId) ?? null;

        if (!account) {
          return {
            assignment,
            errorMessage:
              `La cuenta elegida para ${formatAccountRoleCodeLabel(assignment.roleCode).toLowerCase()} `
              + "ya no esta disponible.",
          };
        }

        if (!isAccountCompatibleWithRole(account, assignment.roleCode)) {
          const accountTypeLabel = formatAccountTypeLabel(account.accountType).toLowerCase();

          return {
            assignment,
            errorMessage:
              `La cuenta elegida (${account.code} - ${account.name}) es de tipo ${accountTypeLabel} `
              + `y no sirve como ${formatAccountRoleCodeLabel(assignment.roleCode).toLowerCase()}.`,
          };
        }

        return null;
      })
      .find((entry) => entry !== null);

    if (invalidOverride) {
      const message = invalidOverride.errorMessage;
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

  function runConfirmManualAssignment() {
    setPendingAction("confirm_manual_assignment");
    setActionMessage("Confirmando asignacion manual...");
    startTransition(async () => {
      try {
        const result = await confirmManualAssignmentAction({
          manualRoleOverrides: Object.fromEntries(
            Object.entries(accountingContext.manualRoleOverrides).map(([roleCode, accountId]) => [
              roleCode,
              accountId?.trim() || null,
            ]),
          ) as ManualAccountRoleOverrides,
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
        const primaryRole = pageData.derived.settlementContext.primaryAccountRole;
        const nextAccountingContext = {
          ...accountingContext,
          manualRoleOverrides: {
            ...accountingContext.manualRoleOverrides,
            ...(primaryRole ? { [primaryRole]: created.account.id } : {}),
          },
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

  function runSaveLearningRule() {
    const selectedLearningOption = pageData.learningSuggestions.options.find((option) =>
      option.scope === learningScope);

    if (learningScope === "none") {
      setActionMessage("Selecciona un criterio reusable antes de guardarlo.");
      return;
    }

    if (selectedLearningOption?.requiresConceptName && !learnedConceptName.trim()) {
      setActionMessage("Escribe un nombre canonico para el criterio antes de guardarlo.");
      return;
    }

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
  const decisionSnapshot = pageData.decisionSnapshot;
  const operationalHeader = buildDocumentOperationalHeaderView(decisionSnapshot);
  const provisionalGate = operationalHeader.provisional;
  const finalGate = operationalHeader.final;
  const duplicateStatus = pageData.derived.invoiceIdentity?.duplicateStatus ?? "clear";
  const primaryAccountRole = pageData.derived.settlementContext.primaryAccountRole ?? null;
  const primaryAccountUi = getAccountRoleUiCopy({
    roleCode: primaryAccountRole,
    documentRole: pageData.draft.documentRole,
  });
  const roleAssignments = pageData.accountRoleAssignments.map((assignment) => {
    const overrideAccountId = accountingContext.manualRoleOverrides[assignment.roleCode]?.trim() || "";
    const overrideAccount = overrideAccountId
      ? availableAccounts.find((account) => account.id === overrideAccountId) ?? null
      : null;
    const effectiveAccountId = overrideAccountId || assignment.accountId || "";
    const effectiveAccount = effectiveAccountId
      ? availableAccounts.find((account) => account.id === effectiveAccountId) ?? null
      : null;
    const compatibleAccounts = availableAccounts.filter((account) =>
      isAccountCompatibleWithRole(account, assignment.roleCode),
    );

    return {
      assignment,
      roleUi: getAccountRoleUiCopy({
        roleCode: assignment.roleCode,
        documentRole: pageData.draft.documentRole,
      }),
      overrideAccountId,
      overrideAccount,
      effectiveAccount,
      effectiveLabel:
        effectiveAccount
          ? `${effectiveAccount.code} - ${effectiveAccount.name}`
          : overrideAccountId
            ? "Cuenta no disponible"
          : assignment.accountLabel ?? "Sin cuenta resuelta",
      compatibleAccounts,
      overrideAccountIncompatible: Boolean(
        overrideAccount && !isAccountCompatibleWithRole(overrideAccount, assignment.roleCode),
      ),
      overrideAccountTypeLabel: overrideAccount
        ? formatAccountTypeLabel(overrideAccount.accountType)
        : null,
      isMissing: !effectiveAccount && !assignment.accountLabel,
      isProvisional: Boolean(assignment.isProvisional || overrideAccount?.isProvisional),
    };
  });
  const roleAssignmentsByCode = new Map(
    roleAssignments.map((assignment) => [assignment.assignment.roleCode, assignment]),
  );
  const primaryRoleAssignment = primaryAccountRole
    ? roleAssignmentsByCode.get(primaryAccountRole) ?? null
    : null;
  const canCreatePrimaryAccountInline =
    primaryAccountRole === "revenue_account" || primaryAccountRole === "expense_account";
  const selectedAccountLabel = primaryRoleAssignment?.effectiveLabel
    ?? (pageData.derived.appliedRule.accountCode || pageData.derived.appliedRule.accountName
      ? `${pageData.derived.appliedRule.accountCode ?? "--"} - ${pageData.derived.appliedRule.accountName ?? "Cuenta sugerida"}`
      : "Sin cuenta sugerida");
  const reviewCurrencyCode =
    pageData.draft.facts.currency_code
    ?? pageData.derived.monetarySnapshot?.currencyCode
    ?? pageData.derived.journalSuggestion.currencyCode
    ?? "UYU";
  const editableTotalAmount = parseOptionalNumber(facts.total_amount);
  const editableTaxAmount = parseOptionalNumber(facts.tax_amount);
  const totalLabel = editableTotalAmount !== null
    ? formatMoney(
      editableTotalAmount,
      reviewCurrencyCode,
    )
    : typeof pageData.draft.facts.total_amount === "number"
      ? formatMoney(
        pageData.draft.facts.total_amount,
        reviewCurrencyCode,
      )
      : formatMoney(pageData.derived.taxTreatment.totalAmountUyu, "UYU");
  const taxLabel = editableTaxAmount !== null
    ? formatMoney(editableTaxAmount, reviewCurrencyCode)
    : typeof pageData.draft.facts.tax_amount === "number"
      ? formatMoney(pageData.draft.facts.tax_amount, reviewCurrencyCode)
      : formatMoney(pageData.derived.taxTreatment.taxAmount, reviewCurrencyCode);
  const functionalCurrencyCode = pageData.derived.journalSuggestion.functionalCurrencyCode || "UYU";
  const showFunctionalAmounts = reviewCurrencyCode !== functionalCurrencyCode;
  const totalUyuLabel = formatMoney(
    pageData.derived.monetarySnapshot?.totalAmountUyu ?? pageData.derived.taxTreatment.totalAmountUyu,
    functionalCurrencyCode,
  );
  const taxUyuLabel = formatMoney(
    pageData.derived.monetarySnapshot?.taxAmountUyu ?? pageData.derived.taxTreatment.taxAmountUyu,
    functionalCurrencyCode,
  );
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
  const isConfirmedReview =
    pageData.draft.status === "confirmed"
    || pageData.document.postingStatus === "posted_final"
    || pageData.document.postingStatus === "locked";
  const latestConfirmation = pageData.confirmations[0] ?? null;
  const resolutionStatusSummary = decisionSnapshot.classificationResolved
    ? "La resolucion actual ya quedo consolidada para este draft."
    : "El preview puede verse correcto aunque la resolucion todavia no este consolidada.";
  const manualAssignmentReady = Boolean(primaryRoleAssignment?.effectiveAccount?.id);
  const shouldShowManualAssignmentCta =
    !isConfirmedReview
    && showManualFlow
    && manualAssignmentReady
    && decisionSnapshot.resolutionSource !== "manual";
  const selectedLearningOption = pageData.learningSuggestions.options.find((option) =>
    option.scope === learningScope) ?? null;
  const canSaveLearningRuleNow =
    pageData.canSaveLearningRule
    && learningScope !== "none"
    && (!selectedLearningOption?.requiresConceptName || learnedConceptName.trim().length > 0);
  const hasSavedContext = Boolean(
    pageData.derived.accountingContext.operationKind
    || pageData.derived.accountingContext.userFreeText?.trim()
    || pageData.derived.accountingContext.businessPurposeNote?.trim(),
  );
  const pendingAssistantSuggestionsCount =
    pageData.assistantRail?.suggestions.filter((suggestion) => suggestion.resolutionStatus === "pending").length
    ?? 0;
  const reviewConfidence =
    pageData.certaintySummary.confidence
    ?? pageData.latestClassificationRun?.confidence
    ?? pageData.derived.assistantSuggestion.confidence
    ?? pageData.draft.sourceConfidence
    ?? null;
  const currentTemplateCode =
    pageData.derived.settlementContext.templateCode ?? pageData.derived.journalSuggestion.templateCode;
  const currentTemplate =
    getJournalTemplateByCode(currentTemplateCode);
  const currentTemplateTitle =
    currentTemplate?.label
    ?? formatPostingTemplateCodeLabel(currentTemplateCode);
  const currentTemplateMeta = Array.from(
    new Set(
      pageData.accountingImpactPreview.journal.lines
        .map((line) =>
          line.accountCode && line.accountName
            ? `${line.accountCode} ${line.accountName}`
            : line.accountName || line.accountCode || null)
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 4);
  const mobileFastLaneReady =
    !isConfirmedReview
    && !showManualFlow
    && decisionSnapshot.finalEligibility.ok
    && pageData.certaintySummary.level === "green"
    && decisionSnapshot.blockers.length === 0;
  const mobileRoleAssignments = (
    roleAssignments.filter((assignment) =>
      assignment.assignment.editable || assignment.isMissing || assignment.isProvisional)
  ).length > 0
    ? roleAssignments.filter((assignment) =>
      assignment.assignment.editable || assignment.isMissing || assignment.isProvisional)
    : roleAssignments;
  const mobileDecisionHint =
    decisionSnapshot.blockers[0]
    ?? decisionSnapshot.warnings[0]
    ?? finalGate.summary
    ?? "La sugerencia actual ya se puede resolver desde esta pantalla.";
  const mobileConfidenceTone =
    pageData.certaintySummary.level === "green"
      ? "success"
      : pageData.certaintySummary.level === "yellow"
        ? "warning"
        : "danger";
  const mobileNeedsAccountReview = mobileRoleAssignments.some((assignment) =>
    assignment.isMissing || assignment.isProvisional);
  const mobileDuplicateBlocked = !isConfirmedReview && duplicateStatus !== "clear";
  const guidedRoute = buildDocumentReviewGuidedRoute({
    workflowState: pageData.workflowState,
    decisionSnapshot,
    accountingContextStatus: pageData.derived.accountingContext.status,
    hasSavedContext,
    hasPostingTemplate: Boolean(currentTemplateCode),
    manualAssignmentReady,
  });
  const reviewSteps = guidedRoute.reviewSteps;

  function renderMobileStepOne() {
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-white">Confirma solo lo necesario</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                Corrige datos extraidos del comprobante. La decision contable sugerida queda para el paso 2.
              </p>
            </div>
            <StatusBadge tone={mobileConfidenceTone}>
              {formatPercentage(reviewConfidence)}
            </StatusBadge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
            <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Moneda</p>
            <p className="mt-2 font-semibold text-white">{reviewCurrencyCode}</p>
            <p className="mt-1 text-[color:var(--color-muted)]">Tipo de cambio {visibleFx.valueText}</p>
          </div>
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
            <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Total</p>
            <p className="mt-2 font-semibold text-white">{totalLabel}</p>
            <p className="mt-1 text-[color:var(--color-muted)]">IVA {taxLabel}</p>
          </div>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Proveedor</span>
          <input
            value={facts.issuer_name}
            onChange={(event) => {
              setFacts((current) => ({ ...current, issuer_name: event.target.value }));
            }}
            className={inputSurfaceClassName}
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Nro. factura</span>
          <input
            value={facts.document_number}
            onChange={(event) => {
              setFacts((current) => ({ ...current, document_number: event.target.value }));
            }}
            className={inputSurfaceClassName}
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Fecha</span>
          <input
            value={facts.document_date}
            onChange={(event) => {
              setFacts((current) => ({ ...current, document_date: event.target.value }));
            }}
            className={inputSurfaceClassName}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Subtotal</span>
            <input
              value={facts.subtotal}
              onChange={(event) => {
                setFacts((current) => ({ ...current, subtotal: event.target.value }));
              }}
              className={inputSurfaceClassName}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">IVA</span>
            <input
              value={facts.tax_amount}
              onChange={(event) => {
                setFacts((current) => ({ ...current, tax_amount: event.target.value }));
              }}
              className={inputSurfaceClassName}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Total</span>
            <input
              value={facts.total_amount}
              onChange={(event) => {
                setFacts((current) => ({ ...current, total_amount: event.target.value }));
              }}
              className={inputSurfaceClassName}
            />
          </label>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Concepto</span>
          <textarea
            value={accountingContext.userFreeText}
            onChange={(event) => {
              setAccountingContext((current) => ({
                ...current,
                userFreeText: event.target.value,
              }));
            }}
            className="input-surface-dark min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm"
            placeholder="Describe brevemente que representa este documento."
          />
        </label>

        <details className={`rounded-2xl ${surfaceCardSubtleClassName} p-4`}>
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Ajustes avanzados del documento
          </summary>
          <div className="mt-4 grid gap-4">
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
                className={inputSurfaceClassName}
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
                className={inputSurfaceClassName}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Categoria operativa</span>
              <select
                value={operationCategory}
                onChange={(event) => {
                  setOperationCategory(event.target.value);
                }}
                className={inputSurfaceClassName}
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
        </details>

        <div className={`rounded-2xl ${surfaceCardSubtleClassName} p-4 text-sm text-[color:var(--color-muted)]`}>
          La sugerencia contable se conserva para el siguiente paso. Aqui solo confirmas hechos y, si hace falta, el encuadre documental basico.
        </div>
      </div>
    );
  }

  function renderMobileStepTwo() {
    return (
      <div className="space-y-4">
        <AccountingTemplateCard
          title={currentTemplateTitle}
          description={pageData.derived.journalSuggestion.explanation}
          meta={currentTemplateMeta}
          badgeLabel={pageData.certaintySummary.level === "green" ? "Sugerido" : "Revisar"}
          badgeTone={mobileConfidenceTone}
          selected
        />
        <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
          <p className="font-semibold text-white">Decision contable</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            Ajusta la operacion o el medio de cobro/pago solo si la sugerencia no refleja lo que paso realmente.
          </p>
        </div>

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
            className={inputSurfaceClassName}
          >
            <option value="">Selecciona una operacion</option>
            {operationKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4">
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
              className={inputSurfaceClassName}
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
              <span className="font-medium">Medio de cobro / pago</span>
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
                className={inputSurfaceClassName}
              >
                {settlementMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
          <p className="font-semibold text-white">Resolucion sugerida</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            {formatOperationKindLabel(
              accountingContext.operationKind || pageData.derived.settlementContext.operationKind,
            )}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatPaymentTermsLabel(accountingContext.paymentTerms)}
            {" / "}
            {formatSettlementMethodLabel(accountingContext.settlementMethod)}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Cuenta principal: {selectedAccountLabel}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {operationCategory
              ? `Categoria ${pageData.operationCategoryOptions.find((option) => option.code === operationCategory)?.label ?? operationCategory}`
              : "Categoria operativa por default"}
          </p>
        </div>

        <details
          className={`rounded-2xl ${surfaceCardSubtleClassName} p-4`}
          open={mobileNeedsAccountReview}
        >
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Cuentas por rol
          </summary>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--color-muted)]">
              Ajusta cuentas solo si necesitas corregir la resolucion sugerida.
            </p>
            <StatusBadge tone={mobileNeedsAccountReview ? "warning" : "success"}>
              {mobileNeedsAccountReview ? "Revisar" : "Listas"}
            </StatusBadge>
          </div>
          <div className="mt-4 space-y-3">
            {mobileRoleAssignments.map((roleAssignment) => (
              <div
                key={`mobile-${roleAssignment.assignment.roleCode}`}
                className={`rounded-2xl border p-4 text-sm ${
                  roleAssignment.isMissing
                    ? "border-amber-400/25 surface-card-state-warning"
                    : surfaceCardSoftClassName
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">
                      {formatAccountRoleCodeLabel(roleAssignment.assignment.roleCode)}
                    </p>
                    <p className="mt-1 text-[color:var(--color-muted)]">
                      {roleAssignment.effectiveLabel}
                    </p>
                  </div>
                  {roleAssignment.isMissing ? (
                    <StatusBadge tone="warning">Pendiente</StatusBadge>
                  ) : roleAssignment.isProvisional ? (
                    <StatusBadge>Provisoria</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Lista</StatusBadge>
                  )}
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="font-medium">{roleAssignment.roleUi.label}</span>
                  <select
                    value={roleAssignment.overrideAccountId}
                    onChange={(event) => {
                      setAccountingContext((current) => ({
                        ...current,
                        manualRoleOverrides: {
                          ...current.manualRoleOverrides,
                          [roleAssignment.assignment.roleCode]: event.target.value,
                        },
                      }));
                    }}
                    className={inputSurfaceClassName}
                  >
                    <option value="">Usar cuenta actual del asiento</option>
                    {roleAssignment.compatibleAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                        {account.isProvisional ? " (provisoria)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </details>

        <details className={`rounded-2xl ${surfaceCardSubtleClassName} p-4`}>
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Ver preview contable
          </summary>
          <div className="mt-4">
            <AccountingImpactPreview preview={pageData.accountingImpactPreview} />
          </div>
        </details>

        {pageData.canRunClassification ? (
          <div className={`rounded-2xl ${surfaceCardSubtleClassName} p-4`}>
            <p className="text-sm font-semibold text-white">Shortcut</p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Si ajustaste la operacion y quieres refrescar la sugerencia antes de confirmar, recalcula desde aqui.
            </p>
            <div className="mt-4">
              <CTAButton
                tone="secondary"
                disabled={isPending}
                onClick={() => {
                  runSimpleAction("classify", runClassificationAction);
                }}
              >
                <>
                  {pendingAction === "classify" && isPending ? <InlineSpinner /> : null}
                  Recalcular sugerencia
                </>
              </CTAButton>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderMobileDuplicateResolution() {
    return (
      <section className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Bloqueo detectado
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
              Resolver posible duplicado
            </h3>
          </div>
          <StatusBadge tone="danger">Duplicado</StatusBadge>
        </div>

        <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
          Este documento quedo marcado como {duplicateStatus.replace(/_/g, " ")}. Antes de confirmar, decide si se descarta, si es un falso positivo o si debe seguir con una justificacion.
        </p>

        <textarea
          value={duplicateNote}
          onChange={(event) => {
            setDuplicateNote(event.target.value);
          }}
          className="input-surface-dark mt-4 min-h-28 w-full rounded-2xl border border-rose-400/30 px-4 py-3 text-sm"
          placeholder="Nota breve para dejar trazabilidad de esta decision"
        />

        <div className="mt-4 space-y-3">
          <CTAButton
            tone="secondary"
            disabled={isPending}
            onClick={() => {
              runDuplicateResolution("confirmed_duplicate");
            }}
          >
            <>
              {pendingDuplicateAction === "confirmed_duplicate" && isPending ? <InlineSpinner /> : null}
              Confirmar duplicado
            </>
          </CTAButton>
          <CTAButton
            tone="secondary"
            disabled={isPending}
            onClick={() => {
              runDuplicateResolution("false_positive");
            }}
          >
            <>
              {pendingDuplicateAction === "false_positive" && isPending ? <InlineSpinner /> : null}
              Marcar falso positivo
            </>
          </CTAButton>
          <CTAButton
            disabled={isPending}
            onClick={() => {
              runDuplicateResolution("justified_non_duplicate");
            }}
          >
            <>
              {pendingDuplicateAction === "justified_non_duplicate" && isPending ? <InlineSpinner /> : null}
              Justificar y seguir
            </>
          </CTAButton>
          <DocumentOriginalModalTrigger
            previewUrl={pageData.document.previewUrl}
            mimeType={pageData.document.mimeType}
            originalFilename={pageData.document.originalFilename}
            triggerLabel="Ver documento original"
            triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} w-full px-4 py-3 text-sm`}
            modalTitle={pageData.document.originalFilename}
            modalDescription="Archivo original subido por el usuario."
          />
        </div>
      </section>
    );
  }

  function renderMobileDecisionContent() {
    if (isConfirmedReview) {
      return (
        <section className="panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Resultado final
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
            Documento confirmado
          </h3>
          <div className="mt-4 space-y-3">
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
              <p className="font-semibold text-white">Estado</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatPostingStatus(pageData.document.postingStatus)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Cuenta principal: {selectedAccountLabel}
              </p>
            </div>
            {pageData.canReopen ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  runSimpleAction("reopen", reopenDocumentAction);
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} w-full px-4 py-3 text-sm disabled:opacity-60`}
              >
                {pendingAction === "reopen" && isPending ? <InlineSpinner /> : null}
                Reabrir revision
              </button>
            ) : null}
          </div>
        </section>
      );
    }

    if (mobileDuplicateBlocked) {
      return renderMobileDuplicateResolution();
    }

    if (mobileFastLaneReady) {
      return (
        <section className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Fast lane
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                Documento listo para confirmar
              </h3>
            </div>
            <StatusBadge tone="success">Sin conflictos</StatusBadge>
          </div>

          <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
            La sugerencia actual ya cumple las condiciones para cerrar el documento sin abrir pasos extra.
          </p>

          <div className="mt-4 space-y-3">
            <AccountingTemplateCard
              title={currentTemplateTitle}
              description={pageData.derived.journalSuggestion.explanation}
              meta={currentTemplateMeta}
              badgeLabel={formatPercentage(reviewConfidence)}
              badgeTone="success"
              selected
            />
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
              <p className="font-semibold text-white">Resolucion sugerida</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{selectedAccountLabel}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">{finalGate.summary}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <CTAButton
              disabled={!decisionSnapshot.finalEligibility.ok || isPending}
              onClick={() => {
                runConfirmFinal();
              }}
            >
              <>
                {pendingAction === "confirm_final" && isPending ? <InlineSpinner /> : null}
                Confirmar
              </>
            </CTAButton>
            <CTAButton
              tone="secondary"
              onClick={() => {
                setShowManualFlow(true);
                setMobileStep(1);
              }}
            >
              Editar
            </CTAButton>
          </div>
        </section>
      );
    }

    return (
      <MobileWizard
        step={mobileStep}
        totalSteps={2}
        title={mobileStep === 1 ? "Confirmar datos" : "Asignar asiento"}
        description={
          mobileStep === 1
            ? "Valida proveedor, comprobante, fecha, importes y concepto antes de seguir."
            : "Confirma la sugerencia contable y ajusta cuentas solo si hace falta."
        }
        footerNote={(
          <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-3 text-sm text-[color:var(--color-muted)]`}>
            {mobileStep === 1
              ? sectionStatus.manualStage1 || "Paso 1 solo factual. La decision contable queda para el paso 2."
              : sectionStatus.accounting || mobileDecisionHint}
          </div>
        )}
        primaryAction={(
          mobileStep === 1 ? (
            <CTAButton
              disabled={isPending}
              onClick={() => {
                runSaveMobileStepOne();
              }}
            >
              <>
                {pendingAction === "stage1" && isPending ? <InlineSpinner /> : null}
                Guardar y seguir
              </>
            </CTAButton>
          ) : (
            <CTAButton
              disabled={isPending}
              onClick={() => {
                if (shouldShowManualAssignmentCta) {
                  runConfirmManualAssignment();
                  return;
                }

                if (decisionSnapshot.finalEligibility.ok) {
                  runConfirmFinal();
                  return;
                }

                runSaveAccounting();
              }}
            >
              <>
                {isPending ? <InlineSpinner /> : null}
                {shouldShowManualAssignmentCta
                  ? "Confirmar asignacion"
                  : decisionSnapshot.finalEligibility.ok
                    ? "Confirmar"
                    : "Guardar decision"}
              </>
            </CTAButton>
          )
        )}
        secondaryAction={(
          mobileStep === 1 ? (
            <DocumentOriginalModalTrigger
              previewUrl={pageData.document.previewUrl}
              mimeType={pageData.document.mimeType}
              originalFilename={pageData.document.originalFilename}
              triggerLabel="Ver original"
              triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} w-full px-4 py-3 text-sm`}
              modalTitle={pageData.document.originalFilename}
              modalDescription="Archivo original subido por el usuario."
            />
          ) : (
            <CTAButton
              tone="secondary"
              onClick={() => {
                if (!showManualFlow) {
                  setShowManualFlow(true);
                }
                setMobileStep(1);
              }}
            >
              Volver al paso 1
            </CTAButton>
          )
        )}
      >
        {mobileStep === 1 ? renderMobileStepOne() : renderMobileStepTwo()}
      </MobileWizard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="lg:hidden space-y-4">
        <section className="panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Revision {pageData.draft.revisionNumber}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                {pageData.document.originalFilename}
              </h2>
            </div>
            <StatusBadge tone={
              isConfirmedReview
                ? "success"
                : mobileDuplicateBlocked
                  ? "danger"
                  : mobileFastLaneReady
                    ? "accent"
                    : mobileConfidenceTone
            }>
              {isConfirmedReview
                ? "Confirmado"
                : mobileDuplicateBlocked
                  ? "Bloqueado"
                  : mobileFastLaneReady
                    ? "Fast lane"
                    : operationalHeader.workflowLabel}
            </StatusBadge>
          </div>

          <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
            {isConfirmedReview
              ? "Documento ya confirmado."
              : mobileDuplicateBlocked
                ? "Antes de seguir, resuelve el posible duplicado desde esta misma pantalla."
              : mobileFastLaneReady
                ? "La IA ya dejo este documento listo para confirmar."
                : "Flujo mobile de 2 pasos: confirmar datos y luego cerrar la decision contable."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-3 text-sm`}>
              <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Documento</p>
              <p className="mt-2 font-semibold text-white">{formatDocumentRoleLabel(pageData.draft.documentRole)}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">{pageData.draft.documentType || "Tipo pendiente"}</p>
            </div>
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-3 text-sm`}>
              <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Monto</p>
              <p className="mt-2 font-semibold text-white">{totalLabel}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">IVA {taxLabel}</p>
            </div>
          </div>

          <div className="mt-4">
            <DocumentOriginalModalTrigger
              previewUrl={pageData.document.previewUrl}
              mimeType={pageData.document.mimeType}
              originalFilename={pageData.document.originalFilename}
              triggerLabel="Ver documento original"
              triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} w-full px-4 py-3 text-sm`}
              modalTitle={pageData.document.originalFilename}
              modalDescription="Archivo original subido por el usuario."
            />
          </div>
        </section>

        {actionMessage ? (
          <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-3 text-sm text-[color:var(--color-muted)]`}>
            {actionMessage}
          </div>
        ) : null}

        {renderMobileDecisionContent()}
      </div>

      <section className="hidden lg:block panel p-6" id="review-stage-classification">
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
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
            <p className="font-semibold">Documento</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {documentRoleOptions.find((option) => option.value === pageData.draft.documentRole)?.label}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              {pageData.draft.documentType || "Tipo pendiente"}
            </p>
          </div>
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
            <p className="font-semibold">Monto</p>
            <p className="mt-2 text-[color:var(--color-muted)]">Total documento: {totalLabel}</p>
            <p className="mt-1 text-[color:var(--color-muted)]">IVA documento: {taxLabel}</p>
            {showFunctionalAmounts ? (
              <>
                <p className="mt-1 text-[color:var(--color-muted)]">
                  Total contable {functionalCurrencyCode}: {totalUyuLabel}
                </p>
                <p className="mt-1 text-[color:var(--color-muted)]">
                  IVA contable {functionalCurrencyCode}: {taxUyuLabel}
                </p>
              </>
            ) : null}
            <p className="mt-1 text-[color:var(--color-muted)]">
              Fecha {formatDate(facts.document_date || pageData.document.documentDate)}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              Tipo de cambio aplicado: {visibleFx.valueText}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">{visibleFx.detailText}</p>
          </div>
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
            <p className="font-semibold">Posteo</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {operationalHeader.postingStateLabel}
            </p>
            <p className="mt-1 text-[color:var(--color-muted)]">
              {guidedRoute.reviewClosed ? operationalHeader.workflowSummary : guidedRoute.nextBestActionCopy}
            </p>
          </div>
        </div>

        <div className={`mt-5 rounded-3xl ${surfaceCardClassName} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Ruta guiada
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                {operationalHeader.workflowLabel}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                {operationalHeader.workflowSummary}
              </p>
            </div>
            <span className={neutralBadgeClassName}>
              {operationalHeader.resolutionSourceLabel}
            </span>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-4">
            {reviewSteps.map((step) => {
              const tone = getReviewStepClasses(step.status);

              return (
                <a
                  key={step.key}
                  href={step.href}
                  className={`rounded-2xl border p-4 text-sm transition hover:border-[rgba(94,130,184,0.32)] hover:bg-[rgba(49,60,83,0.92)] ${tone.card}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-white">{step.label}</p>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone.badge}`}>
                      {step.status === "done" ? "Resuelto" : step.status === "current" ? "En foco" : "Pendiente"}
                    </span>
                  </div>
                  <p className="mt-3 leading-6 text-[color:var(--color-muted)]">{step.description}</p>
                </a>
              );
            })}
          </div>

          <div className={`mt-4 rounded-2xl ${surfaceCardSoftClassName} px-4 py-3 text-sm`}>
            <p className="font-semibold">Siguiente mejor accion</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {guidedRoute.nextBestActionCopy}
            </p>
          </div>

          <details className={`mt-4 rounded-2xl ${surfaceCardSubtleClassName} p-4`}>
            <summary className="cursor-pointer text-sm font-semibold">
              Ver estado operativo, readiness y soporte
            </summary>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
                <p className="font-semibold">Estado workflow</p>
                <p className="mt-2 text-[color:var(--color-muted)]">{operationalHeader.workflowLabel}</p>
              </div>
              <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
                <p className="font-semibold">Fuente de resolucion</p>
                <p className="mt-2 text-[color:var(--color-muted)]">{operationalHeader.resolutionSourceLabel}</p>
              </div>
              <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
                <p className="font-semibold">Confianza</p>
                <p className="mt-2 text-[color:var(--color-muted)]">{operationalHeader.confidenceLabel}</p>
              </div>
              <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
                <p className="font-semibold">Estado contable</p>
                <p className="mt-2 text-[color:var(--color-muted)]">{operationalHeader.postingStateLabel}</p>
              </div>
              <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
                <p className="font-semibold">Provisional</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  {guidedRoute.readinessStatusLabel ?? (decisionSnapshot.canPostProvisional ? "Habilitado" : "Bloqueado")}
                </p>
                <p className="mt-1 text-[color:var(--color-muted)]">{guidedRoute.provisionalReadinessCopy}</p>
              </div>
              <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
                <p className="font-semibold">Final</p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  {guidedRoute.readinessStatusLabel ?? (decisionSnapshot.canConfirmFinal ? "Habilitado" : "Bloqueado")}
                </p>
                <p className="mt-1 text-[color:var(--color-muted)]">{guidedRoute.finalReadinessCopy}</p>
              </div>
            </div>

            {(pageData.launchScope.supportLevel !== "automatic" || pageData.importReviewPolicy.isImportFlow) ? (
              <div className="alert-dark-warning mt-4 rounded-2xl px-4 py-3 text-sm">
                <p className="font-semibold">
                  {formatLaunchSupportLevelLabel(pageData.launchScope.supportLevel)}
                </p>
                {pageData.launchScope.reasons.map((reason) => (
                  <p key={reason} className="mt-2">{reason}</p>
                ))}
                {pageData.importReviewPolicy.isImportFlow ? (
                  <>
                    <p className="mt-2 font-semibold">Importacion asistida</p>
                    {pageData.importReviewPolicy.reasons.map((reason) => (
                      <p key={`import:${reason}`} className="mt-2">{reason}</p>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </details>
        </div>

      {actionMessage ? (
          <div className={`mt-5 rounded-2xl ${surfaceCardSoftClassName} px-4 py-3 text-sm text-[color:var(--color-muted)]`}>
            {actionMessage}
          </div>
        ) : null}
      </section>

      <div className="hidden gap-6 lg:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-6">

      {!isConfirmedReview && duplicateStatus !== "clear" ? (
        <section className="panel border-rose-400/30 surface-card-state-danger p-6">
          <p className="text-sm font-semibold text-rose-50">
            Posible duplicado: {duplicateStatus.replace(/_/g, " ")}
          </p>
          <textarea
            value={duplicateNote}
            onChange={(event) => {
              setDuplicateNote(event.target.value);
            }}
            className="input-surface-dark mt-4 min-h-24 w-full rounded-2xl border border-rose-400/30 px-4 py-3 text-sm"
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
          <span className={neutralBadgeClassName}>
            {formatClassificationStatus(pageData.workflowState.classificationStatus)}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {roleAssignments.map((roleAssignment) => (
            <div
              key={roleAssignment.assignment.roleCode}
              className={`rounded-2xl border p-4 text-sm ${
                roleAssignment.isMissing
                  ? "border-amber-400/25 surface-card-state-warning"
                  : surfaceCardSoftClassName
              }`}
            >
              <p className="font-semibold">
                {formatAccountRoleCodeLabel(roleAssignment.assignment.roleCode)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                {formatLinePurpose(roleAssignment.assignment.linePurpose)}
              </p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {roleAssignment.effectiveLabel}
              </p>
              {roleAssignment.isMissing ? (
                <p className="mt-2 text-amber-100">
                  Falta resolver esta cuenta para completar el asiento.
                </p>
              ) : roleAssignment.isProvisional ? (
                <p className="mt-2 text-[color:var(--color-muted)]">
                  Cuenta provisoria.
                </p>
              ) : null}
            </div>
          ))}
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
            <p className="font-semibold">Confianza</p>
            <p className="mt-2 text-[color:var(--color-muted)]">
              {formatPercentage(
                pageData.latestClassificationRun?.confidence
                ?? pageData.derived.assistantSuggestion.confidence,
              )}
            </p>
          </div>
          <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
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
        <section className="panel p-6" id="review-stage-context">
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
                className={inputSurfaceClassName}
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
                className={inputSurfaceClassName}
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
                className={inputSurfaceClassName}
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
                className={inputSurfaceClassName}
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
                className={inputSurfaceClassName}
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
                  className={inputSurfaceClassName}
                >
                  {settlementMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className={`rounded-2xl ${dashedSurfaceCardClassName} px-4 py-3 text-sm text-[color:var(--color-muted)]`}>
                En operaciones a credito, el medio real de cobro o pago se registra despues.
              </div>
            )}
            <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-3 text-sm`}>
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
                className="input-surface-dark min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm"
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
                className="input-surface-dark min-h-24 w-full rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm"
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
              Guardar contexto documental
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
              Guardar y recalcular sugerencia
            </button>
          </div>

          <details className={`mt-6 rounded-2xl ${surfaceCardSubtleClassName} p-4`}>
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
                  className={inputSurfaceClassName}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">RUT emisor</span>
                <input
                  value={facts.issuer_tax_id}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, issuer_tax_id: event.target.value }));
                  }}
                  className={inputSurfaceClassName}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Numero</span>
                <input
                  value={facts.document_number}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, document_number: event.target.value }));
                  }}
                  className={inputSurfaceClassName}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Serie</span>
                <input
                  value={facts.series}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, series: event.target.value }));
                  }}
                  className={inputSurfaceClassName}
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
                  className={inputSurfaceClassName}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Subtotal</span>
                <input
                  value={facts.subtotal}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, subtotal: event.target.value }));
                  }}
                  className={inputSurfaceClassName}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">IVA</span>
                <input
                  value={facts.tax_amount}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, tax_amount: event.target.value }));
                  }}
                  className={inputSurfaceClassName}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Total</span>
                <input
                  value={facts.total_amount}
                  onChange={(event) => {
                    setFacts((current) => ({ ...current, total_amount: event.target.value }));
                  }}
                  className={inputSurfaceClassName}
                />
              </label>
            </div>
            <div className={`mt-4 rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
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

      {!isConfirmedReview && showManualFlow ? (
        <section className="panel p-6" id="review-stage-accounting">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Etapa 2
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            Plantilla contable, asiento tipo y cuentas por rol
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Aqui puedes revisar y corregir la plantilla contable o el asiento tipo sugerido, junto con las cuentas que usa cada rol. La vista previa de abajo sigue siendo la fuente de verdad del Debe, Haber e IVA.
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

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {roleAssignments.map((roleAssignment) => (
              <div
                key={roleAssignment.assignment.roleCode}
                className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {formatAccountRoleCodeLabel(roleAssignment.assignment.roleCode)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                      {formatLinePurpose(roleAssignment.assignment.linePurpose)}
                    </p>
                  </div>
                  {roleAssignment.isMissing ? (
                    <span className={warningBadgeClassName}>
                      Falta resolver
                    </span>
                  ) : roleAssignment.isProvisional ? (
                    <span className={neutralBadgeClassName}>
                      Provisoria
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-[color:var(--color-muted)]">
                  {roleAssignment.roleUi.helper}
                </p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  Cuenta actual: {roleAssignment.effectiveLabel}
                </p>

                <label className="mt-4 block space-y-2">
                  <span className="font-medium">{roleAssignment.roleUi.label}</span>
                  <select
                    value={roleAssignment.overrideAccountId}
                    onChange={(event) => {
                      setAccountingContext((current) => ({
                        ...current,
                        manualRoleOverrides: {
                          ...current.manualRoleOverrides,
                          [roleAssignment.assignment.roleCode]: event.target.value,
                        },
                      }));
                    }}
                    className={inputSurfaceClassName}
                  >
                    <option value="">Usar cuenta actual del asiento</option>
                    {roleAssignment.overrideAccountIncompatible && roleAssignment.overrideAccount ? (
                      <option value={roleAssignment.overrideAccount.id}>
                        Cuenta incompatible: {roleAssignment.overrideAccount.code} - {roleAssignment.overrideAccount.name}
                      </option>
                    ) : null}
                    {roleAssignment.compatibleAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                        {account.isProvisional ? " (provisoria)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="mt-2 text-[color:var(--color-muted)]">
                  {roleAssignment.roleUi.visibleTypesLabel}
                </p>

                {roleAssignment.overrideAccountIncompatible && roleAssignment.overrideAccountTypeLabel ? (
                  <div className="alert-dark-warning mt-3 rounded-2xl px-4 py-3 text-sm">
                    La cuenta elegida actualmente ({roleAssignment.effectiveLabel}) es de tipo {roleAssignment.overrideAccountTypeLabel.toLowerCase()}
                    {" "}y no puede usarse como {roleAssignment.roleUi.label.toLowerCase()}.
                  </div>
                ) : null}

                {roleAssignment.compatibleAccounts.length === 0 ? (
                  <div className={`mt-3 rounded-2xl ${dashedSurfaceCardClassName} px-4 py-3 text-sm text-[color:var(--color-muted)]`}>
                    {roleAssignment.roleUi.emptyState}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
            <div className={`rounded-3xl ${surfaceCardSubtleClassName} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Preview actual del asiento
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                Esta vista muestra como quedaria hoy el Debe, Haber, IVA y saldos abiertos si postearas con el contexto actual.
              </p>
              <div className="mt-4">
                <AccountingImpactPreview preview={pageData.accountingImpactPreview} />
              </div>
            </div>

            <div className={`rounded-3xl ${surfaceCardClassName} p-5 text-sm`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Estado de resolucion
              </p>
              <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                {operationalHeader.resolutionSourceLabel}
              </h4>
              <p className="mt-2 leading-7 text-[color:var(--color-muted)]">
                {resolutionStatusSummary}
              </p>

              <div className="mt-4 space-y-3">
                <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-3`}>
                  <p className="font-semibold">Clasificacion</p>
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    {decisionSnapshot.classificationResolved
                      ? "Resuelta"
                      : "Todavia no consolidada"}
                  </p>
                </div>
                <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-3`}>
                  <p className="font-semibold">Ultimo motivo visible</p>
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    {decisionSnapshot.blockers[0]
                      ?? decisionSnapshot.warnings[0]
                      ?? "No hay blockers visibles en este momento."}
                  </p>
                </div>
                <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-3`}>
                  <p className="font-semibold">Ultimo intento</p>
                  <p className="mt-2 text-[color:var(--color-muted)]">
                    {pageData.latestClassificationRun
                      ? formatDate(pageData.latestClassificationRun.createdAt)
                      : "Sin corridas registradas"}
                  </p>
                </div>
              </div>

              {shouldShowManualAssignmentCta ? (
                <div className="alert-dark-info mt-5 rounded-2xl px-4 py-4">
                  <p className="font-semibold">Confirmar asignacion manual</p>
                  <p className="mt-2 text-sm leading-6">
                    Esta accion fija la asignacion efectiva actual como resolucion manual, limpia los bloqueos que dependan solo de baja confianza IA y deja rastro auditado.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        runConfirmManualAssignment();
                      }}
                      className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
                    >
                      {pendingAction === "confirm_manual_assignment" && isPending ? <InlineSpinner /> : null}
                      Confirmar asignacion manual
                    </button>
                  </div>
                </div>
              ) : decisionSnapshot.resolutionSource === "manual" ? (
                <div className="alert-dark-success mt-5 rounded-2xl px-4 py-4">
                  La resolucion visible ya quedo consolidada como revision manual.
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <LoadingLink
              href={`/app/o/${pageData.organizationSlug}/chart-map?mode=document&documentId=${pageData.document.id}${primaryRoleAssignment?.effectiveAccount?.id ? `&accountId=${primaryRoleAssignment.effectiveAccount.id}` : pageData.derived.appliedRule.accountId ? `&accountId=${pageData.derived.appliedRule.accountId}` : ""}`}
              pendingLabel="Abriendo mapa..."
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
            >
              Ver en mapa contable
            </LoadingLink>
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
              Guardar cuentas seleccionadas
            </button>
            {canCreatePrimaryAccountInline ? (
              <button
                type="button"
                onClick={() => {
                  setShowCreateAccountStage(true);
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
              >
                No encuentro la cuenta principal
              </button>
            ) : null}
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
                Recalcular clasificacion con este contexto
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isConfirmedReview && showManualFlow && showCreateAccountStage && canCreatePrimaryAccountInline ? (
        <section className="panel p-6">
          <h3 className="text-2xl font-semibold tracking-[-0.05em]">Crear cuenta principal nueva</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Paso excepcional para la cuenta principal del documento. Solo abre esta opcion si de verdad no existe la cuenta correcta.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Codigo</span>
              <input
                value={newReviewAccount.code}
                onChange={(event) => {
                  setNewReviewAccount((current) => ({ ...current, code: event.target.value }));
                }}
                className={inputSurfaceClassName}
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
                className={inputSurfaceClassName}
                placeholder="Nombre de la cuenta"
              />
            </label>
          </div>
          <div className="alert-dark-warning mt-4 rounded-2xl px-4 py-3 text-sm">
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

      {!isConfirmedReview ? (
        <section className="panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
            Paso 5
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
            Decidir aprendizaje
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-[color:var(--color-muted)]">
            Resolver un documento no es lo mismo que ensenarle un criterio reusable al sistema.
            Este paso hace visible esa diferencia y deja claro si la decision queda solo en este
            draft o si pasa a formar parte de las reglas que podras reaplicar despues.
          </p>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-4">
              <div className={`rounded-3xl ${surfaceCardClassName} p-5`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Resolver solo este documento
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                  La asignacion manual consolida esta revision puntual. No crea una regla reusable
                  ni afecta automaticamente otros comprobantes del mismo proveedor o concepto.
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-100">
                  {decisionSnapshot.resolutionSource === "manual"
                    ? "La resolucion visible ya quedo consolidada como revision manual."
                    : shouldShowManualAssignmentCta
                      ? "Todavia puedes confirmar manualmente esta asignacion antes de decidir si la guardas como criterio."
                  : "Este documento ya tiene una fuente de resolucion visible y no necesita otra confirmacion manual ahora mismo."}
                </p>
              </div>

              <div className={`rounded-3xl ${surfaceCardClassName} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                      Guardar criterio para similares
                    </p>
                    <h4 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
                      Convertir esta resolucion en regla visible
                    </h4>
                  </div>
                  {pageData.canSaveLearningRule ? (
                    <span className={successBadgeClassName}>
                      Listo para guardar
                    </span>
                  ) : (
                    <span className={warningBadgeClassName}>
                      Aun no habilitado
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                  Elige el alcance del criterio reusable. Esto si afecta futuras clasificaciones y
                  convierte el aprendizaje en una regla gobernable por el equipo.
                </p>

                {pageData.learningSuggestions.options.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {pageData.learningSuggestions.options.map((option) => (
                      <button
                        key={option.scope}
                        type="button"
                        onClick={() => {
                          setLearningScope(option.scope);
                          if (
                            !learnedConceptName.trim()
                            && pageData.learningSuggestions.suggestedConceptName
                          ) {
                            setLearnedConceptName(pageData.learningSuggestions.suggestedConceptName);
                          }
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          learningScope === option.scope
                            ? "border-transparent bg-[color:var(--color-accent)] text-white"
                            : `${surfaceCardSoftClassName}`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{option.label}</span>
                          {option.recommended ? (
                            <span className="rounded-full bg-slate-950/30 px-2 py-1 text-[11px] uppercase tracking-[0.18em]">
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
                    Todavia no hay una resolucion reusable suficientemente estable para convertir
                    en criterio. Primero deja el documento bien resuelto y luego vuelve a este paso.
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Nombre canonico del criterio</span>
                    <input
                      value={learnedConceptName}
                      onChange={(event) => {
                        setLearnedConceptName(event.target.value);
                      }}
                      className={inputSurfaceClassName}
                      placeholder={pageData.learningSuggestions.suggestedConceptName ?? "Ej. Servicios administrativos"}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!canSaveLearningRuleNow || isPending}
                    onClick={() => {
                      runSaveLearningRule();
                    }}
                    className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} self-end px-4 py-3 text-sm disabled:opacity-60`}
                  >
                    {pendingAction === "save_learning" && isPending ? <InlineSpinner /> : null}
                    Guardar como criterio
                  </button>
                </div>

                <div className={`mt-4 rounded-2xl ${surfaceCardSoftClassName} px-4 py-3 text-sm text-[color:var(--color-muted)]`}>
                  {selectedLearningOption
                    ? `Alcance seleccionado: ${selectedLearningOption.label}. ${selectedLearningOption.reason}`
                    : "Selecciona un alcance reusable antes de guardar el criterio."}
                </div>
              </div>

              <div className={`rounded-3xl ${surfaceCardClassName} p-5`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Aplicar en lote desde la bandeja
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                  Despues de guardar el criterio, la bandeja documental puede reaplicar criterios
                  guardados a varios documentos seleccionados. Esa accion reejecuta la
                  clasificacion con las reglas activas; no confirma ni postea documentos por si sola.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <LoadingLink
                    href={`/app/o/${pageData.organizationSlug}/review`}
                    pendingLabel="Abriendo revision..."
                    className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
                  >
                    Volver a Revision
                  </LoadingLink>
                </div>
              </div>
            </div>

            <RuleApplicationCard
              explanation={pageData.ruleExplanation}
              organizationSlug={pageData.organizationSlug}
              documentId={pageData.document.id}
            />
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
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
              <p className="font-semibold">Estado final</p>
              <p className="mt-2 text-[color:var(--color-muted)]">
                {formatPostingStatus(pageData.document.postingStatus)}
              </p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Draft {formatDraftStatus(pageData.draft.status)}
              </p>
            </div>
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
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
            <div className={`rounded-2xl ${surfaceCardSoftClassName} p-4 text-sm`}>
              <p className="font-semibold">Plantilla / asiento final</p>
              <p className="mt-2 text-[color:var(--color-muted)]">{currentTemplateTitle}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                Cuenta principal: {selectedAccountLabel}
              </p>
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

      <section className="panel p-6" id="review-stage-close">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
          {isConfirmedReview ? "Revision cerrada" : "Cierre"}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
          {isConfirmedReview ? "Acciones disponibles" : "Siguiente paso del documento"}
        </h3>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
          {isConfirmedReview
            ? "La revision ya fue confirmada. Si necesitas volver a editar etapas o reasignar plantilla, asiento tipo o cuentas por rol, primero reabre la revision."
            : "Solo cuando la clasificacion queda resuelta seguimos con posteo, confirmacion o reapertura."}
        </p>

        {!isConfirmedReview ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className={`rounded-3xl ${surfaceCardSoftClassName} p-4`}>
              <p className="text-sm font-semibold">Checklist de cierre</p>
              <div className="mt-4 space-y-3">
                {decisionSnapshot.checklist.map((item) => {
                  const tone = getChecklistToneClasses({
                    done: item.done,
                    severity: item.severity,
                  });

                  return (
                    <div
                      key={item.code}
                      className={`rounded-2xl border px-4 py-3 text-sm ${tone.row}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className="mt-2 text-[color:var(--color-muted)]">
                            {item.explanation ?? "Sin detalle visible."}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                          {item.done ? "Resuelto" : "Pendiente"}
                        </span>
                      </div>
                      {item.actionHint ? (
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                          Accion sugerida: {item.actionHint}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`rounded-3xl ${surfaceCardSoftClassName} p-4`}>
              <p className="text-sm font-semibold">Motivos de bloqueo y readiness</p>

              <div className="mt-4 space-y-4">
                <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-4 text-sm`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">Postear provisional</p>
                      <p className="mt-2 text-[color:var(--color-muted)]">{provisionalGate.label}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      provisionalGate.ok ? "badge-dark-success" : "badge-dark-danger"
                    }`}>
                      {provisionalGate.ok ? "Listo" : "Bloqueado"}
                    </span>
                  </div>
                  <p className="mt-3 text-[color:var(--color-muted)]">{provisionalGate.summary}</p>
                  {!provisionalGate.ok && provisionalGate.missingConditions.length > 0 ? (
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      Falta: {provisionalGate.missingConditions.join(", ")}.
                    </p>
                  ) : null}
                  {!provisionalGate.ok && provisionalGate.actionHint ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                      Accion sugerida: {provisionalGate.actionHint}
                    </p>
                  ) : null}
                </div>

                <div className={`rounded-2xl ${surfaceCardSoftClassName} px-4 py-4 text-sm`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">Confirmar final</p>
                      <p className="mt-2 text-[color:var(--color-muted)]">{finalGate.label}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      finalGate.ok ? "badge-dark-success" : "badge-dark-danger"
                    }`}>
                      {finalGate.ok ? "Listo" : "Bloqueado"}
                    </span>
                  </div>
                  <p className="mt-3 text-[color:var(--color-muted)]">{finalGate.summary}</p>
                  {!finalGate.ok && finalGate.missingConditions.length > 0 ? (
                    <p className="mt-2 text-[color:var(--color-muted)]">
                      Falta: {finalGate.missingConditions.join(", ")}.
                    </p>
                  ) : null}
                  {!finalGate.ok && finalGate.actionHint ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                      Accion sugerida: {finalGate.actionHint}
                    </p>
                  ) : null}
                </div>

                {decisionSnapshot.blockers.length > 0 ? (
                  <div className="alert-dark-danger rounded-2xl px-4 py-3 text-sm">
                    {decisionSnapshot.blockers.join(" ")}
                  </div>
                ) : decisionSnapshot.warnings.length > 0 ? (
                  <div className="alert-dark-warning rounded-2xl px-4 py-3 text-sm">
                    {decisionSnapshot.warnings.join(" ")}
                  </div>
                ) : (
                  <div className="alert-dark-success rounded-2xl px-4 py-3 text-sm">
                    No quedan blockers ni warnings visibles que impidan avanzar.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {!isConfirmedReview ? (
            <>
              <button
                type="button"
                disabled={!decisionSnapshot.provisionalEligibility.ok || isPending}
                onClick={() => {
                  runSimpleAction("post_provisional", postProvisionalDocumentAction);
                }}
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
                title={
                  decisionSnapshot.provisionalEligibility.ok
                    ? "Documento listo para posting provisional"
                    : buildActionableDecisionMessage({
                      reasons: decisionSnapshot.provisionalEligibility.reasons,
                      missingConditions: decisionSnapshot.provisionalEligibility.missingConditions,
                      fallback: "Todavia no puede postearse en modo provisional.",
                    })
                }
              >
                {pendingAction === "post_provisional" && isPending ? <InlineSpinner /> : null}
                Postear provisional
              </button>
              <button
                type="button"
                disabled={!decisionSnapshot.finalEligibility.ok || isPending}
                onClick={() => {
                  runConfirmFinal();
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
                title={
                  decisionSnapshot.finalEligibility.ok
                    ? "Documento listo para confirmacion final"
                    : buildActionableDecisionMessage({
                      reasons: decisionSnapshot.finalEligibility.reasons,
                      missingConditions: decisionSnapshot.finalEligibility.missingConditions,
                      fallback: "Todavia no puede confirmarse en forma final.",
                    })
                }
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

        <details className={`mt-6 rounded-2xl ${surfaceCardSubtleClassName} p-4`}>
          <summary className="cursor-pointer text-sm font-semibold">Texto extraido y detalle tecnico</summary>
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
            {pageData.draft.extractedText || "Sin texto extraido."}
          </pre>
        </details>
      </section>
        </div>

        <div className="xl:sticky xl:top-6">
          <details className="panel overflow-hidden p-0">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
              {pendingAssistantSuggestionsCount > 0
                ? `Asistente contable opcional (${pendingAssistantSuggestionsCount} sugerencia(s) pendiente(s))`
                : "Asistente contable opcional"}
            </summary>
            <div className="border-t border-[color:var(--color-border)] p-4">
              <DocumentAccountingAssistantRail
                assistantRail={pageData.assistantRail}
                refreshAssistantAction={refreshAssistantAction}
                resolveAssistantSuggestionAction={resolveAssistantSuggestionAction}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
