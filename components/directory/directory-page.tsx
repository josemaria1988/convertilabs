import { LoadingLink } from "@/components/ui/loading-link";
import { SubmitButton } from "@/components/ui/submit-button";
import type {
  DirectoryDashboardData,
  DirectoryPartyListItem,
  PartyRoleType,
} from "@/modules/directory";

type DirectoryPageProps = {
  slug: string;
  canManage: boolean;
  data: DirectoryDashboardData;
  searchTerm: string | null;
  roleFilter: PartyRoleType | null;
  createPartyAction: (formData: FormData) => void | Promise<void>;
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

function PartyCard({
  slug,
  party,
}: {
  slug: string;
  party: DirectoryPartyListItem;
}) {
  return (
    <LoadingLink
      href={`/app/o/${slug}/directory/${party.id}`}
      pendingLabel="Abriendo..."
      className="block rounded-[6px] border border-[color:var(--color-border)] bg-white/70 p-4 transition hover:bg-white/85"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{party.displayName}</p>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            {party.taxId ?? "Sin RUT"} / {party.status ?? "active"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {party.roles.length === 0 ? (
            <span className="status-pill status-pill--info">Sin rol</span>
          ) : (
            party.roles.map((role) => (
              <span key={role} className="status-pill status-pill--info">{roleLabels[role]}</span>
            ))
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <div className="ui-subtle-row">
          <span>Contactos</span>
          <span>{party.contactCount}</span>
        </div>
        <div className="ui-subtle-row">
          <span>Interacciones</span>
          <span>{party.interactionCount}</span>
        </div>
        <div className="ui-subtle-row">
          <span>Fuente</span>
          <span>{party.source ?? "manual"}</span>
        </div>
      </div>
    </LoadingLink>
  );
}

export function DirectoryPage({
  slug,
  canManage,
  data,
  searchTerm,
  roleFilter,
  createPartyAction,
}: DirectoryPageProps) {
  const disabled = !canManage || !data.isAvailable;

  if (!data.isAvailable) {
    return (
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Directorio
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              El schema de parties y contactos todavia no esta disponible en esta base.
            </p>
          </div>
          <span className="status-pill status-pill--warning">Schema pendiente</span>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">
              Directorio
            </h1>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Clientes, proveedores, bancos, organismos y contactos en una sola entidad party.
            </p>
          </div>
          <span className="status-pill status-pill--info">{data.summary.totalParties} party(s)</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <article className="metric-card">
            <span className="metric-card__label">Parties</span>
            <span className="metric-card__value">{data.summary.totalParties}</span>
            <p className="metric-card__hint">Entidades visibles del directorio.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Clientes</span>
            <span className="metric-card__value">{data.summary.customers}</span>
            <p className="metric-card__hint">Parties con rol cliente.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Proveedores</span>
            <span className="metric-card__value">{data.summary.vendors}</span>
            <p className="metric-card__hint">Parties con rol proveedor.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Contactos</span>
            <span className="metric-card__value">{data.summary.contacts}</span>
            <p className="metric-card__hint">Personas vinculadas a parties.</p>
          </article>
          <article className="metric-card">
            <span className="metric-card__label">Historial</span>
            <span className="metric-card__value">{data.summary.interactions}</span>
            <p className="metric-card__hint">Interacciones registradas.</p>
          </article>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Buscar</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Filtra por nombre, razon social, RUT o rol operativo.
            </p>
          </div>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_140px]" action={`/app/o/${slug}/directory`}>
          <input
            name="q"
            defaultValue={searchTerm ?? ""}
            placeholder="Buscar party"
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          />
          <select
            name="role"
            defaultValue={roleFilter ?? ""}
            className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
          >
            <option value="">Todos los roles</option>
            {Object.entries(roleLabels).map(([role, label]) => (
              <option key={role} value={role}>{label}</option>
            ))}
          </select>
          <SubmitButton formMethod="get" pendingLabel="Filtrando..." className="ui-button ui-button--secondary min-h-[42px] w-full">
            Filtrar
          </SubmitButton>
        </form>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Crear party</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Una misma party puede ser cliente y proveedor al mismo tiempo.
            </p>
          </div>
        </div>
        <form action={createPartyAction} className="mt-4 grid gap-3 lg:grid-cols-6">
          <input type="hidden" name="slug" value={slug} />
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Nombre visible</span>
            <input
              name="displayName"
              required
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Razon social</span>
            <input
              name="legalName"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">RUT</span>
            <input
              name="taxId"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Pais</span>
            <input
              name="countryCode"
              defaultValue="UY"
              disabled={disabled}
              className="input-surface-dark min-h-[42px] w-full rounded-lg border border-[color:var(--color-border)] px-3 text-sm text-white"
            />
          </label>
          <fieldset className="lg:col-span-5">
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">Roles</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["customer", "vendor", "bank", "institution", "accountant", "internal", "other"] as PartyRoleType[]).map((role) => (
                <label key={role} className="status-pill status-pill--info cursor-pointer">
                  <input
                    type="checkbox"
                    name="roleTypes"
                    value={role}
                    disabled={disabled}
                    className="mr-2"
                  />
                  {roleLabels[role]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-end">
            <SubmitButton
              disabled={disabled}
              pendingLabel="Creando..."
              className="ui-button ui-button--primary min-h-[42px] w-full"
            >
              Crear party
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Parties</h2>
            <p className="mt-1 text-[14px] text-[color:var(--color-muted)]">
              Cada perfil concentra roles, contactos, trabajos, documentos, dinero, tareas e historial.
            </p>
          </div>
          <span className="ui-filter">{data.parties.length}</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {data.parties.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[color:var(--color-border)] bg-white/60 px-4 py-6 text-sm text-[color:var(--color-muted)]">
              No hay parties con el filtro actual.
            </div>
          ) : (
            data.parties.map((party) => <PartyCard key={party.id} slug={slug} party={party} />)
          )}
        </div>
      </section>
    </div>
  );
}
