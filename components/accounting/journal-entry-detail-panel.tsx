import type { ReactNode } from "react";
import {
  formatAccountingAmount,
  formatAccountingDate,
  formatAccountingDateTime,
  getConfirmabilityPillClass,
  getLifecycleStatusPillClass,
  getLineagePillClass,
} from "@/modules/accounting/read-model-presenters";
import type {
  JournalEntryDetail,
  JournalEntryDetailLine,
} from "@/modules/accounting/read-model-repository";
import {
  formatAccountRoleCodeLabel,
  formatLifecycleStatusLabel,
  formatLineageKindLabel,
  formatPostingModeLabel,
  formatProposalConfirmabilityLabel,
  formatSourceChannelLabel,
} from "@/modules/presentation/labels";

type JournalEntryDetailPanelProps = {
  detail: JournalEntryDetail | null;
  organizationSlug?: string | null;
  variant?: "panel" | "embedded";
  title?: string;
  emptyMessage?: string;
  adjustmentHref?: string | null;
  adjustmentAction?: ReactNode;
};

function formatLinePurpose(value: string | null | undefined) {
  switch (value) {
    case "main":
      return "Cuenta principal";
    case "tax":
      return "IVA";
    case "settlement":
      return "Cobro o pago";
    case "counterparty":
      return "Contrapartida";
    default:
      return value ? value.replace(/_/g, " ") : "Linea contable";
  }
}

function formatHash(value: string | null | undefined) {
  return value ? value.slice(0, 14) : "--";
}

function getLineDirection(line: Pick<JournalEntryDetailLine, "debit" | "credit">) {
  if (line.debit > 0) {
    return "Debe";
  }

  if (line.credit > 0) {
    return "Haber";
  }

  return "--";
}

function getDisplayAccountCode(line: JournalEntryDetailLine) {
  return line.externalAccountCode || line.accountCode || "--";
}

export function JournalEntryDetailPanel({
  detail,
  organizationSlug,
  variant = "panel",
  title = "Detalle del asiento",
  emptyMessage = "Selecciona un asiento para ver el Debe/Haber completo.",
  adjustmentHref,
  adjustmentAction,
}: JournalEntryDetailPanelProps) {
  const containerClass = variant === "embedded"
    ? "space-y-4"
    : "ui-panel space-y-4";

  if (!detail) {
    return (
      <section className={containerClass} data-testid="journal-entry-detail-empty">
        <div className="ui-panel-header">
          <h2 className="text-[16px] font-semibold text-white">{title}</h2>
          <span className="ui-filter">Sin asiento</span>
        </div>
        <p className="text-sm text-[color:var(--color-muted)]">{emptyMessage}</p>
      </section>
    );
  }

  const { entry } = detail;
  const sourceDocumentHref = organizationSlug && entry.sourceDocumentId
    ? `/app/o/${organizationSlug}/documents/${entry.sourceDocumentId}`
    : null;
  const resolvedAdjustmentHref = adjustmentHref
    ?? (sourceDocumentHref && detail.adjustment.canPrepare
      ? `${sourceDocumentHref}?adjustmentFrom=${entry.journalEntryId}`
      : null);
  const showFunctionalColumns = entry.currencyCode !== entry.functionalCurrencyCode;

  return (
    <section className={containerClass} data-testid="journal-entry-detail-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">{title}</h2>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
            {entry.entryNumber ? `Asiento #${entry.entryNumber}` : "Asiento sin numero"}
            {" | "}
            {formatAccountingDate(entry.entryDate)}
          </p>
        </div>
        <span className={getLifecycleStatusPillClass(entry.status)}>
          {formatLifecycleStatusLabel(entry.status)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Origen</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatSourceChannelLabel(entry.sourceChannel)}</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">{entry.reference ?? entry.description ?? "Sin referencia"}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Periodo y modo</p>
          <p className="mt-2 text-sm font-semibold text-white">{entry.fiscalPeriodCode ?? "--"}</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">{formatPostingModeLabel(entry.postingMode)}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-[12px] uppercase tracking-[0.12em] text-[color:var(--color-muted)]">Linaje</p>
          <p className="mt-2">
            <span className={getLineagePillClass(entry.lineageKind)}>
              {formatLineageKindLabel(entry.lineageKind)}
            </span>
          </p>
          <p className="mt-2 text-[13px] text-[color:var(--color-muted)]">
            Hoja {entry.isActiveLeaf ? "activa" : "reemplazada"} / {entry.isImmutable ? "inmutable" : "editable"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-white/8">
        <table className="data-table min-w-[900px]" data-testid="journal-entry-lines-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cuenta</th>
              <th>Rol</th>
              <th>Concepto</th>
              <th className="text-right">Debe</th>
              <th className="text-right">Haber</th>
              {showFunctionalColumns ? (
                <>
                  <th className="text-right">Debe func.</th>
                  <th className="text-right">Haber func.</th>
                </>
              ) : null}
              <th>FX</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.length === 0 ? (
              <tr>
                <td colSpan={showFunctionalColumns ? 9 : 7} className="px-6 py-10 text-center text-sm text-[color:var(--color-muted)]">
                  El asiento no tiene lineas visibles.
                </td>
              </tr>
            ) : (
              detail.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.lineNo}</td>
                  <td>
                    <div className="font-semibold text-white">
                      {getDisplayAccountCode(line)} - {line.accountName ?? "Cuenta sin nombre"}
                    </div>
                    <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                      {line.accountType ?? "sin tipo"}{line.accountProviderManaged ? " / proveedor" : ""}
                    </div>
                  </td>
                  <td>
                    <span className="status-pill status-pill--info">
                      {formatAccountRoleCodeLabel(line.roleCode)}
                    </span>
                  </td>
                  <td>
                    <div>{line.description ?? formatLinePurpose(line.linePurpose)}</div>
                    <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                      {formatLinePurpose(line.linePurpose)} / {getLineDirection(line)}
                    </div>
                  </td>
                  <td className="text-right">{formatAccountingAmount(line.debit)}</td>
                  <td className="text-right">{formatAccountingAmount(line.credit)}</td>
                  {showFunctionalColumns ? (
                    <>
                      <td className="text-right">{formatAccountingAmount(line.functionalDebit)}</td>
                      <td className="text-right">{formatAccountingAmount(line.functionalCredit)}</td>
                    </>
                  ) : null}
                  <td>
                    <div>{line.originalCurrencyCode ?? entry.currencyCode ?? "--"}</div>
                    <div className="mt-1 text-[12px] text-[color:var(--color-muted)]">
                      {line.fxRateApplied ?? entry.fxRate ?? "--"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right font-semibold">Totales</td>
              <td className="text-right font-semibold">{formatAccountingAmount(detail.totals.debit)}</td>
              <td className="text-right font-semibold">{formatAccountingAmount(detail.totals.credit)}</td>
              {showFunctionalColumns ? (
                <>
                  <td className="text-right font-semibold">{formatAccountingAmount(detail.totals.functionalDebit)}</td>
                  <td className="text-right font-semibold">{formatAccountingAmount(detail.totals.functionalCredit)}</td>
                </>
              ) : null}
              <td>{detail.totals.imbalance === 0 ? "Balanceado" : `Dif. ${formatAccountingAmount(detail.totals.imbalance)}`}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm">
          <p className="font-semibold text-white">Snapshot y proposal</p>
          <div className="mt-3 space-y-2 text-[color:var(--color-muted)]">
            <div className="ui-subtle-row">
              <span>Snapshot</span>
              <span>{formatHash(entry.accountingSnapshotFingerprint ?? detail.proposal?.accountingSnapshotFingerprint)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Proposal</span>
              <span className={getConfirmabilityPillClass(detail.proposal?.confirmabilityStatus ?? entry.postingProposalConfirmabilityStatus)}>
                {formatProposalConfirmabilityLabel(detail.proposal?.confirmabilityStatus ?? entry.postingProposalConfirmabilityStatus)}
              </span>
            </div>
            <div className="ui-subtle-row">
              <span>Hash fuente</span>
              <span>{formatHash(entry.sourceHash ?? detail.sourceEvent?.payloadHash)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Hash economico</span>
              <span>{formatHash(entry.economicHash ?? detail.proposal?.economicHash)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm">
          <p className="font-semibold text-white">Auditoria</p>
          <div className="mt-3 space-y-2 text-[color:var(--color-muted)]">
            <div className="ui-subtle-row">
              <span>Source event</span>
              <span>{formatHash(entry.sourceEventId)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Source external</span>
              <span>{entry.sourceExternalId ?? detail.sourceEvent?.sourceExternalId ?? "--"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Creado</span>
              <span>{formatAccountingDateTime(entry.createdAt)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Ultimo seen</span>
              <span>{formatAccountingDateTime(entry.lastSeenAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {detail.lineageRows.length > 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4 text-sm">
          <p className="font-semibold text-white">Linaje relacionado</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {detail.lineageRows.map((row) => (
              <div key={`${row.journalEntryId}-${row.relatedJournalEntryId}-${row.relationType}`} className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2">
                <p className="text-white">{formatLineageKindLabel(row.relationType)}</p>
                <p className="mt-1 text-[color:var(--color-muted)]">
                  {row.relatedEntryNumber ? `#${row.relatedEntryNumber}` : row.relatedJournalEntryId}
                  {" | "}
                  {formatAccountingDate(row.relatedEntryDate)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {sourceDocumentHref ? (
          <a href={sourceDocumentHref} className="ui-button ui-button--secondary">
            Abrir documento origen
          </a>
        ) : null}
        {resolvedAdjustmentHref ? (
          <a href={resolvedAdjustmentHref} className="ui-button ui-button--secondary">
            Editar con ajuste
          </a>
        ) : null}
        {adjustmentAction}
      </div>

      {!detail.adjustment.canPrepare && detail.adjustment.unavailableReason ? (
        <p className="text-[13px] text-[color:var(--color-muted)]">{detail.adjustment.unavailableReason}</p>
      ) : null}
    </section>
  );
}
