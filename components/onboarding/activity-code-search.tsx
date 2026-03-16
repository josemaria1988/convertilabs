"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityCatalogEntry } from "@/modules/organizations/activity-types";
import {
  getActivityByCode,
  getActivityChildren,
} from "@/modules/organizations/activity-catalog";
import { searchActivities } from "@/modules/organizations/activity-search";
import { HelpHint } from "@/components/ui/help-hint";

type ActivityCodeSearchProps = {
  label: string;
  value: string;
  onSelect: (code: string) => void;
  helpHintKey?: string;
  placeholder?: string;
  error?: string;
  suggestedActivities?: ActivityCatalogEntry[];
  disabledCodes?: string[];
};

function getActivityLabel(activity: ActivityCatalogEntry | null) {
  return activity ? `${activity.displayCode} - ${activity.title}` : "";
}

function renderActivityBadge(activity: ActivityCatalogEntry) {
  if (activity.isSpecialAnnex) {
    return "Especial DGI/019";
  }

  if (activity.requiresRefinement) {
    return "Refinar";
  }

  return activity.level.toUpperCase();
}

export function ActivityCodeSearch({
  label,
  value,
  onSelect,
  helpHintKey,
  placeholder,
  error,
  suggestedActivities = [],
  disabledCodes = [],
}: ActivityCodeSearchProps) {
  const selectedActivity = getActivityByCode(value);
  const [query, setQuery] = useState(getActivityLabel(selectedActivity));
  const [isOpen, setIsOpen] = useState(false);
  const [showSpecialCases, setShowSpecialCases] = useState(false);
  const [refinementParentCode, setRefinementParentCode] = useState<string | null>(
    selectedActivity?.requiresRefinement
      ? selectedActivity.legacyResolvedCode ?? selectedActivity.code
      : null,
  );
  const disabled = new Set(disabledCodes);

  useEffect(() => {
    setQuery(getActivityLabel(selectedActivity));
    setRefinementParentCode(
      selectedActivity?.requiresRefinement
        ? selectedActivity.legacyResolvedCode ?? selectedActivity.code
        : null,
    );
  }, [selectedActivity]);

  const results = useMemo(() => {
    const baseResults = searchActivities(query, 8, {
      includeSpecialAnnex: showSpecialCases,
      selectableOnly: false,
    });

    if (baseResults.length > 0) {
      return baseResults.filter((activity) => !disabled.has(activity.code));
    }

    return suggestedActivities.filter((activity) =>
      !disabled.has(activity.code)
      && (showSpecialCases || !activity.isSpecialAnnex));
  }, [disabled, query, showSpecialCases, suggestedActivities]);

  const refinementOptions = useMemo(
    () =>
      refinementParentCode
        ? getActivityChildren(refinementParentCode, {
            selectableOnly: true,
            includeSpecialAnnex: showSpecialCases,
            limit: 8,
          }).filter((activity) => !disabled.has(activity.code))
        : [],
    [disabled, refinementParentCode, showSpecialCases],
  );

  function handlePick(activity: ActivityCatalogEntry) {
    if (activity.isSelectable) {
      onSelect(activity.code);
      setQuery(getActivityLabel(activity));
      setRefinementParentCode(null);
      setIsOpen(false);
      return;
    }

    if (activity.requiresRefinement) {
      setRefinementParentCode(activity.legacyResolvedCode ?? activity.code);
      setQuery(getActivityLabel(activity));
      setIsOpen(true);
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-white">
        <span>{label}</span>
        {helpHintKey ? <HelpHint contentKey={helpHintKey} /> : null}
      </label>
      <div className="relative">
        <input
          value={query}
          placeholder={placeholder}
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
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {selectedActivity ? (
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setQuery("");
              setRefinementParentCode(null);
              setIsOpen(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[11px] text-[color:var(--color-muted)] transition hover:text-white"
          >
            Limpiar
          </button>
        ) : null}

        {isOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 space-y-2 rounded-2xl border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-2 shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 text-xs text-[color:var(--color-muted)]">
              <span>Catalogo oficial CIIU Rev. 4 Uruguay</span>
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
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        handlePick(activity);
                      }}
                      className="w-full rounded-2xl bg-white/0 px-3 py-3 text-left text-sm text-white/90 transition hover:bg-white/8"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {activity.displayCode} - {activity.title}
                        </div>
                        <span className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80">
                          {renderActivityBadge(activity)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">
                        {activity.breadcrumbLabel}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {results.map((activity) => (
                  <button
                    key={activity.code}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      handlePick(activity);
                    }}
                    className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition ${
                      selectedActivity?.code === activity.code
                        ? "bg-[color:var(--color-accent)] text-white"
                        : "bg-white/0 text-white/90 hover:bg-white/8"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        {activity.displayCode} - {activity.title}
                      </div>
                      <span className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80">
                        {renderActivityBadge(activity)}
                      </span>
                    </div>
                    <div className="mt-1 leading-6 text-[color:var(--color-muted)]">
                      {activity.breadcrumbLabel}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/4 px-4 py-4 text-sm text-[color:var(--color-muted)]">
                No encontramos coincidencias directas. Prueba con otra palabra o activa los casos especiales DGI/019.
              </div>
            )}
          </div>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-[color:var(--color-muted)]">
        {selectedActivity
          ? selectedActivity.requiresRefinement
            ? `Seleccionaste ${selectedActivity.title}, pero antes de guardar debes refinarla a una subclase oficial.`
            : `Seleccionada: ${selectedActivity.title}.`
          : "Busca por codigo, rubro o palabra comun. Si eliges una clase padre, te pediremos refinarla antes de guardar."}
      </p>
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
    </div>
  );
}
