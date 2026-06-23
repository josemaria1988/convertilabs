import {
  WORK_INTAKE_PRIORITIES,
  WORK_INTAKE_SOURCE_TYPES,
  WORK_INTAKE_STATUSES,
  type WorkIntakeCreateInput,
  type WorkIntakePriority,
  type WorkIntakeSourceType,
  type WorkIntakeStatus,
} from "@/modules/work-intake/types";

type JsonRecord = Record<string, unknown>;

export type WorkIntakeRowPayload = {
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
  currency_code: string;
  requested_date: string | null;
  status: WorkIntakeStatus;
  priority: WorkIntakePriority;
  assigned_to_member_id: string | null;
  next_action: string | null;
  due_date: string | null;
  metadata_json: JsonRecord;
  created_by: string | null;
  updated_at?: string;
};

export function compactText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 0 ? normalized : null;
}

export function normalizeEmail(value: unknown) {
  const text = compactText(value);

  if (!text) {
    return null;
  }

  const lowered = text.toLowerCase();

  return lowered.includes("@") ? lowered : null;
}

export function normalizePhone(value: unknown) {
  const text = compactText(value);

  if (!text) {
    return null;
  }

  return text.replace(/[^\d+]/g, "") || null;
}

export function normalizeCurrencyCode(value: unknown) {
  const text = compactText(value)?.toUpperCase();

  if (!text) {
    return "UYU";
  }

  return /^[A-Z]{3}$/.test(text) ? text : "UYU";
}

export function normalizeAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }

  const text = compactText(value);

  if (!text) {
    return null;
  }

  const parsed = Number(text.replace(/\./g, "").replace(",", "."));

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeIsoDate(value: unknown) {
  const text = compactText(value);

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function parseWorkIntakeSourceType(value: unknown): WorkIntakeSourceType {
  return WORK_INTAKE_SOURCE_TYPES.includes(value as WorkIntakeSourceType)
    ? value as WorkIntakeSourceType
    : "manual";
}

export function parseWorkIntakeStatus(value: unknown): WorkIntakeStatus {
  return WORK_INTAKE_STATUSES.includes(value as WorkIntakeStatus)
    ? value as WorkIntakeStatus
    : "captured";
}

export function parseWorkIntakePriority(value: unknown): WorkIntakePriority {
  return WORK_INTAKE_PRIORITIES.includes(value as WorkIntakePriority)
    ? value as WorkIntakePriority
    : "normal";
}

export function deriveWorkIntakeStatus(input: {
  status?: WorkIntakeStatus | null;
  partyId?: string | null;
  workUnitId?: string | null;
}) {
  if (input.status) {
    return input.status;
  }

  if (input.workUnitId) {
    return "linked_to_work";
  }

  if (input.partyId) {
    return "linked_to_party";
  }

  return "captured";
}

export function buildWorkIntakePayload(input: WorkIntakeCreateInput): WorkIntakeRowPayload {
  const title = compactText(input.title) ?? "Solicitud sin titulo";
  const partyId = compactText(input.partyId);
  const workUnitId = compactText(input.workUnitId);

  return {
    organization_id: input.organizationId,
    source_type: parseWorkIntakeSourceType(input.sourceType),
    source_ref_id: compactText(input.sourceRefId),
    integration_raw_record_id: compactText(input.integrationRawRecordId),
    interaction_id: compactText(input.interactionId),
    external_source_key: compactText(input.externalSourceKey),
    idempotency_key: compactText(input.idempotencyKey),
    raw_text: compactText(input.rawText),
    title,
    description: compactText(input.description),
    customer_name: compactText(input.customerName),
    customer_email: normalizeEmail(input.customerEmail),
    customer_phone: normalizePhone(input.customerPhone),
    party_id: partyId,
    contact_id: compactText(input.contactId),
    work_unit_id: workUnitId,
    location_text: compactText(input.locationText),
    estimated_amount: normalizeAmount(input.estimatedAmount),
    currency_code: normalizeCurrencyCode(input.currencyCode),
    requested_date: normalizeIsoDate(input.requestedDate),
    status: deriveWorkIntakeStatus({
      status: input.status ? parseWorkIntakeStatus(input.status) : null,
      partyId,
      workUnitId,
    }),
    priority: parseWorkIntakePriority(input.priority),
    assigned_to_member_id: compactText(input.assignedToMemberId),
    next_action: compactText(input.nextAction),
    due_date: normalizeIsoDate(input.dueDate),
    metadata_json: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {},
    created_by: compactText(input.createdBy),
  };
}

export function buildRontilWebWorkIntakeInput(input: {
  organizationId: string;
  payload: JsonRecord;
  integrationRawRecordId?: string | null;
  idempotencyKey?: string | null;
}) {
  const payload = input.payload;
  const quoteId = compactText(payload.quote_id ?? payload.quoteId ?? payload.id);
  const customer = payload.customer && typeof payload.customer === "object" && !Array.isArray(payload.customer)
    ? payload.customer as JsonRecord
    : {};
  const sourceUrl = compactText(payload.source_url ?? payload.sourceUrl ?? payload.url);
  const text = compactText(payload.text ?? payload.message ?? payload.description);
  const title = compactText(payload.title)
    ?? (quoteId ? `Solicitud web ${quoteId}` : null)
    ?? (compactText(customer.name) ? `Solicitud web de ${compactText(customer.name)}` : null)
    ?? "Solicitud web";

  return {
    organizationId: input.organizationId,
    sourceType: "web_form" as const,
    sourceRefId: quoteId ?? sourceUrl,
    integrationRawRecordId: input.integrationRawRecordId ?? null,
    externalSourceKey: quoteId ?? sourceUrl,
    idempotencyKey: input.idempotencyKey ?? quoteId ?? null,
    rawText: text ?? JSON.stringify(payload),
    title,
    description: text,
    customerName: compactText(payload.customer_name ?? payload.customerName ?? customer.name),
    customerEmail: normalizeEmail(payload.email ?? payload.customer_email ?? payload.customerEmail ?? customer.email),
    customerPhone: normalizePhone(payload.phone ?? payload.customer_phone ?? payload.customerPhone ?? customer.phone),
    locationText: compactText(payload.location ?? payload.location_text ?? payload.locationText),
    estimatedAmount: normalizeAmount(payload.total ?? payload.amount ?? payload.estimated_amount),
    currencyCode: normalizeCurrencyCode(payload.currency ?? payload.moneda),
    requestedDate: normalizeIsoDate(payload.date ?? payload.fecha ?? payload.requested_date),
    status: "needs_review" as const,
    priority: parseWorkIntakePriority(payload.priority),
    nextAction: compactText(payload.next_action ?? payload.nextAction) ?? "Revisar solicitud web",
    dueDate: normalizeIsoDate(payload.due_date ?? payload.dueDate),
    metadata: {
      source: "rontil_web",
      payload_version: compactText(payload.payload_version ?? payload.version) ?? "1",
      source_url: sourceUrl,
      lines: Array.isArray(payload.lines ?? payload.lineas) ? payload.lines ?? payload.lineas : undefined,
      metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : undefined,
    },
  };
}

export function validateRontilWebWorkIntakePayload(payload: unknown): {
  ok: true;
  payload: JsonRecord;
} | {
  ok: false;
  code: string;
  message: string;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "El payload debe ser un objeto JSON.",
    };
  }

  const record = payload as JsonRecord;
  const customer = record.customer && typeof record.customer === "object" && !Array.isArray(record.customer)
    ? record.customer as JsonRecord
    : {};
  const hasContent = Boolean(
    compactText(record.title)
      ?? compactText(record.text)
      ?? compactText(record.message)
      ?? compactText(record.description)
      ?? compactText(record.quote_id)
      ?? compactText(record.quoteId),
  );
  const hasCustomerSignal = Boolean(
    compactText(record.customer_name)
      ?? compactText(record.customerName)
      ?? compactText(customer.name)
      ?? normalizeEmail(record.email)
      ?? normalizeEmail(record.customer_email)
      ?? normalizeEmail(customer.email),
  );

  if (!hasContent) {
    return {
      ok: false,
      code: "missing_content",
      message: "El payload necesita titulo, texto, descripcion o quote_id.",
    };
  }

  if (!hasCustomerSignal) {
    return {
      ok: false,
      code: "missing_customer",
      message: "El payload necesita una senal minima de cliente.",
    };
  }

  return {
    ok: true,
    payload: record,
  };
}

export function buildEmailWorkIntakeInput(input: {
  organizationId: string;
  messageId: string;
  subject?: string | null;
  from?: string | null;
  to?: string[] | null;
  receivedAt?: string | null;
  bodyText?: string | null;
  attachments?: Array<{ filename?: string | null; contentType?: string | null }> | null;
  integrationRawRecordId?: string | null;
  interactionId?: string | null;
}) {
  const subject = compactText(input.subject) ?? "Email sin asunto";
  const from = compactText(input.from);

  return {
    organizationId: input.organizationId,
    sourceType: "email" as const,
    sourceRefId: compactText(input.messageId),
    integrationRawRecordId: input.integrationRawRecordId ?? null,
    interactionId: input.interactionId ?? null,
    externalSourceKey: compactText(input.messageId),
    idempotencyKey: compactText(input.messageId),
    rawText: compactText(input.bodyText),
    title: subject,
    description: compactText(input.bodyText),
    customerName: from,
    customerEmail: normalizeEmail(from),
    requestedDate: normalizeIsoDate(input.receivedAt),
    status: "needs_review" as const,
    priority: "normal" as const,
    nextAction: "Revisar email comercial",
    metadata: {
      channel: "email",
      from,
      to: input.to ?? [],
      attachment_count: input.attachments?.length ?? 0,
      attachments: input.attachments ?? [],
    },
  };
}

export function canManageWorkIntake(role: string | null | undefined) {
  return ["owner", "admin", "admin_processing", "accountant", "reviewer", "operator"].includes(role ?? "");
}
