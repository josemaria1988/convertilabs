import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { MarketingSectionHeading } from "@/components/marketing-section-heading";
import { PageHero } from "@/components/page-hero";
import { siteConfig } from "@/lib/site";
import {
  DGI_RECONCILIATION_COMPARISON_LABEL,
  DGI_RECONCILIATION_TITLE,
} from "@/modules/tax/dgi-reconciliation-copy";

const productPillars = [
  {
    code: "01",
    title: "Documentos y planillas",
    description:
      "Carga comprobantes originales, importa compras o ventas desde ERPs legacy y separa las operaciones internacionales cuando la transaccion lo requiere.",
  },
  {
    code: "02",
    title: "Decision contable",
    description:
      "Convierte evidencia en drafts revisables, sugerencias de cuentas, journal entries y open items sin perder control humano.",
  },
  {
    code: "03",
    title: "Liquidacion mensual",
    description:
      `Ordena IVA por periodo, reconstruye runs mensuales, prepara exportes y deja la ${DGI_RECONCILIATION_TITLE.toLowerCase()} dentro del mismo carril de trabajo.`,
  },
  {
    code: "04",
    title: "Auditoria explicable",
    description:
      "Expone linaje, duplicate checks, intervenciones manuales, mapa contable e impacto de cada documento sobre el kernel.",
  },
];

const capabilities = [
  {
    title: "Bandeja documental operativa",
    description:
      "Sube archivos privados, encola procesamiento en background y revisa cada documento desde una bandeja preparada para trabajar en lote.",
    accent: "Documentos",
  },
  {
    title: "Importacion estructurada desde planillas",
    description:
      "Toma compras y ventas exportadas desde sistemas legacy, las normaliza y crea documentos listos para clasificar sin obligarte a un formato fijo de origen.",
    accent: "Bridge ERP",
  },
  {
    title: "Kernel contable mensual",
    description:
      "Postea sobre periodos mensuales, protege el cierre por mes y alimenta libro diario, balance de comprobacion y open items desde el mismo core.",
    accent: "Journal + open items",
  },
  {
    title: "Liquidacion IVA revisable",
    description:
      "Trabaja sobre previews y runs mensuales, permite regenerar, finalizar, exportar y conciliar sin mezclar comprobantes de distintos periodos.",
    accent: "IVA mensual",
  },
  {
    title: "Mapa contable explicable",
    description:
      "Muestra arbol de cuentas, impacto por documento y trazabilidad de decisiones para que control interno y auditoria tengan una superficie de inspeccion real.",
    accent: "Auditoria",
  },
  {
    title: "Exportes y capas de integracion",
    description:
      "Prepara datasets contables y fiscales para sistemas externos, recategorizacion, conciliaciones y futuros conectores de producto o API.",
    accent: "Salida estructurada",
  },
];

const monthlyFlow = [
  {
    step: "01",
    title: "Captura y normalizacion",
    description:
      "Los comprobantes entran por upload privado o por planillas de compras y ventas.",
  },
  {
    step: "02",
    title: "Revision contable",
    description:
      "El sistema propone contexto, cuentas, montos y tratamiento para que el equipo confirme con criterio profesional.",
  },
  {
    step: "03",
    title: "Posting y saldos vivos",
    description:
      "El kernel genera journal entries y actualiza open items para cuentas a cobrar, pagar y cancelaciones.",
  },
  {
    step: "04",
    title: "Liquidacion y exportacion",
    description:
      `IVA mensual, ${DGI_RECONCILIATION_TITLE.toLowerCase()} y exportes salen del mismo set validado, sin rearmar la historia en otra herramienta.`,
  },
];

const auditStrengths = [
  {
    title: "Trazabilidad por documento",
    description:
      "Cada documento conserva estado, origen, draft, run de procesamiento y accion sugerida dentro de una misma historia operativa.",
  },
  {
    title: "Linaje contable",
    description:
      "El libro diario y el chart map permiten inspeccionar de donde viene cada impacto, sus reversas y sus ajustes.",
  },
  {
    title: "Controles por periodo",
    description:
      "La capa mensual evita cruces entre meses para liquidaciones y lecturas contables sensibles al cierre.",
  },
  {
    title: "Intervencion humana visible",
    description:
      "Overrides, revisiones y correcciones quedan expuestos para control interno, supervision o auditoria externa.",
  },
];

const audiences = [
  {
    name: "Estudios contables",
    description:
      "Para operar varios clientes con mas consistencia, menos retrabajo y una pista clara de por que se tomo cada decision.",
  },
  {
    name: "Equipos financieros internos",
    description:
      "Para ordenar el mes contable, sostener liquidaciones y revisar documentos sin depender de planillas dispersas.",
  },
  {
    name: "ERPs y software vertical",
    description:
      "Para sumar contabilidad, IVA y auditoria operativa sin reconstruir desde cero un motor regulatorio para Uruguay.",
  },
  {
    name: "Proyectos de auditoria y saneamiento",
    description:
      "Para reconstruir lotes historicos, inspeccionar impactos y convertir exportaciones legacy en evidencia mas utilizable.",
  },
];

const currentScope = [
  "Uruguay only, con foco operativo en documentos, decision contable, IVA y bridge externo.",
  "Comparacion DGI base manual asistida y exportes fiscales; no filing automatico a organismos.",
  "Libro diario, balance, open items y mapa contable como superficie de lectura y control.",
  "Carril especial para operaciones internacionales dentro del workspace documental.",
];

const expansionPotential = [
  "Mas capas tributarias encima del mismo kernel, empezando por la logica mensual ya resuelta en IVA.",
  "Mas integraciones con ERPs y herramientas externas a partir de datasets ya estructurados.",
  "Uso como modulo premium de auditoria para revisiones masivas, saneamiento y recuperacion operativa.",
  "API publica cuando la cobertura contable y fiscal madura quede consolidada como plataforma.",
];

const darkCardClassName =
  "rounded-[1.45rem] border border-white/10 bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(124,157,255,0.24)]";

const mutedDarkCardClassName =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.038] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

export default function HomePage() {
  return (
    <div className="page-shell relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-6%] top-10 h-72 w-72 rounded-full bg-[rgba(76,124,212,0.16)] blur-3xl" />
        <div className="absolute right-[-4%] top-[22rem] h-80 w-80 rounded-full bg-[rgba(26,140,124,0.14)] blur-3xl" />
        <div className="absolute left-[24%] top-[78rem] h-80 w-80 rounded-full bg-[rgba(210,131,66,0.12)] blur-3xl" />
      </div>

      <PageHero
        eyebrow="Contabilidad, liquidaciones y auditoria"
        title="Convertilabs organiza documentos, contabilidad e IVA mensual en una misma superficie operativa"
        description="Convertilabs no se limita a leer facturas. Convierte documentos y planillas en decisiones contables revisables, liquidaciones mensuales y evidencia auditable para equipos de Uruguay."
        actions={
          <>
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Solicitar demo
            </Link>
            <a
              href="#plataforma"
              className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ver la plataforma
            </a>
          </>
        }
        highlights={[
          { label: "Ingreso", value: "Documentos + planillas" },
          { label: "Liquidacion", value: "IVA mensual revisable" },
          { label: "Control", value: "Journal, open items y auditoria" },
        ]}
        aside={
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Superficie real hoy
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                  De la evidencia al cierre mensual
                </p>
              </div>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Uruguay 2026
              </div>
            </div>

            <div className="space-y-3">
              {productPillars.map((item) => (
                <div
                  key={item.code}
                  className="rounded-[1.25rem] border border-white/8 bg-white/[0.035] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 font-mono text-sm text-white/72">
                      {item.code}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/56">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-[color:var(--color-accent)]/14 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Resguardo mensual
                </p>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  Las lecturas contables y fiscales sensibles al cierre se ordenan por periodo mensual.
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Potencial de negocio
                </p>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  Sirve para operacion diaria hoy y abre una capa fuerte para auditoria y saneamiento masivo.
                </p>
              </div>
            </div>
          </div>
        }
      />

      <section
        className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[linear-gradient(145deg,rgba(15,22,35,0.98),rgba(22,31,47,0.96))] text-white shadow-[0_28px_100px_rgba(15,23,42,0.16)]"
        id="plataforma"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(41,109,192,0.22),transparent_28%),radial-gradient(circle_at_78%_26%,rgba(24,148,132,0.18),transparent_22%)]" />
        <div className="relative grid gap-4 px-6 py-7 md:px-8 md:py-8 lg:grid-cols-[0.78fr_minmax(0,1fr)]">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-6 md:p-7">
            <MarketingSectionHeading
              eyebrow="Lo que ofrece"
              title="Una plataforma operativa para contabilidad, liquidaciones y control"
              description="La propuesta real de Convertilabs es unificar captura documental, criterio contable, ciclo mensual de IVA y superficies de auditoria dentro de una misma plataforma para Uruguay."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {capabilities.map((item) => (
              <article
                key={item.title}
                className={`${darkCardClassName} flex h-full flex-col justify-between p-6`}
              >
                <div>
                  <span className="eyebrow">{item.accent}</span>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-white">
                    {item.title}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-white/70">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[linear-gradient(145deg,rgba(27,33,48,0.98),rgba(38,33,29,0.94))] text-white shadow-[0_28px_100px_rgba(15,23,42,0.14)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(27,148,132,0.18),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(214,140,82,0.16),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_60%)]" />
        <div className="relative grid gap-4 px-6 py-7 md:px-8 md:py-8 lg:grid-cols-[1fr_0.96fr]">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-6 md:p-7">
            <MarketingSectionHeading
              eyebrow="Como trabaja el mes"
              title="El flujo une ingreso documental, posting y liquidacion"
              description="En vez de repartir el trabajo entre OCR, planillas, cierres manuales y verificaciones separadas, Convertilabs ordena el mes sobre un recorrido continuo."
            />

            <div className="mt-6 space-y-4">
              {monthlyFlow.map((item) => (
                <article
                  key={item.step}
                  className={darkCardClassName}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(102,146,235,0.18)] font-mono text-sm font-semibold text-[rgba(196,218,255,0.92)]">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.05em] text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-white/70">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(243,248,247,0.08),rgba(255,255,255,0.03))] p-6 md:p-7">
            <MarketingSectionHeading
              eyebrow="Liquidador mensual"
              title="Fuerte para cierres de IVA y lecturas contables por periodo"
              description="El valor no esta solo en cargar documentos. Esta en que el cierre mensual quede protegido, explicable y reutilizable para liquidar, revisar y exportar."
            />

            <div className="mt-6 grid gap-3">
              <div className={mutedDarkCardClassName}>
                <p className="text-xs uppercase tracking-[0.18em] text-white/46">
                  Lo que ya esta hoy
                </p>
                <p className="mt-2 text-sm leading-7 text-white/74">
                  VAT preview, VAT runs, exportes fiscales, comparacion DGI base por buckets y proteccion mensual para no mezclar febrero con marzo.
                </p>
              </div>
              <div className={mutedDarkCardClassName}>
                <p className="text-xs uppercase tracking-[0.18em] text-white/46">
                  Donde genera mas palanca
                </p>
                <p className="mt-2 text-sm leading-7 text-white/74">
                  Estudios, equipos internos y software que necesitan cerrar meses con menos retrabajo y una pista clara de como se llego al numero final.
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,21,38,0.94),rgba(18,29,60,0.9))] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-xs uppercase tracking-[0.18em] text-white/52">
                  Superficies conectadas
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={mutedDarkCardClassName}>
                    <p className="text-sm font-semibold text-white">Documentos</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      Bandeja, revision y cargas masivas.
                    </p>
                  </div>
                  <div className={mutedDarkCardClassName}>
                    <p className="text-sm font-semibold text-white">Contabilidad</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      Diario, balance y open items.
                    </p>
                  </div>
                  <div className={mutedDarkCardClassName}>
                    <p className="text-sm font-semibold text-white">Impuestos</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      IVA mensual, lifecycle y {DGI_RECONCILIATION_COMPARISON_LABEL.toLowerCase()}.
                    </p>
                  </div>
                  <div className={mutedDarkCardClassName}>
                    <p className="text-sm font-semibold text-white">Mapa contable</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      Arbol, impacto y explicabilidad.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[linear-gradient(150deg,rgba(14,19,32,0.98),rgba(19,24,31,0.94))] text-white shadow-[0_28px_100px_rgba(15,23,42,0.14)]"
        id="auditoria"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(94,130,184,0.18),transparent_24%),radial-gradient(circle_at_24%_72%,rgba(212,136,77,0.14),transparent_26%)]" />
        <div className="relative grid gap-4 px-6 py-7 md:px-8 md:py-8 lg:grid-cols-[0.92fr_1fr]">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-6 md:p-7">
            <MarketingSectionHeading
              eyebrow="Potencia para auditoria"
              title="No solo procesa: deja evidencia para revisar"
              description="Convertilabs gana valor real cuando el equipo necesita entender que paso, por que paso y que impacto genero cada documento sobre el cierre, el ledger y la liquidacion."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {auditStrengths.map((item) => (
                <article
                  key={item.title}
                  className={darkCardClassName}
                >
                  <h3 className="text-xl font-semibold tracking-[-0.05em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-6 md:p-7">
            <MarketingSectionHeading
              eyebrow="Para quien"
              title="Util para equipos contables y tambien para software"
              description="La plataforma puede correr como superficie de trabajo interna o como capa especializada encima de otras herramientas."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {audiences.map((item) => (
                <article
                  key={item.name}
                  className={darkCardClassName}
                >
                  <p className="text-xl font-semibold tracking-[-0.05em] text-white">
                    {item.name}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[linear-gradient(150deg,rgba(22,28,41,0.98),rgba(32,25,29,0.95))] text-white shadow-[0_28px_100px_rgba(15,23,42,0.14)]"
        id="alcance"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(34,132,123,0.18),transparent_24%),radial-gradient(circle_at_88%_80%,rgba(120,92,188,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.015),transparent_50%)]" />
        <div className="relative px-6 py-7 md:px-8 md:py-8">
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-6 md:p-7">
            <MarketingSectionHeading
              eyebrow="Alcance real y expansion"
              title="Transparente sobre lo que ya hace hoy y sobre hacia donde puede crecer"
              description="La mejor forma de presentar Convertilabs es ser precisos: hoy ya resuelve una base fuerte para operar, liquidar y auditar; y esa base habilita capas nuevas sin rehacer el core."
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold tracking-[-0.05em] text-white">
                  Alcance operativo hoy
                </h3>
                <span className="eyebrow">Actual</span>
              </div>
              <div className="mt-5 space-y-3">
                {currentScope.map((item) => (
                  <div
                    key={item}
                    className={mutedDarkCardClassName}
                  >
                    <p className="text-sm leading-7 text-white/70">{item}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,20,34,0.94),rgba(36,29,26,0.9))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold tracking-[-0.05em] text-white">
                  Potencial real
                </h3>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/68">
                  Expansion
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {expansionPotential.map((item) => (
                  <div
                    key={item}
                    className={mutedDarkCardClassName}
                  >
                    <p className="text-sm leading-7 text-white/70">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <div id="waitlist">
        <MarketingCtaBanner
          eyebrow="Acceso temprano"
          title="Solicita una demo y conversemos donde te genera mas valor"
          description="Si hoy te importa ordenar documentos, cerrar IVA, explicar decisiones contables o convertir auditoria en una superficie mejor, Convertilabs ya tiene una base concreta para esa conversacion."
          actions={
            <>
              <Link
                href="/contact"
                className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
              >
                Solicitar demo
              </Link>
              <a
                href={`mailto:${siteConfig.contactEmail}?subject=Demo%20Convertilabs`}
                className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
              >
                Escribir por email
              </a>
            </>
          }
        />
      </div>
    </div>
  );
}
