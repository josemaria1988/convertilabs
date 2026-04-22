"use client";

import { useEffect, useId, useState } from "react";
import { JournalEntryDetailPanel } from "@/components/accounting/journal-entry-detail-panel";
import { AccountingImpactPreview } from "@/components/documents/accounting-impact-preview";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import type { AccountingImpactPreview as AccountingImpactPreviewModel } from "@/modules/accounting/accounting-impact-preview";
import type { DocumentJournalAuditState } from "@/modules/accounting/read-model-repository";

type JournalEntryModalTriggerProps = {
  organizationSlug: string;
  documentTitle: string;
  auditState: DocumentJournalAuditState;
  preview: AccountingImpactPreviewModel;
};

export function JournalEntryModalTrigger({
  organizationSlug,
  documentTitle,
  auditState,
  preview,
}: JournalEntryModalTriggerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const materializedDetail = auditState.mode === "materialized" ? auditState.detail : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
      >
        Asiento
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-[color:var(--color-border)] surface-card-dark shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--color-border)] px-5 py-4">
              <div>
                <p className="text-[12px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                  {materializedDetail ? "Asiento materializado" : "Preview del kernel"}
                </p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold text-white">
                  {documentTitle}
                </h2>
                <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                  {materializedDetail
                    ? "Lectura auditada del asiento ya posteado."
                    : auditState.previewReason}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm`}
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-5 py-5">
              {materializedDetail ? (
                <JournalEntryDetailPanel
                  detail={materializedDetail}
                  organizationSlug={organizationSlug}
                  variant="embedded"
                  title="Asiento generado"
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                    {auditState.previewReason}
                  </div>
                  <AccountingImpactPreview preview={preview} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
