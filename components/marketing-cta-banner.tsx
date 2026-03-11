import type { ReactNode } from "react";

type MarketingCtaBannerProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
};

export function MarketingCtaBanner({
  eyebrow,
  title,
  description,
  actions,
}: MarketingCtaBannerProps) {
  return (
    <section className="panel overflow-hidden bg-[linear-gradient(135deg,rgba(255,252,247,0.92),rgba(223,245,242,0.56))] px-6 py-7 md:px-8 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-2xl space-y-4">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance">
            {title}
          </h2>
          <p className="text-base leading-8 text-[color:var(--color-muted)]">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  );
}
