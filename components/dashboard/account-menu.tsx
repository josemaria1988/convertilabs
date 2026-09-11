"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";

type AccountMenuProps = {
  organizationName: string;
  organizationSlug: string;
  userEmail?: string | null;
};

function getInitials(value: string | null | undefined) {
  if (!value) {
    return "CL";
  }

  const source = value.includes("@") ? value.split("@")[0] : value;
  const tokens = source
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return "CL";
  }

  return tokens.slice(0, 2).map((token) => token[0]?.toUpperCase() ?? "").join("");
}

function getDisplayLabel(
  userEmail: string | null | undefined,
  organizationName: string,
) {
  if (!userEmail) {
    return organizationName;
  }

  const source = userEmail.split("@")[0] ?? organizationName;
  const normalized = source.replace(/[._-]+/g, " ").trim();

  return normalized || organizationName;
}

export function AccountMenu({
  organizationName,
  organizationSlug,
  userEmail,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => getInitials(userEmail), [userEmail]);
  const displayLabel = useMemo(
    () => getDisplayLabel(userEmail, organizationName),
    [organizationName, userEmail],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Opciones de la cuenta"
        aria-controls="app-account-options"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
        className="app-account-button"
      >
        <span className="app-account-avatar">
          {initials}
        </span>
        <span className="hidden max-w-[96px] truncate md:block">
          {displayLabel}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-3 w-3 text-[color:var(--color-muted)]"
          fill="currentColor"
        >
          <path d="M5.2 7.3 10 12.1l4.8-4.8.9.9-5.7 5.6-5.7-5.6.9-.9Z" />
        </svg>
      </button>

      {isOpen ? (
        <div id="app-account-options" className="app-account-menu">
          <div className="border-b border-[color:var(--color-border)] px-3 py-3">
            <p className="break-words text-sm font-semibold text-[color:var(--color-foreground)]">
              {userEmail ?? "Cuenta autenticada"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-soft)]">
              Organización activa
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              {organizationName}
            </p>
          </div>

          <div className="mt-2 space-y-2">
            <LoadingLink
              href={`/app/o/${organizationSlug}/settings`}
              pendingLabel="Abriendo..."
              className="block rounded-md px-3 py-3 text-sm transition hover:bg-[color:var(--color-accent-soft)]"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <p className="font-medium text-[color:var(--color-foreground)]">Ajustes de la organización</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                Datos fiscales, integraciones y plan de cuentas.
              </p>
            </LoadingLink>

            <form action="/logout" method="post">
              <SubmitButton
                pendingLabel="Cerrando..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} mt-1 w-full justify-start px-4 py-2.5 text-sm`}
              >
                Cerrar sesión
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
