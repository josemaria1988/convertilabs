import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
};

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: PageHeroProps) {
  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-10 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <span className="eyebrow">{eyebrow}</span>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-balance md:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[color:var(--color-muted)]">
              {description}
            </p>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {aside ? (
          <div className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-white/65 p-5">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
