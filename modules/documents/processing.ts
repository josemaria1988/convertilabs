import "server-only";

import { createHash } from "crypto";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createStructuredOpenAIResponse,
  uploadOpenAIUserDataFile,
} from "@/lib/llm/openai-responses";
import {
  assertDocumentIntakeOutput,
  documentIntakeJsonSchema,
  type DocumentIntakeOutput,
} from "@/modules/ai/document-intake-contract";
import { materializeOrganizationRuleSnapshot } from "@/modules/organizations/rule-snapshots";

type ProcessUploadedDocumentInput = {
  documentId: string;
  requestedBy: string | null;
  triggeredBy:
    | "upload"
    | "manual_retry"
    | "reprocess_after_profile_change";
};

type ProcessUploadedDocumentResult =
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
};

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
    "Extract core fields, totals, tax hints, and the closest V1 category candidate.",
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

  return warnings;
}

async function loadDocument(documentId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, organization_id, storage_bucket, storage_path, original_filename, mime_type, status, metadata",
    )
    .eq("id", documentId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Document not found.");
  }

  return data as ProcessibleDocumentRow;
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
  triggeredBy: ProcessUploadedDocumentInput["triggeredBy"];
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
      metadata: {
        ...(input.document.metadata ?? {}),
        processing_requested_at: new Date().toISOString(),
      },
    })
    .eq("id", input.document.id);

  return data.id as string;
}

async function markRunProcessing(runId: string, documentId: string) {
  const supabase = getSupabaseServiceRoleClient();

  await supabase
    .from("document_processing_runs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", runId);

  await supabase
    .from("documents")
    .update({
      status: "extracting",
    })
    .eq("id", documentId);
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
  ruleSnapshotId: string;
  requestedBy: string | null;
  openAiFileId: string;
  structuredOutput: DocumentIntakeOutput;
  providerResponse: Record<string, unknown>;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  fileHash: string;
  duplicateDocumentIds: string[];
}) {
  const supabase = getSupabaseServiceRoleClient();
  const warnings = collectValidationWarnings(
    input.structuredOutput,
    input.duplicateDocumentIds,
  );

  await markExtractionActive(input.document.id);

  const { data: extraction, error: extractionError } = await supabase
    .from("document_extractions")
    .insert({
      document_id: input.document.id,
      version_no: input.runNumber,
      provider: "openai:gpt-4o-mini",
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
  const draftStatus =
    input.structuredOutput.confidence_score >= 0.85
      ? "ready_for_confirmation"
      : "open";

  const { data: draft, error: draftError } = await supabase
    .from("document_drafts")
    .insert({
      organization_id: input.document.organization_id,
      document_id: input.document.id,
      processing_run_id: input.runId,
      organization_rule_snapshot_id: input.ruleSnapshotId,
      revision_number: draftRevisionNumber,
      status: draftStatus,
      document_role: input.structuredOutput.document_role_candidate,
      document_type: input.structuredOutput.document_type_candidate,
      operation_context_json: {
        operation_category_candidate: input.structuredOutput.operation_category_candidate,
      },
      fields_json: {
        facts: input.structuredOutput.facts,
        amount_breakdown: input.structuredOutput.amount_breakdown,
      },
      extracted_text: input.structuredOutput.extracted_text,
      warnings_json: warnings,
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

  const stepRows = [
    { step_code: "identity", status: "draft_saved" },
    { step_code: "fields", status: "draft_saved" },
    { step_code: "amounts", status: "draft_saved" },
    { step_code: "operation_context", status: "draft_saved" },
    {
      step_code: "journal",
      status: "blocked",
      stale_reason: "pending_deterministic_accounting_engine",
    },
    {
      step_code: "tax",
      status: "blocked",
      stale_reason: "pending_deterministic_vat_engine",
    },
    {
      step_code: "confirmation",
      status: draftStatus === "ready_for_confirmation" ? "draft_saved" : "blocked",
      stale_reason:
        draftStatus === "ready_for_confirmation"
          ? null
          : "complete_tax_and_accounting_review_first",
    },
  ];

  const { error: stepError } = await supabase
    .from("document_draft_steps")
    .insert(
      stepRows.map((step) => ({
        draft_id: draft.id,
        step_code: step.step_code,
        status: step.status,
        last_saved_at: new Date().toISOString(),
        stale_reason: step.stale_reason,
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
    input.structuredOutput.confidence_score >= 0.6
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
      metadata: {
        ...(input.document.metadata ?? {}),
        duplicate_document_ids: input.duplicateDocumentIds,
        processing_model: process.env.OPENAI_DOCUMENT_MODEL ?? "gpt-4o-mini",
        processing_provider: "openai",
        warning_count: warnings.length,
      },
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
      provider_response_json: input.providerResponse,
      metadata: {
        extraction_id: extraction.id,
        draft_id: draft.id,
      },
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
}) {
  const supabase = getSupabaseServiceRoleClient();

  if (input.runId) {
    await supabase
      .from("document_processing_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        failure_stage: input.failureStage,
        failure_message: input.message,
      })
      .eq("id", input.runId);
  }

  await supabase
    .from("documents")
    .update({
      status: "error",
      last_processed_at: new Date().toISOString(),
      metadata: {
        processing_error: input.message,
        processing_error_stage: input.failureStage,
      },
    })
    .eq("id", input.documentId);
}

export async function processUploadedDocument(
  input: ProcessUploadedDocumentInput,
): Promise<ProcessUploadedDocumentResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      documentId: input.documentId,
      runId: null,
      status: "skipped",
      message: "OPENAI_API_KEY is not configured on the server.",
    };
  }

  let runId: string | null = null;

  try {
    const document = await loadDocument(input.documentId);
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

    await markRunProcessing(runId, document.id);

    const downloadStart = Date.now();
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(document.storage_bucket)
      .download(document.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "Could not download the private file.");
    }

    const bytes = await fileBlob.arrayBuffer();
    const fileHash = computeFileHash(bytes);
    const duplicateDocumentIds = await findDuplicateDocumentIds(
      document.organization_id,
      fileHash,
      document.id,
    );
    const uploadedFile = await uploadOpenAIUserDataFile({
      filename: document.original_filename,
      mimeType: document.mime_type ?? "application/octet-stream",
      bytes,
    });
    const fileKind = document.mime_type === "application/pdf" ? "pdf" : "image";
    const structuredResponse = await createStructuredOpenAIResponse<DocumentIntakeOutput>({
      schemaName: "convertilabs_document_intake",
      schema: documentIntakeJsonSchema,
      systemPrompt: buildSystemPrompt(ruleSnapshot),
      userPrompt: buildUserPrompt({
        originalFilename: document.original_filename,
        mimeType: document.mime_type,
      }),
      fileInput:
        fileKind === "pdf"
          ? {
              kind: "pdf",
              fileId: uploadedFile.fileId,
              filename: document.original_filename,
            }
          : {
              kind: "image",
              fileId: uploadedFile.fileId,
              detail: "high",
            },
    });

    assertDocumentIntakeOutput(structuredResponse.output);

    const latencyMs = Date.now() - downloadStart;
    const persisted = await persistDocumentArtifacts({
      document,
      runId,
      runNumber,
      ruleSnapshotId: ruleSnapshot.id,
      requestedBy: input.requestedBy,
      openAiFileId: uploadedFile.fileId,
      structuredOutput: structuredResponse.output,
      providerResponse: structuredResponse.rawResponse,
      inputTokens: structuredResponse.usage.inputTokens,
      outputTokens: structuredResponse.usage.outputTokens,
      totalTokens: structuredResponse.usage.totalTokens,
      latencyMs,
      fileHash,
      duplicateDocumentIds,
    });

    return {
      ok: true,
      documentId: document.id,
      runId,
      draftId: persisted.draftId,
      status: persisted.documentStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error.";

    await markRunFailed({
      documentId: input.documentId,
      runId,
      message,
      failureStage: "document_processing",
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
