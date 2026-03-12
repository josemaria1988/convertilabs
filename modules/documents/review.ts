import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentIntakeAmountBreakdown,
  DocumentIntakeFactMap,
  DocumentRoleCandidate,
} from "@/modules/ai/document-intake-contract";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { materializeOrganizationRuleSnapshot } from "@/modules/organizations/rule-snapshots";
import {
  resolveUyVatTreatment,
  type DeterministicRuleRef,
  type OrganizationFiscalProfile,
  type OrganizationRuleSnapshotContext,
  type VatEngineResult,
} from "@/modules/tax/uy-vat-engine";
import { rebuildMonthlyVatRunFromConfirmations } from "@/modules/tax/vat-runs";

type JsonRecord = Record<string, unknown>;

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
  direction: DocumentRoleCandidate;
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

type ChartAccountRow = {
  id: string;
  code: string;
  name: string;
};

type DocumentListRow = {
  id: string;
  direction: DocumentRoleCandidate;
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

type ReviewJournalLine = {
  lineNumber: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  provenance: string;
};

type ReviewTaxTreatment = VatEngineResult;

type ReviewJournalSuggestion = {
  ready: boolean;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  explanation: string;
  lines: ReviewJournalLine[];
  blockingReasons: string[];
};

type DerivedDraftArtifacts = {
  taxTreatment: ReviewTaxTreatment;
  journalSuggestion: ReviewJournalSuggestion;
  validation: {
    canConfirm: boolean;
    blockers: string[];
  };
};

export type DocumentWorkspaceListItem = {
  id: string;
  processedHref: string | null;
  originalFilename: string;
  mimeType: string | null;
  previewUrl: string | null;
  status: string;
  role: DocumentRoleCandidate;
  documentType: string | null;
  createdAt: string;
  documentDate: string | null;
  hasProcessedDraft: boolean;
};

type DocumentViewModel = {
  id: string;
  status: string;
  direction: DocumentRoleCandidate;
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
    documentRole: DocumentRoleCandidate;
    documentType: string;
    operationCategory: string | null;
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
  stepCode: "identity" | "fields" | "amounts" | "operation_context";
  payload: {
    documentRole?: DocumentRoleCandidate;
    documentType?: string;
    operationCategory?: string | null;
    facts?: Partial<Record<keyof DocumentIntakeFactMap, string | number | null>>;
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

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function roundCurrency(value: number | null) {
  if (value === null) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

function parseDraftFacts(fieldsJson: JsonRecord | null): DocumentIntakeFactMap {
  const fields = asRecord(fieldsJson);
  const facts = asRecord(fields.facts);

  return {
    issuer_name: asString(facts.issuer_name),
    issuer_tax_id: asString(facts.issuer_tax_id),
    receiver_name: asString(facts.receiver_name),
    receiver_tax_id: asString(facts.receiver_tax_id),
    document_number: asString(facts.document_number),
    series: asString(facts.series),
    currency_code: asString(facts.currency_code),
    document_date: asString(facts.document_date),
    due_date: asString(facts.due_date),
    subtotal: asNumber(facts.subtotal),
    tax_amount: asNumber(facts.tax_amount),
    total_amount: asNumber(facts.total_amount),
    purchase_category_candidate: asString(facts.purchase_category_candidate),
    sale_category_candidate: asString(facts.sale_category_candidate),
  };
}

function parseAmountBreakdown(fieldsJson: JsonRecord | null) {
  const fields = asRecord(fieldsJson);
  const entries = Array.isArray(fields.amount_breakdown) ? fields.amount_breakdown : [];

  return entries.map((entry) => {
    const record = asRecord(entry);

    return {
      label: asString(record.label) ?? "Concepto",
      amount: asNumber(record.amount),
      tax_rate: asNumber(record.tax_rate),
      tax_code: asString(record.tax_code),
    } satisfies DocumentIntakeAmountBreakdown;
  });
}

function getOperationCategoryValue(draft: DraftRow, facts: DocumentIntakeFactMap) {
  const operationContext = asRecord(draft.operation_context_json);
  const explicitCategory = asString(operationContext.operation_category_candidate);

  if (explicitCategory) {
    return explicitCategory;
  }

  if (draft.document_role === "purchase") {
    return facts.purchase_category_candidate;
  }

  if (draft.document_role === "sale") {
    return facts.sale_category_candidate;
  }

  return null;
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

function buildDerivedDraftArtifacts(input: {
  draft: DraftRow;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  ruleSnapshot: RuleSnapshotRow | null;
  profileVersion: ProfileVersionRow | null;
}) {
  const operationCategory = getOperationCategoryValue(input.draft, input.facts);
  const taxTreatment = resolveUyVatTreatment({
    documentRole: input.draft.document_role,
    facts: input.facts,
    amountBreakdown: input.amountBreakdown,
    operationCategory,
    profile: buildOrganizationFiscalProfile(input.profileVersion),
    ruleSnapshot: buildRuleSnapshotContext(input.ruleSnapshot),
  });
  let journalSuggestion: ReviewJournalSuggestion;
  const journalSeed = taxTreatment.journalSeed;

  if (taxTreatment.ready && journalSeed) {
    if (input.draft.document_role === "purchase") {
      const lines: ReviewJournalLine[] = [
        {
          lineNumber: 1,
          accountCode: journalSeed.accountCode,
          accountName: journalSeed.accountName,
          debit:
            taxTreatment.vatBucket === "input_creditable"
              ? taxTreatment.taxableAmount
              : journalSeed.totalAmount,
          credit: 0,
          provenance: "uy_vat_engine",
        },
      ];

      if (taxTreatment.vatBucket === "input_creditable" && taxTreatment.taxAmount > 0) {
        lines.push({
          lineNumber: 2,
          accountCode: "1181",
          accountName: "IVA compras credito fiscal",
          debit: taxTreatment.taxAmount,
          credit: 0,
          provenance: "uy_vat_engine",
        });
      }

      lines.push({
        lineNumber: lines.length + 1,
        accountCode: journalSeed.counterpartyAccountCode,
        accountName: journalSeed.counterpartyAccountName,
        debit: 0,
        credit: journalSeed.totalAmount,
        provenance: "uy_vat_engine",
      });

      journalSuggestion = {
        ready: true,
        isBalanced: true,
        totalDebit: roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0)),
        totalCredit: roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0)),
        explanation: `Asiento sugerido desde motor IVA Uruguay para ${taxTreatment.label.toLowerCase()}.`,
        lines,
        blockingReasons: [],
      };
    } else if (input.draft.document_role === "sale") {
      const lines: ReviewJournalLine[] = [
        {
          lineNumber: 1,
          accountCode: journalSeed.counterpartyAccountCode,
          accountName: journalSeed.counterpartyAccountName,
          debit: journalSeed.totalAmount,
          credit: 0,
          provenance: "uy_vat_engine",
        },
        {
          lineNumber: 2,
          accountCode: journalSeed.accountCode,
          accountName: journalSeed.accountName,
          debit: 0,
          credit: taxTreatment.taxableAmount,
          provenance: "uy_vat_engine",
        },
      ];

      if (taxTreatment.taxAmount > 0) {
        lines.push({
          lineNumber: 3,
          accountCode: "2131",
          accountName: "IVA ventas debito fiscal",
          debit: 0,
          credit: taxTreatment.taxAmount,
          provenance: "uy_vat_engine",
        });
      }

      journalSuggestion = {
        ready: true,
        isBalanced: true,
        totalDebit: roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0)),
        totalCredit: roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0)),
        explanation: `Asiento sugerido desde motor IVA Uruguay para ${taxTreatment.label.toLowerCase()}.`,
        lines,
        blockingReasons: [],
      };
    } else {
      journalSuggestion = {
        ready: false,
        isBalanced: false,
        totalDebit: 0,
        totalCredit: 0,
        explanation: "No hay sugerencia contable automatica para documentos fuera de compra/venta en V1.",
        lines: [],
        blockingReasons: [...taxTreatment.blockingReasons],
      };
    }
  } else {
    journalSuggestion = {
      ready: false,
      isBalanced: false,
      totalDebit: 0,
      totalCredit: 0,
      explanation:
        "La sugerencia contable queda bloqueada hasta que el motor IVA deje el caso confirmable.",
      lines: [],
      blockingReasons: [...taxTreatment.blockingReasons],
    };
  }

  const validationBlockers = [
    ...taxTreatment.blockingReasons,
    ...journalSuggestion.blockingReasons,
  ].filter((value, index, array) => array.indexOf(value) === index);

  return {
    taxTreatment,
    journalSuggestion,
    validation: {
      canConfirm:
        validationBlockers.length === 0
        && journalSuggestion.isBalanced
        && journalSuggestion.totalDebit > 0,
      blockers: validationBlockers,
    },
  } satisfies DerivedDraftArtifacts;
}

function mapDraftSteps(input: {
  derived: DerivedDraftArtifacts;
  draft: DraftRow;
}) {
  return [
    {
      step_code: "identity",
      status: "draft_saved",
      last_saved_at: new Date().toISOString(),
      stale_reason: null,
      snapshot_json: {
        document_role: input.draft.document_role,
        document_type: input.draft.document_type,
      },
    },
    {
      step_code: "fields",
      status: "draft_saved",
      last_saved_at: new Date().toISOString(),
      stale_reason: null,
      snapshot_json: {
        facts: parseDraftFacts(input.draft.fields_json),
      },
    },
    {
      step_code: "amounts",
      status: "draft_saved",
      last_saved_at: new Date().toISOString(),
      stale_reason: null,
      snapshot_json: {
        amount_breakdown: parseAmountBreakdown(input.draft.fields_json),
      },
    },
    {
      step_code: "operation_context",
      status: "draft_saved",
      last_saved_at: new Date().toISOString(),
      stale_reason: null,
      snapshot_json: {
        operation_category_candidate: getOperationCategoryValue(
          input.draft,
          parseDraftFacts(input.draft.fields_json),
        ),
      },
    },
    {
      step_code: "journal",
      status: input.derived.journalSuggestion.ready ? "draft_saved" : "blocked",
      last_saved_at: new Date().toISOString(),
      stale_reason:
        input.derived.journalSuggestion.ready
          ? null
          : input.derived.journalSuggestion.blockingReasons.join(" "),
      snapshot_json: input.derived.journalSuggestion,
    },
    {
      step_code: "tax",
      status: input.derived.taxTreatment.ready ? "draft_saved" : "blocked",
      last_saved_at: new Date().toISOString(),
      stale_reason:
        input.derived.taxTreatment.ready
          ? null
          : input.derived.taxTreatment.blockingReasons.join(" "),
      snapshot_json: input.derived.taxTreatment,
    },
    {
      step_code: "confirmation",
      status: input.derived.validation.canConfirm ? "draft_saved" : "blocked",
      last_saved_at: new Date().toISOString(),
      stale_reason:
        input.derived.validation.canConfirm
          ? null
          : input.derived.validation.blockers.join(" "),
      snapshot_json: {
        can_confirm: input.derived.validation.canConfirm,
        blockers: input.derived.validation.blockers,
      },
    },
  ];
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
      "id, organization_id, document_id, processing_run_id, organization_rule_snapshot_id, revision_number, status, document_role, document_type, operation_context_json, fields_json, extracted_text, warnings_json, journal_suggestion_json, tax_treatment_json, source_confidence, created_at, updated_at, confirmed_at",
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
  derived: DerivedDraftArtifacts,
) {
  const stepRows = mapDraftSteps({
    draft,
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
  const nextDocumentStatus =
    document.status === "classified" || document.status === "classified_with_open_revision"
      ? document.status
      : "draft_ready";
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

  await upsertDraftStepSnapshots(supabase, draft, derived);

  const { error: documentError } = await supabase
    .from("documents")
    .update({
      direction: draft.document_role,
      document_type: draft.document_type,
      document_date: facts.document_date ?? document.document_date,
      status: nextDocumentStatus,
      current_draft_id: draft.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id);

  if (documentError) {
    throw new Error(documentError.message);
  }
}

async function loadMatchingChartAccounts(
  supabase: SupabaseClient,
  organizationId: string,
  codes: string[],
) {
  if (codes.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("code", codes);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as ChartAccountRow[] | null) ?? []);
}

async function loadActiveExtractionId(
  supabase: SupabaseClient,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("document_extractions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function createAccountingArtifacts(
  supabase: SupabaseClient,
  document: DocumentRow,
  draft: DraftRow,
  actorId: string | null,
  derived: DerivedDraftArtifacts,
) {
  const extractionId = await loadActiveExtractionId(supabase, document.id);
  const { data: suggestion, error: suggestionError } = await supabase
    .from("accounting_suggestions")
    .upsert(
      {
        organization_id: document.organization_id,
        document_id: document.id,
        extraction_id: extractionId,
        version_no: draft.revision_number,
        status: "approved",
        confidence: draft.source_confidence,
        explanation: derived.journalSuggestion.explanation,
        tax_treatment_json: derived.taxTreatment,
        rule_trace_json: derived.taxTreatment.deterministicRuleRefs,
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      },
      {
        onConflict: "document_id,version_no",
      },
    )
    .select("id")
    .limit(1)
    .single();

  if (suggestionError || !suggestion?.id) {
    throw new Error(suggestionError?.message ?? "No se pudo persistir la sugerencia contable.");
  }

  const journalLines = derived.journalSuggestion.lines;
  const matchingAccounts = await loadMatchingChartAccounts(
    supabase,
    document.organization_id,
    journalLines.map((line) => line.accountCode),
  );
  const accountLookup = new Map(matchingAccounts.map((account) => [account.code, account]));
  const missingCodes = journalLines
    .filter((line) => !accountLookup.has(line.accountCode))
    .map((line) => line.accountCode);
  const facts = parseDraftFacts(draft.fields_json);
  const documentDate =
    facts.document_date ?? document.document_date ?? new Date().toISOString().slice(0, 10);
  const referenceParts = [facts.series, facts.document_number].filter(Boolean);
  const reference = referenceParts.length > 0 ? referenceParts.join("-") : document.original_filename;
  const description = missingCodes.length > 0
    ? `${derived.journalSuggestion.explanation} Lineas pendientes por falta de plan de cuentas: ${missingCodes.join(", ")}.`
    : derived.journalSuggestion.explanation;
  const { data: journalEntry, error: journalEntryError } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: document.organization_id,
      source_document_id: document.id,
      source_suggestion_id: suggestion.id,
      entry_date: documentDate,
      status: "draft",
      currency_code: facts.currency_code ?? "UYU",
      reference,
      description,
      total_debit: derived.journalSuggestion.totalDebit,
      total_credit: derived.journalSuggestion.totalCredit,
      created_by: actorId,
    })
    .select("id")
    .limit(1)
    .single();

  if (journalEntryError || !journalEntry?.id) {
    throw new Error(journalEntryError?.message ?? "No se pudo crear el journal entry draft.");
  }

  const linePayload = journalLines
    .map((line) => ({
      line,
      account: accountLookup.get(line.accountCode) ?? null,
    }))
    .filter((entry) => entry.account !== null)
    .map((entry) => ({
      journal_entry_id: journalEntry.id,
      line_no: entry.line.lineNumber,
      account_id: entry.account?.id,
      debit: entry.line.debit,
      credit: entry.line.credit,
      description: entry.line.accountName,
      tax_tag: derived.taxTreatment.treatmentCode,
    }));

  if (linePayload.length > 0) {
    const { error: lineError } = await supabase
      .from("journal_entry_lines")
      .insert(linePayload);

    if (lineError) {
      throw new Error(lineError.message);
    }
  }

  return {
    suggestionId: suggestion.id as string,
    journalEntryId: journalEntry.id as string,
  };
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

  return Promise.all(rows.map(async (row) => ({
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
  const [{ profileVersion, ruleSnapshot }, steps, processingRun, revision, confirmations, documentView] =
    await Promise.all([
      loadRuleSnapshot(supabase, document, draft, input.actorId),
      loadDraftSteps(supabase, draft.id),
      loadProcessingRun(supabase, document, draft),
      loadRevision(supabase, draft),
      loadConfirmations(supabase, document.id),
      documentViewPromise,
    ]);
  const derived = buildDerivedDraftArtifacts({
    draft,
    facts,
    amountBreakdown,
    ruleSnapshot,
    profileVersion,
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
      documentRole: draft.document_role,
      documentType: draft.document_type ?? "",
      operationCategory: getOperationCategoryValue(draft, facts),
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
    canConfirm:
      ["owner", "admin", "accountant", "reviewer"].includes(input.userRole)
      && derived.validation.canConfirm
      && draft.status !== "confirmed",
    canReopen:
      ["owner", "admin"].includes(input.userRole)
      && (document.status === "classified" || draft.status === "confirmed"),
  } satisfies DocumentReviewPageData;
}

export async function saveDraftReview(input: SaveDraftReviewInput) {
  const supabase = getSupabaseServiceRoleClient();
  const normalized = normalizeDraftPatch(input.payload);
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const draft = await loadCurrentDraft(supabase, document);
  const facts = mergeFacts(parseDraftFacts(draft.fields_json), normalized.facts);
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
      facts,
      amount_breakdown: parseAmountBreakdown(draft.fields_json),
    },
  };
  const { profileVersion, ruleSnapshot } = await loadRuleSnapshot(
    supabase,
    document,
    nextDraft,
    input.actorId,
  );
  const derived = buildDerivedDraftArtifacts({
    draft: nextDraft,
    facts,
    amountBreakdown: parseAmountBreakdown(nextDraft.fields_json),
    ruleSnapshot,
    profileVersion,
  });

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
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const draft = await loadCurrentDraft(supabase, document);
  const facts = parseDraftFacts(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const { profileVersion, ruleSnapshot } = await loadRuleSnapshot(
    supabase,
    document,
    draft,
    input.actorId,
  );
  const derived = buildDerivedDraftArtifacts({
    draft,
    facts,
    amountBreakdown,
    ruleSnapshot,
    profileVersion,
  });

  if (!derived.validation.canConfirm) {
    return {
      ok: false,
      message: derived.validation.blockers.join(" "),
    };
  }

  await persistDraftArtifacts(supabase, document, draft, input.actorId, derived);
  const accountingArtifacts = await createAccountingArtifacts(
    supabase,
    document,
    draft,
    input.actorId,
    derived,
  );
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

export async function reopenDocumentReview(input: {
  organizationId: string;
  documentId: string;
  actorId: string | null;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const document = await loadDocumentRow(supabase, input.organizationId, input.documentId);
  const currentDraft = await loadCurrentDraft(supabase, document);

  if (document.status === "classified_with_open_revision" && currentDraft.status !== "confirmed") {
    return {
      ok: true,
      message: "El documento ya tiene una revision abierta.",
    };
  }

  if (currentDraft.status !== "confirmed") {
    throw new Error("Solo se puede reabrir desde una revision confirmada.");
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
      "id, organization_id, document_id, processing_run_id, organization_rule_snapshot_id, revision_number, status, document_role, document_type, operation_context_json, fields_json, extracted_text, warnings_json, journal_suggestion_json, tax_treatment_json, source_confidence, created_at, updated_at, confirmed_at",
    )
    .limit(1)
    .single();

  if (insertDraftError || !insertedDraft) {
    throw new Error(insertDraftError?.message ?? "No se pudo clonar el draft confirmado.");
  }

  const newDraft = insertedDraft as DraftRow;
  const { error: stepsError } = await supabase
    .from("document_draft_steps")
    .insert([
      {
        draft_id: newDraft.id,
        step_code: "identity",
        status: "draft_saved",
        last_saved_at: reopenedAt,
      },
      {
        draft_id: newDraft.id,
        step_code: "fields",
        status: "draft_saved",
        last_saved_at: reopenedAt,
      },
      {
        draft_id: newDraft.id,
        step_code: "amounts",
        status: "draft_saved",
        last_saved_at: reopenedAt,
      },
      {
        draft_id: newDraft.id,
        step_code: "operation_context",
        status: "draft_saved",
        last_saved_at: reopenedAt,
      },
      {
        draft_id: newDraft.id,
        step_code: "journal",
        status: "draft_saved",
        last_saved_at: reopenedAt,
        snapshot_json: asRecord(currentDraft.journal_suggestion_json),
      },
      {
        draft_id: newDraft.id,
        step_code: "tax",
        status: "draft_saved",
        last_saved_at: reopenedAt,
        snapshot_json: asRecord(currentDraft.tax_treatment_json),
      },
      {
        draft_id: newDraft.id,
        step_code: "confirmation",
        status: "blocked",
        last_saved_at: reopenedAt,
        stale_reason: "reopen_requires_reconfirmation",
      },
    ]);

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
