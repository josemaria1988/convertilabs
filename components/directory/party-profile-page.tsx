import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type {
  PartyProfileData,
  PartyRoleType,
} from "@/modules/directory";

type PartyProfilePageProps = {
  slug: string;
  canManage: boolean;
  data: PartyProfileData;
  addContactAction: (formData: FormData) => void | Promise<void>;
  createInteractionAction: (formData: FormData) => void | Promise<void>;
};

const roleLabels: Record<PartyRoleType, string> = {
  customer: "Cliente",
  vendor: "Proveedor",
  bank: "Banco",
  institution: "Organismo",
  accountant: "Contador",
  employee: "Empleado",
  partner: "Socio",
  transport: "Transporte",
  internal: "Interno",
  other: "Otro",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "UYU",
  }).format(value);
}

function linkLabel(type: string) {
  switch (type) {
    case "work_unit":
      return "Trabajo";
    case "document":
      return "Documento";
    case "task":
      return "Tarea";
    case "open_item":
      return "Open item";
    case "process_run":
      return "Proceso";
    default:
      return type;
  }
}

export function PartyProfilePage({
  slug,
  canManage,
  data,
  addContactAction,
  createInteractionAction,
}: PartyProfilePageProps) {
  if (!data.isAvailable) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Perfil party
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              El schema de directorio todavia no esta disponible en esta base.
            </p>
          </div>
          <span className="status-pill status-pill--warning">Schema pendiente</span>
        </div>
      </section>
    );
  }

  if (!data.party) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Party no encontrada
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              No existe una party con ese identificador dentro de esta organizacion.
            </p>
          </div>
          <LoadingLink href={`/app/o/${slug}/directory`} pendingLabel="Abriendo..." className="ui-button ui-button--secondary">
            Volver
          </LoadingLink>
        </div>
      </section>
    );
  }

  const party = data.party;
  const disabled = !canManage;

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              {party.displayName}
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              {party.legalName ?? "Sin razon social"} / {party.taxId ?? "Sin RUT"}
            </p>
          </div>
          <LoadingLink href={`/app/o/${slug}/directory`} pendingLabel="Abriendo..." className="ui-button ui-button--secondary">
            Directorio
          </LoadingLink>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {party.roles.length === 0 ? (
            <span className="status-pill status-pill--info">Sin rol</span>
          ) : (
            party.roles.map((role) => (
              <span key={role} className="status-pill status-pill--info">{roleLabels[role]}</span>
            ))
          )}
          <span className="status-pill status-pill--info">{party.status ?? "active"}</span>
          <span className="status-pill status-pill--info">{party.source ?? "manual"}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <article className="metric-card">
            <span className="metric-card__label">Contactos</span>
            <span className="metric-card__value">{data.contacts.length}</span>
            <p className="metric-card__hint">Personas vinculadas.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Trabajos</span>
            <span className="metric-card__value">{data.workUnits.length}</span>
            <p className="metric-card__hint">Work units como cliente.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Documentos</span>
            <span className="metric-card__value">{data.documents.length}</span>
            <p className="metric-card__hint">Comprobantes vinculados.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Tareas</span>
            <span className="metric-card__value">{data.tasks.length}</span>
            <p className="metric-card__hint">Acciones abiertas o historicas.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Historial</span>
            <span className="metric-card__value">{data.interactions.length}</span>
            <p className="metric-card__hint">Interacciones registradas.</p>
          </article>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="ui-panel">
            <div className="ui-panel-header">
              <div>
                <h2 className="text-[16px] font-semibold text-white">Agregar contacto</h2>
                <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                  Persona asociada a esta party.
                </p>
              </div>
            </div>
            <form action={addContactAction} className="mt-4 space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="partyId" value={party.id} />
              <input
                name="fullName"
                required
                disabled={disabled}
                placeholder="Nombre completo"
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
              <input
                name="relationshipLabel"
                disabled={disabled}
                placeholder="Rol o relacion"
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="email"
                  type="email"
                  disabled={disabled}
                  placeholder="Email"
                  className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
                />
                <input
                  name="phone"
                  disabled={disabled}
                  placeholder="Telefono"
                  className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
                />
              </div>
              <textarea
                name="notes"
                rows={3}
                disabled={disabled}
                placeholder="Notas"
                className="input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-white"
              />
              <SubmitButton disabled={disabled} pendingLabel="Guardando..." className="ui-button ui-button--primary w-full">
                Agregar contacto
              </SubmitButton>
            </form>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="text-[16px] font-semibold text-white">Contactos</h2>
              <span className="ui-filter">{data.contacts.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {data.contacts.length === 0 ? (
                <div className="text-sm text-[color:var(--color-muted)]">No hay contactos vinculados.</div>
              ) : (
                data.contacts.map((contact) => (
                  <div key={contact.id} className="ui-subtle-row">
                    <span className="min-w-0">
                      <span className="block truncate text-white">{contact.fullName}</span>
                      <span className="block text-[12px] text-[color:var(--color-muted)]">
                        {contact.relationshipLabel ?? "Contacto"} / {contact.email ?? contact.phone ?? "Sin dato"}
                      </span>
                    </span>
                    <span>{contact.isPrimary ? "Principal" : "Contacto"}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Registrar interaccion</h2>
              <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
                Llamada, mail, reunion o nota con links a trabajo, documento o tarea.
              </p>
            </div>
          </div>
          <form action={createInteractionAction} className="mt-4 grid gap-3 lg:grid-cols-6">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="partyId" value={party.id} />
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Tipo</span>
              <select
                name="interactionType"
                defaultValue="note"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="note">Nota</option>
                <option value="call">Llamada</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="meeting">Reunion</option>
                <option value="visit">Visita</option>
                <option value="message">Mensaje</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Fecha</span>
              <input
                type="datetime-local"
                name="occurredAt"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Contacto</span>
              <select
                name="contactId"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="">Sin contacto especifico</option>
                {data.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.fullName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Asunto</span>
              <input
                name="subject"
                required
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Trabajo</span>
              <select
                name="workUnitId"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="">Sin trabajo</option>
                {data.workUnits.map((workUnit) => (
                  <option key={workUnit.id} value={workUnit.id}>{workUnit.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Documento</span>
              <select
                name="documentId"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="">Sin documento</option>
                {data.documents.map((document) => (
                  <option key={document.id} value={document.id}>{document.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Tarea</span>
              <select
                name="taskId"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="">Sin tarea</option>
                {data.tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 lg:col-span-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Resumen</span>
              <input
                name="summary"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              />
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Direccion</span>
              <select
                name="direction"
                disabled={disabled}
                className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
              >
                <option value="">Sin direccion</option>
                <option value="inbound">Entrante</option>
                <option value="outbound">Saliente</option>
              </select>
            </label>
            <div className="flex items-end">
              <SubmitButton disabled={disabled} pendingLabel="Registrando..." className="ui-button ui-button--primary min-h-[42px] w-full">
                Registrar
              </SubmitButton>
            </div>
            <label className="space-y-1 lg:col-span-6">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Detalle</span>
              <textarea
                name="body"
                rows={4}
                disabled={disabled}
                className="input-surface-dark w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-white"
              />
            </label>
          </form>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Trabajos</h2>
            <span className="ui-filter">{data.workUnits.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.workUnits.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Sin trabajos como cliente.</div>
            ) : (
              data.workUnits.map((workUnit) => (
                <LoadingLink key={workUnit.id} href={`/app/o/${slug}/work/${workUnit.id}`} pendingLabel="Abriendo..." className="ui-subtle-row">
                  <span className="truncate">{workUnit.name}</span>
                  <span>{workUnit.status ?? "active"}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Documentos</h2>
            <span className="ui-filter">{data.documents.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.documents.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Sin documentos vinculados.</div>
            ) : (
              data.documents.map((document) => (
                <LoadingLink key={document.id} href={`/app/o/${slug}/documents/${document.id}`} pendingLabel="Abriendo..." className="ui-subtle-row">
                  <span className="truncate">{document.label}</span>
                  <span>{formatDate(document.documentDate)}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Tesoreria</h2>
            <span className="ui-filter">{data.moneyItems.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.moneyItems.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Sin open items vivos.</div>
            ) : (
              data.moneyItems.map((item) => (
                <LoadingLink key={item.id} href={`/app/o/${slug}/open-items?item=${item.id}`} pendingLabel="Abriendo..." className="ui-subtle-row">
                  <span>{item.documentRole ?? "Open item"}</span>
                  <span>{formatMoney(item.outstandingAmount)}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <h2 className="text-[16px] font-semibold text-white">Tareas</h2>
            <span className="ui-filter">{data.tasks.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {data.tasks.length === 0 ? (
              <div className="text-sm text-[color:var(--color-muted)]">Sin tareas vinculadas.</div>
            ) : (
              data.tasks.map((task) => (
                <LoadingLink key={task.id} href={`/app/o/${slug}/agenda`} pendingLabel="Abriendo..." className="ui-subtle-row">
                  <span className="truncate">{task.title}</span>
                  <span>{task.status}</span>
                </LoadingLink>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Historial</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Interacciones con links a entidades reales.
            </p>
          </div>
          <span className="ui-filter">{data.interactionsAvailable ? data.interactions.length : "--"}</span>
        </div>
        <div className="mt-4 space-y-3">
          {!data.interactionsAvailable ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              Las tablas de interacciones todavia no estan disponibles.
            </div>
          ) : data.interactions.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              No hay interacciones registradas.
            </div>
          ) : (
            data.interactions.map((interaction) => (
              <article key={interaction.id} className="rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{interaction.subject}</p>
                    <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                      {interaction.interactionType} / {formatDate(interaction.occurredAt)}
                    </p>
                  </div>
                  <span className="status-pill status-pill--info">{interaction.status}</span>
                </div>
                {interaction.summary ? (
                  <p className="mt-3 text-sm text-[color:var(--color-muted)]">{interaction.summary}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {interaction.links.map((link) => (
                    <span key={`${link.targetEntityType}-${link.targetEntityId}-${link.relationType}`} className="status-pill status-pill--info">
                      {linkLabel(link.targetEntityType)}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
