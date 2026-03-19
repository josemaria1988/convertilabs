"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  cancelDocumentAuditImportAction,
  createDocumentAuditImportAction,
  loadDocumentAuditImportStatusesAction,
} from "@/app/app/o/[slug]/audit/actions";
import {
  forgetPendingDocumentSpreadsheetImportRun,
  readLatestPendingDocumentSpreadsheetImportRunId,
  rememberPendingDocumentSpreadsheetImportRun,
} from "@/components/documents/document-spreadsheet-import-tracker";
import { DocumentUploadButton } from "@/components/documents/upload-button";

type DocumentAuditImportStatus =
  Awaited<ReturnType<typeof loadDocumentAuditImportStatusesAction>>[number];

type SpreadsheetLedgerKind = "purchase" | "sale";
type UploadStatus = "idle" | "uploading" | "success" | "cancelled" | "error";

const acceptedSpreadsheetLabel = ".csv,.tsv,.xlsx,.xls";

function isAcceptedSpreadsheetFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  const normalizedMime = file.type.toLowerCase();

  return (
    normalizedName.endsWith(".csv")
    || normalizedName.endsWith(".tsv")
    || normalizedName.endsWith(".xlsx")
    || normalizedName.endsWith(".xls")
    || normalizedMime.includes("text/csv")
    || normalizedMime.includes("tab-separated")
    || normalizedMime.includes("spreadsheetml.sheet")
    || normalizedMime.includes("ms-excel")
  );
}

export function DocumentAuditUploadPanel({
  slug,
}: {
  slug: string;
}) {
  const router = useRouter();
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<UploadStatus>("idle");
  const [spreadsheetMessage, setSpreadsheetMessage] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [ledgerKind, setLedgerKind] = useState<SpreadsheetLedgerKind>("purchase");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    if (activeRunId) {
      return;
    }

    const latestRunId = readLatestPendingDocumentSpreadsheetImportRunId(slug);

    if (!latestRunId) {
      return;
    }

    setActiveRunId(latestRunId);
    setSpreadsheetStatus("uploading");
    setSpreadsheetMessage("Retomando una auditoria documental en segundo plano...");
  }, [activeRunId, slug]);

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    let cancelled = false;
    const runId = activeRunId;

    async function pollRun() {
      const statuses = await loadDocumentAuditImportStatusesAction({
        slug,
        runIds: [runId],
      });

      if (cancelled || statuses.length === 0) {
        return;
      }

      const runStatus = statuses[0] as DocumentAuditImportStatus;
      setProgressPercent(runStatus.progress.percent);
      setSpreadsheetMessage(runStatus.message);

      if (runStatus.isTerminal) {
        forgetPendingDocumentSpreadsheetImportRun(slug, runStatus.runId);
        setActiveRunId(null);
        setIsCancelling(false);
        setSpreadsheetStatus(
          runStatus.status === "cancelled"
            ? "cancelled"
            : runStatus.status === "failed"
              ? "error"
              : "success",
        );
        startTransition(() => {
          router.replace(`/app/o/${slug}/audit?run=${runStatus.runId}`);
        });
        return;
      }

      setSpreadsheetStatus("uploading");
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

  async function handleSpreadsheetFiles(files: File[]) {
    const file = files[0];

    if (!file) {
      return;
    }

    if (!isAcceptedSpreadsheetFile(file)) {
      setSpreadsheetStatus("error");
      setSpreadsheetMessage("Selecciona una planilla en formato .csv, .tsv, .xlsx o .xls.");
      return;
    }

    setProgressPercent(5);
    setSpreadsheetStatus("uploading");
    setSpreadsheetMessage(`Preparando ${file.name} para generar una vista previa auditada de ${ledgerKind === "purchase" ? "compras" : "ventas"}...`);

    const formData = new FormData();
    formData.append("slug", slug);
    formData.append("ledgerKind", ledgerKind);
    formData.append("spreadsheet", file, file.name);

    try {
      const result = await createDocumentAuditImportAction(formData);

      setSpreadsheetMessage(result.message);
      setProgressPercent(result.ok ? 10 : 100);

      if (!result.ok || !result.runId) {
        setSpreadsheetStatus("error");
        return;
      }

      rememberPendingDocumentSpreadsheetImportRun(slug, result.runId);
      setActiveRunId(result.runId);
      setSpreadsheetStatus("uploading");
      startTransition(() => {
        router.replace(`/app/o/${slug}/audit?run=${result.runId}`);
      });
    } catch (error) {
      setIsCancelling(false);
      setSpreadsheetStatus("error");
      setProgressPercent(100);
      setSpreadsheetMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar la auditoria documental.",
      );
    }
  }

  async function handleCancel() {
    if (!activeRunId || isCancelling) {
      return;
    }

    setIsCancelling(true);
    setSpreadsheetMessage("Cancelando la auditoria en segundo plano...");

    try {
      const result = await cancelDocumentAuditImportAction({
        slug,
        runId: activeRunId,
      });

      forgetPendingDocumentSpreadsheetImportRun(slug, activeRunId);
      setActiveRunId(null);
      setSpreadsheetStatus("cancelled");
      setProgressPercent(100);
      setSpreadsheetMessage(result.message);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSpreadsheetStatus("error");
      setSpreadsheetMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cancelar la auditoria documental.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  const hasActiveRun = Boolean(activeRunId);
  const isBusy = spreadsheetStatus === "uploading" || isCancelling || isRefreshing;

  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[18px] font-semibold text-white">Planilla para ingreso masivo en segundo plano</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            El archivo se procesa en background, pero ahora se detiene en una vista previa auditada.
            Nada entra a `documents` hasta que aceptes el preview del batch.
          </p>
        </div>
        <span className="status-pill status-pill--info">Staging auditado</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px]">
          <span className="mb-2 block text-[13px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Importar como
          </span>
          <select
            className="min-h-[48px] w-full rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 text-[15px] text-white outline-none transition focus:border-[color:var(--color-accent)]"
            value={ledgerKind}
            disabled={isBusy}
            onChange={(event) => {
              setLedgerKind(event.target.value === "sale" ? "sale" : "purchase");
            }}
          >
            <option value="purchase">Compras del periodo</option>
            <option value="sale">Ventas del periodo</option>
          </select>
        </label>

        <DocumentUploadButton
          label={isBusy ? "Procesando..." : "Seleccionar planilla"}
          accept={acceptedSpreadsheetLabel}
          multiple={false}
          disabled={isBusy}
          isLoading={isBusy}
          className="ui-button ui-button--primary"
          onFilesSelected={(selectedFiles) => {
            void handleSpreadsheetFiles(selectedFiles);
          }}
        />

        {hasActiveRun ? (
          <button
            type="button"
            className="ui-button ui-button--secondary"
            disabled={isCancelling}
            onClick={() => {
              void handleCancel();
            }}
          >
            {isCancelling ? "Cancelando..." : "Cancelar"}
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[15px] text-[color:var(--color-muted)]">
          Formatos: CSV, TSV, XLSX, XLS
        </div>
        <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[15px] text-[color:var(--color-muted)]">
          Flujo estandar: maximo 300 filas por archivo
        </div>
        <div className="rounded-[1rem] border border-[color:var(--color-border)] bg-[rgba(18,29,60,0.86)] px-4 py-3 text-[15px] text-[color:var(--color-muted)]">
          Salida: preview, decisiones y materializacion controlada
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/8">
        <div
          style={{
            width:
              spreadsheetStatus === "idle"
                ? "0%"
                : `${Math.max(0, Math.min(100, progressPercent))}%`,
          }}
          className={`h-full rounded-full transition-all ${
            spreadsheetStatus === "uploading"
              ? "bg-[color:var(--color-accent)]"
              : spreadsheetStatus === "success"
                ? "bg-emerald-500"
                : spreadsheetStatus === "cancelled"
                  ? "bg-[color:var(--color-warm)]"
                  : spreadsheetStatus === "error"
                    ? "bg-rose-500"
                    : "bg-transparent"
          }`}
        />
      </div>

      <div aria-live="polite" className="mt-4 min-h-6">
        {spreadsheetMessage ? (
          <div
            className={`rounded-[1rem] border px-4 py-3 text-[15px] leading-7 ${
              spreadsheetStatus === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : spreadsheetStatus === "cancelled"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : spreadsheetStatus === "error"
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-[color:var(--color-border)] bg-[rgba(18,29,60,0.88)] text-[color:var(--color-muted)]"
            }`}
          >
            {spreadsheetMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
