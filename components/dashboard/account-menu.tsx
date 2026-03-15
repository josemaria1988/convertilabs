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
        aria-haspopup="menu"
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
        <div className="absolute right-0 z-40 mt-2 w-[278px] rounded-[6px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-2 shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
          <div className="rounded-[5px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3">
            <p className="text-sm font-semibold text-white">
              {userEmail ?? "Cuenta autenticada"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-soft)]">
              Organizacion activa
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              {organizationName}
            </p>
          </div>

          <div className="mt-2 space-y-2">
            <div className="rounded-[5px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm">
              <p className="font-medium text-white">Perfil y preferencias</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                Proximamente: contrasena, preferencias y MFA.
              </p>
            </div>

            <LoadingLink
              href={`/app/o/${organizationSlug}/settings`}
              pendingLabel="Abriendo..."
              className="block rounded-[5px] border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm transition hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <p className="font-medium text-white">Organizacion</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                Perfil de la organizacion, datos fiscales y plan de cuentas.
              </p>
            </LoadingLink>

            <form action="/logout" method="post">
              <SubmitButton
                pendingLabel="Cerrando..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} mt-1 w-full justify-start px-4 py-2.5 text-sm`}
              >
                Cerrar sesion
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
