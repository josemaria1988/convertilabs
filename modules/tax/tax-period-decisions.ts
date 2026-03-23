import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";

export type TaxPeriodDocumentSelectionStatus =
  | "confirmed_for_period"
  | "excluded_from_period";

type TaxPeriodRow = {
  id: string;
  period_year: number;
  period_month: number | null;
  start_date: string;
  end_date: string;
  status: string;
};

type TaxPeriodDocumentSelectionRow = {
  document_id: string;
  selection_status: TaxPeriodDocumentSelectionStatus;
  note: string | null;
  decided_by: string | null;
  decided_at: string;
  metadata_json: Record<string, unknown> | null;
};

export type TaxPeriodDocumentSelection = {
  documentId: string;
  selectionStatus: TaxPeriodDocumentSelectionStatus;
  note: string | null;
  decidedBy: string | null;
  decidedAt: string;
  metadata: Record<string, unknown>;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parsePeriod(period: string) {
  const [yearText, monthText] = period.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Periodo IVA invalido.");
  }

  return { year, month };
}

async function recordTaxPeriodSelectionAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    periodId: string;
    action: string;
    metadata: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "tax_period",
      entity_id: input.periodId,
      action: input.action,
      metadata: input.metadata,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureVatPeriodRecord(
  supabase: SupabaseClient,
  organizationId: string,
  period: string,
) {
  const { year, month } = parsePeriod(period);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tax_periods")
    .upsert(
      {
        organization_id: organizationId,
        tax_type: "VAT",
        period_year: year,
        period_month: month,
        start_date: startDate,
        end_date: endDate,
        status: "open",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,tax_type,period_year,period_month",
      },
    )
    .select("id, period_year, period_month, start_date, end_date, status")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo asegurar el periodo IVA.");
  }

  return data as TaxPeriodRow;
}

export async function loadTaxPeriodDocumentSelections(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: string;
  },
) {
  const period = await ensureVatPeriodRecord(supabase, input.organizationId, input.period);
  const { data, error } = await supabase
    .from("tax_period_document_selections")
    .select("document_id, selection_status, note, decided_by, decided_at, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("period_id", period.id)
    .order("decided_at", { ascending: false });

  if (error) {
    if (isMissingSupabaseRelationError(error, "tax_period_document_selections")) {
      return {
        periodId: period.id,
        selections: [],
      };
    }

    throw new Error(error.message);
  }

  return {
    periodId: period.id,
    selections: (((data as TaxPeriodDocumentSelectionRow[] | null) ?? [])).map((row) => ({
      documentId: row.document_id,
      selectionStatus: row.selection_status,
      note: row.note,
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
      metadata: asRecord(row.metadata_json),
    })),
  };
}

export async function saveTaxPeriodDocumentSelection(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    period: string;
    documentIds: string[];
    selectionStatus: TaxPeriodDocumentSelectionStatus;
    actorId: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const uniqueDocumentIds = Array.from(
    new Set(input.documentIds.filter((documentId) => typeof documentId === "string" && documentId.trim().length > 0)),
  );

  if (uniqueDocumentIds.length === 0) {
    return {
      ok: false,
      count: 0,
      message: "Selecciona al menos un documento del periodo.",
    };
  }

  const period = await ensureVatPeriodRecord(supabase, input.organizationId, input.period);
  const decidedAt = new Date().toISOString();
  const note = typeof input.note === "string" && input.note.trim().length > 0 ? input.note.trim() : null;
  const metadata = input.metadata ?? {};
  const { error } = await supabase
    .from("tax_period_document_selections")
    .upsert(
      uniqueDocumentIds.map((documentId) => ({
        organization_id: input.organizationId,
        period_id: period.id,
        document_id: documentId,
        selection_status: input.selectionStatus,
        note,
        metadata_json: metadata,
        decided_by: input.actorId,
        decided_at: decidedAt,
        updated_at: decidedAt,
      })),
      {
        onConflict: "organization_id,period_id,document_id",
      },
    );

  if (error) {
    throw new Error(error.message);
  }

  await recordTaxPeriodSelectionAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    periodId: period.id,
    action: "tax_period_document_selection_saved",
    metadata: {
      selection_status: input.selectionStatus,
      document_ids: uniqueDocumentIds,
      note,
      ...metadata,
    },
  });

  return {
    ok: true,
    count: uniqueDocumentIds.length,
    message:
      input.selectionStatus === "confirmed_for_period"
        ? `${uniqueDocumentIds.length} documento(s) confirmados para la liquidacion del periodo.`
        : `${uniqueDocumentIds.length} documento(s) excluidos de la liquidacion del periodo.`,
  };
}
