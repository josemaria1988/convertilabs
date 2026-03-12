"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { DocumentPreview } from "@/components/documents/document-preview";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";

type DocumentOriginalModalTriggerProps = {
  previewUrl: string | null;
  mimeType: string | null;
  originalFilename: string;
  triggerLabel: string;
  triggerClassName: string;
  modalTitle?: string;
  modalDescription?: string;
};

export function DocumentOriginalModalTrigger({
  previewUrl,
  mimeType,
  originalFilename,
  triggerLabel,
  triggerClassName,
  modalTitle,
  modalDescription,
}: DocumentOriginalModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {isOpen && isMounted ? createPortal(
        <div
          className="fixed inset-0 z-[999] bg-[rgba(17,24,39,0.8)]"
          onClick={() => {
            setIsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative flex h-full w-full flex-col overflow-hidden bg-[color:var(--color-surface-strong)]"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              aria-label="Cerrar documento original"
              onClick={() => {
                setIsOpen(false);
              }}
              className="absolute right-4 top-4 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:scale-[1.03] hover:bg-black/72 md:right-6 md:top-6 md:h-16 md:w-16"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-7 w-7 md:h-8 md:w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-4 pr-20 md:px-6 md:py-5 md:pr-24">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="truncate text-lg font-semibold tracking-[-0.04em] md:text-2xl"
                >
                  {modalTitle ?? originalFilename}
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 truncate text-xs text-[color:var(--color-muted)] md:text-sm"
                >
                  {modalDescription ?? "Archivo original firmado desde Storage privado del tenant actual."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                  >
                    Abrir en otra ventana
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-black/4 px-2 pb-2 pt-2 md:px-4 md:pb-4 md:pt-3">
              <DocumentPreview
                previewUrl={previewUrl}
                mimeType={mimeType}
                originalFilename={originalFilename}
                variant="modal"
              />
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
