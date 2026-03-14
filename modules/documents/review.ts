import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentIntakeLineItem,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import {
  asNumber,
  asRecord,
  asString,
  asStringArray,
  buildAccountingLearningSuggestions,
  buildAccountingDecisionLog,
  buildPersistableConceptLines,
  buildDraftFieldsPayload,
  buildDraftStepSnapshots,
  buildInvoiceIdentityResult,
  createReviewOverrideAccount,
  createRuleFromApproval,
  deriveDocumentAccountingState,
  getOperationCategoryValue,
  insertAIDecisionLogs,
  loadDocumentAccountingContext,
  loadDocumentAIDecisionLogs,
  loadDocumentInvoiceIdentity,
  parseAmountBreakdown,
  parseDraftFacts,
  parseLineItems,
  persistApprovedAccountingArtifacts,
  resolveDocumentDuplicateStatus,
  syncApprovedDocumentOpenItems,
  upsertDocumentAccountingContext,
  upsertDocumentInvoiceIdentity,
  upsertDocumentLineItems,
  type ApprovalLearningInput,
  type DerivedDraftArtifacts,
  type JsonRecord,
} from "@/modules/accounting";
import { materializeOrganizationRuleSnapshot } from "@/modules/organizations/rule-snapshots";
import {
  type DeterministicRuleRef,
  type OrganizationFiscalProfile,
  type OrganizationRuleSnapshotContext,
} from "@/modules/tax/uy-vat-engine";
import type { DocumentDirection } from "@/modules/documents/status";
import {
  assertVatPeriodMutableForDocument,
  rebuildMonthlyVatRunFromConfirmations,
} from "@/modules/tax/vat-runs";

type OrganizationMemberRole =
  | "owner"
  | "admin"
  | "accountant"
  | "reviewer"
  | "operator"
  | "viewer"
  | "developer";

type DocumentRow = {
  id: string;
  organization_id: string;
  direction: DocumentDirection;
  document_type: string | null;
  status: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  document_date: string | null;
  created_at: string;
  metadata: JsonRecord | null;
  current_draft_id: string | null;
  current_processing_run_id: string | null;
  last_rule_snapshot_id: string | null;
  last_processed_at: string | null;
};

type DraftRow = {
  id: string;
  organization_id: string;
  document_id: string;
  processing_run_id: string | null;
  organization_rule_snapshot_id: string | null;
  revision_number: number;
  status: string;
  document_role: DocumentRoleCandidate;
  document_type: string | null;
  operation_context_json: JsonRecord | null;
  intake_context_json: JsonRecord | null;
  fields_json: JsonRecord | null;
  extracted_text: string | null;
  warnings_json: unknown;
  journal_suggestion_json: JsonRecord | null;
  tax_treatment_json: JsonRecord | null;
  source_confidence: number | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
};

type DraftStepRow = {
  step_code: string;
  status: string;
  stale_reason: string | null;
  last_saved_at: string | null;
  last_confirmed_at: string | null;
};

type RuleSnapshotRow = {
  id: string;
  version_number: number;
  effective_from: string;
  legal_entity_type: string;
  tax_regime_code: string;
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
  prompt_summary: string;
  deterministic_rule_refs_json: unknown;
  snapshot_json: JsonRecord | null;
};

type ProfileVersionRow = {
  id: string;
  version_number: number;
  effective_from: string;
  legal_entity_type: string;
  tax_regime_code: string;
  vat_regime: string;
  dgi_group: string;
  cfe_status: string;
  country_code: string;
  tax_id: string;
};

type ProcessingRunRow = {
  id: string;
  status: string;
  provider_code: string;
  model_code: string | null;
  triggered_by: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  failure_stage: string | null;
  failure_message: string | null;
};

type ConfirmationRow = {
  id: string;
  confirmation_type: string;
  confirmed_at: string;
  confirmed_by: string | null;
};

type RevisionRow = {
  id: string;
  revision_number: number;
  status: string;
  opened_at: string;
  reconfirmed_at: string | null;
};

type ProfileDisplayRow = {
  full_name: string | null;
  email: string | null;
};

type DocumentListRow = {
  id: string;
  direction: DocumentDirection;
  document_type: string | null;
  status: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  created_at: string;
  document_date: string | null;
  current_draft_id: string | null;
};

type ReviewRuleRef = DeterministicRuleRef;

export type DocumentWorkspaceListItem = {
  id: string;
  processedHref: string | null;
  originalFilename: string;
  mimeType: string | null;
  previewUrl: string | null;
  status: string;
  role: DocumentDirection;
  documentType: string | null;
  createdAt: string;
  documentDate: string | null;
  counterpartyName: string | null;
  taxAmount: number | null;
  totalAmount: number | null;
  hasProcessedDraft: boolean;
  certaintyLevel: "green" | "yellow" | "red" | null;
  certaintyConfidence: number | null;
  duplicateStatus: string | null;
  decisionSource: string | null;
};

type DocumentViewModel = {
  id: string;
  status: string;
  direction: DocumentDirection;
  documentType: string | null;
  originalFilename: string;
  mimeType: string | null;
  createdAt: string;
  documentDate: string | null;
  previewUrl: string | null;
  metadataWarnings: string[];
  processedHref: string | null;
  hasProcessedDraft: boolean;
};

export type DocumentReviewPageData = {
  organizationId: string;
  organizationSlug: string;
  userRole: OrganizationMemberRole;
  document: DocumentViewModel;
  draft: {
    id: string;
    revisionNumber: number;
    status: string;
    sourceConfidence: number | null;
    extractedText: string;
    warnings: string[];
    facts: DocumentIntakeFactMap;
    amountBreakdown: DocumentIntakeAmountBreakdown[];
    lineItems: DocumentIntakeLineItem[];
    documentRole: DocumentRoleCandidate;
    documentType: string;
    operationCategory: string | null;
    transactionFamilyResolution: {
      source: string | null;
      confidence: number | null;
      shouldReview: boolean;
      warnings: string[];
      evidence: string[];
    } | null;
  };
  steps: DraftStepRow[];
  derived: DerivedDraftArtifacts;
  ruleSnapshot: {
    id: string;
    versionNumber: number;
    effectiveFrom: string;
    legalEntityType: string;
    taxRegimeCode: string;
    vatRegime: string;
    dgiGroup: string;
    cfeStatus: string;
    promptSummary: string;
  } | null;
  profileVersion: {
    id: string;
    versionNumber: number;
    effectiveFrom: string;
    legalEntityType: string;
    taxRegimeCode: string;
    vatRegime: string;
    dgiGroup: string;
    cfeStatus: string;
    countryCode: string;
    taxId: string;
  } | null;
  processingRun: ProcessingRunRow | null;
  revision: RevisionRow | null;
  confirmations: Array<{
    id: string;
    type: string;
    confirmedAt: string;
    confirmedBy: string;
  }>;
  operationCategoryOptions: Array<{
    code: string;
    label: string;
  }>;
  accountingOptions: {
    accounts: Array<{
      id: string;
      code: string;
      name: string;
    }>;
    concepts: Array<{
      id: string;
      code: string;
      canonicalName: string;
    }>;
  };
  learningSuggestions: {
    suggestedConceptName: string | null;
    recommendedScope: "none" | "document_override" | "vendor_concept" | "concept_global" | "vendor_default";
    options: Array<{
      scope: "vendor_concept" | "concept_global" | "vendor_default";
      label: string;
      reason: string;
      recommended: boolean;
      requiresConceptName: boolean;
    }>;
  };
  certaintySummary: {
    level: "green" | "yellow" | "red";
    confidence: number | null;
    warningCount: number;
  };
  decisionLogs: Array<{
    id: string;
    runType: string;
    decisionSource: string;
    confidenceScore: number | null;
    certaintyLevel: "green" | "yellow" | "red";
    rationaleText: string | null;
    warnings: string[];
    evidence: JsonRecord | null;
    metadata: JsonRecord | null;
    createdAt: string;
  }>;
  canConfirm: boolean;
  canReopen: boolean;
};

export type DocumentOriginalPageData = {
  organizationId: string;
  organizationSlug: string;
  userRole: OrganizationMemberRole;
  document: DocumentViewModel;
};

export type SaveDraftReviewInput = {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  stepCode:
    | "identity"
    | "fields"
    | "amounts"
    | "operation_context"
    | "accounting_context";
  payload: {
    documentRole?: DocumentRoleCandidate;
    documentType?: string;
    operationCategory?: string | null;
    facts?: Partial<Record<keyof DocumentIntakeFactMap, string | number | null>>;
    accountingContext?: {
      userFreeText?: string | null;
      manualOverrideAccountId?: string | null;
      manualOverrideConceptId?: string | null;
      manualOverrideOperationCategory?: string | null;
      learnedConceptName?: string | null;
    };
  };
};

const purchaseOperationCategoryOptions = [
  { code: "goods_resale", label: "Mercaderias para reventa" },
  { code: "services", label: "Servicios" },
  { code: "admin_expense", label: "Gastos administrativos / oficina" },
  { code: "transport", label: "Transporte / fletes" },
  { code: "fuel_and_lubricants", label: "Combustible y lubricantes" },
  { code: "professional_fees", label: "Honorarios profesionales" },
  { code: "rent", label: "Alquileres" },
] as const;

const saleOperationCategoryOptions = [
  { code: "taxed_basic_22", label: "Gravadas basico (22%)" },
  { code: "taxed_minimum_10", label: "Gravadas minimo (10%)" },
  { code: "exempt_or_export", label: "Exentas / exportaciones" },
  { code: "non_taxed", label: "No gravadas" },
] as const;

export class MissingPersistedDraftError extends Error {
  constructor() {
    super("El documento aun no tiene draft persistido.");
    this.name = "MissingPersistedDraftError";
  }
}

function getDeterministicRuleRefs(ruleSnapshot: RuleSnapshotRow | null) {
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
    } satisfies ReviewRuleRef;
  });
}

function buildOrganizationFiscalProfile(
  profileVersion: ProfileVersionRow | null,
): OrganizationFiscalProfile | null {
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

function buildRuleSnapshotContext(
  ruleSnapshot: RuleSnapshotRow | null,
): OrganizationRuleSnapshotContext | null {
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

function parseTransactionFamilyResolution(value: JsonRecord | null) {
  const intakeContext = asRecord(value);
  const resolution = asRecord(intakeContext.transaction_family_resolution);

  if (Object.keys(resolution).length === 0) {
    return null;
  }

  return {
    source: asString(resolution.source),
    confidence: asNumber(resolution.confidence),
    shouldReview: resolution.shouldReview === true,
    warnings: asStringArray(resolution.warnings),
    evidence: asStringArray(resolution.evidence),
  };
}

function buildCertaintySummary(
  logs: Array<{
    certainty_level: "green" | "yellow" | "red";
    confidence_score: number | null;
    warnings_json: string[] | null;
  }>,
  fallbackConfidence: number | null,
  fallbackWarnings: string[],
) {
  const worstLevel = logs.some((log) => log.certainty_level === "red")
    ? "red"
    : logs.some((log) => log.certainty_level === "yellow")
      ? "yellow"
      : "green";
  const confidence =
    logs.find((log) => typeof log.confidence_score === "number")?.confidence_score
    ?? fallbackConfidence;
  const warningCount =
    logs.reduce((sum, log) => sum + ((log.warnings_json ?? []).length), 0)
    || fallbackWarnings.length;

  return {
    level: worstLevel,
    confidence,
    warningCount,
  } as const;
}

async function loadDocumentRow(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, organization_id, direction, document_type, status, storage_bucket, storage_path, original_filename, mime_type, document_date, created_at, metadata, current_draft_id, current_processing_run_id, last_rule_snapshot_id, last_processed_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return data as DocumentRow;
}

async function loadCurrentDraft(
  supabase: SupabaseClient,
  document: DocumentRow,
) {
  const baseQuery = supabase
    .from("document_drafts")
    .select(
      "id, organization_id, document_id, processing_run_id, organization_rule_snapshot_id, revision_number, status, document_role, document_type, operation_context_json, intake_context_json, fields_json, extracted_text, warnings_json, journal_suggestion_json, tax_treatment_json, source_confidence, created_at, updated_at, confirmed_at",
    )
    .eq("document_id", document.id)
    .order("revision_number", { ascending: false })
    .limit(1);
  const query = document.current_draft_id
    ? baseQuery.eq("id", document.current_draft_id)
    : baseQuery;
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new MissingPersistedDraftError();
  }

  return data as DraftRow;
}

async function loadDraftSteps(supabase: SupabaseClient, draftId: string) {
  const { data, error } = await supabase
    .from("document_draft_steps")
    .select("step_code, status, stale_reason, last_saved_at, last_confirmed_at")
    .eq("draft_id", draftId)
    .order("step_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as DraftStepRow[] | null) ?? []);
}

async function loadRuleSnapshot(
  supabase: SupabaseClient,
  document: DocumentRow,
  draft: DraftRow,
  actorId: string | null,
) {
  const snapshotId = draft.organization_rule_snapshot_id ?? document.last_rule_snapshot_id;

  if (!snapshotId) {
    const { profileVersion, ruleSnapshot } = await materializeOrganizationRuleSnapshot(
      supabase,
      document.organization_id,
      actorId,
    );

    return {
      profileVersion: {
        id: profileVersion.id,
        version_number: profileVersion.version_number,
        effective_from: profileVersion.effective_from,
        legal_entity_type: profileVersion.legal_entity_type,
        tax_regime_code: profileVersion.tax_regime_code,
        vat_regime: profileVersion.vat_regime,
        dgi_group: profileVersion.dgi_group,
        cfe_status: profileVersion.cfe_status,
        country_code: profileVersion.country_code,
        tax_id: profileVersion.tax_id,
      } satisfies ProfileVersionRow,
      ruleSnapshot: {
        id: ruleSnapshot.id,
        version_number: ruleSnapshot.version_number,
        effective_from: ruleSnapshot.effective_from,
        legal_entity_type: ruleSnapshot.legal_entity_type,
        tax_regime_code: ruleSnapshot.tax_regime_code,
        vat_regime: ruleSnapshot.vat_regime,
        dgi_group: ruleSnapshot.dgi_group,
        cfe_status: ruleSnapshot.cfe_status,
        prompt_summary: ruleSnapshot.prompt_summary,
        deterministic_rule_refs_json: ruleSnapshot.deterministic_rule_refs_json,
        snapshot_json: ruleSnapshot.snapshot_json,
      } satisfies RuleSnapshotRow,
    };
  }

  const [{ data: snapshot }, { data: profileVersion }] = await Promise.all([
    supabase
      .from("organization_rule_snapshots")
      .select(
        "id, version_number, effective_from, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, prompt_summary, deterministic_rule_refs_json, snapshot_json",
      )
      .eq("id", snapshotId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("organization_profile_versions")
      .select(
        "id, version_number, effective_from, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, country_code, tax_id",
      )
      .eq("organization_id", document.organization_id)
      .eq("status", "active")
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    profileVersion: (profileVersion as ProfileVersionRow | null) ?? null,
    ruleSnapshot: (snapshot as RuleSnapshotRow | null) ?? null,
  };
}

async function loadProcessingRun(
  supabase: SupabaseClient,
  document: DocumentRow,
  draft: DraftRow,
) {
  const runId = draft.processing_run_id ?? document.current_processing_run_id;

  if (!runId) {
    return null;
  }

  const { data, error } = await supabase
    .from("document_processing_runs")
    .select(
      "id, status, provider_code, model_code, triggered_by, created_at, started_at, finished_at, latency_ms, input_tokens, output_tokens, total_tokens, failure_stage, failure_message",
    )
    .eq("id", runId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProcessingRunRow | null) ?? null;
}

async function loadRevision(supabase: SupabaseClient, draft: DraftRow) {
  const { data, error } = await supabase
    .from("document_revisions")
    .select("id, revision_number, status, opened_at, reconfirmed_at")
    .eq("working_draft_id", draft.id)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RevisionRow | null) ?? null;
}

async function loadConfirmations(
  supabase: SupabaseClient,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("document_confirmations")
    .select("id, confirmation_type, confirmed_at, confirmed_by")
    .eq("document_id", documentId)
    .order("confirmed_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as ConfirmationRow[] | null) ?? [];
  const profileIds = rows
    .map((row) => row.confirmed_by)
    .filter((value): value is string => typeof value === "string");
  const { data: profiles } = profileIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds)
    : { data: [] };
  const profileLookup = new Map(
    (((profiles as Array<ProfileDisplayRow & { id: string }> | null) ?? [])).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  return rows.map((row) => {
    const profile = row.confirmed_by ? profileLookup.get(row.confirmed_by) : null;
    const confirmedBy = profile?.full_name || profile?.email || "Usuario del tenant";

    return {
      id: row.id,
      type: row.confirmation_type,
      confirmedAt: row.confirmed_at,
      confirmedBy,
    };
  });
}

async function buildPreviewUrl(document: DocumentRow) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60 * 10);

  if (error) {
    console.error("No se pudo crear signed URL para preview documental.", error);
    return null;
  }

  return data.signedUrl;
}

async function buildDocumentViewModel(
  document: DocumentRow,
  organizationSlug: string,
): Promise<DocumentViewModel> {
  const metadata = asRecord(document.metadata);
  const processingError = asString(metadata.processing_error);

  return {
    id: document.id,
    status: document.status,
    direction: document.direction,
    documentType: document.document_type,
    originalFilename: document.original_filename,
    mimeType: document.mime_type,
    createdAt: document.created_at,
    documentDate: document.document_date,
    previewUrl: await buildPreviewUrl(document),
    metadataWarnings: processingError ? [processingError] : [],
    processedHref: document.current_draft_id
      ? `/app/o/${organizationSlug}/documents/${document.id}`
      : null,
    hasProcessedDraft: Boolean(document.current_draft_id),
  };
}

function getOperationCategoryOptions(role: DocumentRoleCandidate) {
  if (role === "purchase") {
    return purchaseOperationCategoryOptions.map((category) => ({ ...category }));
  }

  if (role === "sale") {
    return saleOperationCategoryOptions.map((category) => ({ ...category }));
  }

  return [];
}

async function upsertDraftStepSnapshots(
  supabase: SupabaseClient,
  draft: DraftRow,
  facts: DocumentIntakeFactMap,
  amountBreakdown: DocumentIntakeAmountBreakdown[],
  lineItems: DocumentIntakeLineItem[],
  operationCategory: string | null,
  derived: DerivedDraftArtifacts,
) {
  const stepRows = buildDraftStepSnapshots({
    documentRole: draft.document_role,
    documentType: draft.document_type,
    operationCategory,
    facts,
    amountBreakdown,
    lineItems,
    derived,
  });
  const { error } = await supabase
    .from("document_draft_steps")
    .upsert(
      stepRows.map((row) => ({
        draft_id: draft.id,
        ...row,
      })),
      {
        onConflict: "draft_id,step_code",
      },
    );

  if (error) {
    throw new Error(error.message);
  }
}

function mergeFacts(
  currentFacts: DocumentIntakeFactMap,
  patch: Partial<DocumentIntakeFactMap> | undefined,
) {
  if (!patch) {
    return currentFacts;
  }

  return {
    ...currentFacts,
    ...patch,
  };
}

function normalizeDraftPatch(input: SaveDraftReviewInput["payload"]) {
  const nextFacts = input.facts
    ? Object.fromEntries(
        Object.entries(input.facts).map(([key, value]) => {
          if (typeof value === "number") {
            return [key, value];
          }

          if (typeof value === "string") {
            const trimmed = value.trim();

            if (
              key === "subtotal"
              || key === "tax_amount"
              || key === "total_amount"
            ) {
              const parsed = Number.parseFloat(trimmed);
              return [key, Number.isFinite(parsed) ? parsed : null];
            }

            return [key, trimmed || null];
          }

          return [key, value ?? null];
        }),
      )
    : undefined;

  return {
    documentRole: input.documentRole,
    documentType: input.documentType?.trim() || undefined,
    operationCategory:
      typeof input.operationCategory === "string"
        ? input.operationCategory.trim() || null
        : input.operationCategory,
    facts: nextFacts as Partial<DocumentIntakeFactMap> | undefined,
    accountingContext: input.accountingContext
      ? {
          userFreeText:
            typeof input.accountingContext.userFreeText === "string"
              ? input.accountingContext.userFreeText.trim() || null
              : input.accountingContext.userFreeText ?? null,
          manualOverrideAccountId:
            typeof input.accountingContext.manualOverrideAccountId === "string"
              ? input.accountingContext.manualOverrideAccountId.trim() || null
              : input.accountingContext.manualOverrideAccountId ?? null,
          manualOverrideConceptId:
            typeof input.accountingContext.manualOverrideConceptId === "string"
              ? input.accountingContext.manualOverrideConceptId.trim() || null
              : input.accountingContext.manualOverrideConceptId ?? null,
          manualOverrideOperationCategory:
            typeof input.accountingContext.manualOverrideOperationCategory === "string"
              ? input.accountingContext.manualOverrideOperationCategory.trim() || null
              : input.accountingContext.manualOverrideOperationCategory ?? null,
          learnedConceptName:
            typeof input.accountingContext.learnedConceptName === "string"
              ? input.accountingContext.learnedConceptName.trim() || null
              : input.accountingContext.learnedConceptName ?? null,
        }
      : undefined,
  };
}

function mergeStoredAccountingContext(
  current: Awaited<ReturnType<typeof loadDocumentAccountingContext>>,
  patch: NonNullable<ReturnType<typeof normalizeDraftPatch>["accountingContext"]> | undefined,
  input: {
    organizationId: string;
    documentId: string;
    draftId: string;
  },
) {
  if (!current && !patch) {
    return null;
  }

  const currentStructured = asRecord(current?.structured_context_json);
  const structuredContext = {
    ...currentStructured,
    ...(patch
      ? {
          manual_override_account_id:
            patch.manualOverrideAccountId ?? asString(currentStructured.manual_override_account_id),
          manual_override_concept_id:
            patch.manualOverrideConceptId ?? asString(currentStructured.manual_override_concept_id),
          manual_override_operation_category:
            patch.manualOverrideOperationCategory
            ?? asString(currentStructured.manual_override_operation_category),
          learned_concept_name:
            patch.learnedConceptName ?? asString(currentStructured.learned_concept_name),
        }
      : {}),
  };

  return {
    id: current?.id ?? `draft-${input.draftId}`,
    organization_id: current?.organization_id ?? input.organizationId,
    document_id: current?.document_id ?? input.documentId,
    draft_id: current?.draft_id ?? input.draftId,
    status: current?.status ?? "required",
    reason_codes: current?.reason_codes ?? [],
    user_free_text: patch?.userFreeText ?? current?.user_free_text ?? null,
    structured_context_json: structuredContext,
    ai_request_payload_json: current?.ai_request_payload_json ?? {},
    ai_response_json: current?.ai_response_json ?? {},
    provider_code: current?.provider_code ?? null,
    model_code: current?.model_code ?? null,
    prompt_hash: current?.prompt_hash ?? null,
    request_latency_ms: current?.request_latency_ms ?? null,
    created_at: current?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function persistDraftArtifacts(
  supabase: SupabaseClient,
  document: DocumentRow,
  draft: DraftRow,
  actorId: string | null,
  derived: DerivedDraftArtifacts,
) {
  const facts = parseDraftFacts(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const operationCategory = getOperationCategoryValue(draft, facts);
  const existingInvoiceIdentity = await loadDocumentInvoiceIdentity(supabase, document.id);
  const nextDocumentStatus =
    document.status === "classified" || document.status === "classified_with_open_revision"
      ? document.status
      : derived.validation.canConfirm
        ? "draft_ready"
        : "needs_review";
  const { error: draftError } = await supabase
    .from("document_drafts")
    .update({
      status: derived.validation.canConfirm ? "ready_for_confirmation" : "open",
      journal_suggestion_json: derived.journalSuggestion,
      tax_treatment_json: derived.taxTreatment,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  if (draftError) {
    throw new Error(draftError.message);
  }

  if (derived.invoiceIdentity) {
    await upsertDocumentInvoiceIdentity(supabase, {
      organization_id: document.organization_id,
      document_id: document.id,
      source_draft_id: draft.id,
      vendor_id: derived.vendorResolution.vendorId,
      issuer_tax_id_normalized: derived.invoiceIdentity.issuerTaxIdNormalized,
      issuer_name_normalized: derived.invoiceIdentity.issuerNameNormalized,
      document_number_normalized: derived.invoiceIdentity.documentNumberNormalized,
      document_date: derived.invoiceIdentity.documentDate,
      total_amount: derived.invoiceIdentity.totalAmount,
      currency_code: derived.invoiceIdentity.currencyCode,
      identity_strategy: derived.invoiceIdentity.identityStrategy,
      invoice_identity_key: derived.invoiceIdentity.invoiceIdentityKey,
      duplicate_status: derived.invoiceIdentity.duplicateStatus,
      duplicate_of_document_id: derived.invoiceIdentity.duplicateOfDocumentId,
      duplicate_reason: derived.invoiceIdentity.duplicateReason,
      resolution_notes: existingInvoiceIdentity?.resolution_notes ?? null,
    });
  }
  await upsertDocumentLineItems(supabase, {
    organizationId: document.organization_id,
    documentId: document.id,
    draftId: draft.id,
    lines: buildPersistableConceptLines({
      lineItems,
      amountBreakdown,
      conceptLines: derived.conceptResolution.lines,
    }),
  });
  await upsertDocumentAccountingContext(supabase, {
    organizationId: document.organization_id,
    documentId: document.id,
    draftId: draft.id,
    actorId,
    context: derived.accountingContext,
  });

  await upsertDraftStepSnapshots(
    supabase,
    draft,
    facts,
    amountBreakdown,
    lineItems,
    operationCategory,
    derived,
  );

  const { error: documentError } = await supabase
    .from("documents")
    .update({
      direction: draft.document_role,
      document_type: draft.document_type,
      document_date: facts.document_date ?? document.document_date,
      status: nextDocumentStatus,
      current_draft_id: draft.id,
      metadata: {
        ...(document.metadata ?? {}),
        duplicate_status: derived.invoiceIdentity?.duplicateStatus ?? null,
        duplicate_reason: derived.invoiceIdentity?.duplicateReason ?? null,
        accounting_context_required: derived.accountingContext.status !== "not_required",
        matched_concept_count: derived.conceptResolution.matchedConceptIds.length,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id);

  if (documentError) {
    throw new Error(documentError.message);
  }
}

export async function listOrganizationWorkspaceDocuments(input: {
  organizationId: string;
  organizationSlug: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, direction, document_type, status, storage_bucket, storage_path, original_filename, mime_type, created_at, document_date, current_draft_id",
    )
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data as DocumentListRow[] | null) ?? []);
  const documentIds = rows.map((row) => row.id);
  const draftIds = rows
    .map((row) => row.current_draft_id)
    .filter((value): value is string => typeof value === "string");
  const draftFactsById = new Map<string, DocumentIntakeFactMap>();

  if (draftIds.length > 0) {
    const { data: draftRows, error: draftError } = await supabase
      .from("document_drafts")
      .select("id, fields_json")
      .in("id", draftIds);

    if (draftError) {
      throw new Error(draftError.message);
    }

    for (const row of ((draftRows as Array<{
      id: string;
      fields_json: JsonRecord | null;
    }> | null) ?? [])) {
      draftFactsById.set(row.id, parseDraftFacts(row.fields_json));
    }
  }

  const [invoiceIdentityResult, decisionLogsResult] = await Promise.all([
    documentIds.length > 0
      ? supabase
        .from("document_invoice_identities")
        .select("document_id, duplicate_status")
        .in("document_id", documentIds)
      : Promise.resolve({ data: [], error: null }),
    documentIds.length > 0
      ? supabase
        .from("ai_decision_logs")
        .select("document_id, decision_source, confidence_score, certainty_level, created_at")
        .eq("organization_id", input.organizationId)
        .in("document_id", documentIds)
        .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const invoiceIdentityError =
    invoiceIdentityResult.error
    && !isMissingSupabaseRelationError(invoiceIdentityResult.error, "document_invoice_identities")
      ? invoiceIdentityResult.error
      : null;
  const decisionLogsError =
    decisionLogsResult.error
    && !isMissingSupabaseRelationError(decisionLogsResult.error, "ai_decision_logs")
      ? decisionLogsResult.error
      : null;

  if (invoiceIdentityError || decisionLogsError) {
    throw new Error(invoiceIdentityError?.message ?? decisionLogsError?.message ?? "No se pudieron cargar indicadores de confianza.");
  }

  const duplicateStatusByDocumentId = new Map(
    (((invoiceIdentityResult.data as Array<{
      document_id: string;
      duplicate_status: string;
    }> | null) ?? [])).map((row) => [row.document_id, row.duplicate_status]),
  );
  const latestDecisionLogByDocumentId = new Map<string, {
    decision_source: string | null;
    confidence_score: number | null;
    certainty_level: "green" | "yellow" | "red";
  }>();

  for (const row of (((decisionLogsResult.data as Array<{
    document_id: string;
    decision_source: string | null;
    confidence_score: number | null;
    certainty_level: "green" | "yellow" | "red";
  }> | null) ?? []))) {
    if (!latestDecisionLogByDocumentId.has(row.document_id)) {
      latestDecisionLogByDocumentId.set(row.document_id, row);
    }
  }

  return Promise.all(rows.map(async (row) => ({
    ...(() => {
      const facts = row.current_draft_id
        ? draftFactsById.get(row.current_draft_id) ?? null
        : null;
      const counterpartyName = row.direction === "purchase"
        ? facts?.issuer_name ?? null
        : row.direction === "sale"
          ? facts?.receiver_name ?? null
          : facts?.issuer_name ?? facts?.receiver_name ?? null;

      return {
        counterpartyName,
        taxAmount: facts?.tax_amount ?? null,
        totalAmount: facts?.total_amount ?? null,
      };
    })(),
    ...(() => {
      const decision = latestDecisionLogByDocumentId.get(row.id);

      return {
        certaintyLevel: decision?.certainty_level ?? null,
        certaintyConfidence: decision?.confidence_score ?? null,
        duplicateStatus: duplicateStatusByDocumentId.get(row.id) ?? null,
        decisionSource: decision?.decision_source ?? null,
      };
    })(),
    id: row.id,
    processedHref: row.current_draft_id
      ? `/app/o/${input.organizationSlug}/documents/${row.id}`
      : null,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    previewUrl: await buildPreviewUrl({
      id: row.id,
      organization_id: input.organizationId,
      direction: row.direction,
      document_type: row.document_type,
      status: row.status,
      storage_bucket: row.storage_bucket,
      storage_path: row.storage_path,
      original_filename: row.original_filename,
      mime_type: row.mime_type,
      document_date: row.document_date,
      created_at: row.created_at,
      metadata: null,
      current_draft_id: row.current_draft_id,
      current_processing_run_id: null,
      last_rule_snapshot_id: null,
      last_processed_at: null,
    }),
    status: row.status,
    role: row.direction,
    documentType: row.document_type,
    createdAt: row.created_at,
    documentDate: row.document_date,
    hasProcessedDraft: Boolean(row.current_draft_id),
  } satisfies DocumentWorkspaceListItem)));
}

export async function loadDocumentOriginalPageData(input: {
  organizationId: string;
  organizationSlug: string;
  documentId: string;
  userRole: OrganizationMemberRole;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);

  return {
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
    userRole: input.userRole,
    document: await buildDocumentViewModel(document, input.organizationSlug),
  } satisfies DocumentOriginalPageData;
}

export async function loadDocumentReviewPageData(input: {
  organizationId: string;
  organizationSlug: string;
  documentId: string;
  actorId: string | null;
  userRole: OrganizationMemberRole;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const documentViewPromise = buildDocumentViewModel(document, input.organizationSlug);
  const draft = await loadCurrentDraft(supabase, document);
  const facts = parseDraftFacts(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const operationCategory = getOperationCategoryValue(draft, facts);
  const [{ profileVersion, ruleSnapshot }, steps, processingRun, revision, confirmations, documentView, persistedInvoiceIdentity, decisionLogs] =
    await Promise.all([
      loadRuleSnapshot(supabase, document, draft, input.actorId),
      loadDraftSteps(supabase, draft.id),
      loadProcessingRun(supabase, document, draft),
      loadRevision(supabase, draft),
      loadConfirmations(supabase, document.id),
      documentViewPromise,
      loadDocumentInvoiceIdentity(supabase, document.id),
      loadDocumentAIDecisionLogs(supabase, {
        organizationId: input.organizationId,
        documentId: document.id,
      }),
    ]);
  const invoiceIdentity = buildInvoiceIdentityResult({
    facts,
    persistedDuplicateStatus: persistedInvoiceIdentity?.duplicate_status ?? null,
    persistedDuplicateOfDocumentId: persistedInvoiceIdentity?.duplicate_of_document_id ?? null,
    persistedDuplicateReason: persistedInvoiceIdentity?.duplicate_reason ?? null,
  });
  const accountingState = await deriveDocumentAccountingState({
    supabase,
    organizationId: input.organizationId,
    documentId: document.id,
    draftId: draft.id,
    actorId: input.actorId,
    documentRole: draft.document_role,
    documentType: draft.document_type,
    facts,
    amountBreakdown,
    lineItems,
    operationCategory,
    profile: buildOrganizationFiscalProfile(profileVersion),
    ruleSnapshot: buildRuleSnapshotContext(ruleSnapshot),
    invoiceIdentity,
    runAssistant: false,
  });
  const derived = accountingState.derived;
  const transactionFamilyResolution = parseTransactionFamilyResolution(draft.intake_context_json);
  const certaintySummary = buildCertaintySummary(
    decisionLogs,
    draft.source_confidence,
    asStringArray(draft.warnings_json),
  );
  const learningSuggestions = buildAccountingLearningSuggestions({
    accountingContext: derived.accountingContext,
    conceptResolution: derived.conceptResolution,
    vendorResolution: derived.vendorResolution,
    appliedRule: derived.appliedRule,
  });

  return {
    organizationId: input.organizationId,
    organizationSlug: input.organizationSlug,
    userRole: input.userRole,
    document: {
      ...documentView,
      direction: draft.document_role,
      documentType: draft.document_type,
      documentDate: facts.document_date ?? document.document_date,
    },
    draft: {
      id: draft.id,
      revisionNumber: draft.revision_number,
      status: draft.status,
      sourceConfidence: draft.source_confidence,
      extractedText: draft.extracted_text ?? "",
      warnings: asStringArray(draft.warnings_json),
      facts,
      amountBreakdown,
      lineItems,
      documentRole: draft.document_role,
      documentType: draft.document_type ?? "",
      operationCategory,
      transactionFamilyResolution,
    },
    steps,
    derived,
    ruleSnapshot: ruleSnapshot
      ? {
          id: ruleSnapshot.id,
          versionNumber: ruleSnapshot.version_number,
          effectiveFrom: ruleSnapshot.effective_from,
          legalEntityType: ruleSnapshot.legal_entity_type,
          taxRegimeCode: ruleSnapshot.tax_regime_code,
          vatRegime: ruleSnapshot.vat_regime,
          dgiGroup: ruleSnapshot.dgi_group,
          cfeStatus: ruleSnapshot.cfe_status,
          promptSummary: ruleSnapshot.prompt_summary,
        }
      : null,
    profileVersion: profileVersion
      ? {
          id: profileVersion.id,
          versionNumber: profileVersion.version_number,
          effectiveFrom: profileVersion.effective_from,
          legalEntityType: profileVersion.legal_entity_type,
          taxRegimeCode: profileVersion.tax_regime_code,
          vatRegime: profileVersion.vat_regime,
          dgiGroup: profileVersion.dgi_group,
          cfeStatus: profileVersion.cfe_status,
          countryCode: profileVersion.country_code,
          taxId: profileVersion.tax_id,
        }
      : null,
    processingRun,
    revision,
    confirmations,
    operationCategoryOptions: getOperationCategoryOptions(draft.document_role),
    accountingOptions: {
      accounts: accountingState.runtimeContext.accounts.map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
      })),
      concepts: accountingState.runtimeContext.concepts.map((concept) => ({
        id: concept.id,
        code: concept.code,
        canonicalName: concept.canonical_name,
      })),
    },
    learningSuggestions,
    certaintySummary,
    decisionLogs: decisionLogs.map((log) => ({
      id: log.id,
      runType: log.run_type,
      decisionSource: log.decision_source,
      confidenceScore: log.confidence_score,
      certaintyLevel: log.certainty_level,
      rationaleText: log.rationale_text,
      warnings: log.warnings_json ?? [],
      evidence: log.evidence_json ?? null,
      metadata: log.metadata_json ?? null,
      createdAt: log.created_at,
    })),
    canConfirm:
      ["owner", "admin", "accountant", "reviewer"].includes(input.userRole)
      && derived.validation.canConfirm
      && draft.status !== "confirmed",
    canReopen:
      ["owner", "admin"].includes(input.userRole)
      && (document.status === "classified" || draft.status === "confirmed"),
  } satisfies DocumentReviewPageData;
}

export async function createDocumentReviewOverrideAccount(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  code: string;
  name: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const draft = await loadCurrentDraft(supabase, document);
  const account = await createReviewOverrideAccount(supabase, {
    organizationId: input.organizationId,
    actorId: input.actorId,
    documentId: document.id,
    draftId: draft.id,
    documentRole: draft.document_role,
    code: input.code,
    name: input.name,
  });

  return {
    ok: true,
    message: `Cuenta ${account.code} creada y lista para usarse en este draft.`,
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
    },
  };
}

export async function saveDraftReview(input: SaveDraftReviewInput) {
  const supabase = getSupabaseServiceRoleClient();
  const normalized = normalizeDraftPatch(input.payload);
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const draft = await loadCurrentDraft(supabase, document);
  const facts = mergeFacts(parseDraftFacts(draft.fields_json), normalized.facts);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const nextDraft: DraftRow = {
    ...draft,
    document_role: normalized.documentRole ?? draft.document_role,
    document_type: normalized.documentType ?? draft.document_type,
    operation_context_json: {
      ...asRecord(draft.operation_context_json),
      operation_category_candidate:
        normalized.operationCategory === undefined
          ? getOperationCategoryValue(draft, facts)
          : normalized.operationCategory,
    },
    fields_json: {
      ...asRecord(draft.fields_json),
      ...buildDraftFieldsPayload({
        facts,
        amountBreakdown,
        lineItems,
      }),
    },
  };
  const existingAccountingContext = await loadDocumentAccountingContext(
    supabase,
    draft.id,
  );
  const mergedAccountingContext = mergeStoredAccountingContext(
    existingAccountingContext,
    normalized.accountingContext,
    {
      organizationId: input.organizationId,
      documentId: input.documentId,
      draftId: draft.id,
    },
  );
  const { profileVersion, ruleSnapshot } = await loadRuleSnapshot(
    supabase,
    document,
    nextDraft,
    input.actorId,
  );
  const operationCategory = getOperationCategoryValue(nextDraft, facts);
  const persistedInvoiceIdentity = await loadDocumentInvoiceIdentity(
    supabase,
    document.id,
  );
  const invoiceIdentity = buildInvoiceIdentityResult({
    facts,
    persistedDuplicateStatus: persistedInvoiceIdentity?.duplicate_status ?? null,
    persistedDuplicateOfDocumentId: persistedInvoiceIdentity?.duplicate_of_document_id ?? null,
    persistedDuplicateReason: persistedInvoiceIdentity?.duplicate_reason ?? null,
  });
  const accountingState = await deriveDocumentAccountingState({
    supabase,
    organizationId: input.organizationId,
    documentId: document.id,
    draftId: draft.id,
    actorId: input.actorId,
    documentRole: nextDraft.document_role,
    documentType: nextDraft.document_type,
    facts,
    amountBreakdown,
    lineItems,
    operationCategory,
    profile: buildOrganizationFiscalProfile(profileVersion),
    ruleSnapshot: buildRuleSnapshotContext(ruleSnapshot),
    invoiceIdentity,
    storedContext: mergedAccountingContext,
    runAssistant: input.stepCode === "accounting_context",
  });
  const derived = accountingState.derived;

  const { error: updateError } = await supabase
    .from("document_drafts")
    .update({
      document_role: nextDraft.document_role,
      document_type: nextDraft.document_type,
      operation_context_json: nextDraft.operation_context_json,
      fields_json: nextDraft.fields_json,
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nextDraft.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: autosaveError } = await supabase
    .from("document_draft_autosaves")
    .insert({
      draft_id: draft.id,
      step_code: input.stepCode,
      payload_patch_json: input.payload,
      saved_by: input.actorId,
    });

  if (autosaveError) {
    throw new Error(autosaveError.message);
  }

  await persistDraftArtifacts(supabase, document, nextDraft, input.actorId, derived);

  return {
    ok: true,
    status: derived.validation.canConfirm ? "ready_for_confirmation" : "open",
    blockers: derived.validation.blockers,
  };
}

export async function confirmDocumentReview(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  learning?: ApprovalLearningInput;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const draft = await loadCurrentDraft(supabase, document);
  const facts = parseDraftFacts(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const { profileVersion, ruleSnapshot } = await loadRuleSnapshot(
    supabase,
    document,
    draft,
    input.actorId,
  );
  const operationCategory = getOperationCategoryValue(draft, facts);
  const persistedInvoiceIdentity = await loadDocumentInvoiceIdentity(
    supabase,
    document.id,
  );
  const invoiceIdentity = buildInvoiceIdentityResult({
    facts,
    persistedDuplicateStatus: persistedInvoiceIdentity?.duplicate_status ?? null,
    persistedDuplicateOfDocumentId: persistedInvoiceIdentity?.duplicate_of_document_id ?? null,
    persistedDuplicateReason: persistedInvoiceIdentity?.duplicate_reason ?? null,
  });
  const accountingState = await deriveDocumentAccountingState({
    supabase,
    organizationId: input.organizationId,
    documentId: document.id,
    draftId: draft.id,
    actorId: input.actorId,
    documentRole: draft.document_role,
    documentType: draft.document_type,
    facts,
    amountBreakdown,
    lineItems,
    operationCategory,
    profile: buildOrganizationFiscalProfile(profileVersion),
    ruleSnapshot: buildRuleSnapshotContext(ruleSnapshot),
    invoiceIdentity,
    runAssistant: true,
  });
  const derived = accountingState.derived;

  if (!derived.validation.canConfirm) {
    return {
      ok: false,
      message: derived.validation.blockers.join(" "),
    };
  }

  if (facts.document_date) {
    await assertVatPeriodMutableForDocument(
      supabase,
      document.organization_id,
      facts.document_date,
    );
  }

  await persistDraftArtifacts(supabase, document, draft, input.actorId, derived);
  const referenceParts = [facts.series, facts.document_number].filter(Boolean);
  const accountingArtifacts = await persistApprovedAccountingArtifacts(
    supabase,
    {
      organizationId: document.organization_id,
      documentId: document.id,
      draftId: draft.id,
      revisionNumber: draft.revision_number,
      documentDate:
        facts.document_date ?? document.document_date ?? new Date().toISOString().slice(0, 10),
      originalFilename: document.original_filename,
      currencyCode: facts.currency_code ?? "UYU",
      reference:
        referenceParts.length > 0
          ? referenceParts.join("-")
          : document.original_filename,
      confidence: draft.source_confidence,
      actorId: input.actorId,
      derived,
    },
  );
  if ((input.learning?.scope ?? "none") !== "none") {
    await createRuleFromApproval(supabase, {
      organizationId: document.organization_id,
      documentId: document.id,
      actorId: input.actorId,
      documentRole: draft.document_role,
      learning: input.learning ?? { scope: "none", learnedConceptName: null },
      vendorId: derived.vendorResolution.vendorId,
      conceptId:
        derived.accountingContext.manualOverrideConceptId
        ?? derived.conceptResolution.matchedConceptIds[0]
        ?? derived.assistantSuggestion.output?.suggestedConceptId
        ?? null,
      conceptName:
        input.learning?.learnedConceptName
        ?? derived.accountingContext.learnedConceptName
        ?? derived.conceptResolution.primaryConceptLabels[0]
        ?? null,
      accountId: derived.appliedRule.accountId,
      operationCategory: derived.appliedRule.operationCategory ?? operationCategory,
      linkedOperationType: derived.appliedRule.linkedOperationType,
      vatProfileJson: {
        treatment_code: derived.taxTreatment.treatmentCode,
        vat_bucket: derived.taxTreatment.vatBucket,
      },
      conceptLines: derived.conceptResolution.lines,
      rationale:
        derived.assistantSuggestion.rationale
        ?? derived.journalSuggestion.explanation,
    });
  }
  await syncApprovedDocumentOpenItems({
    supabase,
    organizationId: document.organization_id,
    documentId: document.id,
    documentRole: draft.document_role,
    documentType: draft.document_type,
    documentDate:
      facts.document_date ?? document.document_date ?? new Date().toISOString().slice(0, 10),
    dueDate: facts.due_date,
    currencyCode: facts.currency_code,
    totalAmount: facts.total_amount,
    vendorId: derived.vendorResolution.vendorId,
    issuerName: facts.issuer_name,
    issuerTaxId: facts.issuer_tax_id,
    receiverName: facts.receiver_name,
    receiverTaxId: facts.receiver_tax_id,
    journalEntryId: accountingArtifacts.journalEntryId,
  });
  await insertAIDecisionLogs(supabase, [
    buildAccountingDecisionLog({
      organizationId: document.organization_id,
      documentId: document.id,
      providerCode: derived.assistantSuggestion.providerCode,
      modelCode: derived.assistantSuggestion.modelCode,
      derived,
    }),
  ]);
  const existingConfirmations = await loadConfirmations(supabase, document.id);
  const confirmationType = existingConfirmations.length > 0 ? "reconfirmation" : "final";
  const confirmedAt = new Date().toISOString();

  const { error: draftError } = await supabase
    .from("document_drafts")
    .update({
      status: "confirmed",
      journal_suggestion_json: derived.journalSuggestion,
      tax_treatment_json: derived.taxTreatment,
      confirmed_by: input.actorId,
      confirmed_at: confirmedAt,
      updated_by: input.actorId,
      updated_at: confirmedAt,
    })
    .eq("id", draft.id);

  if (draftError) {
    throw new Error(draftError.message);
  }

  const { error: stepsError } = await supabase
    .from("document_draft_steps")
    .upsert(
      [
        "identity",
        "fields",
        "amounts",
        "operation_context",
        "accounting_context",
        "journal",
        "tax",
        "confirmation",
      ].map((stepCode) => ({
        draft_id: draft.id,
        step_code: stepCode,
        status: "confirmed",
        last_saved_at: confirmedAt,
        last_confirmed_at: confirmedAt,
        stale_reason: null,
        snapshot_json:
          stepCode === "journal"
            ? derived.journalSuggestion
            : stepCode === "tax"
              ? derived.taxTreatment
              : {},
      })),
      {
        onConflict: "draft_id,step_code",
      },
    );

  if (stepsError) {
    throw new Error(stepsError.message);
  }

  const { error: confirmationError } = await supabase
    .from("document_confirmations")
    .insert({
      organization_id: document.organization_id,
      document_id: document.id,
      draft_id: draft.id,
      confirmation_type: confirmationType,
      confirmed_by: input.actorId,
      confirmed_at: confirmedAt,
      snapshot_json: {
        draft_revision_number: draft.revision_number,
        journal_entry_id: accountingArtifacts.journalEntryId,
        accounting_suggestion_id: accountingArtifacts.suggestionId,
        tax_treatment: derived.taxTreatment,
      },
    });

  if (confirmationError) {
    throw new Error(confirmationError.message);
  }

  const { error: revisionError } = await supabase
    .from("document_revisions")
    .update({
      status: "reconfirmed",
      reconfirmed_by: input.actorId,
      reconfirmed_at: confirmedAt,
    })
    .eq("working_draft_id", draft.id);

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  const { error: documentError } = await supabase
    .from("documents")
    .update({
      status: "classified",
      current_draft_id: draft.id,
      direction: draft.document_role,
      document_type: draft.document_type,
      document_date: facts.document_date ?? document.document_date,
      updated_at: confirmedAt,
      last_processed_at: confirmedAt,
    })
    .eq("id", document.id);

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (facts.document_date) {
    await rebuildMonthlyVatRunFromConfirmations(
      supabase,
      document.organization_id,
      facts.document_date,
      input.actorId,
    );
  }

  return {
    ok: true,
    message: "Documento confirmado y journal entry draft generado.",
  };
}

export async function resolveDocumentDuplicate(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
  action: "confirmed_duplicate" | "false_positive" | "justified_non_duplicate";
  note: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();

  return resolveDocumentDuplicateStatus(supabase, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    actorId: input.actorId,
    action: input.action,
    note: input.note,
  });
}

export async function reopenDocumentReview(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const currentDraft = await loadCurrentDraft(supabase, document);
  const currentFacts = parseDraftFacts(currentDraft.fields_json);

  if (document.status === "classified_with_open_revision" && currentDraft.status !== "confirmed") {
    return {
      ok: true,
      message: "El documento ya tiene una revision abierta.",
    };
  }

  if (currentDraft.status !== "confirmed") {
    throw new Error("Solo se puede reabrir desde una revision confirmada.");
  }

  if (currentFacts.document_date) {
    await assertVatPeriodMutableForDocument(
      supabase,
      document.organization_id,
      currentFacts.document_date,
    );
  }

  const { data: latestDraftRow, error: latestDraftError } = await supabase
    .from("document_drafts")
    .select("revision_number")
    .eq("document_id", document.id)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestDraftError) {
    throw new Error(latestDraftError.message);
  }

  const nextRevisionNumber =
    typeof latestDraftRow?.revision_number === "number"
      ? latestDraftRow.revision_number + 1
      : currentDraft.revision_number + 1;
  const reopenedAt = new Date().toISOString();
  const { data: insertedDraft, error: insertDraftError } = await supabase
    .from("document_drafts")
    .insert({
      organization_id: currentDraft.organization_id,
      document_id: currentDraft.document_id,
      processing_run_id: currentDraft.processing_run_id,
      organization_rule_snapshot_id: currentDraft.organization_rule_snapshot_id,
      revision_number: nextRevisionNumber,
      status: "open",
      document_role: currentDraft.document_role,
      document_type: currentDraft.document_type,
      operation_context_json: asRecord(currentDraft.operation_context_json),
      intake_context_json: asRecord(currentDraft.intake_context_json),
      fields_json: asRecord(currentDraft.fields_json),
      extracted_text: currentDraft.extracted_text,
      warnings_json: asStringArray(currentDraft.warnings_json),
      journal_suggestion_json: currentDraft.journal_suggestion_json,
      tax_treatment_json: currentDraft.tax_treatment_json,
      source_confidence: currentDraft.source_confidence,
      created_by: input.actorId,
      updated_by: input.actorId,
    })
    .select(
      "id, organization_id, document_id, processing_run_id, organization_rule_snapshot_id, revision_number, status, document_role, document_type, operation_context_json, intake_context_json, fields_json, extracted_text, warnings_json, journal_suggestion_json, tax_treatment_json, source_confidence, created_at, updated_at, confirmed_at",
    )
    .limit(1)
    .single();

  if (insertDraftError || !insertedDraft) {
    throw new Error(insertDraftError?.message ?? "No se pudo clonar el draft confirmado.");
  }

  const newDraft = insertedDraft as DraftRow;
  const facts = parseDraftFacts(newDraft.fields_json);
  const amountBreakdown = parseAmountBreakdown(newDraft.fields_json);
  const lineItems = parseLineItems(newDraft.fields_json);
  const operationCategory = getOperationCategoryValue(newDraft, facts);
  const { profileVersion, ruleSnapshot } = await loadRuleSnapshot(
    supabase,
    document,
    newDraft,
    input.actorId,
  );
  const persistedInvoiceIdentity = await loadDocumentInvoiceIdentity(
    supabase,
    document.id,
  );
  const invoiceIdentity = buildInvoiceIdentityResult({
    facts,
    persistedDuplicateStatus: persistedInvoiceIdentity?.duplicate_status ?? null,
    persistedDuplicateOfDocumentId: persistedInvoiceIdentity?.duplicate_of_document_id ?? null,
    persistedDuplicateReason: persistedInvoiceIdentity?.duplicate_reason ?? null,
  });
  const existingAccountingContext = await loadDocumentAccountingContext(
    supabase,
    currentDraft.id,
  );
  const clonedAccountingContext = existingAccountingContext
    ? {
        ...existingAccountingContext,
        id: `draft-${newDraft.id}`,
        draft_id: newDraft.id,
      }
    : null;
  const accountingState = await deriveDocumentAccountingState({
    supabase,
    organizationId: document.organization_id,
    documentId: document.id,
    draftId: newDraft.id,
    actorId: input.actorId,
    documentRole: newDraft.document_role,
    documentType: newDraft.document_type,
    facts,
    amountBreakdown,
    lineItems,
    operationCategory,
    profile: buildOrganizationFiscalProfile(profileVersion),
    ruleSnapshot: buildRuleSnapshotContext(ruleSnapshot),
    invoiceIdentity,
    storedContext: clonedAccountingContext,
    runAssistant: false,
  });
  const derived = accountingState.derived;
  await upsertDocumentLineItems(supabase, {
    organizationId: document.organization_id,
    documentId: document.id,
    draftId: newDraft.id,
    lines: buildPersistableConceptLines({
      lineItems,
      amountBreakdown,
      conceptLines: derived.conceptResolution.lines,
    }),
  });
  await upsertDocumentAccountingContext(supabase, {
    organizationId: document.organization_id,
    documentId: document.id,
    draftId: newDraft.id,
    actorId: input.actorId,
    context: derived.accountingContext,
  });
  const stepRows = buildDraftStepSnapshots({
    documentRole: newDraft.document_role,
    documentType: newDraft.document_type,
    operationCategory,
    facts,
    amountBreakdown,
    lineItems,
    derived,
    savedAt: reopenedAt,
  }).map((step) =>
    step.step_code === "confirmation"
      ? {
          ...step,
          status: "blocked" as const,
          stale_reason: "reopen_requires_reconfirmation",
        }
      : step,
  );
  const { error: stepsError } = await supabase
    .from("document_draft_steps")
    .insert(
      stepRows.map((step) => ({
        draft_id: newDraft.id,
        step_code: step.step_code,
        status: step.status,
        last_saved_at: step.last_saved_at,
        stale_reason: step.stale_reason,
        snapshot_json: step.snapshot_json,
      })),
    );

  if (stepsError) {
    throw new Error(stepsError.message);
  }

  const { error: revisionError } = await supabase
    .from("document_revisions")
    .insert({
      organization_id: document.organization_id,
      document_id: document.id,
      revision_number: nextRevisionNumber,
      base_confirmed_draft_id: currentDraft.id,
      working_draft_id: newDraft.id,
      status: "open",
      opened_by: input.actorId,
      opened_at: reopenedAt,
    });

  if (revisionError) {
    throw new Error(revisionError.message);
  }

  const { error: documentError } = await supabase
    .from("documents")
    .update({
      status: "classified_with_open_revision",
      current_draft_id: newDraft.id,
      updated_at: reopenedAt,
    })
    .eq("id", document.id);

  if (documentError) {
    throw new Error(documentError.message);
  }

  return {
    ok: true,
    message: "Revision abierta a partir de la ultima confirmacion.",
  };
}
