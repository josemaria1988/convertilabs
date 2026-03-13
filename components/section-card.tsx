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
    <article className={`surface-card h-full ${className ?? ""}`.trim()}>
      <div className="space-y-1.5">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">
          {title}
        </h2>
        <p className="text-[14px] leading-6 text-[color:var(--color-muted)]">
          {description}
        </p>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
