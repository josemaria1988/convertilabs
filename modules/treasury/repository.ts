import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  addDaysIso,
  buildCashProjection,
  calculateCashPosition,
  calculateValeTermCashImpact,
  daysBetweenIso,
  evaluateTreasuryAlerts,
  isWithinHorizon,
} from "@/modules/treasury/calculations";
import type {
  TreasuryBankAccount,
  TreasuryBankAccountType,
  TreasuryBankBalanceSnapshot,
  TreasuryCurrencyCode,
  TreasuryCurrencySummary,
  TreasuryDashboardData,
  TreasuryManualReceivable,
  TreasuryReceivableConfidence,
  TreasuryReceivableStatus,
  TreasurySourceType,
  TreasuryVale,
  TreasuryValeEvent,
  TreasuryValePlannedAction,
  TreasuryValeTerm,
  TreasuryValeTermInput,
} from "@/modules/treasury/types";

type BankAccountRow = {
  id: string;
  bank_name: string | null;
  name: string | null;
  account_number: string | null;
  currency_code: string | null;
  account_type: TreasuryBankAccountType | null;
  current_balance: number | string | null;
  balance_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BalanceSnapshotRow = {
  id: string;
  bank_account_id: string;
  balance: number | string | null;
  currency_code: string | null;
  snapshot_date: string;
  source: TreasurySourceType | null;
  notes: string | null;
  created_at: string;
};

type ValeRow = {
  id: string;
  bank_account_id: string | null;
  bank_name: string | null;
  operation_number: string | null;
  internal_reference: string | null;
  currency_code: string | null;
  original_principal: number | string | null;
  current_principal: number | string | null;
  status: "draft" | "active" | "closed" | "cancelled" | null;
  source: TreasurySourceType | null;
  source_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ValeTermRow = {
  id: string;
  vale_id: string;
  sequence: number | null;
  principal_amount: number | string | null;
  expected_interest_amount: number | string | null;
  expected_fees_amount: number | string | null;
  expected_partial_principal_payment: number | string | null;
  issue_date: string | null;
  due_date: string | null;
  planned_action: TreasuryValePlannedAction | null;
  renewal_offered: boolean | null;
  renewal_confirmed: boolean | null;
  expected_new_due_date: string | null;
  expected_new_principal_amount: number | string | null;
  status: "pending" | "renewed" | "closed" | "cancelled" | null;
  source: TreasurySourceType | null;
  source_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ValeEventRow = {
  id: string;
  vale_id: string;
  vale_term_id: string | null;
  event_type: "created" | "updated" | "renewal_confirmed" | "renewed" | "closed" | "note" | "cancelled" | null;
  event_date: string | null;
  principal_paid_amount: number | string | null;
  interest_paid_amount: number | string | null;
  fees_paid_amount: number | string | null;
  resulting_principal: number | string | null;
  new_due_date: string | null;
  source: TreasurySourceType | null;
  source_text: string | null;
  notes: string | null;
  created_at: string;
};

type ManualReceivableRow = {
  id: string;
  customer_name: string | null;
  document_number: string | null;
  description: string | null;
  currency_code: string | null;
  amount: number | string | null;
  issue_date: string | null;
  expected_date: string | null;
  collected_at: string | null;
  status: TreasuryReceivableStatus | null;
  confidence: TreasuryReceivableConfidence | null;
  source: TreasurySourceType | null;
  source_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ReserveRuleRow = {
  id: string;
  currency_code: string | null;
  min_buffer_amount: number | string | null;
  horizon_days: number | null;
  active: boolean | null;
};

type OpenItemRow = {
  open_item_id: string;
  counterparty_name: string | null;
  document_role: string | null;
  due_date: string | null;
  days_overdue: number | null;
  currency_code: string | null;
  outstanding_amount: number | string | null;
  status: string | null;
};

const BANK_ACCOUNT_SELECT = [
  "id",
  "bank_name",
  "name",
  "account_number",
  "currency_code",
  "account_type",
  "current_balance",
  "balance_date",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

const VALE_SELECT = [
  "id",
  "bank_account_id",
  "bank_name",
  "operation_number",
  "internal_reference",
  "currency_code",
  "original_principal",
  "current_principal",
  "status",
  "source",
  "source_text",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

const VALE_TERM_SELECT = [
  "id",
  "vale_id",
  "sequence",
  "principal_amount",
  "expected_interest_amount",
  "expected_fees_amount",
  "expected_partial_principal_payment",
  "issue_date",
  "due_date",
  "planned_action",
  "renewal_offered",
  "renewal_confirmed",
  "expected_new_due_date",
  "expected_new_principal_amount",
  "status",
  "source",
  "source_text",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

const VALE_EVENT_SELECT = [
  "id",
  "vale_id",
  "vale_term_id",
  "event_type",
  "event_date",
  "principal_paid_amount",
  "interest_paid_amount",
  "fees_paid_amount",
  "resulting_principal",
  "new_due_date",
  "source",
  "source_text",
  "notes",
  "created_at",
].join(", ");

const MANUAL_RECEIVABLE_SELECT = [
  "id",
  "customer_name",
  "document_number",
  "description",
  "currency_code",
  "amount",
  "issue_date",
  "expected_date",
  "collected_at",
  "status",
  "confidence",
  "source",
  "source_text",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

const ZERO_MINOR = BigInt(0);

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toMinor(value: unknown) {
  return BigInt(Math.round(asNumber(value) * 100));
}

function fromMinor(value: bigint) {
  return Number(value) / 100;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDashboard(today: string, openItems = emptyOpenItems()): TreasuryDashboardData {
  return {
    isAvailable: false,
    today,
    currencies: [],
    bankAccounts: [],
    balanceSnapshots: [],
    vales: [],
    manualReceivables: [],
    alerts: [],
    projections: [],
    openItems,
  };
}

function emptyOpenItems() {
  return {
    isAvailable: false,
    totalCount: 0,
    receivableCount: 0,
    payableCount: 0,
  };
}

function isMissingTreasuryTable(error: unknown) {
  const supabaseError = error as { message?: string; code?: string };

  return isMissingSupabaseRelationError(supabaseError, "treasury_bank_accounts")
    || isMissingSupabaseRelationError(supabaseError, "treasury_bank_balance_snapshots")
    || isMissingSupabaseRelationError(supabaseError, "treasury_vales")
    || isMissingSupabaseRelationError(supabaseError, "treasury_vale_terms")
    || isMissingSupabaseRelationError(supabaseError, "treasury_vale_events")
    || isMissingSupabaseRelationError(supabaseError, "treasury_manual_receivables")
    || isMissingSupabaseRelationError(supabaseError, "treasury_reserve_rules");
}

function mapBankAccount(row: BankAccountRow): TreasuryBankAccount {
  return {
    id: row.id,
    bankName: row.bank_name ?? "Banco sin nombre",
    name: row.name ?? "Cuenta bancaria",
    accountNumber: row.account_number,
    currencyCode: (row.currency_code ?? "UYU").toUpperCase(),
    accountType: row.account_type ?? "checking",
    currentBalance: asNumber(row.current_balance),
    balanceDate: row.balance_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBalanceSnapshot(row: BalanceSnapshotRow): TreasuryBankBalanceSnapshot {
  return {
    id: row.id,
    bankAccountId: row.bank_account_id,
    balance: asNumber(row.balance),
    currencyCode: (row.currency_code ?? "UYU").toUpperCase(),
    snapshotDate: row.snapshot_date,
    source: row.source ?? "manual",
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapValeEvent(row: ValeEventRow): TreasuryValeEvent {
  return {
    id: row.id,
    valeId: row.vale_id,
    valeTermId: row.vale_term_id,
    eventType: row.event_type ?? "updated",
    eventDate: row.event_date ?? "",
    principalPaidAmount: asNumber(row.principal_paid_amount),
    interestPaidAmount: asNumber(row.interest_paid_amount),
    feesPaidAmount: asNumber(row.fees_paid_amount),
    resultingPrincipal: row.resulting_principal === null ? null : asNumber(row.resulting_principal),
    newDueDate: row.new_due_date,
    source: row.source ?? "manual",
    sourceText: row.source_text,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function termRiskLevel(input: {
  daysUntilDue: number;
  isOverdue: boolean;
  plannedAction: TreasuryValePlannedAction;
  renewalConfirmed: boolean;
}) {
  if (input.isOverdue) {
    return "critical" as const;
  }

  if (input.daysUntilDue <= 3) {
    return input.plannedAction === "renew" && input.renewalConfirmed ? "medium" as const : "critical" as const;
  }

  if (input.daysUntilDue <= 7) {
    return input.plannedAction === "renew" && !input.renewalConfirmed ? "high" as const : "medium" as const;
  }

  return input.plannedAction === "renew" && !input.renewalConfirmed ? "medium" as const : "low" as const;
}

function mapValeTerm(row: ValeTermRow, today: string, currencyCode: TreasuryCurrencyCode): TreasuryValeTerm {
  const input: TreasuryValeTermInput = {
    id: row.id,
    valeId: row.vale_id,
    currencyCode,
    principalAmountMinor: toMinor(row.principal_amount),
    expectedInterestAmountMinor: toMinor(row.expected_interest_amount),
    expectedFeesAmountMinor: toMinor(row.expected_fees_amount),
    expectedPartialPrincipalPaymentMinor: toMinor(row.expected_partial_principal_payment),
    dueDate: row.due_date ?? today,
    plannedAction: row.planned_action ?? "undecided",
    renewalConfirmed: Boolean(row.renewal_confirmed),
  };
  const daysUntilDue = daysBetweenIso(today, input.dueDate);
  const isOverdue = daysUntilDue < 0 && row.status === "pending";

  return {
    id: row.id,
    valeId: row.vale_id,
    sequence: row.sequence ?? 1,
    principalAmount: asNumber(row.principal_amount),
    expectedInterestAmount: asNumber(row.expected_interest_amount),
    expectedFeesAmount: asNumber(row.expected_fees_amount),
    expectedPartialPrincipalPayment: asNumber(row.expected_partial_principal_payment),
    issueDate: row.issue_date,
    dueDate: input.dueDate,
    plannedAction: input.plannedAction,
    renewalOffered: Boolean(row.renewal_offered),
    renewalConfirmed: input.renewalConfirmed,
    expectedNewDueDate: row.expected_new_due_date,
    expectedNewPrincipalAmount: row.expected_new_principal_amount === null ? null : asNumber(row.expected_new_principal_amount),
    status: row.status ?? "pending",
    source: row.source ?? "manual",
    sourceText: row.source_text,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cashImpact: calculateValeTermCashImpact(input),
    daysUntilDue,
    isDueSoon: daysUntilDue >= 0 && daysUntilDue <= 7 && row.status === "pending",
    isOverdue,
    riskLevel: termRiskLevel({
      daysUntilDue,
      isOverdue,
      plannedAction: input.plannedAction,
      renewalConfirmed: input.renewalConfirmed,
    }),
  };
}

function mapManualReceivable(row: ManualReceivableRow, today: string): TreasuryManualReceivable {
  return {
    id: row.id,
    customerName: row.customer_name ?? "Cliente sin nombre",
    documentNumber: row.document_number,
    description: row.description,
    currencyCode: (row.currency_code ?? "UYU").toUpperCase(),
    amount: asNumber(row.amount),
    issueDate: row.issue_date,
    expectedDate: row.expected_date ?? today,
    collectedAt: row.collected_at,
    status: row.status ?? "pending",
    confidence: row.confidence ?? "probable",
    source: row.source ?? "manual",
    sourceText: row.source_text,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    daysOverdue: row.expected_date ? Math.max(0, -daysBetweenIso(today, row.expected_date)) : 0,
  };
}

function buildVales(input: {
  rows: ValeRow[];
  termRows: ValeTermRow[];
  eventRows: ValeEventRow[];
  today: string;
}) {
  const termsByVale = new Map<string, TreasuryValeTerm[]>();
  const eventsByVale = new Map<string, TreasuryValeEvent[]>();
  const currencyByVale = new Map(input.rows.map((row) => [row.id, (row.currency_code ?? "UYU").toUpperCase()]));

  for (const row of input.termRows) {
    const currencyCode = currencyByVale.get(row.vale_id) ?? "UYU";
    const terms = termsByVale.get(row.vale_id) ?? [];
    terms.push(mapValeTerm(row, input.today, currencyCode));
    termsByVale.set(row.vale_id, terms);
  }

  for (const row of input.eventRows) {
    const events = eventsByVale.get(row.vale_id) ?? [];
    events.push(mapValeEvent(row));
    eventsByVale.set(row.vale_id, events);
  }

  return input.rows.map((row): TreasuryVale => {
    const terms = (termsByVale.get(row.id) ?? [])
      .sort((left, right) => left.sequence - right.sequence);
    const events = (eventsByVale.get(row.id) ?? [])
      .sort((left, right) => right.eventDate.localeCompare(left.eventDate) || right.createdAt.localeCompare(left.createdAt));
    const currentTerm = terms.find((term) => term.status === "pending")
      ?? terms[terms.length - 1]
      ?? null;

    return {
      id: row.id,
      bankAccountId: row.bank_account_id,
      bankName: row.bank_name ?? "Banco sin nombre",
      operationNumber: row.operation_number,
      internalReference: row.internal_reference,
      currencyCode: (row.currency_code ?? "UYU").toUpperCase(),
      originalPrincipal: asNumber(row.original_principal),
      currentPrincipal: asNumber(row.current_principal),
      status: row.status ?? "active",
      source: row.source ?? "manual",
      sourceText: row.source_text,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentTerm,
      terms,
      events,
    };
  });
}

function deriveDirection(row: OpenItemRow) {
  return row.document_role === "sale" ? "receivable" : "payable";
}

async function loadOpenItems(supabase: SupabaseClient, organizationId: string) {
  const { data, count, error } = await supabase
    .from("v_open_items_outstanding")
    .select("open_item_id, counterparty_name, document_role, due_date, days_overdue, currency_code, outstanding_amount, status", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  if (error) {
    if (isMissingSupabaseRelationError(error, "v_open_items_outstanding")) {
      return {
        rows: [] as OpenItemRow[],
        summary: emptyOpenItems(),
      };
    }

    throw new Error(error.message);
  }

  const rows = (data as OpenItemRow[] | null) ?? [];
  const receivableCount = rows.filter((row) => deriveDirection(row) === "receivable").length;
  const payableCount = rows.filter((row) => deriveDirection(row) === "payable").length;

  return {
    rows,
    summary: {
      isAvailable: true,
      totalCount: count ?? rows.length,
      receivableCount,
      payableCount,
    },
  };
}

function addMinorAmount(map: Map<string, bigint>, currencyCode: string, amountMinor: bigint) {
  map.set(currencyCode, (map.get(currencyCode) ?? ZERO_MINOR) + amountMinor);
}

function buildCurrencySummaries(input: {
  today: string;
  bankAccounts: TreasuryBankAccount[];
  vales: TreasuryVale[];
  manualReceivables: TreasuryManualReceivable[];
  reserveRules: ReserveRuleRow[];
  openItemRows: OpenItemRow[];
}) {
  const bankBalanceByCurrency = new Map<string, bigint>();
  const minBufferByCurrency = new Map<string, bigint>();
  const planned7 = new Map<string, bigint>();
  const conservative7 = new Map<string, bigint>();
  const planned30 = new Map<string, bigint>();
  const conservative30 = new Map<string, bigint>();
  const planned45 = new Map<string, bigint>();
  const conservative45 = new Map<string, bigint>();
  const payables45 = new Map<string, bigint>();
  const confirmedReceivables30 = new Map<string, bigint>();
  const probableReceivables30 = new Map<string, bigint>();
  const overdueReceivables = new Map<string, bigint>();
  const currencies = new Set<string>();

  for (const account of input.bankAccounts) {
    currencies.add(account.currencyCode);
    addMinorAmount(bankBalanceByCurrency, account.currencyCode, toMinor(account.currentBalance));
  }

  for (const rule of input.reserveRules.filter((entry) => entry.active !== false)) {
    const currencyCode = (rule.currency_code ?? "UYU").toUpperCase();
    currencies.add(currencyCode);
    minBufferByCurrency.set(currencyCode, toMinor(rule.min_buffer_amount));
  }

  for (const vale of input.vales) {
    const term = vale.currentTerm;

    if (!term || term.status !== "pending" || vale.status !== "active") {
      continue;
    }

    currencies.add(vale.currencyCode);

    if (isWithinHorizon(term.dueDate, input.today, 7)) {
      addMinorAmount(planned7, vale.currencyCode, term.cashImpact.plannedOutflowMinor);
      addMinorAmount(conservative7, vale.currencyCode, term.cashImpact.conservativeOutflowMinor);
    }

    if (isWithinHorizon(term.dueDate, input.today, 30)) {
      addMinorAmount(planned30, vale.currencyCode, term.cashImpact.plannedOutflowMinor);
      addMinorAmount(conservative30, vale.currencyCode, term.cashImpact.conservativeOutflowMinor);
    }

    if (isWithinHorizon(term.dueDate, input.today, 45)) {
      addMinorAmount(planned45, vale.currencyCode, term.cashImpact.plannedOutflowMinor);
      addMinorAmount(conservative45, vale.currencyCode, term.cashImpact.conservativeOutflowMinor);
    }
  }

  for (const row of input.openItemRows) {
    const currencyCode = (row.currency_code ?? "UYU").toUpperCase();
    const amountMinor = toMinor(row.outstanding_amount);

    currencies.add(currencyCode);

    if (deriveDirection(row) === "payable" && row.due_date && isWithinHorizon(row.due_date, input.today, 45)) {
      addMinorAmount(payables45, currencyCode, amountMinor);
    }

    if (deriveDirection(row) === "receivable") {
      if (row.due_date && isWithinHorizon(row.due_date, input.today, 30)) {
        addMinorAmount(confirmedReceivables30, currencyCode, amountMinor);
      }

      if ((row.days_overdue ?? 0) > 0) {
        addMinorAmount(overdueReceivables, currencyCode, amountMinor);
      }
    }
  }

  for (const receivable of input.manualReceivables) {
    const amountMinor = toMinor(receivable.amount);

    currencies.add(receivable.currencyCode);

    if (receivable.status === "pending" && isWithinHorizon(receivable.expectedDate, input.today, 30)) {
      if (receivable.confidence === "confirmed") {
        addMinorAmount(confirmedReceivables30, receivable.currencyCode, amountMinor);
      } else if (receivable.confidence === "probable") {
        addMinorAmount(probableReceivables30, receivable.currencyCode, amountMinor);
      }
    }

    if (receivable.status === "pending" && receivable.expectedDate < input.today) {
      addMinorAmount(overdueReceivables, receivable.currencyCode, amountMinor);
    }
  }

  const summaries: TreasuryCurrencySummary[] = [];
  const conservativeAvailableByCurrency = new Map<string, bigint>();

  for (const currencyCode of [...currencies].sort()) {
    const cashPosition = calculateCashPosition({
      currencyCode,
      bankBalanceMinor: bankBalanceByCurrency.get(currencyCode) ?? ZERO_MINOR,
      plannedObligationsMinor: planned45.get(currencyCode) ?? ZERO_MINOR,
      conservativeObligationsMinor: conservative45.get(currencyCode) ?? ZERO_MINOR,
      unavoidablePaymentsMinor: payables45.get(currencyCode) ?? ZERO_MINOR,
      minBufferMinor: minBufferByCurrency.get(currencyCode) ?? ZERO_MINOR,
    });

    conservativeAvailableByCurrency.set(currencyCode, cashPosition.conservativeAvailableCashMinor);

    summaries.push({
      currencyCode,
      bankBalanceMinor: cashPosition.bankBalanceMinor,
      plannedOutflow7Minor: planned7.get(currencyCode) ?? ZERO_MINOR,
      conservativeOutflow7Minor: conservative7.get(currencyCode) ?? ZERO_MINOR,
      plannedOutflow30Minor: planned30.get(currencyCode) ?? ZERO_MINOR,
      conservativeOutflow30Minor: conservative30.get(currencyCode) ?? ZERO_MINOR,
      plannedOutflow45Minor: planned45.get(currencyCode) ?? ZERO_MINOR,
      conservativeOutflow45Minor: conservative45.get(currencyCode) ?? ZERO_MINOR,
      plannedAvailableCashMinor: cashPosition.plannedAvailableCashMinor,
      conservativeAvailableCashMinor: cashPosition.conservativeAvailableCashMinor,
      minBufferMinor: cashPosition.minBufferMinor,
      confirmedReceivables30Minor: confirmedReceivables30.get(currencyCode) ?? ZERO_MINOR,
      probableReceivables30Minor: probableReceivables30.get(currencyCode) ?? ZERO_MINOR,
      overdueReceivablesMinor: overdueReceivables.get(currencyCode) ?? ZERO_MINOR,
      status: cashPosition.status,
      message: cashPosition.message,
    });
  }

  return {
    summaries,
    conservativeAvailableByCurrency,
    minBufferByCurrency,
  };
}

export function canManageTreasury(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "operator"].includes(role);
}

export async function loadTreasuryDashboard(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
    today?: string | null;
  },
): Promise<TreasuryDashboardData> {
  const today = input.today ?? todayIso();
  const openItems = await loadOpenItems(supabase, input.organizationId);

  const bankAccountsResult = await supabase
    .from("treasury_bank_accounts")
    .select(BANK_ACCOUNT_SELECT)
    .eq("organization_id", input.organizationId)
    .neq("status", "archived")
    .order("bank_name", { ascending: true })
    .order("name", { ascending: true });

  if (bankAccountsResult.error) {
    if (isMissingTreasuryTable(bankAccountsResult.error)) {
      return emptyDashboard(today, openItems.summary);
    }

    throw new Error(bankAccountsResult.error.message);
  }

  const [snapshotsResult, valesResult, termsResult, eventsResult, receivablesResult, reserveRulesResult] = await Promise.all([
    supabase
      .from("treasury_bank_balance_snapshots")
      .select("id, bank_account_id, balance, currency_code, snapshot_date, source, notes, created_at")
      .eq("organization_id", input.organizationId)
      .order("snapshot_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("treasury_vales")
      .select(VALE_SELECT)
      .eq("organization_id", input.organizationId)
      .neq("status", "cancelled")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("treasury_vale_terms")
      .select(VALE_TERM_SELECT)
      .eq("organization_id", input.organizationId)
      .order("due_date", { ascending: true })
      .limit(500),
    supabase
      .from("treasury_vale_events")
      .select(VALE_EVENT_SELECT)
      .eq("organization_id", input.organizationId)
      .order("event_date", { ascending: false })
      .limit(500),
    supabase
      .from("treasury_manual_receivables")
      .select(MANUAL_RECEIVABLE_SELECT)
      .eq("organization_id", input.organizationId)
      .neq("status", "cancelled")
      .order("expected_date", { ascending: true })
      .limit(300),
    supabase
      .from("treasury_reserve_rules")
      .select("id, currency_code, min_buffer_amount, horizon_days, active")
      .eq("organization_id", input.organizationId)
      .eq("active", true),
  ]);

  for (const result of [snapshotsResult, valesResult, termsResult, eventsResult, receivablesResult, reserveRulesResult]) {
    if (result.error) {
      if (isMissingTreasuryTable(result.error)) {
        return emptyDashboard(today, openItems.summary);
      }

      throw new Error(result.error.message);
    }
  }

  const bankAccounts = ((bankAccountsResult.data as unknown as BankAccountRow[] | null) ?? []).map(mapBankAccount);
  const vales = buildVales({
    rows: (valesResult.data as unknown as ValeRow[] | null) ?? [],
    termRows: (termsResult.data as unknown as ValeTermRow[] | null) ?? [],
    eventRows: (eventsResult.data as unknown as ValeEventRow[] | null) ?? [],
    today,
  });
  const manualReceivables = ((receivablesResult.data as unknown as ManualReceivableRow[] | null) ?? [])
    .map((row) => mapManualReceivable(row, today));
  const currencyContext = buildCurrencySummaries({
    today,
    bankAccounts,
    vales,
    manualReceivables,
    reserveRules: (reserveRulesResult.data as unknown as ReserveRuleRow[] | null) ?? [],
    openItemRows: openItems.rows,
  });
  const activeTerms = vales
    .filter((vale) => vale.status === "active")
    .map((vale) => vale.currentTerm)
    .filter((term): term is TreasuryValeTerm => Boolean(term && term.status === "pending"));
  const valeTermInputs: TreasuryValeTermInput[] = activeTerms.map((term) => ({
    id: term.id,
    valeId: term.valeId,
    currencyCode: vales.find((vale) => vale.id === term.valeId)?.currencyCode ?? "UYU",
    principalAmountMinor: toMinor(term.principalAmount),
    expectedInterestAmountMinor: toMinor(term.expectedInterestAmount),
    expectedFeesAmountMinor: toMinor(term.expectedFeesAmount),
    expectedPartialPrincipalPaymentMinor: toMinor(term.expectedPartialPrincipalPayment),
    dueDate: term.dueDate,
    plannedAction: term.plannedAction,
    renewalConfirmed: term.renewalConfirmed,
  }));
  const projection = buildCashProjection({
    today,
    horizonDays: 45,
    startingBalances: currencyContext.summaries.map((summary) => ({
      currencyCode: summary.currencyCode,
      amountMinor: summary.bankBalanceMinor,
    })),
    valeTerms: valeTermInputs,
    receivables: [
      ...openItems.rows
        .filter((row) => deriveDirection(row) === "receivable" && row.due_date)
        .map((row) => ({
          id: `open-item-${row.open_item_id}`,
          label: row.counterparty_name ?? "Cobro por open item",
          currencyCode: (row.currency_code ?? "UYU").toUpperCase(),
          amountMinor: toMinor(row.outstanding_amount),
          expectedDate: row.due_date ?? today,
          status: "pending" as const,
          confidence: "confirmed" as const,
        })),
      ...manualReceivables.map((receivable) => ({
        id: `manual-${receivable.id}`,
        label: receivable.customerName,
        currencyCode: receivable.currencyCode,
        amountMinor: toMinor(receivable.amount),
        expectedDate: receivable.expectedDate,
        status: receivable.status,
        confidence: receivable.confidence,
      })),
    ],
    payables: openItems.rows
      .filter((row) => deriveDirection(row) === "payable" && row.due_date)
      .map((row) => ({
        id: row.open_item_id,
        label: row.counterparty_name ?? "Pago por open item",
        currencyCode: (row.currency_code ?? "UYU").toUpperCase(),
        amountMinor: toMinor(row.outstanding_amount),
        dueDate: row.due_date ?? today,
        status: row.status,
      })),
  });
  const alerts = evaluateTreasuryAlerts({
    today,
    valeTerms: valeTermInputs,
    conservativeAvailableByCurrency: currencyContext.conservativeAvailableByCurrency,
    minBufferByCurrency: currencyContext.minBufferByCurrency,
    receivables: manualReceivables.map((receivable) => ({
      id: receivable.id,
      label: receivable.customerName,
      currencyCode: receivable.currencyCode,
      amountMinor: toMinor(receivable.amount),
      expectedDate: receivable.expectedDate,
      status: receivable.status,
      confidence: receivable.confidence,
    })),
  });

  return {
    isAvailable: true,
    today,
    currencies: currencyContext.summaries,
    bankAccounts,
    balanceSnapshots: ((snapshotsResult.data as unknown as BalanceSnapshotRow[] | null) ?? []).map(mapBalanceSnapshot),
    vales,
    manualReceivables,
    alerts,
    projections: projection,
    openItems: openItems.summary,
  };
}

export async function loadTreasuryValeDetail(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
    valeId: string;
    today?: string | null;
  },
) {
  const dashboard = await loadTreasuryDashboard(supabase, {
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
    today: input.today,
  });

  return dashboard.vales.find((vale) => vale.id === input.valeId) ?? null;
}

export async function createTreasuryBankAccount(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    bankName: string;
    name: string;
    accountNumber?: string | null;
    currencyCode: string;
    accountType?: TreasuryBankAccountType;
    currentBalance?: number;
    balanceDate?: string | null;
    notes?: string | null;
  },
) {
  const payload = {
    organization_id: input.organizationId,
    bank_name: input.bankName,
    name: input.name,
    account_number: input.accountNumber ?? null,
    currency_code: input.currencyCode.toUpperCase(),
    account_type: input.accountType ?? "checking",
    current_balance: input.currentBalance ?? 0,
    balance_date: input.balanceDate ?? null,
    notes: input.notes ?? null,
    created_by: input.actorId ?? null,
  };
  const { data, error } = await supabase
    .from("treasury_bank_accounts")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const bankAccountId = String((data as { id: string }).id);

  await createTreasuryBalanceSnapshot(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    bankAccountId,
    balance: input.currentBalance ?? 0,
    currencyCode: input.currencyCode,
    snapshotDate: input.balanceDate ?? todayIso(),
    source: "manual",
    notes: input.notes ?? null,
  });

  return bankAccountId;
}

export async function createTreasuryBalanceSnapshot(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    bankAccountId: string;
    balance: number;
    currencyCode: string;
    snapshotDate: string;
    source?: TreasurySourceType;
    notes?: string | null;
  },
) {
  const payload = {
    organization_id: input.organizationId,
    bank_account_id: input.bankAccountId,
    balance: input.balance,
    currency_code: input.currencyCode.toUpperCase(),
    snapshot_date: input.snapshotDate,
    source: input.source ?? "manual",
    notes: input.notes ?? null,
    created_by: input.actorId ?? null,
  };
  const { error: snapshotError } = await supabase
    .from("treasury_bank_balance_snapshots")
    .insert(payload);

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  const { error: updateError } = await supabase
    .from("treasury_bank_accounts")
    .update({
      current_balance: input.balance,
      balance_date: input.snapshotDate,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.bankAccountId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function upsertTreasuryReserveRule(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    currencyCode: string;
    minBufferAmount: number;
    horizonDays?: number;
  },
) {
  const { data: existing, error: selectError } = await supabase
    .from("treasury_reserve_rules")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("currency_code", input.currencyCode.toUpperCase())
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  const payload = {
    organization_id: input.organizationId,
    currency_code: input.currencyCode.toUpperCase(),
    min_buffer_amount: input.minBufferAmount,
    horizon_days: input.horizonDays ?? 45,
    active: true,
    created_by: input.actorId ?? null,
    updated_at: new Date().toISOString(),
  };

  if ((existing as { id?: string } | null)?.id) {
    const { error } = await supabase
      .from("treasury_reserve_rules")
      .update(payload)
      .eq("organization_id", input.organizationId)
      .eq("id", (existing as { id: string }).id);

    if (error) {
      throw new Error(error.message);
    }

    return (existing as { id: string }).id;
  }

  const { data, error } = await supabase
    .from("treasury_reserve_rules")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return String((data as { id: string }).id);
}

export async function createTreasuryVale(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    bankAccountId?: string | null;
    bankName: string;
    operationNumber?: string | null;
    internalReference?: string | null;
    currencyCode: string;
    originalPrincipal: number;
    dueDate: string;
    issueDate?: string | null;
    expectedInterestAmount?: number;
    expectedFeesAmount?: number;
    plannedAction?: TreasuryValePlannedAction;
    renewalOffered?: boolean;
    renewalConfirmed?: boolean;
    expectedNewDueDate?: string | null;
    expectedNewPrincipalAmount?: number | null;
    source?: TreasurySourceType;
    sourceText?: string | null;
    notes?: string | null;
  },
) {
  const source = input.source ?? "manual";
  const { data, error } = await supabase
    .from("treasury_vales")
    .insert({
      organization_id: input.organizationId,
      bank_account_id: input.bankAccountId ?? null,
      bank_name: input.bankName,
      operation_number: input.operationNumber ?? null,
      internal_reference: input.internalReference ?? null,
      currency_code: input.currencyCode.toUpperCase(),
      original_principal: input.originalPrincipal,
      current_principal: input.originalPrincipal,
      status: "active",
      source,
      source_text: input.sourceText ?? null,
      notes: input.notes ?? null,
      created_by: input.actorId ?? null,
    })
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const valeId = String((data as { id: string }).id);
  const { data: termData, error: termError } = await supabase
    .from("treasury_vale_terms")
    .insert({
      organization_id: input.organizationId,
      vale_id: valeId,
      sequence: 1,
      principal_amount: input.originalPrincipal,
      expected_interest_amount: input.expectedInterestAmount ?? 0,
      expected_fees_amount: input.expectedFeesAmount ?? 0,
      issue_date: input.issueDate ?? null,
      due_date: input.dueDate,
      planned_action: input.plannedAction ?? "undecided",
      renewal_offered: input.renewalOffered ?? false,
      renewal_confirmed: input.renewalConfirmed ?? false,
      expected_new_due_date: input.expectedNewDueDate ?? null,
      expected_new_principal_amount: input.expectedNewPrincipalAmount ?? null,
      status: "pending",
      source,
      source_text: input.sourceText ?? null,
      notes: input.notes ?? null,
      created_by: input.actorId ?? null,
    })
    .select("id")
    .limit(1)
    .single();

  if (termError) {
    throw new Error(termError.message);
  }

  const termId = String((termData as { id: string }).id);

  const { error: eventError } = await supabase
    .from("treasury_vale_events")
    .insert({
      organization_id: input.organizationId,
      vale_id: valeId,
      vale_term_id: termId,
      event_type: "created",
      event_date: input.issueDate ?? todayIso(),
      resulting_principal: input.originalPrincipal,
      new_due_date: input.dueDate,
      source,
      source_text: input.sourceText ?? null,
      notes: input.notes ?? null,
      created_by: input.actorId ?? null,
    });

  if (eventError) {
    throw new Error(eventError.message);
  }

  return valeId;
}

export async function confirmTreasuryValeRenewal(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    valeId: string;
    valeTermId: string;
    expectedInterestAmount: number;
    expectedFeesAmount: number;
    expectedPartialPrincipalPayment: number;
    expectedNewPrincipalAmount?: number | null;
    expectedNewDueDate: string;
    renewalConfirmed: boolean;
    source?: TreasurySourceType;
    sourceText?: string | null;
    notes?: string | null;
  },
) {
  const source = input.source ?? "manual";
  const { error } = await supabase
    .from("treasury_vale_terms")
    .update({
      planned_action: "renew",
      renewal_offered: true,
      renewal_confirmed: input.renewalConfirmed,
      expected_interest_amount: input.expectedInterestAmount,
      expected_fees_amount: input.expectedFeesAmount,
      expected_partial_principal_payment: input.expectedPartialPrincipalPayment,
      expected_new_principal_amount: input.expectedNewPrincipalAmount ?? null,
      expected_new_due_date: input.expectedNewDueDate,
      source,
      source_text: input.sourceText ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("vale_id", input.valeId)
    .eq("id", input.valeTermId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  const { error: eventError } = await supabase
    .from("treasury_vale_events")
    .insert({
      organization_id: input.organizationId,
      vale_id: input.valeId,
      vale_term_id: input.valeTermId,
      event_type: "renewal_confirmed",
      event_date: todayIso(),
      resulting_principal: input.expectedNewPrincipalAmount ?? null,
      new_due_date: input.expectedNewDueDate,
      source,
      source_text: input.sourceText ?? null,
      notes: input.notes ?? null,
      created_by: input.actorId ?? null,
    });

  if (eventError) {
    throw new Error(eventError.message);
  }
}

export async function recordTreasuryValeRenewal(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    valeId: string;
    valeTermId: string;
    eventDate: string;
    interestPaidAmount: number;
    feesPaidAmount: number;
    principalPaidAmount: number;
    newPrincipalAmount?: number | null;
    newDueDate: string;
    source?: TreasurySourceType;
    sourceText?: string | null;
    notes?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("treasury_record_vale_renewal", {
    p_organization_id: input.organizationId,
    p_vale_id: input.valeId,
    p_vale_term_id: input.valeTermId,
    p_event_date: input.eventDate,
    p_interest_paid_amount: input.interestPaidAmount,
    p_fees_paid_amount: input.feesPaidAmount,
    p_principal_paid_amount: input.principalPaidAmount,
    p_new_principal_amount: input.newPrincipalAmount ?? null,
    p_new_due_date: input.newDueDate,
    p_source: input.source ?? "manual",
    p_source_text: input.sourceText ?? null,
    p_notes: input.notes ?? null,
    p_actor_id: input.actorId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function recordTreasuryValeClosure(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    valeId: string;
    valeTermId: string;
    eventDate: string;
    principalPaidAmount: number;
    interestPaidAmount: number;
    feesPaidAmount: number;
    source?: TreasurySourceType;
    sourceText?: string | null;
    notes?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("treasury_record_vale_closure", {
    p_organization_id: input.organizationId,
    p_vale_id: input.valeId,
    p_vale_term_id: input.valeTermId,
    p_event_date: input.eventDate,
    p_principal_paid_amount: input.principalPaidAmount,
    p_interest_paid_amount: input.interestPaidAmount,
    p_fees_paid_amount: input.feesPaidAmount,
    p_source: input.source ?? "manual",
    p_source_text: input.sourceText ?? null,
    p_notes: input.notes ?? null,
    p_actor_id: input.actorId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export async function createTreasuryManualReceivable(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    customerName: string;
    documentNumber?: string | null;
    description?: string | null;
    currencyCode: string;
    amount: number;
    issueDate?: string | null;
    expectedDate: string;
    confidence?: TreasuryReceivableConfidence;
    source?: TreasurySourceType;
    sourceText?: string | null;
    notes?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("treasury_manual_receivables")
    .insert({
      organization_id: input.organizationId,
      customer_name: input.customerName,
      document_number: input.documentNumber ?? null,
      description: input.description ?? null,
      currency_code: input.currencyCode.toUpperCase(),
      amount: input.amount,
      issue_date: input.issueDate ?? null,
      expected_date: input.expectedDate,
      status: "pending",
      confidence: input.confidence ?? "probable",
      source: input.source ?? "manual",
      source_text: input.sourceText ?? null,
      notes: input.notes ?? null,
      created_by: input.actorId ?? null,
    })
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return String((data as { id: string }).id);
}

export async function updateTreasuryManualReceivable(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    receivableId: string;
    expectedDate?: string | null;
    confidence?: TreasuryReceivableConfidence | null;
    status?: TreasuryReceivableStatus | null;
    notes?: string | null;
  },
) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.expectedDate !== undefined) {
    payload.expected_date = input.expectedDate;
  }

  if (input.confidence !== undefined) {
    payload.confidence = input.confidence;
  }

  if (input.status !== undefined) {
    payload.status = input.status;
  }

  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }

  const { error } = await supabase
    .from("treasury_manual_receivables")
    .update(payload)
    .eq("organization_id", input.organizationId)
    .eq("id", input.receivableId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markTreasuryManualReceivableCollected(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    receivableId: string;
    collectedAt: string;
  },
) {
  const { error } = await supabase
    .from("treasury_manual_receivables")
    .update({
      status: "collected",
      collected_at: input.collectedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.receivableId);

  if (error) {
    throw new Error(error.message);
  }
}

export const treasuryMinorToDisplay = fromMinor;
export const treasuryDisplayToMinor = toMinor;
