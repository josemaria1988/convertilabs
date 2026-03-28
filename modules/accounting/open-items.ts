import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeCurrencyCode,
  normalizeTaxId,
  normalizeTextToken,
  roundCurrency,
} from "@/modules/accounting/normalization";

export type OpenItemCounterpartyType = "vendor" | "customer";
export type OpenItemStatus = "open" | "partially_settled" | "settled";

export type ExistingOpenItem = {
  id: string;
  issue_date: string | null;
  currency_code?: string | null;
  functional_currency_code?: string | null;
  fx_rate?: number | null;
  fx_rate_date?: string | null;
  fx_rate_source?: string | null;
  outstanding_amount: number;
  settled_amount: number;
  status: string;
};

export type OpenItemMonetarySnapshotInput = {
  currencyCode?: string | null;
  functionalCurrencyCode?: string | null;
  fxRate?: number | null;
  fxRateDate?: string | null;
  fxRateSource?: string | null;
};

export type OpenItemMonetaryContext = {
  currencyCode: string;
  functionalCurrencyCode: string;
  fxRate: number;
  fxRateDate: string | null;
  fxRateSource: string;
  resolutionSource: "confirmed_snapshot" | "draft_snapshot" | "same_currency";
  blockingReason: string | null;
};

export type OpenItemCreatePayload = {
  organization_id: string;
  counterparty_type: OpenItemCounterpartyType;
  counterparty_id: string | null;
  party_id?: string | null;
  source_document_id: string;
  source_channel?: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  source_ref_json?: Record<string, unknown>;
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
  opening_journal_entry_line_id?: string | null;
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
  settlement_journal_entry_line_id?: string | null;
  source_channel?: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  source_ref_json?: Record<string, unknown>;
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

const OPEN_ITEM_FUNCTIONAL_TOLERANCE = 0.01;

function normalizeOpenItemCurrency(value: string | null | undefined, fallback: string) {
  return normalizeCurrencyCode(value) ?? fallback;
}

function isTrustedForeignCurrencyFxSource(value: string | null | undefined) {
  return value === "bcu" || value === "document_import" || value === "manual_override" || value === "cfe";
}

function buildMissingOpenItemFxReason(input: {
  currencyCode: string;
  functionalCurrencyCode: string;
  documentDate: string | null;
}) {
  const dateSuffix = input.documentDate ? ` para ${input.documentDate}` : "";
  return `No hay snapshot FX confiable para generar open items en ${input.currencyCode} contra moneda funcional ${input.functionalCurrencyCode}${dateSuffix}.`;
}

function buildCrossCurrencySettlementReason(input: {
  settlementCurrencyCode: string;
  existingCurrencyCode: string;
}) {
  return `El auto-settlement entre ${input.settlementCurrencyCode} y ${input.existingCurrencyCode} no esta soportado en MVP. Resuelve el caso manualmente.`;
}

function isPositiveRate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFunctionalAmountConsistent(originalAmount: number, functionalAmount: number, fxRate: number) {
  const expected = roundCurrency(originalAmount * fxRate);
  return Math.abs(expected - functionalAmount) <= OPEN_ITEM_FUNCTIONAL_TOLERANCE;
}

function assertFunctionalAmountConsistency(input: {
  originalAmount: number;
  functionalAmount: number;
  fxRate: number;
  label: string;
}) {
  if (!isFunctionalAmountConsistent(input.originalAmount, input.functionalAmount, input.fxRate)) {
    throw new Error(`${input.label} quedo inconsistente con el tipo de cambio aplicado.`);
  }
}

function buildResolvedOpenItemMonetaryContext(
  input: {
    currencyCode: string | null | undefined;
    functionalCurrencyCode: string | null | undefined;
    documentDate: string | null | undefined;
    snapshot: OpenItemMonetarySnapshotInput;
    resolutionSource: OpenItemMonetaryContext["resolutionSource"];
  },
): OpenItemMonetaryContext | null {
  const currencyCode = normalizeOpenItemCurrency(input.snapshot.currencyCode ?? input.currencyCode, "UYU");
  const functionalCurrencyCode = normalizeOpenItemCurrency(
    input.snapshot.functionalCurrencyCode ?? input.functionalCurrencyCode,
    "UYU",
  );

  if (currencyCode === functionalCurrencyCode) {
    return {
      currencyCode,
      functionalCurrencyCode,
      fxRate: 1,
      fxRateDate: input.snapshot.fxRateDate ?? input.documentDate ?? null,
      fxRateSource: "same_currency",
      resolutionSource: "same_currency",
      blockingReason: null,
    } satisfies OpenItemMonetaryContext;
  }

  if (
    !isPositiveRate(input.snapshot.fxRate)
    || !isTrustedForeignCurrencyFxSource(input.snapshot.fxRateSource)
    || !input.snapshot.fxRateDate
  ) {
    return null;
  }

  return {
    currencyCode,
    functionalCurrencyCode,
    fxRate: input.snapshot.fxRate!,
    fxRateDate: input.snapshot.fxRateDate,
    fxRateSource: input.snapshot.fxRateSource!,
    resolutionSource: input.resolutionSource,
    blockingReason: null,
  } satisfies OpenItemMonetaryContext;
}

export function resolveOpenItemMonetaryContext(input: {
  currencyCode: string | null | undefined;
  functionalCurrencyCode: string | null | undefined;
  documentDate: string | null | undefined;
  confirmedSnapshot?: OpenItemMonetarySnapshotInput | null;
  draftSnapshot?: OpenItemMonetarySnapshotInput | null;
}) {
  const normalizedCurrencyCode = normalizeOpenItemCurrency(input.currencyCode, "UYU");
  const normalizedFunctionalCurrencyCode = normalizeOpenItemCurrency(
    input.functionalCurrencyCode,
    "UYU",
  );

  const confirmedContext =
    input.confirmedSnapshot
      ? buildResolvedOpenItemMonetaryContext({
          currencyCode: normalizedCurrencyCode,
          functionalCurrencyCode: normalizedFunctionalCurrencyCode,
          documentDate: input.documentDate,
          snapshot: input.confirmedSnapshot,
          resolutionSource: "confirmed_snapshot",
        })
      : null;

  if (confirmedContext) {
    return confirmedContext;
  }

  const draftContext =
    input.draftSnapshot
      ? buildResolvedOpenItemMonetaryContext({
          currencyCode: normalizedCurrencyCode,
          functionalCurrencyCode: normalizedFunctionalCurrencyCode,
          documentDate: input.documentDate,
          snapshot: input.draftSnapshot,
          resolutionSource: "draft_snapshot",
        })
      : null;

  if (draftContext) {
    return draftContext;
  }

  if (normalizedCurrencyCode === normalizedFunctionalCurrencyCode) {
    return {
      currencyCode: normalizedCurrencyCode,
      functionalCurrencyCode: normalizedFunctionalCurrencyCode,
      fxRate: 1,
      fxRateDate: input.documentDate ?? null,
      fxRateSource: "same_currency",
      resolutionSource: "same_currency",
      blockingReason: null,
    } satisfies OpenItemMonetaryContext;
  }

  return {
    currencyCode: normalizedCurrencyCode,
    functionalCurrencyCode: normalizedFunctionalCurrencyCode,
    fxRate: 0,
    fxRateDate: null,
    fxRateSource: "missing_snapshot",
    resolutionSource: "draft_snapshot",
    blockingReason: buildMissingOpenItemFxReason({
      currencyCode: normalizedCurrencyCode,
      functionalCurrencyCode: normalizedFunctionalCurrencyCode,
      documentDate: input.documentDate ?? null,
    }),
  } satisfies OpenItemMonetaryContext;
}

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
  openItemKind?: "receivable" | "payable" | "clearing" | null;
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
  monetaryContextSource?: OpenItemMonetaryContext["resolutionSource"];
  totalAmount: number;
  existingOpenItems?: ExistingOpenItem[];
}) {
  const monetaryContext = resolveOpenItemMonetaryContext({
    currencyCode: input.currencyCode,
    functionalCurrencyCode: input.functionalCurrencyCode,
    documentDate: input.issueDate,
    confirmedSnapshot: {
      currencyCode: input.currencyCode,
      functionalCurrencyCode: input.functionalCurrencyCode,
      fxRate: input.fxRate,
      fxRateDate: input.fxRateDate,
      fxRateSource: input.fxRateSource,
    },
  });

  if (monetaryContext.blockingReason) {
    throw new Error(monetaryContext.blockingReason);
  }

  const subtypeKind = getSubtypeKind(input.documentType);
  const originalAmount = roundCurrency(input.totalAmount);
  const functionalAmount = roundCurrency(originalAmount * monetaryContext.fxRate);
  const normalizedCurrencyCode = monetaryContext.currencyCode;
  const basePayload = {
    organization_id: input.organizationId,
    counterparty_type: input.counterpartyType,
    counterparty_id: input.counterpartyId,
    party_id: input.counterpartyId,
    source_document_id: input.documentId,
    source_channel: "documents",
    source_entity_type: "document",
    source_entity_id: input.documentId,
    source_ref_json: {
      source_document_id: input.documentId,
      journal_entry_id: input.journalEntryId,
    },
    document_role: input.documentRole,
    document_type: input.documentType,
    issue_date: input.issueDate,
    due_date: input.dueDate,
    currency_code: monetaryContext.currencyCode,
    fx_rate: monetaryContext.fxRate,
    fx_rate_date: monetaryContext.fxRateDate,
    fx_rate_source: monetaryContext.fxRateSource,
    functional_currency_code: monetaryContext.functionalCurrencyCode,
    journal_entry_id: input.journalEntryId,
    opening_journal_entry_line_id: null,
    metadata: {
      kind: input.openItemKind ?? null,
      monetary_context_source: input.monetaryContextSource ?? monetaryContext.resolutionSource,
    },
  };

  assertFunctionalAmountConsistency({
    originalAmount,
    functionalAmount,
    fxRate: monetaryContext.fxRate,
    label: "El open item base",
  });

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
  const crossCurrencyExistingItem =
    subtypeKind === "credit_note" || subtypeKind === "receipt" || subtypeKind === "payment_support"
      ? (input.existingOpenItems ?? []).find((item) => {
          const itemCurrencyCode = normalizeOpenItemCurrency(item.currency_code, normalizedCurrencyCode);
          return itemCurrencyCode !== normalizedCurrencyCode;
        })
      : null;

  if (crossCurrencyExistingItem) {
    throw new Error(
      buildCrossCurrencySettlementReason({
        settlementCurrencyCode: normalizedCurrencyCode,
        existingCurrencyCode: normalizeOpenItemCurrency(
          crossCurrencyExistingItem.currency_code,
          normalizedCurrencyCode,
        ),
      }),
    );
  }

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
      settlement_journal_entry_line_id: null,
      source_channel: "documents",
      source_entity_type: "document",
      source_entity_id: input.documentId,
      source_ref_json: {
        source_document_id: input.documentId,
        journal_entry_id: input.journalEntryId,
      },
      currency_code: monetaryContext.currencyCode,
      fx_rate: monetaryContext.fxRate,
      fx_rate_date: monetaryContext.fxRateDate,
      amount: appliedAmount,
      functional_amount: roundCurrency(appliedAmount * monetaryContext.fxRate),
      metadata_json: {
        source_document_type: input.documentType,
        functional_currency_code: monetaryContext.functionalCurrencyCode,
        fx_rate_source: monetaryContext.fxRateSource,
        monetary_context_source: input.monetaryContextSource ?? monetaryContext.resolutionSource,
      },
    });
  }

  const createOpenItems =
    remainingAmount > 0
      ? [
          {
            ...basePayload,
            original_amount: roundCurrency(-remainingAmount),
            functional_amount: roundCurrency(-remainingAmount * monetaryContext.fxRate),
            settled_amount: 0,
            outstanding_amount: roundCurrency(-remainingAmount),
            status: "open" as const,
            metadata: {
              kind: input.openItemKind ?? null,
              residual_credit_balance: true,
              monetary_context_source: input.monetaryContextSource ?? monetaryContext.resolutionSource,
            },
          },
        ]
      : [];

  for (const createdOpenItem of createOpenItems) {
    assertFunctionalAmountConsistency({
      originalAmount: createdOpenItem.original_amount,
      functionalAmount: createdOpenItem.functional_amount,
      fxRate: createdOpenItem.fx_rate,
      label: "El open item creado",
    });
  }

  for (const settlementLink of settlementLinks) {
    assertFunctionalAmountConsistency({
      originalAmount: settlementLink.amount,
      functionalAmount: settlementLink.functional_amount,
      fxRate: settlementLink.fx_rate,
      label: "El settlement link",
    });
  }

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
  settlementContext?: {
    operationKind: string | null;
    openItemKind: "receivable" | "payable" | "clearing" | null;
  } | null;
  documentDate: string | null;
  dueDate: string | null;
  currencyCode: string | null;
  functionalCurrencyCode: string | null;
  confirmedMonetarySnapshot?: OpenItemMonetarySnapshotInput | null;
  draftMonetarySnapshot?: OpenItemMonetarySnapshotInput | null;
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

  const functionalCurrencyCode =
    input.functionalCurrencyCode?.trim().toUpperCase()
    || await loadOrganizationBaseCurrency(
      input.supabase,
      input.organizationId,
    );
  const monetaryContext = resolveOpenItemMonetaryContext({
    currencyCode: input.currencyCode,
    functionalCurrencyCode,
    documentDate: input.documentDate,
    confirmedSnapshot: input.confirmedMonetarySnapshot ?? null,
    draftSnapshot: input.draftMonetarySnapshot ?? null,
  });

  if (monetaryContext.blockingReason) {
    throw new Error(monetaryContext.blockingReason);
  }

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
  const operationKind = input.settlementContext?.operationKind ?? null;
  const requestedOpenItemKind = input.settlementContext?.openItemKind ?? null;
  const isSettlementDocument =
    operationKind === "customer_receipt" || operationKind === "supplier_payment";

  if (!requestedOpenItemKind && !isSettlementDocument) {
    return;
  }

  const { data: openItemRows, error: openItemsError } = await input.supabase
    .from("ledger_open_items")
    .select("id, issue_date, currency_code, functional_currency_code, fx_rate, fx_rate_date, fx_rate_source, outstanding_amount, settled_amount, status, metadata")
    .eq("organization_id", input.organizationId)
    .eq("counterparty_type", counterpartyType)
    .eq("counterparty_id", counterpartyId)
    .in("status", ["open", "partially_settled"])
    .neq("source_document_id", input.documentId)
    .order("issue_date", { ascending: true });

  if (openItemsError) {
    throw new Error(openItemsError.message);
  }

  const existingItems = ((openItemRows as Array<ExistingOpenItem & {
    metadata?: Record<string, unknown> | null;
  }> | null) ?? []).filter((item) => {
    const itemCurrencyCode = normalizeOpenItemCurrency(
      item.currency_code,
      monetaryContext.currencyCode,
    );
    const metadataKind =
      typeof item.metadata?.kind === "string"
        ? item.metadata.kind
        : null;

    if (itemCurrencyCode !== monetaryContext.currencyCode) {
      return isSettlementDocument;
    }

    if (isSettlementDocument) {
      return metadataKind === (input.documentRole === "sale" ? "receivable" : "payable");
    }

    return true;
  });

  const effectiveDocumentType =
    operationKind === "customer_receipt"
      ? "receipt"
      : operationKind === "supplier_payment"
        ? "payment_support"
        : input.documentType;

  const plan = buildOpenItemMutationPlan({
    organizationId: input.organizationId,
    documentId: input.documentId,
    documentRole: input.documentRole,
    documentType: effectiveDocumentType,
    openItemKind: requestedOpenItemKind,
    counterpartyType,
    counterpartyId,
    journalEntryId: input.journalEntryId,
    issueDate: input.documentDate,
    dueDate: input.dueDate,
    currencyCode: monetaryContext.currencyCode,
    functionalCurrencyCode: monetaryContext.functionalCurrencyCode,
    fxRate: monetaryContext.fxRate,
    fxRateDate: monetaryContext.fxRateDate,
    fxRateSource: monetaryContext.fxRateSource,
    monetaryContextSource: monetaryContext.resolutionSource,
    totalAmount: input.totalAmount,
    existingOpenItems: existingItems,
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
