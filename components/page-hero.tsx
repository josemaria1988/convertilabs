import type { ReactNode } from "react";

type HeroHighlight = {
  label: string;
  value: string;
};

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  highlights?: HeroHighlight[];
};

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  highlights,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[linear-gradient(135deg,rgba(19,24,31,0.98),rgba(31,29,26,0.94))] text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.28),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(217,119,6,0.16),transparent_18%)]" />
      <div className="absolute inset-y-0 right-0 hidden w-[42%] border-l border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] lg:block" />

      <div className="relative grid gap-10 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10 lg:py-12">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/72">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-warm)]" />
            {eyebrow}
          </span>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-balance md:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/72">
              {description}
            </p>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}

          {highlights?.length ? (
            <div className="grid gap-3 pt-2 md:grid-cols-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                    {highlight.label}
                  </p>
                  <p className="mt-3 text-xl font-semibold tracking-[-0.05em]">
                    {highlight.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {aside ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
