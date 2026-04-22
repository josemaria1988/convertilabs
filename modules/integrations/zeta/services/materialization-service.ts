import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  normalizeDocumentNumber,
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting";
import { documentsStorageBucket } from "@/modules/documents/upload";
import {
  integrationTables,
  linkDocumentSourceRef,
  recordIntegrationAuditEvent,
  upsertIntegrationEntityLink,
} from "@/modules/integrations/repository";
import {
  buildZetaReceivedCfeIdentityKey,
} from "@/modules/integrations/zeta/normalizers/received-cfe";
import {
  buildZetaSalesInvoiceIdentityKey,
} from "@/modules/integrations/zeta/normalizers/sales";
import type { ZetaCanonicalDocument } from "@/modules/integrations/zeta/normalizers/common";

type ExistingSourceRefRow = {
  id: string;
  document_id: string;
  current_payload_hash: string | null;
  payload_hash_at_materialization: string | null;
  drift_status: string;
};

type ExistingDocumentRow = {
  id: string;
  status: string;
  posting_status: string | null;
  current_draft_id: string | null;
};

type OrganizationIdentityRow = {
  id: string;
  name: string;
  tax_id: string | null;
  tax_id_normalized?: string | null;
};

export type ZetaMaterializationResult = {
  status:
    | "materialized"
    | "skipped_unchanged"
    | "skipped_duplicate"
    | "source_changed_pending_review";
  documentId: string | null;
  draftId: string | null;
  warnings: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizePathFragment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "zeta-document";
}

function sourceKindToStorageFolder(sourceKind: ZetaCanonicalDocument["sourceKind"]) {
  return sourceKind === "zeta_sales" ? "sales" : "received-cfes";
}

function isFinalOrLocked(document: ExistingDocumentRow | null) {
  return Boolean(
    document
    && (
      document.posting_status === "posted_final"
      || document.posting_status === "locked"
      || document.status === "approved"
      || document.status === "archived"
    ),
  );
}

function toNumberOrNull(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function functionalRate(input: ZetaCanonicalDocument) {
  if (input.currency.currencyCode === "UYU") {
    return 1;
  }

  return input.currency.sourceRate && input.currency.sourceRate > 0
    ? input.currency.sourceRate
    : null;
}

function convertToUyu(amount: number | null, rate: number | null) {
  if (typeof amount !== "number" || typeof rate !== "number") {
    return null;
  }

  return roundCurrency(amount * rate);
}

function isVatReady(input: ZetaCanonicalDocument) {
  return Boolean(
    input.issueDate
    && input.currency.currencyCode
    && typeof input.amounts.net === "number"
    && typeof input.amounts.tax === "number"
    && typeof input.amounts.total === "number"
    && functionalRate(input),
  );
}

function buildTaxTreatment(input: {
  document: ZetaCanonicalDocument;
  netUyu: number | null;
  taxUyu: number | null;
  totalUyu: number | null;
  ready: boolean;
}) {
  const vatBucket = input.document.documentRole === "sale"
    ? "output_vat"
    : "input_vat_creditable";

  return {
    ready: input.ready,
    vat_bucket: vatBucket,
    taxable_amount_uyu: input.netUyu,
    tax_amount_uyu: input.taxUyu,
    total_amount_uyu: input.totalUyu,
    source: "zetasoftware_structured",
    warnings: input.document.warnings,
    blockingReasons: input.ready ? [] : input.document.warnings,
  };
}

function buildAmountBreakdown(input: ZetaCanonicalDocument) {
  return input.taxBreakdown.map((entry) => ({
    label: entry.label,
    amount: entry.netAmount,
    tax_rate: entry.taxRate,
    tax_code: entry.taxCode,
  }));
}

function buildSourceTaxBreakdown(input: ZetaCanonicalDocument) {
  return input.taxBreakdown.map((entry) => ({
    label: entry.label,
    net_amount: entry.netAmount,
    tax_rate: entry.taxRate,
    tax_amount: entry.taxAmount,
    total_amount: entry.totalAmount,
    tax_code: entry.taxCode,
    source: entry.source,
  }));
}

function buildFieldsJson(input: {
  document: ZetaCanonicalDocument;
  organization: OrganizationIdentityRow;
}) {
  const isSale = input.document.documentRole === "sale";

  return {
    facts: {
      issuer_name: isSale ? input.organization.name : input.document.counterparty.legalName ?? input.document.counterparty.name,
      issuer_tax_id: isSale ? input.organization.tax_id : input.document.counterparty.taxId,
      receiver_name: isSale ? input.document.counterparty.legalName ?? input.document.counterparty.name : input.organization.name,
      receiver_tax_id: isSale ? input.document.counterparty.taxId : input.organization.tax_id,
      document_number: input.document.number,
      series: input.document.series,
      document_type: input.document.documentType,
      cfe_type: input.document.cfe.typeCode,
      currency_code: input.document.currency.currencyCode,
      document_date: input.document.issueDate,
      due_date: input.document.dueDate,
      subtotal: input.document.amounts.net,
      tax_amount: input.document.amounts.tax,
      total_amount: input.document.amounts.total,
      zeta_external_key: input.document.externalKey,
      zeta_human_key: input.document.humanKey,
      zeta_local_code: input.document.localCode,
      zeta_reference: input.document.reference,
      purchase_category_candidate: isSale ? null : "zeta_received_cfe",
      sale_category_candidate: isSale ? "zeta_sales" : null,
    },
    amount_breakdown: buildAmountBreakdown(input.document),
    source_tax_breakdown: buildSourceTaxBreakdown(input.document),
    source_amounts: {
      provider: "zetasoftware",
      source_kind: input.document.sourceKind,
      total_payable: input.document.amounts.total,
      tax_amount: input.document.amounts.tax,
      net_amount: input.document.amounts.net,
      currency_code: input.document.currency.currencyCode,
      source: input.document.sourceKind === "zeta_received_cfe"
        ? "RESTCFEsRecibidosV1CFERecibidoDetalle.Totales"
        : "RESTFacturaClienteV4VentaDetallada",
    },
    source: {
      provider: "zetasoftware",
      source_kind: input.document.sourceKind,
      external_key: input.document.externalKey,
      payload_hash: input.document.payloadHash,
      factual_trust_mode: "external_deterministic",
    },
  };
}

function buildExtractedText(input: ZetaCanonicalDocument) {
  const counterparty = input.counterparty.legalName ?? input.counterparty.name ?? "contraparte sin nombre";
  const documentLabel = [input.series, input.number].filter(Boolean).join("-");

  return [
    input.documentRole === "sale"
      ? "Documento de venta importado desde Zetasoftware."
      : "CFE recibido importado desde Zetasoftware.",
    input.issueDate ? `Fecha: ${input.issueDate}.` : null,
    documentLabel ? `Comprobante: ${documentLabel}.` : null,
    `Contraparte: ${counterparty}.`,
    input.currency.currencyCode ? `Moneda: ${input.currency.currencyCode}.` : null,
    typeof input.amounts.total === "number" ? `Total: ${input.amounts.total}.` : null,
    `Lineas: ${input.lines.length}.`,
  ].filter(Boolean).join(" ");
}

function buildIdentityKey(input: {
  document: ZetaCanonicalDocument;
  organization: OrganizationIdentityRow;
}) {
  if (input.document.documentRole === "sale") {
    return buildZetaSalesInvoiceIdentityKey(input.document, input.organization.tax_id);
  }

  return buildZetaReceivedCfeIdentityKey(input.document);
}

async function loadOrganizationIdentity(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, tax_id, tax_id_normalized")
    .eq("id", organizationId)
    .limit(1)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as OrganizationIdentityRow;
}

async function loadExistingSourceRef(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    sourceKind: string;
    externalKey: string;
  },
) {
  const { data, error } = await supabase
    .from(integrationTables.documentSourceRefs)
    .select("id, document_id, current_payload_hash, payload_hash_at_materialization, drift_status")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("source_kind", input.sourceKind)
    .eq("external_key", input.externalKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ExistingSourceRefRow | null) ?? null;
}

async function loadDocument(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    documentId: string;
  },
) {
  const { data, error } = await supabase
    .from("documents")
    .select("id, status, posting_status, current_draft_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ExistingDocumentRow | null) ?? null;
}

async function markSourceChanged(
  supabase: SupabaseClient,
  input: {
    sourceRef: ExistingSourceRefRow;
    organizationId: string;
    payloadHash: string;
    rawRecordId: string;
    syncRunId: string;
    warnings: string[];
  },
) {
  const { error } = await supabase
    .from(integrationTables.documentSourceRefs)
    .update({
      raw_record_id: input.rawRecordId,
      sync_run_id: input.syncRunId,
      current_payload_hash: input.payloadHash,
      drift_status: "changed_pending_review",
      metadata_json: {
        warnings: input.warnings,
        source_change_pending_review: true,
      },
      updated_at: nowIso(),
    })
    .eq("id", input.sourceRef.id)
    .eq("organization_id", input.organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

async function findDuplicateIdentity(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    identityKey: string;
  },
) {
  const { data, error } = await supabase
    .from("document_invoice_identities")
    .select("document_id, duplicate_status")
    .eq("organization_id", input.organizationId)
    .eq("invoice_identity_key", input.identityKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { document_id: string; duplicate_status: string | null } | null) ?? null;
}

function buildExternalPartyKey(input: ZetaCanonicalDocument) {
  const external = input.counterparty.externalCode
    ?? input.counterparty.taxIdNormalized
    ?? normalizeTextToken(input.counterparty.legalName ?? input.counterparty.name);

  return external ? `${input.counterparty.role}:${external}` : null;
}

async function resolvePartyShell(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    document: ZetaCanonicalDocument;
    syncRunId: string;
  },
) {
  const externalKey = buildExternalPartyKey(input.document);

  if (!externalKey) {
    return null;
  }

  const linked = await supabase
    .from(integrationTables.entityLinks)
    .select("local_entity_id")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("external_entity_type", input.document.counterparty.role)
    .eq("external_key", externalKey)
    .limit(1)
    .maybeSingle();

  if (linked.error) {
    throw new Error(linked.error.message);
  }

  const linkedId = (linked.data as { local_entity_id?: string } | null)?.local_entity_id;

  if (linkedId) {
    return linkedId;
  }

  const taxIdNormalized = input.document.counterparty.taxIdNormalized
    ?? normalizeTaxId(input.document.counterparty.taxId);
  let partyId: string | null = null;

  if (taxIdNormalized) {
    const existing = await supabase
      .from("parties")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("tax_id_normalized", taxIdNormalized)
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    partyId = (existing.data as { id?: string } | null)?.id ?? null;
  }

  if (!partyId) {
    const legalName =
      input.document.counterparty.legalName
      ?? input.document.counterparty.name
      ?? input.document.counterparty.externalCode
      ?? "Contraparte Zetasoftware sin nombre";
    const inserted = await supabase
      .from("parties")
      .insert({
        organization_id: input.organizationId,
        party_kind: "external",
        legal_name: legalName,
        display_name: input.document.counterparty.name ?? legalName,
        tax_id: input.document.counterparty.taxId,
        tax_id_normalized: taxIdNormalized,
        metadata: {
          integration_provider: "zetasoftware",
          integration_status: "external_unreviewed",
          zeta_external_key: externalKey,
          zeta_counterparty_role: input.document.counterparty.role,
        },
      })
      .select("id")
      .limit(1)
      .single();

    if (inserted.error) {
      if (!taxIdNormalized) {
        throw new Error(inserted.error.message);
      }

      const retry = await supabase
        .from("parties")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("tax_id_normalized", taxIdNormalized)
        .limit(1)
        .single();

      if (retry.error) {
        throw new Error(inserted.error.message);
      }

      partyId = (retry.data as { id: string }).id;
    } else {
      partyId = (inserted.data as { id: string }).id;
    }
  }

  await upsertIntegrationEntityLink(supabase, {
    organizationId: input.organizationId,
    provider: "zetasoftware",
    externalEntityType: input.document.counterparty.role,
    externalKey,
    localEntityType: "party",
    localEntityId: partyId,
    matchMethod: taxIdNormalized ? "rut_exact_or_created_shell" : "created_shell",
    confidence: taxIdNormalized ? 0.98 : 0.74,
    createdByRunId: input.syncRunId,
    metadata: {
      counterparty_name: input.document.counterparty.name,
      counterparty_tax_id: input.document.counterparty.taxId,
    },
  });

  return partyId;
}

async function insertDraftSteps(
  supabase: SupabaseClient,
  input: {
    draftId: string;
    ready: boolean;
    warnings: string[];
  },
) {
  const now = nowIso();
  const factualStatus = input.ready ? "draft_saved" : "blocked";
  const rows = [
    "identity",
    "fields",
    "amounts",
    "operation_context",
    "accounting_context",
    "tax",
  ].map((stepCode) => ({
    draft_id: input.draftId,
    step_code: stepCode,
    status: stepCode === "accounting_context" ? "not_started" : factualStatus,
    last_saved_at: factualStatus === "draft_saved" ? now : null,
    stale_reason: input.ready ? null : input.warnings.join(" | "),
    snapshot_json: {
      source: "zetasoftware_structured",
      warnings: input.warnings,
    },
  }));

  const { error } = await supabase
    .from("document_draft_steps")
    .upsert(rows, { onConflict: "draft_id,step_code" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function materializeZetaDocument(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId?: string | null;
    syncRunId: string;
    rawRecordId: string;
    document: ZetaCanonicalDocument;
  },
): Promise<ZetaMaterializationResult> {
  const existingSource = await loadExistingSourceRef(supabase, {
    organizationId: input.organizationId,
    sourceKind: input.document.sourceKind,
    externalKey: input.document.externalKey,
  });

  if (existingSource) {
    const existingDocument = await loadDocument(supabase, {
      organizationId: input.organizationId,
      documentId: existingSource.document_id,
    });

    if (existingSource.current_payload_hash === input.document.payloadHash) {
      return {
        status: "skipped_unchanged",
        documentId: existingSource.document_id,
        draftId: existingDocument?.current_draft_id ?? null,
        warnings: input.document.warnings,
      };
    }

    await markSourceChanged(supabase, {
      sourceRef: existingSource,
      organizationId: input.organizationId,
      payloadHash: input.document.payloadHash,
      rawRecordId: input.rawRecordId,
      syncRunId: input.syncRunId,
      warnings: input.document.warnings,
    });

    return {
      status: "source_changed_pending_review",
      documentId: existingSource.document_id,
      draftId: existingDocument?.current_draft_id ?? null,
      warnings: [
        ...input.document.warnings,
        isFinalOrLocked(existingDocument)
          ? "El origen Zeta cambio, pero el documento local esta finalizado o bloqueado."
          : "El origen Zeta cambio y queda pendiente de revision.",
      ],
    };
  }

  const organization = await loadOrganizationIdentity(supabase, input.organizationId);
  const identityKey = buildIdentityKey({
    document: input.document,
    organization,
  });
  const duplicate = await findDuplicateIdentity(supabase, {
    organizationId: input.organizationId,
    identityKey,
  });

  if (duplicate) {
    await linkDocumentSourceRef(supabase, {
      organizationId: input.organizationId,
      documentId: duplicate.document_id,
      provider: "zetasoftware",
      sourceKind: input.document.sourceKind,
      externalKey: input.document.externalKey,
      rawRecordId: input.rawRecordId,
      syncRunId: input.syncRunId,
      payloadHashAtMaterialization: input.document.payloadHash,
      currentPayloadHash: input.document.payloadHash,
      driftStatus: "none",
      sourcePdfUrl: input.document.sourcePdfUrl,
      bandejaCompatibility: {
        identity_key: identityKey,
        zeta_human_key: input.document.humanKey,
        linked_as_duplicate_source: true,
      },
      metadata: {
        duplicate_status: duplicate.duplicate_status,
      },
    });

    await recordIntegrationAuditEvent(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      entityType: "document",
      entityId: duplicate.document_id,
      action: "zeta_document_duplicate_skipped",
      metadata: {
        source_kind: input.document.sourceKind,
        external_key: input.document.externalKey,
        identity_key: identityKey,
      },
    });

    return {
      status: "skipped_duplicate",
      documentId: duplicate.document_id,
      draftId: null,
      warnings: input.document.warnings,
    };
  }

  const partyId = await resolvePartyShell(supabase, {
    organizationId: input.organizationId,
    document: input.document,
    syncRunId: input.syncRunId,
  });
  const rate = functionalRate(input.document);
  const netUyu = convertToUyu(input.document.amounts.net, rate);
  const taxUyu = convertToUyu(input.document.amounts.tax, rate);
  const totalUyu = convertToUyu(input.document.amounts.total, rate);
  const ready = isVatReady(input.document);
  const documentId = randomUUID();
  const originalFilename = `${input.document.documentRole === "sale" ? "venta" : "cfe-recibido"}-${sanitizePathFragment(input.document.humanKey)}.json`;
  const storagePath = [
    "external",
    "zetasoftware",
    input.organizationId,
    sourceKindToStorageFolder(input.document.sourceKind),
    `${sanitizePathFragment(input.document.externalKey)}.json`,
  ].join("/");
  const metadata = {
    integration_provider: "zetasoftware",
    integration_source_kind: input.document.sourceKind,
    integration_external_key: input.document.externalKey,
    integration_sync_run_id: input.syncRunId,
    integration_raw_record_id: input.rawRecordId,
    zeta_payload_hash: input.document.payloadHash,
    zeta_human_key: input.document.humanKey,
    zeta_party_id: partyId,
    zeta_party_resolution_status: partyId ? "party_shell_or_match" : "unresolved",
    factual_trust_mode: "external_deterministic",
    binary_available: Boolean(input.document.sourcePdfUrl),
    operation_code: input.document.operationCode,
    source_change_pending_review: false,
    warnings: input.document.warnings,
  };
  const insertedDocument = await supabase
    .from("documents")
    .insert({
      id: documentId,
      organization_id: input.organizationId,
      direction: input.document.documentRole,
      document_type: input.document.documentType,
      status: ready ? "draft_ready" : "needs_review",
      posting_status: ready ? "vat_ready" : "draft",
      storage_bucket: documentsStorageBucket,
      storage_path: storagePath,
      original_filename: originalFilename,
      mime_type: "application/json",
      upload_source: "integration",
      source_type: "zeta_api",
      source_reference: input.document.externalKey,
      external_reference: input.document.humanKey,
      uploaded_by: input.actorUserId ?? null,
      document_date: input.document.issueDate,
      document_currency_code: input.document.currency.currencyCode,
      document_net_amount_original: toNumberOrNull(input.document.amounts.net),
      document_tax_amount_original: toNumberOrNull(input.document.amounts.tax),
      document_total_amount_original: toNumberOrNull(input.document.amounts.total),
      net_amount_uyu: netUyu,
      tax_amount_uyu: taxUyu,
      total_amount_uyu: totalUyu,
      fx_rate_document_value: rate,
      fx_rate_document_date: input.document.currency.sourceRateDate,
      fx_rate_source: input.document.currency.sourceRateKind,
      metadata,
    })
    .select("id")
    .limit(1)
    .single();

  if (insertedDocument.error) {
    throw new Error(insertedDocument.error.message);
  }

  const draft = await supabase
    .from("document_drafts")
    .insert({
      organization_id: input.organizationId,
      document_id: documentId,
      revision_number: 1,
      status: ready ? "ready_for_confirmation" : "open",
      document_role: input.document.documentRole,
      document_type: input.document.documentType,
      operation_context_json: {
        source: "zetasoftware",
        reference: input.document.reference,
        local_code: input.document.localCode,
        cost_center_external_code: input.document.costCenterExternalCode,
      },
      fields_json: buildFieldsJson({
        document: input.document,
        organization,
      }),
      extracted_text: buildExtractedText(input.document),
      warnings_json: input.document.warnings,
      tax_treatment_json: buildTaxTreatment({
        document: input.document,
        netUyu,
        taxUyu,
        totalUyu,
        ready,
      }),
      source_confidence: ready ? 0.98 : 0.78,
      created_by: input.actorUserId ?? null,
      updated_by: input.actorUserId ?? null,
    })
    .select("id")
    .limit(1)
    .single();

  if (draft.error) {
    throw new Error(draft.error.message);
  }

  const draftId = (draft.data as { id: string }).id;
  const lineRows = input.document.lines.map((line) => ({
    organization_id: input.organizationId,
    document_id: documentId,
    draft_id: draftId,
    line_number: line.lineNumber,
    raw_concept_code: line.conceptCode,
    raw_concept_description: line.description,
    normalized_concept_code: normalizeDocumentNumber(line.conceptCode),
    normalized_concept_description: normalizeTextToken(line.description),
    net_amount: line.netAmount,
    tax_rate: line.taxRate,
    tax_amount: line.taxAmount,
    total_amount: line.totalAmount,
    match_strategy: "zeta_structured_unmatched",
    match_confidence: 0,
    requires_user_context: false,
    metadata: {
      ...line.metadata,
      integration_provider: "zetasoftware",
      source_kind: input.document.sourceKind,
    },
  }));

  if (lineRows.length > 0) {
    const { error: lineError } = await supabase
      .from("document_line_items")
      .insert(lineRows);

    if (lineError) {
      throw new Error(lineError.message);
    }
  }

  await insertDraftSteps(supabase, {
    draftId,
    ready,
    warnings: input.document.warnings,
  });

  const identityInsert = await supabase
    .from("document_invoice_identities")
    .insert({
      organization_id: input.organizationId,
      document_id: documentId,
      source_draft_id: draftId,
      issuer_tax_id_normalized: input.document.documentRole === "sale"
        ? normalizeTaxId(organization.tax_id)
        : input.document.counterparty.taxIdNormalized,
      issuer_name_normalized: input.document.documentRole === "sale"
        ? normalizeTextToken(organization.name)
        : normalizeTextToken(input.document.counterparty.legalName ?? input.document.counterparty.name),
      document_number_normalized: normalizeDocumentNumber(
        [input.document.series, input.document.number].filter(Boolean).join("-"),
      ),
      document_date: input.document.issueDate,
      total_amount: input.document.amounts.total,
      currency_code: input.document.currency.currencyCode,
      identity_strategy: "zeta_external_structured",
      invoice_identity_key: identityKey,
      duplicate_status: "clear",
    });

  if (identityInsert.error) {
    throw new Error(identityInsert.error.message);
  }

  const updateDocument = await supabase
    .from("documents")
    .update({
      current_draft_id: draftId,
      vat_ready_at: ready ? nowIso() : null,
      updated_at: nowIso(),
    })
    .eq("id", documentId)
    .eq("organization_id", input.organizationId);

  if (updateDocument.error) {
    throw new Error(updateDocument.error.message);
  }

  await linkDocumentSourceRef(supabase, {
    organizationId: input.organizationId,
    documentId,
    provider: "zetasoftware",
    sourceKind: input.document.sourceKind,
    externalKey: input.document.externalKey,
    rawRecordId: input.rawRecordId,
    syncRunId: input.syncRunId,
    payloadHashAtMaterialization: input.document.payloadHash,
    currentPayloadHash: input.document.payloadHash,
    driftStatus: "none",
    sourcePdfUrl: input.document.sourcePdfUrl,
    bandejaCompatibility: {
      identity_key: identityKey,
      document_role: input.document.documentRole,
      document_type: input.document.documentType,
      issue_date: input.document.issueDate,
      currency_code: input.document.currency.currencyCode,
      source_rate: input.document.currency.sourceRate,
      counterparty_tax_id: input.document.counterparty.taxId,
      counterparty_name: input.document.counterparty.legalName ?? input.document.counterparty.name,
      local_code: input.document.localCode,
      reference: input.document.reference,
      line_count: input.document.lines.length,
    },
    metadata: {
      party_id: partyId,
      ready_for_vat: ready,
      warnings: input.document.warnings,
    },
  });

  await recordIntegrationAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    entityType: "document",
    entityId: documentId,
    action: "zeta_document_materialized",
    afterJson: {
      source_kind: input.document.sourceKind,
      external_key: input.document.externalKey,
      document_role: input.document.documentRole,
      posting_status: ready ? "vat_ready" : "draft",
    },
    metadata: {
      provider: "zetasoftware",
      sync_run_id: input.syncRunId,
      raw_record_id: input.rawRecordId,
    },
  });

  return {
    status: "materialized",
    documentId,
    draftId,
    warnings: input.document.warnings,
  };
}
