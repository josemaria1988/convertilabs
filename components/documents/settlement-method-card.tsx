"use client";

import {
  formatPaymentTermsLabel,
  formatSettlementEvidenceSourceLabel,
  formatSettlementMethodLabel,
} from "@/modules/presentation/labels";

type SettlementMethodCardProps = {
  paymentTerms: string;
  settlementMethod: string;
  settlementEvidenceSource: string;
  requiresFollowupSettlement: boolean;
  warning: string | null;
};

export function SettlementMethodCard(props: SettlementMethodCardProps) {
  return (
    <article className="rounded-2xl border border-[color:var(--color-border)] surface-card-dark p-4 text-sm">
      <p className="font-semibold">Cobro o pago</p>
      <p className="mt-2 text-[color:var(--color-muted)]">
        {formatPaymentTermsLabel(props.paymentTerms)} / {formatSettlementMethodLabel(props.settlementMethod)}
      </p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        Evidencia: {formatSettlementEvidenceSourceLabel(props.settlementEvidenceSource)}
      </p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        Uso: define como entra o sale el dinero, si el documento realmente lo demuestra.
      </p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        {props.requiresFollowupSettlement
          ? "Queda un movimiento posterior pendiente de registrar."
          : "No requiere un movimiento posterior adicional."}
      </p>
      {props.warning ? (
        <p className="alert-dark-warning mt-3 rounded-2xl px-3 py-2">
          {props.warning}
        </p>
      ) : null}
    </article>
  );
}
