import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyConceptCode } from "@/modules/accounting/normalization";
import type { ChartOfAccountsImportCanonical } from "@/modules/spreadsheets/types";

export type ChartImportAccountStatus =
  | "ready"
  | "missing_code"
  | "missing_name"
  | "duplicate_in_import"
  | "duplicate_existing";

export type ChartImportPreviewAccount = {
  rowNumber: number;
  code: string;
  name: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense" | "memo";
  normalSide: "debit" | "credit";
  isPostable: boolean;
  status: ChartImportAccountStatus;
  warnings: string[];
};

export type ChartImportPreview = {
  accounts: ChartImportPreviewAccount[];
  warnings: string[];
  readyCount: number;
  blockedCount: number;
};

function normalizeAccountType(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (["asset", "activo", "activos", "circulante"].includes(normalized)) {
    return "asset" as const;
  }

  if (["liability", "pasivo", "pasivos", "proveedores"].includes(normalized)) {
    return "liability" as const;
  }

  if (["equity", "patrimonio", "capital"].includes(normalized)) {
    return "equity" as const;
  }

  if (["revenue", "ingreso", "ingresos", "venta", "ventas"].includes(normalized)) {
    return "revenue" as const;
  }

  if (["expense", "gasto", "gastos", "cost", "costo", "costos"].includes(normalized)) {
    return "expense" as const;
  }

  return "memo" as const;
}

function normalizeNormalSide(
  accountType: ReturnType<typeof normalizeAccountType>,
  value: string | null | undefined,
) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (["debit", "debito", "debe", "deudor"].includes(normalized)) {
    return "debit" as const;
  }

  if (["credit", "credito", "haber", "acreedor"].includes(normalized)) {
    return "credit" as const;
  }

  return ["asset", "expense", "memo"].includes(accountType)
    ? "debit"
    : "credit";
}

export function buildChartImportPreview(input: {
  canonical: ChartOfAccountsImportCanonical;
  existingAccountCodes?: string[];
}) {
  const existingAccountCodes = new Set(
    (input.existingAccountCodes ?? []).map((code) => code.trim()),
  );
  const seenCodes = new Set<string>();
  const accounts = input.canonical.accounts.map((account, index) => {
    const code = account.code.trim();
    const name = account.name.trim();
    const accountType = normalizeAccountType(account.accountType);
    const normalSide = normalizeNormalSide(accountType, account.normalSide);
    const warnings: string[] = [];
    let status: ChartImportAccountStatus = "ready";

    if (!code) {
      status = "missing_code";
      warnings.push("La cuenta no trae codigo.");
    } else if (!name) {
      status = "missing_name";
      warnings.push("La cuenta no trae nombre.");
    } else if (seenCodes.has(code)) {
      status = "duplicate_in_import";
      warnings.push("El codigo se repite dentro del mismo import.");
    } else if (existingAccountCodes.has(code)) {
      status = "duplicate_existing";
      warnings.push("El codigo ya existe en el plan de cuentas de la organizacion.");
    }

    if (code) {
      seenCodes.add(code);
    }

    return {
      rowNumber: index + 1,
      code,
      name,
      accountType,
      normalSide,
      isPostable: account.isPostable,
      status,
      warnings,
    } satisfies ChartImportPreviewAccount;
  });
  const blockedCount = accounts.filter((account) => account.status !== "ready").length;

  return {
    accounts,
    warnings: [
      ...input.canonical.warnings,
      ...(blockedCount > 0
        ? [`${blockedCount} cuenta(s) quedaron bloqueadas por validacion.`]
        : []),
    ],
    readyCount: accounts.length - blockedCount,
    blockedCount,
  } satisfies ChartImportPreview;
}

export async function loadExistingChartAccountCodes(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("code")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ code: string }> | null) ?? []).map((row) => row.code);
}

export async function persistChartImportPreview(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string | null;
    preview: ChartImportPreview;
  },
) {
  const readyRows = input.preview.accounts.filter((account) => account.status === "ready");

  if (readyRows.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: input.preview.accounts.length,
      insertedCodes: [],
    };
  }

  const payload = readyRows.map((account) => ({
    organization_id: input.organizationId,
    code: account.code,
    name: account.name,
    account_type: account.accountType,
    normal_side: account.normalSide,
    is_postable: account.isPostable,
    metadata: {
      source: "spreadsheet_import",
      imported_by: input.actorId,
      import_slug: slugifyConceptCode(account.name),
    },
  }));
  const { error } = await supabase
    .from("chart_of_accounts")
    .insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  return {
    insertedCount: readyRows.length,
    skippedCount: input.preview.accounts.length - readyRows.length,
    insertedCodes: readyRows.map((row) => row.code),
  };
}
