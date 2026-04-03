import type { FieldMobileSummaryCard } from "@/modules/presentation/field-mobile";

type FieldStatusSummaryProps = {
  cards: FieldMobileSummaryCard[];
};

function resolveSummaryToneClassName(tone: FieldMobileSummaryCard["tone"]) {
  switch (tone) {
    case "success":
      return "field-summary-card field-summary-card--success";
    case "warning":
      return "field-summary-card field-summary-card--warning";
    default:
      return "field-summary-card field-summary-card--accent";
  }
}

export function FieldStatusSummary({ cards }: FieldStatusSummaryProps) {
  return (
    <section className="field-summary-grid">
      {cards.map((card) => (
        <article key={card.key} className={resolveSummaryToneClassName(card.tone)}>
          <p className="field-summary-card__label">{card.label}</p>
          <p className="field-summary-card__value">{card.value}</p>
          <p className="field-summary-card__helper">{card.helper}</p>
        </article>
      ))}
    </section>
  );
}
