import type { ReactNode } from "react";
import { StatusBadge } from "@/components/mobile/status-badge";

type AccountingTemplateCardProps = {
  title: string;
  description: string;
  meta: string[];
  badgeLabel?: string | null;
  badgeTone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  footer?: ReactNode;
  selected?: boolean;
};

export function AccountingTemplateCard({
  title,
  description,
  meta,
  badgeLabel,
  badgeTone = "accent",
  footer,
  selected = false,
}: AccountingTemplateCardProps) {
  return (
    <article
      className={`rounded-3xl border p-4 ${
        selected
          ? "border-[rgba(94,130,184,0.32)] surface-card-state-accent"
          : "border-[color:var(--color-border)] surface-card-dark-soft"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-white">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{description}</p>
        </div>
        {badgeLabel ? <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge> : null}
      </div>

      {meta.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-[color:var(--color-border)] surface-card-dark-subtle px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-white">
            Cuentas afectadas
          </summary>
          <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
            {meta.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </details>
      ) : null}

      {footer ? <div className="mt-4">{footer}</div> : null}
    </article>
  );
}
