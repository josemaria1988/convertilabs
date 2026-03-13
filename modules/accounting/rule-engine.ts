import type {
  AccountingDraftStepSnapshot,
  DerivedDraftArtifacts,
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DraftStepCode,
} from "@/modules/accounting/types";

function joinBlockers(values: string[]) {
  return values.length > 0 ? values.join(" ") : null;
}

export function buildDraftStepSnapshots(input: {
  documentRole: "purchase" | "sale" | "other";
  documentType: string | null;
  operationCategory: string | null;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  derived: DerivedDraftArtifacts;
  savedAt?: string;
}) {
  const savedAt = input.savedAt ?? new Date().toISOString();
  const snapshots: AccountingDraftStepSnapshot[] = [
    {
      step_code: "identity",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        document_role: input.documentRole,
        document_type: input.documentType,
        invoice_identity: input.derived.invoiceIdentity,
        vendor_resolution: input.derived.vendorResolution,
      },
    },
    {
      step_code: "fields",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        facts: input.facts,
      },
    },
    {
      step_code: "amounts",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        amount_breakdown: input.amountBreakdown,
        line_items: input.lineItems,
        concept_resolution: input.derived.conceptResolution,
      },
    },
    {
      step_code: "operation_context",
      status: "draft_saved",
      last_saved_at: savedAt,
      stale_reason: null,
      snapshot_json: {
        operation_category_candidate: input.operationCategory,
      },
    },
    {
      step_code: "journal",
      status: input.derived.journalSuggestion.ready ? "draft_saved" : "blocked",
      last_saved_at: savedAt,
      stale_reason: joinBlockers(input.derived.journalSuggestion.blockingReasons),
      snapshot_json: input.derived.journalSuggestion,
    },
    {
      step_code: "tax",
      status: input.derived.taxTreatment.ready ? "draft_saved" : "blocked",
      last_saved_at: savedAt,
      stale_reason: joinBlockers(input.derived.taxTreatment.blockingReasons),
      snapshot_json: input.derived.taxTreatment,
    },
    {
      step_code: "confirmation",
      status: input.derived.validation.canConfirm ? "draft_saved" : "blocked",
      last_saved_at: savedAt,
      stale_reason: joinBlockers(input.derived.validation.blockers),
      snapshot_json: {
        can_confirm: input.derived.validation.canConfirm,
        blockers: input.derived.validation.blockers,
      },
    },
  ];

  return snapshots satisfies Array<{
    step_code: DraftStepCode;
    status: "draft_saved" | "blocked";
    last_saved_at: string;
    stale_reason: string | null;
    snapshot_json: unknown;
  }>;
}
