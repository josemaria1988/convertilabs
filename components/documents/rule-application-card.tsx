"use client";

import type { RuleApplicationExplanation } from "@/modules/accounting/rule-explainer";

type RuleApplicationCardProps = {
  explanation: RuleApplicationExplanation;
};

export function RuleApplicationCard({ explanation }: RuleApplicationCardProps) {
  return (
    <article className="rounded-3xl border border-[color:var(--color-border)] bg-white/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.04em]">{explanation.title}</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            {explanation.summary}
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          Explainability
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">Predicados que hicieron match</p>
          <ul className="mt-2 space-y-2 text-sm text-[color:var(--color-muted)]">
            {explanation.matchedPredicates.length > 0 ? (
              explanation.matchedPredicates.map((item) => (
                <li key={item} className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-3 py-2">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-2xl border border-dashed border-[color:var(--color-border)] px-3 py-2">
                No hubo una regla reusable ganadora.
              </li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Impacto de la decision</p>
          <ul className="mt-2 space-y-2 text-sm text-[color:var(--color-muted)]">
            {explanation.impactSummary.map((item) => (
              <li key={item} className="rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {explanation.riskNotes.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {explanation.riskNotes.join(" ")}
        </div>
      ) : null}
    </article>
  );
}
