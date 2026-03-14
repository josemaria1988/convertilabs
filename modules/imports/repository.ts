import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAmountBreakdown, parseDraftFacts, parseLineItems } from "@/modules/accounting";
import { aggregateImportOperationDocuments } from "@/modules/imports/aggregate";
import { interpretImportDocument } from "@/modules/imports/intake";
import type {
  ImportDocumentIntakeResult,
  ImportOperationListItem,
} from "@/modules/imports/types";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function createImportOperation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    referenceCode?: string | null;
    duaNumber?: string | null;
    duaYear?: string | null;
    customsBrokerName?: string | null;
    supplierName?: string | null;
    supplierTaxId?: string | null;
    currencyCode?: string | null;
    operationDate?: string | null;
    paymentDate?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("organization_import_operations")
    .insert({
      organization_id: input.organizationId,
      reference_code: input.referenceCode ?? null,
      dua_number: input.duaNumber ?? null,
      dua_year: input.duaYear ?? null,
      customs_broker_name: input.customsBrokerName ?? null,
      supplier_name: input.supplierName ?? null,
      supplier_tax_id: input.supplierTaxId ?? null,
      currency_code: input.currencyCode ?? null,
      operation_date: input.operationDate ?? null,
      payment_date: input.paymentDate ?? null,
      status: "draft",
      warnings_json: [],
      raw_summary_json: {},
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear la operacion de importacion.");
  }

  return data.id as string;
}

async function loadLinkedImportDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  importOperationId: string,
) {
  const { data, error } = await supabase
    .from("organization_import_operation_documents")
    .select("document_id")
    .eq("organization_id", organizationId)
    .eq("import_operation_id", importOperationId);

  if (error) {
    throw new Error(error.message);
  }

  const documentIds = (((data as Array<{ document_id: string }> | null) ?? [])).map((row) => row.document_id);

  if (documentIds.length === 0) {
    return [] satisfies ImportDocumentIntakeResult[];
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, document_type, current_draft_id")
    .eq("organization_id", organizationId)
    .in("id", documentIds);

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const draftIds = (((documents as Array<{ current_draft_id: string | null }> | null) ?? []))
    .map((document) => document.current_draft_id)
    .filter((value): value is string => Boolean(value));
  const { data: drafts, error: draftsError } = draftIds.length > 0
    ? await supabase
      .from("document_drafts")
      .select("id, document_id, document_type, fields_json, extracted_text")
      .in("id", draftIds)
    : { data: [], error: null };

  if (draftsError) {
    throw new Error(draftsError.message);
  }

  const draftByDocumentId = new Map(
    (((drafts as Array<{
      id: string;
      document_id: string;
      document_type: string | null;
      fields_json: Record<string, unknown> | null;
      extracted_text: string | null;
    }> | null) ?? [])).map((draft) => [draft.document_id, draft]),
  );

  return (((documents as Array<{
    id: string;
    document_type: string | null;
  }> | null) ?? [])).map((document) => {
    const draft = draftByDocumentId.get(document.id);

    return interpretImportDocument({
      documentId: document.id,
      documentType: draft?.document_type ?? document.document_type ?? null,
      facts: parseDraftFacts(draft?.fields_json ?? null),
      amountBreakdown: parseAmountBreakdown(draft?.fields_json ?? null),
      lineItems: parseLineItems(draft?.fields_json ?? null),
      extractedText: draft?.extracted_text ?? null,
    });
  });
}

export async function attachDocumentToImportOperation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    importOperationId: string;
    documentId: string;
  },
) {
  const { error } = await supabase
    .from("organization_import_operation_documents")
    .upsert({
      organization_id: input.organizationId,
      import_operation_id: input.importOperationId,
      document_id: input.documentId,
      document_type: "unknown",
      is_primary: false,
    }, {
      onConflict: "organization_id,import_operation_id,document_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  return syncImportOperationAggregation(supabase, input.organizationId, input.importOperationId);
}

export async function syncImportOperationAggregation(
  supabase: SupabaseClient,
  organizationId: string,
  importOperationId: string,
) {
  const documents = await loadLinkedImportDocuments(supabase, organizationId, importOperationId);
  const aggregate = aggregateImportOperationDocuments({
    documents,
  });
  const { error: operationError } = await supabase
    .from("organization_import_operations")
    .update({
      reference_code: aggregate.referenceCode,
      dua_number: aggregate.duaNumber,
      dua_year: aggregate.duaYear,
      supplier_name: aggregate.supplierName,
      supplier_tax_id: aggregate.supplierTaxId,
      currency_code: aggregate.currencyCode,
      operation_date: aggregate.operationDate,
      payment_date: aggregate.paymentDate,
      status: aggregate.status,
      warnings_json: aggregate.warnings,
      raw_summary_json: aggregate.summary,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", importOperationId);

  if (operationError) {
    throw new Error(operationError.message);
  }

  const { error: deleteTaxesError } = await supabase
    .from("organization_import_operation_taxes")
    .delete()
    .eq("organization_id", organizationId)
    .eq("import_operation_id", importOperationId);

  if (deleteTaxesError) {
    throw new Error(deleteTaxesError.message);
  }

  if (aggregate.taxLines.length > 0) {
    const { error: taxesError } = await supabase
      .from("organization_import_operation_taxes")
      .insert(aggregate.taxLines.map((line) => ({
        organization_id: organizationId,
        import_operation_id: importOperationId,
        tax_code: line.taxCode,
        tax_label: line.taxLabel,
        external_tax_code: line.externalTaxCode,
        amount: line.amount,
        currency_code: line.currencyCode ?? aggregate.currencyCode ?? "USD",
        is_creditable_vat: line.isCreditableVat,
        is_vat_advance: line.isVatAdvance,
        is_other_tax: line.isOtherTax,
        source_document_id: line.sourceDocumentId,
        metadata_json: {
          warnings: line.warnings,
        },
      })));

    if (taxesError) {
      throw new Error(taxesError.message);
    }
  }

  for (const linkedDocument of aggregate.linkedDocuments) {
    const { error: linkedDocumentError } = await supabase
      .from("organization_import_operation_documents")
      .update({
        document_type: linkedDocument.documentType,
        is_primary: linkedDocument.isPrimary,
      })
      .eq("organization_id", organizationId)
      .eq("import_operation_id", importOperationId)
      .eq("document_id", linkedDocument.documentId);

    if (linkedDocumentError) {
      throw new Error(linkedDocumentError.message);
    }
  }

  return aggregate;
}

export async function listOrganizationImportOperations(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 12,
) {
  const { data, error } = await supabase
    .from("organization_import_operations")
    .select(
      "id, reference_code, dua_number, dua_year, customs_broker_name, supplier_name, supplier_tax_id, currency_code, operation_date, payment_date, status, warnings_json, raw_summary_json, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const operations = ((data as Array<Record<string, unknown>> | null) ?? []);

  if (operations.length === 0) {
    return [] satisfies ImportOperationListItem[];
  }

  const operationIds = operations.map((row) => String(row.id));
  const [linkedDocumentsResult, taxLinesResult] = await Promise.all([
    supabase
      .from("organization_import_operation_documents")
      .select("import_operation_id, document_id, document_type, is_primary")
      .eq("organization_id", organizationId)
      .in("import_operation_id", operationIds),
    supabase
      .from("organization_import_operation_taxes")
      .select("import_operation_id, tax_code, tax_label, external_tax_code, amount, currency_code, is_creditable_vat, is_vat_advance, is_other_tax, source_document_id, metadata_json")
      .eq("organization_id", organizationId)
      .in("import_operation_id", operationIds),
  ]);

  if (linkedDocumentsResult.error || taxLinesResult.error) {
    throw new Error(linkedDocumentsResult.error?.message ?? taxLinesResult.error?.message ?? "No se pudieron cargar las operaciones de importacion.");
  }

  const linkedDocumentsByOperationId = new Map<string, ImportOperationListItem["linkedDocuments"]>();

  for (const row of ((linkedDocumentsResult.data as Array<Record<string, unknown>> | null) ?? [])) {
    const operationId = String(row.import_operation_id);
    const current = linkedDocumentsByOperationId.get(operationId) ?? [];

    current.push({
      documentId: String(row.document_id),
      documentType: (asString(row.document_type) as ImportOperationListItem["linkedDocuments"][number]["documentType"]) ?? "unknown",
      isPrimary: Boolean(row.is_primary),
    });
    linkedDocumentsByOperationId.set(operationId, current);
  }

  const taxLinesByOperationId = new Map<string, ImportOperationListItem["taxLines"]>();

  for (const row of ((taxLinesResult.data as Array<Record<string, unknown>> | null) ?? [])) {
    const operationId = String(row.import_operation_id);
    const current = taxLinesByOperationId.get(operationId) ?? [];

    current.push({
      taxCode: asString(row.tax_code),
      taxLabel: String(row.tax_label ?? "Tributo"),
      externalTaxCode: asString(row.external_tax_code),
      amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
      currencyCode: asString(row.currency_code),
      isCreditableVat: Boolean(row.is_creditable_vat),
      isVatAdvance: Boolean(row.is_vat_advance),
      isOtherTax: Boolean(row.is_other_tax),
      sourceDocumentId: asString(row.source_document_id),
      warnings: Array.isArray(asRecord(row.metadata_json).warnings)
        ? (asRecord(row.metadata_json).warnings as unknown[]).filter((value): value is string => typeof value === "string")
        : [],
    });
    taxLinesByOperationId.set(operationId, current);
  }

  return operations.map((row) => ({
    id: String(row.id),
    referenceCode: asString(row.reference_code),
    duaNumber: asString(row.dua_number),
    duaYear: asString(row.dua_year),
    customsBrokerName: asString(row.customs_broker_name),
    supplierName: asString(row.supplier_name),
    supplierTaxId: asString(row.supplier_tax_id),
    currencyCode: asString(row.currency_code),
    operationDate: asString(row.operation_date),
    paymentDate: asString(row.payment_date),
    status: (asString(row.status) as ImportOperationListItem["status"]) ?? "draft",
    warnings: Array.isArray(row.warnings_json)
      ? (row.warnings_json as unknown[]).filter((value): value is string => typeof value === "string")
      : [],
    taxLines: taxLinesByOperationId.get(String(row.id)) ?? [],
    linkedDocuments: linkedDocumentsByOperationId.get(String(row.id)) ?? [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  } satisfies ImportOperationListItem));
}

export async function updateImportOperationStatus(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    importOperationId: string;
    status: ImportOperationListItem["status"];
  },
) {
  const { error } = await supabase
    .from("organization_import_operations")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.importOperationId);

  if (error) {
    throw new Error(error.message);
  }

  return input.status;
}
