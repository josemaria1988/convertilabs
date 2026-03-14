"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  cancelSpreadsheetImport,
  confirmCompletedSpreadsheetImport,
  retrySpreadsheetImport,
  runSpreadsheetImport,
} from "@/modules/spreadsheets";

function buildPaths(slug: string) {
  return {
    imports: `/app/o/${slug}/imports`,
    tax: `/app/o/${slug}/tax`,
  };
}

export async function uploadSpreadsheetImportAction(input: {
  slug: string;
  formData: FormData;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!["owner", "admin", "accountant", "reviewer", "operator"].includes(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede importar planillas.",
    };
  }

  const file = input.formData.get("spreadsheet");
  const preferredModeRaw = String(input.formData.get("preferredMode") ?? "auto");

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Selecciona una planilla valida antes de importar.",
    };
  }

  const run = await runSpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    fileName: file.name,
    mimeType: file.type,
    bytes: await file.arrayBuffer(),
    preferredMode:
      preferredModeRaw === "interactive" || preferredModeRaw === "batch"
        ? preferredModeRaw
        : null,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);
  revalidatePath(paths.tax);

  return {
    ok: true,
    message: `Import ${run.status} para ${run.fileName}.`,
  };
}

export async function retrySpreadsheetImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const run = await retrySpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    runId: input.runId,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);
  revalidatePath(paths.tax);

  return {
    ok: true,
    message: `Reintento ${run.retryCount} lanzado para ${run.fileName}.`,
  };
}

export async function cancelSpreadsheetImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { organization } = await requireOrganizationDashboardPage(input.slug);
  const run = await cancelSpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    runId: input.runId,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);

  return {
    ok: true,
    message: `Import cancelado para ${run.fileName}.`,
  };
}

export async function confirmSpreadsheetImportAction(input: {
  slug: string;
  runId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const run = await confirmCompletedSpreadsheetImport({
    supabase: getSupabaseServiceRoleClient(),
    organizationId: organization.id,
    runId: input.runId,
    actorId: authState.user?.id ?? null,
  });
  const paths = buildPaths(input.slug);

  revalidatePath(paths.imports);
  revalidatePath(paths.tax);

  return {
    ok: true,
    message: `Preview confirmado para ${run.fileName}.`,
  };
}
