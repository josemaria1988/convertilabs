import Image from "next/image";
import Link from "next/link";
import { MarketingCtaBanner } from "@/components/marketing-cta-banner";
import { siteConfig } from "@/lib/site";

const demoHref = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent("Acceso por invitación Convertilabs")}`;
const marketingImageSrc = "/images/Gemini_Generated_Image_hm7m3uhm7m3uhm7m.png";
const fieldFlowImageSrc = "/images/Gemini_Generated_Image_27qdxo27qdxo27qd.png";

const operatingSignals = [
  {
    label: "Captura",
    value: "Web y app móvil para tickets, facturas y planillas.",
  },
  {
    label: "IA",
    value: "IA que asiste, no que decide ni inventa asientos.",
  },
  {
    label: "Legacy",
    value: "Filtro inteligente antes de tu sistema contable legacy.",
  },
  {
    label: "Control",
    value: "IVA, auditoría y trazabilidad sobre la misma historia.",
  },
];

const integrationPrinciples = [
  "Convertilabs no compite con tu sistema contable. Se conecta como una capa de inteligencia y captura operativa encima del sistema que ya usas.",
  "No te pide borrón y cuenta nueva. Favorece integración y mejora continua porque sabemos lo doloroso que puede ser mudarse de sistema con años de información acumulada.",
  "Lo que llega al sistema contable legacy llega más limpio, mejor clasificado y más fácil de importar.",
];

const workflow = [
  {
    step: "01",
    title: "Captura operativa",
    description:
      "El documento entra desde escritorio, planilla o app móvil en el momento en que ocurre el gasto o la operación.",
  },
  {
    step: "02",
    title: "IA + motor determinístico",
    description:
      "La IA lee, extrae y sugiere. El motor determinístico acota el camino para que el criterio siga siendo controlable y auditable.",
  },
  {
    step: "03",
    title: "Revisión humana reusable",
    description:
      "El equipo confirma con criterio profesional y transforma esa decisión en aprendizaje y reglas auditables.",
  },
  {
    step: "04",
    title: "Salida limpia al sistema contable",
    description:
      "El resultado queda clasificado y listo para importar en tu sistema contable legacy, sin perder control mensual de IVA ni trazabilidad.",
  },
];

const painVsSolution = [
  {
    pain: "Tickets, boletas y facturas llegan tarde o se pierden antes de entrar al sistema.",
    solution:
      "La captura desde web y móvil deja el comprobante cargado cuando ocurre, no horas o días después.",
  },
  {
    pain: "El sistema contable legacy recibe información sucia y el equipo termina corrigiendo a mano.",
    solution:
      "Convertilabs filtra, extrae, clasifica y deja mejor preparado lo que el sistema contable recibe.",
  },
  {
    pain: "Migrar de sistema da miedo porque hay años de información acumulada y procesos armados.",
    solution:
      "Se integra con lo que ya existe. Favorece mejora e integración, no borrón y cuenta nueva.",
  },
  {
    pain: "La promesa de IA genera desconfianza si parece que puede inventar un asiento.",
    solution:
      "IA que asiste, no que decide. El motor es determinístico y el control final sigue en manos del equipo.",
  },
];

const aiItems = [
  "Hace OCR, extrae datos y propone una primera lectura para ahorrar trabajo repetitivo.",
  "Sugiere clasificación, opinión sobre cuentas y reportes, pero no modifica ni contabiliza por su cuenta.",
  "Opera dentro de un marco determinístico, con reglas auditables y criterio humano visible.",
  "Su valor está en asistir y acelerar, no en reemplazar al contador, al auditor ni al responsable de la decisión.",
];

const desktopPoints = [
  "Revisión factual y contable",
  "IVA mensual, auditoría y trazabilidad",
  "Reglas, aprendizaje y salida para el sistema contable legacy",
];

const mobilePoints = [
  "Captura inmediata de tickets y boletas",
  "Seguimiento rápido del documento desde campo",
  "Foto visible en desktop para corroborar el documento real",
];

const audiences = [
  {
    title: "Estudios contables",
    description:
      "Para bajar retrabajo, sostener criterio entre clientes y hacer que lo que llega al sistema contable legacy ya llegue mejor armado.",
  },
  {
    title: "Empresas",
    description:
      "Para tener gastos y documentos cargados cuando ocurren, y llegar al IVA con menos administración atrasada.",
  },
  {
    title: "Sistemas contables legacy",
    description:
      "Para sumar captura móvil, OCR y clasificación guiada sin tener que desarrollar desde cero una capa operativa completa.",
  },
];

const faqItems = [
  {
    question: "¿Convertilabs reemplaza mi sistema contable?",
    answer:
      "No. Funciona como una capa de inteligencia y captura operativa que alimenta al sistema contable legacy que ya usa tu equipo.",
  },
  {
    question: "¿La IA decide sola?",
    answer:
      "No. IA que asiste, no que decide. Puede extraer, sugerir y resumir, pero no inventa asientos ni modifica información por su cuenta.",
  },
  {
    question: "¿Para qué sirve la app móvil?",
    answer:
      "Para capturar el comprobante en el momento en que ocurre el gasto. Eso evita pérdida de tickets y reduce horas de carga administrativa al volver a la oficina.",
  },
  {
    question: "¿Tengo que migrar mi información histórica?",
    answer:
      "No necesariamente. La idea es integrarse con el sistema existente y mejorar la calidad de lo que entra, no forzarte a una mudanza completa.",
  },
  {
    question: "¿Cómo funciona el acceso hoy?",
    answer:
      "El registro abierto está cerrado. Si quieres probarlo, escribes y evaluamos si tiene sentido habilitarte acceso por invitación y sin costo.",
  },
];

const originPoints = [
  "Desarrollado para resolver la operativa de Rontil, una empresa real de importaciones y servicios técnicos en Uruguay.",
  "No nació como un sistema contable completo. Nació como una capa de automatización para convivir con sistemas contables legacy.",
  "Su obsesión no es reemplazar lo que ya existe, sino mejorar lo que entra para que llegue perfecto al sistema de fondo.",
  "Hoy se comparte por invitación con equipos que quieran probarlo sobre una operación real y sin costo.",
];

function sectionEyebrow(label: string) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#58d2c4]">
      {label}
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="page-shell space-y-8">
      <section className="overflow-hidden rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,#12181f_0%,#18262d_50%,#1f241d_100%)] text-white shadow-[0_32px_100px_rgba(8,12,18,0.28)]">
        <div className="grid gap-8 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[0.82fr_minmax(0,1.18fr)] lg:px-10 lg:py-12">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              <span className="h-2 w-2 rounded-full bg-[#ffad62]" />
              Capa de inteligencia y captura operativa
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.07em] text-balance md:text-6xl">
                Convertilabs, capa inteligente para sistemas contables legacy
              </h1>
              <p className="max-w-2xl text-base leading-8 text-white/74 md:text-lg">
                Convertilabs captura documentos y tickets, usa IA que asiste, no
                que decide, y aplica un motor determinístico para que lo que llega
                a tu sistema contable legacy ya esté clasificado, revisado y listo
                para importar.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <a
                  href={demoHref}
                  className="rounded-[8px] bg-[#ff9b4a] px-5 py-3 text-sm font-semibold text-[#1d1208] transition hover:brightness-105"
                >
                  Solicitar acceso
                </a>
                <a
                  href="#como-funciona"
                  className="rounded-[8px] border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ver cómo funciona
                </a>
              </div>
              <p className="text-sm leading-6 text-white/52">
                Priorizamos el contacto directo para asegurar que la herramienta se
                adapte a tu flujo de trabajo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[8px] border border-white/10 bg-black/12 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/42">
                  Acceso
                </p>
                <p className="mt-2 text-sm font-semibold">Solo por invitación</p>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-black/12 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/42">
                  Enfoque
                </p>
                <p className="mt-2 text-sm font-semibold">
                  Integración, no migración forzada
                </p>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-black/12 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/42">
                  Costo
                </p>
                <p className="mt-2 text-sm font-semibold">Prueba sin costo</p>
              </div>
            </div>
          </div>

          <div className="lg:pl-4">
            <div className="mx-auto max-w-[1120px] rounded-[8px] border border-white/12 bg-[#0e141a] p-3 shadow-[0_28px_80px_rgba(4,10,18,0.34)]">
              <div className="overflow-hidden rounded-[6px] border border-white/8 bg-black/10">
                <Image
                  src={marketingImageSrc}
                  alt="Dashboard de Convertilabs en desktop mostrando bandeja documental, IVA y auditoría"
                  width={1408}
                  height={768}
                  priority
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#132028_0%,#0f181f_100%)] px-6 py-7 text-white md:px-8 md:py-8">
        <div className="max-w-3xl">
          {sectionEyebrow("Entenderlo rápido")}
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            Captura operativa, IA guiada y salida limpia al sistema contable que
            ya usas
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {operatingSignals.map((item) => (
            <article
              key={item.label}
              className="rounded-[8px] border border-white/8 bg-[rgba(17,24,30,0.62)] px-4 py-4 shadow-[0_14px_34px_rgba(6,10,16,0.18)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#58d2c4]">
                {item.label}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/70">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,#10171e_0%,#122127_56%,#17221c_100%)] px-6 py-7 text-white md:px-8 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[0.86fr_minmax(0,1fr)]">
          <div className="max-w-2xl">
            {sectionEyebrow("No compite con tu sistema")}
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              No venimos a reemplazar tu sistema contable. Venimos a mejorar lo
              que llega al fondo.
            </h2>
          </div>

          <div className="grid gap-3">
            {integrationPrinciples.map((item) => (
              <div
                key={item}
                className="rounded-[8px] border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-white/72"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#131a22_0%,#10161d_100%)] px-6 py-7 text-white md:px-8 md:py-8"
      >
        <div className="max-w-3xl">
          {sectionEyebrow("Cómo funciona")}
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            Una capa operativa entre el documento y el sistema contable
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/66 md:text-base">
            Convertilabs ordena la captura, la clasificación, la revisión y la
            salida al sistema contable legacy para que la operación llegue mejor
            al final del proceso.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {workflow.map((item) => (
            <article
              key={item.step}
              className="rounded-[8px] border border-white/8 bg-white/5 px-4 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7cd6f3]">
                {item.step}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/66">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#15222a_0%,#0f171d_100%)] px-6 py-7 text-white md:px-8 md:py-8">
          {sectionEyebrow("Dolor actual")}
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            Lo que hoy rompe la calidad de lo que entra al sistema contable
          </h2>
          <div className="mt-6 space-y-3">
            {painVsSolution.map((item) => (
              <div
                key={item.pain}
                className="rounded-[8px] border border-white/8 bg-[rgba(14,20,26,0.68)] px-4 py-4 text-sm leading-7 text-white/68"
              >
                {item.pain}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#12211e_0%,#11181d_100%)] px-6 py-7 text-white md:px-8 md:py-8">
          {sectionEyebrow("Filtro antes del sistema")}
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            Lo que Convertilabs ordena antes de importar
          </h2>
          <div className="mt-6 space-y-3">
            {painVsSolution.map((item) => (
              <div
                key={item.solution}
                className="rounded-[8px] border border-white/8 bg-white/6 px-4 py-4 text-sm leading-7 text-white/72"
              >
                {item.solution}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,#18161a_0%,#142229_55%,#111921_100%)] px-6 py-7 text-white md:px-8 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_minmax(0,1fr)]">
          <div className="max-w-2xl">
            {sectionEyebrow("IA con límites claros")}
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              IA que asiste, no que decide
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/68 md:text-base">
              Esa es la ventaja competitiva. La IA acelera lectura,
              clasificación y explicación, pero el asiento no sale de una caja
              opaca: sale de un motor determinístico y de una decisión humana
              visible.
            </p>
          </div>

          <div className="grid gap-3">
            {aiItems.map((item) => (
              <div
                key={item}
                className="rounded-[8px] border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-white/72"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#121d25_0%,#0f1820_100%)] px-6 py-7 text-white md:px-8 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[0.82fr_minmax(0,1.18fr)]">
          <div className="space-y-6">
            <div>
              {sectionEyebrow("Desktop + móvil")}
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
                App móvil para capturar en la calle. Desktop para revisar con la
                foto real a la vista.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[8px] border border-white/8 bg-[rgba(15,22,29,0.66)] px-4 py-4">
                <p className="text-sm font-semibold">Versión desktop</p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-white/68">
                  {desktopPoints.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-white/8 bg-[rgba(15,22,29,0.66)] px-4 py-4">
                <p className="text-sm font-semibold">App móvil de campo</p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-white/68">
                  {mobilePoints.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[8px] border border-[rgba(255,155,74,0.22)] bg-[rgba(255,155,74,0.1)] px-4 py-4 text-sm leading-7 text-[#ffd8af]">
              ¿Paraste en la ANCAP a poner combustible o a tomar un café?
              Sacás la foto del ticket y seguís. Para equipos que trabajan con
              sistemas contables legacy, eso puede terminar clasificado y listo
              para importar sin tener que desarrollar esa capa desde cero.
            </div>

            <p className="text-sm leading-7 text-white/60">
              Piensa en una boleta de combustible sacada en Nueva Palmira: entra
              desde la calle, se procesa, aparece en desktop con la foto visible
              y se revisa sin perder trazabilidad.
            </p>
          </div>

          <div className="rounded-[8px] border border-white/12 bg-[#0e141a] p-3 shadow-[0_22px_60px_rgba(4,10,18,0.28)]">
            <div className="overflow-hidden rounded-[6px] border border-white/8 bg-black/10">
                <Image
                  src={fieldFlowImageSrc}
                  alt="Convertilabs mostrando captura móvil de campo sincronizada con la revisión en desktop"
                  width={1408}
                  height={768}
                  className="h-auto w-full"
                />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {audiences.map((item) => (
          <article
            key={item.title}
            className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#141b23_0%,#10161d_100%)] px-6 py-7 text-white md:px-8 md:py-8"
          >
            {sectionEyebrow("Para quién")}
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              {item.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/68 md:text-base">
              {item.description}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,#15161d_0%,#1b2123_52%,#1d1712_100%)] px-6 py-7 text-white md:px-8 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[0.84fr_minmax(0,1fr)]">
          <div className="max-w-xl">
            {sectionEyebrow("Prueba real")}
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              Desarrollado para resolver la operativa de una empresa real en
              Uruguay
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/68 md:text-base">
              El caso Rontil no es decorado de marketing. Es la prueba de que
              Convertilabs nació para resolver flujo documental, importaciones,
              trabajo de campo y salida a sistemas contables legacy dentro de
              una operación real.
            </p>
          </div>

          <div className="grid gap-3">
            {originPoints.map((item) => (
              <div
                key={item}
                className="rounded-[8px] border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-white/72"
              >
                {item}
              </div>
            ))}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={demoHref}
                className="rounded-[8px] bg-[#ff9b4a] px-5 py-3 text-sm font-semibold text-[#1d1208] transition hover:brightness-105"
              >
                Solicitar acceso
              </a>
              <Link
                href="/contact"
                className="rounded-[8px] border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver contacto
              </Link>
            </div>
            <p className="text-sm leading-6 text-white/52">
              Priorizamos el contacto directo para asegurar que la herramienta se
              adapte a tu flujo de trabajo.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#132028_0%,#10181f_100%)] px-6 py-7 text-white md:px-8 md:py-8">
        <div className="max-w-3xl">
          {sectionEyebrow("FAQ")}
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            Preguntas frecuentes antes de pedir acceso
          </h2>
        </div>

        <div className="mt-8 space-y-3">
          {faqItems.map((item) => (
            <details
              key={item.question}
              className="rounded-[8px] border border-white/8 bg-[rgba(15,22,29,0.66)] px-4 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-7 text-white/70">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <MarketingCtaBanner
        eyebrow="Acceso actual"
        title="No se comercializa de forma abierta. Si quieres probarlo, escríbenos."
        description="Hoy Convertilabs se comparte por invitación con equipos que quieran evaluar esta capa de inteligencia y captura operativa sobre una necesidad real. La prueba actual es sin costo."
        actions={
          <div className="flex max-w-sm flex-col items-start gap-3">
            <div className="flex flex-wrap gap-3">
              <a
                href={demoHref}
                className="rounded-[8px] bg-[#ff9b4a] px-5 py-3 text-sm font-semibold text-[#1d1208] transition hover:brightness-105"
              >
                Solicitar acceso
              </a>
              <Link
                href="/login"
                className="rounded-[8px] border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ya tengo invitación
              </Link>
            </div>
            <p className="text-sm leading-6 text-white/52">
              Priorizamos el contacto directo para asegurar que la herramienta se
              adapte a tu flujo de trabajo.
            </p>
          </div>
        }
      />
    </div>
  );
}
