"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MouseEvent, MouseEventHandler, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);
  const targetHref = useMemo(() => {
    if (typeof props.href === "string") {
      return props.href;
    }

    const query = new URLSearchParams();

    for (const [key, rawValue] of Object.entries(props.href.query ?? {})) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];

      for (const value of values) {
        if (value !== undefined) {
          query.append(key, String(value));
        }
      }
    }

    const search = query.toString();
    const hash = props.href.hash ? `#${props.href.hash}` : "";
    return `${props.href.pathname ?? ""}${search ? `?${search}` : ""}${hash}`;
  }, [props.href]);

  useEffect(() => {
    setIsPending(false);
  }, [currentHref]);

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

    if (targetHref.replace(/#.*$/, "") === currentHref) {
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
