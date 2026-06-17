import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { buildTaskPayload } from "@/modules/operations";
import type { CloseCheckResult, CloseCheckRunSummary } from "@/modules/close/service";

type CloseTaskPayload = ReturnType<typeof buildTaskPayload>;

const actionableResultCodes: Record<string, {
  title: string;
  priority: CloseTaskPayload["priority"];
}> = {
  documents_ready_for_close: {
    title: "Resolver documentos pendientes de cierre",
    priority: "urgent",
  },
  documents_posted_provisional: {
    title: "Confirmar postings provisionales",
    priority: "high",
  },
  journal_entries_finalized: {
    title: "Finalizar asientos del periodo",
    priority: "urgent",
  },
  trial_balance_balanced: {
    title: "Corregir desbalance contable del periodo",
    priority: "urgent",
  },
  vat_run_closed: {
    title: "Revisar IVA antes de cierre",
    priority: "urgent",
  },
  dgi_reconciliation_closed: {
    title: "Cerrar comparacion DGI del periodo",
    priority: "high",
  },
  late_documents_review: {
    title: "Revisar documentos cargados fuera de ventana",
    priority: "high",
  },
  open_items_supported: {
    title: "Confirmar open items del corte",
    priority: "high",
  },
};

function actionableResults(results: CloseCheckResult[]) {
  return results.filter((result) =>
    result.status !== "pass" && Object.hasOwn(actionableResultCodes, result.code));
}

export function buildCloseCheckTaskPayloads(input: {
  organizationId: string;
  actorId?: string | null;
  fiscalPeriodId: string;
  periodCode: string;
  closeCheckRun: Pick<CloseCheckRunSummary, "id" | "results">;
}) {
  return actionableResults(input.closeCheckRun.results).map((result) => {
    const config = actionableResultCodes[result.code];

    return buildTaskPayload({
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      title: `${config.title} (${input.periodCode})`,
      description: result.message,
      status: "blocked",
      priority: result.status === "blocker" ? config.priority : "high",
      blockedReason: result.message,
      metadata: {
        source: "close_validator",
        fiscal_period_id: input.fiscalPeriodId,
        period_code: input.periodCode,
        close_check_run_id: input.closeCheckRun.id,
        close_check_code: result.code,
        close_check_family: result.family,
        close_check_status: result.status,
        metric_value: result.metricValue,
      },
    });
  });
}

export async function createCloseCheckTasks(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId?: string | null;
    fiscalPeriodId: string;
    periodCode: string;
    closeCheckRun: Pick<CloseCheckRunSummary, "id" | "results">;
  },
) {
  const payloads = buildCloseCheckTaskPayloads(input);

  if (payloads.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("tasks")
    .insert(payloads);

  if (error && isMissingSupabaseRelationError(error, "tasks")) {
    return 0;
  }

  if (error) {
    throw new Error(error.message);
  }

  return payloads.length;
}
