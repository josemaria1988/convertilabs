import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { AccountingRuleTimeline } from "@/components/rules/accounting-rule-timeline";
import {
  pauseAccountingRuleAction,
  reactivateAccountingRuleAction,
} from "@/app/app/o/[slug]/settings/accounting-rules/actions";
import type { AccountingRuleDetail } from "@/modules/accounting/rules-admin";
import {
  formatAccountingRuleCreatedFromLabel,
  formatDocumentRoleLabel,
  formatLifecycleStatusLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";

type AccountingRuleDetailPanelProps = {
  slug: string;
  rule: AccountingRuleDetail | null;
  canManage: boolean;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin dato";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRuleStatusChrome(status: AccountingRuleDetail["lifecycleStatus"]) {
  switch (status) {
    case "active":
      return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
    case "paused":
      return "border-amber-300/35 bg-amber-500/10 text-amber-100";
    case "superseded":
      return "border-slate-300/25 bg-slate-500/10 text-slate-100";
    case "draft":
      return "border-sky-300/35 bg-sky-500/10 text-sky-100";
    default:
      return "border-[color:var(--color-border)] bg-white/10 text-[color:var(--color-muted)]";
  }
}

export function AccountingRuleDetailPanel({
  slug,
  rule,
  canManage,
}: AccountingRuleDetailPanelProps) {
  if (!rule) {
    return (
      <section className="ui-panel">
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-6 text-sm text-[color:var(--color-muted)]">
          Selecciona una regla de la lista para ver definición, documentos afectados y timeline.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <article className="ui-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-white">{rule.name}</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              {rule.description ?? "Regla reusable visible para auditoria, pausa controlada y trazabilidad hacia adelante."}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getRuleStatusChrome(rule.lifecycleStatus)}`}
          >
            {formatLifecycleStatusLabel(rule.lifecycleStatus)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            <p className="text-xs uppercase tracking-[0.18em]">Alcance</p>
            <p className="mt-2 font-semibold text-white">{formatRuleScopeLabel(rule.scope)}</p>
            <p className="mt-1">Rol documental: {formatDocumentRoleLabel(rule.documentRole as "purchase" | "sale" | "other")}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            <p className="text-xs uppercase tracking-[0.18em]">Prioridad y version</p>
            <p className="mt-2 font-semibold text-white">Prioridad {rule.priority} · v{rule.versionNumber}</p>
            <p className="mt-1">Familia: {rule.stableFamilyCode ?? "Sin familia"}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            <p className="text-xs uppercase tracking-[0.18em]">Origen</p>
            <p className="mt-2 font-semibold text-white">
              {formatAccountingRuleCreatedFromLabel(rule.createdFrom ?? rule.source)}
            </p>
            <p className="mt-1">Cuenta: {rule.accountLabel ?? "Sin cuenta"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Que mira</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
              {rule.conditionSummary.map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Que decide</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
              {rule.resultSummary.map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-[13px] text-[color:var(--color-muted)] md:grid-cols-2">
          <div className="ui-subtle-row">
            <span>Aplicaciones acumuladas</span>
            <span>{rule.documentsAppliedCount}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Matches acumulados</span>
            <span>{rule.matchesCount}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Creada</span>
            <span>{formatDateTime(rule.createdAt)}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Activada</span>
            <span>{formatDateTime(rule.activatedAt)}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Pausada</span>
            <span>{formatDateTime(rule.pausedAt)}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Ultimo match</span>
            <span>{formatDateTime(rule.lastMatchedAt)}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Creada por</span>
            <span>{rule.createdByDisplay ?? "Sin dato"}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Aprobada por</span>
            <span>{rule.approvedByDisplay ?? "Sin dato"}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Antecesora</span>
            <span>{rule.supersedesRuleLabel ?? "Sin antecesora"}</span>
          </div>
          <div className="ui-subtle-row">
            <span>Sucesora</span>
            <span>{rule.supersededByRuleLabel ?? "Sin sucesora"}</span>
          </div>
          <div className="ui-subtle-row md:col-span-2">
            <span>Documento origen</span>
            <span>{rule.sourceDocumentLabel ?? "Sin documento origen"}</span>
          </div>
        </div>
      </article>

      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Lifecycle</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              La regla se pausa o reanuda sin borrar trazabilidad ni tocar historicos.
            </p>
          </div>
          <span className="ui-filter">{formatLifecycleStatusLabel(rule.lifecycleStatus)}</span>
        </div>

        {!canManage ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            Tu rol puede auditar esta regla, pero no cambiar su lifecycle.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Pausar</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                Saca la regla de nuevas corridas y deja motivo auditado.
              </p>
              {rule.canPause ? (
                <form action={pauseAccountingRuleAction} className="mt-4 space-y-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <input
                    name="reason"
                    required
                    placeholder="Motivo de pausa"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
                  />
                  <SubmitButton
                    pendingLabel="Pausando..."
                    className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                  >
                    Pausar regla
                  </SubmitButton>
                </form>
              ) : (
                <p className="mt-4 text-sm text-[color:var(--color-muted)]">
                  Esta regla no esta en estado activo.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Reactivar</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                Vuelve a meterla en precedencia si no fue sustituida por una sucesora.
              </p>
              {rule.canReactivate ? (
                <form action={reactivateAccountingRuleAction} className="mt-4 space-y-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <input
                    name="reason"
                    required
                    placeholder="Motivo de reactivacion"
                    className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900"
                  />
                  <SubmitButton
                    pendingLabel="Reactivando..."
                    className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}
                  >
                    Reactivar regla
                  </SubmitButton>
                </form>
              ) : (
                <p className="mt-4 text-sm text-[color:var(--color-muted)]">
                  {rule.reactivationBlockedReason ?? "No hace falta reactivarla ahora."}
                </p>
              )}
            </div>
          </div>
        )}

        {rule.pauseReason ? (
          <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Motivo de pausa visible: {rule.pauseReason}
          </div>
        ) : null}
      </article>

      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Documentos afectados</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Ultimas corridas donde esta regla fue la ganadora registrada.
            </p>
          </div>
          <span className="ui-filter">{rule.affectedDocuments.length} visible(s)</span>
        </div>

        <div className="mt-4 space-y-3">
          {rule.affectedDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              Todavia no encontramos documentos recientes trazados a esta regla en los logs disponibles.
            </div>
          ) : (
            rule.affectedDocuments.map((document) => (
              <div
                key={`${document.source}:${document.documentId}`}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <LoadingLink
                      href={`/app/o/${slug}/documents/${document.documentId}`}
                      pendingLabel="Abriendo documento..."
                      className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                    >
                      {document.originalFilename}
                    </LoadingLink>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      {document.documentDate ?? "Sin fecha"} · {document.direction ?? "Sin rol"} · {document.status ?? "Sin estado"}
                    </p>
                  </div>
                  <span className="ui-filter">{document.source === "assignment_run" ? "Assignment run" : "AI log"}</span>
                </div>

                <div className="mt-3 grid gap-2 text-[12px] text-[color:var(--color-muted)] md:grid-cols-3">
                  <div className="ui-subtle-row">
                    <span>Aplicada</span>
                    <span>{formatDateTime(document.appliedAt)}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Confianza</span>
                    <span>{document.confidence !== null ? `${Math.round(document.confidence * 100)}%` : "Sin dato"}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Nota</span>
                    <span>{document.note ?? "Sin nota"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Timeline de auditoria</h3>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Eventos del lifecycle y auditoria heredada visibles en una sola secuencia.
            </p>
          </div>
          <span className="ui-filter">{rule.timeline.length} evento(s)</span>
        </div>

        <div className="mt-4">
          <AccountingRuleTimeline items={rule.timeline} />
        </div>
      </article>
    </section>
  );
}
