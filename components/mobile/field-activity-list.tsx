import { LoadingLink } from "@/components/ui/loading-link";
import type { FieldMobileActivityCard } from "@/modules/presentation/field-mobile";

type FieldActivityListProps = {
  title: string;
  description: string;
  emptyMessage: string;
  cards: FieldMobileActivityCard[];
};

function resolveStatusClassName(tone: FieldMobileActivityCard["statusTone"]) {
  switch (tone) {
    case "success":
      return "status-pill status-pill--success";
    case "warning":
      return "status-pill status-pill--warning";
    case "danger":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--info";
  }
}

export function FieldActivityList({
  title,
  description,
  emptyMessage,
  cards,
}: FieldActivityListProps) {
  return (
    <section className="field-panel">
      <div className="field-panel__header">
        <div>
          <p className="field-panel__eyebrow">Actividad</p>
          <h2 className="field-panel__title">{title}</h2>
          <p className="field-panel__description">{description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {cards.length === 0 ? (
          <div className="field-empty-state">
            {emptyMessage}
          </div>
        ) : (
          cards.map((card) => (
            <article key={card.id} className="field-activity-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="field-activity-card__title">{card.title}</p>
                  <p className="field-activity-card__subtitle">{card.subtitle}</p>
                </div>
                <span className={resolveStatusClassName(card.statusTone)}>
                  {card.statusLabel}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[color:var(--color-muted)]">
                {card.contextLabel ? (
                  <span className="field-inline-chip">{card.contextLabel}</span>
                ) : null}
                {card.detailLabel ? (
                  <span className="field-inline-chip">{card.detailLabel}</span>
                ) : null}
                <span className="field-inline-chip">Creado {card.createdAtLabel}</span>
              </div>

              {card.blockingReason ? (
                <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  {card.blockingReason}
                </div>
              ) : null}

              <LoadingLink
                href={card.href}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary mt-4 min-h-[42px] w-full"
              >
                {card.actionLabel}
              </LoadingLink>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
