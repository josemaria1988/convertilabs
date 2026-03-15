import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asRecord,
  asString,
  buildInvoiceIdentityResult,
  getOperationCategoryValue,
  loadDocumentInvoiceIdentity,
  parseAmountBreakdown,
  parseDraftFacts,
  parseLineItems,
  type DocumentIntakeAmountBreakdown,
  type DocumentIntakeFactMap,
  type DocumentIntakeLineItem,
  type DocumentPostingStatus,
  type InvoiceIdentityResult,
  type JsonRecord,
  type OrganizationFiscalProfile,
  type OrganizationRuleSnapshotContext,
} from "@/modules/accounting";
import { materializeOrganizationRuleSnapshot } from "@/modules/organizations/rule-snapshots";
import type { DocumentDirection } from "@/modules/documents/status";

export type ReviewContextDocumentRow = {
  id: string;
  organization_id: string;
  direction: DocumentDirection;
  document_type: string | null;
  status: string;
  posting_status: DocumentPostingStatus | null;
  original_filename: string;
  document_date: string | null;
  metadata: JsonRecord | null;
  current_draft_id: string | null;
  last_rule_snapshot_id: string | null;
};

export type ReviewContextDraftRow = {
  id: string;
  organization_id: string;
  document_id: string;
  processing_run_id: string | null;
  organization_rule_snapshot_id: string | null;
  revision_number: number;
  status: string;
  document_role: "purchase" | "sale" | "other";
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
  profile_json: JsonRecord | null;
};

export type LoadedReviewDocumentContext = {
  document: ReviewContextDocumentRow;
  draft: ReviewContextDraftRow;
  facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[];
  lineItems: DocumentIntakeLineItem[];
  operationCategory: string | null;
  profile: OrganizationFiscalProfile | null;
  ruleSnapshot: OrganizationRuleSnapshotContext | null;
  profileVersion: ProfileVersionRow | null;
  rawRuleSnapshot: RuleSnapshotRow | null;
  invoiceIdentity: InvoiceIdentityResult | null;
};

function parseRuleSnapshotRefs(value: unknown) {
  const refs = Array.isArray(value) ? value : [];

  return refs.slice(0, 8).map((entry) => {
    const record = asRecord(entry);

    return {
      id: asString(record.id),
      scope: asString(record.scope),
      priority: typeof record.priority === "number" ? record.priority : null,
      sourceReference: asString(record.source_reference),
    };
  });
}

export function buildOrganizationFiscalProfileFromVersion(
  profileVersion: ProfileVersionRow | null,
): OrganizationFiscalProfile | null {
  if (!profileVersion) {
    return null;
  }

  const profileJson = asRecord(profileVersion.profile_json);

  return {
    countryCode: profileVersion.country_code,
    legalEntityType: profileVersion.legal_entity_type,
    taxRegimeCode: profileVersion.tax_regime_code,
    vatRegime: profileVersion.vat_regime,
    dgiGroup: profileVersion.dgi_group,
    cfeStatus: profileVersion.cfe_status,
    taxId: profileVersion.tax_id,
    fiscalAddressText: asString(profileJson.fiscal_address_text),
    fiscalDepartment: asString(profileJson.fiscal_department),
    fiscalCity: asString(profileJson.fiscal_city),
    locationRiskPolicy:
      (asString(profileJson.location_risk_policy) as OrganizationFiscalProfile["locationRiskPolicy"])
      ?? "warn_and_require_note",
    travelRadiusKmPolicy:
      typeof profileJson.travel_radius_km_policy === "number"
        ? profileJson.travel_radius_km_policy
        : null,
  };
}

export function buildRuleSnapshotContextFromRow(
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
    deterministicRuleRefs: parseRuleSnapshotRefs(ruleSnapshot.deterministic_rule_refs_json),
  };
}

async function loadDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, organization_id, direction, document_type, status, posting_status, original_filename, document_date, metadata, current_draft_id, last_rule_snapshot_id",
    )
    .eq("organization_id", organizationId)
    .eq("id", documentId)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return data as ReviewContextDocumentRow;
}

async function loadCurrentDraft(
  supabase: SupabaseClient,
  document: ReviewContextDocumentRow,
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

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Documento sin draft persistido.");
  }

  return data as ReviewContextDraftRow;
}

async function loadRuleSnapshot(
  supabase: SupabaseClient,
  document: ReviewContextDocumentRow,
  draft: ReviewContextDraftRow,
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
        profile_json: asRecord(profileVersion.profile_json),
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
      } satisfies RuleSnapshotRow,
    };
  }

  const [{ data: profileVersion, error: profileError }, { data: ruleSnapshot, error: snapshotError }] =
    await Promise.all([
      supabase
        .from("organization_profile_versions")
        .select(
          "id, version_number, effective_from, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, country_code, tax_id, profile_json",
        )
        .eq("organization_id", document.organization_id)
        .eq("status", "active")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("organization_rule_snapshots")
        .select(
          "id, version_number, effective_from, legal_entity_type, tax_regime_code, vat_regime, dgi_group, cfe_status, prompt_summary, deterministic_rule_refs_json",
        )
        .eq("id", snapshotId)
        .limit(1)
        .maybeSingle(),
    ]);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  return {
    profileVersion: (profileVersion as ProfileVersionRow | null) ?? null,
    ruleSnapshot: (ruleSnapshot as RuleSnapshotRow | null) ?? null,
  };
}

export async function loadReviewDocumentContext(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
  actorId: string | null;
}) {
  const document = await loadDocument(input.supabase, input.organizationId, input.documentId);
  const draft = await loadCurrentDraft(input.supabase, document);
  const facts = parseDraftFacts(draft.fields_json);
  const amountBreakdown = parseAmountBreakdown(draft.fields_json);
  const lineItems = parseLineItems(draft.fields_json);
  const operationCategory = getOperationCategoryValue(draft, facts);
  const [{ profileVersion, ruleSnapshot }, persistedInvoiceIdentity] = await Promise.all([
    loadRuleSnapshot(input.supabase, document, draft, input.actorId),
    loadDocumentInvoiceIdentity(input.supabase, document.id),
  ]);
  const invoiceIdentity = buildInvoiceIdentityResult({
    facts,
    persistedDuplicateStatus: persistedInvoiceIdentity?.duplicate_status ?? null,
    persistedDuplicateOfDocumentId: persistedInvoiceIdentity?.duplicate_of_document_id ?? null,
    persistedDuplicateReason: persistedInvoiceIdentity?.duplicate_reason ?? null,
  });

  return {
    document,
    draft,
    facts,
    amountBreakdown,
    lineItems,
    operationCategory,
    profile: buildOrganizationFiscalProfileFromVersion(profileVersion),
    ruleSnapshot: buildRuleSnapshotContextFromRow(ruleSnapshot),
    profileVersion,
    rawRuleSnapshot: ruleSnapshot,
    invoiceIdentity,
  } satisfies LoadedReviewDocumentContext;
}
