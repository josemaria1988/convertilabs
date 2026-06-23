import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { buildBusinessEventPayload } from "@/modules/events";
import { createTask } from "@/modules/operations";
import {
  buildWorkIntakePayload,
  type WorkIntakeRowPayload,
} from "@/modules/work-intake/service";
import type {
  WorkIntakeCreateInput,
  WorkIntakeItem,
  WorkIntakeListResult,
  WorkIntakeMutationResult,
  WorkIntakePriority,
  WorkIntakeSourceType,
  WorkIntakeStatus,
} from "@/modules/work-intake/types";

type JsonRecord = Record<string, unknown>;

type WorkIntakeRow = {
  id: string;
  organization_id: string;
  source_type: WorkIntakeSourceType;
  source_ref_id: string | null;
  integration_raw_record_id: string | null;
  interaction_id: string | null;
  external_source_key: string | null;
  idempotency_key: string | null;
  raw_text: string | null;
  title: string;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  party_id: string | null;
  contact_id: string | null;
  work_unit_id: string | null;
  location_text: string | null;
  estimated_amount: number | null;
  currency_code: string | null;
  requested_date: string | null;
  status: WorkIntakeStatus;
  priority: WorkIntakePriority;
  assigned_to_member_id: string | null;
  next_action: string | null;
  due_date: string | null;
  metadata_json: JsonRecord | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PartyLabelRow = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
};

type WorkUnitLabelRow = {
  id: string;
  name: string | null;
  code: string | null;
};

const SELECT_WORK_INTAKE_FIELDS = [
  "id",
  "organization_id",
  "source_type",
  "source_ref_id",
  "integration_raw_record_id",
  "interaction_id",
  "external_source_key",
  "idempotency_key",
  "raw_text",
  "title",
  "description",
  "customer_name",
  "customer_email",
  "customer_phone",
  "party_id",
  "contact_id",
  "work_unit_id",
  "location_text",
  "estimated_amount",
  "currency_code",
  "requested_date",
  "status",
  "priority",
  "assigned_to_member_id",
  "next_action",
  "due_date",
  "metadata_json",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

const CLOSED_STATUSES = new Set(["won", "lost", "archived"]);

function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function isDuplicateError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "23505"
    || error?.message?.toLowerCase().includes("duplicate key") === true;
}

function mapWorkIntakeRow(
  row: WorkIntakeRow,
  labels: {
    parties: Map<string, string>;
    workUnits: Map<string, string>;
  },
): WorkIntakeItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceType: row.source_type,
    sourceRefId: row.source_ref_id,
    integrationRawRecordId: row.integration_raw_record_id,
    interactionId: row.interaction_id,
    externalSourceKey: row.external_source_key,
    idempotencyKey: row.idempotency_key,
    rawText: row.raw_text,
    title: row.title,
    description: row.description,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    partyId: row.party_id,
    partyName: row.party_id ? labels.parties.get(row.party_id) ?? null : null,
    contactId: row.contact_id,
    workUnitId: row.work_unit_id,
    workUnitName: row.work_unit_id ? labels.workUnits.get(row.work_unit_id) ?? null : null,
    locationText: row.location_text,
    estimatedAmount: row.estimated_amount,
    currencyCode: row.currency_code ?? "UYU",
    requestedDate: row.requested_date,
    status: row.status,
    priority: row.priority,
    assignedToMemberId: row.assigned_to_member_id,
    nextAction: row.next_action,
    dueDate: row.due_date,
    metadata: asJsonRecord(row.metadata_json),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadPartyLabels(
  supabase: SupabaseClient,
  organizationId: string,
  partyIds: string[],
) {
  if (partyIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("parties")
    .select("id, display_name, legal_name")
    .eq("organization_id", organizationId)
    .in("id", Array.from(new Set(partyIds)));

  if (error) {
    if (isMissingSupabaseRelationError(error, "parties")) {
      return new Map<string, string>();
    }

    throw new Error(error.message);
  }

  return new Map(
    ((data as PartyLabelRow[] | null) ?? []).map((row) => [
      row.id,
      row.display_name ?? row.legal_name ?? "Party sin nombre",
    ]),
  );
}

async function loadWorkUnitLabels(
  supabase: SupabaseClient,
  organizationId: string,
  workUnitIds: string[],
) {
  if (workUnitIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("work_units")
    .select("id, name, code")
    .eq("organization_id", organizationId)
    .in("id", Array.from(new Set(workUnitIds)));

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_units")) {
      return new Map<string, string>();
    }

    throw new Error(error.message);
  }

  return new Map(
    ((data as WorkUnitLabelRow[] | null) ?? []).map((row) => [
      row.id,
      row.code ? `${row.name ?? "Trabajo"} (${row.code})` : row.name ?? "Trabajo sin nombre",
    ]),
  );
}

async function attachLabels(
  supabase: SupabaseClient,
  organizationId: string,
  rows: WorkIntakeRow[],
) {
  const [parties, workUnits] = await Promise.all([
    loadPartyLabels(
      supabase,
      organizationId,
      rows
        .map((row) => row.party_id)
        .filter((value): value is string => Boolean(value)),
    ),
    loadWorkUnitLabels(
      supabase,
      organizationId,
      rows
        .map((row) => row.work_unit_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]);

  return rows.map((row) => mapWorkIntakeRow(row, { parties, workUnits }));
}

async function recordWorkIntakeEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
    title: string;
    partyId?: string | null;
    workUnitId?: string | null;
    actorId?: string | null;
    summary: string;
    eventCode: string;
  },
) {
  const eventPayload = buildBusinessEventPayload({
    organizationId: input.organizationId,
    eventType: "administrative_decision_recorded",
    sourceEntityType: "other",
    sourceEntityId: input.intakeId,
    partyId: input.partyId ?? null,
    workUnitId: input.workUnitId ?? null,
    actorProfileId: input.actorId ?? null,
    summary: input.summary,
    metadata: {
      event_code: input.eventCode,
      work_intake_item_id: input.intakeId,
      work_intake_title: input.title,
    },
  });
  const { error } = await supabase
    .from("business_events")
    .insert(eventPayload);

  if (error && !isMissingSupabaseRelationError(error, "business_events")) {
    throw new Error(error.message);
  }
}

async function findExistingWorkIntakeItem(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    idempotencyKey?: string | null;
    externalSourceKey?: string | null;
  },
) {
  const candidates: Array<["idempotency_key" | "external_source_key", string | null | undefined]> = [
    ["idempotency_key", input.idempotencyKey],
    ["external_source_key", input.externalSourceKey],
  ];

  for (const [column, value] of candidates) {
    if (!value) {
      continue;
    }

    const { data, error } = await supabase
      .from("work_intake_items")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq(column, value)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingSupabaseRelationError(error, "work_intake_items")) {
        return null;
      }

      throw new Error(error.message);
    }

    if (data && typeof (data as { id?: unknown }).id === "string") {
      return String((data as { id: string }).id);
    }
  }

  return null;
}

export async function listWorkIntakeItems(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    limit?: number;
    workUnitId?: string | null;
    includeClosed?: boolean;
  },
): Promise<WorkIntakeListResult> {
  let query = supabase
    .from("work_intake_items")
    .select(SELECT_WORK_INTAKE_FIELDS)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 40);

  if (input.workUnitId) {
    query = query.eq("work_unit_id", input.workUnitId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_intake_items")) {
      return {
        isAvailable: false,
        items: [],
      };
    }

    throw new Error(error.message);
  }

  const rows = ((data as unknown as WorkIntakeRow[] | null) ?? [])
    .filter((row) => input.includeClosed || !CLOSED_STATUSES.has(row.status));

  return {
    isAvailable: true,
    items: await attachLabels(supabase, input.organizationId, rows),
  };
}

export async function loadWorkIntakeItem(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
  },
) {
  const { data, error } = await supabase
    .from("work_intake_items")
    .select(SELECT_WORK_INTAKE_FIELDS)
    .eq("organization_id", input.organizationId)
    .eq("id", input.intakeId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseRelationError(error, "work_intake_items")) {
      return null;
    }

    throw new Error(error.message);
  }

  const row = (data as WorkIntakeRow | null) ?? null;

  if (!row) {
    return null;
  }

  const [item] = await attachLabels(supabase, input.organizationId, [row]);

  return item ?? null;
}

export async function createWorkIntakeItem(
  supabase: SupabaseClient,
  input: WorkIntakeCreateInput,
) {
  const payload = buildWorkIntakePayload(input);
  const { data, error } = await supabase
    .from("work_intake_items")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const id = String((data as { id: string }).id);

  await recordWorkIntakeEvent(supabase, {
    organizationId: payload.organization_id,
    intakeId: id,
    title: payload.title,
    partyId: payload.party_id,
    workUnitId: payload.work_unit_id,
    actorId: payload.created_by,
    summary: `Solicitud registrada: ${payload.title}`,
    eventCode: "work_intake_created",
  });

  return id;
}

export async function createOrReuseWorkIntakeItem(
  supabase: SupabaseClient,
  input: WorkIntakeCreateInput,
): Promise<WorkIntakeMutationResult> {
  const payload = buildWorkIntakePayload(input);
  const existingId = await findExistingWorkIntakeItem(supabase, {
    organizationId: payload.organization_id,
    idempotencyKey: payload.idempotency_key,
    externalSourceKey: payload.external_source_key,
  });

  if (existingId) {
    return {
      id: existingId,
      created: false,
    };
  }

  const { data, error } = await supabase
    .from("work_intake_items")
    .insert(payload)
    .select("id")
    .limit(1)
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      const duplicateId = await findExistingWorkIntakeItem(supabase, {
        organizationId: payload.organization_id,
        idempotencyKey: payload.idempotency_key,
        externalSourceKey: payload.external_source_key,
      });

      if (duplicateId) {
        return {
          id: duplicateId,
          created: false,
        };
      }
    }

    throw new Error(error.message);
  }

  const id = String((data as { id: string }).id);

  await recordWorkIntakeEvent(supabase, {
    organizationId: payload.organization_id,
    intakeId: id,
    title: payload.title,
    partyId: payload.party_id,
    workUnitId: payload.work_unit_id,
    actorId: payload.created_by,
    summary: `Solicitud registrada desde ${payload.source_type}: ${payload.title}`,
    eventCode: "work_intake_created",
  });

  return {
    id,
    created: true,
  };
}

async function updateWorkIntake(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
    patch: Partial<WorkIntakeRowPayload>;
    actorId?: string | null;
    eventCode: string;
    summary: string;
  },
) {
  const { data, error } = await supabase
    .from("work_intake_items")
    .update({
      ...input.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.intakeId)
    .select("id, title, party_id, work_unit_id")
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updated = data as {
    id: string;
    title: string;
    party_id: string | null;
    work_unit_id: string | null;
  };

  await recordWorkIntakeEvent(supabase, {
    organizationId: input.organizationId,
    intakeId: input.intakeId,
    title: updated.title,
    partyId: updated.party_id,
    workUnitId: updated.work_unit_id,
    actorId: input.actorId ?? null,
    summary: input.summary,
    eventCode: input.eventCode,
  });

  return updated.id;
}

export async function linkWorkIntakeToParty(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
    partyId: string;
    actorId?: string | null;
  },
) {
  return updateWorkIntake(supabase, {
    organizationId: input.organizationId,
    intakeId: input.intakeId,
    actorId: input.actorId,
    eventCode: "work_intake_linked_to_party",
    summary: "Solicitud asociada a cliente/party.",
    patch: {
      party_id: input.partyId,
      status: "linked_to_party",
    },
  });
}

export async function linkWorkIntakeToWorkUnit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
    workUnitId: string;
    actorId?: string | null;
    status?: WorkIntakeStatus;
  },
) {
  return updateWorkIntake(supabase, {
    organizationId: input.organizationId,
    intakeId: input.intakeId,
    actorId: input.actorId,
    eventCode: "work_intake_linked_to_work_unit",
    summary: "Solicitud asociada a trabajo.",
    patch: {
      work_unit_id: input.workUnitId,
      status: input.status ?? "linked_to_work",
    },
  });
}

export async function updateWorkIntakeStatus(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
    status: WorkIntakeStatus;
    actorId?: string | null;
  },
) {
  return updateWorkIntake(supabase, {
    organizationId: input.organizationId,
    intakeId: input.intakeId,
    actorId: input.actorId,
    eventCode: "work_intake_status_changed",
    summary: `Estado de solicitud actualizado a ${input.status}.`,
    patch: {
      status: input.status,
    },
  });
}

export async function createWorkIntakeFollowUpTask(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    intakeId: string;
    actorId?: string | null;
    title?: string | null;
    dueDate?: string | null;
  },
) {
  const intake = await loadWorkIntakeItem(supabase, {
    organizationId: input.organizationId,
    intakeId: input.intakeId,
  });

  if (!intake) {
    throw new Error("Solicitud no encontrada.");
  }

  const taskId = await createTask(supabase, {
    organizationId: input.organizationId,
    title: input.title ?? intake.nextAction ?? `Seguir solicitud: ${intake.title}`,
    description: intake.description ?? intake.rawText,
    status: "pending",
    priority: intake.priority,
    dueDate: input.dueDate ?? intake.dueDate,
    partyId: intake.partyId,
    workUnitId: intake.workUnitId,
    actorId: input.actorId ?? null,
    metadata: {
      created_from: "work_intake",
      work_intake_item_id: intake.id,
      source_type: intake.sourceType,
    },
  });

  await recordWorkIntakeEvent(supabase, {
    organizationId: input.organizationId,
    intakeId: intake.id,
    title: intake.title,
    partyId: intake.partyId,
    workUnitId: intake.workUnitId,
    actorId: input.actorId ?? null,
    summary: "Tarea de seguimiento creada desde solicitud.",
    eventCode: "work_intake_follow_up_task_created",
  });

  return taskId;
}
