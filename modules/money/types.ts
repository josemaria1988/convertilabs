export type MoneyDirection = "receivable" | "payable";

export type MoneyItem = {
  id: string;
  direction: MoneyDirection;
  partyId: string | null;
  partyName: string;
  partyTaxId: string | null;
  workUnitId: string | null;
  workUnitName: string | null;
  workUnitCode: string | null;
  sourceDocumentId: string | null;
  documentRole: string | null;
  documentType: string | null;
  issueDate: string | null;
  dueDate: string | null;
  daysOverdue: number;
  isDueSoon: boolean;
  currencyCode: string;
  outstandingAmount: number;
  displayAmount: number;
  status: string | null;
  settlementCount: number;
};

export type MoneyGroup = {
  key: string;
  label: string;
  secondaryLabel: string | null;
  direction: MoneyDirection | "mixed";
  count: number;
  outstandingAmount: number;
  overdueCount: number;
  dueSoonCount: number;
  href: string | null;
};

export type MoneyDashboardData = {
  isAvailable: boolean;
  today: string;
  items: MoneyItem[];
  receivables: MoneyItem[];
  payables: MoneyItem[];
  overdue: MoneyItem[];
  dueSoon: MoneyItem[];
  byParty: MoneyGroup[];
  byWorkUnit: MoneyGroup[];
  summary: {
    receivableCount: number;
    receivableAmount: number;
    payableCount: number;
    payableAmount: number;
    overdueCount: number;
    overdueAmount: number;
    dueSoonCount: number;
    dueSoonAmount: number;
    netPosition: number;
    partiesWithBalance: number;
    workUnitsWithBalance: number;
  };
};
