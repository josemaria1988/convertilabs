export const TASK_STATUSES = ["pending", "in_progress", "blocked", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PROCESS_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export const PROCESS_CRITICALITIES = ["low", "medium", "high", "critical"] as const;
export type ProcessCriticality = (typeof PROCESS_CRITICALITIES)[number];

export const PROCESS_RUN_STATUSES = ["pending", "running", "blocked", "done", "cancelled"] as const;
export type ProcessRunStatus = (typeof PROCESS_RUN_STATUSES)[number];

export const PROCESS_RUN_STEP_STATUSES = ["pending", "running", "blocked", "done", "skipped"] as const;
export type ProcessRunStepStatus = (typeof PROCESS_RUN_STEP_STATUSES)[number];

export const OBLIGATION_FREQUENCIES = ["once", "daily", "weekly", "monthly", "quarterly", "yearly", "ad_hoc"] as const;
export type ObligationFrequency = (typeof OBLIGATION_FREQUENCIES)[number];

export const INTERACTION_TARGET_TYPES = [
  "party",
  "contact",
  "work_unit",
  "document",
  "task",
  "open_item",
  "payment",
  "collection",
  "process_run",
] as const;

export type InteractionTargetType = (typeof INTERACTION_TARGET_TYPES)[number];

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  partyId: string | null;
  partyName: string | null;
  workUnitId: string | null;
  workUnitName: string | null;
  documentId: string | null;
  documentName: string | null;
  blockedReason: string | null;
  createdAt: string;
};

export type EntityOption = {
  id: string;
  label: string;
  secondaryLabel: string | null;
};

export type ProcessItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  criticality: ProcessCriticality;
  status: ProcessStatus;
  frequency: string | null;
  currentOwnerLabel: string | null;
  futureOwnerLabel: string | null;
  nextRunDate: string | null;
  publishedVersionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ObligationItem = {
  id: string;
  title: string;
  description: string | null;
  obligationType: string;
  frequency: ObligationFrequency;
  status: "active" | "paused" | "archived";
  responsibleLabel: string | null;
  futureOwnerLabel: string | null;
  nextDueDate: string | null;
  partyId: string | null;
  workUnitId: string | null;
};

export type CaptureNoteItem = {
  id: string;
  title: string | null;
  rawText: string;
  source: string;
  status: "captured" | "structured" | "accepted" | "archived";
  partyId: string | null;
  workUnitId: string | null;
  documentId: string | null;
  createdAt: string;
};

export type AgendaTaxSignal = {
  isAvailable: boolean;
  latestVatRun: {
    id: string;
    periodLabel: string;
    status: string;
    netVatPayable: number;
    reviewFlagsCount: number;
    tracedDocumentsCount: number;
    createdAt: string;
  } | null;
};

export type AgendaCloseSignal = {
  isAvailable: boolean;
  latestCheckRun: {
    id: string;
    status: string;
    blockerCount: number;
    warningCount: number;
    createdAt: string;
  } | null;
};

export type ContinuityRiskItem = {
  key: string;
  title: string;
  description: string;
  severity: ProcessCriticality;
  href: string | null;
};

export type AgendaDashboardData = {
  isAvailable: boolean;
  tasks: TaskItem[];
  dueTasks: TaskItem[];
  blockedTasks: TaskItem[];
  obligations: ObligationItem[];
  tax: AgendaTaxSignal;
  close: AgendaCloseSignal;
  options: {
    parties: EntityOption[];
    workUnits: EntityOption[];
    documents: EntityOption[];
  };
  summary: {
    pendingTasks: number;
    blockedTasks: number;
    dueThisWeek: number;
    unassignedTasks: number;
    activeObligations: number;
  };
};

export type OperationsWorkspaceData = {
  isAvailable: boolean;
  processes: ProcessItem[];
  obligations: ObligationItem[];
  captureNotes: CaptureNoteItem[];
};

export type ContinuityDashboardData = {
  isAvailable: boolean;
  risks: ContinuityRiskItem[];
  criticalProcesses: ProcessItem[];
  obligationsWithoutFutureOwner: ObligationItem[];
  unassignedTasks: TaskItem[];
  blockedTasks: TaskItem[];
  captureNotes: CaptureNoteItem[];
  summary: {
    riskCount: number;
    criticalUnownedProcesses: number;
    undocumentedCriticalProcesses: number;
    obligationsWithoutFutureOwner: number;
    unassignedTasks: number;
    blockedTasks: number;
    rawCaptures: number;
  };
};
