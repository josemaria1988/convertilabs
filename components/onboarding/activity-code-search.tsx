"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityCatalogEntry } from "@/modules/organizations/activity-types";
import { getActivityByCode } from "@/modules/organizations/activity-catalog";
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
  return activity ? `${activity.code} - ${activity.title}` : "";
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
  const disabled = new Set(disabledCodes);

  useEffect(() => {
    setQuery(getActivityLabel(selectedActivity));
  }, [selectedActivity]);

  const results = useMemo(() => {
    const baseResults = searchActivities(query, 8);

    if (baseResults.length > 0) {
      return baseResults.filter((activity) => !disabled.has(activity.code));
    }

    return suggestedActivities.filter((activity) => !disabled.has(activity.code));
  }, [disabled, query, suggestedActivities]);

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
              setIsOpen(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[11px] text-[color:var(--color-muted)] transition hover:text-white"
          >
            Limpiar
          </button>
        ) : null}
        {isOpen && results.length > 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-2 shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
            {results.map((activity) => (
              <button
                key={activity.code}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSelect(activity.code);
                  setQuery(getActivityLabel(activity));
                  setIsOpen(false);
                }}
                className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition ${
                  selectedActivity?.code === activity.code
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "bg-white/0 text-white/90 hover:bg-white/8"
                }`}
              >
                <div className="font-medium">{activity.code}</div>
                <div className="mt-1 leading-6 text-[color:var(--color-muted)]">
                  {activity.title}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-[color:var(--color-muted)]">
        {selectedActivity
          ? `Seleccionada: ${selectedActivity.title}.`
          : "Busca por codigo, rubro o palabra comun. No hace falta saber el codigo exacto."}
      </p>
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
    </div>
  );
}
