import type { ReactNode } from "react";

type ConvertilabsLogoProps = {
  subtitle?: ReactNode;
  className?: string;
};

export function ConvertilabsLogo({
  subtitle,
  className,
}: ConvertilabsLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`.trim()}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#7ca6f1]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
        >
          <path
            fill="currentColor"
            d="M11.995 2.6 20.4 7.1v9.8l-8.405 4.5L3.6 16.9V7.1l8.395-4.5Zm0 2.18L5.57 8.214v7.572l6.425 3.435 6.435-3.435V8.214l-6.435-3.433Z"
          />
          <path
            fill="currentColor"
            d="m8.06 12.53 2.28-2.7 2.04 1.37 3.6-3.09v1.95l-3.52 3-2.1-1.41-2.3 2.72Z"
            opacity="0.9"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold tracking-[-0.03em] text-white">
          Convertilabs
        </p>
        {subtitle ? (
          <p className="truncate text-[12px] uppercase tracking-[0.16em] text-[color:var(--muted-soft)]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
