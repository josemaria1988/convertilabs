"use client";

import { useMemo, useState } from "react";
import { HelpHint } from "@/components/ui/help-hint";
import { getActivityByCode } from "@/modules/organizations/activity-catalog";
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
  const selectedSet = new Set(value);
  const selectedActivities = value
    .map((code) => getActivityByCode(code))
    .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity));
  const results = useMemo(
    () =>
      searchActivities(query, 8).filter((activity) =>
        activity.code !== primaryActivityCode
        && !selectedSet.has(activity.code)),
    [primaryActivityCode, query, selectedSet],
  );

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
            setIsOpen(true);
          }}
          placeholder="Agrega hasta 5 actividades complementarias"
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {isOpen && query.trim() && results.length > 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(35,43,58,0.99),rgba(28,35,49,1))] p-2 shadow-[0_18px_40px_rgba(7,9,14,0.35)]">
            {results.map((activity) => (
              <button
                key={activity.code}
                type="button"
                disabled={value.length >= maxItems}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onChange(unique([...value, activity.code]).slice(0, maxItems));
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full rounded-2xl px-3 py-3 text-left text-sm text-white/90 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
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
              {activity.code} - {activity.title} ×
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/5 px-4 py-3 text-sm text-[color:var(--color-muted)]">
            No agregaste actividades secundarias. Puedes seguir asi si el negocio es simple.
          </div>
        )}
      </div>

      <p className="text-sm leading-6 text-[color:var(--color-muted)]">
        Suma solo las actividades que sean recurrentes o materialmente relevantes para no inflar el plan.
      </p>
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
    </div>
  );
}
