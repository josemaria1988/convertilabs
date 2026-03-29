"use client";

import { LoadingLink } from "@/components/ui/loading-link";
import type { RuleApplicationExplanation } from "@/modules/accounting/rule-explainer";

type RuleApplicationCardProps = {
  explanation: RuleApplicationExplanation;
  organizationSlug?: string;
  documentId?: string | null;
};

export function RuleApplicationCard({
  explanation,
  organizationSlug,
  documentId,
}: RuleApplicationCardProps) {
  const hasRuleLink = Boolean(organizationSlug && explanation.ruleId);
  const analysisPrompt =
    explanation.ruleId && documentId
      ? `Analiza por que el documento ${documentId} cayo en esta regla, que conflictos tiene y que cambios manuales convendria evaluar.`
      : null;

  return (
    <article className="rounded-3xl border border-[color:var(--color-border)] surface-card-dark p-5">
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

      {hasRuleLink ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <LoadingLink
            href={`/app/o/${organizationSlug}/rules/${explanation.ruleId}`}
            pendingLabel="Abriendo regla..."
            className="ui-button ui-button--secondary"
          >
            Ver esta regla en administracion
          </LoadingLink>
          <LoadingLink
            href={`/app/o/${organizationSlug}/rules/${explanation.ruleId}?tab=conflicts`}
            pendingLabel="Abriendo conflictos..."
            className="ui-button ui-button--secondary"
          >
            Ver reglas competidoras
          </LoadingLink>
          {analysisPrompt ? (
            <LoadingLink
              href={`/app/o/${organizationSlug}/rules/${explanation.ruleId}?tab=audit&assistant=1&prompt=${encodeURIComponent(analysisPrompt)}`}
              pendingLabel="Abriendo analisis..."
              className="ui-button ui-button--secondary"
            >
              Abrir analisis en chat IA
            </LoadingLink>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">Predicados que hicieron match</p>
          <ul className="mt-2 space-y-2 text-sm text-[color:var(--color-muted)]">
            {explanation.matchedPredicates.length > 0 ? (
              explanation.matchedPredicates.map((item) => (
                <li key={item} className="rounded-2xl border border-[color:var(--color-border)] surface-card-dark-soft px-3 py-2">
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
              <li key={item} className="rounded-2xl border border-[color:var(--color-border)] surface-card-dark-soft px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {explanation.riskNotes.length > 0 ? (
        <div className="alert-dark-warning mt-4 rounded-2xl px-4 py-3 text-sm">
          {explanation.riskNotes.join(" ")}
        </div>
      ) : null}
    </article>
  );
}
