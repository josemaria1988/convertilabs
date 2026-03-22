"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocumentAssistantRailData } from "@/modules/assistant/document-assistant";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { InlineSpinner } from "@/components/ui/inline-spinner";

type RefreshAssistantAction = () => Promise<{
  ok: boolean;
  message: string;
}>;

type ResolveAssistantSuggestionAction = (input: {
  suggestionId: string;
  resolutionStatus: "accepted" | "rejected" | "edited";
  execute?: boolean;
  resolutionComment?: string | null;
}) => Promise<{
  ok: boolean;
  message: string;
}>;

type DocumentAccountingAssistantRailProps = {
  assistantRail: DocumentAssistantRailData | null;
  refreshAssistantAction: RefreshAssistantAction;
  resolveAssistantSuggestionAction: ResolveAssistantSuggestionAction;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Sin score";
  }

  return `${Math.round(value * 100)}%`;
}

export function DocumentAccountingAssistantRail({
  assistantRail,
  refreshAssistantAction,
  resolveAssistantSuggestionAction,
}: DocumentAccountingAssistantRailProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!assistantRail) {
    return null;
  }

  const pendingSuggestions = assistantRail.suggestions.filter((suggestion) => suggestion.resolutionStatus === "pending");
  const resolvedSuggestions = assistantRail.suggestions.filter((suggestion) => suggestion.resolutionStatus !== "pending");

  function runRefresh() {
    setPendingKey("refresh");
    setMessage("");

    startTransition(async () => {
      try {
        const result = await refreshAssistantAction();
        setMessage(result.message);

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No pudimos actualizar el analisis.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  function runSuggestion(input: {
    suggestionId: string;
    resolutionStatus: "accepted" | "rejected" | "edited";
    execute?: boolean;
  }) {
    setPendingKey(input.suggestionId);
    setMessage("");

    startTransition(async () => {
      try {
        const result = await resolveAssistantSuggestionAction(input);
        setMessage(result.message);

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No pudimos resolver la sugerencia.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <aside className="panel h-fit p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-accent)] text-sm font-semibold text-white">
            {assistantRail.persona.avatarLabel}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{assistantRail.persona.displayName}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              {assistantRail.persona.subtitle}
            </p>
          </div>
        </div>
        {assistantRail.isStale ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
            Contexto obsoleto
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-950">
            Vigente
          </span>
        )}
      </div>

      <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)]">
        {assistantRail.persona.specialty}
      </p>

      <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/55 p-4 text-sm">
        <p className="font-semibold">Estado del analisis</p>
        <p className="mt-2 text-[color:var(--color-muted)]">
          Confianza: {formatConfidence(assistantRail.latestMessage?.structuredPayload.confidence ?? null)}
        </p>
        <p className="mt-1 text-[color:var(--color-muted)]">
          Ultima actualizacion: {formatDate(assistantRail.thread?.lastMessageAt ?? assistantRail.latestMessage?.createdAt ?? null)}
        </p>
        {assistantRail.thread?.staleReason ? (
          <p className="mt-1 text-[color:var(--color-muted)]">
            Motivo: {assistantRail.thread.staleReason.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>

      {assistantRail.latestMessage ? (
        <>
          <section className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Que veo
            </p>
            <p className="text-sm leading-7 text-white">{assistantRail.latestMessage.structuredPayload.summaryMd}</p>
            <ul className="space-y-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {assistantRail.latestMessage.structuredPayload.whatISee.map((entry, index) => (
                <li key={`${assistantRail.latestMessage?.id}-see-${index}`}>- {entry}</li>
              ))}
            </ul>
          </section>

          <section className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Que sugiero
            </p>
            <ul className="space-y-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {assistantRail.latestMessage.structuredPayload.whatISuggest.map((entry, index) => (
                <li key={`${assistantRail.latestMessage?.id}-suggest-${index}`}>- {entry}</li>
              ))}
            </ul>
          </section>

          <section className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Que puedes decidir ahora
            </p>
            <ul className="space-y-2 text-sm leading-7 text-[color:var(--color-muted)]">
              {assistantRail.latestMessage.structuredPayload.whatYouCanDecideNow.map((entry, index) => (
                <li key={`${assistantRail.latestMessage?.id}-decide-${index}`}>- {entry}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/50 px-4 py-3 text-sm text-[color:var(--color-muted)]">
          Todavia no hay un analisis visible del Asistente Contable para este documento.
        </div>
      )}

      {assistantRail.latestMessage?.structuredPayload.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {assistantRail.latestMessage.structuredPayload.warnings.join(" ")}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!assistantRail.canRefresh || isPending}
          onClick={runRefresh}
          className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
        >
          {pendingKey === "refresh" && isPending ? <InlineSpinner /> : null}
          Actualizar analisis
        </button>
      </div>

      <section className="mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          Sugerencias
        </p>
        {pendingSuggestions.length > 0 ? pendingSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="rounded-2xl border border-[color:var(--color-border)] bg-white/60 p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{suggestion.title}</p>
                <p className="mt-2 leading-7 text-[color:var(--color-muted)]">{suggestion.description}</p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-950">
                {formatConfidence(suggestion.confidence)}
              </span>
            </div>
            {suggestion.rationaleMarkdown ? (
              <p className="mt-3 text-[color:var(--color-muted)]">{suggestion.rationaleMarkdown}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  runSuggestion({
                    suggestionId: suggestion.id,
                    resolutionStatus: "accepted",
                    execute: suggestion.actionKind === "run_classification" || suggestion.actionKind === "post_provisional",
                  });
                }}
                className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
              >
                {pendingKey === suggestion.id && isPending ? <InlineSpinner /> : null}
                {suggestion.actionLabel ?? "Aceptar sugerencia"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  runSuggestion({
                    suggestionId: suggestion.id,
                    resolutionStatus: "rejected",
                  });
                }}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-3 text-sm disabled:opacity-60`}
              >
                Descartar
              </button>
            </div>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/50 px-4 py-3 text-sm text-[color:var(--color-muted)]">
            No hay sugerencias pendientes del Asistente Contable para este documento.
          </div>
        )}
      </section>

      {resolvedSuggestions.length > 0 ? (
        <section className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Historial reciente
          </p>
          {resolvedSuggestions.slice(0, 3).map((suggestion) => (
            <div
              key={`resolved-${suggestion.id}`}
              className="rounded-2xl border border-[color:var(--color-border)] bg-white/45 px-4 py-3 text-sm"
            >
              <p className="font-semibold text-white">{suggestion.title}</p>
              <p className="mt-1 text-[color:var(--color-muted)]">
                {suggestion.resolutionStatus.replace(/_/g, " ")} el {formatDate(suggestion.resolvedAt)}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {message ? (
        <p className="mt-5 text-sm text-[color:var(--color-muted)]">{message}</p>
      ) : null}
    </aside>
  );
}
