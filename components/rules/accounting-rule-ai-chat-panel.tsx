"use client";

import { useEffect, useState, useTransition } from "react";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import {
  createAccountingRuleAiThreadClientAction,
  loadAccountingRuleAiThreadClientAction,
  sendAccountingRuleAiMessageClientAction,
} from "@/app/app/o/[slug]/settings/accounting-rules/actions";
import type {
  AccountingRuleDetail,
  AccountingRuleAiThreadDetail,
  AccountingRuleAiThreadSummary,
} from "@/modules/accounting/rules-admin";

type Props = {
  slug: string;
  rule: AccountingRuleDetail | null;
  canManage: boolean;
  initialPrompt: string | null;
};

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900";
const textAreaClassName =
  "min-h-[120px] w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRoleLabel(role: "user" | "assistant" | "system_context") {
  switch (role) {
    case "assistant":
      return "Asistente";
    case "system_context":
      return "Contexto";
    default:
      return "Tu mensaje";
  }
}

export function AccountingRuleAiChatPanel({
  slug,
  rule,
  canManage,
  initialPrompt,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [threadTitle, setThreadTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [threads, setThreads] = useState<AccountingRuleAiThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<AccountingRuleAiThreadDetail | null>(null);

  useEffect(() => {
    setFeedback("");
    setThreadTitle(rule ? `Analisis consultivo - ${rule.name}` : "");
    setDraftMessage(initialPrompt ?? "");
    setThreads(rule?.aiThreads ?? []);
    setSelectedThreadId(rule?.selectedAiThreadId ?? null);
    setSelectedThread(rule?.selectedAiThread ?? null);
  }, [initialPrompt, rule]);

  if (!rule) {
    return (
      <section className="ui-panel">
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-6 text-sm text-[color:var(--color-muted)]">
          Selecciona una regla para abrir el chat consultivo con contexto real de conflictos, cobertura y documentos.
        </div>
      </section>
    );
  }

  const currentRule = rule;
  const visibleMessages = selectedThread?.messages.filter((message) => message.role !== "system_context") ?? [];

  function applyServerState(result: {
    ok: boolean;
    message: string;
    threads: AccountingRuleAiThreadSummary[];
    selectedThreadId: string | null;
    selectedThread: AccountingRuleAiThreadDetail | null;
  }) {
    setFeedback(result.message);

    if (!result.ok) {
      return;
    }

    setThreads(result.threads);
    setSelectedThreadId(result.selectedThreadId);
    setSelectedThread(result.selectedThread);
  }

  function createThread() {
    setFeedback("");

    startTransition(async () => {
      const result = await createAccountingRuleAiThreadClientAction({
        slug,
        ruleId: currentRule.id,
        title: threadTitle,
        initialPrompt: draftMessage,
      });

      applyServerState({
        ...result,
        message: result.ok ? "Hilo consultivo creado." : result.message,
      });

      if (result.ok) {
        setDraftMessage("");
      }
    });
  }

  function openThread(threadId: string) {
    if (threadId === selectedThreadId) {
      return;
    }

    setFeedback("");
    startTransition(async () => {
      const result = await loadAccountingRuleAiThreadClientAction({
        slug,
        ruleId: currentRule.id,
        threadId,
      });
      applyServerState(result);
    });
  }

  function sendMessage() {
    if (!selectedThreadId || !draftMessage.trim()) {
      setFeedback("Escribe una consulta antes de enviarla.");
      return;
    }

    setFeedback("");
    startTransition(async () => {
      const result = await sendAccountingRuleAiMessageClientAction({
        slug,
        ruleId: currentRule.id,
        threadId: selectedThreadId,
        message: draftMessage,
      });

      applyServerState({
        ...result,
        message: result.ok ? "" : result.message,
      });

      if (result.ok) {
        setDraftMessage("");
      }
    });
  }

  return (
    <section className="space-y-4">
      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h3 className="text-[18px] font-semibold text-white">Chat consultivo IA</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Analiza reglas reales y propone acciones manuales. No crea ni activa reglas por su cuenta.
            </p>
          </div>
          <span className="ui-filter">{threads.length} hilo(s)</span>
        </div>

        {!canManage ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            Tu rol puede auditar la regla, pero no usar el chat consultivo.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              value={threadTitle}
              onChange={(event) => setThreadTitle(event.target.value)}
              className={inputClassName}
            />
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Ej: que regla me recomiendas mantener, versionar o simular primero?"
              className={textAreaClassName}
            />
            <button
              type="button"
              disabled={isPending}
              onClick={createThread}
              className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
            >
              {isPending ? <InlineSpinner /> : null}
              Crear hilo consultivo
            </button>
          </div>
        )}
      </article>

      {threads.length > 0 ? (
        <article className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h3 className="text-[16px] font-semibold text-white">Hilos recientes</h3>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Cambia de hilo sin refrescar la pantalla.
              </p>
            </div>
            <span className="ui-filter">{selectedThread ? "Seleccionado" : "Sin seleccionar"}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                disabled={isPending}
                onClick={() => openThread(thread.id)}
                className={thread.id === selectedThreadId ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
              >
                {thread.title}
              </button>
            ))}
          </div>
        </article>
      ) : null}

      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Conversacion</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Respuestas directas al usuario, con referencias reales pero sin humo.
            </p>
          </div>
          <span className="ui-filter">{visibleMessages.length} mensaje(s)</span>
        </div>

        <div className="mt-4 space-y-3">
          {!selectedThread ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              Crea o abre un hilo para empezar a consultar sobre esta regla.
            </div>
          ) : (
            visibleMessages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{getRoleLabel(message.role)}</p>
                  <span className="ui-filter">{formatDateTime(message.createdAt)}</span>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--color-muted)]">
                  {message.messageText}
                </div>
                {message.referencedRuleIds.length > 0 ? (
                  <p className="mt-3 text-xs text-[color:var(--color-muted)]">
                    Reglas relacionadas: {message.referencedRuleIds.join(", ")}
                  </p>
                ) : null}
                {message.referencedDocumentIds.length > 0 ? (
                  <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                    Documentos relacionados: {message.referencedDocumentIds.join(", ")}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>

        {canManage && selectedThread ? (
          <div className="mt-4 space-y-3">
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Ej: si tuvieras que recomendarme un solo cambio manual, cual seria?"
              className={textAreaClassName}
            />
            <button
              type="button"
              disabled={isPending}
              onClick={sendMessage}
              className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
            >
              {isPending ? <InlineSpinner /> : null}
              Enviar consulta
            </button>
          </div>
        ) : null}

        {feedback ? (
          <p className="mt-4 text-sm text-[color:var(--color-muted)]">{feedback}</p>
        ) : null}
      </article>
    </section>
  );
}
