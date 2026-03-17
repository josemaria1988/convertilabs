"use client";

type TemplatePreviewCardProps = {
  templateCode: string | null;
  operationKind: string | null;
  explanation: string;
  requiresFollowupSettlement: boolean;
};

function formatLabel(value: string | null) {
  return value ? value.replace(/_/g, " ") : "Pendiente";
}

export function TemplatePreviewCard(props: TemplatePreviewCardProps) {
  return (
    <article className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 p-4 text-sm">
      <p className="font-semibold">Template contable</p>
      <p className="mt-2 text-[color:var(--color-muted)]">{formatLabel(props.templateCode)}</p>
      <p className="mt-1 text-[color:var(--color-muted)]">
        Operacion: {formatLabel(props.operationKind)}
      </p>
      <p className="mt-3 text-[color:var(--color-muted)]">{props.explanation}</p>
      {props.requiresFollowupSettlement ? (
        <p className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-950">
          Esta plantilla deja un settlement posterior pendiente.
        </p>
      ) : null}
    </article>
  );
}
