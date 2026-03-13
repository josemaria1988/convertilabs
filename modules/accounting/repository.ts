import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountingArtifactsPersistenceInput,
  AccountingArtifactsPersistenceResult,
  AccountingVendorRecord,
  DuplicateResolutionResult,
  PersistedInvoiceIdentityRow,
  ResolveDuplicateInput,
} from "@/modules/accounting/types";

type ChartAccountRow = {
  id: string;
  code: string;
  name: string;
};

export async function loadOrganizationVendors(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("vendors")
    .select(
      "id, organization_id, name, tax_id, tax_id_normalized, name_normalized, default_account_id, default_payment_account_id, default_tax_profile, metadata",
    )
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as AccountingVendorRecord[] | null) ?? []);
}

export async function loadActiveExtractionId(
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

export async function findDuplicateInvoiceIdentityDocumentId(
  supabase: SupabaseClient,
  organizationId: string,
  currentDocumentId: string,
  invoiceIdentityKey: string | null,
) {
  if (!invoiceIdentityKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("document_invoice_identities")
    .select("document_id")
    .eq("organization_id", organizationId)
    .eq("invoice_identity_key", invoiceIdentityKey)
    .neq("document_id", currentDocumentId)
    .in("duplicate_status", [
      "clear",
      "suspected_duplicate",
      "false_positive",
      "justified_non_duplicate",
    ])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.document_id === "string" ? data.document_id : null;
}

export async function upsertDocumentInvoiceIdentity(
  supabase: SupabaseClient,
  input: Omit<
    PersistedInvoiceIdentityRow,
    "id" | "created_at" | "updated_at" | "resolved_at" | "resolved_by"
  >,
) {
  const now = new Date().toISOString();
  const payload = {
    organization_id: input.organization_id,
    document_id: input.document_id,
    source_draft_id: input.source_draft_id,
    vendor_id: input.vendor_id,
    issuer_tax_id_normalized: input.issuer_tax_id_normalized,
    issuer_name_normalized: input.issuer_name_normalized,
    document_number_normalized: input.document_number_normalized,
    document_date: input.document_date,
    total_amount: input.total_amount,
    currency_code: input.currency_code,
    identity_strategy: input.identity_strategy,
    invoice_identity_key: input.invoice_identity_key,
    duplicate_status: input.duplicate_status,
    duplicate_of_document_id: input.duplicate_of_document_id,
    duplicate_reason: input.duplicate_reason,
    resolution_notes: input.resolution_notes,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("document_invoice_identities")
    .upsert(payload, {
      onConflict: "document_id",
    })
    .select(
      "id, organization_id, document_id, source_draft_id, vendor_id, issuer_tax_id_normalized, issuer_name_normalized, document_number_normalized, document_date, total_amount, currency_code, identity_strategy, invoice_identity_key, duplicate_status, duplicate_of_document_id, duplicate_reason, resolution_notes, resolved_by, resolved_at, created_at, updated_at",
    )
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo persistir la identidad de factura.");
  }

  return data as PersistedInvoiceIdentityRow;
}

export async function loadDocumentInvoiceIdentity(
  supabase: SupabaseClient,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("document_invoice_identities")
    .select(
      "id, organization_id, document_id, source_draft_id, vendor_id, issuer_tax_id_normalized, issuer_name_normalized, document_number_normalized, document_date, total_amount, currency_code, identity_strategy, invoice_identity_key, duplicate_status, duplicate_of_document_id, duplicate_reason, resolution_notes, resolved_by, resolved_at, created_at, updated_at",
    )
    .eq("document_id", documentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PersistedInvoiceIdentityRow | null) ?? null;
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

export async function persistApprovedAccountingArtifacts(
  supabase: SupabaseClient,
  input: AccountingArtifactsPersistenceInput,
) {
  const extractionId = await loadActiveExtractionId(supabase, input.documentId);
  const { data: suggestion, error: suggestionError } = await supabase
    .from("accounting_suggestions")
    .upsert(
      {
        organization_id: input.organizationId,
        document_id: input.documentId,
        extraction_id: extractionId,
        version_no: input.revisionNumber,
        status: "approved",
        confidence: input.confidence,
        explanation: input.derived.journalSuggestion.explanation,
        tax_treatment_json: input.derived.taxTreatment,
        rule_trace_json: input.derived.taxTreatment.deterministicRuleRefs,
        approved_by: input.actorId,
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

  const journalLines = input.derived.journalSuggestion.lines;
  const matchingAccounts = await loadMatchingChartAccounts(
    supabase,
    input.organizationId,
    journalLines.map((line) => line.accountCode),
  );
  const accountLookup = new Map(matchingAccounts.map((account) => [account.code, account]));
  const missingCodes = journalLines
    .filter((line) => !accountLookup.has(line.accountCode))
    .map((line) => line.accountCode);
  const description = missingCodes.length > 0
    ? `${input.derived.journalSuggestion.explanation} Lineas pendientes por falta de plan de cuentas: ${missingCodes.join(", ")}.`
    : input.derived.journalSuggestion.explanation;
  const { data: journalEntry, error: journalEntryError } = await supabase
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      source_document_id: input.documentId,
      source_suggestion_id: suggestion.id,
      entry_date: input.documentDate,
      status: "draft",
      currency_code: input.currencyCode ?? "UYU",
      reference: input.reference,
      description,
      total_debit: input.derived.journalSuggestion.totalDebit,
      total_credit: input.derived.journalSuggestion.totalCredit,
      created_by: input.actorId,
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
      tax_tag: input.derived.taxTreatment.treatmentCode,
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
  } satisfies AccountingArtifactsPersistenceResult;
}

export async function resolveDocumentDuplicateStatus(
  supabase: SupabaseClient,
  input: ResolveDuplicateInput,
) {
  const { data: currentIdentity, error: identityError } = await supabase
    .from("document_invoice_identities")
    .select(
      "id, duplicate_status, duplicate_of_document_id, duplicate_reason, resolution_notes",
    )
    .eq("document_id", input.documentId)
    .eq("organization_id", input.organizationId)
    .limit(1)
    .maybeSingle();

  if (identityError || !currentIdentity?.id) {
    throw new Error(identityError?.message ?? "No existe identidad de factura para este documento.");
  }

  const resolvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("document_invoice_identities")
    .update({
      duplicate_status: input.action,
      resolution_notes: input.note,
      resolved_by: input.actorId,
      resolved_at: resolvedAt,
      updated_at: resolvedAt,
    })
    .eq("id", currentIdentity.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: auditError } = await supabase
    .from("audit_log")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId,
      entity_type: "document_invoice_identity",
      entity_id: currentIdentity.id,
      action: `duplicate_resolution:${input.action}`,
      before_json: currentIdentity,
      after_json: {
        ...currentIdentity,
        duplicate_status: input.action,
        resolution_notes: input.note,
        resolved_by: input.actorId,
        resolved_at: resolvedAt,
      },
      metadata: {
        document_id: input.documentId,
      },
    });

  if (auditError) {
    throw new Error(auditError.message);
  }

  return {
    ok: true,
    duplicateStatus: input.action,
    message:
      input.action === "confirmed_duplicate"
        ? "Documento marcado como duplicado confirmado."
        : input.action === "false_positive"
          ? "Documento marcado como falso positivo."
          : "Documento habilitado para continuar con justificacion.",
  } satisfies DuplicateResolutionResult;
}
