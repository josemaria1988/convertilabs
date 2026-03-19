"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  cancelDocumentSpreadsheetImportAction,
  loadDocumentSpreadsheetImportStatusesAction,
} from "@/app/app/o/[slug]/documents/actions";
import {
  forgetPendingDocumentSpreadsheetImportRun,
  readLatestPendingDocumentSpreadsheetImportRunId,
} from "@/components/documents/document-spreadsheet-import-tracker";

type DocumentSpreadsheetImportStatus =
  Awaited<ReturnType<typeof loadDocumentSpreadsheetImportStatusesAction>>[number];

function resolveStageLabel(status: DocumentSpreadsheetImportStatus | null) {
  if (!status) {
    return "Importacion activa";
  }

  if (status.status === "queued") {
    return "En cola";
  }

  if (status.progress.stage === "extracting_rows") {
    return "Preparando lote";
  }

  if (status.progress.stage === "importing_rows") {
    return "Importando filas";
  }

  if (status.progress.stage === "resolving_fx") {
    return "Resolviendo BCU";
  }

  return "Importacion activa";
}

export function DocumentSpreadsheetImportBanner({
  slug,
}: {
  slug: string;
}) {
  const router = useRouter();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<DocumentSpreadsheetImportStatus | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    function syncPendingRun() {
      setActiveRunId(readLatestPendingDocumentSpreadsheetImportRunId(slug));
    }

    syncPendingRun();
    const intervalId = window.setInterval(syncPendingRun, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [slug]);

  useEffect(() => {
    if (!activeRunId) {
      setRunStatus(null);
      setIsCancelling(false);
      return;
    }

    const runId = activeRunId;
    let cancelled = false;

    async function pollRun() {
      const statuses = await loadDocumentSpreadsheetImportStatusesAction({
        slug,
        runIds: [runId],
      });

      if (cancelled || statuses.length === 0) {
        return;
      }

      const nextStatus = statuses[0] as DocumentSpreadsheetImportStatus;
      setRunStatus(nextStatus);

      if (nextStatus.isTerminal) {
        forgetPendingDocumentSpreadsheetImportRun(slug, nextStatus.runId);
        setActiveRunId(null);
        setIsCancelling(false);
        startTransition(() => {
          router.refresh();
        });
      }
    }

    void pollRun();
    const intervalId = window.setInterval(() => {
      void pollRun();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRunId, router, slug, startTransition]);

  async function handleCancel() {
    if (!activeRunId || isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      await cancelDocumentSpreadsheetImportAction({
        slug,
        runId: activeRunId,
      });
    } catch {
      setIsCancelling(false);
    }
  }

  if (!activeRunId) {
    return null;
  }

  const percent = Math.max(5, Math.min(100, runStatus?.progress.percent ?? 8));
  const isPurchase = runStatus?.ledgerKind !== "sale";

  return (
    <div className="ui-panel border border-[color:var(--color-accent)]/35 bg-[rgba(33,49,92,0.72)]">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">
            Importacion activa de {isPurchase ? "compras" : "ventas"}
          </h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            {runStatus?.fileName
              ? `Archivo: ${runStatus.fileName}`
              : "Estamos siguiendo una importacion en segundo plano desde este navegador."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="status-pill status-pill--warning">
            {resolveStageLabel(runStatus)}
          </span>
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={isCancelling}
            onClick={() => {
              void handleCancel();
            }}
          >
            {isCancelling ? "Cancelando..." : "Cancelar importacion"}
          </button>
          <a href="#document-upload-panel" className="ui-button ui-button--secondary">
            Ver panel
          </a>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-[color:var(--color-accent)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4 rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[14px] leading-7 text-[color:var(--color-muted)]">
        {runStatus?.message ?? "Preparando la corrida en segundo plano..."}
      </div>

      <p className="mt-3 text-[13px] text-[color:var(--color-muted)]">
        Cancelar detiene lo pendiente, pero no borra automaticamente los documentos que ya hayan quedado creados.
      </p>
    </div>
  );
}
