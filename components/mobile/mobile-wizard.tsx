import type { ReactNode } from "react";

type MobileWizardProps = {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  caption?: string;
  children: ReactNode;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  footerNote?: ReactNode;
};

export function MobileWizard({
  step,
  totalSteps,
  title,
  description,
  caption = "Ruta guiada",
  children,
  primaryAction,
  secondaryAction,
  footerNote,
}: MobileWizardProps) {
  const progressValue = `${Math.min(100, Math.max(0, (step / totalSteps) * 100))}%`;

  return (
    <section className="panel overflow-hidden p-0">
      <div className="border-b border-[color:var(--color-border)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Paso {step} de {totalSteps}
          </p>
          <p className="text-xs text-[color:var(--color-muted)]">
            {caption}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#5c85cf,#79b6d7)]"
            style={{ width: progressValue }}
          />
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-[-0.05em]">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{description}</p>
      </div>

      <div className="px-4 py-4">{children}</div>

      <div className="border-t border-[color:var(--color-border)] px-4 py-4">
        <div className="flex flex-col gap-3">
          {footerNote}
          <div className="flex flex-col gap-3">
            {primaryAction}
            {secondaryAction}
          </div>
        </div>
      </div>
    </section>
  );
}
