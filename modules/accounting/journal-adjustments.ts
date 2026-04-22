import { roundCurrency } from "@/modules/accounting/normalization";
import { isFiscalPeriodMutableForDocument } from "@/modules/accounting/fiscal-period-status";
import type {
  JournalEntryDetail,
  JournalEntryDetailLine,
} from "@/modules/accounting/read-model-repository";

export type JournalAdjustmentGuardCode =
  | "missing_reason"
  | "missing_document"
  | "provider_managed"
  | "not_active_leaf"
  | "not_posted"
  | "period_locked"
  | "unbalanced"
  | "missing_account"
  | "non_postable_account";

export type JournalAdjustmentGuardResult = {
  ok: boolean;
  blockers: Array<{
    code: JournalAdjustmentGuardCode;
    message: string;
  }>;
};

export type JournalAdjustmentDraftLine = Pick<
  JournalEntryDetailLine,
  "accountId" | "accountIsPostable" | "accountIsImputable" | "debit" | "credit"
>;

export function evaluateDocumentBackedJournalAdjustment(input: {
  detail: Pick<JournalEntryDetail, "entry" | "lines">;
  reason: string | null | undefined;
  adjustedLines?: JournalAdjustmentDraftLine[] | null;
}): JournalAdjustmentGuardResult {
  const blockers: JournalAdjustmentGuardResult["blockers"] = [];
  const { entry } = input.detail;
  const lines = input.adjustedLines ?? input.detail.lines;

  if (!input.reason?.trim()) {
    blockers.push({
      code: "missing_reason",
      message: "El ajuste requiere un motivo auditable.",
    });
  }

  if (!entry.sourceDocumentId) {
    blockers.push({
      code: "missing_document",
      message: "Solo los asientos con documento origen pueden ajustarse desde este flujo.",
    });
  }

  if (entry.providerManaged) {
    blockers.push({
      code: "provider_managed",
      message: "Los asientos administrados por proveedor quedan solo lectura en v1.",
    });
  }

  if (!entry.isActiveLeaf) {
    blockers.push({
      code: "not_active_leaf",
      message: "Este asiento ya fue reemplazado por otro asiento posterior.",
    });
  }

  if (!["posted", "exported"].includes(entry.status ?? "")) {
    blockers.push({
      code: "not_posted",
      message: "Solo se ajustan asientos posteados o exportados.",
    });
  }

  if (!isFiscalPeriodMutableForDocument(entry.fiscalPeriodStatus)) {
    blockers.push({
      code: "period_locked",
      message: "El periodo contable no admite ajustes documentales sin reapertura formal.",
    });
  }

  const totalDebit = roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0));

  if (roundCurrency(totalDebit - totalCredit) !== 0) {
    blockers.push({
      code: "unbalanced",
      message: "El asiento ajustado debe quedar balanceado.",
    });
  }

  for (const line of lines) {
    if (!line.accountId) {
      blockers.push({
        code: "missing_account",
        message: "Todas las lineas del ajuste deben tener cuenta contable.",
      });
      break;
    }

    if (line.accountIsPostable === false || line.accountIsImputable === false) {
      blockers.push({
        code: "non_postable_account",
        message: "Todas las cuentas del ajuste deben ser postables e imputables.",
      });
      break;
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
  };
}
