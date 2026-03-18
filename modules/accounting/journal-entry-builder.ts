import {
  buildBlockedJournalSuggestion,
  buildJournalLine,
  buildJournalMonetaryContext,
  finalizeJournalSuggestion,
} from "@/modules/accounting/journal-builder";
import { roundCurrency } from "@/modules/accounting/normalization";
import { resolveAccountRole, type ResolvedAccountRole } from "@/modules/accounting/account-role-resolver";
import type {
  AccountRoleBindingRecord,
  AccountRoleCode,
  DerivedDraftArtifacts,
  DocumentIntakeFactMap,
  DocumentMonetarySnapshot,
  DocumentRoleCandidate,
  DocumentSettlementContext,
  PaymentTerms,
  PostableAccountRecord,
  ResolvedAccountingRule,
  ReviewJournalLine,
  SettlementAllocation,
  SettlementMethod,
  VatEngineResult,
} from "@/modules/accounting/types";

type JournalSettlementLine = {
  roleCode: AccountRoleCode;
  amount: number;
  method: SettlementMethod | "credit";
};

function resolveDocumentTotal(input: {
  facts: DocumentIntakeFactMap;
  taxTreatment: VatEngineResult;
  monetarySnapshot: DocumentMonetarySnapshot | null;
}) {
  return roundCurrency(
    input.taxTreatment.journalSeed?.totalAmount
    ?? input.monetarySnapshot?.totalAmountOriginal
    ?? input.facts.total_amount
    ?? (
      typeof input.facts.subtotal === "number" && typeof input.facts.tax_amount === "number"
        ? input.facts.subtotal + input.facts.tax_amount
        : 0
    ),
  );
}

function resolveSettlementRole(method: SettlementMethod, documentRole: DocumentRoleCandidate) {
  switch (method) {
    case "cash":
      return "cash_account" satisfies AccountRoleCode;
    case "bank_transfer":
      return "bank_account" satisfies AccountRoleCode;
    case "card":
      return "card_clearing_account" satisfies AccountRoleCode;
    case "check":
      return "check_clearing_account" satisfies AccountRoleCode;
    case "unknown":
      return documentRole === "sale"
        ? "cash_sales_unidentified_account"
        : "cash_purchases_unidentified_account";
    default:
      return documentRole === "sale"
        ? "cash_sales_unidentified_account"
        : "cash_purchases_unidentified_account";
  }
}

function buildSettlementAllocations(input: {
  paymentTerms: PaymentTerms;
  settlementMethod: SettlementMethod;
  settlementAllocations: SettlementAllocation[];
  totalAmount: number;
  documentRole: DocumentRoleCandidate;
}): JournalSettlementLine[] {
  if (input.paymentTerms === "credit") {
    return [];
  }

  if (input.settlementMethod === "mixed") {
    return input.settlementAllocations.map((allocation) => ({
      roleCode: resolveSettlementRole(allocation.method, input.documentRole),
      amount: roundCurrency(allocation.amount),
      method: allocation.method,
    }));
  }

  return [
    {
      roleCode: resolveSettlementRole(input.settlementMethod, input.documentRole),
      amount: roundCurrency(input.totalAmount),
      method: input.settlementMethod,
    },
  ];
}

function resolveRequiredRoles(input: {
  documentRole: DocumentRoleCandidate;
  settlementContext: DocumentSettlementContext;
  taxTreatment: VatEngineResult;
}) {
  const roles: AccountRoleCode[] = [];

  if (
    input.settlementContext.primaryAccountRole
    && (
      input.settlementContext.operationKind === "sale_invoice"
      || input.settlementContext.operationKind === "purchase_invoice"
      || input.settlementContext.operationKind === "sale_credit_note"
      || input.settlementContext.operationKind === "purchase_credit_note"
    )
  ) {
    roles.push(input.settlementContext.primaryAccountRole);
  }

  if (
    input.documentRole === "sale"
    && input.settlementContext.operationKind === "sale_invoice"
    && input.taxTreatment.taxAmount > 0
  ) {
    roles.push("output_vat_account");
  }

  if (
    input.documentRole === "purchase"
    && input.settlementContext.operationKind === "purchase_invoice"
    && input.taxTreatment.vatBucket === "input_creditable"
    && input.taxTreatment.taxAmount > 0
  ) {
    roles.push("input_vat_account");
  }

  if (input.settlementContext.paymentTerms === "credit") {
    roles.push(
      input.documentRole === "sale"
        ? "accounts_receivable_account"
        : "accounts_payable_account",
    );
  } else {
    for (const allocation of buildSettlementAllocations({
      paymentTerms: input.settlementContext.paymentTerms,
      settlementMethod: input.settlementContext.settlementMethod,
      settlementAllocations: input.settlementContext.settlementAllocations,
      totalAmount: 0,
      documentRole: input.documentRole,
    })) {
      roles.push(allocation.roleCode);
    }
  }

  return roles.filter((role, index, array) => array.indexOf(role) === index);
}

function resolveRoleMap(input: {
  requiredRoles: AccountRoleCode[];
  accounts: PostableAccountRecord[];
  accountRoleBindings: AccountRoleBindingRecord[];
  appliedRule: ResolvedAccountingRule;
  documentRole: DocumentRoleCandidate;
  currencyCode: string;
  settlementMethod: SettlementMethod;
}) {
  const roleMap = new Map<AccountRoleCode, ResolvedAccountRole>();

  for (const roleCode of input.requiredRoles) {
    roleMap.set(roleCode, resolveAccountRole({
      roleCode,
      accounts: input.accounts,
      appliedRule: input.appliedRule,
      bindings: input.accountRoleBindings,
      documentRole: input.documentRole,
      currencyCode: input.currencyCode,
      settlementMethod: input.settlementMethod,
    }));
  }

  return roleMap;
}

function createLine(input: {
  lines: ReviewJournalLine[];
  role: ResolvedAccountRole;
  debit: number;
  credit: number;
  linePurpose: string;
  taxComponent?: string | null;
  settlementComponent?: string | null;
  monetary: ReturnType<typeof buildJournalMonetaryContext>;
}) {
  if (!input.role.accountCode || !input.role.accountName) {
    return;
  }

  input.lines.push(buildJournalLine({
    lineNumber: input.lines.length + 1,
    accountId: input.role.accountId,
    accountCode: input.role.accountCode,
    accountName: input.role.accountName,
    debit: roundCurrency(input.debit),
    credit: roundCurrency(input.credit),
    provenance: input.role.provenance,
    taxTag: input.taxComponent ?? null,
    roleCode: input.role.roleCode,
    linePurpose: input.linePurpose,
    taxComponent: input.taxComponent ?? null,
    settlementComponent: input.settlementComponent ?? null,
    isProvisional: input.role.isProvisional,
    monetary: input.monetary,
  }));
}

function buildInvoiceLines(input: {
  documentRole: DocumentRoleCandidate;
  facts: DocumentIntakeFactMap;
  monetarySnapshot: DocumentMonetarySnapshot | null;
  settlementContext: DocumentSettlementContext;
  taxTreatment: VatEngineResult;
  appliedRule: ResolvedAccountingRule;
  accounts: PostableAccountRecord[];
  accountRoleBindings: AccountRoleBindingRecord[];
}) {
  const totalAmount = resolveDocumentTotal({
    facts: input.facts,
    taxTreatment: input.taxTreatment,
    monetarySnapshot: input.monetarySnapshot,
  });
  const monetary = buildJournalMonetaryContext({
    currencyCode: input.monetarySnapshot?.currencyCode ?? input.facts.currency_code,
    documentDate: input.monetarySnapshot?.fx.documentDate ?? input.facts.document_date,
    functionalCurrencyCode: input.monetarySnapshot?.fx.functionalCurrencyCode,
    fxRate: input.monetarySnapshot?.fx.rate,
    fxRateSource: input.monetarySnapshot?.fx.source,
    fxRateBcuValue: input.monetarySnapshot?.fx.bcuValue,
    fxRateBcuDateUsed: input.monetarySnapshot?.fx.bcuDateUsed,
    fxRateBcuSeries: input.monetarySnapshot?.fx.bcuSeries,
  });
  const requiredRoles = resolveRequiredRoles({
    documentRole: input.documentRole,
    settlementContext: input.settlementContext,
    taxTreatment: input.taxTreatment,
  });
  const roleMap = resolveRoleMap({
    requiredRoles,
    accounts: input.accounts,
    accountRoleBindings: input.accountRoleBindings,
    appliedRule: input.appliedRule,
    documentRole: input.documentRole,
    currencyCode: monetary.currencyCode,
    settlementMethod: input.settlementContext.settlementMethod,
  });
  const blockers = [
    ...input.settlementContext.blockers,
  ];
  const lines: ReviewJournalLine[] = [];
  const primaryRoleCode = input.settlementContext.primaryAccountRole;

  for (const roleCode of requiredRoles) {
    const resolved = roleMap.get(roleCode);

    if (!resolved?.accountId || !resolved.accountCode || !resolved.accountName) {
      blockers.push(`Falta resolver la cuenta para el rol ${roleCode}.`);
    }
  }

  if (!input.taxTreatment.ready) {
    blockers.push(...input.taxTreatment.blockingReasons);
  }

  if (input.settlementContext.paymentTerms === "cash" && input.settlementContext.settlementMethod === "mixed") {
    const allocationTotal = roundCurrency(
      input.settlementContext.settlementAllocations.reduce((sum, entry) => sum + entry.amount, 0),
    );

    if (Math.abs(allocationTotal - totalAmount) >= 0.01) {
      blockers.push("La suma del settlement mixto debe coincidir con el total del documento.");
    }
  }

  if (blockers.length > 0 || !input.settlementContext.templateCode) {
    return buildBlockedJournalSuggestion({
      blockingReasons: blockers,
      explanation: "La plantilla no se puede materializar hasta completar el contexto operativo y contable.",
      monetary,
      postingMode: input.appliedRule.accountIsProvisional ? "provisional" : "final",
      hasProvisionalAccounts: input.appliedRule.accountIsProvisional,
      templateCode: input.settlementContext.templateCode,
      taxProfileCode: input.appliedRule.taxProfileCode,
      operationKind: input.settlementContext.operationKind,
      paymentTerms: input.settlementContext.paymentTerms,
      settlementMethod: input.settlementContext.settlementMethod,
      settlementStatus: input.settlementContext.settlementStatus,
      requiresFollowupSettlement: input.settlementContext.requiresFollowupSettlement,
    });
  }

  const netAmount =
    input.documentRole === "purchase" && input.taxTreatment.vatBucket !== "input_creditable"
      ? totalAmount
      : roundCurrency(input.taxTreatment.taxableAmount);
  const vatAmount =
    input.documentRole === "purchase" && input.taxTreatment.vatBucket !== "input_creditable"
      ? 0
      : roundCurrency(input.taxTreatment.taxAmount);
  const primaryRole = primaryRoleCode ? roleMap.get(primaryRoleCode) ?? null : null;

  if (input.documentRole === "sale") {
    const counterpartyAmount = totalAmount;
    const settlementLines: JournalSettlementLine[] =
      input.settlementContext.paymentTerms === "credit"
        ? [{
            roleCode: "accounts_receivable_account" as const,
            amount: counterpartyAmount,
            method: "credit" as const,
          }]
        : buildSettlementAllocations({
            paymentTerms: input.settlementContext.paymentTerms,
            settlementMethod: input.settlementContext.settlementMethod,
            settlementAllocations: input.settlementContext.settlementAllocations,
            totalAmount: counterpartyAmount,
            documentRole: input.documentRole,
          });

    for (const entry of settlementLines) {
      const role = roleMap.get(entry.roleCode) ?? null;

      if (role) {
        createLine({
          lines,
          role,
          debit: entry.amount,
          credit: 0,
          linePurpose: "settlement",
          settlementComponent: entry.method,
          monetary,
        });
      }
    }

    if (primaryRole) {
      createLine({
        lines,
        role: primaryRole,
        debit: 0,
        credit: netAmount,
        linePurpose: "main",
        taxComponent: "vat_sale_base",
        monetary,
      });
    }

    if (vatAmount > 0) {
      const vatRole = roleMap.get("output_vat_account") ?? null;

      if (vatRole) {
        createLine({
          lines,
          role: vatRole,
          debit: 0,
          credit: vatAmount,
          linePurpose: "tax",
          taxComponent: "vat_output_payable",
          monetary,
        });
      }
    }
  } else {
    if (primaryRole) {
      createLine({
        lines,
        role: primaryRole,
        debit: netAmount,
        credit: 0,
        linePurpose: "main",
        taxComponent:
          vatAmount > 0 && input.taxTreatment.vatBucket === "input_creditable"
            ? "vat_purchase_base"
            : "vat_purchase_non_deductible",
        monetary,
      });
    }

    if (vatAmount > 0 && input.taxTreatment.vatBucket === "input_creditable") {
      const vatRole = roleMap.get("input_vat_account") ?? null;

      if (vatRole) {
        createLine({
          lines,
          role: vatRole,
          debit: vatAmount,
          credit: 0,
          linePurpose: "tax",
          taxComponent: "vat_input_creditable",
          monetary,
        });
      }
    }

    const settlementLines: JournalSettlementLine[] =
      input.settlementContext.paymentTerms === "credit"
        ? [{
            roleCode: "accounts_payable_account" as const,
            amount: totalAmount,
            method: "credit" as const,
          }]
        : buildSettlementAllocations({
            paymentTerms: input.settlementContext.paymentTerms,
            settlementMethod: input.settlementContext.settlementMethod,
            settlementAllocations: input.settlementContext.settlementAllocations,
            totalAmount,
            documentRole: input.documentRole,
          });

    for (const entry of settlementLines) {
      const role = roleMap.get(entry.roleCode) ?? null;

      if (role) {
        createLine({
          lines,
          role,
          debit: 0,
          credit: entry.amount,
          linePurpose: "settlement",
          settlementComponent: entry.method,
          monetary,
        });
      }
    }
  }

  const hasProvisionalAccounts =
    input.appliedRule.accountIsProvisional
    || lines.some((line) => line.isProvisional);

  return finalizeJournalSuggestion({
    lines,
    explanation: "La plantilla contable quedo resuelta y el asiento ya se puede revisar linea por linea.",
    blockingReasons: [],
    monetary,
    postingMode: hasProvisionalAccounts ? "provisional" : "final",
    hasProvisionalAccounts,
    templateCode: input.settlementContext.templateCode,
    taxProfileCode: input.appliedRule.taxProfileCode,
    operationKind: input.settlementContext.operationKind,
    paymentTerms: input.settlementContext.paymentTerms,
    settlementMethod: input.settlementContext.settlementMethod,
    settlementStatus: input.settlementContext.settlementStatus,
    requiresFollowupSettlement: input.settlementContext.requiresFollowupSettlement,
  });
}

export function buildJournalEntryPreview(input: {
  documentRole: DocumentRoleCandidate;
  facts: DocumentIntakeFactMap;
  monetarySnapshot: DocumentMonetarySnapshot | null;
  settlementContext: DocumentSettlementContext;
  taxTreatment: VatEngineResult;
  appliedRule: ResolvedAccountingRule;
  accounts: PostableAccountRecord[];
  accountRoleBindings: AccountRoleBindingRecord[];
}) {
  return buildInvoiceLines(input);
}

export function applyJournalPreviewToDerived(input: {
  derived: Omit<DerivedDraftArtifacts, "journalSuggestion">;
  documentRole: DocumentRoleCandidate;
  facts: DocumentIntakeFactMap;
  accounts: PostableAccountRecord[];
  accountRoleBindings: AccountRoleBindingRecord[];
}) {
  return buildJournalEntryPreview({
    documentRole: input.documentRole,
    facts: input.facts,
    monetarySnapshot: input.derived.monetarySnapshot,
    settlementContext: input.derived.settlementContext,
    taxTreatment: input.derived.taxTreatment,
    appliedRule: input.derived.appliedRule,
    accounts: input.accounts,
    accountRoleBindings: input.accountRoleBindings,
  });
}
