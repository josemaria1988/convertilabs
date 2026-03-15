"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HelpHintContent } from "@/modules/explanations/types";
import { getHelpHintContent } from "@/modules/ui/help-hints-registry";

type HelpHintProps = {
  contentKey?: string;
  content?: HelpHintContent | null;
  className?: string;
  mode?: "tooltip" | "popover";
  size?: "sm" | "md";
  tone?: "neutral" | "info" | "warning";
};

export function HelpHint({
  contentKey,
  content,
  className,
  mode = "popover",
  size = "sm",
  tone = "neutral",
}: HelpHintProps) {
  const resolvedContent = useMemo(
    () => content ?? (contentKey ? getHelpHintContent(contentKey) : null),
    [content, contentKey],
  );
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isPinned) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsPinned(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPinned(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPinned]);

  if (!resolvedContent) {
    return null;
  }

  const buttonClasses = {
    neutral: "border-[color:var(--color-border)] bg-white/10 text-[color:var(--color-muted)] hover:text-white",
    info: "border-sky-300/35 bg-sky-500/10 text-sky-100 hover:text-white",
    warning: "border-amber-300/35 bg-amber-500/10 text-amber-100 hover:text-white",
  }[tone];
  const sizeClasses = size === "md"
    ? "h-6 w-6 text-[12px]"
    : "h-5 w-5 text-[11px]";
  const shouldShowPreview = mode === "tooltip" ? isHovering || isPinned : isHovering && !isPinned;

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex ${className ?? ""}`.trim()}
      onMouseEnter={() => {
        setIsHovering(true);
      }}
      onMouseLeave={() => {
        setIsHovering(false);
      }}
    >
      <button
        type="button"
        aria-label={`Ayuda sobre ${resolvedContent.title}`}
        aria-expanded={isPinned}
        onClick={() => {
          setIsPinned((current) => !current);
        }}
        className={`inline-flex items-center justify-center rounded-full border font-semibold transition ${sizeClasses} ${buttonClasses}`}
      >
        ?
      </button>

      {shouldShowPreview && !isPinned ? (
        <span className="absolute left-1/2 top-[calc(100%+8px)] z-20 min-w-[220px] max-w-[280px] -translate-x-1/2 rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(20,27,40,0.98)] px-3 py-2 text-xs leading-5 text-[color:var(--color-muted)] shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
          {resolvedContent.shortLabel}
        </span>
      ) : null}

      {isPinned ? (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-30 w-[min(340px,calc(100vw-40px))] -translate-x-1/2 rounded-[14px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-4 shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-white">{resolvedContent.title}</p>
              <p className="mt-1 text-[13px] leading-6 text-[color:var(--color-muted)]">
                {resolvedContent.shortLabel}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Que es
              </p>
              <p className="mt-1 text-[13px] leading-6 text-white/90">{resolvedContent.whatIsIt}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Por que importa
              </p>
              <p className="mt-1 text-[13px] leading-6 text-white/90">{resolvedContent.whyItMatters}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Impacto
              </p>
              <p className="mt-1 text-[13px] leading-6 text-white/90">{resolvedContent.impact}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Que puedes hacer
              </p>
              <p className="mt-1 text-[13px] leading-6 text-white/90">{resolvedContent.whatCanYouDo}</p>
            </div>

            {resolvedContent.sourceLabel ? (
              <div className="rounded-xl border border-[color:var(--color-border)] bg-white/5 px-3 py-2 text-[12px] leading-5 text-[color:var(--color-muted)]">
                Fuente: {resolvedContent.sourceLabel}
              </div>
            ) : null}

            {resolvedContent.expertNotes?.length ? (
              <details className="rounded-xl border border-[color:var(--color-border)] bg-white/5 px-3 py-2 text-[12px] leading-5 text-[color:var(--color-muted)]">
                <summary className="cursor-pointer font-medium text-white">Ver fundamento</summary>
                <div className="mt-2 space-y-2">
                  {resolvedContent.expertNotes.map((note: string) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </span>
  );
}
