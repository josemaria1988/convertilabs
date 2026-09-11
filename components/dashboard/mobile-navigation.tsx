"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Native modal dialog provides focus containment, Escape and focus restoration. */
export function MobileNavigation({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1100px)");
    const closeOnDesktop = () => { if (desktop.matches) dialogRef.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [isOpen]);

  return (
    <div className="app-mobile-menu">
      <button
        type="button"
        className="app-menu-button"
        aria-label="Abrir navegación"
        aria-haspopup="dialog"
        aria-controls="app-mobile-navigation"
        aria-expanded={isOpen}
        onClick={() => { dialogRef.current?.showModal(); setIsOpen(true); }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        id="app-mobile-navigation"
        aria-label="Navegación principal"
        className="app-mobile-drawer"
        onClose={() => setIsOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
      >
        <div className="app-mobile-drawer__panel" onClick={(event) => {
          if ((event.target as Element).closest("a[href]")) dialogRef.current?.close();
        }}>
          <div className="app-mobile-drawer__heading">
            <span>Menú</span>
            <button type="button" className="app-menu-button" aria-label="Cerrar navegación" onClick={() => dialogRef.current?.close()}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </div>
  );
}
