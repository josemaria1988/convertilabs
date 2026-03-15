"use client";

import { useState, type ReactNode } from "react";

type ExpandableSectionCardProps = {
  title: string;
  description: string;
  children?: ReactNode;
  defaultOpen?: boolean;
};

export function ExpandableSectionCard({
  title,
  description,
  children,
  defaultOpen = false,
}: ExpandableSectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <article
      className={`surface-card transition-all duration-200 ${
        isOpen
          ? "xl:col-span-2 ring-1 ring-[rgba(124,157,255,0.18)]"
          : ""
      }`.trim()}
    >
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        aria-expanded={isOpen}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </h2>
          <p className="text-[14px] leading-6 text-[color:var(--color-muted)]">
            {description}
          </p>
        </div>

        <span
          className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white/6 text-[color:var(--color-muted)] transition-transform ${
            isOpen ? "rotate-180 text-white" : ""
          }`.trim()}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {isOpen ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
