import type { ReactNode } from "react";

type ChartMapShellProps = {
  summaryCards: ReactNode;
  toolbar: ReactNode;
  main: ReactNode;
  aside: ReactNode;
};

export function ChartMapShell({
  summaryCards,
  toolbar,
  main,
  aside,
}: ChartMapShellProps) {
  return (
    <div className="space-y-4">
      {summaryCards}
      {toolbar}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-4">{main}</div>
        <div className="space-y-4">{aside}</div>
      </div>
    </div>
  );
}
