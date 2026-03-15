"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, MouseEventHandler, ReactNode } from "react";
import { useState } from "react";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type LoadingLinkProps = LinkProps & {
  className?: string;
  children: ReactNode;
  pendingLabel?: ReactNode;
  target?: string;
  rel?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function LoadingLink({
  className,
  children,
  pendingLabel,
  target,
  rel,
  disabled,
  onClick,
  ...props
}: LoadingLinkProps) {
  const [isPending, setIsPending] = useState(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      disabled
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || target === "_blank"
    ) {
      return;
    }

    setIsPending(true);
  }

  return (
    <Link
      {...props}
      target={target}
      rel={rel}
      aria-disabled={disabled ? "true" : undefined}
      aria-busy={isPending ? "true" : undefined}
      onClick={handleClick}
      className={`${className ?? ""} ${isPending ? "pointer-events-none opacity-85" : ""}`.trim()}
    >
      <div className="flex w-full items-center gap-2">
        {isPending ? <InlineSpinner /> : null}
        <div className="min-w-0 flex-1">{isPending && pendingLabel ? pendingLabel : children}</div>
      </div>
    </Link>
  );
}
