import { InlineSpinner } from "@/components/ui/inline-spinner";

type PageLoadingStateProps = {
  title?: string;
  message?: string;
  compact?: boolean;
};

export function PageLoadingState({
  title = "Cargando pantalla",
  message = "Estamos trayendo la informacion y preparando la siguiente vista.",
  compact = false,
}: PageLoadingStateProps) {
  return (
    <section className={`page-loading-state${compact ? " page-loading-state--compact" : ""}`}>
      <div className="page-loading-state__card">
        <span className="page-loading-state__eyebrow">
          <InlineSpinner className="h-4 w-4" />
          Cargando
        </span>
        <h1 className="page-loading-state__title">{title}</h1>
        <p className="page-loading-state__message">{message}</p>
        <div className="page-loading-state__skeletons" aria-hidden="true">
          <span className="page-loading-state__skeleton page-loading-state__skeleton--wide" />
          <span className="page-loading-state__skeleton" />
          <span className="page-loading-state__skeleton page-loading-state__skeleton--short" />
        </div>
      </div>
    </section>
  );
}
