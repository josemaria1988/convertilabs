"use client";

import { useEffect, useRef, useState } from "react";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { SubmitButton } from "@/components/ui/submit-button";

type AccountMenuProps = {
  organizationName: string;
  userEmail?: string | null;
};

export function AccountMenu({
  organizationName,
  userEmail,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} h-11 w-11 rounded-full px-0`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 20a6 6 0 0 0-12 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-40 mt-3 w-[290px] rounded-[1.35rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] p-2 shadow-[0_22px_60px_rgba(31,29,26,0.16)]">
          <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-white/70 px-4 py-3">
            <p className="text-sm font-semibold tracking-[-0.02em]">
              {userEmail ?? "Cuenta autenticada"}
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              Organizacion actual: {organizationName}
            </p>
          </div>

          <div className="mt-2 space-y-1">
            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-white/60 px-4 py-3 text-sm">
              <p className="font-medium">Mi perfil</p>
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                Placeholder. Mas adelante: password y preferencias.
              </p>
            </div>

            <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-white/60 px-4 py-3 text-sm">
              <p className="font-medium">Mi organizacion</p>
              <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                Placeholder. Mas adelante: cambiar o crear organizaciones.
              </p>
            </div>

            <form action="/logout" method="post">
              <SubmitButton
                pendingLabel="Cerrando..."
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} mt-1 w-full justify-start px-4 py-3 text-sm`}
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
