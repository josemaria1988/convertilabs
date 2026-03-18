"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadDocumentSpreadsheetImportStatusesAction } from "@/app/app/o/[slug]/documents/actions";
import {
  forgetPendingDocumentSpreadsheetImportRun,
  readPendingDocumentSpreadsheetImportRunIds,
} from "@/components/documents/document-spreadsheet-import-tracker";

type DocumentSpreadsheetImportStatus =
  Awaited<ReturnType<typeof loadDocumentSpreadsheetImportStatusesAction>>[number];

type ToastTone = "success" | "warning" | "error";

type ToastItem = {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
};

function resolveToastTone(status: DocumentSpreadsheetImportStatus): ToastTone {
  if (status.status === "failed") {
    return "error";
  }

  return status.progress.failedCount > 0 ? "warning" : "success";
}

function resolveToastTitle(status: DocumentSpreadsheetImportStatus) {
  if (status.status === "failed") {
    return "Importacion fallida";
  }

  return status.progress.failedCount > 0
    ? "Importacion finalizada con observaciones"
    : "Importacion finalizada con exito";
}

export function DocumentSpreadsheetImportNotifier({
  slug,
}: {
  slug: string;
}) {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [, startTransition] = useTransition();
  const notifiedRunIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function pollPendingRuns() {
      const runIds = readPendingDocumentSpreadsheetImportRunIds(slug);

      if (runIds.length === 0) {
        return;
      }

      const statuses = await loadDocumentSpreadsheetImportStatusesAction({
        slug,
        runIds,
      });

      if (cancelled) {
        return;
      }

      let shouldRefresh = false;

      for (const status of statuses) {
        if (!status.isTerminal) {
          continue;
        }

        forgetPendingDocumentSpreadsheetImportRun(slug, status.runId);

        if (!notifiedRunIdsRef.current.has(status.runId)) {
          notifiedRunIdsRef.current.add(status.runId);
          setToasts((current) => [
            ...current,
            {
              id: status.runId,
              title: resolveToastTitle(status),
              message: status.message,
              tone: resolveToastTone(status),
            },
          ]);
        }

        shouldRefresh = true;
      }

      if (shouldRefresh) {
        startTransition(() => {
          router.refresh();
        });
      }
    }

    void pollPendingRuns();
    const intervalId = window.setInterval(() => {
      void pollPendingRuns();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [router, slug, startTransition]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[1200] flex w-full max-w-[380px] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-[1rem] border px-4 py-3 shadow-[0_16px_40px_rgba(9,15,30,0.35)] ${
            toast.tone === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : toast.tone === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-rose-300 bg-rose-50 text-rose-950"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{toast.title}</p>
              <p className="mt-1 text-[13px] leading-6">{toast.message}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full px-2 py-1 text-[12px] font-semibold opacity-70 transition hover:opacity-100"
              onClick={() => {
                setToasts((current) => current.filter((entry) => entry.id !== toast.id));
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
