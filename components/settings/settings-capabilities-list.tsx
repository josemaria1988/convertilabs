import { LoadingLink } from "@/components/ui/loading-link";
import {
  buttonBaseClassName,
  buttonSecondaryChromeClassName,
} from "@/components/ui/button-styles";

type SettingsCapabilitiesListProps = {
  slug: string;
  showBusinessProfile: boolean;
};

type CapabilityAction = {
  href: string;
  label: string;
  pendingLabel: string;
};

type CapabilityItem = {
  code: string;
  title: string;
  area: string;
  summary: string;
  usage: string;
  actions: CapabilityAction[];
};

function buildCapabilityItems(input: {
  slug: string;
  showBusinessProfile: boolean;
}): CapabilityItem[] {
  const items: CapabilityItem[] = [
    {
      code: "fiscal-profile",
      title: "Perfil fiscal versionado",
      area: "Configuracion",
      summary:
        "Define RUT, forma juridica, regimen tributario, regimen IVA, grupo DGI y vigencia del perfil formal de la organizacion.",
      usage:
        "Usalo cuando cambie la situacion fiscal de la empresa y quieras que el sistema aplique esa version hacia adelante.",
      actions: [
        {
          href: `/app/o/${input.slug}/settings`,
          label: "Abrir configuracion fiscal",
          pendingLabel: "Abriendo configuracion...",
        },
      ],
    },
  ];

  if (input.showBusinessProfile) {
    items.push({
      code: "business-profile",
      title: "Perfil de negocio y recomendacion del plan",
      area: "Configuracion",
      summary:
        "Reune actividad principal, secundarias, rasgos operativos y la recomendacion base del plan contable.",
      usage:
        "Usalo para orientar overlays y starter chart sin tocar asientos ni documentos historicos ya cerrados.",
      actions: [
        {
          href: `/app/o/${input.slug}/settings`,
          label: "Abrir perfil de negocio",
          pendingLabel: "Abriendo perfil...",
        },
      ],
    });
  }

  items.push(
    {
      code: "chart",
      title: "Plan de cuentas",
      area: "Configuracion",
      summary:
        "Permite crear cuentas, editar cuentas existentes, marcar provisionales y mantener el plan que alimenta reglas y plantillas.",
      usage:
        "Usalo para ajustar la estructura contable propia de la empresa o del estudio sin salir del flujo automatizado.",
      actions: [
        {
          href: `/app/o/${input.slug}/settings`,
          label: "Administrar plan",
          pendingLabel: "Abriendo plan...",
        },
        {
          href: `/app/o/${input.slug}/imports?focus=chart_of_accounts_import`,
          label: "Importar desde planilla",
          pendingLabel: "Abriendo planillas...",
        },
      ],
    },
    {
      code: "cfe-email",
      title: "Email de eFacturas",
      area: "Configuracion",
      summary:
        "Permite conectar la casilla desde la que una persona recibe los CFE de la organizacion y asignarle un alias seguro de ingreso a Convertilabs.",
      usage:
        "Usalo para que cada usuario configure su propio correo de CFEs dentro de la organizacion y pueda reenviar automaticamente las facturas electronicas al sistema.",
      actions: [
        {
          href: `/app/o/${input.slug}/settings`,
          label: "Conectar email CFE",
          pendingLabel: "Abriendo email CFE...",
        },
      ],
    },
    {
      code: "support-spreadsheets",
      title: "Planillas de soporte",
      area: "Soporte",
      summary:
        "Carga plan de cuentas, plantillas contables e historicos IVA desde CSV, TSV o Excel para revisar una vista previa antes de materializar.",
      usage:
        "Es un carril auxiliar del sistema; no sirve para registrar operaciones economicas del dia a dia.",
      actions: [
        {
          href: `/app/o/${input.slug}/imports?focus=chart_of_accounts_import`,
          label: "Abrir planillas",
          pendingLabel: "Abriendo planillas...",
        },
        {
          href: `/app/o/${input.slug}/imports?focus=historical_vat_import`,
          label: "Abrir historicos IVA",
          pendingLabel: "Abriendo historicos...",
        },
      ],
    },
    {
      code: "documents",
      title: "Clasificacion documental",
      area: "Documentos",
      summary:
        "La bandeja documental concentra carga, extraccion, clasificacion, revision y confirmacion contable o fiscal de cada comprobante.",
      usage:
        "Usalo para compras y ventas locales, correcciones humanas y aprendizaje de reglas a partir de documentos reales.",
      actions: [
        {
          href: `/app/o/${input.slug}/documents`,
          label: "Abrir bandeja",
          pendingLabel: "Abriendo documentos...",
        },
      ],
    },
    {
      code: "international",
      title: "Operaciones internacionales",
      area: "Documentos",
      summary:
        "Agrupa DUA, factura comercial, flete, seguro y tributos asociados cuando varios documentos forman un mismo evento economico internacional.",
      usage:
        "Usalo cuando una importacion o compra exterior necesite contexto conjunto y no convenga tratar cada archivo por separado.",
      actions: [
        {
          href: `/app/o/${input.slug}/documents?tab=international`,
          label: "Abrir operaciones",
          pendingLabel: "Abriendo operaciones...",
        },
      ],
    },
    {
      code: "journals",
      title: "Asientos y evento economico",
      area: "Resultado",
      summary:
        "Hoy no existe un alta manual separada para asientos o eventos: el resultado contable se construye desde revision documental y operaciones internacionales.",
      usage:
        "Sirve para auditar y corregir el tratamiento sugerido, no para llevar contabilidad manual masiva tipo ERP.",
      actions: [
        {
          href: `/app/o/${input.slug}/documents`,
          label: "Revisar resultado",
          pendingLabel: "Abriendo revision...",
        },
      ],
    },
    {
      code: "exports",
      title: "Exportaciones contables",
      area: "Salidas",
      summary:
        "Prepara salidas hacia ERP, estudio o planillas externas usando external_code y scopes de exportacion contable.",
      usage:
        "Usalo cuando necesites sacar el resultado del motor sin reemplazar el sistema contable que ya usa el cliente.",
      actions: [
        {
          href: `/app/o/${input.slug}/exports`,
          label: "Abrir exportaciones",
          pendingLabel: "Abriendo exportaciones...",
        },
      ],
    },
  );

  return items;
}

export function SettingsCapabilitiesList({
  slug,
  showBusinessProfile,
}: SettingsCapabilitiesListProps) {
  const items = buildCapabilityItems({
    slug,
    showBusinessProfile,
  });

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <details
          key={item.code}
          open={index === 0}
          className="rounded-2xl border border-[color:var(--color-border)] bg-white/65 p-4 transition open:ring-1 open:ring-[rgba(124,157,255,0.16)]"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <span className="ui-filter">{item.area}</span>
              </div>
              <p className="text-sm leading-6 text-[color:var(--color-muted)]">
                {item.summary}
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--color-border)] bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
              Ver uso
            </span>
          </summary>

          <div className="mt-4 border-t border-[color:var(--color-border)] pt-4">
            <p className="text-sm leading-6 text-[color:var(--color-muted)]">
              <span className="font-semibold text-white">Uso recomendado:</span>{" "}
              {item.usage}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {item.actions.map((action) => (
                <LoadingLink
                  key={action.href}
                  href={action.href}
                  pendingLabel={action.pendingLabel}
                  className={`${buttonBaseClassName} ${buttonSecondaryChromeClassName} px-4 py-2 text-sm`}
                >
                  {action.label}
                </LoadingLink>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
