import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  description,
  children,
  className,
}: SectionCardProps) {
  return (
    <article className={`panel p-6 ${className ?? ""}`.trim()}>
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-[-0.05em]">{title}</h2>
        <p className="text-sm leading-7 text-[color:var(--color-muted)]">
          {description}
        </p>
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </article>
  );
}
