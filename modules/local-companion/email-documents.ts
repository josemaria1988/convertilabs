import "server-only";
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCfeXml, maxCfeXmlBytes, type CfeXmlInvoice } from "@/modules/ingestion/cfe-xml";
import { buildDraftFieldsPayload, parseDraftFacts } from "@/modules/accounting/concept-resolution";
import { buildInvoiceIdentityResult } from "@/modules/accounting/invoice-identity";
import { normalizeTaxId } from "@/modules/accounting/normalization";
import { localDocumentId, ingestLocalDocument } from "./documents";
import { resolveLocalCompanionContext, localDocumentReviewUrl, type LocalCompanionDependencies } from "./context";
import type { EmailDownloadedAttachment, EmailIngestInput, EmailIngestResult, EmailMessageSource } from "./email-inbox";

type Dependencies = LocalCompanionDependencies & { ingest?: typeof ingestLocalDocument };
type DocumentRow = { id: string; status: string; current_draft_id: string | null; metadata: Record<string, unknown> | null };
type IdentityRow = { document_id: string; document_number_normalized: string | null; document_date: string | null;
  total_amount: number | string | null; currency_code: string | null };
const docColumns = "id,status,current_draft_id,metadata";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableId = (org: string, value: string) => localDocumentId(org, hash(`email-intake:v1:${value}`));
const provider = "email_inbox";

/** Only remove numeric padding after the series. SKU normalization is unrelated. */
export function normalizeCfeDocumentNumber(value: string | null) {
  const compact = String(value ?? "").toUpperCase().replace(/[\s\-/.]/g, "");
  const match = compact.match(/^([A-Z]{1,2})(\d{1,12})$/);
  return match ? `${match[1]}${BigInt(match[2]).toString()}` : null;
}
export function compareCfeIdentity(invoice: CfeXmlInvoice, identity: IdentityRow) {
  const equalAmount = identity.total_amount !== null && Number.isFinite(Number(identity.total_amount))
    && Math.abs(Number(identity.total_amount) - invoice.facts.total_amount!) < 0.005;
  return normalizeCfeDocumentNumber(identity.document_number_normalized) === normalizeCfeDocumentNumber(`${invoice.facts.series}${invoice.facts.document_number}`)
    && identity.document_date === invoice.facts.document_date && identity.currency_code?.toUpperCase() === invoice.facts.currency_code && equalAmount;
}

async function readAttachment(attachment: EmailDownloadedAttachment) {
  if (!path.isAbsolute(attachment.filePath) || !/^[a-f0-9]{64}$/.test(attachment.fileHash)) throw new Error("email_attachment_invalid");
  const handle = await open(attachment.filePath, "r");
  try {
    const stat = await handle.stat();
    const limit = /\.xml$/i.test(attachment.originalFilename) ? maxCfeXmlBytes : 20 * 1024 * 1024;
    if (!stat.isFile() || stat.size <= 0 || stat.size > limit) throw new Error("email_attachment_size_limit");
    const buffer = Buffer.alloc(stat.size + 1); const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    if (bytesRead !== stat.size || hash(bytes) !== attachment.fileHash) throw new Error("email_attachment_changed");
    return bytes;
  } finally { await handle.close(); }
}

async function insertImmutable(supabase: SupabaseClient, table: string, values: Record<string, unknown> | Record<string, unknown>[], conflict = "id") {
  const result = await supabase.from(table).upsert(values, { onConflict: conflict, ignoreDuplicates: true });
  if (result.error) throw new Error(`email_intake_${table}_persist_failed`);
}
async function loadDoc(supabase: SupabaseClient, org: string, id: string) {
  const result = await supabase.from("documents").select(docColumns).eq("organization_id", org).eq("id", id).maybeSingle();
  if (result.error) throw new Error("email_document_read_failed");
  return result.data as DocumentRow | null;
}
async function preserveRaw(supabase: SupabaseClient, org: string, attachment: EmailDownloadedAttachment, bytes: Buffer, message: EmailMessageSource) {
  const id = stableId(org, `raw:${attachment.fileHash}`);
  await insertImmutable(supabase, "integration_raw_records", {
    id, organization_id: org, provider, stream: "invoice_attachments", entity_type: "email_attachment",
    external_key: attachment.fileHash, payload_hash: attachment.fileHash,
    payload_json: { original_base64: bytes.toString("base64"), encoding: "base64", original_filename: attachment.originalFilename,
      mime_type: attachment.mimeType, byte_length: bytes.length },
    metadata_json: { source: message, original_sha256: attachment.fileHash, original_storage: "integration_raw_records",
      binary_in_storage_bucket: false },
  }, "organization_id,provider,entity_type,external_key");
  const result = await supabase.from("integration_raw_records").select("id,payload_hash").eq("organization_id", org)
    .eq("provider", provider).eq("entity_type", "email_attachment").eq("external_key", attachment.fileHash).maybeSingle();
  if (result.error || !result.data || result.data.payload_hash !== attachment.fileHash) throw new Error("email_original_not_confirmed");
  return String(result.data.id);
}
async function linkSource(supabase: SupabaseClient, input: { org: string; documentId: string; rawId: string | null;
  attachment: EmailDownloadedAttachment; message: EmailMessageSource; invoice?: CfeXmlInvoice; differences?: boolean }) {
  const messageKey = hash(JSON.stringify([input.message.mailboxAddress, input.message.mailbox, input.message.uidValidity, input.message.uid]));
  const key = `${input.invoice?.fiscalKey ?? "visual"}:${input.attachment.fileHash}:${messageKey}`;
  await insertImmutable(supabase, "document_source_refs", {
    id: stableId(input.org, `source:${key}`), organization_id: input.org, document_id: input.documentId,
    provider, source_kind: input.invoice ? "cfe_xml_email" : "email_attachment", raw_record_id: input.rawId,
    external_key: key, external_version_key: input.attachment.fileHash,
    payload_hash_at_materialization: input.attachment.fileHash, current_payload_hash: input.attachment.fileHash,
    drift_status: input.differences ? "source_changed_pending_review" : "none",
    factual_trust_mode: "external_deterministic",
    metadata_json: { message: input.message, original_filename: input.attachment.originalFilename,
      original_storage: input.rawId ? "integration_raw_records" : "document_storage",
      requires_review: true, signature_verified: false, differences_pending_review: Boolean(input.differences),
      ...(input.invoice ? { fiscal_key: input.invoice.fiscalKey, semantic_hash: input.invoice.semanticHash, parsed_cfe: input.invoice } : {}) },
  }, "organization_id,provider,source_kind,external_key");
  const checked = await supabase.from("document_source_refs").select("document_id").eq("organization_id", input.org)
    .eq("provider", provider).eq("source_kind", input.invoice ? "cfe_xml_email" : "email_attachment").eq("external_key", key).maybeSingle();
  if (checked.error || !checked.data || checked.data.document_id !== input.documentId) throw new Error("email_source_conflict");
}

async function materializeXml(supabase: SupabaseClient, input: EmailIngestInput, org: string, rawId: string,
  attachment: EmailDownloadedAttachment, invoice: CfeXmlInvoice): Promise<{ document: EmailIngestResult["documents"][number] | null; pending?: string }> {
  const identity = buildInvoiceIdentityResult({ facts: invoice.facts });
  const candidateResult = await supabase.from("document_invoice_identities")
    .select("document_id,document_number_normalized,document_date,total_amount,currency_code")
    .eq("organization_id", org).eq("issuer_tax_id_normalized", invoice.facts.issuer_tax_id!).limit(1001);
  if (candidateResult.error) throw new Error("email_identity_lookup_failed");
  if ((candidateResult.data ?? []).length > 1000) return { document: null, pending: "Demasiados candidatos del emisor; revisar identidad antes de crear otro documento." };
  const expectedNumber = normalizeCfeDocumentNumber(`${invoice.facts.series}${invoice.facts.document_number}`);
  const candidates = (candidateResult.data as IdentityRow[] ?? []).filter((row) => normalizeCfeDocumentNumber(row.document_number_normalized) === expectedNumber);
  const unique = [...new Map(candidates.map((candidate) => [candidate.document_id, candidate])).values()];
  if (unique.length > 1) return { document: null, pending: "Hay más de un documento con el mismo RUT y número; requiere resolver la duplicación existente." };
  const plannedId = stableId(org, `cfe:${invoice.fiscalKey}`);
  let document = unique.length ? await loadDoc(supabase, org, unique[0].document_id) : await loadDoc(supabase, org, plannedId);
  if (unique.length && !document) throw new Error("email_duplicate_document_missing");
  const summarize = (doc: DocumentRow, duplicate: boolean) => ({ documentId: doc.id, status: doc.status, duplicate,
    reviewUrl: localDocumentReviewUrl(input.slug, doc.id, input.appUrl), localAction: "review" });
  if (document && (document.id !== plannedId || document.current_draft_id || document.metadata?.email_semantic_hash !== invoice.semanticHash)) {
    let differences = (unique.length > 0 && !compareCfeIdentity(invoice, unique[0]))
      || (typeof document.metadata?.email_semantic_hash === "string" && document.metadata.email_semantic_hash !== invoice.semanticHash);
    if (document.current_draft_id) {
      const current = await supabase.from("document_drafts").select("fields_json").eq("organization_id", org)
        .eq("document_id", document.id).eq("id", document.current_draft_id).maybeSingle();
      if (current.error || !current.data) throw new Error("email_draft_compare_failed");
      const facts = parseDraftFacts(current.data.fields_json);
      // Existing human review is immutable here, including price-input confirmation.
      for (const key of ["subtotal", "tax_amount", "total_amount"] as const) {
        if (facts?.[key] === null || facts?.[key] === undefined || !Number.isFinite(Number(facts[key]))
          || Math.abs(Number(facts[key]) - invoice.facts[key]!) > 0.015) differences = true;
      }
    } else if (document.id !== plannedId) differences = true;
    await linkSource(supabase, { org, documentId: document.id, rawId, attachment, message: input.message, invoice, differences });
    return { document: summarize(document, true), ...(differences ? { pending: "El XML corresponde a un documento existente con diferencias o revisión incompleta; se conservó como evidencia sin cambiar el borrador." } : {}) };
  }
  if (!document) {
    await insertImmutable(supabase, "documents", {
      id: plannedId, organization_id: org, direction: "purchase", document_type: invoice.documentType, status: "uploading", posting_status: "draft",
      storage_bucket: "documents-private", storage_path: `external/email/${org}/${plannedId}.xml`,
      original_filename: `${invoice.facts.series}${invoice.facts.document_number}.xml`, mime_type: "application/xml",
      // An envelope can contain several invoices; its hash belongs to source evidence, not to each document's binary.
      source_attachment_hash: attachment.fileHash, source_message_id: input.message.messageId,
      upload_source: "integration", source_type: "email_inbox", source_reference: invoice.fiscalKey,
      uploaded_by: input.actorProfileId, document_date: invoice.facts.document_date,
      document_currency_code: invoice.facts.currency_code, document_net_amount_original: invoice.facts.subtotal,
      document_tax_amount_original: invoice.facts.tax_amount, document_total_amount_original: invoice.facts.total_amount,
      metadata: { processing_provider: "cfe_xml_local", source_surface: "email_inbox", email_fiscal_key: invoice.fiscalKey,
        email_semantic_hash: invoice.semanticHash, integration_raw_record_id: rawId, binary_available: false,
        original_storage: "integration_raw_records", review_required: true, signature_verified: false },
    });
    document = await loadDoc(supabase, org, plannedId);
    if (!document) throw new Error("email_document_reservation_failed");
    // The winner is re-read before creating any artifact. A different version cannot overwrite it.
    if (document.metadata?.email_semantic_hash !== invoice.semanticHash) {
      await linkSource(supabase, { org, documentId: document.id, rawId, attachment, message: input.message, invoice, differences: true });
      return { document: summarize(document, true), pending: "Otra copia reservó una versión diferente de este CFE; requiere revisión." };
    }
    if (document.current_draft_id) {
      await linkSource(supabase, { org, documentId: document.id, rawId, attachment, message: input.message, invoice });
      return { document: summarize(document, true) };
    }
  }
  const draftId = stableId(org, `draft:${plannedId}`);
  const fields = buildDraftFieldsPayload({ facts: invoice.facts, amountBreakdown: invoice.amountBreakdown, lineItems: invoice.lineItems });
  await insertImmutable(supabase, "document_drafts", {
    id: draftId, organization_id: org, document_id: plannedId, revision_number: 1, status: "open", document_role: "purchase", document_type: invoice.documentType,
    fields_json: fields, extracted_text: JSON.stringify({ facts: invoice.facts, lines: invoice.source.lines }, null, 2), warnings_json: invoice.warnings,
    operation_context_json: { source: "email_cfe_xml" },
    intake_context_json: { processing_provider: "cfe_xml_local", review_required: true, signature_verified: false,
      transaction_family_candidate: "purchase", document_subtype_candidate: invoice.documentType, cfe_xml: invoice.source,
      settlement_hints: { payment_terms: invoice.paymentTerms, settlement_method_explicit: "unknown",
        settlement_method_evidence_text: invoice.source.paymentEvidence.join("\n") || null,
        has_receipt_language: false, has_card_voucher_language: false, has_bank_transfer_reference: false } },
    source_confidence: 0.95, created_by: input.actorProfileId, updated_by: input.actorProfileId,
  });
  const steps = ["identity", "fields", "amounts", "operation_context", "accounting_context", "tax"].map((step) => ({
    draft_id: draftId, step_code: step,
    status: step === "amounts" && invoice.amountsRequireReview ? "blocked" : ["identity", "fields", "amounts"].includes(step) ? "draft_saved" : "not_started",
    snapshot_json: { source: "email_cfe_xml", review_required: true },
    stale_reason: step === "amounts" && invoice.amountsRequireReview ? invoice.warnings.join(" | ") : null,
  }));
  await insertImmutable(supabase, "document_draft_steps", steps, "draft_id,step_code");
  await insertImmutable(supabase, "document_invoice_identities", {
    id: stableId(org, `identity:${plannedId}`), organization_id: org, document_id: plannedId, source_draft_id: draftId,
    issuer_tax_id_normalized: identity.issuerTaxIdNormalized, issuer_name_normalized: identity.issuerNameNormalized,
    document_number_normalized: identity.documentNumberNormalized, document_date: identity.documentDate,
    total_amount: identity.totalAmount, currency_code: identity.currencyCode, identity_strategy: identity.identityStrategy,
    invoice_identity_key: identity.invoiceIdentityKey, duplicate_status: "clear",
  }, "document_id");
  await insertImmutable(supabase, "document_revisions", { id: stableId(org, `revision:${plannedId}`), organization_id: org,
    document_id: plannedId, revision_number: 1, working_draft_id: draftId, status: "open", opened_by: input.actorProfileId });
  await linkSource(supabase, { org, documentId: plannedId, rawId, attachment, message: input.message, invoice });
  const completed = await supabase.from("documents").update({ current_draft_id: draftId, status: "needs_review", last_processed_at: new Date().toISOString() })
    .eq("organization_id", org).eq("id", plannedId).eq("status", "uploading").is("current_draft_id", null)
    .eq("metadata->>email_semantic_hash", invoice.semanticHash);
  if (completed.error) throw new Error("email_draft_finalize_failed");
  const final = await loadDoc(supabase, org, plannedId);
  if (!final?.current_draft_id) throw new Error("email_draft_not_confirmed");
  return { document: summarize(final, false) };
}

/** Automatic receipt creates review drafts/evidence only; never accounting entries, payments or ERP writes. */
export async function ingestEmailAttachments(input: EmailIngestInput, deps: Dependencies = {}): Promise<EmailIngestResult> {
  localDocumentReviewUrl(input.slug, "00000000-0000-0000-0000-000000000000", input.appUrl);
  if (!input.attachments.length || input.attachments.length > 20) throw new Error("email_attachment_count_invalid");
  const context = await resolveLocalCompanionContext({ ...input, requireWrite: true }, deps);
  const org = context.organization.id, supabase = context.supabase;
  const company = await supabase.from("organizations").select("tax_id").eq("id", org).maybeSingle();
  const organizationRut = normalizeTaxId(company.data?.tax_id);
  if (company.error || !organizationRut || !/^\d{12}$/.test(organizationRut)) throw new Error("email_organization_tax_id_missing");
  const result: EmailIngestResult = { documents: [], pending: [] };
  const hasXml = input.attachments.some((attachment) => /\.xml$/i.test(attachment.originalFilename));
  for (const attachment of input.attachments) {
    const bytes = await readAttachment(attachment);
    if (/\.xml$/i.test(attachment.originalFilename)) {
      const rawId = await preserveRaw(supabase, org, attachment, bytes, input.message);
      let parsed;
      try { parsed = parseCfeXml(bytes, organizationRut); }
      catch (error) { result.pending!.push({ filename: attachment.originalFilename, reason: error instanceof Error ? error.message : "cfe_xml_invalid" }); continue; }
      for (const pending of parsed.pending) result.pending!.push({ filename: attachment.originalFilename, reason: `CFE ${pending.cfeIndex === undefined ? "" : pending.cfeIndex + 1}: ${pending.reason}` });
      for (const invoice of parsed.invoices) {
        const materialized = await materializeXml(supabase, input, org, rawId, attachment, invoice);
        if (materialized.document) result.documents.push(materialized.document);
        if (materialized.pending) result.pending!.push({ filename: attachment.originalFilename, reason: materialized.pending });
      }
    } else if (/\.(pdf|jpe?g|png)$/i.test(attachment.originalFilename)) {
      if (hasXml) {
        // Coexistence or filenames cannot prove that a PDF depicts the XML invoice.
        await preserveRaw(supabase, org, attachment, bytes, input.message);
        result.pending!.push({ filename: attachment.originalFilename, reason: "Adjunto visual conservado; falta verificar si representa alguno de los CFE del mismo correo. No se creó otra factura." });
      } else {
        const document = await (deps.ingest ?? ingestLocalDocument)({ ...input, filePath: attachment.filePath }, { supabase });
        await linkSource(supabase, { org, documentId: document.documentId, rawId: null, attachment, message: input.message });
        result.documents.push(document);
      }
    } else result.pending!.push({ filename: attachment.originalFilename, reason: "Tipo de adjunto no soportado para extracción automática." });
  }
  result.documents = [...new Map(result.documents.map((document) => [document.documentId, document])).values()];
  return result;
}
