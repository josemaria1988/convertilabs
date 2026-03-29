"use client";

import {
  formatOperationKindLabel,
  formatPostingTemplateCodeLabel,
} from "@/modules/presentation/labels";

type TemplatePreviewCardProps = {
  templateCode: string | null;
  operationKind: string | null;
  explanation: string;
  requiresFollowupSettlement: boolean;
};

export function TemplatePreviewCard(props: TemplatePreviewCardProps) {
  return (
    <article className="rounded-2xl border border-[color:var(--color-border)] surface-card-dark p-4 text-sm">
      <p className="font-semibold">Plantilla contable</p>
      <p className="mt-2 text-[color:var(--color-muted)]">
        {formatPostingTemplateCodeLabel(props.templateCode)}
      </p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        Operacion: {formatOperationKindLabel(props.operationKind)}
      </p>
      <p className="mt-3 text-[color:var(--color-muted)]">
        Uso: define que lineas contables se van a generar para este documento.
      </p>
      <p className="mt-3 text-[color:var(--color-muted)]">{props.explanation}</p>
      {props.requiresFollowupSettlement ? (
        <p className="alert-dark-info mt-3 rounded-2xl px-3 py-2">
          Esta plantilla requiere registrar un cobro o pago posterior.
        </p>
      ) : null}
    </article>
  );
}
