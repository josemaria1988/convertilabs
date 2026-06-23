import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type {
  WorkIntakeItem,
  WorkIntakeSourceType,
  WorkIntakeStatus,
} from "@/modules/work-intake";
import type {
  WorkUnitCustomerOption,
  WorkUnitListItem,
} from "@/modules/work";

type WorkIntakePanelProps = {
  slug: string;
  canManage: boolean;
  isAvailable: boolean;
  items: WorkIntakeItem[];
  customerOptions: WorkUnitCustomerOption[];
  workOptions: WorkUnitListItem[];
  createAction: (formData: FormData) => void | Promise<void>;
  linkPartyAction: (formData: FormData) => void | Promise<void>;
  linkWorkAction: (formData: FormData) => void | Promise<void>;
  convertAction: (formData: FormData) => void | Promise<void>;
  createTaskAction: (formData: FormData) => void | Promise<void>;
  updateStatusAction: (formData: FormData) => void | Promise<void>;
};

const STATUS_OPTIONS: WorkIntakeStatus[] = [
  "captured",
  "needs_review",
  "linked_to_party",
  "linked_to_work",
  "converted_to_work",
  "quoted",
  "won",
  "lost",
  "archived",
];

function formatMoney(value: number | null, currencyCode = "UYU") {
  if (value === null) {
    return "Sin monto";
  }

  return new Intl.NumberFormat("es-UY", {
    currency: currencyCode,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatSource(value: WorkIntakeSourceType) {
  switch (value) {
    case "web_form":
      return "Web";
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "phone":
      return "Llamada";
    case "visit":
      return "Visita";
    case "zeta":
      return "Zeta";
    case "api":
      return "API";
    case "other":
      return "Otro";
    default:
      return "Manual";
  }
}

function formatStatus(value: WorkIntakeStatus) {
  switch (value) {
    case "captured":
      return "Capturada";
    case "needs_review":
      return "A revisar";
    case "linked_to_party":
      return "Con cliente";
    case "linked_to_work":
      return "Con trabajo";
    case "converted_to_work":
      return "Convertida";
    case "quoted":
      return "Cotizada";
    case "won":
      return "Ganada";
    case "lost":
      return "Perdida";
    case "archived":
      return "Archivada";
    default:
      return value;
  }
}

function getStatusClassName(status: WorkIntakeStatus) {
  if (["won", "converted_to_work", "linked_to_work"].includes(status)) {
    return "status-pill status-pill--success";
  }

  if (["needs_review", "captured", "linked_to_party", "quoted"].includes(status)) {
    return "status-pill status-pill--info";
  }

  if (status === "lost" || status === "archived") {
    return "status-pill status-pill--warning";
  }

  return "status-pill status-pill--info";
}

function IntakeCard({
  item,
  slug,
  canManage,
  customerOptions,
  workOptions,
  linkPartyAction,
  linkWorkAction,
  convertAction,
  createTaskAction,
  updateStatusAction,
}: Omit<WorkIntakePanelProps, "isAvailable" | "items" | "createAction"> & {
  item: WorkIntakeItem;
}) {
  return (
    <article className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {formatSource(item.sourceType)} / {item.customerName ?? item.partyName ?? "Cliente pendiente"} / {formatDate(item.requestedDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={getStatusClassName(item.status)}>{formatStatus(item.status)}</span>
          <span className="status-pill status-pill--info">{formatMoney(item.estimatedAmount, item.currencyCode)}</span>
        </div>
      </div>

      {item.description || item.rawText ? (
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">
          {item.description ?? item.rawText}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <div className="ui-subtle-row">
          <span>Cliente</span>
          <span>{item.partyName ?? item.customerName ?? "Pendiente"}</span>
        </div>
        <div className="ui-subtle-row">
          <span>Trabajo</span>
          <span>{item.workUnitName ?? "Pendiente"}</span>
        </div>
        <div className="ui-subtle-row">
          <span>Proxima accion</span>
          <span>{item.nextAction ?? "Sin definir"}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <form action={linkPartyAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intakeId" value={item.id} />
          <select
            name="partyId"
            defaultValue={item.partyId ?? ""}
            disabled={!canManage || customerOptions.length === 0}
            className="input-surface-dark min-h-[38px] w-full rounded-lg border border-[color:var(--color-border)] px-2 text-sm text-white"
          >
            <option value="">Cliente</option>
            {customerOptions.map((party) => (
              <option key={party.id} value={party.id}>
                {party.displayName}
              </option>
            ))}
          </select>
          <SubmitButton
            disabled={!canManage || customerOptions.length === 0}
            pendingLabel="Asociando..."
            className="ui-button ui-button--secondary min-h-[38px] w-full"
          >
            Asociar cliente
          </SubmitButton>
        </form>

        <form action={linkWorkAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intakeId" value={item.id} />
          <select
            name="workUnitId"
            defaultValue={item.workUnitId ?? ""}
            disabled={!canManage || workOptions.length === 0}
            className="input-surface-dark min-h-[38px] w-full rounded-lg border border-[color:var(--color-border)] px-2 text-sm text-white"
          >
            <option value="">Trabajo</option>
            {workOptions.map((work) => (
              <option key={work.id} value={work.id}>
                {work.name}
              </option>
            ))}
          </select>
          <SubmitButton
            disabled={!canManage || workOptions.length === 0}
            pendingLabel="Asociando..."
            className="ui-button ui-button--secondary min-h-[38px] w-full"
          >
            Asociar trabajo
          </SubmitButton>
        </form>

        <form action={convertAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intakeId" value={item.id} />
          <SubmitButton
            disabled={!canManage || Boolean(item.workUnitId)}
            pendingLabel="Convirtiendo..."
            className="ui-button ui-button--primary min-h-[84px] w-full"
          >
            Crear trabajo
          </SubmitButton>
        </form>

        <form action={createTaskAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intakeId" value={item.id} />
          <input
            type="date"
            name="dueDate"
            defaultValue={item.dueDate ?? ""}
            disabled={!canManage}
            className="input-surface-dark min-h-[38px] w-full rounded-lg border border-[color:var(--color-border)] px-2 text-sm text-white"
          />
          <SubmitButton
            disabled={!canManage}
            pendingLabel="Creando..."
            className="ui-button ui-button--secondary min-h-[38px] w-full"
          >
            Crear tarea
          </SubmitButton>
        </form>

        <form action={updateStatusAction} className="space-y-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="intakeId" value={item.id} />
          <select
            name="status"
            defaultValue={item.status}
            disabled={!canManage}
            className="input-surface-dark min-h-[38px] w-full rounded-lg border border-[color:var(--color-border)] px-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
          <SubmitButton
            disabled={!canManage}
            pendingLabel="Guardando..."
            className="ui-button ui-button--secondary min-h-[38px] w-full"
          >
            Cambiar estado
          </SubmitButton>
        </form>
      </div>

      {item.workUnitId ? (
        <LoadingLink
          href={`/app/o/${slug}/work/${item.workUnitId}`}
          pendingLabel="Abriendo..."
          className="mt-3 inline-flex text-sm font-semibold text-white underline-offset-4 hover:underline"
        >
          Abrir trabajo asociado
        </LoadingLink>
      ) : null}
    </article>
  );
}

export function WorkIntakePanel({
  slug,
  canManage,
  isAvailable,
  items,
  customerOptions,
  workOptions,
  createAction,
  linkPartyAction,
  linkWorkAction,
  convertAction,
  createTaskAction,
  updateStatusAction,
}: WorkIntakePanelProps) {
  const needsReview = items.filter((item) =>
    ["captured", "needs_review"].includes(item.status)).length;
  const unlinkedCustomers = items.filter((item) => !item.partyId).length;

  return (
    <section id="work-intake" className="ui-panel">
      <div className="ui-panel-header">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Solicitudes y cotizaciones</h2>
          <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
            Entrada manual o externa antes de convertir en trabajo, tarea o seguimiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-pill--info">{items.length} abierta(s)</span>
          <span className="status-pill status-pill--warning">{needsReview} a revisar</span>
          <span className="status-pill status-pill--info">{unlinkedCustomers} sin cliente</span>
        </div>
      </div>

      <form action={createAction} className="mt-4 grid gap-3 lg:grid-cols-6">
        <input type="hidden" name="slug" value={slug} />
        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Titulo</span>
          <input
            name="title"
            required
            disabled={!canManage || !isAvailable}
            placeholder="Cotizacion Nueva Palmira"
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Origen</span>
          <select
            name="sourceType"
            defaultValue="manual"
            disabled={!canManage || !isAvailable}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          >
            <option value="manual">Manual</option>
            <option value="email">Email</option>
            <option value="web_form">Web</option>
            <option value="phone">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="visit">Visita</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Cliente</span>
          <input
            name="customerName"
            disabled={!canManage || !isAvailable}
            placeholder="Nombre recibido"
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Email</span>
          <input
            name="customerEmail"
            type="email"
            disabled={!canManage || !isAvailable}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Telefono</span>
          <input
            name="customerPhone"
            disabled={!canManage || !isAvailable}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Descripcion</span>
          <input
            name="description"
            disabled={!canManage || !isAvailable}
            placeholder="Que pidieron, alcance o contexto"
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Ubicacion</span>
          <input
            name="locationText"
            disabled={!canManage || !isAvailable}
            placeholder="Nueva Palmira"
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Monto</span>
          <input
            name="estimatedAmount"
            inputMode="decimal"
            disabled={!canManage || !isAvailable}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Moneda</span>
          <input
            name="currencyCode"
            defaultValue="UYU"
            disabled={!canManage || !isAvailable}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Seguimiento</span>
          <input
            type="date"
            name="dueDate"
            disabled={!canManage || !isAvailable}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
        </label>
        <div className="flex items-end">
          <SubmitButton
            disabled={!canManage || !isAvailable}
            pendingLabel="Registrando..."
            className="ui-button ui-button--primary min-h-[42px] w-full"
          >
            Registrar
          </SubmitButton>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {!isAvailable ? (
          <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
            `work_intake_items` no esta disponible en esta base. Aplica la migracion de intake antes de registrar solicitudes.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
            Todavia no hay solicitudes abiertas. Carga una cotizacion o pedido real antes de crear ventas o documentos.
          </div>
        ) : (
          items.map((item) => (
            <IntakeCard
              key={item.id}
              item={item}
              slug={slug}
              canManage={canManage}
              customerOptions={customerOptions}
              workOptions={workOptions}
              linkPartyAction={linkPartyAction}
              linkWorkAction={linkWorkAction}
              convertAction={convertAction}
              createTaskAction={createTaskAction}
              updateStatusAction={updateStatusAction}
            />
          ))
        )}
      </div>
    </section>
  );
}
