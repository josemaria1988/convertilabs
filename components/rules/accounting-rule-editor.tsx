"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { LoadingLink } from "@/components/ui/loading-link";
import {
  buttonBaseClassName,
  buttonPrimaryChromeClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";
import {
  createManualAccountingRuleClientAction,
  createSupersedingAccountingRuleClientAction,
  simulateManualAccountingRuleClientAction,
  simulateSupersedingAccountingRuleClientAction,
} from "@/app/app/o/[slug]/settings/accounting-rules/actions";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import type {
  AccountingRuleDetail,
  AccountingRuleEditorOption,
  AccountingRulesAdminEditorOptions,
} from "@/modules/accounting/rules-admin";
import { formatDocumentRoleLabel, formatRuleScopeLabel } from "@/modules/presentation/labels";

type EditorMode = "create" | "version";
type MobileStep = 0 | 1 | 2;

type SimulationPreview = {
  simulationId: string | null;
  sampleSize: number;
  changedDocumentsCount: number;
  examples: Array<{
    documentId: string;
    originalFilename: string;
    documentDate: string | null;
    previousRuleId: string | null;
    previousRuleName: string | null;
    previousScope: string | null;
    nextRuleId: string | null;
    nextRuleName: string | null;
    nextScope: string | null;
    changed: boolean;
  }>;
  summary: Record<string, unknown>;
} | null;

type Props = {
  slug: string;
  mode: EditorMode;
  backHref: string;
  editorOptions: AccountingRulesAdminEditorOptions;
  rule?: AccountingRuleDetail | null;
  initialSimulation?: SimulationPreview;
};

type FormState = {
  name: string;
  description: string;
  scope: string;
  documentRole: string;
  vendorId: string;
  conceptId: string;
  accountId: string;
  taxProfileCode: string;
  operationCategory: string;
  linkedOperationType: string;
  templateCode: string;
  priority: string;
  reason: string;
};

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900";
const textAreaClassName =
  "min-h-[110px] w-full rounded-2xl border border-[color:var(--color-border)] bg-white/85 px-4 py-3 text-sm text-slate-900";

function defaultPriorityForScope(scope: string) {
  switch (scope) {
    case "vendor_concept_operation_category":
      return "950";
    case "vendor_concept":
      return "900";
    case "concept_global":
      return "800";
    case "vendor_default":
      return "700";
    case "document_override":
      return "1000";
    default:
      return "700";
  }
}

function withCurrent(
  options: AccountingRuleEditorOption[],
  id: string | null | undefined,
  label: string | null | undefined,
  note?: string | null,
) {
  if (!id || !label || options.some((option) => option.id === id)) {
    return options;
  }

  return [{ id, label, note: note ?? null }, ...options];
}

function formatOption(option: AccountingRuleEditorOption, concept = false) {
  if (concept && option.note) {
    return `${option.label} - ${formatDocumentRoleLabel(option.note as "purchase" | "sale" | "other")}`;
  }

  if (option.note && option.note !== option.label) {
    return `${option.label} - ${option.note}`;
  }

  return option.label;
}

function buildInitialState(mode: EditorMode, rule?: AccountingRuleDetail | null): FormState {
  const fallbackScope = mode === "create" ? "vendor_concept_operation_category" : (rule?.scope ?? "vendor_concept_operation_category");

  return {
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    scope: fallbackScope,
    documentRole: rule?.documentRole ?? "purchase",
    vendorId: rule?.vendorId ?? "",
    conceptId: rule?.conceptId ?? "",
    accountId: rule?.accountId ?? "",
    taxProfileCode: rule?.taxProfileCode ?? "",
    operationCategory: rule?.operationCategory ?? "",
    linkedOperationType: rule?.linkedOperationType ?? "",
    templateCode: rule?.templateCode ?? "",
    priority: mode === "create" ? defaultPriorityForScope(fallbackScope) : String(rule?.priority ?? ""),
    reason: "",
  };
}

function extractWarnings(summary: Record<string, unknown>) {
  const rawWarnings = summary.warnings;
  return Array.isArray(rawWarnings)
    ? rawWarnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function renderStepChrome(currentStep: MobileStep) {
  return [
    { step: 0 as MobileStep, label: "Scope" },
    { step: 1 as MobileStep, label: "Decision" },
    { step: 2 as MobileStep, label: "Confirmacion" },
  ].map((item) => (
    <div
      key={item.step}
      className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${
        currentStep === item.step
          ? "border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)] text-white"
          : "border-[color:var(--color-border)] bg-white/6 text-[color:var(--color-muted)]"
      }`}
    >
      {item.label}
    </div>
  ));
}

export function AccountingRuleEditor({
  slug,
  mode,
  backHref,
  editorOptions,
  rule = null,
  initialSimulation = null,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<MobileStep>(0);
  const [feedback, setFeedback] = useState("");
  const [pendingAction, setPendingAction] = useState<"simulate" | "save" | null>(null);
  const [simulation, setSimulation] = useState<SimulationPreview>(initialSimulation);
  const [form, setForm] = useState<FormState>(() => buildInitialState(mode, rule));

  useEffect(() => {
    setForm(buildInitialState(mode, rule));
    setSimulation(initialSimulation);
    setFeedback("");
    setCurrentStep(0);
  }, [initialSimulation, mode, rule]);

  const vendorOptions = withCurrent(editorOptions.vendors, rule?.vendorId, rule?.vendorName);
  const conceptOptions = withCurrent(editorOptions.concepts, rule?.conceptId, rule?.conceptName, rule?.documentRole ?? null);
  const accountOptions = withCurrent(editorOptions.accounts, rule?.accountId, rule?.accountLabel);
  const allowDocumentOverride = mode === "version" && Boolean(rule?.documentId || rule?.scope === "document_override");

  if (mode === "version" && !rule) {
    return (
      <section className="ui-panel">
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-6 text-sm text-[color:var(--color-muted)]">
          No pudimos cargar la regla base para versionar.
        </div>
      </section>
    );
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      if (key === "scope" && mode === "create" && current.priority === defaultPriorityForScope(current.scope)) {
        return {
          ...current,
          [key]: value,
          priority: defaultPriorityForScope(String(value)),
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function runSimulation() {
    setFeedback("");
    setPendingAction("simulate");

    startTransition(async () => {
      const result = mode === "create"
        ? await simulateManualAccountingRuleClientAction({
          slug,
          name: form.name,
          description: form.description,
          scope: form.scope,
          documentRole: form.documentRole,
          vendorId: form.vendorId,
          conceptId: form.conceptId,
          accountId: form.accountId,
          taxProfileCode: form.taxProfileCode,
          operationCategory: form.operationCategory,
          linkedOperationType: form.linkedOperationType,
          templateCode: form.templateCode,
          priority: form.priority,
        })
        : await simulateSupersedingAccountingRuleClientAction({
          slug,
          ruleId: rule?.id ?? "",
          name: form.name,
          description: form.description,
          scope: form.scope,
          documentRole: form.documentRole,
          vendorId: form.vendorId,
          conceptId: form.conceptId,
          accountId: form.accountId,
          taxProfileCode: form.taxProfileCode,
          operationCategory: form.operationCategory,
          linkedOperationType: form.linkedOperationType,
          templateCode: form.templateCode,
        });

      setPendingAction(null);
      setFeedback(result.message);

      if (result.ok) {
        setSimulation(result.simulation);
        setCurrentStep(2);
      }
    });
  }

  function saveRule() {
    setFeedback("");
    setPendingAction("save");

    startTransition(async () => {
      const result = mode === "create"
        ? await createManualAccountingRuleClientAction({
          slug,
          name: form.name,
          description: form.description,
          scope: form.scope,
          documentRole: form.documentRole,
          vendorId: form.vendorId,
          conceptId: form.conceptId,
          accountId: form.accountId,
          taxProfileCode: form.taxProfileCode,
          operationCategory: form.operationCategory,
          linkedOperationType: form.linkedOperationType,
          templateCode: form.templateCode,
          priority: form.priority,
          reason: form.reason,
        })
        : await createSupersedingAccountingRuleClientAction({
          slug,
          ruleId: rule?.id ?? "",
          reason: form.reason,
          name: form.name,
          description: form.description,
          scope: form.scope,
          documentRole: form.documentRole,
          vendorId: form.vendorId,
          conceptId: form.conceptId,
          accountId: form.accountId,
          taxProfileCode: form.taxProfileCode,
          operationCategory: form.operationCategory,
          linkedOperationType: form.linkedOperationType,
          templateCode: form.templateCode,
        });

      setPendingAction(null);

      if (!result.ok || !result.ruleId) {
        setFeedback(result.message);
        return;
      }

      router.push(buildRulesAdminHref(slug, {
        mode: "detail",
        ruleId: result.ruleId,
      }));
    });
  }

  const scopeSection = (
    <article className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Scope</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Define qué mira la regla y hasta dónde llega su alcance.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Nombre de la regla" className={inputClassName} />
        <select value={form.scope} onChange={(event) => updateField("scope", event.target.value)} className={inputClassName}>
          {allowDocumentOverride ? (
            <option value="document_override">{formatRuleScopeLabel("document_override")}</option>
          ) : null}
          <option value="vendor_concept_operation_category">{formatRuleScopeLabel("vendor_concept_operation_category")}</option>
          <option value="vendor_concept">{formatRuleScopeLabel("vendor_concept")}</option>
          <option value="concept_global">{formatRuleScopeLabel("concept_global")}</option>
          <option value="vendor_default">{formatRuleScopeLabel("vendor_default")}</option>
        </select>
        <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Descripcion operativa visible" className={`${textAreaClassName} md:col-span-2`} />
        <select value={form.documentRole} onChange={(event) => updateField("documentRole", event.target.value)} className={inputClassName}>
          <option value="purchase">{formatDocumentRoleLabel("purchase")}</option>
          <option value="sale">{formatDocumentRoleLabel("sale")}</option>
          <option value="other">{formatDocumentRoleLabel("other")}</option>
        </select>
        <input value={form.operationCategory} onChange={(event) => updateField("operationCategory", event.target.value)} placeholder="Categoria operativa" className={inputClassName} />
        <select value={form.vendorId} onChange={(event) => updateField("vendorId", event.target.value)} className={inputClassName}>
          <option value="">Sin proveedor</option>
          {vendorOptions.map((option) => <option key={option.id} value={option.id}>{formatOption(option)}</option>)}
        </select>
        <select value={form.conceptId} onChange={(event) => updateField("conceptId", event.target.value)} className={inputClassName}>
          <option value="">Sin concepto</option>
          {conceptOptions.map((option) => <option key={option.id} value={option.id}>{formatOption(option, true)}</option>)}
        </select>
      </div>
    </article>
  );

  const decisionSection = (
    <article className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Decision</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Define cuenta destino, plantilla, tax profile y prioridad operativa.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <select value={form.accountId} onChange={(event) => updateField("accountId", event.target.value)} className={inputClassName}>
          <option value="">Selecciona una cuenta</option>
          {accountOptions.map((option) => <option key={option.id} value={option.id}>{formatOption(option)}</option>)}
        </select>
        <input value={form.linkedOperationType} onChange={(event) => updateField("linkedOperationType", event.target.value)} placeholder="Operacion o medio ligado" className={inputClassName} />
        <input value={form.templateCode} onChange={(event) => updateField("templateCode", event.target.value)} placeholder="Template contable" className={inputClassName} />
        <input value={form.taxProfileCode} onChange={(event) => updateField("taxProfileCode", event.target.value)} placeholder="Tax profile" className={inputClassName} />
        {mode === "create" ? (
          <input value={form.priority} onChange={(event) => updateField("priority", event.target.value)} placeholder="Prioridad" className={inputClassName} />
        ) : (
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 px-4 py-3 text-sm text-[color:var(--color-muted)]">
            <p className="font-semibold text-white">Prioridad heredada</p>
            <p className="mt-1">
              {rule?.priority ?? "Sin dato"}. Si quieres mover precedencia, hazlo desde la pestaña de conflictos.
            </p>
          </div>
        )}
      </div>
    </article>
  );

  const confirmationSection = (
    <article className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Confirmacion</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Justifica el cambio, simula impacto y recién después guarda.
          </p>
        </div>
      </div>

      {mode === "version" ? (
        <div className="mt-4 rounded-2xl border border-[rgba(124,157,255,0.34)] bg-[rgba(124,157,255,0.08)] p-4 text-sm text-[color:var(--color-muted)]">
          <p className="font-semibold text-white">Estas creando una nueva version</p>
          <p className="mt-2">
            La regla historica no será modificada. Al confirmar se crea una sucesora activa y la versión anterior queda trazable.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <textarea value={form.reason} onChange={(event) => updateField("reason", event.target.value)} placeholder="Justificacion o motivo obligatorio" className={textAreaClassName} />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={runSimulation}
            className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {isPending && pendingAction === "simulate" ? <InlineSpinner /> : null}
            Simular impacto
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={saveRule}
            className={`${buttonBaseClassName} ${buttonPrimaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {isPending && pendingAction === "save" ? <InlineSpinner /> : null}
            {mode === "create" ? "Guardar regla" : "Crear nueva version"}
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <section className="space-y-4">
      <article className="ui-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <LoadingLink href={backHref} pendingLabel="Volviendo..." className="text-sm text-[color:var(--color-muted)] underline-offset-4 hover:underline">
              Volver
            </LoadingLink>
            <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.04em] text-white">
              {mode === "create" ? "Nueva regla" : "Nueva version de regla"}
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-[color:var(--color-muted)]">
              {mode === "create"
                ? "Flujo dedicado para crear una regla reusable sin mezclarla con el detalle de otra existente."
                : "Editor forward-only para crear una sucesora sin mutar la regla histórica."}
            </p>
          </div>
        </div>

        {mode === "version" && rule ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              <p className="text-xs uppercase tracking-[0.18em]">Base</p>
              <p className="mt-2 font-semibold text-white">{rule.name}</p>
              <p className="mt-1">{formatRuleScopeLabel(rule.scope)}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              <p className="text-xs uppercase tracking-[0.18em]">Version actual</p>
              <p className="mt-2 font-semibold text-white">v{rule.versionNumber}</p>
              <p className="mt-1">Prioridad {rule.priority}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
              <p className="text-xs uppercase tracking-[0.18em]">Cuenta heredada</p>
              <p className="mt-2 font-semibold text-white">{rule.accountLabel ?? "Sin cuenta"}</p>
              <p className="mt-1">{rule.vendorName ?? rule.conceptName ?? "Sin referencia visible"}</p>
            </div>
          </div>
        ) : null}
      </article>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-3 md:hidden">
            <div className="grid grid-cols-3 gap-2">
              {renderStepChrome(currentStep)}
            </div>
          </div>

          <div className="hidden space-y-4 md:block">
            {scopeSection}
            {decisionSection}
            {confirmationSection}
          </div>

          <div className="space-y-4 md:hidden">
            {currentStep === 0 ? scopeSection : null}
            {currentStep === 1 ? decisionSection : null}
            {currentStep === 2 ? confirmationSection : null}

            <div className="flex justify-between gap-3">
              <button
                type="button"
                disabled={currentStep === 0 || isPending}
                onClick={() => setCurrentStep((current) => Math.max(0, current - 1) as MobileStep)}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={currentStep === 2 || isPending}
                onClick={() => setCurrentStep((current) => Math.min(2, current + 1) as MobileStep)}
                className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm disabled:opacity-60`}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {simulation ? (
            <article className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Preview de simulacion</h2>
                  <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                    Cambio estimado antes de guardar.
                  </p>
                </div>
                <span className="ui-filter">{simulation.changedDocumentsCount} cambia(n)</span>
              </div>

              <div className="mt-4 grid gap-2 text-[12px] text-[color:var(--color-muted)]">
                <div className="ui-subtle-row"><span>Muestra</span><span>{simulation.sampleSize}</span></div>
                <div className="ui-subtle-row"><span>Afectados</span><span>{simulation.changedDocumentsCount}</span></div>
              </div>

              <div className="mt-4 space-y-3">
                {simulation.examples.map((example) => (
                  <div key={`simulation:${example.documentId}`} className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4">
                    <p className="text-sm font-semibold text-white">{example.originalFilename}</p>
                    <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                      Antes: {example.previousRuleName ?? "Manual review"} / {example.previousScope ?? "sin scope"}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      Despues: {example.nextRuleName ?? "Manual review"} / {example.nextScope ?? "sin scope"}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ) : (
            <article className="ui-panel">
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/6 p-4 text-sm text-[color:var(--color-muted)]">
                Corre una simulacion para ver impacto antes de guardar.
              </div>
            </article>
          )}

          {feedback ? (
            <article className="ui-panel">
              <p className="text-sm text-[color:var(--color-muted)]">{feedback}</p>
            </article>
          ) : null}

          {simulation ? (
            <article className="ui-panel">
              <div className="ui-panel-header">
                <div>
                  <h2 className="text-[16px] font-semibold text-white">Alertas</h2>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--color-muted)]">
                {extractWarnings(simulation.summary).length > 0 ? (
                  extractWarnings(simulation.summary).map((warning) => (
                    <p key={warning}>- {warning}</p>
                  ))
                ) : (
                  <p>Sin alertas explícitas en la simulacion guardada.</p>
                )}
              </div>
            </article>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
