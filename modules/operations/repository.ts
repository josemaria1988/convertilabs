import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { loadOrganizationVatRuns } from "@/modules/tax/vat-runs";
import {
  buildCaptureNotePayload,
  buildObligationPayload,
  buildProcessPayload,
  buildProcessRunPayload,
  buildProcessRunStepPayload,
  buildProcessStepPayload,
  buildProcessVersionPayload,
  buildTaskPayload,
  deriveContinuityRiskSignals,
  splitSteps,
} from "@/modules/operations/service";
import type {
  AgendaDashboardData,
  AgendaCloseSignal,
  AgendaTaxSignal,
  CaptureNoteItem,
  ContinuityDashboardData,
  EntityOption,
  ObligationFrequency,
  ObligationItem,
  OperationsWorkspaceData,
  ProcessCriticality,
  ProcessItem,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "@/modules/operations/types";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  party_id: string | null;
  work_unit_id: string | null;
  document_id: string | null;
  blocked_reason: string | null;
  created_at: string;
};

type ProcessRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  criticality: ProcessCriticality;
  status: "draft" | "active" | "paused" | "archived";
  frequency: string | null;
  current_owner_label: string | null;
  future_owner_label: string | null;
  next_run_date: string | null;
  created_at: string;
  updated_at: string;
};

type ObligationRow = {
  id: string;
  title: string;
  description: string | null;
  obligation_type: string | null;
  frequency: ObligationFrequency;
  status: "active" | "paused" | "archived";
  responsible_label: string | null;
  future_owner_label: string | null;
  next_due_date: string | null;
  party_id: string | null;
  work_unit_id: string | null;
};

type CaptureNoteRow = {
  id: string;
  title: string | null;
  raw_text: string;
  source: string;
  status: "captured" | "structured" | "accepted" | "archived";
  party_id: string | null;
  work_unit_id: string | null;
  document_id: string | null;
  created_at: string;
};

type ProcessStepRow = {
  id: string;
  step_number: number;
  title: string;
};

type CloseCheckRunRow = {
  id: string;
  status: string | null;
  summary_json: Record<string, unknown> | null;
  created_at: string | null;
};

function isMissingOperationsTable(error: unknown) {
  return isMissingSupabaseRelationError(error as { message?: string; code?: string }, "tasks")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "processes")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "obligations")
    || isMissingSupabaseRelationError(error as { message?: string; code?: string }, "capture_notes");
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mapTask(row: TaskRow, labels: {
  parties: Map<string, string>;
  workUnits: Map<string, string>;
  documents: Map<string, string>;
}): TaskItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    partyId: row.party_id,
    partyName: row.party_id ? labels.parties.get(row.party_id) ?? null : null,
    workUnitId: row.work_unit_id,
    workUnitName: row.work_unit_id ? labels.workUnits.get(row.work_unit_id) ?? null : null,
    documentId: row.document_id,
    documentName: row.document_id ? labels.documents.get(row.document_id) ?? null : null,
    blockedReason: row.blocked_reason,
    createdAt: row.created_at,
  };
}

function mapProcess(row: ProcessRow, publishedVersionsByProcessId = new Map<string, number>()): ProcessItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    criticality: row.criticality,
    status: row.status,
    frequency: row.frequency,
    currentOwnerLabel: row.current_owner_label,
    futureOwnerLabel: row.future_owner_label,
    nextRunDate: row.next_run_date,
    publishedVersionCount: publishedVersionsByProcessId.get(row.id) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObligation(row: ObligationRow): ObligationItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    obligationType: row.obligation_type ?? "administrative",
    frequency: row.frequency,
    status: row.status,
    responsibleLabel: row.responsible_label,
    futureOwnerLabel: row.future_owner_label,
    nextDueDate: row.next_due_date,
    partyId: row.party_id,
    workUnitId: row.work_unit_id,
  };
}

function mapCaptureNote(row: CaptureNoteRow): CaptureNoteItem {
  return {
    id: row.id,
    title: row.title,
    rawText: row.raw_text,
    source: row.source,
    status: row.status,
    partyId: row.party_id,
    workUnitId: row.work_unit_id,
    documentId: row.document_id,
    createdAt: row.created_at,
  };
}

async function loadOptions(supabase: SupabaseClient, organizationId: string) {
  const [partyResult, workResult, documentResult] = await Promise.all([
    supabase
      .from("parties")
      .select("id, display_name, legal_name, tax_id")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("display_name", { ascending: true })
      .limit(200),
    supabase
      .from("work_units")
      .select("id, name, code")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("documents")
      .select("id, original_filename, document_date")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const toOptions = (
    rows: Array<Record<string, unknown>> | null,
    labelKeys: string[],
    secondaryKeys: string[] = [],
  ): EntityOption[] => ((rows ?? [])).map((row) => ({
    id: String(row.id),
    label: labelKeys.map((key) => row[key]).find((value) => typeof value === "string" && value) as string,
    secondaryLabel: secondaryKeys.map((key) => row[key]).find((value) => typeof value === "string" && value) as string | null ?? null,
  }));

  return {
    parties: partyResult.error ? [] : toOptions(partyResult.data as Array<Record<string, unknown>> | null, ["display_name", "legal_name"], ["tax_id"]),
    workUnits: workResult.error ? [] : toOptions(workResult.data as Array<Record<string, unknown>> | null, ["name"], ["code"]),
    documents: documentResult.error ? [] : toOptions(documentResult.data as Array<Record<string, unknown>> | null, ["original_filename"], ["document_date"]),
  };
}

async function loadTaskLabels(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const options = await loadOptions(supabase, organizationId);

  return {
    options,
    labels: {
      parties: new Map(options.parties.map((item) => [item.id, item.label])),
      workUnits: new Map(options.workUnits.map((item) => [item.id, item.label])),
      documents: new Map(options.documents.map((item) => [item.id, item.label])),
    },
  };
}

async function loadPublishedVersionCounts(
  supabase: SupabaseClient,
  organizationId: string,
  processIds: string[],
) {
  if (processIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("process_versions")
    .select("process_id")
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .in("process_id", processIds);

  if (error) {
    if (isMissingSupabaseRelationError(error, "process_versions")) {
      return new Map<string, number>();
    }

    throw new Error(error.message);
  }

  const counts = new Map<string, number>();

  for (const row of ((data as Array<{ process_id?: string | null }> | null) ?? [])) {
    if (row.process_id) {
      counts.set(row.process_id, (counts.get(row.process_id) ?? 0) + 1);
    }
  }

  return counts;
}

async function loadAgendaTaxSignal(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AgendaTaxSignal> {
  try {
    const runs = await loadOrganizationVatRuns(supabase, organizationId);
    const latest = runs[0] ?? null;

    return {
      isAvailable: true,
      latestVatRun: latest
        ? {
          id: latest.id,
          periodLabel: latest.periodLabel,
          status: latest.status,
          netVatPayable: latest.netVatPayable,
          reviewFlagsCount: latest.reviewFlagsCount,
          tracedDocumentsCount: latest.tracedDocuments.length,
          createdAt: latest.createdAt,
        }
        : null,
    };
  } catch (error) {
    const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string };

    if (
      isMissingSupabaseRelationError(supabaseError, "vat_runs")
      || isMissingSupabaseRelationError(supabaseError, "vat_run_documents")
      || isMissingSupabaseRelationError(supabaseError, "tax_periods")
    ) {
      return {
        isAvailable: false,
        latestVatRun: null,
      };
    }

    throw error;
  }
}

async function loadAgendaCloseSignal(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AgendaCloseSignal> {
  const { data, error } = await supabase
    .from("close_check_runs")
    .select("id, status, summary_json, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(error, "close_check_runs")) {
      return {
        isAvailable: false,
        latestCheckRun: null,
      };
    }

    throw new Error(error.message);
  }

  const row = (data as CloseCheckRunRow | null) ?? null;

  if (!row) {
    return {
      isAvailable: true,
      latestCheckRun: null,
    };
  }

  return {
    isAvailable: true,
    latestCheckRun: {
      id: row.id,
      status: row.status ?? "warning",
      blockerCount: asNumber(row.summary_json?.blocker_count),
      warningCount: asNumber(row.summary_json?.warning_count),
      createdAt: row.created_at ?? "",
    },
  };
}

export async function loadAgendaDashboard(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AgendaDashboardData> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, party_id, work_unit_id, document_id, blocked_reason, created_at")
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingOperationsTable(error)) {
      return {
        isAvailable: false,
        tasks: [],
        dueTasks: [],
        blockedTasks: [],
        obligations: [],
        tax: { isAvailable: false, latestVatRun: null },
        close: { isAvailable: false, latestCheckRun: null },
        options: { parties: [], workUnits: [], documents: [] },
        summary: {
          pendingTasks: 0,
          blockedTasks: 0,
          dueThisWeek: 0,
          unassignedTasks: 0,
          activeObligations: 0,
        },
      };
    }

    throw new Error(error.message);
  }

  const rows = (data as TaskRow[] | null) ?? [];
  const { options, labels } = await loadTaskLabels(supabase, organizationId);
  const tasks = rows.map((row) => mapTask(row, labels));
  const today = todayIso();
  const weekEnd = addDaysIso(today, 7);
  const [obligations, tax, close] = await Promise.all([
    loadObligations(supabase, organizationId),
    loadAgendaTaxSignal(supabase, organizationId),
    loadAgendaCloseSignal(supabase, organizationId),
  ]);

  return {
    isAvailable: true,
    tasks,
    dueTasks: tasks.filter((task) => task.dueDate && task.dueDate <= weekEnd && task.status !== "done"),
    blockedTasks: tasks.filter((task) => task.status === "blocked"),
    obligations,
    tax,
    close,
    options,
    summary: {
      pendingTasks: tasks.filter((task) => ["pending", "in_progress"].includes(task.status)).length,
      blockedTasks: tasks.filter((task) => task.status === "blocked").length,
      dueThisWeek: tasks.filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= weekEnd).length,
      unassignedTasks: tasks.filter((task) => !task.partyId && !task.workUnitId && !task.documentId).length,
      activeObligations: obligations.filter((obligation) => obligation.status === "active").length,
    },
  };
}

async function loadProcesses(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("processes")
    .select("id, name, category, description, criticality, status, frequency, current_owner_label, future_owner_label, next_run_date, created_at, updated_at")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(120);

  if (error) {
    if (isMissingSupabaseRelationError(error, "processes")) {
      return null;
    }

    throw new Error(error.message);
  }

  const rows = (data as ProcessRow[] | null) ?? [];
  const counts = await loadPublishedVersionCounts(
    supabase,
    organizationId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => mapProcess(row, counts));
}

async function loadObligations(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("obligations")
    .select("id, title, description, obligation_type, frequency, status, responsible_label, future_owner_label, next_due_date, party_id, work_unit_id")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("next_due_date", { ascending: true, nullsFirst: false })
    .limit(120);

  if (error) {
    if (isMissingSupabaseRelationError(error, "obligations")) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data as ObligationRow[] | null) ?? []).map(mapObligation);
}

async function loadCaptureNotes(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("capture_notes")
    .select("id, title, raw_text, source, status, party_id, work_unit_id, document_id, created_at")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    if (isMissingSupabaseRelationError(error, "capture_notes")) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data as CaptureNoteRow[] | null) ?? []).map(mapCaptureNote);
}

export async function loadOperationsWorkspace(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OperationsWorkspaceData> {
  const processes = await loadProcesses(supabase, organizationId);

  if (processes === null) {
    return {
      isAvailable: false,
      processes: [],
      obligations: [],
      captureNotes: [],
    };
  }

  const [obligations, captureNotes] = await Promise.all([
    loadObligations(supabase, organizationId),
    loadCaptureNotes(supabase, organizationId),
  ]);

  return {
    isAvailable: true,
    processes,
    obligations,
    captureNotes,
  };
}

export async function loadContinuityDashboard(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    organizationSlug: string;
  },
): Promise<ContinuityDashboardData> {
  const [agenda, operations] = await Promise.all([
    loadAgendaDashboard(supabase, input.organizationId),
    loadOperationsWorkspace(supabase, input.organizationId),
  ]);

  if (!agenda.isAvailable || !operations.isAvailable) {
    return {
      isAvailable: false,
      risks: [],
      criticalProcesses: [],
      obligationsWithoutFutureOwner: [],
      unassignedTasks: [],
      blockedTasks: [],
      captureNotes: [],
      summary: {
        riskCount: 0,
        criticalUnownedProcesses: 0,
        undocumentedCriticalProcesses: 0,
        obligationsWithoutFutureOwner: 0,
        unassignedTasks: 0,
        blockedTasks: 0,
        rawCaptures: 0,
      },
    };
  }

  const criticalProcesses = operations.processes.filter((process) =>
    ["high", "critical"].includes(process.criticality));
  const obligationsWithoutFutureOwner = operations.obligations.filter((obligation) =>
    obligation.status === "active" && !obligation.futureOwnerLabel);
  const unassignedTasks = agenda.tasks.filter((task) =>
    !task.partyId && !task.workUnitId && !task.documentId && task.status !== "done");
  const blockedTasks = agenda.tasks.filter((task) => task.status === "blocked");
  const risks = deriveContinuityRiskSignals({
    organizationSlug: input.organizationSlug,
    processes: operations.processes,
    obligations: operations.obligations,
    tasks: agenda.tasks,
    captureNotes: operations.captureNotes,
  });

  return {
    isAvailable: true,
    risks,
    criticalProcesses,
    obligationsWithoutFutureOwner,
    unassignedTasks,
    blockedTasks,
    captureNotes: operations.captureNotes,
    summary: {
      riskCount: risks.length,
      criticalUnownedProcesses: criticalProcesses.filter((process) => !process.futureOwnerLabel).length,
      undocumentedCriticalProcesses: criticalProcesses.filter((process) => process.publishedVersionCount === 0).length,
      obligationsWithoutFutureOwner: obligationsWithoutFutureOwner.length,
      unassignedTasks: unassignedTasks.length,
      blockedTasks: blockedTasks.length,
      rawCaptures: operations.captureNotes.filter((note) => note.status === "captured").length,
    },
  };
}

export async function createTask(
  supabase: SupabaseClient,
  input: Parameters<typeof buildTaskPayload>[0],
) {
  const payload = buildTaskPayload(input);
  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return String((data as { id: string }).id);
}

export async function createProcessWithInitialVersion(
  supabase: SupabaseClient,
  input: Parameters<typeof buildProcessPayload>[0] & {
    stepsText?: string | null;
  },
) {
  const processPayload = buildProcessPayload(input);
  const { data: processData, error: processError } = await supabase
    .from("processes")
    .insert(processPayload)
    .select("id")
    .limit(1)
    .single();

  if (processError) {
    throw new Error(processError.message);
  }

  const processId = String((processData as { id: string }).id);
  const versionPayload = buildProcessVersionPayload({
    organizationId: input.organizationId,
    processId,
    summary: input.description,
    actorId: input.actorId ?? null,
  });
  const { data: versionData, error: versionError } = await supabase
    .from("process_versions")
    .insert(versionPayload)
    .select("id")
    .limit(1)
    .single();

  if (versionError) {
    throw new Error(versionError.message);
  }

  const versionId = String((versionData as { id: string }).id);
  const steps = splitSteps(input.stepsText).map((title, index) =>
    buildProcessStepPayload({
      organizationId: input.organizationId,
      processVersionId: versionId,
      stepNumber: index + 1,
      title,
    }));

  if (steps.length > 0) {
    const { error: stepsError } = await supabase
      .from("process_steps")
      .insert(steps);

    if (stepsError) {
      throw new Error(stepsError.message);
    }
  }

  return processId;
}

export async function createObligation(
  supabase: SupabaseClient,
  input: Parameters<typeof buildObligationPayload>[0],
) {
  const payload = buildObligationPayload(input);
  const { data, error } = await supabase
    .from("obligations")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const obligationId = String((data as { id: string }).id);

  if (payload.next_due_date) {
    const { error: occurrenceError } = await supabase
      .from("obligation_occurrences")
      .upsert({
        organization_id: input.organizationId,
        obligation_id: obligationId,
        due_date: payload.next_due_date,
        status: "pending",
        metadata_json: {
          created_from: "obligation_form",
        },
      }, {
        onConflict: "organization_id,obligation_id,due_date",
      });

    if (occurrenceError) {
      throw new Error(occurrenceError.message);
    }
  }

  return obligationId;
}

export async function createCaptureNote(
  supabase: SupabaseClient,
  input: Parameters<typeof buildCaptureNotePayload>[0],
) {
  const payload = buildCaptureNotePayload(input);
  const { data, error } = await supabase
    .from("capture_notes")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return String((data as { id: string }).id);
}

export async function startProcessRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    processId: string;
    title?: string | null;
    dueDate?: string | null;
    partyId?: string | null;
    workUnitId?: string | null;
    documentId?: string | null;
    actorId?: string | null;
  },
) {
  const { data: processData, error: processError } = await supabase
    .from("processes")
    .select("id, name")
    .eq("organization_id", input.organizationId)
    .eq("id", input.processId)
    .limit(1)
    .single();

  if (processError) {
    throw new Error(processError.message);
  }

  const { data: versionData, error: versionError } = await supabase
    .from("process_versions")
    .select("id, version_number")
    .eq("organization_id", input.organizationId)
    .eq("process_id", input.processId)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }

  const versionId = (versionData as { id?: string | null } | null)?.id ?? null;
  const processName = (processData as { name?: string | null }).name ?? "Proceso";
  const runPayload = buildProcessRunPayload({
    organizationId: input.organizationId,
    processId: input.processId,
    processVersionId: versionId,
    title: input.title ?? processName,
    dueDate: input.dueDate,
    partyId: input.partyId,
    workUnitId: input.workUnitId,
    documentId: input.documentId,
    actorId: input.actorId ?? null,
    metadata: {
      created_from: "processes_workspace",
    },
  });

  const { data: runData, error: runError } = await supabase
    .from("process_runs")
    .insert(runPayload)
    .select("id")
    .limit(1)
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  const runId = String((runData as { id: string }).id);

  if (versionId) {
    const { data: stepRows, error: stepsError } = await supabase
      .from("process_steps")
      .select("id, step_number, title")
      .eq("organization_id", input.organizationId)
      .eq("process_version_id", versionId)
      .order("step_number", { ascending: true });

    if (stepsError) {
      throw new Error(stepsError.message);
    }

    const runSteps = ((stepRows as ProcessStepRow[] | null) ?? []).map((step) =>
      buildProcessRunStepPayload({
        organizationId: input.organizationId,
        processRunId: runId,
        processStepId: step.id,
        stepNumber: step.step_number,
        title: step.title,
      }));

    if (runSteps.length > 0) {
      const { error: runStepsError } = await supabase
        .from("process_run_steps")
        .insert(runSteps);

      if (runStepsError) {
        throw new Error(runStepsError.message);
      }
    }
  }

  return runId;
}

export async function blockProcessRunStep(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    processRunStepId: string;
    blockedReason: string;
  },
) {
  const { error } = await supabase
    .from("process_run_steps")
    .update({
      status: "blocked",
      blocked_reason: input.blockedReason,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.processRunStepId);

  if (error) {
    throw new Error(error.message);
  }
}
