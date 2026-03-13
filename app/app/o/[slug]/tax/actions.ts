"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { createVatRunExport } from "@/modules/exports";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { updateVatRunLifecycle } from "@/modules/tax/vat-runs";

function taxPath(slug: string) {
  return `/app/o/${slug}/tax`;
}

export async function updateVatRunLifecycleAction(input: {
  slug: string;
  vatRunId: string;
  action: "review" | "finalize" | "lock" | "reopen";
  reason?: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede mutar periodos IVA.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  await updateVatRunLifecycle({
    supabase,
    organizationId: organization.id,
    runId: input.vatRunId,
    actorId: authState.user?.id ?? null,
    action: input.action,
    reason: input.reason ?? null,
  });

  revalidatePath(taxPath(input.slug));

  return {
    ok: true,
    message: "Periodo IVA actualizado.",
  };
}

export async function createVatRunExportAction(input: {
  slug: string;
  vatRunId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede generar exports.",
      downloadUrl: null,
    };
  }

  const result = await createVatRunExport({
    organizationId: organization.id,
    vatRunId: input.vatRunId,
    actorId: authState.user?.id ?? null,
  });

  revalidatePath(taxPath(input.slug));

  return {
    ok: true,
    message: "Export generado.",
    downloadUrl: result.downloadUrl,
  };
}
