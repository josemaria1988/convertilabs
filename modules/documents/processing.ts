import "server-only";

import { createHash } from "crypto";
import { getInngestConfigStatus } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import {
  createBackgroundStructuredOpenAIResponse,
  deleteOpenAIFile,
  extractStructuredOutputFromOpenAIResponse,
  getOpenAIBackgroundResponseError,
  isOpenAIBackgroundResponsePending,
  retrieveOpenAIResponse,
  uploadOpenAIUserDataFile,
} from "@/lib/llm/openai-responses";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  assertDocumentIntakeOutput,
  documentIntakeJsonSchema,
  type DocumentIntakeOutput,
} from "@/modules/ai/document-intake-contract";
import {
  asNumber,
  asRecord,
  asString,
  buildPersistableConceptLines,
  buildDraftStepSnapshots,
  buildDraftFieldsPayload,
  buildInvoiceIdentityResult,
  deriveDocumentAccountingState,
  findDuplicateInvoiceIdentityDocumentId,
  loadDocumentInvoiceIdentity,
  upsertDocumentAccountingContext,
  upsertDocumentInvoiceIdentity,
  upsertDocumentLineItems,
} from "@/modules/accounting";
import { materializeOrganizationRuleSnapshot } from "@/modules/organizations/rule-snapshots";

type DocumentProcessingTrigger =
  | "upload"
  | "manual_retry"
  | "reprocess_after_profile_change";

type EnqueueDocumentProcessingInput = {
  documentId: string;
  requestedBy: string | null;
  triggeredBy: DocumentProcessingTrigger;
};

type EnqueueDocumentProcessingResult =
  | {
      ok: true;
      documentId: string;
      runId: string;
      status: "queued";
    }
  | {
      ok: false;
      documentId: string;
      runId: string | null;
      status: "error" | "skipped";
      message: string;
    };

type DocumentProcessingResult =
  | {
      ok: true;
      documentId: string;
      runId: string;
      draftId: string;
      status: "draft_ready" | "needs_review";
    }
  | {
      ok: false;
      documentId: string;
      runId: string | null;
      status: "skipped" | "error";
      message: string;
    };

type ProcessibleDocumentRow = {
  id: string;
  organization_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  current_draft_id: string | null;
  current_processing_run_id: string | null;
  last_rule_snapshot_id: string | null;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type ProcessingRunRow = {
  id: string;
  organization_id: string;
  document_id: string;
  run_number: number;
  status: string;
  provider_code: string;
  model_code: string | null;
  triggered_by: string;
  requested_by: string | null;
  organization_rule_snapshot_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  openai_file_id: string | null;
  provider_response_id: string | null;
  provider_status: string | null;
  transport_mode: string | null;
  store_remote: boolean | null;
  prompt_version: string | null;
  schema_version: string | null;
  attempt_count: number | null;
  last_polled_at: string | null;
  failure_stage: string | null;
  failure_message: string | null;
  metadata: Record<string, unknown> | null;
  provider_response_json: Record<string, unknown> | null;
  created_at: string;
};

// Inngest step.run serializes outputs, so we keep this adapter loose here.
type InngestStepLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(id: string, fn: () => unknown): Promise<any>;
  sleep(id: string, duration: string): Promise<void>;
};

type InngestLoggerLike = {
  info(message: string, data?: Record<string, unknown>): void;
  warn?(message: string, data?: Record<string, unknown>): void;
  error?(message: string, data?: Record<string, unknown>): void;
};

type ProcessDocumentRunFromInngestInput = {
  runId: string;
  step: InngestStepLike;
  logger?: InngestLoggerLike;
};

type DocumentProcessingStatusResult = {
  documentId: string;
  runId: string | null;
  documentStatus: string;
  runStatus: string | null;
  providerStatus: string | null;
  draftId: string | null;
  reviewUrl: string | null;
  failureMessage: string | null;
  updatedAt: string;
  isTerminal: boolean;
};

const OPENAI_DOCUMENT_PROMPT_VERSION = "2026-03-13";
const OPENAI_DOCUMENT_SCHEMA_VERSION = "2026-03-13";
const OPENAI_DOCUMENT_TRANSPORT_MODE = "file_id";
const OPENAI_DOCUMENT_STORE_REMOTE = true;
const OPENAI_POLL_INTERVAL = "10s";
const OPENAI_MAX_POLL_ATTEMPTS = 60;
const TERMINAL_DOCUMENT_STATUSES = new Set([
  "draft_ready",
  "needs_review",
  "approved",
  "rejected",
  "duplicate",
  "archived",
  "error",
]);
const TERMINAL_RUN_STATUSES = new Set(["completed", "error", "skipped"]);

function buildSystemPrompt(ruleSnapshot: {
  prompt_summary: string;
}) {
  return [
    "You are the Convertilabs document intake model for Uruguay.",
    "Extract structured facts from a single business document.",
    "Use only the organization profile and summarized rules provided below.",
    "Do not invent legal certainty or missing amounts.",
    "If a material fact is missing or ambiguous, include a warning.",
    "Never return prose outside the JSON schema.",
    "",
    "Relevant organization rule snapshot:",
    ruleSnapshot.prompt_summary,
  ].join("\n");
}

function buildUserPrompt(input: {
  originalFilename: string;
  mimeType: string | null;
}) {
  return [
    `Analyze the attached file: ${input.originalFilename}.`,
    `MIME type: ${input.mimeType ?? "unknown"}.`,
    "Classify it as purchase, sale, or other.",
    "Extract core fields, totals, tax hints, line items, and the closest V1 category candidate.",
    "If the document is not clear enough, lower confidence and add warnings.",
  ].join(" ");
}

function computeFileHash(bytes: ArrayBuffer) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function normalizeCurrencyAmount(value: number | null) {
  if (value === null) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

function mergeRecords(
  ...values: Array<Record<string, unknown> | null | undefined>
) {
  return values.reduce<Record<string, unknown>>((merged, value) => {
    if (value) {
      Object.assign(merged, value);
    }

    return merged;
  }, {});
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function collectValidationWarnings(
  output: DocumentIntakeOutput,
  duplicateDocumentIds: string[],
) {
  const warnings = [...output.warnings];
  const subtotal = output.facts.subtotal;
  const taxAmount = output.facts.tax_amount;
  const totalAmount = output.facts.total_amount;

  if (
    subtotal !== null
    && taxAmount !== null
    && totalAmount !== null
  ) {
    const expectedTotal = normalizeCurrencyAmount(subtotal + taxAmount);
    const roundedTotal = normalizeCurrencyAmount(totalAmount);

    if (
      expectedTotal !== null
      && roundedTotal !== null
      && Math.abs(expectedTotal - roundedTotal) > 0.02
    ) {
      warnings.push(
        `Subtotal + impuestos no coincide con el total (${expectedTotal} vs ${roundedTotal}).`,
      );
    }
  }

  if (duplicateDocumentIds.length > 0) {
    warnings.push(
      `Se detecto al menos un documento con el mismo hash en esta organizacion: ${duplicateDocumentIds.join(", ")}.`,
    );
  }

  if (output.line_items.length === 0 && output.amount_breakdown.length > 0) {
    warnings.push(
      "No se pudieron extraer line_items confiables. Se usa amount_breakdown como fallback temporal.",
    );
  }

  return warnings;
}

function getDeterministicRuleRefs(ruleSnapshot: {
  deterministic_rule_refs_json: unknown;
} | null) {
  if (!ruleSnapshot) {
    return [];
  }

  const refs = Array.isArray(ruleSnapshot.deterministic_rule_refs_json)
    ? ruleSnapshot.deterministic_rule_refs_json
    : [];

  return refs.slice(0, 5).map((entry) => {
    const record = asRecord(entry);

    return {
      id: asString(record.id),
      scope: asString(record.scope),
      priority: asNumber(record.priority),
      sourceReference: asString(record.source_reference),
    };
  });
}

function buildOrganizationFiscalProfile(profileVersion: {
  country_code: string;
  legal_entity_type: string;
  tax_regime_code: string;
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
  tax_id: string;
} | null) {
  if (!profileVersion) {
    return null;
  }

  return {
    countryCode: profileVersion.country_code,
    legalEntityType: profileVersion.legal_entity_type,
    taxRegimeCode: profileVersion.tax_regime_code,
    vatRegime: profileVersion.vat_regime,
    dgiGroup: profileVersion.dgi_group,
    cfeStatus: profileVersion.cfe_status,
    taxId: profileVersion.tax_id,
  };
}

function buildRuleSnapshotContext(ruleSnapshot: {
  id: string;
  version_number: number;
  effective_from: string;
  prompt_summary: string;
  deterministic_rule_refs_json: unknown;
} | null) {
  if (!ruleSnapshot) {
    return null;
  }

  return {
    id: ruleSnapshot.id,
    versionNumber: ruleSnapshot.version_number,
    effectiveFrom: ruleSnapshot.effective_from,
    promptSummary: ruleSnapshot.prompt_summary,
    deterministicRuleRefs: getDeterministicRuleRefs(ruleSnapshot),
  };
}

async function loadDocument(documentId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, organization_id, storage_bucket, storage_path, original_filename, mime_type, status, metadata, current_draft_id, current_processing_run_id, last_rule_snapshot_id, last_processed_at, created_at, updated_at",
    )
    .eq("id", documentId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Document not found.");
  }

  return data as ProcessibleDocumentRow;
}

async function loadProcessingRun(runId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("document_processing_runs")
    .select(
      "id, organization_id, document_id, run_number, status, provider_code, model_code, triggered_by, requested_by, organization_rule_snapshot_id, started_at, finished_at, latency_ms, input_tokens, output_tokens, total_tokens, openai_file_id, provider_response_id, provider_status, transport_mode, store_remote, prompt_version, schema_version, attempt_count, last_polled_at, failure_stage, failure_message, metadata, provider_response_json, created_at",
    )
    .eq("id", runId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Document processing run not found.");
  }

  return data as ProcessingRunRow;
}

async function loadRunRuleSnapshotContext(input: {
  organizationId: string;
  snapshotId: string | null;
  actorId: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();

  if (input.snapshotId) {
    const [{ data: snapshot }, { data: profileVersion }] = await Promise.all([
      supabase
        .from("organization_rule_snapshots")
        .select(
          "id, version_number, effective_from, prompt_summary, deterministic_rule_refs_json, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status",
        )
        .eq("id", input.snapshotId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("organization_profile_versions")
        .select(
          "id, version_number, effective_from, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, country_code, tax_id",
        )
        .eq("organization_id", input.organizationId)
        .eq("status", "active")
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (snapshot && profileVersion) {
      return {
        profileVersion: profileVersion as {
          country_code: string;
          legal_entity_type: string;
          tax_regime_code: string;
          vat_regime: string;
          dgi_group: string;
          cfe_status: string;
          tax_id: string;
        },
        ruleSnapshot: snapshot as {
          id: string;
          version_number: number;
          effective_from: string;
          prompt_summary: string;
          deterministic_rule_refs_json: unknown;
        },
      };
    }
  }

  const { profileVersion, ruleSnapshot } = await materializeOrganizationRuleSnapshot(
    supabase,
    input.organizationId,
    input.actorId,
  );

  return {
    profileVersion,
    ruleSnapshot,
  };
}

async function getNextDocumentRunNumber(
  documentId: string,
) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("document_processing_runs")
    .select("run_number")
    .eq("document_id", documentId)
    .order("run_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (typeof data?.run_number === "number" ? data.run_number : 0) + 1;
}

async function createProcessingRun(input: {
  document: ProcessibleDocumentRow;
  runNumber: number;
  requestedBy: string | null;
  triggeredBy: DocumentProcessingTrigger;
  ruleSnapshotId: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("document_processing_runs")
    .insert({
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      run_number: input.runNumber,
      status: "queued",
      provider_code: "openai",
      model_code: process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini",
      triggered_by: input.triggeredBy,
      requested_by: input.requestedBy,
      organization_rule_snapshot_id: input.ruleSnapshotId,
      transport_mode: OPENAI_DOCUMENT_TRANSPORT_MODE,
      store_remote: OPENAI_DOCUMENT_STORE_REMOTE,
      prompt_version: OPENAI_DOCUMENT_PROMPT_VERSION,
      schema_version: OPENAI_DOCUMENT_SCHEMA_VERSION,
      metadata: {
        source_document_status: input.document.status,
      },
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create the processing run.");
  }

  await supabase
    .from("documents")
    .update({
      status: "queued",
      current_processing_run_id: data.id,
      last_rule_snapshot_id: input.ruleSnapshotId,
      metadata: mergeRecords(input.document.metadata, {
        processing_requested_at: new Date().toISOString(),
      }),
    })
    .eq("id", input.document.id);

  return data.id as string;
}

async function markRunProcessing(input: {
  runId: string;
  documentId: string;
  startedAt: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const startedAt = input.startedAt ?? new Date().toISOString();

  await supabase
    .from("document_processing_runs")
    .update({
      status: "processing",
      started_at: startedAt,
      failure_stage: null,
      failure_message: null,
    })
    .eq("id", input.runId);

  await supabase
    .from("documents")
    .update({
      status: "extracting",
      current_processing_run_id: input.runId,
    })
    .eq("id", input.documentId);
}

async function updateRunAfterProviderSubmission(input: {
  runId: string;
  runMetadata: Record<string, unknown> | null;
  openAiFileId: string;
  providerResponseId: string;
  providerStatus: string | null;
  providerResponse: Record<string, unknown>;
  fileHash: string;
  duplicateDocumentIds: string[];
}) {
  const supabase = getSupabaseServiceRoleClient();

  await supabase
    .from("document_processing_runs")
    .update({
      openai_file_id: input.openAiFileId,
      provider_response_id: input.providerResponseId,
      provider_status: input.providerStatus,
      transport_mode: OPENAI_DOCUMENT_TRANSPORT_MODE,
      store_remote: OPENAI_DOCUMENT_STORE_REMOTE,
      prompt_version: OPENAI_DOCUMENT_PROMPT_VERSION,
      schema_version: OPENAI_DOCUMENT_SCHEMA_VERSION,
      attempt_count: 1,
      provider_response_json: input.providerResponse,
      metadata: mergeRecords(input.runMetadata, {
        file_hash: input.fileHash,
        duplicate_document_ids: input.duplicateDocumentIds,
        provider_submitted_at: new Date().toISOString(),
      }),
    })
    .eq("id", input.runId);
}

async function updateRunAfterProviderPoll(input: {
  runId: string;
  attemptCount: number;
  providerStatus: string | null;
  providerResponse: Record<string, unknown>;
  lastPolledAt: string;
}) {
  const supabase = getSupabaseServiceRoleClient();

  await supabase
    .from("document_processing_runs")
    .update({
      provider_status: input.providerStatus,
      provider_response_json: input.providerResponse,
      attempt_count: input.attemptCount,
      last_polled_at: input.lastPolledAt,
    })
    .eq("id", input.runId);
}

async function findDuplicateDocumentIds(
  organizationId: string,
  fileHash: string,
  currentDocumentId: string,
) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("file_hash", fileHash)
    .neq("id", currentDocumentId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ id: string }> | null) ?? []).map((row) => row.id);
}

async function markExtractionActive(documentId: string) {
  const supabase = getSupabaseServiceRoleClient();

  await supabase
    .from("document_extractions")
    .update({
      is_active: false,
    })
    .eq("document_id", documentId)
    .eq("is_active", true);
}

async function getNextDraftRevisionNumber(documentId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("document_drafts")
    .select("revision_number")
    .eq("document_id", documentId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (typeof data?.revision_number === "number" ? data.revision_number : 0) + 1;
}

async function persistDocumentArtifacts(input: {
  document: ProcessibleDocumentRow;
  runId: string;
  runNumber: number;
  runMetadata: Record<string, unknown> | null;
  ruleSnapshotId: string;
  profileVersion: {
    country_code: string;
    legal_entity_type: string;
    tax_regime_code: string;
    vat_regime: string;
    dgi_group: string;
    cfe_status: string;
    tax_id: string;
  };
  ruleSnapshot: {
    id: string;
    version_number: number;
    effective_from: string;
    prompt_summary: string;
    deterministic_rule_refs_json: unknown;
  };
  requestedBy: string | null;
  openAiFileId: string;
  providerResponseId: string | null;
  providerStatus: string | null;
  structuredOutput: DocumentIntakeOutput;
  providerResponse: Record<string, unknown>;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  lastPolledAt: string | null;
  attemptCount: number | null;
  fileHash: string;
  duplicateDocumentIds: string[];
}) {
  const supabase = getSupabaseServiceRoleClient();
  const warnings = collectValidationWarnings(
    input.structuredOutput,
    input.duplicateDocumentIds,
  );
  const existingInvoiceIdentity = await loadDocumentInvoiceIdentity(
    supabase,
    input.document.id,
  );
  const businessDuplicateDocumentId = await findDuplicateInvoiceIdentityDocumentId(
    supabase,
    input.document.organization_id,
    input.document.id,
    buildInvoiceIdentityResult({
      facts: input.structuredOutput.facts,
    }).invoiceIdentityKey,
  );
  const invoiceIdentity = buildInvoiceIdentityResult({
    facts: input.structuredOutput.facts,
    fileHashDuplicateDocumentIds: input.duplicateDocumentIds,
    businessDuplicateDocumentId,
    persistedDuplicateStatus: existingInvoiceIdentity?.duplicate_status ?? null,
    persistedDuplicateOfDocumentId: existingInvoiceIdentity?.duplicate_of_document_id ?? null,
    persistedDuplicateReason: existingInvoiceIdentity?.duplicate_reason ?? null,
  });

  await markExtractionActive(input.document.id);

  const { data: extraction, error: extractionError } = await supabase
    .from("document_extractions")
    .insert({
      document_id: input.document.id,
      version_no: input.runNumber,
      provider: `openai:${process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini"}`,
      raw_text: input.structuredOutput.extracted_text,
      extracted_json: input.structuredOutput,
      confidence: input.structuredOutput.confidence_score,
      is_active: true,
      created_by: input.requestedBy,
    })
    .select("id")
    .limit(1)
    .single();

  if (extractionError || !extraction?.id) {
    throw new Error(extractionError?.message ?? "Could not persist the extraction artifact.");
  }

  const factCandidates = Object.entries(input.structuredOutput.facts).map(
    ([fieldName, fieldValue]) => ({
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      processing_run_id: input.runId,
      field_name: fieldName,
      field_value_json: {
        value: fieldValue,
      },
      normalized_value_json: {
        value: fieldValue,
      },
      extraction_method: "openai_structured_response",
      confidence: input.structuredOutput.confidence_score,
    }),
  );

  if (factCandidates.length > 0) {
    const { error } = await supabase
      .from("document_field_candidates")
      .insert(factCandidates);

    if (error) {
      throw new Error(error.message);
    }
  }

  const classificationCandidates = [
    {
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      processing_run_id: input.runId,
      candidate_type: "document_role",
      candidate_role: input.structuredOutput.document_role_candidate,
      candidate_code: input.structuredOutput.document_role_candidate,
      explanation: input.structuredOutput.explanations.classification,
      confidence: input.structuredOutput.confidence_score,
      rank_order: 1,
    },
    {
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      processing_run_id: input.runId,
      candidate_type: "document_type",
      candidate_role: input.structuredOutput.document_role_candidate,
      candidate_code: input.structuredOutput.document_type_candidate,
      explanation: input.structuredOutput.explanations.classification,
      confidence: input.structuredOutput.confidence_score,
      rank_order: 1,
    },
  ];

  if (input.structuredOutput.operation_category_candidate) {
    classificationCandidates.push({
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      processing_run_id: input.runId,
      candidate_type: "operation_category",
      candidate_role: input.structuredOutput.document_role_candidate,
      candidate_code: input.structuredOutput.operation_category_candidate,
      explanation: input.structuredOutput.explanations.facts,
      confidence: input.structuredOutput.confidence_score,
      rank_order: 1,
    });
  }

  const { error: classificationError } = await supabase
    .from("document_classification_candidates")
    .insert(classificationCandidates);

  if (classificationError) {
    throw new Error(classificationError.message);
  }

  const draftRevisionNumber = await getNextDraftRevisionNumber(input.document.id);

  const { data: draft, error: draftError } = await supabase
    .from("document_drafts")
    .insert({
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      processing_run_id: input.runId,
      organization_rule_snapshot_id: input.ruleSnapshotId,
      revision_number: draftRevisionNumber,
      status: "open",
      document_role: input.structuredOutput.document_role_candidate,
      document_type: input.structuredOutput.document_type_candidate,
      operation_context_json: {
        operation_category_candidate: input.structuredOutput.operation_category_candidate,
      },
      fields_json: {
        ...buildDraftFieldsPayload({
          facts: input.structuredOutput.facts,
          amountBreakdown: input.structuredOutput.amount_breakdown,
          lineItems: input.structuredOutput.line_items,
        }),
        model_explanations: input.structuredOutput.explanations,
      },
      extracted_text: input.structuredOutput.extracted_text,
      warnings_json: warnings,
      journal_suggestion_json: {},
      tax_treatment_json: {},
      source_confidence: input.structuredOutput.confidence_score,
      created_by: input.requestedBy,
      updated_by: input.requestedBy,
    })
    .select("id")
    .limit(1)
    .single();

  if (draftError || !draft?.id) {
    throw new Error(draftError?.message ?? "Could not persist the draft.");
  }

  const accountingState = await deriveDocumentAccountingState({
    supabase,
    organizationId: input.document.organization_id,
    documentId: input.document.id,
    draftId: draft.id,
    actorId: input.requestedBy,
    documentRole: input.structuredOutput.document_role_candidate,
    documentType: input.structuredOutput.document_type_candidate,
    facts: input.structuredOutput.facts,
    amountBreakdown: input.structuredOutput.amount_breakdown,
    lineItems: input.structuredOutput.line_items,
    operationCategory: input.structuredOutput.operation_category_candidate,
    profile: buildOrganizationFiscalProfile(input.profileVersion),
    ruleSnapshot: buildRuleSnapshotContext(input.ruleSnapshot),
    invoiceIdentity,
    runAssistant: false,
  });
  const derived = accountingState.derived;

  await upsertDocumentInvoiceIdentity(supabase, {
    organization_id: input.document.organization_id,
    document_id: input.document.id,
    source_draft_id: draft.id,
    vendor_id: derived.vendorResolution.vendorId,
    issuer_tax_id_normalized: invoiceIdentity.issuerTaxIdNormalized,
    issuer_name_normalized: invoiceIdentity.issuerNameNormalized,
    document_number_normalized: invoiceIdentity.documentNumberNormalized,
    document_date: invoiceIdentity.documentDate,
    total_amount: invoiceIdentity.totalAmount,
    currency_code: invoiceIdentity.currencyCode,
    identity_strategy: invoiceIdentity.identityStrategy,
    invoice_identity_key: invoiceIdentity.invoiceIdentityKey,
    duplicate_status: invoiceIdentity.duplicateStatus,
    duplicate_of_document_id: invoiceIdentity.duplicateOfDocumentId,
    duplicate_reason: invoiceIdentity.duplicateReason,
    resolution_notes: existingInvoiceIdentity?.resolution_notes ?? null,
  });
  await upsertDocumentLineItems(supabase, {
    organizationId: input.document.organization_id,
    documentId: input.document.id,
    draftId: draft.id,
    lines: buildPersistableConceptLines({
      lineItems: input.structuredOutput.line_items,
      amountBreakdown: input.structuredOutput.amount_breakdown,
      conceptLines: derived.conceptResolution.lines,
    }),
  });
  await upsertDocumentAccountingContext(supabase, {
    organizationId: input.document.organization_id,
    documentId: input.document.id,
    draftId: draft.id,
    actorId: input.requestedBy,
    context: derived.accountingContext,
  });
  const { error: draftUpdateError } = await supabase
    .from("document_drafts")
    .update({
      status: derived.validation.canConfirm ? "ready_for_confirmation" : "open",
      journal_suggestion_json: derived.journalSuggestion,
      tax_treatment_json: derived.taxTreatment,
      updated_by: input.requestedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  if (draftUpdateError) {
    throw new Error(draftUpdateError.message);
  }
  const savedAt = new Date().toISOString();
  const stepRows = buildDraftStepSnapshots({
    documentRole: input.structuredOutput.document_role_candidate,
    documentType: input.structuredOutput.document_type_candidate,
    operationCategory: input.structuredOutput.operation_category_candidate,
    facts: input.structuredOutput.facts,
    amountBreakdown: input.structuredOutput.amount_breakdown,
    lineItems: input.structuredOutput.line_items,
    derived,
    savedAt,
  });

  const { error: stepError } = await supabase
    .from("document_draft_steps")
    .insert(
      stepRows.map((step) => ({
        draft_id: draft.id,
        step_code: step.step_code,
        status: step.status,
        last_saved_at: step.last_saved_at,
        stale_reason: step.stale_reason,
        snapshot_json: step.snapshot_json,
      })),
    );

  if (stepError) {
    throw new Error(stepError.message);
  }

  const { error: revisionError } = await supabase
    .from("document_revisions")
    .insert({
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      revision_number: draftRevisionNumber,
      working_draft_id: draft.id,
      status: "open",
      opened_by: input.requestedBy,
    });

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  const documentStatus =
    derived.validation.canConfirm && input.structuredOutput.confidence_score >= 0.6
      ? "draft_ready"
      : "needs_review";

  const { error: documentUpdateError } = await supabase
    .from("documents")
    .update({
      direction: input.structuredOutput.document_role_candidate,
      document_type: input.structuredOutput.document_type_candidate,
      status: documentStatus,
      current_draft_id: draft.id,
      current_processing_run_id: input.runId,
      last_rule_snapshot_id: input.ruleSnapshotId,
      last_processed_at: new Date().toISOString(),
      file_hash: input.fileHash,
      metadata: mergeRecords(input.document.metadata, {
        duplicate_document_ids: input.duplicateDocumentIds,
        duplicate_status: invoiceIdentity.duplicateStatus,
        duplicate_reason: invoiceIdentity.duplicateReason,
        processing_model: process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini",
        processing_provider: "openai",
        warning_count: warnings.length,
        line_item_count: input.structuredOutput.line_items.length,
        matched_concept_count: derived.conceptResolution.matchedConceptIds.length,
        accounting_context_required: derived.accountingContext.status !== "not_required",
      }),
    })
    .eq("id", input.document.id);

  if (documentUpdateError) {
    throw new Error(documentUpdateError.message);
  }

  const { error: runUpdateError } = await supabase
    .from("document_processing_runs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      total_tokens: input.totalTokens,
      openai_file_id: input.openAiFileId,
      provider_response_id: input.providerResponseId,
      provider_status: input.providerStatus,
      transport_mode: OPENAI_DOCUMENT_TRANSPORT_MODE,
      store_remote: OPENAI_DOCUMENT_STORE_REMOTE,
      prompt_version: OPENAI_DOCUMENT_PROMPT_VERSION,
      schema_version: OPENAI_DOCUMENT_SCHEMA_VERSION,
      attempt_count: input.attemptCount,
      last_polled_at: input.lastPolledAt,
      provider_response_json: input.providerResponse,
      metadata: mergeRecords(input.runMetadata, {
        extraction_id: extraction.id,
        draft_id: draft.id,
        accounting_context_required: derived.accountingContext.status !== "not_required",
        assistant_status: derived.assistantSuggestion.status,
        file_hash: input.fileHash,
        duplicate_document_ids: input.duplicateDocumentIds,
      }),
    })
    .eq("id", input.runId);

  if (runUpdateError) {
    throw new Error(runUpdateError.message);
  }

  return {
    draftId: draft.id as string,
    documentStatus: documentStatus as "draft_ready" | "needs_review",
  };
}

async function markRunFailed(input: {
  documentId: string;
  runId: string | null;
  message: string;
  failureStage: string;
  providerStatus?: string | null;
  providerResponse?: Record<string, unknown> | null;
  lastPolledAt?: string | null;
  documentMetadata?: Record<string, unknown> | null;
  runMetadata?: Record<string, unknown> | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const finishedAt = new Date().toISOString();
  let documentMetadata = input.documentMetadata ?? null;

  if (!documentMetadata) {
    try {
      const document = await loadDocument(input.documentId);
      documentMetadata = document.metadata;
    } catch {
      documentMetadata = null;
    }
  }

  if (input.runId) {
    await supabase
      .from("document_processing_runs")
      .update({
        status: "error",
        finished_at: finishedAt,
        failure_stage: input.failureStage,
        failure_message: input.message,
        provider_status: input.providerStatus ?? null,
        last_polled_at: input.lastPolledAt ?? null,
        provider_response_json: input.providerResponse ?? {},
        metadata: mergeRecords(input.runMetadata, {
          failed_at: finishedAt,
        }),
      })
      .eq("id", input.runId);
  }

  const documentUpdatePayload = {
    status: "error",
    last_processed_at: finishedAt,
    metadata: mergeRecords(documentMetadata, {
      processing_error: input.message,
      processing_error_stage: input.failureStage,
    }),
  } as Record<string, unknown>;

  if (input.runId) {
    documentUpdatePayload.current_processing_run_id = input.runId;
  }

  await supabase
    .from("documents")
    .update(documentUpdatePayload)
    .eq("id", input.documentId);
}

async function downloadDocumentBytes(document: ProcessibleDocumentRow) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(document.storage_bucket)
    .download(document.storage_path);

  if (downloadError || !fileBlob) {
    throw new Error(downloadError?.message ?? "Could not download the private file.");
  }

  return fileBlob.arrayBuffer();
}

async function cleanupOpenAIFileBestEffort(
  fileId: string | null,
  logger?: InngestLoggerLike,
) {
  if (!fileId) {
    return;
  }

  try {
    await deleteOpenAIFile(fileId);
  } catch (error) {
    logger?.warn?.("Failed to delete OpenAI file after document processing.", {
      fileId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

export async function enqueueDocumentProcessing(
  input: EnqueueDocumentProcessingInput,
): Promise<EnqueueDocumentProcessingResult> {
  let runId: string | null = null;
  let document!: ProcessibleDocumentRow;

  try {
    document = await loadDocument(input.documentId);

    if (!process.env.OPENAI_API_KEY) {
      const message = "OPENAI_API_KEY is not configured on the server.";

      await markRunFailed({
        documentId: input.documentId,
        runId: null,
        message,
        failureStage: "enqueue_validation",
        documentMetadata: document.metadata,
      });

      return {
        ok: false,
        documentId: input.documentId,
        runId: null,
        status: "error",
        message,
      };
    }

    if (!getInngestConfigStatus().configured) {
      const message = "Inngest is not configured for this environment.";

      await markRunFailed({
        documentId: input.documentId,
        runId: null,
        message,
        failureStage: "enqueue_validation",
        documentMetadata: document.metadata,
      });

      return {
        ok: false,
        documentId: input.documentId,
        runId: null,
        status: "error",
        message,
      };
    }

    const supabase = getSupabaseServiceRoleClient();
    const { ruleSnapshot } = await materializeOrganizationRuleSnapshot(
      supabase,
      document.organization_id,
      input.requestedBy,
    );
    const runNumber = await getNextDocumentRunNumber(document.id);

    runId = await createProcessingRun({
      document,
      runNumber,
      requestedBy: input.requestedBy,
      triggeredBy: input.triggeredBy,
      ruleSnapshotId: ruleSnapshot.id,
    });

    await inngest.send({
      name: "documents/process.requested",
      data: {
        documentId: document.id,
        organizationId: document.organization_id,
        runId,
        requestedBy: input.requestedBy,
        triggeredBy: input.triggeredBy,
      },
    });

    return {
      ok: true,
      documentId: document.id,
      runId,
      status: "queued",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown enqueue error.";

    await markRunFailed({
      documentId: input.documentId,
      runId,
      message,
      failureStage: runId ? "inngest_enqueue" : "enqueue_initialization",
      documentMetadata: document?.metadata ?? null,
    });

    return {
      ok: false,
      documentId: input.documentId,
      runId,
      status: "error",
      message,
    };
  }
}

export async function processDocumentRunFromInngest(
  input: ProcessDocumentRunFromInngestInput,
): Promise<DocumentProcessingResult> {
  let run!: ProcessingRunRow;
  let document!: ProcessibleDocumentRow;
  let openAiFileId: string | null = null;
  let providerStatus: string | null = null;
  let providerResponse: Record<string, unknown> | null = null;
  let lastPolledAt: string | null = null;

  try {
    run = await input.step.run("load-document-processing-run", async () => {
      return loadProcessingRun(input.runId);
    });
    document = await input.step.run("load-document-for-processing-run", async () => {
      return loadDocument(run!.document_id);
    });

    if (run!.status === "completed" && document!.current_draft_id) {
      return {
        ok: true,
        documentId: document.id,
        runId: run.id,
        draftId: document.current_draft_id,
        status:
          document.status === "draft_ready" || document.status === "needs_review"
            ? document.status
            : "needs_review",
      };
    }

    if (run!.status === "error" || run!.status === "skipped") {
      return {
        ok: false,
        documentId: run.document_id,
        runId: run.id,
        status: run.status === "skipped" ? "skipped" : "error",
        message: run.failure_message ?? "This processing run is already terminal.",
      };
    }

    const { profileVersion, ruleSnapshot } = await input.step.run(
      "load-rule-snapshot-context",
      async () => {
        return loadRunRuleSnapshotContext({
          organizationId: run.organization_id,
          snapshotId: run.organization_rule_snapshot_id,
          actorId: run.requested_by,
        });
      },
    );

    await input.step.run("mark-run-processing", async () => {
      await markRunProcessing({
        runId: run!.id,
        documentId: document!.id,
        startedAt: run!.started_at,
      });
    });

    let fileHash = asString(asRecord(run.metadata).file_hash) ?? null;
    let duplicateDocumentIds = toStringArray(asRecord(run.metadata).duplicate_document_ids);
    let providerResponseId = run.provider_response_id;
    openAiFileId = run.openai_file_id;
    providerStatus = run.provider_status;
    const existingProviderResponse = asRecord(run.provider_response_json);
    providerResponse = Object.keys(existingProviderResponse).length > 0
      ? existingProviderResponse
      : null;

    if (!providerResponseId) {
      const submission = await input.step.run(
        "submit-openai-background-response",
        async () => {
          const bytes = await downloadDocumentBytes(document!);
          const computedFileHash = computeFileHash(bytes);
          const duplicates = await findDuplicateDocumentIds(
            document!.organization_id,
            computedFileHash,
            document!.id,
          );
          const uploadedFile = await uploadOpenAIUserDataFile({
            filename: document!.original_filename,
            mimeType: document!.mime_type ?? "application/octet-stream",
            bytes,
          });
          const fileKind = document!.mime_type === "application/pdf" ? "pdf" : "image";
          const backgroundResponse = await createBackgroundStructuredOpenAIResponse({
            schemaName: "convertilabs_document_intake",
            schema: documentIntakeJsonSchema,
            systemPrompt: buildSystemPrompt(ruleSnapshot),
            userPrompt: buildUserPrompt({
              originalFilename: document!.original_filename,
              mimeType: document!.mime_type,
            }),
            fileInput:
              fileKind === "pdf"
                ? {
                    kind: "pdf",
                    fileId: uploadedFile.fileId,
                    filename: document!.original_filename,
                  }
                : {
                    kind: "image",
                    fileId: uploadedFile.fileId,
                    detail: "high",
                  },
          });

          await updateRunAfterProviderSubmission({
            runId: run!.id,
            runMetadata: run!.metadata,
            openAiFileId: uploadedFile.fileId,
            providerResponseId: backgroundResponse.responseId,
            providerStatus: backgroundResponse.status,
            providerResponse: backgroundResponse.rawResponse,
            fileHash: computedFileHash,
            duplicateDocumentIds: duplicates,
          });

          return {
            fileHash: computedFileHash,
            duplicateDocumentIds: duplicates,
            openAiFileId: uploadedFile.fileId,
            providerResponseId: backgroundResponse.responseId,
            providerStatus: backgroundResponse.status,
            providerResponse: backgroundResponse.rawResponse,
          };
        },
      );

      fileHash = submission.fileHash;
      duplicateDocumentIds = submission.duplicateDocumentIds;
      openAiFileId = submission.openAiFileId;
      providerResponseId = submission.providerResponseId;
      providerStatus = submission.providerStatus;
      providerResponse = submission.providerResponse;
      run = {
        ...run,
        openai_file_id: submission.openAiFileId,
        provider_response_id: submission.providerResponseId,
        provider_status: submission.providerStatus,
        attempt_count: 1,
        metadata: mergeRecords(run.metadata, {
          file_hash: submission.fileHash,
          duplicate_document_ids: submission.duplicateDocumentIds,
        }),
      };
    }

    if (!fileHash) {
      const rebuiltFileFacts = await input.step.run("rebuild-file-hash-metadata", async () => {
        const bytes = await downloadDocumentBytes(document!);
        const computedFileHash = computeFileHash(bytes);
        const duplicates = await findDuplicateDocumentIds(
          document!.organization_id,
          computedFileHash,
          document!.id,
        );

        return {
          fileHash: computedFileHash,
          duplicateDocumentIds: duplicates,
        };
      });

      fileHash = rebuiltFileFacts.fileHash;
      if (duplicateDocumentIds.length === 0) {
        duplicateDocumentIds = rebuiltFileFacts.duplicateDocumentIds;
      }
    }

    let attemptCount = Math.max(run.attempt_count ?? 0, providerResponseId ? 1 : 0);

    for (let pollIndex = 0; pollIndex < OPENAI_MAX_POLL_ATTEMPTS; pollIndex += 1) {
      if (providerStatus && !isOpenAIBackgroundResponsePending(providerStatus)) {
        break;
      }

      await input.step.sleep(`wait-for-openai-response-${pollIndex + 1}`, OPENAI_POLL_INTERVAL);

      const pollResult = await input.step.run(
        `poll-openai-response-${pollIndex + 1}`,
        async () => {
          const retrieved = await retrieveOpenAIResponse(providerResponseId!);
          const polledAt = new Date().toISOString();
          const nextAttemptCount = attemptCount + 1;

          await updateRunAfterProviderPoll({
            runId: run!.id,
            attemptCount: nextAttemptCount,
            providerStatus: retrieved.status,
            providerResponse: retrieved.rawResponse,
            lastPolledAt: polledAt,
          });

          return {
            ...retrieved,
            lastPolledAt: polledAt,
            attemptCount: nextAttemptCount,
          };
        },
      );

      attemptCount = pollResult.attemptCount;
      providerStatus = pollResult.status;
      providerResponse = pollResult.rawResponse;
      lastPolledAt = pollResult.lastPolledAt;
    }

    if (!providerResponse && providerResponseId) {
      const finalPayload = await input.step.run("load-final-openai-response", async () => {
        const retrieved = await retrieveOpenAIResponse(providerResponseId!);
        const polledAt = new Date().toISOString();
        const nextAttemptCount = attemptCount + 1;

        await updateRunAfterProviderPoll({
          runId: run!.id,
          attemptCount: nextAttemptCount,
          providerStatus: retrieved.status,
          providerResponse: retrieved.rawResponse,
          lastPolledAt: polledAt,
        });

        return {
          ...retrieved,
          lastPolledAt: polledAt,
          attemptCount: nextAttemptCount,
        };
      });

      attemptCount = finalPayload.attemptCount;
      providerStatus = finalPayload.status;
      providerResponse = finalPayload.rawResponse;
      lastPolledAt = finalPayload.lastPolledAt;
    }

    if (!providerStatus || isOpenAIBackgroundResponsePending(providerStatus)) {
      throw new Error("OpenAI background processing timed out before reaching a terminal state.");
    }

    if (providerStatus !== "completed" || !providerResponse) {
      const message = providerResponse
        ? getOpenAIBackgroundResponseError(providerResponse)
        : "OpenAI background response did not produce a terminal payload.";

      await input.step.run("mark-run-failed-after-openai", async () => {
        await markRunFailed({
          documentId: document!.id,
          runId: run!.id,
          message,
          failureStage: "openai_background_response",
          providerStatus,
          providerResponse: providerResponse!,
          lastPolledAt,
          documentMetadata: document!.metadata,
          runMetadata: run!.metadata,
        });
      });
      await input.step.run("cleanup-openai-file-after-error", async () => {
        await cleanupOpenAIFileBestEffort(openAiFileId, input.logger);
      });

      return {
        ok: false,
        documentId: document.id,
        runId: run.id,
        status: "error",
        message,
      };
    }

    const structuredResponse = extractStructuredOutputFromOpenAIResponse<DocumentIntakeOutput>(
      providerResponse,
    );

    assertDocumentIntakeOutput(structuredResponse.output);

    const startedAt = run.started_at ?? run.created_at;
    const latencyMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
    const persisted = await input.step.run("persist-document-artifacts", async () => {
      return persistDocumentArtifacts({
        document: document!,
        runId: run!.id,
        runNumber: run!.run_number,
        runMetadata: run!.metadata,
        ruleSnapshotId: run!.organization_rule_snapshot_id ?? ruleSnapshot.id,
        profileVersion,
        ruleSnapshot,
        requestedBy: run!.requested_by,
        openAiFileId: openAiFileId!,
        providerResponseId,
        providerStatus,
        structuredOutput: structuredResponse.output,
        providerResponse: providerResponse!,
        inputTokens: structuredResponse.usage.inputTokens,
        outputTokens: structuredResponse.usage.outputTokens,
        totalTokens: structuredResponse.usage.totalTokens,
        latencyMs,
        lastPolledAt,
        attemptCount,
        fileHash: fileHash!,
        duplicateDocumentIds,
      });
    });

    await input.step.run("cleanup-openai-file-after-success", async () => {
      await cleanupOpenAIFileBestEffort(openAiFileId, input.logger);
    });

    return {
      ok: true,
      documentId: document.id,
      runId: run.id,
      draftId: persisted.draftId,
      status: persisted.documentStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error.";

    if (document) {
      await input.step.run("mark-run-failed-after-exception", async () => {
        await markRunFailed({
          documentId: document!.id,
          runId: run?.id ?? null,
          message,
          failureStage: "document_processing",
          providerStatus,
          providerResponse: providerResponse!,
          lastPolledAt,
          documentMetadata: document!.metadata,
          runMetadata: run?.metadata ?? null,
        });
      });
      await input.step.run("cleanup-openai-file-after-exception", async () => {
        await cleanupOpenAIFileBestEffort(openAiFileId, input.logger);
      });
    }

    return {
      ok: false,
      documentId: document?.id ?? run?.document_id ?? input.runId,
      runId: run?.id ?? null,
      status: "error",
      message,
    };
  }
}

export async function loadDocumentProcessingStatus(input: {
  documentId: string;
  organizationSlug?: string | null;
}): Promise<DocumentProcessingStatusResult | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data: documentData, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, organization_id, status, metadata, current_draft_id, current_processing_run_id, last_processed_at, created_at, updated_at",
    )
    .eq("id", input.documentId)
    .limit(1)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (!documentData) {
    return null;
  }

  let organizationSlug = input.organizationSlug ?? null;

  if (!organizationSlug) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("slug")
      .eq("id", documentData.organization_id)
      .limit(1)
      .maybeSingle();

    if (organizationError) {
      throw new Error(organizationError.message);
    }

    organizationSlug = organization?.slug ?? null;
  }

  let runData: {
    id: string;
    status: string;
    provider_status: string | null;
    failure_message: string | null;
    finished_at: string | null;
    last_polled_at: string | null;
    created_at: string;
  } | null = null;

  if (documentData.current_processing_run_id) {
    const { data, error } = await supabase
      .from("document_processing_runs")
      .select(
        "id, status, provider_status, failure_message, finished_at, last_polled_at, created_at",
      )
      .eq("id", documentData.current_processing_run_id)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    runData = data;
  }

  const documentMetadata = asRecord(documentData.metadata);
  const failureMessage = runData?.failure_message ?? asString(documentMetadata.processing_error);
  const updatedAt =
    runData?.finished_at
    ?? runData?.last_polled_at
    ?? documentData.last_processed_at
    ?? documentData.updated_at
    ?? documentData.created_at;

  return {
    documentId: documentData.id,
    runId: documentData.current_processing_run_id,
    documentStatus: documentData.status,
    runStatus: runData?.status ?? null,
    providerStatus: runData?.provider_status ?? null,
    draftId: documentData.current_draft_id,
    reviewUrl:
      documentData.current_draft_id && organizationSlug
        ? `/app/o/${organizationSlug}/documents/${documentData.id}`
        : null,
    failureMessage,
    updatedAt,
    isTerminal:
      TERMINAL_DOCUMENT_STATUSES.has(documentData.status)
      || (runData?.status ? TERMINAL_RUN_STATUSES.has(runData.status) : false),
  };
}




