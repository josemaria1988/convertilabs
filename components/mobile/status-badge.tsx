import type { ReactNode } from "react";

type StatusBadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
};

function getToneClassName(tone: StatusBadgeTone) {
  switch (tone) {
    case "success":
      return "badge-dark-success";
    case "warning":
      return "badge-dark-warning";
    case "danger":
      return "badge-dark-danger";
    case "info":
      return "badge-dark-info";
    case "accent":
      return "badge-dark-accent";
    case "neutral":
    default:
      return "badge-dark-neutral";
  }
}

export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ${getToneClassName(tone)} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
