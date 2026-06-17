import type {
  CaptureNoteItem,
  ContinuityRiskItem,
  ObligationFrequency,
  ObligationItem,
  ProcessCriticality,
  ProcessItem,
  ProcessRunStatus,
  ProcessRunStepStatus,
  TaskPriority,
  TaskItem,
  TaskStatus,
} from "@/modules/operations/types";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function requiredText(value: string | null | undefined, label: string) {
  const normalized = compactText(value);

  if (!normalized) {
    throw new Error(`${label} es obligatorio.`);
  }

  return normalized;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function canManageOperations(role: string) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role);
}

export function buildTaskPayload(input: {
  organizationId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  partyId?: string | null;
  workUnitId?: string | null;
  documentId?: string | null;
  blockedReason?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const status = input.status ?? "pending";

  return {
    organization_id: input.organizationId,
    title: requiredText(input.title, "Titulo de tarea"),
    description: compactText(input.description),
    status,
    priority: input.priority ?? "normal",
    due_date: compactText(input.dueDate),
    party_id: input.partyId ?? null,
    work_unit_id: input.workUnitId ?? null,
    document_id: input.documentId ?? null,
    blocked_reason: status === "blocked" ? compactText(input.blockedReason) : null,
    completed_at: status === "done" ? new Date().toISOString() : null,
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildProcessPayload(input: {
  organizationId: string;
  name: string;
  category?: string | null;
  description?: string | null;
  criticality?: ProcessCriticality;
  frequency?: string | null;
  currentOwnerLabel?: string | null;
  futureOwnerLabel?: string | null;
  nextRunDate?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const name = requiredText(input.name, "Nombre de proceso");

  return {
    organization_id: input.organizationId,
    name,
    normalized_name: normalizeName(name),
    category: compactText(input.category),
    description: compactText(input.description),
    criticality: input.criticality ?? "medium",
    status: "active",
    frequency: compactText(input.frequency),
    current_owner_label: compactText(input.currentOwnerLabel),
    future_owner_label: compactText(input.futureOwnerLabel),
    next_run_date: compactText(input.nextRunDate),
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildProcessVersionPayload(input: {
  organizationId: string;
  processId: string;
  versionNumber?: number;
  summary?: string | null;
  actorId?: string | null;
}) {
  return {
    organization_id: input.organizationId,
    process_id: input.processId,
    version_number: input.versionNumber ?? 1,
    status: "published",
    summary: compactText(input.summary),
    published_at: new Date().toISOString(),
    metadata_json: {},
    created_by: input.actorId ?? null,
  };
}

export function buildProcessStepPayload(input: {
  organizationId: string;
  processVersionId: string;
  stepNumber: number;
  title: string;
}) {
  return {
    organization_id: input.organizationId,
    process_version_id: input.processVersionId,
    step_number: input.stepNumber,
    title: requiredText(input.title, "Paso"),
    description: null,
    expected_evidence: null,
    responsible_label: null,
    metadata_json: {},
  };
}

export function buildProcessRunPayload(input: {
  organizationId: string;
  processId: string;
  processVersionId?: string | null;
  title: string;
  dueDate?: string | null;
  partyId?: string | null;
  workUnitId?: string | null;
  documentId?: string | null;
  status?: ProcessRunStatus;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const status = input.status ?? "running";

  return {
    organization_id: input.organizationId,
    process_id: input.processId,
    process_version_id: input.processVersionId ?? null,
    title: requiredText(input.title, "Titulo de corrida"),
    status,
    due_date: compactText(input.dueDate),
    started_at: status === "running" ? new Date().toISOString() : null,
    completed_at: status === "done" ? new Date().toISOString() : null,
    blocked_reason: null,
    party_id: input.partyId ?? null,
    work_unit_id: input.workUnitId ?? null,
    document_id: input.documentId ?? null,
    metadata_json: input.metadata ?? {},
    created_by: input.actorId ?? null,
  };
}

export function buildProcessRunStepPayload(input: {
  organizationId: string;
  processRunId: string;
  processStepId?: string | null;
  stepNumber: number;
  title: string;
  status?: ProcessRunStepStatus;
  blockedReason?: string | null;
}) {
  const status = input.status ?? "pending";

  return {
    organization_id: input.organizationId,
    process_run_id: input.processRunId,
    process_step_id: input.processStepId ?? null,
    step_number: input.stepNumber,
    title: requiredText(input.title, "Paso de corrida"),
    status,
    blocked_reason: status === "blocked" ? compactText(input.blockedReason) : null,
    completed_at: status === "done" ? new Date().toISOString() : null,
    metadata_json: {},
  };
}

export function splitSteps(raw: string | null | undefined) {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[\).\-\s]+/, ""))
    .filter(Boolean);
}

export function buildObligationPayload(input: {
  organizationId: string;
  title: string;
  description?: string | null;
  obligationType?: string | null;
  frequency?: ObligationFrequency;
  responsibleLabel?: string | null;
  futureOwnerLabel?: string | null;
  partyId?: string | null;
  workUnitId?: string | null;
  nextDueDate?: string | null;
  actorId?: string | null;
}) {
  return {
    organization_id: input.organizationId,
    title: requiredText(input.title, "Titulo de obligacion"),
    description: compactText(input.description),
    obligation_type: compactText(input.obligationType) ?? "administrative",
    frequency: input.frequency ?? "monthly",
    status: "active",
    responsible_label: compactText(input.responsibleLabel),
    future_owner_label: compactText(input.futureOwnerLabel),
    party_id: input.partyId ?? null,
    work_unit_id: input.workUnitId ?? null,
    next_due_date: compactText(input.nextDueDate),
    metadata_json: {},
    created_by: input.actorId ?? null,
  };
}

export function buildCaptureNotePayload(input: {
  organizationId: string;
  title?: string | null;
  rawText: string;
  source?: string | null;
  partyId?: string | null;
  workUnitId?: string | null;
  documentId?: string | null;
  actorId?: string | null;
}) {
  return {
    organization_id: input.organizationId,
    title: compactText(input.title),
    raw_text: requiredText(input.rawText, "Texto de captura"),
    source: compactText(input.source) ?? "manual",
    status: "captured",
    proposed_structure_json: {},
    party_id: input.partyId ?? null,
    work_unit_id: input.workUnitId ?? null,
    document_id: input.documentId ?? null,
    created_by: input.actorId ?? null,
  };
}

export function deriveContinuityRiskSignals(input: {
  organizationSlug: string;
  processes: ProcessItem[];
  obligations: ObligationItem[];
  tasks: TaskItem[];
  captureNotes: CaptureNoteItem[];
}): ContinuityRiskItem[] {
  const risks: ContinuityRiskItem[] = [];

  for (const process of input.processes) {
    if (["high", "critical"].includes(process.criticality) && process.publishedVersionCount === 0) {
      risks.push({
        key: `process-undocumented-${process.id}`,
        title: `${process.name} no tiene pasos publicados`,
        description: "Proceso critico sin receta versionada para continuidad.",
        severity: process.criticality,
        href: `/app/o/${input.organizationSlug}/processes`,
      });
    }

    if (["high", "critical"].includes(process.criticality) && !process.futureOwnerLabel) {
      risks.push({
        key: `process-no-future-owner-${process.id}`,
        title: `${process.name} no tiene responsable futuro`,
        description: "La continuidad depende de conocimiento o persona no reemplazada.",
        severity: process.criticality,
        href: `/app/o/${input.organizationSlug}/processes`,
      });
    }
  }

  for (const obligation of input.obligations) {
    if (obligation.status === "active" && !obligation.futureOwnerLabel) {
      risks.push({
        key: `obligation-no-future-owner-${obligation.id}`,
        title: `${obligation.title} no tiene responsable futuro`,
        description: "Obligacion recurrente sin continuidad asignada.",
        severity: "medium",
        href: `/app/o/${input.organizationSlug}/processes`,
      });
    }
  }

  for (const task of input.tasks.filter((item) => item.status === "blocked")) {
    risks.push({
      key: `blocked-task-${task.id}`,
      title: task.title,
      description: task.blockedReason ?? "Tarea bloqueada sin motivo documentado.",
      severity: task.priority === "urgent" ? "critical" : task.priority === "high" ? "high" : "medium",
      href: task.documentId
        ? `/app/o/${input.organizationSlug}/documents/${task.documentId}`
        : `/app/o/${input.organizationSlug}/agenda`,
    });
  }

  for (const note of input.captureNotes.filter((item) => item.status === "captured").slice(0, 5)) {
    risks.push({
      key: `raw-capture-${note.id}`,
      title: note.title ?? "Captura cruda pendiente",
      description: "Hay conocimiento sin estructurar ni convertir en proceso/tarea/obligacion.",
      severity: "medium",
      href: `/app/o/${input.organizationSlug}/processes`,
    });
  }

  return risks;
}
