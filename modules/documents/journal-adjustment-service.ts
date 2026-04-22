import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { evaluateDocumentBackedJournalAdjustment } from "@/modules/accounting/journal-adjustments";
import { loadJournalEntryDetail } from "@/modules/accounting/read-model-repository";
import { reopenDocumentForRemap } from "@/modules/documents/reopen-remap-service";

export async function prepareDocumentBackedJournalAdjustment(input: {
  organizationId: string;
  journalEntryId: string;
  actorId: string | null;
  reason: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const detail = await loadJournalEntryDetail(supabase, {
    organizationId: input.organizationId,
    journalEntryId: input.journalEntryId,
  });

  if (!detail) {
    return {
      ok: false,
      message: "No pudimos cargar el asiento a ajustar.",
      documentId: null,
      blockers: [{
        code: "missing_document" as const,
        message: "No pudimos cargar el asiento a ajustar.",
      }],
    };
  }

  const guard = evaluateDocumentBackedJournalAdjustment({
    detail,
    reason: input.reason,
  });

  if (!guard.ok || !detail.entry.sourceDocumentId) {
    return {
      ok: false,
      message: guard.blockers.map((blocker) => blocker.message).join(" "),
      documentId: detail.entry.sourceDocumentId,
      blockers: guard.blockers,
    };
  }

  const reopenResult = await reopenDocumentForRemap({
    organizationId: input.organizationId,
    documentId: detail.entry.sourceDocumentId,
    actorId: input.actorId,
  });

  return {
    ok: reopenResult.ok,
    message: reopenResult.message,
    documentId: detail.entry.sourceDocumentId,
    blockers: reopenResult.ok
      ? []
      : [{
          code: "missing_document" as const,
          message: reopenResult.message,
        }],
  };
}
