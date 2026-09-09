import "server-only";
import { resolveLocalCompanionContext, type LocalCompanionDependencies, type LocalCompanionIdentity } from "./context";
import { loadCachedZetaReport, type LocalZetaReport } from "@/modules/integrations/zeta/cache/report-cache";
import { validateLocalZetaReportFilters, type LocalZetaReportKind, type ReportCell } from "@/modules/integrations/zeta/cache/report-contracts";
export { validateLocalZetaReportFilters };
export type { LocalZetaReportKind, ReportRow, Scalar } from "@/modules/integrations/zeta/cache/report-contracts";
export type { LocalZetaReport };
export type LocalZetaReportInput = LocalCompanionIdentity & { report: LocalZetaReportKind; filters: Record<string, unknown>; maxPages?: number };

/** Reports never initialize Zeta credentials or make an ERP request. */
export async function exportZetaReport(input: LocalZetaReportInput, deps: LocalCompanionDependencies = {}): Promise<LocalZetaReport> {
  const filters = validateLocalZetaReportFilters(input.report, input.filters);
  const context = await resolveLocalCompanionContext(input, deps);
  return loadCachedZetaReport({ ...context, report: input.report, filters });
}

export function serializeZetaReportCsv(report: LocalZetaReport): string {
  const cell = (value: ReportCell | undefined, column: string) => {
    let text = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (typeof value === "string" && (/^[\s]*[=+\-@\t\r\n]/.test(value) || /(^0\d+$)/.test(value) || /codigo|(^|_)id$|numero|serie|rut|documento/i.test(column))) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [report.columns.map((column) => cell(column, "")).join(","), ...report.rows.map((row) => report.columns.map((column) => cell(row[column], column)).join(","))].join("\r\n") + "\r\n";
}
