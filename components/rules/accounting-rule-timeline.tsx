import type { AccountingRuleTimelineItem } from "@/modules/accounting/rules-admin";

type AccountingRuleTimelineProps = {
  items: AccountingRuleTimelineItem[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountingRuleTimeline({ items }: AccountingRuleTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
        Todavia no hay eventos visibles para esta regla.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                {item.actorDisplay ?? "Sistema"} / {formatDateTime(item.createdAt)}
              </p>
            </div>
            <span className="ui-filter">
              {item.source === "rule_event" ? "Evento" : "Audit log"}
            </span>
          </div>

          {item.reason ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-muted)]">
              {item.reason}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
