"use client";

import { useState } from "react";
import type { AccountingImpactPreview as AccountingImpactPreviewModel } from "@/modules/accounting/accounting-impact-preview";
import type { ReviewJournalLine } from "@/modules/accounting/types";
import {
  formatAccountRoleCodeLabel,
  formatOperationKindLabel,
  formatPaymentTermsLabel,
  formatPostingTemplateCodeLabel,
  formatSettlementMethodLabel,
  formatSettlementStatusLabel,
  formatVatBucketLabel,
  formatVatDeductibilityStatusLabel,
} from "@/modules/presentation/labels";

type AccountingImpactPreviewProps = {
  preview: AccountingImpactPreviewModel;
};

const tabs = [
  { key: "journal", label: "Asiento" },
  { key: "vat", label: "IVA" },
  { key: "open_items", label: "Saldos abiertos" },
  { key: "warnings", label: "Observaciones" },
] as const;

function formatMoney(value: number, currency = "UYU") {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(parsed);
}

function formatFxRate(value: number) {
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatFxSource(value: string | null | undefined) {
  switch (value) {
    case "same_currency":
      return "Misma moneda funcional";
    case "bcu":
      return "BCU";
    case "manual_override":
      return "Manual auditado";
    case "document_import":
      return "Importado desde ERP";
    case "document_default":
      return "Politica fiscal por defecto";
    default:
      return value ? value.replace(/_/g, " ") : "Sin origen";
  }
}

function formatLinePurpose(value: string | null) {
  switch (value) {
    case "main":
      return "Cuenta del concepto";
    case "tax":
      return "IVA";
    case "settlement":
      return "Cobro o pago";
    case "counterparty":
      return "Contrapartida";
    default:
      return "Linea contable";
  }
}

function getLineDirection(line: Pick<ReviewJournalLine, "debit" | "credit">) {
  if (line.debit > 0) {
    return "debit" as const;
  }

  if (line.credit > 0) {
    return "credit" as const;
  }

  return "none" as const;
}

function getLineDirectionLabel(direction: ReturnType<typeof getLineDirection>) {
  switch (direction) {
    case "debit":
      return "Debe";
    case "credit":
      return "Haber";
    default:
      return "Sin movimiento";
  }
}

function getDirectionClasses(direction: ReturnType<typeof getLineDirection>) {
  switch (direction) {
    case "debit":
      return "bg-emerald-100 text-emerald-900";
    case "credit":
      return "bg-sky-100 text-sky-900";
    default:
      return "bg-slate-100 text-slate-900";
  }
}

function getLineDocumentAmount(line: Pick<ReviewJournalLine, "debit" | "credit">) {
  return line.debit > 0 ? line.debit : line.credit;
}

function getLineFunctionalAmount(
  line: Pick<ReviewJournalLine, "functionalDebit" | "functionalCredit">,
) {
  return line.functionalDebit > 0 ? line.functionalDebit : line.functionalCredit;
}

function JournalGroupCard(input: {
  title: string;
  lines: ReviewJournalLine[];
  emptyMessage: string;
  currencyCode: string;
  functionalCurrencyCode: string;
  showFunctionalAmounts: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
      <p className="font-semibold">{input.title}</p>
      {input.lines.length === 0 ? (
        <p className="mt-2 text-[color:var(--color-muted)]">{input.emptyMessage}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {input.lines.map((line) => {
            const direction = getLineDirection(line);
            const directionLabel = getLineDirectionLabel(direction);

            return (
              <div key={`${input.title}-${line.lineNumber}`} className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3">
                <p className="font-medium">{line.accountCode} - {line.accountName}</p>
                <p className="mt-1 text-[color:var(--color-muted)]">
                  {formatAccountRoleCodeLabel(line.roleCode)} | {formatLinePurpose(line.linePurpose)}
                </p>
                <p className="mt-2 text-[color:var(--color-muted)]">
                  {directionLabel}: {formatMoney(getLineDocumentAmount(line), input.currencyCode)}
                </p>
                {input.showFunctionalAmounts ? (
                  <p className="mt-1 text-[color:var(--color-muted)]">
                    Contable {input.functionalCurrencyCode}: {formatMoney(
                      getLineFunctionalAmount(line),
                      input.functionalCurrencyCode,
                    )}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AccountingImpactPreview({ preview }: AccountingImpactPreviewProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("journal");
  const functionalCurrencyCode = preview.summary.functionalCurrencyCode || "UYU";
  const showFunctionalAmounts = preview.summary.currencyCode !== functionalCurrencyCode;
  const debitLines = preview.journal.lines.filter((line) =>
    line.debit > 0 && line.linePurpose !== "tax"
  );
  const creditLines = preview.journal.lines.filter((line) =>
    line.credit > 0 && line.linePurpose !== "tax"
  );
  const vatLines = preview.journal.lines.filter((line) =>
    line.linePurpose === "tax" || (typeof line.taxTag === "string" && line.taxTag.includes("vat"))
  );

  return (
    <article className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.04em]">Impacto contable y fiscal</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Vista previa antes del posteo, separada de la confirmacion final.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
          preview.ready
            ? "bg-emerald-100 text-emerald-900"
            : "bg-amber-100 text-amber-900"
        }`}>
          {preview.ready ? "Listo" : "Incompleto"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-5">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Plantilla contable</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            {formatPostingTemplateCodeLabel(preview.summary.templateCode)}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatOperationKindLabel(preview.summary.operationKind)}
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Moneda y valuacion</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            Documento: {formatMoney(preview.journal.totalDebit, preview.summary.currencyCode)}
          </p>
          {showFunctionalAmounts ? (
            <p className="mt-1 text-[color:var(--color-muted)]">
              Contable {functionalCurrencyCode}: {formatMoney(
                preview.journal.functionalTotalDebit,
                functionalCurrencyCode,
              )}
            </p>
          ) : (
            <p className="mt-1 text-[color:var(--color-muted)]">
              Moneda funcional: {functionalCurrencyCode}
            </p>
          )}
          <p className="mt-1 text-[color:var(--color-muted)]">
            Tipo de cambio: {showFunctionalAmounts ? formatFxRate(preview.summary.fxRate) : "No aplica"}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatFxSource(preview.summary.fxRateSource)} / {formatDate(preview.summary.fxRateDate)}
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Cuenta del concepto</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{preview.summary.mainAccount ?? "Pendiente"}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Explica que se vendio, compro o gasto. No es caja, banco ni IVA.
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Cobro o pago</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            {preview.summary.settlementAccount ?? "Pendiente"}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatPaymentTermsLabel(preview.summary.paymentTerms)} / {formatSettlementMethodLabel(preview.summary.settlementMethod)}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {preview.summary.counterpartyAccount
              ? `Contrapartida posterior: ${preview.summary.counterpartyAccount}`
              : preview.summary.requiresFollowupSettlement
                ? "Queda un movimiento posterior pendiente."
                : formatSettlementStatusLabel(preview.summary.settlementStatus)}
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Cuenta IVA</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{preview.summary.vatAccount ?? "Pendiente"}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Tratamiento: {formatVatBucketLabel(preview.vat.bucket)}
          </p>
        </div>
      </div>

      {preview.missingItems.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {preview.missingItems.join(" ")}
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-sm font-semibold">Lectura rapida del asiento</p>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Separada en debe, haber e IVA para revisar la logica contable sin tener que interpretar la plantilla.
        </p>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <JournalGroupCard
            title="Debe"
            lines={debitLines}
            emptyMessage="No hay cuentas en el debe."
            currencyCode={preview.summary.currencyCode}
            functionalCurrencyCode={functionalCurrencyCode}
            showFunctionalAmounts={showFunctionalAmounts}
          />
          <JournalGroupCard
            title="Haber"
            lines={creditLines}
            emptyMessage="No hay cuentas en el haber."
            currencyCode={preview.summary.currencyCode}
            functionalCurrencyCode={functionalCurrencyCode}
            showFunctionalAmounts={showFunctionalAmounts}
          />
          <JournalGroupCard
            title="IVA"
            lines={vatLines}
            emptyMessage="No hay movimiento de IVA para este documento."
            currencyCode={preview.summary.currencyCode}
            functionalCurrencyCode={functionalCurrencyCode}
            showFunctionalAmounts={showFunctionalAmounts}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-3 py-2 text-sm transition ${
              activeTab === tab.key
                ? "bg-[color:var(--color-accent)] text-white"
                : "border border-[color:var(--color-border)] bg-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "journal" ? (
        <div className="mt-4 space-y-3">
          {preview.journal.lines.map((line) => {
            const direction = getLineDirection(line);
            const directionLabel = getLineDirectionLabel(direction);

            return (
              <div key={line.lineNumber} className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{line.accountCode} - {line.accountName}</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${getDirectionClasses(direction)}`}>
                        {directionLabel}
                      </span>
                    </div>
                    <p className="text-[color:var(--color-muted)]">
                      {formatAccountRoleCodeLabel(line.roleCode)} | {formatLinePurpose(line.linePurpose)}
                    </p>
                    {line.isProvisional ? (
                      <p className="text-amber-900">Cuenta provisional</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p>{directionLabel}: {formatMoney(getLineDocumentAmount(line), preview.summary.currencyCode)}</p>
                    {showFunctionalAmounts ? (
                      <p className="text-[color:var(--color-muted)]">
                        Contable {functionalCurrencyCode}: {formatMoney(
                          getLineFunctionalAmount(line),
                          functionalCurrencyCode,
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm">
            <p>
              Balance documento: {formatMoney(preview.journal.totalDebit, preview.summary.currencyCode)}
              {" / "}
              {formatMoney(preview.journal.totalCredit, preview.summary.currencyCode)}
            </p>
            {showFunctionalAmounts ? (
              <p className="mt-1 text-[color:var(--color-muted)]">
                Balance contable {functionalCurrencyCode}: {formatMoney(
                  preview.journal.functionalTotalDebit,
                  functionalCurrencyCode,
                )}
                {" / "}
                {formatMoney(preview.journal.functionalTotalCredit, functionalCurrencyCode)}
              </p>
            ) : null}
            <p className="mt-1 text-[color:var(--color-muted)]">
              {preview.journal.isBalanced ? "El asiento ya balancea." : "El asiento aun no balancea."}
            </p>
          </div>
        </div>
      ) : null}

      {activeTab === "vat" ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">{preview.vat.label}</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            Tratamiento: {formatVatBucketLabel(preview.vat.bucket)}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            IVA documento: {formatMoney(preview.vat.taxAmount, preview.summary.currencyCode)}
          </p>
          {showFunctionalAmounts ? (
            <p className="mt-1 text-[color:var(--color-muted)]">
              IVA contable {functionalCurrencyCode}: {formatMoney(
                preview.vat.taxAmountUyu,
                functionalCurrencyCode,
              )}
            </p>
          ) : null}
          <p className="mt-1 text-[color:var(--color-muted)]">
            Deducibilidad: {formatVatDeductibilityStatusLabel(preview.vat.deductibilityStatus)}
          </p>
        </div>
      ) : null}

      {activeTab === "open_items" ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">{preview.openItems.expected ? "Se espera un saldo abierto" : "No se espera un saldo abierto"}</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{preview.openItems.reason}</p>
        </div>
      ) : null}

      {activeTab === "warnings" ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm text-[color:var(--color-muted)]">
          {preview.warnings.length > 0 ? preview.warnings.join(" ") : "Sin observaciones adicionales."}
        </div>
      ) : null}
    </article>
  );
}
