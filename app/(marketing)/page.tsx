import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { siteConfig } from "@/lib/site";

const capacidades = [
  {
    titulo: "Extrae datos de facturas y recibos",
    descripcion:
      "Captura evidencia de proveedores y gastos de una forma que el flujo contable puede usar sin retrabajo.",
  },
  {
    titulo: "Sugiere asientos contables",
    descripcion:
      "Reduce trabajo repetitivo manteniendo revision humana sobre reglas, cuentas y criterio profesional.",
  },
  {
    titulo: "Aplica reglas de tratamiento fiscal",
    descripcion:
      "Ordena IVA y criterios tributarios sin depender de planillas separadas o chequeos manuales dispersos.",
  },
  {
    titulo: "Mantiene logica regulatoria por ejercicio",
    descripcion:
      "Permite sostener cambios normativos sin perder auditabilidad ni mezclar tratamientos de distintos anos.",
  },
  {
    titulo: "Exporta a sistemas externos y APIs",
    descripcion:
      "Entrega datos estructurados para ERPs, herramientas internas y futuras integraciones externas.",
  },
];

const segmentos = [
  {
    nombre: "Pymes",
    descripcion:
      "Empresas que necesitan ordenar documentos, contabilidad e IVA sin multiplicar herramientas.",
  },
  {
    nombre: "Estudios contables",
    descripcion:
      "Equipos que gestionan varios clientes, ciclos fiscales repetitivos y validaciones operativas intensivas.",
  },
  {
    nombre: "ERPs y sistemas de gestion",
    descripcion:
      "Plataformas que quieren sumar logica contable y fiscal para Uruguay sin reconstruirla desde cero.",
  },
  {
    nombre: "Equipos de desarrollo",
    descripcion:
      "Productos e integraciones internas que necesitan incorporar flujos contables o tributarios de manera confiable.",
  },
];

const roadmap = [
  {
    fase: "Fase 1",
    titulo: "Ingreso documental + asientos contables + IVA",
    detalle:
      "Captura documentos, extrae campos clave y los convierte en contabilidad estructurada con criterio de IVA.",
  },
  {
    fase: "Fase 2",
    titulo: "IRAE + Impuesto al Patrimonio",
    detalle:
      "Amplia el motor fiscal con capas tributarias por ejercicio para cobertura corporativa mas profunda.",
  },
  {
    fase: "Fase 3",
    titulo: "Nomina + BPS",
    detalle:
      "Suma procesos laborales y de seguridad social para extender la plataforma mas alla de la operacion contable.",
  },
  {
    fase: "Fase 4",
    titulo: "API publica para terceros",
    detalle:
      "Abre el sistema para ERPs, socios e integradores que necesiten bloques contables y fiscales reutilizables.",
  },
];

const flujoOperativo = [
  {
    paso: "01",
    titulo: "Ingreso documental",
    descripcion:
      "Facturas y recibos entran, se normalizan y quedan listos para validacion operativa.",
  },
  {
    paso: "02",
    titulo: "Logica contable",
    descripcion:
      "El sistema sugiere asientos y aplica reglas reutilizables por categoria, proveedor y organizacion.",
  },
  {
    paso: "03",
    titulo: "Tratamiento fiscal",
    descripcion:
      "IVA y reglas tributarias se resuelven dentro del mismo flujo, sin saltos a herramientas aparte.",
  },
  {
    paso: "04",
    titulo: "Salida estructurada",
    descripcion:
      "La informacion queda lista para exportacion, conciliacion o integracion con otros sistemas.",
  },
];

export default function HomePage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Infraestructura contable y fiscal"
        title="Infraestructura de contabilidad e impuestos para Uruguay"
        description="Automatiza ingreso documental, asientos contables, flujos de IVA y logica fiscal para pymes, estudios, ERPs y plataformas de software."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Solicitar demo
            </Link>
            <a
              href="#waitlist"
              className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Sumarme a la lista de espera
            </a>
          </>
        }
        highlights={[
          { label: "Ingreso documental", value: "Automatizado" },
          { label: "Flujos de IVA", value: "Estructurados" },
          { label: "Logica fiscal", value: "Por ejercicio" },
        ]}
        aside={
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Vista operativa
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                  De documentos a salida fiscal
                </p>
              </div>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Uruguay 2026
              </div>
            </div>

            <div className="space-y-3">
              {flujoOperativo.map((item) => (
                <div
                  key={item.paso}
                  className="rounded-[1.25rem] border border-white/8 bg-white/[0.035] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 font-mono text-sm text-white/72">
                      {item.paso}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.titulo}</p>
                      <p className="mt-2 text-sm leading-6 text-white/56">
                        {item.descripcion}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-[color:var(--color-accent)]/14 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Motor fiscal
                </p>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  Empieza con IVA y deja base para IRAE, Patrimonio, nomina y BPS.
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Integraciones
                </p>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  Primero dentro del producto, despues como exportaciones y APIs para terceros.
                </p>
              </div>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.72fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Lo que hace"
            title="De documentos a contabilidad estructurada"
            description="No se trata solo de digitalizar entradas. La propuesta es convertir procesos contables y fiscales desordenados en logica reutilizable para equipos operativos y productos de software."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {capacidades.map((capacidad, index) => (
            <article
              key={capacidad.titulo}
              className={`panel p-6 ${index === 4 ? "md:col-span-2" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="max-w-sm text-xl font-semibold tracking-[-0.05em]">
                  {capacidad.titulo}
                </p>
                <span className="font-mono text-sm text-[color:var(--color-muted)]">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--color-muted)]">
                {capacidad.descripcion}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Pensado para"
            title="Una base util para operadores y para plataformas"
            description="El producto puede servir a equipos internos, estudios y software que necesiten incorporar contabilidad e impuestos de Uruguay sin armar un sistema paralelo."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {segmentos.map((segmento) => (
              <article
                key={segmento.nombre}
                className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-white/72 p-5"
              >
                <p className="text-xl font-semibold tracking-[-0.05em]">
                  {segmento.nombre}
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                  {segmento.descripcion}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden bg-[linear-gradient(180deg,rgba(223,245,242,0.7),rgba(255,255,255,0.72))] px-6 py-7 md:px-8 md:py-8">
          <MarketingSectionHeading
            eyebrow="Disenado para Uruguay"
            title="Superficie de producto arriba, pensamiento de infraestructura abajo"
            description="Convertilabs se presenta como software de aplicacion, pero se organiza para sostener un modelo de plataforma a medida que maduren los dominios contables y tributarios."
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Alcance actual
              </p>
              <p className="mt-2 text-sm leading-7">
                Ingreso documental, sugerencias contables, IVA y reglas fiscales para Uruguay.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                Camino de expansion
              </p>
              <p className="mt-2 text-sm leading-7">
                Mas cobertura tributaria, nomina, BPS y API publica cuando el modelo de dominio este firme.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel px-6 py-7 md:px-8 md:py-8" id="roadmap">
        <MarketingSectionHeading
          eyebrow="Hoja de ruta"
          title="Un despliegue por fases para cubrir contabilidad e impuestos"
          description="La hoja de ruta prioriza los flujos que generan mas palanca para equipos de Uruguay y despues amplifica la cobertura funcional."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {roadmap.map((item, index) => (
            <article
              key={item.fase}
              className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-white/72 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[color:var(--color-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent-strong)]">
                  {item.fase}
                </span>
                <span className="font-mono text-sm text-[color:var(--color-muted)]">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.05em]">
                {item.titulo}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                {item.detalle}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div id="waitlist">
        <MarketingCtaBanner
          eyebrow="Acceso temprano"
          title="Solicita una demo o sumate a la lista de espera"
          description="Las primeras conversaciones tienen especial valor para pymes, estudios y equipos de software que ya conviven con procesos contables o fiscales en Uruguay."
          actions={
            <>
              <Link
                href="/contact"
                className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
              >
                Solicitar demo
              </Link>
              <a
                href={`mailto:${siteConfig.contactEmail}?subject=Lista%20de%20espera%20Convertilabs`}
                className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
              >
                Sumarme a la lista de espera
              </a>
            </>
          }
        />
      </div>
    </div>
  );
}
