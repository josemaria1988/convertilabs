"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { createAccountingExport } from "@/modules/exports";

function exportsPath(slug: string) {
  return `/app/o/${slug}/exports`;
}

export async function createAccountingExportAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
    throw new Error("Tu rol no puede generar exportaciones contables.");
  }

  const periodYear = Number(formData.get("periodYear") ?? 0);
  const periodMonth = Number(formData.get("periodMonth") ?? 0);
  const scope = String(formData.get("scope") ?? "all_posted");
  const layoutCode = String(formData.get("layoutCode") ?? "generic_csv");

  if (!Number.isInteger(periodYear) || !Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    throw new Error("Periodo invalido para exportacion contable.");
  }

  await createAccountingExport({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    periodYear,
    periodMonth,
    scope:
      scope === "posted_provisional" || scope === "posted_final"
        ? scope
        : "all_posted",
    layoutCode: layoutCode === "generic_excel_xml" ? layoutCode : "generic_csv",
  });

  revalidatePath(exportsPath(slug));
  revalidatePath(`/app/o/${slug}/journal-entries`);
  revalidatePath(`/app/o/${slug}/tax`);
}
