"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { JournalEntryModalTrigger } from "@/components/accounting/journal-entry-modal-trigger";
import { DocumentPreview } from "@/components/documents/document-preview";
import { DocumentOriginalModalTrigger } from "@/components/documents/document-original-modal-trigger";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { LoadingLink } from "@/components/ui/loading-link";
import type {
  AccountRoleCode,
  ApprovalLearningInput,
  ManualAccountRoleOverrides,
} from "@/modules/accounting";
import type { DocumentReviewPageData } from "@/modules/documents/review";
import type { ZetaPurchaseInvoiceExportResult } from "@/modules/integrations/zeta/export/types";
import {
  formatAccountRoleCodeLabel,
  formatPostingTemplateCodeLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";

type SaveDraftReviewAction = (input: {
  stepCode: "accounting_context";
  payload: {
    accountingContext?: {
      userFreeText?: string | null;
      businessPurposeNote?: string | null;
      manualOverrideAccountId?: string | null;
      manualRoleOverrides?: ManualAccountRoleOverrides | null;
      learnedConceptName?: string | null;
      operationKind?: string | null;
      paymentTerms?: "cash" | "credit" | "unknown" | null;
      settlementMethod?:
        | "cash"
        | "bank_transfer"
        | "card"
        | "check"
        | "paid_by_partner"
        | "mixed"
        | "unknown"
        | null;
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

type ConfirmManualAssignmentAction = (input: {
  manualRoleOverrides?: ManualAccountRoleOverrides | null;
}) => Promise<{
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

type ExportPurchaseExpenseToZetaAction = (input: {
  dryRun?: boolean;
  forceResend?: boolean;
}) => Promise<{
  ok: boolean;
  message: string;
  result: ZetaPurchaseInvoiceExportResult | null;
}>;

type ReviewAccountOption = DocumentReviewPageData["accountingOptions"]["accounts"][number];
type CreateReviewAccountAction = (input: {
  code: string;
  name: string;
}) => Promise<{
  ok: boolean;
  message: string;
  account: ReviewAccountOption | null;
}>;

type Props = {
  slug: string;
  organizationName: string;
  pageData: DocumentReviewPageData;
  saveDraftReviewAction: SaveDraftReviewAction;
  confirmManualAssignmentAction: ConfirmManualAssignmentAction;
  createReviewAccountAction: CreateReviewAccountAction;
  saveLearningRuleAction: SaveLearningRuleAction;
  exportPurchaseExpenseToZetaAction: ExportPurchaseExpenseToZetaAction;
};

type ReviewManualRoleOverrides = Partial<Record<AccountRoleCode, string>>;
type LearningScope = ApprovalLearningInput["scope"];
type PendingAction = "draft" | "confirm_accounts" | "save_rule" | "zeta_validate" | "zeta_export" | null;
type PendingInlineAction = "create_account" | null;
type FeedbackTone = "neutral" | "success" | "danger";
type RuleToggleKey = "issuer" | "receiver" | "concept";
type RuleToggleState = Record<RuleToggleKey, boolean>;

function normalizeAccountType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function sortReviewAccounts(accounts: ReviewAccountOption[]) {
  return [...accounts].sort((left, right) =>
    accountSortCode(left).localeCompare(accountSortCode(right), "es", { numeric: true, sensitivity: "base" }),
  );
}

function isZetaAccount(account: ReviewAccountOption) {
  return account.providerManaged === true && account.sourceProvider === "zetasoftware";
}

function accountSortCode(account: ReviewAccountOption) {
  return isZetaAccount(account)
    ? account.externalCode || account.code
    : account.code;
}

function formatReviewAccountLabel(account: ReviewAccountOption) {
  if (isZetaAccount(account)) {
    return account.displayCodeName || `${account.externalCode || account.code} - ${account.name}`;
  }

  return `${account.code} ${account.name}`;
}

function searchableAccountText(account: ReviewAccountOption) {
  return [
    account.code,
    account.name,
    account.externalCode,
    account.displayCodeName,
    isZetaAccount(account) ? "zeta" : null,
  ].filter(Boolean).join(" ").toLowerCase();
}

function formatAccountTypeLabel(value: string | null | undefined) {
  switch (normalizeAccountType(value)) {
    case "asset":
      return "Activo";
    case "liability":
      return "Pasivo";
    case "equity":
      return "Patrimonio";
    case "income":
    case "revenue":
      return "Ingreso";
    case "expense":
      return "Gasto";
    default:
      return "Cuenta contable";
  }
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

function buildInitialRuleToggles(input: {
  facts: DocumentReviewPageData["draft"]["facts"];
  scope: LearningScope;
}) {
  const prefersReceiver = !input.facts.issuer_tax_id && Boolean(input.facts.receiver_tax_id);
  const counterpartyKey = prefersReceiver ? "receiver" : "issuer";

  switch (input.scope) {
    case "vendor_concept_operation_category":
    case "vendor_concept":
      return {
        issuer: counterpartyKey === "issuer",
        receiver: counterpartyKey === "receiver",
        concept: true,
      } satisfies RuleToggleState;
    case "concept_global":
      return {
        issuer: false,
        receiver: false,
        concept: true,
      } satisfies RuleToggleState;
    case "vendor_default":
      return {
        issuer: counterpartyKey === "issuer",
        receiver: counterpartyKey === "receiver",
        concept: false,
      } satisfies RuleToggleState;
    default:
      return {
        issuer: Boolean(input.facts.issuer_tax_id),
        receiver: prefersReceiver,
        concept: true,
      } satisfies RuleToggleState;
  }
}

function deriveLearningScopeFromToggles(
  toggles: RuleToggleState,
  options: DocumentReviewPageData["learningSuggestions"]["options"],
): LearningScope {
  const availableScopes = new Set(options.map((option) => option.scope));
  const hasCounterparty = toggles.issuer || toggles.receiver;

  if (
    toggles.concept
    && hasCounterparty
    && availableScopes.has("vendor_concept_operation_category")
  ) {
    return "vendor_concept_operation_category";
  }

  if (toggles.concept && hasCounterparty && availableScopes.has("vendor_concept")) {
    return "vendor_concept";
  }

  if (toggles.concept && availableScopes.has("concept_global")) {
    return "concept_global";
  }

  if (hasCounterparty && availableScopes.has("vendor_default")) {
    return "vendor_default";
  }

  return "none";
}

function stripMarkdown(value: string | null | undefined) {
  return value
    ? value.replace(/[`*_>#-]/g, " ").replace(/\s+/g, " ").trim()
    : null;
}

function formatMoney(value: number | null | undefined, currency = "UYU") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  const normalizedCurrency = currency.trim().toUpperCase();

  try {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("es-UY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

function formatConfidence(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : "sin score";
}

function formatZetaExportStatus(value: ZetaPurchaseInvoiceExportResult["status"]) {
  switch (value) {
    case "dry_run_ready":
      return "Listo para enviar";
    case "blocked":
      return "Bloqueado";
    case "not_ready":
      return "No listo";
    case "success_pending_reconciliation":
      return "Enviado";
    case "found_in_zeta":
      return "Encontrado en Zeta";
    case "already_exists_in_zeta":
      return "Ya existe en Zeta";
    case "amount_mismatch":
      return "Importes no cierran";
    case "timeout_unknown":
      return "Timeout sin certeza";
    case "zeta_error":
      return "Error Zeta";
    case "sent":
      return "Enviado";
    default:
      return "Estado Zeta";
  }
}

function zetaStatusTone(value: ZetaPurchaseInvoiceExportResult["status"]) {
  return value === "dry_run_ready" || value === "success_pending_reconciliation" || value === "found_in_zeta"
    ? "success"
    : value === "not_ready" || value === "blocked" || value === "timeout_unknown" || value === "zeta_error"
      ? "warning"
      : "neutral";
}

function getInvoiceCode(pageData: DocumentReviewPageData) {
  const number = pageData.draft.facts.document_number?.trim();
  const series = pageData.draft.facts.series?.trim();

  if (series && number) {
    return `${series} ${number}`;
  }

  if (number) {
    return number;
  }

  if (series) {
    return series;
  }

  return pageData.document.id.slice(0, 8);
}

function buildBlockingMessage(blockers: string[]) {
  return blockers.join(" ") || "No pudimos guardar el draft.";
}

export function DocumentReviewRuleWorkspace({
  slug,
  organizationName,
  pageData,
  saveDraftReviewAction,
  confirmManualAssignmentAction,
  createReviewAccountAction,
  saveLearningRuleAction,
  exportPurchaseExpenseToZetaAction,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingInlineAction, setPendingInlineAction] = useState<PendingInlineAction>(null);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string }>({
    tone: "neutral",
    text: "",
  });
  const [availableAccounts, setAvailableAccounts] = useState<ReviewAccountOption[]>(() =>
    sortReviewAccounts(pageData.accountingOptions.accounts));
  const [accountSearch, setAccountSearch] = useState("");
  const [manualRoleOverrides, setManualRoleOverrides] = useState<ReviewManualRoleOverrides>(() =>
    buildInitialManualRoleOverrides(pageData));
  const [newReviewAccount, setNewReviewAccount] = useState({
    code: "",
    name: "",
  });
  const [showCreateAccountForm, setShowCreateAccountForm] = useState(false);
  const initialScope =
    pageData.learningSuggestions.recommendedScope !== "none"
      ? pageData.learningSuggestions.recommendedScope
      : pageData.learningSuggestions.options[0]?.scope ?? "none";
  const [ruleToggles, setRuleToggles] = useState<RuleToggleState>(() =>
    buildInitialRuleToggles({
      facts: pageData.draft.facts,
      scope: initialScope,
    }));
  const [learnedConceptName, setLearnedConceptName] = useState(
    pageData.derived.accountingContext.learnedConceptName
      ?? pageData.learningSuggestions.suggestedConceptName
      ?? pageData.derived.conceptResolution.primaryConceptLabels[0]
      ?? "",
  );

  useEffect(() => {
    const nextScope =
      pageData.learningSuggestions.recommendedScope !== "none"
        ? pageData.learningSuggestions.recommendedScope
        : pageData.learningSuggestions.options[0]?.scope ?? "none";

    setAvailableAccounts(sortReviewAccounts(pageData.accountingOptions.accounts));
    setManualRoleOverrides(buildInitialManualRoleOverrides(pageData));
    setRuleToggles(buildInitialRuleToggles({
      facts: pageData.draft.facts,
      scope: nextScope,
    }));
    setLearnedConceptName(
      pageData.derived.accountingContext.learnedConceptName
        ?? pageData.learningSuggestions.suggestedConceptName
        ?? pageData.derived.conceptResolution.primaryConceptLabels[0]
        ?? "",
    );
    setNewReviewAccount({
      code: "",
      name: "",
    });
    setShowCreateAccountForm(false);
    setAccountSearch("");
    setFeedback({
      tone: "neutral",
      text: "",
    });
    setPendingAction(null);
    setPendingInlineAction(null);
  }, [pageData]);

  const invoiceCode = getInvoiceCode(pageData);
  const counterpartyName =
    pageData.derived.vendorResolution.vendorName
    ?? pageData.draft.facts.issuer_name
    ?? pageData.document.originalFilename;
  const currencyCode =
    pageData.draft.facts.currency_code
    ?? pageData.derived.monetarySnapshot?.currencyCode
    ?? pageData.derived.journalSuggestion.currencyCode
    ?? "UYU";
  const totalAmount =
    pageData.draft.facts.total_amount
    ?? pageData.derived.monetarySnapshot?.totalAmountOriginal
    ?? pageData.derived.taxTreatment.totalAmountUyu
    ?? null;
  const criteriaText =
    stripMarkdown(pageData.derived.assistantSuggestion.rationale)
    ?? stripMarkdown(pageData.assistantRail?.latestMessage?.structuredPayload.summaryMd)
    ?? stripMarkdown(pageData.derived.journalSuggestion.explanation)
    ?? "Todavia no hay un criterio visible para este documento.";
  const confidenceText = formatConfidence(
    pageData.derived.assistantSuggestion.confidence
    ?? pageData.certaintySummary.confidence
    ?? pageData.draft.sourceConfidence,
  );
  const derivedLearningScope = deriveLearningScopeFromToggles(
    ruleToggles,
    pageData.learningSuggestions.options,
  );
  const selectedLearningOption =
    pageData.learningSuggestions.options.find((option) => option.scope === derivedLearningScope)
    ?? null;
  const appliedRuleScope =
    pageData.derived.appliedRule.ruleId && pageData.derived.appliedRule.scope !== "assistant"
      ? pageData.derived.appliedRule.scope
      : null;
  const relatedRulesHref = pageData.derived.appliedRule.ruleId
    ? `/app/o/${slug}/rules/${pageData.derived.appliedRule.ruleId}`
    : `/app/o/${slug}/rules`;
  const journalLineByRole = useMemo(() => {
    const next = new Map<AccountRoleCode, DocumentReviewPageData["derived"]["journalSuggestion"]["lines"][number]>();

    for (const line of pageData.derived.journalSuggestion.lines) {
      if (line.roleCode && !next.has(line.roleCode)) {
        next.set(line.roleCode, line);
      }
    }

    return next;
  }, [pageData.derived.journalSuggestion.lines]);
  const conceptLabel =
    learnedConceptName.trim()
    || pageData.learningSuggestions.suggestedConceptName
    || pageData.derived.conceptResolution.primaryConceptLabels[0]
    || "Concepto detectado";
  const zetaExport = pageData.zetaPurchaseExpenseExport;
  const roleRows = useMemo(() =>
    pageData.accountRoleAssignments.map((assignment, index) => {
      const overrideAccountId = manualRoleOverrides[assignment.roleCode]?.trim() || "";
      const selectedAccountId = overrideAccountId || assignment.accountId || "";
      const selectedAccount = selectedAccountId
        ? availableAccounts.find((account) => account.id === selectedAccountId) ?? null
        : null;
      const compatibleAccounts = availableAccounts.filter((account) =>
        isAccountCompatibleWithRole(account, assignment.roleCode));
      const normalizedSearch = accountSearch.trim().toLowerCase();
      const filteredAccounts = normalizedSearch
        ? compatibleAccounts.filter((account) =>
          searchableAccountText(account).includes(normalizedSearch))
        : compatibleAccounts;
      const selectableAccounts = selectedAccount
        && !filteredAccounts.some((account) => account.id === selectedAccount.id)
        ? [selectedAccount, ...filteredAccounts]
        : filteredAccounts;
      const journalLine =
        journalLineByRole.get(assignment.roleCode)
        ?? pageData.derived.journalSuggestion.lines[index]
        ?? null;
      const amount = journalLine
        ? (journalLine.debit > 0 ? journalLine.debit : journalLine.credit)
        : null;
      const side =
        journalLine?.debit && journalLine.debit > 0
          ? "Debe"
          : journalLine?.credit && journalLine.credit > 0
            ? "Haber"
            : "--";
      const note =
        journalLine?.linePurpose === "main"
          ? conceptLabel
          : journalLine?.linePurpose === "tax"
            ? "IVA automatico"
            : journalLine?.linePurpose === "counterparty"
              ? counterpartyName
              : assignment.provenance ?? "Linea automatica";

      return {
        assignment,
        overrideAccountId,
        selectedAccountId,
        selectedAccount,
        selectableAccounts,
        amount,
        side,
        note,
      };
    }), [
      accountSearch,
      availableAccounts,
      conceptLabel,
      counterpartyName,
      journalLineByRole,
      manualRoleOverrides,
      pageData.accountRoleAssignments,
      pageData.derived.journalSuggestion.lines,
    ]);
  const primaryRoleCode =
    pageData.derived.settlementContext.primaryAccountRole
    ?? pageData.accountRoleAssignments.find((assignment) => assignment.linePurpose === "main")?.roleCode
    ?? null;
  const primaryRoleRow =
    (primaryRoleCode
      ? roleRows.find((row) => row.assignment.roleCode === primaryRoleCode)
      : null)
    ?? roleRows.find((row) => row.assignment.linePurpose === "main")
    ?? roleRows[0]
    ?? null;
  const vatRoleRow =
    roleRows.find((row) => row.assignment.linePurpose === "tax")
    ?? roleRows.find((row) =>
      row.assignment.roleCode === "input_vat_account"
      || row.assignment.roleCode === "output_vat_account")
    ?? null;
  const counterpartyRoleRow =
    roleRows.find((row) => row.assignment.linePurpose === "counterparty")
    ?? roleRows.find((row) =>
      row.assignment.roleCode === "accounts_payable_account"
      || row.assignment.roleCode === "accounts_receivable_account")
    ?? null;
  const selectedPrimaryAccountLabel =
    primaryRoleRow?.selectedAccount
      ? formatReviewAccountLabel(primaryRoleRow.selectedAccount)
      : primaryRoleRow?.assignment.accountLabel ?? "Sin cuenta principal resuelta";
  const primaryCompatibleAccounts = useMemo(() => {
    if (!primaryRoleRow) {
      return [] as ReviewAccountOption[];
    }

    return availableAccounts.filter((account) =>
      isAccountCompatibleWithRole(account, primaryRoleRow.assignment.roleCode));
  }, [availableAccounts, primaryRoleRow]);
  const primarySearchResults = useMemo(() => {
    const normalizedSearch = accountSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return [] as ReviewAccountOption[];
    }

    return primaryCompatibleAccounts.filter((account) =>
      searchableAccountText(account).includes(normalizedSearch)).slice(0, 8);
  }, [accountSearch, primaryCompatibleAccounts]);
  const canCreatePrimaryAccountInline =
    primaryRoleRow?.assignment.roleCode === "revenue_account"
    || primaryRoleRow?.assignment.roleCode === "expense_account";
  const manualAssignmentReady = Boolean(primaryRoleRow?.selectedAccount?.id ?? primaryRoleRow?.selectedAccountId?.trim());
  const canSaveRuleNow =
    pageData.canSaveLearningRule
    && derivedLearningScope !== "none"
    && (!selectedLearningOption?.requiresConceptName || learnedConceptName.trim().length > 0);

  function buildManualRoleOverridesPayload(sourceOverrides: ReviewManualRoleOverrides = manualRoleOverrides) {
    return Object.fromEntries(
      pageData.accountRoleAssignments.map((assignment) => [
        assignment.roleCode,
        sourceOverrides[assignment.roleCode]?.trim() || null,
      ]),
    ) as ManualAccountRoleOverrides;
  }

  function buildAccountingContextPayload(sourceOverrides: ReviewManualRoleOverrides = manualRoleOverrides) {
    const nextManualRoleOverrides = buildManualRoleOverridesPayload(sourceOverrides);
    const primaryRole = pageData.derived.settlementContext.primaryAccountRole;
    const paymentTerms =
      pageData.derived.accountingContext.paymentTerms
      ?? pageData.derived.settlementContext.paymentTerms
      ?? null;

    return {
      accountingContext: {
        userFreeText: pageData.derived.accountingContext.userFreeText ?? null,
        businessPurposeNote:
          pageData.derived.accountingContext.businessPurposeNote
          ?? pageData.derived.taxTreatment.businessPurposeNote
          ?? null,
        manualOverrideAccountId:
          primaryRole
            ? nextManualRoleOverrides[primaryRole] ?? null
            : pageData.derived.accountingContext.manualOverrideAccountId ?? null,
        manualRoleOverrides: nextManualRoleOverrides,
        learnedConceptName: learnedConceptName.trim() || null,
        operationKind:
          pageData.derived.accountingContext.operationKind
          ?? pageData.derived.settlementContext.operationKind
          ?? null,
        paymentTerms,
        settlementMethod:
          paymentTerms === "credit"
            ? "unknown"
            : pageData.derived.accountingContext.settlementMethod
              ?? pageData.derived.settlementContext.settlementMethod
              ?? null,
        settlementEvidenceSource:
          pageData.derived.accountingContext.settlementEvidenceSource
          ?? pageData.derived.settlementContext.settlementEvidenceSource
          ?? null,
      },
    };
  }

  function setRoleOverride(
    roleCode: AccountRoleCode,
    nextAccountId: string,
    suggestedAccountId?: string | null,
  ) {
    setManualRoleOverrides((current) => ({
      ...current,
      [roleCode]:
        nextAccountId && nextAccountId !== (suggestedAccountId ?? "")
          ? nextAccountId
          : "",
    }));
  }

  function validateAccountSelections() {
    for (const row of roleRows) {
      if (!row.overrideAccountId) {
        continue;
      }

      const account = availableAccounts.find((candidate) => candidate.id === row.overrideAccountId) ?? null;

      if (!account) {
        return (
          `La cuenta elegida para ${formatAccountRoleCodeLabel(row.assignment.roleCode).toLowerCase()} `
          + "ya no esta disponible."
        );
      }

      if (!isAccountCompatibleWithRole(account, row.assignment.roleCode)) {
        return (
          `La cuenta elegida (${formatReviewAccountLabel(account)}) `
          + `no sirve como ${formatAccountRoleCodeLabel(row.assignment.roleCode).toLowerCase()}.`
        );
      }
    }

    return null;
  }

  async function saveAccountingContext(successMessage: string) {
    const invalidSelectionMessage = validateAccountSelections();

    if (invalidSelectionMessage) {
      setFeedback({
        tone: "danger",
        text: invalidSelectionMessage,
      });
      return { ok: false, message: invalidSelectionMessage };
    }

    const result = await saveDraftReviewAction({
      stepCode: "accounting_context",
      payload: buildAccountingContextPayload(),
    });
    const message = result.ok ? successMessage : buildBlockingMessage(result.blockers);

    setFeedback({
      tone: result.ok ? "success" : "danger",
      text: message,
    });

    return {
      ok: result.ok,
      message,
    };
  }

  function handleSaveDraft() {
    setPendingAction("draft");
    startTransition(async () => {
      try {
        const result = await saveAccountingContext("Draft guardado.");

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setFeedback({
          tone: "danger",
          text: error instanceof Error ? error.message : "No pudimos guardar el draft.",
        });
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleConfirmAccounts() {
    setPendingAction("confirm_accounts");
    startTransition(async () => {
      try {
        const result = await confirmManualAssignmentAction({
          manualRoleOverrides: buildManualRoleOverridesPayload(),
        });

        setFeedback({
          tone: result.ok ? "success" : "danger",
          text: result.message,
        });

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setFeedback({
          tone: "danger",
          text:
            error instanceof Error
              ? error.message
              : "No pudimos confirmar el asiento contable.",
        });
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleSaveRule() {
    if (derivedLearningScope === "none") {
      setFeedback({
        tone: "danger",
        text: "No hay un criterio reusable disponible con la combinacion elegida.",
      });
      return;
    }

    if (selectedLearningOption?.requiresConceptName && !learnedConceptName.trim()) {
      setFeedback({
        tone: "danger",
        text: "Escribe un nombre canonico para el concepto antes de crear la regla.",
      });
      return;
    }

    setPendingAction("save_rule");
    startTransition(async () => {
      try {
        const draftResult = await saveAccountingContext("Contexto listo para automatizar.");

        if (!draftResult.ok) {
          return;
        }

        const result = await saveLearningRuleAction({
          learning: {
            scope: derivedLearningScope,
            learnedConceptName: learnedConceptName.trim() || null,
          },
        });

        setFeedback({
          tone: result.ok ? "success" : "danger",
          text: result.message,
        });

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setFeedback({
          tone: "danger",
          text:
            error instanceof Error
              ? error.message
              : "No pudimos crear la regla deterministica.",
        });
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleZetaExport(dryRun: boolean) {
    setPendingAction(dryRun ? "zeta_validate" : "zeta_export");
    startTransition(async () => {
      try {
        const result = await exportPurchaseExpenseToZetaAction({ dryRun });

        setFeedback({
          tone: result.ok ? "success" : "danger",
          text: result.message,
        });

        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "danger",
          text: error instanceof Error
            ? error.message
            : "No pudimos procesar la exportacion a Zeta.",
        });
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleCreatePrimaryAccount() {
    if (!primaryRoleRow) {
      setFeedback({
        tone: "danger",
        text: "No encontramos una cuenta principal editable para este documento.",
      });
      return;
    }

    const code = newReviewAccount.code.trim();
    const name = newReviewAccount.name.trim();

    if (!code || !name) {
      setFeedback({
        tone: "danger",
        text: "Completa codigo y nombre para crear la cuenta principal.",
      });
      return;
    }

    setPendingInlineAction("create_account");
    startTransition(async () => {
      try {
        const created = await createReviewAccountAction({ code, name });

        if (!created.ok || !created.account) {
          setFeedback({
            tone: "danger",
            text: created.message || "No se pudo crear la cuenta principal.",
          });
          return;
        }

        const nextManualRoleOverrides = {
          ...manualRoleOverrides,
          [primaryRoleRow.assignment.roleCode]: created.account.id,
        };
        setAvailableAccounts(sortReviewAccounts([
          ...availableAccounts.filter((account) => account.id !== created.account?.id),
          created.account,
        ]));
        setManualRoleOverrides(nextManualRoleOverrides);
        setNewReviewAccount({
          code: "",
          name: "",
        });
        setShowCreateAccountForm(false);
        setAccountSearch("");

        const saved = await saveDraftReviewAction({
          stepCode: "accounting_context",
          payload: buildAccountingContextPayload(nextManualRoleOverrides),
        });
        const message = saved.ok
          ? `Cuenta ${created.account.code} creada y aplicada a la resolucion.`
          : buildBlockingMessage(saved.blockers);
        setFeedback({
          tone: saved.ok ? "success" : "danger",
          text: message,
        });

        if (saved.ok) {
          router.refresh();
        }
      } catch (error) {
        setFeedback({
          tone: "danger",
          text: error instanceof Error ? error.message : "No pudimos crear la cuenta principal.",
        });
      } finally {
        setPendingInlineAction(null);
      }
    });
  }

  function renderAccountSelector(
    row: typeof roleRows[number] | null,
    label: string,
    placeholder: string,
  ) {
    if (!row) {
      return null;
    }

    return (
      <label className="review-rule-linked-field">
        <span>{label}</span>
        <select
          value={row.selectedAccountId}
          onChange={(event) => {
            setRoleOverride(
              row.assignment.roleCode,
              event.target.value,
              row.assignment.accountId,
            );
          }}
          className="review-rule-input"
        >
          <option value="">{placeholder}</option>
          {row.selectableAccounts.map((account) => (
            <option key={`${row.assignment.roleCode}-${account.id}`} value={account.id}>
              {isZetaAccount(account) ? "[Zeta] " : ""}
              {formatReviewAccountLabel(account)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="review-rule-shell">
      <div className="review-rule-page-header">
        <div>
          <h1 className="review-rule-page-title">Revision Documental y Reglas</h1>
          <p className="review-rule-page-subtitle">{counterpartyName}</p>
        </div>

        <div className="review-rule-breadcrumb">
          <span>{organizationName}</span>
          <span className="review-rule-breadcrumb__separator">{">"}</span>
          <LoadingLink
            href={`/app/o/${slug}/documents`}
            pendingLabel="Volviendo..."
            className="review-rule-breadcrumb__link"
          >
            Bandeja Documental
          </LoadingLink>
          <span className="review-rule-breadcrumb__separator">{">"}</span>
          <span>Revision Factura {invoiceCode}</span>
        </div>
      </div>

      <div className="review-rule-grid">
        <aside className="review-rule-sidebar">
          <section className="review-rule-card">
            <div className="review-rule-card__header">
              <h2>Detalle de Factura N&deg; {invoiceCode}</h2>
              <div className="flex flex-wrap gap-2">
                <JournalEntryModalTrigger
                  organizationSlug={slug}
                  documentTitle={`Factura ${invoiceCode}`}
                  auditState={pageData.journalAuditState}
                  preview={pageData.accountingImpactPreview}
                />
                <DocumentOriginalModalTrigger
                  previewUrl={pageData.document.previewUrl}
                  mimeType={pageData.document.mimeType}
                  originalFilename={pageData.document.originalFilename}
                  triggerLabel="Ver original"
                  triggerClassName={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                  modalTitle={pageData.document.originalFilename}
                  modalDescription="Original cargado por la organizacion."
                />
              </div>
            </div>

            <div className="review-rule-detail-grid">
              <div className="review-rule-preview-frame">
                <DocumentPreview
                  previewUrl={pageData.document.previewUrl}
                  mimeType={pageData.document.mimeType}
                  originalFilename={pageData.document.originalFilename}
                  variant="sheet"
                />
              </div>

              <div className="review-rule-fact-list">
                <div className="review-rule-fact">
                  <span>RUT Emisor</span>
                  <strong>{pageData.draft.facts.issuer_tax_id ?? "Sin dato"}</strong>
                </div>
                <div className="review-rule-fact">
                  <span>RUT Receptor</span>
                  <strong>{pageData.draft.facts.receiver_tax_id ?? "Sin dato"}</strong>
                </div>
                <div className="review-rule-fact">
                  <span>Moneda</span>
                  <strong>{currencyCode}</strong>
                </div>
                <div className="review-rule-fact review-rule-fact--total">
                  <span>Monto Total</span>
                  <strong>{formatMoney(totalAmount, currencyCode)}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="review-rule-card">
            <div className="review-rule-card__header">
              <h2>Estado de Reglas</h2>
              <span
                className="review-rule-chip"
                data-tone={appliedRuleScope ? "success" : "neutral"}
              >
                {appliedRuleScope ? "Regla activa" : "Sin regla"}
              </span>
            </div>

            <p className="review-rule-text">
              {appliedRuleScope
                ? `Hoy aplica ${formatRuleScopeLabel(appliedRuleScope).toLowerCase()}.`
                : "No existen reglas para este RUT emisor o combinacion."}
            </p>

            <div className="review-rule-note">
              <p className="review-rule-note__label">Sugerencia</p>
              <p className="review-rule-note__text">
                Factura N&deg; {invoiceCode}: {criteriaText}
              </p>
              <p className="review-rule-note__meta">Confianza visible: {confidenceText}.</p>
            </div>
          </section>
        </aside>

        <section className="review-rule-main">
          <div className="review-rule-mainbar">
            Analisis de IA y decision contable / regla
          </div>

          <div className="review-rule-main-title">
            <p>
              {formatPostingTemplateCodeLabel(pageData.derived.journalSuggestion.templateCode)}
              {" | "}
              Balance {formatMoney(pageData.derived.journalSuggestion.totalDebit, currencyCode)}
            </p>
            <h2>Revisar y Automatizar</h2>
          </div>

          <div className="review-rule-panels">
            <section className="review-rule-card">
              <div className="review-rule-card__header review-rule-card__header--stack">
                <div>
                  <h2>Resolver impacto contable</h2>
                  <p>Cuenta sugerida, IVA y contrapartida en una sola vista.</p>
                </div>
              </div>

              <div className="review-rule-account-summary">
                <div>
                  <span>Cuenta principal actual</span>
                  <strong>{selectedPrimaryAccountLabel}</strong>
                </div>
                <div>
                  <span>Cuentas compatibles</span>
                  <strong>{primaryCompatibleAccounts.length}</strong>
                </div>
              </div>

              <label className="review-rule-search">
                <span>Cuenta principal (Buscar por codigo o nombre)</span>
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(event) => {
                    setAccountSearch(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && primaryRoleRow && primarySearchResults[0]) {
                      event.preventDefault();
                      setRoleOverride(
                        primaryRoleRow.assignment.roleCode,
                        primarySearchResults[0].id,
                        primaryRoleRow.assignment.accountId,
                      );
                      setAccountSearch("");
                    }
                  }}
                  placeholder="Cuenta (Buscar por codigo o nombre)"
                  className="review-rule-input"
                />
                <p className="review-rule-search__hint">
                  {primaryRoleRow
                    ? `Actual: ${selectedPrimaryAccountLabel}.`
                    : "No hay una cuenta principal editable para este documento."}
                </p>
              </label>

              {accountSearch.trim() ? (
                <div className="review-rule-search-results">
                  {primarySearchResults.length > 0 ? primarySearchResults.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        if (!primaryRoleRow) {
                          return;
                        }

                        setRoleOverride(
                          primaryRoleRow.assignment.roleCode,
                          account.id,
                          primaryRoleRow.assignment.accountId,
                        );
                        setAccountSearch("");
                      }}
                      className="review-rule-search-option"
                    >
                      <span>
                        <strong>{formatReviewAccountLabel(account)}</strong>
                        <small>
                          {formatAccountTypeLabel(account.accountType)}
                          {isZetaAccount(account) ? " | Zeta" : ""}
                          {account.isProvisional ? " | Provisoria" : ""}
                        </small>
                      </span>
                      <span>Usar</span>
                    </button>
                  )) : (
                    <div className="review-rule-search-empty">
                      No encontramos cuentas compatibles con esa busqueda.
                    </div>
                  )}
                </div>
              ) : null}

              {canCreatePrimaryAccountInline ? (
                <div className="review-rule-inline-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAccountForm((current) => !current);
                    }}
                    className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
                  >
                    {showCreateAccountForm ? "Ocultar alta de cuenta" : "No encuentro la cuenta principal"}
                  </button>
                </div>
              ) : null}

              {showCreateAccountForm && canCreatePrimaryAccountInline ? (
                <div className="review-rule-create-account">
                  <div className="review-rule-create-account__grid">
                    <label>
                      <span>Codigo</span>
                      <input
                        type="text"
                        value={newReviewAccount.code}
                        onChange={(event) => {
                          setNewReviewAccount((current) => ({
                            ...current,
                            code: event.target.value,
                          }));
                        }}
                        placeholder={pageData.draft.documentRole === "sale" ? "Ej. 4105" : "Ej. 6105"}
                        className="review-rule-input"
                      />
                    </label>
                    <label>
                      <span>Nombre</span>
                      <input
                        type="text"
                        value={newReviewAccount.name}
                        onChange={(event) => {
                          setNewReviewAccount((current) => ({
                            ...current,
                            name: event.target.value,
                          }));
                        }}
                        placeholder="Nombre de la cuenta"
                        className="review-rule-input"
                      />
                    </label>
                  </div>
                  <p className="review-rule-search__hint">
                    La cuenta se crea como postable y queda asignada a esta resolucion.
                  </p>
                  <div className="review-rule-inline-actions">
                    <button
                      type="button"
                      onClick={handleCreatePrimaryAccount}
                      disabled={isPending}
                      className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
                    >
                      {pendingInlineAction === "create_account" && isPending ? <InlineSpinner /> : null}
                      Crear cuenta y usarla
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateAccountForm(false);
                      }}
                      className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="review-rule-table">
                <div className="review-rule-table__head">
                  <span>Cuenta</span>
                  <span>Lado</span>
                  <span>Monto</span>
                  <span>Glosa</span>
                  <span>Accion</span>
                </div>

                <div className="review-rule-table__body">
                  {roleRows.map((row) => (
                    <div key={row.assignment.roleCode} className="review-rule-table__row">
                      <div className="review-rule-role">
                        <span className="review-rule-role__label">
                          {formatAccountRoleCodeLabel(row.assignment.roleCode)}
                        </span>
                        <select
                          value={row.selectedAccountId}
                          onChange={(event) => {
                            setRoleOverride(
                              row.assignment.roleCode,
                              event.target.value,
                              row.assignment.accountId,
                            );
                          }}
                          className="review-rule-input"
                        >
                          <option value="">
                            {row.assignment.accountLabel ?? "Selecciona una cuenta"}
                          </option>
                          {row.selectableAccounts.map((account) => (
                            <option key={`${row.assignment.roleCode}-${account.id}`} value={account.id}>
                              {isZetaAccount(account) ? "[Zeta] " : ""}
                              {formatReviewAccountLabel(account)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="review-rule-table__side">{row.side}</div>
                      <div className="review-rule-table__amount">
                        {formatMoney(row.amount, currencyCode)}
                      </div>
                      <div className="review-rule-table__note">{row.note}</div>

                      <button
                        type="button"
                        onClick={() => {
                          setRoleOverride(row.assignment.roleCode, "", row.assignment.accountId);
                        }}
                        className="review-rule-icon-button"
                        aria-label={`Limpiar ${formatAccountRoleCodeLabel(row.assignment.roleCode)}`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5.5 6.5h9" />
                          <path d="M7 6.5V5.4c0-.77.63-1.4 1.4-1.4h3.2c.77 0 1.4.63 1.4 1.4v1.1" />
                          <path d="m7.2 8.5.6 7.1h4.4l.6-7.1" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="review-rule-actions">
                <button
                  type="button"
                  onClick={handleConfirmAccounts}
                  disabled={!manualAssignmentReady || isPending}
                  className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} review-rule-action-button`}
                >
                  {pendingAction === "confirm_accounts" && isPending ? <InlineSpinner /> : null}
                  Confirmar asignacion contable
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isPending}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} review-rule-action-button`}
                >
                  {pendingAction === "draft" && isPending ? <InlineSpinner /> : null}
                  Guardar Draft
                </button>
              </div>
            </section>

            <section className="review-rule-card">
              <div className="review-rule-card__header review-rule-card__header--stack">
                <div>
                  <h2>Crear Regla Deterministica</h2>
                  <p>Para automatizar futuros documentos similares.</p>
                </div>
              </div>

              <div className="review-rule-toggle-list">
                {([
                  {
                    key: "issuer" as RuleToggleKey,
                    label: `RUT Emisor (${pageData.draft.facts.issuer_tax_id ?? "sin dato"})`,
                    disabled: !pageData.draft.facts.issuer_tax_id,
                  },
                  {
                    key: "receiver" as RuleToggleKey,
                    label: `RUT Receptor (${pageData.draft.facts.receiver_tax_id ?? "sin dato"})`,
                    disabled: !pageData.draft.facts.receiver_tax_id,
                  },
                  {
                    key: "concept" as RuleToggleKey,
                    label: `Concepto Detectado (${conceptLabel})`,
                    disabled: !conceptLabel.trim(),
                  },
                ] satisfies Array<{
                  key: RuleToggleKey;
                  label: string;
                  disabled: boolean;
                }>).map((item) => (
                  <label
                    key={item.key}
                    className="review-rule-toggle"
                    data-disabled={item.disabled ? "true" : undefined}
                  >
                    <span className="review-rule-toggle__main">
                      <span className="review-rule-switch">
                        <input
                          type="checkbox"
                          checked={ruleToggles[item.key]}
                          disabled={item.disabled}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setRuleToggles((current) => ({
                              ...current,
                              [item.key]: checked,
                            }));
                          }}
                        />
                        <span className="review-rule-switch__track" />
                        <span className="review-rule-switch__thumb" />
                      </span>
                      <span className="review-rule-toggle__label">{item.label}</span>
                    </span>

                    <span className="review-rule-toggle__action">Activar Regla</span>
                  </label>
                ))}
              </div>

              <div className="review-rule-scope">
                <span>Alcance resultante</span>
                <strong>
                  {derivedLearningScope === "none"
                    ? "Sin alcance reusable"
                    : formatRuleScopeLabel(derivedLearningScope)}
                </strong>
                <p>{selectedLearningOption?.reason ?? "Se guardara con la mejor combinacion disponible."}</p>
              </div>

              <div className="review-rule-linked-fields">
                <label className="review-rule-linked-field">
                  <span>Asignar criterio para esta regla</span>
                  <input
                    type="text"
                    value={learnedConceptName}
                    onChange={(event) => {
                      setLearnedConceptName(event.target.value);
                    }}
                    placeholder={pageData.learningSuggestions.suggestedConceptName ?? "Ej. Combustibles"}
                    className="review-rule-input"
                  />
                </label>

                {renderAccountSelector(
                  primaryRoleRow,
                  "Cuenta Automatica",
                  "Cuenta principal sugerida",
                )}
                {renderAccountSelector(
                  vatRoleRow,
                  "IVA Automatico",
                  "Cuenta IVA sugerida",
                )}
                {renderAccountSelector(
                  counterpartyRoleRow,
                  "Pasivo / Contrapartida Automatizada",
                  "Cuenta contrapartida sugerida",
                )}
              </div>

              <div className="review-rule-actions review-rule-actions--compact">
                <button
                  type="button"
                  onClick={handleSaveRule}
                  disabled={!canSaveRuleNow || isPending}
                  className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} review-rule-action-button`}
                >
                  {pendingAction === "save_rule" && isPending ? <InlineSpinner /> : null}
                  Crear y Activar Regla para RUT/Concepto
                </button>

                <LoadingLink
                  href={relatedRulesHref}
                  pendingLabel="Abriendo..."
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} review-rule-action-button`}
                >
                  Reglas Relacionadas Existentes
                </LoadingLink>
              </div>
            </section>
          </div>

          {zetaExport ? (
            <section className="review-rule-card">
              <div className="review-rule-card__header review-rule-card__header--stack">
                <div>
                  <h2>Enviar gasto a Zeta</h2>
                  <p>Factura de proveedor operativa, no asiento manual.</p>
                </div>
                <span
                  className="review-rule-chip"
                  data-tone={zetaStatusTone(zetaExport.status)}
                >
                  {formatZetaExportStatus(zetaExport.status)}
                </span>
              </div>

              {zetaExport.preview.purchaseKind === "merchandise" ? (
                <div className="review-rule-note">
                  <p className="review-rule-note__label">Mercaderia</p>
                  <p className="review-rule-note__text">
                    Esta factura parece ser una compra de mercaderia. Para exportarla a Zeta se requiere resolver articulos de stock. Esta fase todavia no exporta mercaderia.
                  </p>
                </div>
              ) : null}

              {zetaExport.preview.paidByPartnerMessage ? (
                <div className="review-rule-note">
                  <p className="review-rule-note__label">Pago por socio</p>
                  <p className="review-rule-note__text">{zetaExport.preview.paidByPartnerMessage}</p>
                </div>
              ) : null}

              <div className="review-rule-fact-list">
                <div className="review-rule-fact">
                  <span>Proveedor Zeta</span>
                  <strong>
                    {zetaExport.preview.zetaSupplierCode
                      ? `${zetaExport.preview.zetaSupplierCode} - ${zetaExport.preview.supplierName ?? "Sin nombre"}`
                      : "Pendiente"}
                  </strong>
                </div>
                <div className="review-rule-fact">
                  <span>RUT</span>
                  <strong>{zetaExport.preview.supplierRut ?? "Sin dato"}</strong>
                </div>
                <div className="review-rule-fact">
                  <span>Comprobante Zeta</span>
                  <strong>
                    {zetaExport.preview.comprobanteCode
                      ? `${zetaExport.preview.comprobanteCode} - ${zetaExport.preview.comprobanteName ?? "Comprobante"}`
                      : "Pendiente"}
                  </strong>
                </div>
                <div className="review-rule-fact">
                  <span>Serie / Numero</span>
                  <strong>{zetaExport.preview.serie ?? "-"} / {zetaExport.preview.numero ?? "-"}</strong>
                </div>
                <div className="review-rule-fact">
                  <span>Fecha</span>
                  <strong>{zetaExport.preview.fecha ?? "Pendiente"}</strong>
                </div>
                <div className="review-rule-fact">
                  <span>Moneda / Cotizacion</span>
                  <strong>
                    {zetaExport.preview.monedaCode ?? "Pendiente"}
                    {" / "}
                    {zetaExport.preview.cotizacion ?? "N/A"}
                  </strong>
                </div>
                <div className="review-rule-fact">
                  <span>Condicion</span>
                  <strong>{zetaExport.preview.conditionCode ?? "Pendiente"}</strong>
                </div>
                <div className="review-rule-fact">
                  <span>Forma de pago</span>
                  <strong>{zetaExport.preview.paymentMethodCode ?? "No aplica"}</strong>
                </div>
              </div>

              <div className="review-rule-table">
                <div className="review-rule-table__head">
                  <span>Concepto Zeta</span>
                  <span>IVA</span>
                  <span>Neto</span>
                  <span>Total</span>
                  <span>Detalle</span>
                </div>
                <div className="review-rule-table__body">
                  {zetaExport.preview.lines.length > 0 ? zetaExport.preview.lines.map((line, index) => (
                    <div key={`${line.conceptCode}-${line.ivaCode}-${index}`} className="review-rule-table__row">
                      <div className="review-rule-role">
                        <span className="review-rule-role__label">
                          {line.conceptCode ?? "Pendiente"}
                        </span>
                        <span>{line.conceptName ?? "Concepto de gasto"}</span>
                      </div>
                      <div className="review-rule-table__side">{line.ivaCode ?? "-"}</div>
                      <div className="review-rule-table__amount">{formatMoney(line.netAmount, currencyCode)}</div>
                      <div className="review-rule-table__amount">{formatMoney(line.totalAmount, currencyCode)}</div>
                      <div className="review-rule-table__note">{line.description}</div>
                    </div>
                  )) : (
                    <div className="review-rule-search-empty">
                      Todavia no hay lineas listas para enviar a Zeta.
                    </div>
                  )}
                </div>
              </div>

              {zetaExport.blockers.length > 0 ? (
                <div className="review-rule-note">
                  <p className="review-rule-note__label">Blockers</p>
                  <ul className="review-rule-note__text">
                    {zetaExport.blockers.map((blocker) => (
                      <li key={`${blocker.code}-${blocker.field ?? "general"}`}>{blocker.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="review-rule-actions review-rule-actions--compact">
                <button
                  type="button"
                  onClick={() => handleZetaExport(true)}
                  disabled={isPending}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} review-rule-action-button`}
                >
                  {pendingAction === "zeta_validate" && isPending ? <InlineSpinner /> : null}
                  Validar para Zeta
                </button>
                <button
                  type="button"
                  onClick={() => handleZetaExport(false)}
                  disabled={!zetaExport.exportable || isPending}
                  className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} review-rule-action-button`}
                >
                  {pendingAction === "zeta_export" && isPending ? <InlineSpinner /> : null}
                  Enviar gasto a Zeta
                </button>
              </div>
            </section>
          ) : null}

          {feedback.text ? (
            <div className="review-rule-feedback" data-tone={feedback.tone}>
              {feedback.text}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
