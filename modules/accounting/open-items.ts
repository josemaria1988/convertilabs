import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting/normalization";

export type OpenItemCounterpartyType = "vendor" | "customer";
export type OpenItemStatus = "open" | "partially_settled" | "settled";

export type ExistingOpenItem = {
  id: string;
  issue_date: string | null;
  outstanding_amount: number;
  settled_amount: number;
  status: string;
};

export type OpenItemCreatePayload = {
  organization_id: string;
  counterparty_type: OpenItemCounterpartyType;
  counterparty_id: string | null;
  source_document_id: string;
  document_role: "purchase" | "sale" | "other";
  document_type: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency_code: string;
  fx_rate: number;
  fx_rate_date: string | null;
  fx_rate_source: string;
  functional_currency_code: string;
  original_amount: number;
  functional_amount: number;
  settled_amount: number;
  outstanding_amount: number;
  status: OpenItemStatus;
  journal_entry_id: string | null;
  metadata: Record<string, unknown>;
};

export type OpenItemUpdatePayload = {
  id: string;
  settled_amount: number;
  outstanding_amount: number;
  status: OpenItemStatus;
};

export type SettlementLinkPayload = {
  organization_id: string;
  open_item_id: string;
  settlement_document_id: string;
  settlement_journal_entry_id: string | null;
  currency_code: string;
  fx_rate: number;
  fx_rate_date: string | null;
  amount: number;
  functional_amount: number;
  metadata_json: Record<string, unknown>;
};

export type OpenItemMutationPlan = {
  createOpenItems: OpenItemCreatePayload[];
  updateOpenItems: OpenItemUpdatePayload[];
  settlementLinks: SettlementLinkPayload[];
};

function getSubtypeKind(documentType: string | null | undefined) {
  const normalized = (documentType ?? "").toLowerCase();

  if (normalized.includes("credit_note")) {
    return "credit_note";
  }

  if (normalized.includes("receipt")) {
    return "receipt";
  }

  if (normalized.includes("payment_support")) {
    return "payment_support";
  }

  if (normalized.includes("invoice")) {
    return "invoice";
  }

  return "other";
}

export function buildOpenItemMutationPlan(input: {
  organizationId: string;
  documentId: string;
  documentRole: "purchase" | "sale" | "other";
  documentType: string | null;
  counterpartyType: OpenItemCounterpartyType;
  counterpartyId: string | null;
  journalEntryId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currencyCode: string;
  functionalCurrencyCode: string;
  fxRate: number;
  fxRateDate: string | null;
  fxRateSource: string;
  totalAmount: number;
  existingOpenItems?: ExistingOpenItem[];
}) {
  const subtypeKind = getSubtypeKind(input.documentType);
  const originalAmount = roundCurrency(input.totalAmount);
  const functionalAmount = roundCurrency(originalAmount * input.fxRate);
  const basePayload = {
    organization_id: input.organizationId,
    counterparty_type: input.counterpartyType,
    counterparty_id: input.counterpartyId,
    source_document_id: input.documentId,
    document_role: input.documentRole,
    document_type: input.documentType,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    currency_code: input.currencyCode,
    fx_rate: input.fxRate,
    fx_rate_date: input.fxRateDate,
    fx_rate_source: input.fxRateSource,
    functional_currency_code: input.functionalCurrencyCode,
    journal_entry_id: input.journalEntryId,
    metadata: {},
  };

  if (subtypeKind === "invoice") {
    return {
      createOpenItems: [
        {
          ...basePayload,
          original_amount: originalAmount,
          functional_amount: functionalAmount,
          settled_amount: 0,
          outstanding_amount: originalAmount,
          status: "open",
        },
      ],
      updateOpenItems: [],
      settlementLinks: [],
    } satisfies OpenItemMutationPlan;
  }

  if (
    subtypeKind !== "credit_note"
    && subtypeKind !== "receipt"
    && subtypeKind !== "payment_support"
  ) {
    return {
      createOpenItems: [],
      updateOpenItems: [],
      settlementLinks: [],
    } satisfies OpenItemMutationPlan;
  }

  let remainingAmount = Math.abs(originalAmount);
  const updateOpenItems: OpenItemUpdatePayload[] = [];
  const settlementLinks: SettlementLinkPayload[] = [];
  const existingItems = [...(input.existingOpenItems ?? [])]
    .filter((item) => item.outstanding_amount > 0)
    .sort((left, right) => {
      const leftDate = left.issue_date ?? "";
      const rightDate = right.issue_date ?? "";
      return leftDate.localeCompare(rightDate);
    });

  for (const item of existingItems) {
    if (remainingAmount <= 0) {
      break;
    }

    const appliedAmount = Math.min(roundCurrency(item.outstanding_amount), remainingAmount);
    const nextSettled = roundCurrency(item.settled_amount + appliedAmount);
    const nextOutstanding = roundCurrency(item.outstanding_amount - appliedAmount);
    remainingAmount = roundCurrency(remainingAmount - appliedAmount);

    updateOpenItems.push({
      id: item.id,
      settled_amount: nextSettled,
      outstanding_amount: nextOutstanding,
      status: nextOutstanding <= 0 ? "settled" : "partially_settled",
    });
    settlementLinks.push({
      organization_id: input.organizationId,
      open_item_id: item.id,
      settlement_document_id: input.documentId,
      settlement_journal_entry_id: input.journalEntryId,
      currency_code: input.currencyCode,
      fx_rate: input.fxRate,
      fx_rate_date: input.fxRateDate,
      amount: appliedAmount,
      functional_amount: roundCurrency(appliedAmount * input.fxRate),
      metadata_json: {
        source_document_type: input.documentType,
      },
    });
  }

  const createOpenItems =
    remainingAmount > 0
      ? [
          {
            ...basePayload,
            original_amount: roundCurrency(-remainingAmount),
            functional_amount: roundCurrency(-remainingAmount * input.fxRate),
            settled_amount: 0,
            outstanding_amount: roundCurrency(-remainingAmount),
            status: "open" as const,
            metadata: {
              residual_credit_balance: true,
            },
          },
        ]
      : [];

  return {
    createOpenItems,
    updateOpenItems,
    settlementLinks,
  } satisfies OpenItemMutationPlan;
}

async function loadOrganizationBaseCurrency(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select("base_currency")
    .eq("id", organizationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.base_currency === "string" ? data.base_currency : "UYU";
}

async function ensureCustomerCounterparty(input: {
  supabase: SupabaseClient;
  organizationId: string;
  name: string | null;
  taxId: string | null;
}) {
  const normalizedTaxId = normalizeTaxId(input.taxId);
  const normalizedName = normalizeTextToken(input.name);

  if (normalizedTaxId) {
    const { data, error } = await input.supabase
      .from("customers")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("tax_id_normalized", normalizedTaxId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  if (normalizedName) {
    const { data, error } = await input.supabase
      .from("customers")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("name_normalized", normalizedName)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  const { data, error } = await input.supabase
    .from("customers")
    .insert({
      organization_id: input.organizationId,
      name: input.name?.trim() || "Cliente sin nombre",
      tax_id: input.taxId?.trim() || null,
      tax_id_normalized: normalizedTaxId,
      name_normalized: normalizedName,
      metadata: {
        source: "document_review_confirmation",
      },
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear la contraparte cliente.");
  }

  return data.id as string;
}

async function ensureVendorCounterparty(input: {
  supabase: SupabaseClient;
  organizationId: string;
  vendorId: string | null;
  name: string | null;
  taxId: string | null;
}) {
  if (input.vendorId) {
    return input.vendorId;
  }

  const normalizedTaxId = normalizeTaxId(input.taxId);
  const normalizedName = normalizeTextToken(input.name);

  if (normalizedTaxId) {
    const { data, error } = await input.supabase
      .from("vendors")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("tax_id_normalized", normalizedTaxId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  if (normalizedName) {
    const { data, error } = await input.supabase
      .from("vendors")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("name_normalized", normalizedName)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  const { data, error } = await input.supabase
    .from("vendors")
    .insert({
      organization_id: input.organizationId,
      name: input.name?.trim() || "Proveedor sin nombre",
      tax_id: input.taxId?.trim() || null,
      tax_id_normalized: normalizedTaxId,
      name_normalized: normalizedName,
      metadata: {
        source: "document_review_confirmation",
      },
    })
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear la contraparte proveedor.");
  }

  return data.id as string;
}

export async function syncApprovedDocumentOpenItems(input: {
  supabase: SupabaseClient;
  organizationId: string;
  documentId: string;
  documentRole: "purchase" | "sale" | "other";
  documentType: string | null;
  documentDate: string | null;
  dueDate: string | null;
  currencyCode: string | null;
  totalAmount: number | null;
  vendorId: string | null;
  issuerName: string | null;
  issuerTaxId: string | null;
  receiverName: string | null;
  receiverTaxId: string | null;
  journalEntryId: string | null;
}) {
  if (input.documentRole !== "purchase" && input.documentRole !== "sale") {
    return;
  }

  if (
    typeof input.totalAmount !== "number"
    || !Number.isFinite(input.totalAmount)
    || input.totalAmount === 0
  ) {
    return;
  }

  const functionalCurrencyCode = await loadOrganizationBaseCurrency(
    input.supabase,
    input.organizationId,
  );
  const currencyCode = input.currencyCode?.trim().toUpperCase() || functionalCurrencyCode;
  const fxRate = 1;
  const fxRateDate = input.documentDate ?? null;
  const fxRateSource = currencyCode === functionalCurrencyCode ? "same_currency" : "document_default";
  const counterpartyType = input.documentRole === "purchase" ? "vendor" : "customer";
  const counterpartyId =
    counterpartyType === "vendor"
      ? await ensureVendorCounterparty({
          supabase: input.supabase,
          organizationId: input.organizationId,
          vendorId: input.vendorId,
          name: input.issuerName,
          taxId: input.issuerTaxId,
        })
      : await ensureCustomerCounterparty({
          supabase: input.supabase,
          organizationId: input.organizationId,
          name: input.receiverName,
          taxId: input.receiverTaxId,
        });

  const { data: openItemRows, error: openItemsError } = await input.supabase
    .from("ledger_open_items")
    .select("id, issue_date, outstanding_amount, settled_amount, status")
    .eq("organization_id", input.organizationId)
    .eq("counterparty_type", counterpartyType)
    .eq("counterparty_id", counterpartyId)
    .in("status", ["open", "partially_settled"])
    .neq("source_document_id", input.documentId)
    .order("issue_date", { ascending: true });

  if (openItemsError) {
    throw new Error(openItemsError.message);
  }

  const plan = buildOpenItemMutationPlan({
    organizationId: input.organizationId,
    documentId: input.documentId,
    documentRole: input.documentRole,
    documentType: input.documentType,
    counterpartyType,
    counterpartyId,
    journalEntryId: input.journalEntryId,
    issueDate: input.documentDate,
    dueDate: input.dueDate,
    currencyCode,
    functionalCurrencyCode,
    fxRate,
    fxRateDate,
    fxRateSource,
    totalAmount: input.totalAmount,
    existingOpenItems: ((openItemRows as ExistingOpenItem[] | null) ?? []),
  });

  if (plan.createOpenItems.length > 0) {
    const { error } = await input.supabase
      .from("ledger_open_items")
      .insert(plan.createOpenItems);

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const update of plan.updateOpenItems) {
    const { error } = await input.supabase
      .from("ledger_open_items")
      .update({
        settled_amount: update.settled_amount,
        outstanding_amount: update.outstanding_amount,
        status: update.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", update.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (plan.settlementLinks.length > 0) {
    const { error } = await input.supabase
      .from("ledger_settlement_links")
      .insert(plan.settlementLinks);

    if (error) {
      throw new Error(error.message);
    }
  }
}
