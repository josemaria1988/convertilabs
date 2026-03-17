"use client";

type SettlementMethodCardProps = {
  paymentTerms: string;
  settlementMethod: string;
  settlementEvidenceSource: string;
  requiresFollowupSettlement: boolean;
  warning: string | null;
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function SettlementMethodCard(props: SettlementMethodCardProps) {
  return (
    <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
      <p className="font-semibold">Settlement</p>
      <p className="mt-2 text-[color:var(--color-muted)]">
        {formatLabel(props.paymentTerms)} / {formatLabel(props.settlementMethod)}
      </p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        Evidencia: {formatLabel(props.settlementEvidenceSource)}
      </p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        {props.requiresFollowupSettlement
          ? "Queda un follow-up settlement pendiente."
          : "No requiere follow-up adicional."}
      </p>
      {props.warning ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          {props.warning}
        </p>
      ) : null}
    </article>
  );
}
