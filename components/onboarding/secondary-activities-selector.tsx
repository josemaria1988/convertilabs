"use client";

import { useMemo, useState } from "react";
import { HelpHint } from "@/components/ui/help-hint";
import {
  getActivityByCode,
  getActivityChildren,
} from "@/modules/organizations/activity-catalog";
import { searchActivities } from "@/modules/organizations/activity-search";

type SecondaryActivitiesSelectorProps = {
  value: string[];
  primaryActivityCode: string;
  onChange: (codes: string[]) => void;
  maxItems?: number;
  error?: string;
  helpHintKey?: string;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function SecondaryActivitiesSelector({
  value,
  primaryActivityCode,
  onChange,
  maxItems = 5,
  error,
  helpHintKey,
}: SecondaryActivitiesSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showSpecialCases, setShowSpecialCases] = useState(false);
  const [refinementParentCode, setRefinementParentCode] = useState<string | null>(null);
  const selectedSet = new Set(value);
  const selectedActivities = value
    .map((code) => getActivityByCode(code))
    .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity));
  const results = useMemo(
    () =>
      searchActivities(query, 8, {
        includeSpecialAnnex: showSpecialCases,
        selectableOnly: false,
      }).filter((activity) =>
        activity.code !== primaryActivityCode
        && !selectedSet.has(activity.code)),
    [primaryActivityCode, query, selectedSet, showSpecialCases],
  );
  const refinementOptions = useMemo(
    () =>
      refinementParentCode
        ? getActivityChildren(refinementParentCode, {
            selectableOnly: true,
            includeSpecialAnnex: showSpecialCases,
            limit: 8,
          }).filter((activity) =>
            activity.code !== primaryActivityCode
            && !selectedSet.has(activity.code))
        : [],
    [primaryActivityCode, refinementParentCode, selectedSet, showSpecialCases],
  );

  function addCode(code: string) {
    onChange(unique([...value, code]).slice(0, maxItems));
    setQuery("");
    setRefinementParentCode(null);
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-white">
        <span>Actividades secundarias</span>
        {helpHintKey ? <HelpHint contentKey={helpHintKey} /> : null}
      </label>
      <div className="relative">
        <input
          value={query}
          onFocus={() => {
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
            }, 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setRefinementParentCode(null);
            setIsOpen(true);
          }}
          placeholder="Agrega hasta 5 actividades complementarias"
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {isOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 space-y-2 rounded-2xl border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-2 shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 text-xs text-[color:var(--color-muted)]">
              <span>Secundarias dentro del catalogo oficial</span>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  setShowSpecialCases((current) => !current);
                }}
                className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] text-white/85 transition hover:bg-white/8"
              >
                {showSpecialCases ? "Ocultar casos DGI/019" : "Mostrar casos DGI/019"}
              </button>
            </div>

            {refinementOptions.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-[rgba(124,157,255,0.28)] bg-[rgba(124,157,255,0.08)] p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-100">
                  Refina a una subclase oficial
                </p>
                <div className="space-y-2">
                  {refinementOptions.map((activity) => (
                    <button
                      key={activity.code}
                      type="button"
                      disabled={value.length >= maxItems}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        addCode(activity.code);
                      }}
                      className="w-full rounded-2xl px-3 py-3 text-left text-sm text-white/90 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="font-medium">
                        {activity.displayCode} - {activity.title}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                        {activity.breadcrumbLabel}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {query.trim() && results.length > 0 ? (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {results.map((activity) => (
                  <button
                    key={activity.code}
                    type="button"
                    disabled={value.length >= maxItems}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      if (activity.isSelectable) {
                        addCode(activity.code);
                        return;
                      }

                      if (activity.requiresRefinement) {
                        setRefinementParentCode(activity.legacyResolvedCode ?? activity.code);
                      }
                    }}
                    className="w-full rounded-2xl px-3 py-3 text-left text-sm text-white/90 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        {activity.displayCode} - {activity.title}
                      </div>
                      <span className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80">
                        {activity.isSpecialAnnex
                          ? "Especial DGI/019"
                          : activity.requiresRefinement
                            ? "Refinar"
                            : activity.level.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 leading-6 text-[color:var(--color-muted)]">
                      {activity.breadcrumbLabel}
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/4 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                No encontramos coincidencias directas para esa secundaria.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedActivities.length > 0 ? (
          selectedActivities.map((activity) => (
            <button
              key={activity.code}
              type="button"
              onClick={() => {
                onChange(value.filter((code) => code !== activity.code));
              }}
              className="rounded-full border border-[color:var(--color-border)] bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/16"
            >
              {activity.displayCode} - {activity.title} x
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/5 px-4 py-3 text-sm text-[color:var(--color-muted)]">
            No agregaste actividades secundarias. Puedes seguir asi si el negocio es simple.
          </div>
        )}
      </div>

      <p className="text-sm leading-6 text-[color:var(--color-muted)]">
        Suma solo actividades recurrentes y materiales. Si una opcion es demasiado amplia, primero refinala a su subclase oficial.
      </p>
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
    </div>
  );
}
