import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import { AccountingRuleAiChatPanel } from "@/components/rules/accounting-rule-ai-chat-panel";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import { AccountingRuleTimeline } from "@/components/rules/accounting-rule-timeline";
import {
  changeAccountingRulePriorityAction,
  deleteUnusedAccountingRuleAction,
  pauseAccountingRuleAction,
  reactivateAccountingRuleAction,
  simulateAccountingRulePriorityChangeAction,
} from "@/app/app/o/[slug]/settings/accounting-rules/actions";
import type {
  AccountingRuleDetail,
  AccountingRulesAdminFilters,
} from "@/modules/accounting/rules-admin";
import {
  formatAccountingRuleCreatedFromLabel,
  formatDocumentRoleLabel,
  formatLifecycleStatusLabel,
  formatRuleScopeLabel,
} from "@/modules/presentation/labels";

type DetailTab = "summary" | "impact" | "conflicts" | "audit" | "more";

type Props = {
  slug: string;
  filters: AccountingRulesAdminFilters;
  backHref: string;
  rule: AccountingRuleDetail | null;
  canManage: boolean;
  canDeleteRules: boolean;
  activeTab: DetailTab;
  assistantOpen: boolean;
  initialPrompt: string | null;
};

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900";
const textAreaClassName =
  "min-h-[110px] w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900";

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin dato";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusChrome(status: AccountingRuleDetail["lifecycleStatus"]) {
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

function normalizeDesktopTab(tab: DetailTab) {
  return tab === "more" ? "summary" : tab;
}

function normalizeMobileTab(tab: DetailTab) {
  return tab === "summary" || tab === "impact" ? tab : "more";
}

function buildDetailHref(input: {
  slug: string;
  rule: AccountingRuleDetail;
  filters: AccountingRulesAdminFilters;
  tab?: DetailTab;
  assistantOpen?: boolean;
  prompt?: string | null;
}) {
  return buildRulesAdminHref(input.slug, {
    mode: "detail",
    ruleId: input.rule.id,
    filters: input.filters,
    simulationId: input.rule.selectedSimulation?.id ?? null,
    threadId: input.rule.selectedAiThreadId,
    tab: input.tab ?? null,
    assistant: input.assistantOpen,
    prompt: input.prompt ?? null,
  });
}

function SummarySection({ rule }: { rule: AccountingRuleDetail }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <article className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Que mira y que decide</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Scope visible, decisión contable y metadata operativa de esta versión.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Que mira</p>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
                {rule.conditionSummary.map((item) => <p key={item}>- {item}</p>)}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Que decide</p>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
                {rule.resultSummary.map((item) => <p key={item}>- {item}</p>)}
              </div>
            </div>
          </div>
        </article>

        <article className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Metadata</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Prioridad, origen, familia y referencias históricas relevantes.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-[13px]">
            <div className="ui-subtle-row"><span>Scope</span><span>{formatRuleScopeLabel(rule.scope)}</span></div>
            <div className="ui-subtle-row"><span>Rol</span><span>{formatDocumentRoleLabel(rule.documentRole as "purchase" | "sale" | "other")}</span></div>
            <div className="ui-subtle-row"><span>Prioridad</span><span>{rule.priority}</span></div>
            <div className="ui-subtle-row"><span>Estado</span><span>{formatLifecycleStatusLabel(rule.lifecycleStatus)}</span></div>
            <div className="ui-subtle-row"><span>Version</span><span>v{rule.versionNumber}</span></div>
            <div className="ui-subtle-row"><span>Familia</span><span>{rule.stableFamilyCode ?? "Sin familia"}</span></div>
            <div className="ui-subtle-row"><span>Origen</span><span>{formatAccountingRuleCreatedFromLabel(rule.createdFrom ?? rule.source)}</span></div>
            <div className="ui-subtle-row"><span>Cuenta</span><span>{rule.accountLabel ?? "Sin cuenta"}</span></div>
            <div className="ui-subtle-row"><span>Creada</span><span>{formatDateTime(rule.createdAt)}</span></div>
            <div className="ui-subtle-row"><span>Activada</span><span>{formatDateTime(rule.activatedAt)}</span></div>
            <div className="ui-subtle-row"><span>Creada por</span><span>{rule.createdByDisplay ?? "Sin dato"}</span></div>
            <div className="ui-subtle-row"><span>Aprobada por</span><span>{rule.approvedByDisplay ?? "Sin dato"}</span></div>
            {rule.supersedesRuleLabel ? (
              <div className="ui-subtle-row"><span>Reemplaza a</span><span>{rule.supersedesRuleLabel}</span></div>
            ) : null}
            {rule.supersededByRuleLabel ? (
              <div className="ui-subtle-row"><span>Fue reemplazada por</span><span>{rule.supersededByRuleLabel}</span></div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function LifecycleSection(props: Pick<Props, "slug" | "canManage" | "canDeleteRules"> & {
  rule: AccountingRuleDetail;
}) {
  return (
    <article className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Lifecycle</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Pausar, reactivar y eliminar solo si nunca fue usada, sin romper historial.
          </p>
        </div>
        <span className="ui-filter">{formatLifecycleStatusLabel(props.rule.lifecycleStatus)}</span>
      </div>

      {props.canManage ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Pausar</p>
            {props.rule.canPause ? (
              <form action={pauseAccountingRuleAction} className="mt-4 space-y-3">
                <input type="hidden" name="slug" value={props.slug} />
                <input type="hidden" name="ruleId" value={props.rule.id} />
                <input type="hidden" name="tab" value="summary" />
                <input name="reason" required placeholder="Motivo de pausa" className={inputClassName} />
                <SubmitButton pendingLabel="Pausando..." className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}>
                  Pausar regla
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--color-muted)]">Esta regla no está activa.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <p className="text-sm font-semibold text-white">Reactivar</p>
            {props.rule.canReactivate ? (
              <form action={reactivateAccountingRuleAction} className="mt-4 space-y-3">
                <input type="hidden" name="slug" value={props.slug} />
                <input type="hidden" name="ruleId" value={props.rule.id} />
                <input type="hidden" name="tab" value="summary" />
                <input name="reason" required placeholder="Motivo de reactivacion" className={inputClassName} />
                <SubmitButton pendingLabel="Reactivando..." className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}>
                  Reactivar regla
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--color-muted)]">
                {props.rule.reactivationBlockedReason ?? "No hace falta reactivarla ahora."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
          Tu rol puede auditar esta regla, pero no cambiar su lifecycle.
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
        <p className="text-sm font-semibold text-white">Borrado seguro</p>
        {!props.canDeleteRules ? (
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">
            Solo owner o admin pueden ejecutar el borrado seguro.
          </p>
        ) : props.rule.canDeleteUnused ? (
          <form action={deleteUnusedAccountingRuleAction} className="mt-4 space-y-3">
            <input type="hidden" name="slug" value={props.slug} />
            <input type="hidden" name="ruleId" value={props.rule.id} />
            <input type="hidden" name="tab" value="summary" />
            <textarea name="reason" required placeholder="Motivo del borrado seguro" className={textAreaClassName} />
            <SubmitButton pendingLabel="Eliminando..." className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}>
              Eliminar sin uso
            </SubmitButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-amber-100">
            {props.rule.deleteUnusedBlockedReason ?? "No se puede eliminar porque ya tiene trazabilidad. Debes pausarla."}
          </p>
        )}
      </div>
    </article>
  );
}

function ImpactSection({
  slug,
  filters,
  rule,
  canManage,
}: Pick<Props, "slug" | "filters" | "canManage"> & {
  rule: AccountingRuleDetail;
}) {
  return (
    <div className="space-y-4">
      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Impacto reciente</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Documentos donde la regla fue ganadora y acceso a simulaciones guardadas.
            </p>
          </div>
          {canManage ? (
            <LoadingLink
              href={buildRulesAdminHref(slug, {
                mode: "version",
                ruleId: rule.id,
                filters,
              })}
              pendingLabel="Abriendo versionado..."
              className="ui-button ui-button--secondary"
            >
              Crear nueva version
            </LoadingLink>
          ) : null}
        </div>

        {rule.selectedSimulation ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Simulacion seleccionada</p>
                <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                  {rule.selectedSimulation.simulationType} / {formatDateTime(rule.selectedSimulation.createdAt)}
                </p>
              </div>
              <span className="ui-filter">{rule.selectedSimulation.affectedDocumentsCount} documento(s) afectados</span>
            </div>

            <div className="mt-4 grid gap-2 text-[12px] text-[color:var(--color-muted)] md:grid-cols-3">
              <div className="ui-subtle-row"><span>Muestra</span><span>{rule.selectedSimulation.sampleSize}</span></div>
              <div className="ui-subtle-row"><span>Afectados</span><span>{rule.selectedSimulation.affectedDocumentsCount}</span></div>
              <div className="ui-subtle-row"><span>Recientes</span><span>{rule.selectedSimulation.affectedRecentDocumentsCount}</span></div>
            </div>

            <div className="mt-4 space-y-3">
              {rule.selectedSimulation.examples.map((example) => (
                <div key={`${rule.selectedSimulation?.id}:${example.documentId}`} className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <LoadingLink
                      href={`/app/o/${slug}/documents/${example.documentId}`}
                      pendingLabel="Abriendo documento..."
                      className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                    >
                      {example.originalFilename}
                    </LoadingLink>
                    <span className="ui-filter">{example.changed ? "Cambia" : "Igual"}</span>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--color-muted)]">
                    Antes: {example.previousRuleName ?? "Manual review"} / {example.previousScope ?? "sin scope"}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    Despues: {example.nextRuleName ?? "Manual review"} / {example.nextScope ?? "sin scope"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            Todavia no hay una simulacion seleccionada. Abre el versionado o ajusta prioridad para correr una.
          </div>
        )}

        {rule.recentSimulations.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {rule.recentSimulations.map((simulation) => (
              <LoadingLink
                key={simulation.id}
                href={buildRulesAdminHref(slug, {
                  mode: "detail",
                  ruleId: rule.id,
                  filters,
                  tab: "impact",
                  simulationId: simulation.id,
                })}
                pendingLabel="Abriendo simulacion..."
                className="ui-button ui-button--secondary"
              >
                {simulation.simulationType}
              </LoadingLink>
            ))}
          </div>
        ) : null}
      </article>

      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Ultimos documentos</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Corridas recientes donde esta regla quedó trazada como ganadora.
            </p>
          </div>
          <span className="ui-filter">{rule.affectedDocuments.length} visible(s)</span>
        </div>

        <div className="mt-4 space-y-3">
          {rule.affectedDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              Todavia no encontramos documentos recientes trazados a esta regla.
            </div>
          ) : (
            rule.affectedDocuments.map((document) => (
              <div key={`${document.source}:${document.documentId}`} className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <LoadingLink
                    href={`/app/o/${slug}/documents/${document.documentId}`}
                    pendingLabel="Abriendo documento..."
                    className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                  >
                    {document.originalFilename}
                  </LoadingLink>
                  <span className="ui-filter">{document.source === "assignment_run" ? "Assignment run" : "AI log"}</span>
                </div>
                <p className="mt-3 text-sm text-[color:var(--color-muted)]">
                  {document.documentDate ?? "Sin fecha"} / {document.direction ?? "Sin rol"} / {document.note ?? "Sin nota"}
                </p>
              </div>
            ))
          )}
        </div>
      </article>
    </div>
  );
}

function ConflictsSection({
  slug,
  filters,
  rule,
  canManage,
}: Pick<Props, "slug" | "filters" | "canManage"> & {
  rule: AccountingRuleDetail;
}) {
  return (
    <div className="space-y-4">
      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Conflictos y precedencia</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Reglas competidoras, explicacion de overlap y orden de prioridad actual.
            </p>
          </div>
          <span className="ui-filter">{rule.conflicts.length} conflicto(s)</span>
        </div>

        <div className="mt-4 space-y-3">
          {rule.conflicts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              No detectamos reglas competidoras visibles en este segmento.
            </div>
          ) : (
            rule.conflicts.map((conflict) => (
              <div key={conflict.otherRuleId} className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <LoadingLink
                      href={buildRulesAdminHref(slug, {
                        mode: "detail",
                        ruleId: conflict.otherRuleId,
                        filters,
                        tab: "conflicts",
                      })}
                      pendingLabel="Abriendo regla..."
                      className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                    >
                      {conflict.otherRuleName}
                    </LoadingLink>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      {formatRuleScopeLabel(conflict.otherRuleScope)} / prioridad {conflict.otherRulePriority}
                    </p>
                  </div>
                  <span className="ui-filter">{conflict.conflictType}</span>
                </div>
                <p className="mt-3 text-sm text-[color:var(--color-muted)]">{conflict.summary}</p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Mover prioridad</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Primero simulas impacto; después, si estás conforme, aplicas el cambio manual.
            </p>
          </div>
          <span className="ui-filter">Prioridad {rule.priority}</span>
        </div>

        {!canManage ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
            Tu rol puede revisar precedencia, pero no cambiarla.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Subir prioridad</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                {rule.priorityUpLabel ?? "Ya esta arriba del todo."}
              </p>
              {rule.canMovePriorityUp ? (
                <div className="mt-4 space-y-3">
                  <form action={simulateAccountingRulePriorityChangeAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="direction" value="up" />
                    <SubmitButton pendingLabel="Simulando..." className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}>
                      Simular subida
                    </SubmitButton>
                  </form>
                  <form action={changeAccountingRulePriorityAction} className="space-y-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="direction" value="up" />
                    <input type="hidden" name="tab" value="conflicts" />
                    <input name="reason" placeholder="Motivo del cambio" className={inputClassName} />
                    <SubmitButton pendingLabel="Aplicando..." className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}>
                      Aplicar subida
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
              <p className="text-sm font-semibold text-white">Bajar prioridad</p>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                {rule.priorityDownLabel ?? "Ya esta abajo del todo."}
              </p>
              {rule.canMovePriorityDown ? (
                <div className="mt-4 space-y-3">
                  <form action={simulateAccountingRulePriorityChangeAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="direction" value="down" />
                    <SubmitButton pendingLabel="Simulando..." className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}>
                      Simular bajada
                    </SubmitButton>
                  </form>
                  <form action={changeAccountingRulePriorityAction} className="space-y-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input type="hidden" name="direction" value="down" />
                    <input type="hidden" name="tab" value="conflicts" />
                    <input name="reason" placeholder="Motivo del cambio" className={inputClassName} />
                    <SubmitButton pendingLabel="Aplicando..." className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm`}>
                      Aplicar bajada
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function AuditSection({ rule }: { rule: AccountingRuleDetail }) {
  return (
    <article className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Auditoria y timeline</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Creación, pausas, reactivaciones, reemplazos, simulaciones y consultas IA ya trazadas.
          </p>
        </div>
        <span className="ui-filter">{rule.timeline.length} evento(s)</span>
      </div>

      <div className="mt-4">
        <AccountingRuleTimeline items={rule.timeline} />
      </div>
    </article>
  );
}

export function AccountingRuleDetailPanel({
  slug,
  filters,
  backHref,
  rule,
  canManage,
  canDeleteRules,
  activeTab,
  assistantOpen,
  initialPrompt,
}: Props) {
  if (!rule) {
    return (
      <section className="ui-panel">
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-6 text-sm text-[color:var(--color-muted)]">
          No pudimos abrir la regla solicitada. Vuelve al listado y elige una regla visible para esta organización.
        </div>
      </section>
    );
  }

  const desktopTab = normalizeDesktopTab(activeTab);
  const mobileTab = normalizeMobileTab(activeTab);
  const canVersion =
    canManage
    && rule.lifecycleStatus !== "superseded"
    && rule.lifecycleStatus !== "deleted_if_unused";
  const desktopTabs: Array<{ value: Exclude<DetailTab, "more">; label: string }> = [
    { value: "summary", label: "Resumen" },
    { value: "impact", label: "Impacto" },
    { value: "conflicts", label: "Conflictos" },
    { value: "audit", label: "Auditoria" },
  ];
  const mobileTabs: Array<{ value: "summary" | "impact" | "more"; label: string }> = [
    { value: "summary", label: "Resumen" },
    { value: "impact", label: "Impacto" },
    { value: "more", label: "Mas" },
  ];

  return (
    <section className="space-y-4">
      <article className="ui-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <LoadingLink href={backHref} pendingLabel="Volviendo..." className="text-sm text-[color:var(--color-muted)] underline-offset-4 hover:underline">
              Volver al listado
            </LoadingLink>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-[-0.04em] text-white">{rule.name}</h1>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusChrome(rule.lifecycleStatus)}`}>
                {formatLifecycleStatusLabel(rule.lifecycleStatus)}
              </span>
            </div>
            <p className="mt-2 text-[14px] leading-6 text-[color:var(--color-muted)]">
              {rule.description ?? "Regla reusable y auditable dentro de una familia forward-only."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <span className="ui-filter">{formatRuleScopeLabel(rule.scope)}</span>
              <span className="ui-filter">Prioridad {rule.priority}</span>
              <span className="ui-filter">v{rule.versionNumber}</span>
              <span className="ui-filter">{formatAccountingRuleCreatedFromLabel(rule.createdFrom ?? rule.source)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canVersion ? (
              <LoadingLink
                href={buildRulesAdminHref(slug, {
                  mode: "version",
                  ruleId: rule.id,
                  filters,
                })}
                pendingLabel="Abriendo versionado..."
                className="ui-button ui-button--secondary"
              >
                Nueva version
              </LoadingLink>
            ) : null}
            <LoadingLink
              href={buildDetailHref({
                slug,
                rule,
                filters,
                tab: desktopTab,
                assistantOpen: !assistantOpen,
                prompt: initialPrompt,
              })}
              pendingLabel="Abriendo analisis..."
              className={assistantOpen ? "ui-button ui-button--primary" : "ui-button ui-button--secondary"}
            >
              {assistantOpen ? "Cerrar analisis IA" : "Analizar con IA"}
            </LoadingLink>
          </div>
        </div>
      </article>

      <article className="ui-panel">
        <div className="hidden flex-wrap gap-2 md:flex">
          {desktopTabs.map((tab) => (
            <LoadingLink
              key={tab.value}
              href={buildDetailHref({
                slug,
                rule,
                filters,
                tab: tab.value,
                assistantOpen,
                prompt: initialPrompt,
              })}
              pendingLabel={`Abriendo ${tab.label.toLowerCase()}...`}
              className="ui-tab"
              data-current={desktopTab === tab.value ? "true" : "false"}
            >
              {tab.label}
            </LoadingLink>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 md:hidden">
          {mobileTabs.map((tab) => (
            <LoadingLink
              key={tab.value}
              href={buildDetailHref({
                slug,
                rule,
                filters,
                tab: tab.value,
                assistantOpen,
                prompt: initialPrompt,
              })}
              pendingLabel={`Abriendo ${tab.label.toLowerCase()}...`}
              className="ui-tab"
              data-current={mobileTab === tab.value ? "true" : "false"}
            >
              {tab.label}
            </LoadingLink>
          ))}
        </div>
      </article>

      {desktopTab === "summary" ? (
        <>
          <SummarySection rule={rule} />
          <LifecycleSection slug={slug} rule={rule} canManage={canManage} canDeleteRules={canDeleteRules} />
        </>
      ) : null}

      {desktopTab === "impact" ? (
        <ImpactSection slug={slug} filters={filters} rule={rule} canManage={canManage} />
      ) : null}

      {desktopTab === "conflicts" ? (
        <ConflictsSection slug={slug} filters={filters} rule={rule} canManage={canManage} />
      ) : null}

      {desktopTab === "audit" ? (
        <AuditSection rule={rule} />
      ) : null}

      {activeTab === "more" ? (
        <>
          <ConflictsSection slug={slug} filters={filters} rule={rule} canManage={canManage} />
          <LifecycleSection slug={slug} rule={rule} canManage={canManage} canDeleteRules={canDeleteRules} />
          <AuditSection rule={rule} />
        </>
      ) : null}

      {assistantOpen ? (
        <AccountingRuleAiChatPanel
          slug={slug}
          rule={rule}
          canManage={canManage}
          initialPrompt={initialPrompt}
        />
      ) : null}
    </section>
  );
}
