"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  closeDgiReconciliationRun,
  createDgiReconciliationRun,
  updateDgiReconciliationBucket,
} from "@/modules/tax/dgi-reconciliation";
import { reopenDocumentReview } from "@/modules/documents/review";
import type { DgiReconciliationBucketCode } from "@/modules/tax/dgi-summary-normalizer";

const bucketFields: Array<{
  code: DgiReconciliationBucketCode;
  netField: string;
  taxField: string;
}> = [
  { code: "sales_basic", netField: "salesBasicNet", taxField: "salesBasicTax" },
  { code: "sales_minimum", netField: "salesMinimumNet", taxField: "salesMinimumTax" },
  { code: "purchase_basic", netField: "purchaseBasicNet", taxField: "purchaseBasicTax" },
  { code: "purchase_minimum", netField: "purchaseMinimumNet", taxField: "purchaseMinimumTax" },
  { code: "exempt_or_non_taxed", netField: "exemptNet", taxField: "exemptTax" },
  { code: "import_vat", netField: "importVatNet", taxField: "importVatTax" },
  { code: "import_vat_advance", netField: "importVatAdvanceNet", taxField: "importVatAdvanceTax" },
  { code: "withholdings", netField: "withholdingsNet", taxField: "withholdingsTax" },
];

function reconciliationPath(slug: string) {
  return `/app/o/${slug}/tax/reconciliation`;
}

function taxPath(slug: string) {
  return `/app/o/${slug}/tax`;
}

function parseDecimal(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : 0;
}

export async function createDgiReconciliationRunAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
    throw new Error("Tu rol no puede crear corridas DGI.");
  }

  const periodYear = Number(formData.get("periodYear") ?? 0);
  const periodMonth = Number(formData.get("periodMonth") ?? 0);

  if (!Number.isInteger(periodYear) || !Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    throw new Error("Periodo DGI invalido.");
  }

  const baseline = Object.fromEntries(bucketFields.map((bucket) => [
    bucket.code,
    {
      netAmountUyu: parseDecimal(formData.get(bucket.netField)),
      taxAmountUyu: parseDecimal(formData.get(bucket.taxField)),
    },
  ])) as Record<DgiReconciliationBucketCode, { netAmountUyu: number; taxAmountUyu: number }>;
  const result = await createDgiReconciliationRun(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    periodYear,
    periodMonth,
    sourceKind: "manual_summary",
    baseline,
    metadata: {
      source_label: "manual_summary",
      user_note: String(formData.get("note") ?? ""),
    },
  });

  revalidatePath(reconciliationPath(slug));
  revalidatePath(taxPath(slug));
  redirect(`${reconciliationPath(slug)}?run=${result.runId}`);
}

export async function reviewDgiBucketAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { organization } = await requireOrganizationDashboardPage(slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
    throw new Error("Tu rol no puede revisar buckets DGI.");
  }

  const runId = String(formData.get("runId") ?? "");
  const bucketId = String(formData.get("bucketId") ?? "");
  const action = String(formData.get("action") ?? "justify");
  const note = String(formData.get("note") ?? "");

  await updateDgiReconciliationBucket(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    runId,
    bucketId,
    note: note.trim() ? note.trim() : null,
    action: action === "mark_external_adjustment" ? "mark_external_adjustment" : "justify",
  });

  revalidatePath(reconciliationPath(slug));
  revalidatePath(taxPath(slug));
}

export async function closeDgiReconciliationRunAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { organization } = await requireOrganizationDashboardPage(slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant"].includes(role)) {
    throw new Error("Tu rol no puede cerrar conciliaciones DGI.");
  }

  await closeDgiReconciliationRun(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    runId: String(formData.get("runId") ?? ""),
  });

  revalidatePath(reconciliationPath(slug));
  revalidatePath(taxPath(slug));
}

export async function reopenDocumentFromDgiAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const role = organization.role;

  if (!["owner", "admin"].includes(role)) {
    throw new Error("Solo owner y admin pueden reabrir documentos desde conciliacion.");
  }

  await reopenDocumentReview({
    organizationId: organization.id,
    documentId: String(formData.get("documentId") ?? ""),
    actorId: authState.user?.id ?? null,
  });

  revalidatePath(reconciliationPath(slug));
  revalidatePath(`/app/o/${slug}/documents`);
  revalidatePath(`/app/o/${slug}/journal-entries`);
}
