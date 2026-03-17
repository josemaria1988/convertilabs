"use client";

import { useState } from "react";
import type { AccountingImpactPreview as AccountingImpactPreviewModel } from "@/modules/accounting/accounting-impact-preview";
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLinePurpose(value: string | null) {
  switch (value) {
    case "main":
      return "Linea principal";
    case "tax":
      return "Linea de impuesto";
    case "settlement":
      return "Linea de cobro o pago";
    default:
      return "Linea contable";
  }
}

export function AccountingImpactPreview({ preview }: AccountingImpactPreviewProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("journal");

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

      <div className="mt-4 grid gap-3 md:grid-cols-3">
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
          <p className="font-semibold">Cobro o pago</p>
          <p className="mt-2 text-[color:var(--color-muted)]">
            {formatPaymentTermsLabel(preview.summary.paymentTerms)} / {formatSettlementMethodLabel(preview.summary.settlementMethod)}
          </p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {formatSettlementStatusLabel(preview.summary.settlementStatus)}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Cuenta principal</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{preview.summary.mainAccount ?? "Pendiente"}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            Uso: explica el ingreso o gasto principal del documento.
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Cuenta IVA</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{preview.summary.vatAccount ?? "Pendiente"}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">Contraparte</p>
          <p className="mt-2 text-[color:var(--color-muted)]">{preview.summary.counterpartyAccount ?? "Pendiente"}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">
            {preview.summary.requiresFollowupSettlement
              ? "Requiere registrar un movimiento posterior"
              : "No tiene movimiento posterior pendiente"}
          </p>
        </div>
      </div>

      {preview.missingItems.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {preview.missingItems.join(" ")}
        </div>
      ) : null}

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
          {preview.journal.lines.map((line) => (
            <div key={line.lineNumber} className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{line.accountCode} - {line.accountName}</p>
                  <p className="text-[color:var(--color-muted)]">
                    {formatAccountRoleCodeLabel(line.roleCode)} · {formatLinePurpose(line.linePurpose)}
                  </p>
                  {line.isProvisional ? (
                    <p className="text-amber-900">Cuenta provisional</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p>Debe: {line.debit ? formatMoney(line.debit) : "-"}</p>
                  <p>Haber: {line.credit ? formatMoney(line.credit) : "-"}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 text-sm">
            Balance: {formatMoney(preview.journal.totalDebit)} / {formatMoney(preview.journal.totalCredit)}
          </div>
        </div>
      ) : null}

      {activeTab === "vat" ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/75 p-4 text-sm">
          <p className="font-semibold">{preview.vat.label}</p>
          <p className="mt-2 text-[color:var(--color-muted)]">Tratamiento: {formatVatBucketLabel(preview.vat.bucket)}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">IVA: {formatMoney(preview.vat.taxAmount)}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">IVA UYU: {formatMoney(preview.vat.taxAmountUyu)}</p>
          <p className="mt-1 text-[color:var(--color-muted)]">Deducibilidad: {formatVatDeductibilityStatusLabel(preview.vat.deductibilityStatus)}</p>
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
