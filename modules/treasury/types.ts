export const TREASURY_SOURCE_TYPES = ["web_banco", "email_ejecutiva", "manual", "otro"] as const;
export type TreasurySourceType = (typeof TREASURY_SOURCE_TYPES)[number];

export const TREASURY_BANK_ACCOUNT_TYPES = ["checking", "savings", "credit_line", "other"] as const;
export type TreasuryBankAccountType = (typeof TREASURY_BANK_ACCOUNT_TYPES)[number];

export const TREASURY_VALE_STATUSES = ["draft", "active", "closed", "cancelled"] as const;
export type TreasuryValeStatus = (typeof TREASURY_VALE_STATUSES)[number];

export const TREASURY_VALE_TERM_STATUSES = ["pending", "renewed", "closed", "cancelled"] as const;
export type TreasuryValeTermStatus = (typeof TREASURY_VALE_TERM_STATUSES)[number];

export const TREASURY_VALE_PLANNED_ACTIONS = ["undecided", "renew", "close"] as const;
export type TreasuryValePlannedAction = (typeof TREASURY_VALE_PLANNED_ACTIONS)[number];

export const TREASURY_VALE_EVENT_TYPES = [
  "created",
  "updated",
  "renewal_confirmed",
  "renewed",
  "closed",
  "note",
  "cancelled",
] as const;
export type TreasuryValeEventType = (typeof TREASURY_VALE_EVENT_TYPES)[number];

export const TREASURY_RECEIVABLE_STATUSES = ["pending", "collected", "overdue", "cancelled"] as const;
export type TreasuryReceivableStatus = (typeof TREASURY_RECEIVABLE_STATUSES)[number];

export const TREASURY_RECEIVABLE_CONFIDENCES = ["confirmed", "probable", "doubtful"] as const;
export type TreasuryReceivableConfidence = (typeof TREASURY_RECEIVABLE_CONFIDENCES)[number];

export type TreasuryCurrencyCode = "UYU" | "USD" | "EUR" | string;

export type TreasuryRiskStatus = "GREEN" | "YELLOW" | "RED" | "CRITICAL";
export type TreasuryRiskLevel = "low" | "medium" | "high" | "critical";

export type TreasuryValeTermInput = {
  id: string;
  valeId?: string | null;
  currencyCode: TreasuryCurrencyCode;
  principalAmountMinor: bigint;
  expectedInterestAmountMinor: bigint;
  expectedFeesAmountMinor: bigint;
  expectedPartialPrincipalPaymentMinor: bigint;
  dueDate: string;
  plannedAction: TreasuryValePlannedAction;
  renewalConfirmed: boolean;
};

export type TreasuryValeTermCashImpact = {
  plannedOutflowMinor: bigint;
  conservativeOutflowMinor: bigint;
  closeOutflowMinor: bigint;
  renewalOutflowMinor: bigint;
  explanation: string;
};

export type TreasuryCashPositionInput = {
  currencyCode: TreasuryCurrencyCode;
  bankBalanceMinor: bigint;
  plannedObligationsMinor: bigint;
  conservativeObligationsMinor: bigint;
  unavoidablePaymentsMinor: bigint;
  minBufferMinor: bigint;
};

export type TreasuryCashPositionResult = {
  currencyCode: TreasuryCurrencyCode;
  bankBalanceMinor: bigint;
  plannedCommittedMinor: bigint;
  conservativeCommittedMinor: bigint;
  minBufferMinor: bigint;
  plannedAvailableCashMinor: bigint;
  conservativeAvailableCashMinor: bigint;
  status: TreasuryRiskStatus;
  message: string;
};

export type TreasuryWithdrawalSimulation = {
  allowed: boolean;
  risk: "LOW" | "MEDIUM" | "HIGH";
  afterWithdrawalMinor: bigint;
  message: string;
};

export type TreasuryProjectionScenario = "conservative" | "planned";

export type TreasuryProjectionEvent = {
  id: string;
  date: string;
  label: string;
  sourceType: "initial_balance" | "vale" | "receivable" | "payable" | "reserve";
  scenario: TreasuryProjectionScenario;
  currencyCode: TreasuryCurrencyCode;
  inflowMinor: bigint;
  outflowMinor: bigint;
  projectedBalanceMinor: bigint;
  riskLevel: TreasuryRiskLevel;
};

export type TreasuryProjectionInput = {
  today: string;
  horizonDays: number;
  startingBalances: Array<{
    currencyCode: TreasuryCurrencyCode;
    amountMinor: bigint;
  }>;
  valeTerms: TreasuryValeTermInput[];
  receivables: Array<{
    id: string;
    label: string;
    currencyCode: TreasuryCurrencyCode;
    amountMinor: bigint;
    expectedDate: string;
    status: TreasuryReceivableStatus;
    confidence: TreasuryReceivableConfidence;
    includeInConservative?: boolean;
  }>;
  payables: Array<{
    id: string;
    label: string;
    currencyCode: TreasuryCurrencyCode;
    amountMinor: bigint;
    dueDate: string;
    status?: string | null;
  }>;
};

export type TreasuryAlert = {
  key: string;
  title: string;
  message: string;
  riskLevel: TreasuryRiskLevel;
  dueDate: string | null;
};

export type TreasuryBankAccount = {
  id: string;
  bankName: string;
  name: string;
  accountNumber: string | null;
  currencyCode: TreasuryCurrencyCode;
  accountType: TreasuryBankAccountType;
  currentBalance: number;
  balanceDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TreasuryBankBalanceSnapshot = {
  id: string;
  bankAccountId: string;
  balance: number;
  currencyCode: TreasuryCurrencyCode;
  snapshotDate: string;
  source: TreasurySourceType;
  notes: string | null;
  createdAt: string;
};

export type TreasuryValeTerm = {
  id: string;
  valeId: string;
  sequence: number;
  principalAmount: number;
  expectedInterestAmount: number;
  expectedFeesAmount: number;
  expectedPartialPrincipalPayment: number;
  issueDate: string | null;
  dueDate: string;
  plannedAction: TreasuryValePlannedAction;
  renewalOffered: boolean;
  renewalConfirmed: boolean;
  expectedNewDueDate: string | null;
  expectedNewPrincipalAmount: number | null;
  status: TreasuryValeTermStatus;
  source: TreasurySourceType;
  sourceText: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cashImpact: TreasuryValeTermCashImpact;
  daysUntilDue: number;
  isDueSoon: boolean;
  isOverdue: boolean;
  riskLevel: TreasuryRiskLevel;
};

export type TreasuryValeEvent = {
  id: string;
  valeId: string;
  valeTermId: string | null;
  eventType: TreasuryValeEventType;
  eventDate: string;
  principalPaidAmount: number;
  interestPaidAmount: number;
  feesPaidAmount: number;
  resultingPrincipal: number | null;
  newDueDate: string | null;
  source: TreasurySourceType;
  sourceText: string | null;
  notes: string | null;
  createdAt: string;
};

export type TreasuryVale = {
  id: string;
  bankAccountId: string | null;
  bankName: string;
  operationNumber: string | null;
  internalReference: string | null;
  currencyCode: TreasuryCurrencyCode;
  originalPrincipal: number;
  currentPrincipal: number;
  status: TreasuryValeStatus;
  source: TreasurySourceType;
  sourceText: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  currentTerm: TreasuryValeTerm | null;
  terms: TreasuryValeTerm[];
  events: TreasuryValeEvent[];
};

export type TreasuryManualReceivable = {
  id: string;
  customerName: string;
  documentNumber: string | null;
  description: string | null;
  currencyCode: TreasuryCurrencyCode;
  amount: number;
  issueDate: string | null;
  expectedDate: string;
  collectedAt: string | null;
  status: TreasuryReceivableStatus;
  confidence: TreasuryReceivableConfidence;
  source: TreasurySourceType;
  sourceText: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  daysOverdue: number;
};

export type TreasuryCurrencySummary = {
  currencyCode: TreasuryCurrencyCode;
  bankBalanceMinor: bigint;
  plannedOutflow7Minor: bigint;
  conservativeOutflow7Minor: bigint;
  plannedOutflow30Minor: bigint;
  conservativeOutflow30Minor: bigint;
  plannedOutflow45Minor: bigint;
  conservativeOutflow45Minor: bigint;
  plannedAvailableCashMinor: bigint;
  conservativeAvailableCashMinor: bigint;
  minBufferMinor: bigint;
  confirmedReceivables30Minor: bigint;
  probableReceivables30Minor: bigint;
  overdueReceivablesMinor: bigint;
  status: TreasuryRiskStatus;
  message: string;
};

export type TreasuryDashboardData = {
  isAvailable: boolean;
  today: string;
  currencies: TreasuryCurrencySummary[];
  bankAccounts: TreasuryBankAccount[];
  balanceSnapshots: TreasuryBankBalanceSnapshot[];
  vales: TreasuryVale[];
  manualReceivables: TreasuryManualReceivable[];
  alerts: TreasuryAlert[];
  projections: TreasuryProjectionEvent[];
  openItems: {
    isAvailable: boolean;
    totalCount: number;
    receivableCount: number;
    payableCount: number;
  };
};
