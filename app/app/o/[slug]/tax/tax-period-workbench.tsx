import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type { DocumentReviewPageData } from "@/modules/documents/review";
import type {
  TaxPeriodWorkbenchData,
  TaxPeriodWorkbenchItem,
  TaxPeriodWorkbenchStateFilter,
} from "@/modules/tax/tax-period-workbench";
import {
  runTaxWorkbenchDocumentAction,
  saveTaxPeriodDocumentSelectionAction,
} from "./actions";
import { TaxWorkbenchManualResolveModal } from "./tax-workbench-manual-resolve-modal";

type TaxPeriodWorkbenchProps = {
  slug: string;
  selectedYear: number;
  selectedMonth: number;
  period: string;
  workbench: TaxPeriodWorkbenchData;
  isClosedRun: boolean;
  manualResolveDocumentId: string | null;
};

const STATE_FILTERS: Array<{
  value: TaxPeriodWorkbenchStateFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "needs_review", label: "Pendientes de revision" },
  { value: "eligible", label: "Elegibles" },
  { value: "confirmed", label: "Confirmados" },
  { value: "excluded", label: "Excluidos" },
  { value: "included_in_run", label: "Incluidos en corrida" },
];

function formatAmount(value: number | null | undefined) {
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(typeof value === "number" ? value : 0);
}

function buildTaxWorkbenchHref(input: {
  slug: string;
  year: number;
  month: number;
  workbench: TaxPeriodWorkbenchData["filters"];
  overrides?: Partial<TaxPeriodWorkbenchData["filters"]>;
  modal?: "manual_assignment" | null;
}) {
  const next = {
    ...input.workbench,
    ...(input.overrides ?? {}),
  };
  const params = new URLSearchParams();

  params.set("periodYear", String(input.year));
  params.set("periodMonth", String(input.month));

  if (next.state !== "all") {
    params.set("workbenchState", next.state);
  }

  if (next.direction !== "all") {
    params.set("workbenchDirection", next.direction);
  }

  if (next.manualResolution !== "all") {
    params.set("workbenchManualResolution", next.manualResolution);
  }

  if (next.query.trim()) {
    params.set("workbenchQuery", next.query.trim());
  }

  if (next.page > 1) {
    params.set("workbenchPage", String(next.page));
  }

  if (next.focusDocumentId) {
    params.set("focusDocumentId", next.focusDocumentId);
  }

  if (input.modal) {
    params.set("workbenchModal", input.modal);
  }

  return `/app/o/${input.slug}/tax?${params.toString()}`;
}

function getTaxStateTone(item: TaxPeriodWorkbenchItem) {
  switch (item.taxState) {
    case "included_in_official_run":
      return "status-pill status-pill--success";
    case "confirmed_for_period":
    case "eligible_for_preview":
      return "status-pill status-pill--info";
    case "excluded_from_period":
      return "status-pill status-pill--warning";
    case "needs_fiscal_review":
      return "status-pill status-pill--danger";
    default:
      return "status-pill status-pill--warning";
  }
}

function renderQuickActionButtons(input: {
  slug: string;
  period: string;
  item: TaxPeriodWorkbenchItem;
  isClosedRun: boolean;
  manualResolveHref?: string | null;
}) {
  const disabledByClosedRun = input.isClosedRun;

  return (
    <div className="flex flex-wrap gap-2">
      <form
        action={async () => {
          "use server";
          await runTaxWorkbenchDocumentAction({
            slug: input.slug,
            period: input.period,
            documentIds: [input.item.documentId],
            action: "reclassify",
          });
        }}
      >
        <SubmitButton pendingLabel="Reclasificando..." className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]">
          Reclasificar
        </SubmitButton>
      </form>

      {input.manualResolveHref ? (
        <LoadingLink
          href={input.manualResolveHref}
          pendingLabel="Abriendo..."
          className={`ui-button ui-button--secondary min-h-[30px] px-3 text-[12px] ${
            disabledByClosedRun
              ? "pointer-events-none opacity-60"
              : ""
          }`}
        >
          Resolver manualmente
        </LoadingLink>
      ) : null}

      <form
        action={async () => {
          "use server";
          await runTaxWorkbenchDocumentAction({
            slug: input.slug,
            period: input.period,
            documentIds: [input.item.documentId],
            action: "post_provisional",
          });
        }}
      >
        <SubmitButton
          pendingLabel="Posteando..."
          className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]"
          disabled={!input.item.canPostProvisional || disabledByClosedRun}
        >
          Postear provisional
        </SubmitButton>
      </form>

      <form
        action={async () => {
          "use server";
          await saveTaxPeriodDocumentSelectionAction({
            slug: input.slug,
            period: input.period,
            documentIds: [input.item.documentId],
            selectionStatus: "confirmed_for_period",
          });
        }}
      >
        <SubmitButton
          pendingLabel="Confirmando..."
          className="ui-button ui-button--primary min-h-[30px] px-3 text-[12px]"
          disabled={!input.item.canConfirmForPeriod || disabledByClosedRun}
        >
          Confirmar para periodo
        </SubmitButton>
      </form>

      <form
        action={async () => {
          "use server";
          await saveTaxPeriodDocumentSelectionAction({
            slug: input.slug,
            period: input.period,
            documentIds: [input.item.documentId],
            selectionStatus: "excluded_from_period",
          });
        }}
      >
        <SubmitButton
          pendingLabel="Excluyendo..."
          className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]"
          disabled={!input.item.canExcludeFromPeriod || disabledByClosedRun}
        >
          Excluir del periodo
        </SubmitButton>
      </form>
    </div>
  );
}

function renderFocusDrawer(input: {
  slug: string;
  selectedYear: number;
  selectedMonth: number;
  workbench: TaxPeriodWorkbenchData;
  item: TaxPeriodWorkbenchItem;
  pageData: DocumentReviewPageData;
  isClosedRun: boolean;
  period: string;
}) {
  const closeHref = buildTaxWorkbenchHref({
    slug: input.slug,
    year: input.selectedYear,
    month: input.selectedMonth,
    workbench: input.workbench.filters,
    overrides: {
      focusDocumentId: null,
    },
  });
  const manualResolveHref = buildTaxWorkbenchHref({
    slug: input.slug,
    year: input.selectedYear,
    month: input.selectedMonth,
    workbench: input.workbench.filters,
    overrides: {
      focusDocumentId: input.item.documentId,
    },
    modal: "manual_assignment",
  });
  const availableManualResolveHref = input.item.canOpenManualResolve
    ? manualResolveHref
    : null;

  return (
    <aside className="ui-panel h-fit xl:sticky xl:top-4">
      <div className="ui-panel-header">
        <div>
          <h3 className="text-[16px] font-semibold text-white">Detalle fiscal del documento</h3>
          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
            Micro-revision fiscal del periodo. Si necesitas OCR o edicion profunda, abre el reviewer completo.
          </p>
        </div>
        <LoadingLink href={closeHref} pendingLabel="Cerrando..." className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]">
          Cerrar
        </LoadingLink>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-sm font-semibold text-white">{input.item.display.title}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{input.item.display.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={getTaxStateTone(input.item)}>{input.item.taxStateLabel}</span>
            <span className="status-pill status-pill--info">{input.item.workflowLabel}</span>
            <span className="status-pill status-pill--info">{input.item.resolutionSourceLabel}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-sm font-semibold text-white">Impacto fiscal y contable</p>
          <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
            <div className="ui-subtle-row">
              <span>Impacto IVA</span>
              <span>{input.item.display.impactLabel}: {formatAmount(input.item.display.impactAmount)}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Cuenta principal</span>
              <span>{input.pageData.accountingImpactPreview.summary.mainAccount ?? "Sin cuenta principal"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Cuenta IVA</span>
              <span>{input.pageData.accountingImpactPreview.summary.vatAccount ?? "Sin cuenta IVA"}</span>
            </div>
            <div className="ui-subtle-row">
              <span>Balance preview</span>
              <span>
                {input.pageData.accountingImpactPreview.journal.isBalanced ? "Balanceado" : "Desbalanceado"} ·
                {" "}Debe {formatAmount(input.pageData.accountingImpactPreview.journal.totalDebit)} /
                Haber {formatAmount(input.pageData.accountingImpactPreview.journal.totalCredit)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-sm font-semibold text-white">Checklist operativo</p>
          <div className="mt-3 space-y-2">
            {input.pageData.decisionSnapshot.checklist.slice(0, 8).map((item) => (
              <div key={item.code} className="ui-subtle-row">
                <div>
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-[12px] text-[color:var(--color-muted)]">{item.explanation}</p>
                </div>
                <span className={item.done ? "status-pill status-pill--success" : "status-pill status-pill--warning"}>
                  {item.done ? "OK" : "Falta"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {(input.pageData.decisionSnapshot.blockers.length > 0 || input.pageData.decisionSnapshot.warnings.length > 0) ? (
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
            <p className="text-sm font-semibold text-white">Blockers y warnings</p>
            <div className="mt-3 space-y-2">
              {input.pageData.decisionSnapshot.blockers.map((blocker) => (
                <div key={blocker} className="rounded-[10px] border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-100">
                  {blocker}
                </div>
              ))}
              {input.pageData.decisionSnapshot.warnings.map((warning) => (
                <div key={warning} className="rounded-[10px] border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
          <p className="text-sm font-semibold text-white">Acciones rapidas</p>
          <div className="mt-3 space-y-3">
            {renderQuickActionButtons({
              slug: input.slug,
              period: input.period,
              item: input.item,
              isClosedRun: input.isClosedRun,
              manualResolveHref: availableManualResolveHref,
            })}
            <LoadingLink
              href={input.item.reviewHref}
              pendingLabel="Abriendo..."
              className="ui-button ui-button--secondary w-full justify-center"
            >
              Abrir reviewer completo
            </LoadingLink>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function TaxPeriodWorkbench(props: TaxPeriodWorkbenchProps) {
  const manualResolveActive =
    Boolean(props.manualResolveDocumentId)
    && props.workbench.focusItem?.documentId === props.manualResolveDocumentId
    && props.workbench.focusPageData?.document.id === props.manualResolveDocumentId;
  const manualResolveCloseHref = props.workbench.focusItem
    ? buildTaxWorkbenchHref({
      slug: props.slug,
      year: props.selectedYear,
      month: props.selectedMonth,
      workbench: props.workbench.filters,
      overrides: {
        focusDocumentId: props.workbench.focusItem.documentId,
      },
      modal: null,
    })
    : buildTaxWorkbenchHref({
      slug: props.slug,
      year: props.selectedYear,
      month: props.selectedMonth,
      workbench: props.workbench.filters,
      overrides: {
        focusDocumentId: null,
      },
      modal: null,
    });

  return (
    <section className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Bandeja fiscal del periodo</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Aqui resuelves elegibilidad fiscal, inclusion en la liquidacion y micro-acciones operativas del mes, sin convertir Impuestos en Documentos 2.0.
          </p>
        </div>
        <span className="ui-filter">{props.period}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <article className="metric-card">
          <span className="metric-card__label">Total</span>
          <span className="metric-card__value">{props.workbench.summary.totalDocuments}</span>
          <p className="metric-card__hint">Documentos detectados en el periodo.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Pendientes</span>
          <span className="metric-card__value">{props.workbench.summary.pendingDocuments}</span>
          <p className="metric-card__hint">Todavia no quedaron listos para liquidar.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Elegibles</span>
          <span className="metric-card__value">{props.workbench.summary.eligibleDocuments}</span>
          <p className="metric-card__hint">Ya pueden entrar al preview o a confirmacion.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Confirmados</span>
          <span className="metric-card__value">{props.workbench.summary.confirmedDocuments}</span>
          <p className="metric-card__hint">Aceptados para liquidacion del periodo.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Excluidos</span>
          <span className="metric-card__value">{props.workbench.summary.excludedDocuments}</span>
          <p className="metric-card__hint">Quedaron fuera de la liquidacion del mes.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">En corrida</span>
          <span className="metric-card__value">{props.workbench.summary.includedInOfficialRunDocuments}</span>
          <p className="metric-card__hint">Ya incluidos en la ultima corrida oficial.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Neto IVA draft</span>
          <span className="metric-card__value">{formatAmount(props.workbench.summary.draftNetVat)}</span>
          <p className="metric-card__hint">Impacto del universo operativo actual.</p>
        </article>
        <article className="metric-card">
          <span className="metric-card__label">Neto IVA confirmado</span>
          <span className="metric-card__value">{formatAmount(props.workbench.summary.confirmedNetVat)}</span>
          <p className="metric-card__hint">Impacto del set confirmado para liquidacion.</p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <form method="get" className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
            <input type="hidden" name="periodYear" value={props.selectedYear} />
            <input type="hidden" name="periodMonth" value={props.selectedMonth} />
            <div className="flex flex-wrap gap-2">
              {STATE_FILTERS.map((stateFilter) => {
                const href = buildTaxWorkbenchHref({
                  slug: props.slug,
                  year: props.selectedYear,
                  month: props.selectedMonth,
                  workbench: props.workbench.filters,
                  overrides: {
                    state: stateFilter.value,
                    page: 1,
                    focusDocumentId: null,
                  },
                });

                return (
                  <LoadingLink
                    key={stateFilter.value}
                    href={href}
                    pendingLabel="Filtrando..."
                    className={
                      props.workbench.filters.state === stateFilter.value
                        ? "status-pill status-pill--success"
                        : "status-pill status-pill--info"
                    }
                  >
                    {stateFilter.label}
                  </LoadingLink>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_120px]">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-white">Direccion</span>
                <select
                  name="workbenchDirection"
                  defaultValue={props.workbench.filters.direction}
                  className="min-w-[130px] rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none"
                >
                  <option value="all">Todas</option>
                  <option value="purchase">Compras</option>
                  <option value="sale">Ventas</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-white">Buscar</span>
                <input
                  name="workbenchQuery"
                  defaultValue={props.workbench.filters.query}
                  placeholder="Proveedor, numero, fecha..."
                  className="w-full rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none"
                />
              </label>
              <div className="flex items-end">
                <SubmitButton pendingLabel="Filtrando..." className="ui-button ui-button--secondary w-full">
                  Aplicar
                </SubmitButton>
              </div>
            </div>
          </form>

          <form
            id="bulk-tax-workbench-form"
            action={async (formData: FormData) => {
              "use server";
              const documentIds = formData.getAll("documentIds").map(String);
              const intent = String(formData.get("intent") ?? "");

              if (intent === "confirm") {
                await saveTaxPeriodDocumentSelectionAction({
                  slug: props.slug,
                  period: props.period,
                  documentIds,
                  selectionStatus: "confirmed_for_period",
                });
                return;
              }

              if (intent === "exclude") {
                await saveTaxPeriodDocumentSelectionAction({
                  slug: props.slug,
                  period: props.period,
                  documentIds,
                  selectionStatus: "excluded_from_period",
                });
                return;
              }

              if (intent === "reclassify") {
                await runTaxWorkbenchDocumentAction({
                  slug: props.slug,
                  period: props.period,
                  documentIds,
                  action: "reclassify",
                });
                return;
              }

              if (intent === "manual") {
                await runTaxWorkbenchDocumentAction({
                  slug: props.slug,
                  period: props.period,
                  documentIds,
                  action: "confirm_manual",
                });
                return;
              }

              if (intent === "provisional") {
                await runTaxWorkbenchDocumentAction({
                  slug: props.slug,
                  period: props.period,
                  documentIds,
                  action: "post_provisional",
                });
              }
            }}
            className="flex flex-wrap gap-2 rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4"
          >
            <button type="submit" name="intent" value="confirm" className="ui-button ui-button--primary" disabled={props.isClosedRun}>
              Confirmar seleccionados
            </button>
            <button type="submit" name="intent" value="exclude" className="ui-button ui-button--secondary" disabled={props.isClosedRun}>
              Excluir seleccionados
            </button>
            <button type="submit" name="intent" value="reclassify" className="ui-button ui-button--secondary" disabled={props.isClosedRun}>
              Reclasificar seleccionados
            </button>
            <button type="submit" name="intent" value="manual" className="ui-button ui-button--secondary" disabled={props.isClosedRun}>
              Marcar revision manual
            </button>
            <button type="submit" name="intent" value="provisional" className="ui-button ui-button--secondary" disabled={props.isClosedRun}>
              Postear provisional
            </button>
            {props.isClosedRun ? (
              <span className="text-sm text-[color:var(--color-muted)]">
                El periodo esta cerrado. Reabre la corrida antes de mutar la bandeja fiscal.
              </span>
            ) : null}
          </form>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8">
            <div className="grid grid-cols-[32px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 border-b border-[color:var(--color-border)] px-4 py-3 text-[12px] uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
              <span />
              <span>Documento</span>
              <span>Estado</span>
              <span>Impacto IVA</span>
              <span>Acciones</span>
            </div>
            <div className="divide-y divide-[color:var(--color-border)]">
              {props.workbench.items.length === 0 ? (
                <div className="px-4 py-8 text-sm text-[color:var(--color-muted)]">
                  No hay documentos para el filtro actual.
                </div>
              ) : props.workbench.items.map((item) => {
                const focusHref = buildTaxWorkbenchHref({
                  slug: props.slug,
                  year: props.selectedYear,
                  month: props.selectedMonth,
                  workbench: props.workbench.filters,
                  overrides: {
                    focusDocumentId: item.documentId,
                  },
                });
                const manualResolveHref = buildTaxWorkbenchHref({
                  slug: props.slug,
                  year: props.selectedYear,
                  month: props.selectedMonth,
                  workbench: props.workbench.filters,
                  overrides: {
                    focusDocumentId: item.documentId,
                  },
                  modal: "manual_assignment",
                });
                const availableManualResolveHref = item.canOpenManualResolve
                  ? manualResolveHref
                  : null;

                return (
                  <div key={item.documentId} className="grid grid-cols-[32px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-4 py-4">
                    <label className="flex items-start justify-center pt-1">
                      <input
                        form="bulk-tax-workbench-form"
                        type="checkbox"
                        name="documentIds"
                        value={item.documentId}
                        className="h-4 w-4 rounded border border-[color:var(--color-border)] bg-transparent"
                      />
                    </label>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.display.title}</p>
                        <p className="text-[13px] text-[color:var(--color-muted)]">{item.display.subtitle}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={getTaxStateTone(item)}>{item.taxStateLabel}</span>
                        <span className="status-pill status-pill--info">{item.resolutionSourceLabel}</span>
                        <span className="status-pill status-pill--info">{item.postingStateLabel}</span>
                      </div>
                      <div className="text-[13px] text-[color:var(--color-muted)]">
                        {item.display.direction === "purchase" ? "Compra" : item.display.direction === "sale" ? "Venta" : "Otro"} / {item.display.documentType ?? "Tipo sin resolver"}
                        {" "}· Clasificacion {item.classificationLabel}
                      </div>
                      <div className="text-[13px] text-[color:var(--color-muted)]">
                        {item.taxStateSummary}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[13px] text-[color:var(--color-muted)]">
                        <p className="font-medium text-white">{item.workflowLabel}</p>
                        <p className="mt-1">{item.nextBestAction ?? "Sin accion sugerida"}</p>
                      </div>
                      <div className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[13px] text-[color:var(--color-muted)]">
                        <p>{item.vatPreviewSummary}</p>
                        <p className="mt-1">{item.vatRunSummary}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-[13px]">
                      <div className="rounded-[10px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2">
                        <p className="text-white">{item.display.impactLabel}</p>
                        <p className="mt-1 text-[color:var(--color-muted)]">{formatAmount(item.display.impactAmount)}</p>
                      </div>
                      <div className="text-[color:var(--color-muted)]">
                        {item.blockersCount} blockers · {item.warningsCount} warnings
                      </div>
                    </div>
                    <div className="flex min-w-[220px] flex-col gap-2">
                      <LoadingLink href={focusHref} pendingLabel="Abriendo..." className="ui-button ui-button--secondary justify-center text-[12px]">
                        Ver detalle
                      </LoadingLink>
                      {renderQuickActionButtons({
                        slug: props.slug,
                        period: props.period,
                        item,
                        isClosedRun: props.isClosedRun,
                        manualResolveHref: availableManualResolveHref,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--color-muted)]">
            <span>
              Pagina {props.workbench.pagination.page} de {props.workbench.pagination.totalPages} · {props.workbench.pagination.totalItems} documentos
            </span>
            <div className="flex gap-2">
              {props.workbench.pagination.page > 1 ? (
                <LoadingLink
                  href={buildTaxWorkbenchHref({
                    slug: props.slug,
                    year: props.selectedYear,
                    month: props.selectedMonth,
                    workbench: props.workbench.filters,
                    overrides: {
                      page: props.workbench.pagination.page - 1,
                      focusDocumentId: null,
                    },
                  })}
                  pendingLabel="Cargando..."
                  className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]"
                >
                  Anterior
                </LoadingLink>
              ) : null}
              {props.workbench.pagination.page < props.workbench.pagination.totalPages ? (
                <LoadingLink
                  href={buildTaxWorkbenchHref({
                    slug: props.slug,
                    year: props.selectedYear,
                    month: props.selectedMonth,
                    workbench: props.workbench.filters,
                    overrides: {
                      page: props.workbench.pagination.page + 1,
                      focusDocumentId: null,
                    },
                  })}
                  pendingLabel="Cargando..."
                  className="ui-button ui-button--secondary min-h-[30px] px-3 text-[12px]"
                >
                  Siguiente
                </LoadingLink>
              ) : null}
            </div>
          </div>
        </div>

        {props.workbench.focusItem && props.workbench.focusPageData ? renderFocusDrawer({
          slug: props.slug,
          selectedYear: props.selectedYear,
          selectedMonth: props.selectedMonth,
          workbench: props.workbench,
          item: props.workbench.focusItem,
          pageData: props.workbench.focusPageData,
          isClosedRun: props.isClosedRun,
          period: props.period,
        }) : props.workbench.focusItem ? (
          <aside className="ui-panel h-fit xl:sticky xl:top-4">
            <div className="ui-panel-header">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Detalle fiscal</h3>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  El documento esta detectado en el periodo, pero todavia no tiene suficiente base revisable para abrir un drawer completo aqui.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">{props.workbench.focusItem.display.title}</p>
              <p className="text-sm text-[color:var(--color-muted)]">{props.workbench.focusItem.display.subtitle}</p>
              <span className={getTaxStateTone(props.workbench.focusItem)}>{props.workbench.focusItem.taxStateLabel}</span>
              <p className="text-sm text-[color:var(--color-muted)]">{props.workbench.focusItem.taxStateSummary}</p>
              <LoadingLink
                href={props.workbench.focusItem.reviewHref}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary w-full justify-center"
              >
                Abrir reviewer completo
              </LoadingLink>
            </div>
          </aside>
        ) : (
          <aside className="ui-panel h-fit xl:sticky xl:top-4">
            <div className="ui-panel-header">
              <div>
                <h3 className="text-[16px] font-semibold text-white">Detalle fiscal</h3>
                <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                  Selecciona un documento para ver resumen humano, preview contable, impacto IVA y blockers sin salir del periodo.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-white/8 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              La bandeja prioriza la resolucion fiscal del mes. El detalle profundo del documento sigue disponible en el reviewer completo.
            </div>
          </aside>
        )}
      </div>

      {manualResolveActive && props.workbench.focusItem && props.workbench.focusPageData ? (
        <TaxWorkbenchManualResolveModal
          slug={props.slug}
          closeHref={manualResolveCloseHref}
          reviewHref={props.workbench.focusItem.reviewHref}
          title={props.workbench.focusItem.display.title}
          subtitle={props.workbench.focusItem.display.subtitle}
          pageData={{
            documentId: props.workbench.focusPageData.document.id,
            accountRoleAssignments: props.workbench.focusPageData.accountRoleAssignments,
            accounts: props.workbench.focusPageData.accountingOptions.accounts,
            primaryAccountRole:
              props.workbench.focusPageData.derived.settlementContext.primaryAccountRole ?? null,
            manualRoleOverrides:
              props.workbench.focusPageData.derived.accountingContext.manualRoleOverrides ?? null,
            manualOverrideAccountId:
              props.workbench.focusPageData.derived.accountingContext.manualOverrideAccountId ?? null,
            currentMainAccount:
              props.workbench.focusPageData.accountingImpactPreview.summary.mainAccount ?? null,
            currentVatAccount:
              props.workbench.focusPageData.accountingImpactPreview.summary.vatAccount ?? null,
            isBalanced:
              props.workbench.focusPageData.accountingImpactPreview.journal.isBalanced,
            totalDebit:
              props.workbench.focusPageData.accountingImpactPreview.journal.totalDebit,
            totalCredit:
              props.workbench.focusPageData.accountingImpactPreview.journal.totalCredit,
          }}
        />
      ) : null}
    </section>
  );
}
