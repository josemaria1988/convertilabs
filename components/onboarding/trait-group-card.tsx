import type { ReactNode } from "react";

type TraitGroupCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function TraitGroupCard({
  title,
  description,
  children,
}: TraitGroupCardProps) {
  return (
    <section className="rounded-3xl border border-[color:var(--color-border)] bg-white/6 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">{description}</p>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
