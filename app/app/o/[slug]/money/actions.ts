"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  canManageTreasury,
  confirmTreasuryValeRenewal,
  createTreasuryBankAccount,
  createTreasuryBalanceSnapshot,
  createTreasuryManualReceivable,
  createTreasuryVale,
  markTreasuryManualReceivableCollected,
  recordTreasuryValeClosure,
  recordTreasuryValeRenewal,
  TREASURY_BANK_ACCOUNT_TYPES,
  TREASURY_RECEIVABLE_CONFIDENCES,
  TREASURY_RECEIVABLE_STATUSES,
  TREASURY_SOURCE_TYPES,
  TREASURY_VALE_PLANNED_ACTIONS,
  updateTreasuryManualReceivable,
  upsertTreasuryReserveRule,
  type TreasuryBankAccountType,
  type TreasuryReceivableConfidence,
  type TreasuryReceivableStatus,
  type TreasurySourceType,
  type TreasuryValePlannedAction,
} from "@/modules/treasury";

function textValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const raw = textValue(formData, key);

  if (!raw) {
    return fallback;
  }

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Importe invalido en ${key}.`);
  }

  return parsed;
}

function choiceValue<T extends readonly string[]>(
  value: string | null,
  choices: T,
  fallback: T[number],
): T[number] {
  return value && choices.includes(value) ? value : fallback;
}

async function requireTreasuryMutation(slug: string) {
  const context = await requireOrganizationDashboardPage(slug);

  if (!canManageTreasury(context.organization.role)) {
    throw new Error("Tu rol no puede modificar tesoreria.");
  }

  return context;
}

function revalidateTreasuryPaths(slug: string, valeId?: string | null) {
  revalidatePath(`/app/o/${slug}/money`);
  revalidatePath(`/app/o/${slug}/dashboard`);

  if (valeId) {
    revalidatePath(`/app/o/${slug}/money/vales/${valeId}`);
  }
}

export async function createTreasuryBankAccountAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireTreasuryMutation(slug);

  await createTreasuryBankAccount(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    bankName: textValue(formData, "bankName") ?? "",
    name: textValue(formData, "name") ?? "",
    accountNumber: textValue(formData, "accountNumber"),
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    accountType: choiceValue(
      textValue(formData, "accountType"),
      TREASURY_BANK_ACCOUNT_TYPES,
      "checking",
    ) as TreasuryBankAccountType,
    currentBalance: numberValue(formData, "currentBalance"),
    balanceDate: textValue(formData, "balanceDate"),
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug);
}

export async function updateTreasuryBankBalanceAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireTreasuryMutation(slug);

  await createTreasuryBalanceSnapshot(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    bankAccountId: textValue(formData, "bankAccountId") ?? "",
    balance: numberValue(formData, "balance"),
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    snapshotDate: textValue(formData, "snapshotDate") ?? new Date().toISOString().slice(0, 10),
    source: choiceValue(
      textValue(formData, "source"),
      TREASURY_SOURCE_TYPES,
      "manual",
    ) as TreasurySourceType,
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug);
}

export async function updateTreasuryReserveRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireTreasuryMutation(slug);

  await upsertTreasuryReserveRule(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    minBufferAmount: numberValue(formData, "minBufferAmount"),
    horizonDays: Number(textValue(formData, "horizonDays") ?? 45),
  });

  revalidateTreasuryPaths(organization.slug);
}

export async function createTreasuryValeAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireTreasuryMutation(slug);

  const valeId = await createTreasuryVale(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    bankAccountId: textValue(formData, "bankAccountId"),
    bankName: textValue(formData, "bankName") ?? "",
    operationNumber: textValue(formData, "operationNumber"),
    internalReference: textValue(formData, "internalReference"),
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    originalPrincipal: numberValue(formData, "originalPrincipal"),
    issueDate: textValue(formData, "issueDate"),
    dueDate: textValue(formData, "dueDate") ?? "",
    expectedInterestAmount: numberValue(formData, "expectedInterestAmount"),
    expectedFeesAmount: numberValue(formData, "expectedFeesAmount"),
    plannedAction: choiceValue(
      textValue(formData, "plannedAction"),
      TREASURY_VALE_PLANNED_ACTIONS,
      "undecided",
    ) as TreasuryValePlannedAction,
    renewalOffered: textValue(formData, "renewalOffered") === "on",
    renewalConfirmed: textValue(formData, "renewalConfirmed") === "on",
    expectedNewDueDate: textValue(formData, "expectedNewDueDate"),
    expectedNewPrincipalAmount: textValue(formData, "expectedNewPrincipalAmount")
      ? numberValue(formData, "expectedNewPrincipalAmount")
      : null,
    source: choiceValue(
      textValue(formData, "source"),
      TREASURY_SOURCE_TYPES,
      "manual",
    ) as TreasurySourceType,
    sourceText: textValue(formData, "sourceText"),
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug, valeId);
}

export async function confirmTreasuryValeRenewalAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const valeId = textValue(formData, "valeId") ?? "";
  const { authState, organization } = await requireTreasuryMutation(slug);

  await confirmTreasuryValeRenewal(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    valeId,
    valeTermId: textValue(formData, "valeTermId") ?? "",
    expectedInterestAmount: numberValue(formData, "expectedInterestAmount"),
    expectedFeesAmount: numberValue(formData, "expectedFeesAmount"),
    expectedPartialPrincipalPayment: numberValue(formData, "expectedPartialPrincipalPayment"),
    expectedNewPrincipalAmount: textValue(formData, "expectedNewPrincipalAmount")
      ? numberValue(formData, "expectedNewPrincipalAmount")
      : null,
    expectedNewDueDate: textValue(formData, "expectedNewDueDate") ?? "",
    renewalConfirmed: textValue(formData, "renewalConfirmed") === "on",
    source: choiceValue(
      textValue(formData, "source"),
      TREASURY_SOURCE_TYPES,
      "manual",
    ) as TreasurySourceType,
    sourceText: textValue(formData, "sourceText"),
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug, valeId);
}

export async function recordTreasuryValeRenewalAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const valeId = textValue(formData, "valeId") ?? "";
  const { authState, organization } = await requireTreasuryMutation(slug);

  await recordTreasuryValeRenewal(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    valeId,
    valeTermId: textValue(formData, "valeTermId") ?? "",
    eventDate: textValue(formData, "eventDate") ?? new Date().toISOString().slice(0, 10),
    interestPaidAmount: numberValue(formData, "interestPaidAmount"),
    feesPaidAmount: numberValue(formData, "feesPaidAmount"),
    principalPaidAmount: numberValue(formData, "principalPaidAmount"),
    newPrincipalAmount: textValue(formData, "newPrincipalAmount")
      ? numberValue(formData, "newPrincipalAmount")
      : null,
    newDueDate: textValue(formData, "newDueDate") ?? "",
    source: choiceValue(
      textValue(formData, "source"),
      TREASURY_SOURCE_TYPES,
      "manual",
    ) as TreasurySourceType,
    sourceText: textValue(formData, "sourceText"),
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug, valeId);
}

export async function recordTreasuryValeClosureAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const valeId = textValue(formData, "valeId") ?? "";
  const { authState, organization } = await requireTreasuryMutation(slug);

  await recordTreasuryValeClosure(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    valeId,
    valeTermId: textValue(formData, "valeTermId") ?? "",
    eventDate: textValue(formData, "eventDate") ?? new Date().toISOString().slice(0, 10),
    principalPaidAmount: numberValue(formData, "principalPaidAmount"),
    interestPaidAmount: numberValue(formData, "interestPaidAmount"),
    feesPaidAmount: numberValue(formData, "feesPaidAmount"),
    source: choiceValue(
      textValue(formData, "source"),
      TREASURY_SOURCE_TYPES,
      "manual",
    ) as TreasurySourceType,
    sourceText: textValue(formData, "sourceText"),
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug, valeId);
}

export async function createTreasuryManualReceivableAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireTreasuryMutation(slug);

  await createTreasuryManualReceivable(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    customerName: textValue(formData, "customerName") ?? "",
    documentNumber: textValue(formData, "documentNumber"),
    description: textValue(formData, "description"),
    currencyCode: textValue(formData, "currencyCode") ?? "UYU",
    amount: numberValue(formData, "amount"),
    issueDate: textValue(formData, "issueDate"),
    expectedDate: textValue(formData, "expectedDate") ?? "",
    confidence: choiceValue(
      textValue(formData, "confidence"),
      TREASURY_RECEIVABLE_CONFIDENCES,
      "probable",
    ) as TreasuryReceivableConfidence,
    source: choiceValue(
      textValue(formData, "source"),
      TREASURY_SOURCE_TYPES,
      "manual",
    ) as TreasurySourceType,
    sourceText: textValue(formData, "sourceText"),
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug);
}

export async function updateTreasuryManualReceivableAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { organization } = await requireTreasuryMutation(slug);

  await updateTreasuryManualReceivable(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    receivableId: textValue(formData, "receivableId") ?? "",
    expectedDate: textValue(formData, "expectedDate"),
    confidence: choiceValue(
      textValue(formData, "confidence"),
      TREASURY_RECEIVABLE_CONFIDENCES,
      "probable",
    ) as TreasuryReceivableConfidence,
    status: choiceValue(
      textValue(formData, "status"),
      TREASURY_RECEIVABLE_STATUSES,
      "pending",
    ) as TreasuryReceivableStatus,
    notes: textValue(formData, "notes"),
  });

  revalidateTreasuryPaths(organization.slug);
}

export async function markTreasuryManualReceivableCollectedAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { organization } = await requireTreasuryMutation(slug);

  await markTreasuryManualReceivableCollected(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    receivableId: textValue(formData, "receivableId") ?? "",
    collectedAt: textValue(formData, "collectedAt") ?? new Date().toISOString().slice(0, 10),
  });

  revalidateTreasuryPaths(organization.slug);
}
