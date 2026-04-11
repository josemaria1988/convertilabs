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
    <section className="panel overflow-hidden border-white/10 bg-[linear-gradient(135deg,#131a22_0%,#142229_54%,#1d1712_100%)] px-6 py-7 text-white md:px-8 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-2xl space-y-4">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance text-white">
            {title}
          </h2>
          <p className="text-base leading-8 text-white/68">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  );
}
