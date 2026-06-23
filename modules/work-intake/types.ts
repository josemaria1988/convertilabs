export const WORK_INTAKE_SOURCE_TYPES = [
  "manual",
  "web_form",
  "email",
  "api",
  "zeta",
  "whatsapp",
  "phone",
  "visit",
  "other",
] as const;

export type WorkIntakeSourceType = typeof WORK_INTAKE_SOURCE_TYPES[number];

export const WORK_INTAKE_STATUSES = [
  "captured",
  "needs_review",
  "linked_to_party",
  "linked_to_work",
  "converted_to_work",
  "quoted",
  "won",
  "lost",
  "archived",
] as const;

export type WorkIntakeStatus = typeof WORK_INTAKE_STATUSES[number];

export const WORK_INTAKE_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export type WorkIntakePriority = typeof WORK_INTAKE_PRIORITIES[number];

export type WorkIntakeCreateInput = {
  organizationId: string;
  sourceType?: WorkIntakeSourceType | null;
  sourceRefId?: string | null;
  integrationRawRecordId?: string | null;
  interactionId?: string | null;
  externalSourceKey?: string | null;
  idempotencyKey?: string | null;
  rawText?: string | null;
  title: string;
  description?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  partyId?: string | null;
  contactId?: string | null;
  workUnitId?: string | null;
  locationText?: string | null;
  estimatedAmount?: number | null;
  currencyCode?: string | null;
  requestedDate?: string | null;
  status?: WorkIntakeStatus | null;
  priority?: WorkIntakePriority | null;
  assignedToMemberId?: string | null;
  nextAction?: string | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type WorkIntakeItem = {
  id: string;
  organizationId: string;
  sourceType: WorkIntakeSourceType;
  sourceRefId: string | null;
  integrationRawRecordId: string | null;
  interactionId: string | null;
  externalSourceKey: string | null;
  idempotencyKey: string | null;
  rawText: string | null;
  title: string;
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  partyId: string | null;
  partyName: string | null;
  contactId: string | null;
  workUnitId: string | null;
  workUnitName: string | null;
  locationText: string | null;
  estimatedAmount: number | null;
  currencyCode: string;
  requestedDate: string | null;
  status: WorkIntakeStatus;
  priority: WorkIntakePriority;
  assignedToMemberId: string | null;
  nextAction: string | null;
  dueDate: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkIntakeListResult = {
  isAvailable: boolean;
  items: WorkIntakeItem[];
};

export type WorkIntakeMutationResult = {
  id: string;
  created: boolean;
};
