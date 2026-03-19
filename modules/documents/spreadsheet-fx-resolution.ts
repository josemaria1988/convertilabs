import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveBcuFiscalFxRate } from "@/modules/accounting/bcu-fx-service";
import {
  buildMissingFxBlockingReason,
  MISSING_FX_RATE_ERROR_CODE,
} from "@/modules/accounting/fx-policy";
import { loadDocumentAccountingContext } from "@/modules/accounting/repository";
import { rederiveDocumentDraftArtifacts } from "@/modules/documents/review";

type MissingFxDocumentRow = {
  id: string;
  current_draft_id: string | null;
  document_date: string | null;
  document_currency_code: string | null;
  metadata: Record<string, unknown> | null;
};

type MissingFxDraftRow = {
  id: string;
  warnings_json: unknown;
};

export type MissingFxDocumentsSummary = {
  count: number;
  dates: string[];
};

export type ResolveMissingFxRatesResult = {
  requestedCount: number;
  resolvedCount: number;
  failedCount: number;
  pendingCount: number;
  resolvedDocumentIds: string[];
  failedDocumentIds: string[];
  failures: Array<{
    documentId: string;
    documentDate: string | null;
    reason: string;
  }>;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function hasMissingFxValidationError(metadata: Record<string, unknown> | null | undefined) {
  return asStringArray(metadata?.validation_errors).includes(MISSING_FX_RATE_ERROR_CODE);
}

function buildDetailedMissingFxReason(documentDate: string | null, detail?: string | null) {
  const base = buildMissingFxBlockingReason(documentDate);
  const extra = detail?.trim();
  return extra ? `${base} ${extra}` : base;
}

function mergeDocumentMetadataWithMissingFxState(input: {
  metadata: Record<string, unknown> | null | undefined;
  reviewRequired: boolean;
  isPostable: boolean;
  validationErrors: string[];
  blockingReason: string | null;
  fxRate: number | null;
  fxRateSource: "bcu" | "document_import" | null;
  fxRateDate: string | null;
}) {
  return {
    ...asRecord(input.metadata),
    review_required: input.reviewRequired,
    is_postable: input.isPostable,
    validation_errors: input.validationErrors,
    fx_blocking_reason: input.blockingReason,
    fx_status:
      input.validationErrors.includes(MISSING_FX_RATE_ERROR_CODE)
        ? "missing_rate"
        : input.fxRateSource === "bcu"
          ? "resolved_from_bcu"
          : input.fxRateSource === "document_import"
            ? "resolved_from_document"
            : "not_required",
    fx_rate_source: input.fxRateSource,
    fx_rate_value: input.fxRate,
    fx_rate_date: input.fxRateDate,
  } satisfies Record<string, unknown>;
}

function updateDraftWarnings(input: {
  warnings: unknown;
  blockingReason: string | null;
}) {
  const filtered = asStringArray(input.warnings)
    .filter((warning) => !warning.startsWith(`${MISSING_FX_RATE_ERROR_CODE}:`));

  if (input.blockingReason) {
    filtered.push(input.blockingReason);
  }

  return Array.from(new Set(filtered));
}

function mergeStructuredContext(input: {
  structuredContext: unknown;
  fxRate: number | null;
  fxRateSource: "bcu" | "document_import" | null;
  fxRateDate: string | null;
  blockingReason: string | null;
}) {
  return {
    ...asRecord(input.structuredContext),
    document_fx_rate: input.fxRate,
    document_fx_rate_source: input.fxRateSource,
    document_fx_rate_date: input.fxRateDate,
    document_fx_missing_error_code:
      input.blockingReason
        ? MISSING_FX_RATE_ERROR_CODE
        : null,
    document_fx_blocking_reason: input.blockingReason,
  } satisfies Record<string, unknown>;
}

async function loadMissingFxCandidateDocuments(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentIds?: string[];
}) {
  let query = input.supabase
    .from("documents")
    .select("id, current_draft_id, document_date, document_currency_code, metadata")
    .eq("organization_id", input.organizationId)
    .eq("document_currency_code", "USD")
    .not("current_draft_id", "is", null);

  if (input.documentIds && input.documentIds.length > 0) {
    query = query.in("id", input.documentIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (((data as MissingFxDocumentRow[] | null) ?? []))
    .filter((row) => hasMissingFxValidationError(row.metadata));
}

async function loadDraftWarningsMap(input: {
  supabase: SupabaseClient;
  draftIds: string[];
}) {
  if (input.draftIds.length === 0) {
    return new Map<string, MissingFxDraftRow>();
  }

  const { data, error } = await input.supabase
    .from("document_drafts")
    .select("id, warnings_json")
    .in("id", input.draftIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((((data as MissingFxDraftRow[] | null) ?? [])).map((row) => [row.id, row]));
}

export async function loadMissingFxDocumentsSummary(input: {
  organizationId: string;
  supabase?: SupabaseClient;
}) {
  const supabase = input.supabase ?? getSupabaseServiceRoleClient();
  const candidates = await loadMissingFxCandidateDocuments({
    supabase,
    organizationId: input.organizationId,
  });

  return {
    count: candidates.length,
    dates: Array.from(new Set(candidates.map((row) => row.document_date).filter((value): value is string => Boolean(value)))).sort(),
  } satisfies MissingFxDocumentsSummary;
}

export async function resolveMissingFxRates(input: {
  organizationId: string;
  actorId: string | null;
  documentIds?: string[];
  supabase?: SupabaseClient;
  fetchImpl?: typeof fetch;
}) {
  const supabase = input.supabase ?? getSupabaseServiceRoleClient();
  const candidates = await loadMissingFxCandidateDocuments({
    supabase,
    organizationId: input.organizationId,
    documentIds: input.documentIds,
  });
  const draftWarningsMap = await loadDraftWarningsMap({
    supabase,
    draftIds: candidates
      .map((candidate) => candidate.current_draft_id)
      .filter((value): value is string => Boolean(value)),
  });
  const groupedByDate = candidates.reduce((map, row) => {
    const key = row.document_date ?? "missing-date";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
    return map;
  }, new Map<string, MissingFxDocumentRow[]>());
  const failures: ResolveMissingFxRatesResult["failures"] = [];
  const resolvedDocumentIds: string[] = [];
  const failedDocumentIds: string[] = [];

  for (const [documentDate, group] of groupedByDate.entries()) {
    if (!documentDate || documentDate === "missing-date") {
      for (const document of group) {
        const reason = buildDetailedMissingFxReason(document.document_date, "Falta la fecha documental para consultar BCU.");
        await persistMissingFxFailure({
          supabase,
          document,
          draftWarningsMap,
          reason,
        });
        failedDocumentIds.push(document.id);
        failures.push({ documentId: document.id, documentDate: document.document_date, reason });
      }
      continue;
    }

    try {
      const resolved = await resolveBcuFiscalFxRate({
        currencyCode: "USD",
        documentDate,
        fetchImpl: input.fetchImpl,
      });

      for (const document of group) {
        await persistResolvedFxRate({
          supabase,
          organizationId: input.organizationId,
          actorId: input.actorId,
          document,
          draftWarningsMap,
          rate: resolved.rate,
          rateDate: resolved.dateUsed ?? document.document_date,
        });
        resolvedDocumentIds.push(document.id);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No se pudo consultar la API del BCU.";

      for (const document of group) {
        const reason = buildDetailedMissingFxReason(document.document_date, detail);
        await persistMissingFxFailure({
          supabase,
          document,
          draftWarningsMap,
          reason,
        });
        failedDocumentIds.push(document.id);
        failures.push({ documentId: document.id, documentDate: document.document_date, reason });
      }
    }
  }

  return {
    requestedCount: candidates.length,
    resolvedCount: resolvedDocumentIds.length,
    failedCount: failedDocumentIds.length,
    pendingCount: failedDocumentIds.length,
    resolvedDocumentIds,
    failedDocumentIds,
    failures,
  } satisfies ResolveMissingFxRatesResult;
}

async function persistResolvedFxRate(input: {
  supabase: SupabaseClient;
  organizationId: string;
  actorId: string | null;
  document: MissingFxDocumentRow;
  draftWarningsMap: Map<string, MissingFxDraftRow>;
  rate: number;
  rateDate: string | null;
}) {
  const currentDraftId = input.document.current_draft_id;

  if (!currentDraftId) {
    return;
  }

  const context = await loadDocumentAccountingContext(input.supabase, currentDraftId);
  const { error: contextError } = await input.supabase
    .from("document_accounting_contexts")
    .update({
      reason_codes: (context?.reason_codes ?? []).filter((code) => code !== "missing_fx_rate"),
      structured_context_json: mergeStructuredContext({
        structuredContext: context?.structured_context_json,
        fxRate: input.rate,
        fxRateSource: "bcu",
        fxRateDate: input.rateDate,
        blockingReason: null,
      }),
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("draft_id", currentDraftId);

  if (contextError) {
    throw new Error(contextError.message);
  }

  const { error: draftError } = await input.supabase
    .from("document_drafts")
    .update({
      warnings_json: updateDraftWarnings({
        warnings: input.draftWarningsMap.get(currentDraftId)?.warnings_json,
        blockingReason: null,
      }),
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentDraftId);

  if (draftError) {
    throw new Error(draftError.message);
  }

  const { error: documentError } = await input.supabase
    .from("documents")
    .update({
      metadata: mergeDocumentMetadataWithMissingFxState({
        metadata: input.document.metadata,
        reviewRequired: false,
        isPostable: true,
        validationErrors: asStringArray(input.document.metadata?.validation_errors)
          .filter((value) => value !== MISSING_FX_RATE_ERROR_CODE),
        blockingReason: null,
        fxRate: input.rate,
        fxRateSource: "bcu",
        fxRateDate: input.rateDate,
      }),
      fx_rate_document_value: input.rate,
      fx_rate_document_date: input.rateDate,
      fx_rate_source: "bcu",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.document.id);

  if (documentError) {
    throw new Error(documentError.message);
  }

  await rederiveDocumentDraftArtifacts({
    organizationId: input.organizationId,
    documentId: input.document.id,
    actorId: input.actorId,
    preserveDocumentStatus: true,
    runAssistant: false,
  });
}

async function persistMissingFxFailure(input: {
  supabase: SupabaseClient;
  document: MissingFxDocumentRow;
  draftWarningsMap: Map<string, MissingFxDraftRow>;
  reason: string;
}) {
  const currentDraftId = input.document.current_draft_id;

  if (!currentDraftId) {
    return;
  }

  const context = await loadDocumentAccountingContext(input.supabase, currentDraftId);
  const { error: contextError } = await input.supabase
    .from("document_accounting_contexts")
    .update({
      structured_context_json: mergeStructuredContext({
        structuredContext: context?.structured_context_json,
        fxRate: null,
        fxRateSource: null,
        fxRateDate: input.document.document_date,
        blockingReason: input.reason,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("draft_id", currentDraftId);

  if (contextError) {
    throw new Error(contextError.message);
  }

  const { error: draftError } = await input.supabase
    .from("document_drafts")
    .update({
      warnings_json: updateDraftWarnings({
        warnings: input.draftWarningsMap.get(currentDraftId)?.warnings_json,
        blockingReason: input.reason,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentDraftId);

  if (draftError) {
    throw new Error(draftError.message);
  }

  const { error: documentError } = await input.supabase
    .from("documents")
    .update({
      metadata: mergeDocumentMetadataWithMissingFxState({
        metadata: input.document.metadata,
        reviewRequired: true,
        isPostable: false,
        validationErrors: [MISSING_FX_RATE_ERROR_CODE],
        blockingReason: input.reason,
        fxRate: null,
        fxRateSource: null,
        fxRateDate: input.document.document_date,
      }),
      posting_status: "draft",
      fx_rate_document_value: null,
      fx_rate_document_date: input.document.document_date,
      fx_rate_source: "document_default",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.document.id);

  if (documentError) {
    throw new Error(documentError.message);
  }
}
