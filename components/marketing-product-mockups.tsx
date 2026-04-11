type MockupProps = {
  className?: string;
};

const desktopNav = [
  "Entrada",
  "Bandeja",
  "Revisión",
  "Legacy",
  "Auditoría",
];

const inboxItems = [
  {
    vendor: "ANCAP Ruta 5",
    amount: "$ 2.480",
    status: "Listo para revisar",
    note: "Captura móvil + OCR completo",
  },
  {
    vendor: "Café de ruta",
    amount: "$ 380",
    status: "Sugerencia lista",
    note: "Clasificación sugerida por IA",
  },
  {
    vendor: "Repuesto técnico",
    amount: "$ 14.900",
    status: "Listo para legacy",
    note: "Regla determinística aplicada",
  },
];

function cx(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ReceiptPhotoPreview({ className }: MockupProps) {
  return (
    <div
      className={cx(
        "rounded-[8px] border border-white/10 bg-[linear-gradient(180deg,#d6c1a0_0%,#b68d62_100%)] p-4 text-[#2b1f13] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
        className,
      )}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span>Foto original</span>
        <span>Ticket</span>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span>Proveedor</span>
          <span>ANCAP Ruta 5</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Fecha</span>
          <span>Hoy 14:22</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Total</span>
          <span>$ 2.480</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Destino</span>
          <span>Nueva Palmira</span>
        </div>
      </div>
      <div className="mt-4 rounded-[6px] bg-black/10 px-3 py-2 text-[11px] font-medium">
        Foto visible para corroborar el documento real antes de importar.
      </div>
    </div>
  );
}

export function MarketingDesktopMockup({ className }: MockupProps) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[8px] border border-white/12 bg-[#0f141a] text-white shadow-[0_28px_80px_rgba(4,10,18,0.36)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/8 bg-[#131a22] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff9b4a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#39c3a7]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7cd6f3]" />
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/42">
          Capa Convertilabs
        </p>
      </div>

      <div className="grid min-h-[520px] grid-cols-[108px_minmax(0,1fr)]">
        <aside className="border-r border-white/8 bg-[#111821] p-4">
          <div className="mb-5 rounded-[8px] border border-white/8 bg-white/6 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">
              Uruguay
            </p>
            <p className="mt-1 text-sm font-semibold">Rontil</p>
          </div>

          <div className="space-y-2">
            {desktopNav.map((item, index) => (
              <div
                key={item}
                className={cx(
                  "rounded-[8px] px-3 py-2.5 text-xs font-medium",
                  index === 1 ? "bg-[#1d2b30] text-white" : "text-white/56",
                )}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="bg-[linear-gradient(180deg,#151d27_0%,#10161e_100%)] p-5">
          <div className="grid gap-4 xl:grid-cols-[1.18fr_0.92fr]">
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4 rounded-[8px] border border-white/8 bg-white/6 p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">
                    Bandeja de documentos
                  </p>
                  <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">
                    Desktop completo con captura, revisión y salida al sistema
                  </h3>
                </div>
                <div className="grid gap-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">
                    Estado
                  </p>
                  <p className="rounded-[8px] bg-[#1d2b30] px-3 py-2 text-sm font-semibold text-[#9be3d3]">
                    14 documentos listos
                  </p>
                </div>
              </div>

              <div className="rounded-[8px] border border-white/8 bg-white/6 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold">Bandeja documental</p>
                    <p className="mt-1 text-sm leading-6 text-white/56">
                      Captura, OCR, clasificación guiada y trazabilidad antes de
                      importar al sistema contable.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-white/46">
                    <span className="rounded-[8px] bg-[#17322e] px-2.5 py-1 text-[#9be3d3]">
                      IA que asiste
                    </span>
                    <span className="rounded-[8px] bg-white/6 px-2.5 py-1">
                      Motor determinístico
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {inboxItems.map((item) => (
                    <div
                      key={item.vendor}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-[8px] border border-white/6 bg-[#111821] px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.vendor}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/38">
                          {item.note}
                        </p>
                      </div>
                      <span className="rounded-[8px] border border-[#4a8f86]/40 bg-[#16342f] px-2.5 py-1 text-[11px] font-semibold text-[#9be3d3]">
                        {item.status}
                      </span>
                      <span className="text-sm font-semibold text-white/72">
                        {item.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-white/8 bg-white/6 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold">Documento en revisión</p>
                    <p className="mt-1 text-sm leading-6 text-white/56">
                      El equipo puede mirar la foto real del comprobante, validar
                      datos extraídos y revisar la sugerencia antes de enviarlo al
                      sistema de fondo.
                    </p>
                  </div>
                  <span className="rounded-[8px] bg-white/6 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-white/52">
                    Vista desktop
                  </span>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                  <ReceiptPhotoPreview />

                  <div className="space-y-3">
                    <div className="rounded-[8px] border border-white/8 bg-[#111821] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">
                        Datos extraídos
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-white/72 sm:grid-cols-2">
                        <div className="rounded-[8px] bg-white/6 px-3 py-2">
                          Proveedor: ANCAP Ruta 5
                        </div>
                        <div className="rounded-[8px] bg-white/6 px-3 py-2">
                          Total: $ 2.480
                        </div>
                        <div className="rounded-[8px] bg-white/6 px-3 py-2">
                          Fecha: Hoy 14:22
                        </div>
                        <div className="rounded-[8px] bg-white/6 px-3 py-2">
                          Tipo: Combustible
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[8px] border border-white/8 bg-[linear-gradient(180deg,#17322e_0%,#10241f_100%)] px-4 py-4">
                      <p className="text-sm font-semibold">Motor determinístico</p>
                      <div className="mt-3 space-y-2 text-xs text-white/70">
                        <div className="flex items-center justify-between rounded-[8px] bg-black/15 px-3 py-2">
                          <span>Familia operativa</span>
                          <span>Gasto de ruta</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[8px] bg-black/15 px-3 py-2">
                          <span>Regla aplicada</span>
                          <span>Combustible + móvil</span>
                        </div>
                        <div className="flex items-center justify-between rounded-[8px] bg-black/15 px-3 py-2">
                          <span>Salida</span>
                          <span>Lista para importar</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[8px] border border-white/8 bg-white/6 p-5">
                <p className="text-base font-semibold">Asistente IA con criterio visible</p>
                <p className="mt-3 rounded-[8px] bg-[#111821] px-4 py-4 text-sm leading-7 text-white/74">
                  &quot;Sugiero gasto operativo con IVA compras. Detecto combustible de
                  campo y no aplico cambios ni genero importación sin confirmación.&quot;
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-white/44">
                  <span className="rounded-[8px] bg-white/6 px-2.5 py-1">
                    Opinión IA
                  </span>
                  <span className="rounded-[8px] bg-white/6 px-2.5 py-1">
                    Sin autopost
                  </span>
                  <span className="rounded-[8px] bg-white/6 px-2.5 py-1">
                    Regla auditable
                  </span>
                </div>
              </div>

              <div className="rounded-[8px] border border-white/8 bg-white/6 p-5">
                <p className="text-base font-semibold">Auditoría explicable</p>
                <div className="mt-3 space-y-2 text-sm text-white/64">
                  <div className="flex items-center justify-between rounded-[8px] bg-[#111821] px-4 py-3">
                    <span>Origen documental</span>
                    <span>Foto + OCR</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[8px] bg-[#111821] px-4 py-3">
                    <span>Validación humana</span>
                    <span>Revisión desktop</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[8px] bg-[#111821] px-4 py-3">
                    <span>Criterio aplicado</span>
                    <span>Regla reusable</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[8px] bg-[#111821] px-4 py-3">
                    <span>Estado final</span>
                    <span>Lista para importar</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[8px] border border-white/8 bg-[linear-gradient(180deg,#132028_0%,#10181f_100%)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">Salida al sistema</p>
                    <p className="mt-1 text-sm leading-6 text-white/58">
                      Dataset limpio, IVA visible y trazabilidad completa sobre el
                      mismo flujo.
                    </p>
                  </div>
                  <span className="text-[28px] font-semibold text-[#9be3d3]">
                    92%
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-full w-[92%] rounded-full bg-[#39c3a7]" />
                </div>
                <div className="mt-4 grid gap-2 text-xs text-white/70 sm:grid-cols-2">
                  <div className="rounded-[8px] bg-black/15 px-3 py-2">
                    Legacy listo para importar
                  </div>
                  <div className="rounded-[8px] bg-black/15 px-3 py-2">
                    IVA y trazabilidad
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingMobileMockup({ className }: MockupProps) {
  return (
    <div className={cx("grid gap-4 xl:grid-cols-[292px_minmax(0,1fr)]", className)}>
      <div className="overflow-hidden rounded-[8px] border border-white/14 bg-[#0e141b] text-white shadow-[0_22px_60px_rgba(4,10,18,0.34)]">
        <div className="mx-auto w-full bg-[linear-gradient(180deg,#151f29_0%,#0f151d_100%)]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                Campo
              </p>
              <p className="text-sm font-semibold">Captura móvil</p>
            </div>
            <span className="rounded-[8px] bg-[#2d4f49] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9be3d3]">
              En ruta
            </span>
          </div>

          <div className="space-y-3 p-4">
            <div className="rounded-[8px] border border-white/10 bg-white/6 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/44">
                Cámara
              </p>
              <div className="mt-3 rounded-[8px] border border-dashed border-white/16 bg-[#101720] p-3">
                <ReceiptPhotoPreview className="min-h-[188px]" />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-[8px] bg-[#17322e] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9be3d3]">
                <span>Foto tomada</span>
                <span>Lista para OCR</span>
              </div>
            </div>

            <div className="rounded-[8px] border border-white/8 bg-white/6 p-3">
              <p className="text-sm font-semibold">Procesamiento</p>
              <div className="mt-3 space-y-2 text-xs text-white/70">
                <div className="flex items-center justify-between rounded-[8px] bg-[#101720] px-3 py-2">
                  <span>OCR y lectura inicial</span>
                  <span className="text-[#9be3d3]">Listo</span>
                </div>
                <div className="flex items-center justify-between rounded-[8px] bg-[#101720] px-3 py-2">
                  <span>Clasificación guiada</span>
                  <span className="text-[#ffd4a3]">Asistida</span>
                </div>
                <div className="flex items-center justify-between rounded-[8px] bg-[#101720] px-3 py-2">
                  <span>Subido al desktop</span>
                  <span className="text-[#9be3d3]">Visible</span>
                </div>
              </div>
            </div>

            <div className="rounded-[8px] bg-[#3a3021] px-3 py-3 text-sm leading-6 text-[#ffe5c2]">
              Paraste a cargar combustible o a tomar un café: sacás la foto y
              seguís. El documento no queda colgado para más tarde.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[8px] border border-white/12 bg-[#101720] p-5 text-white shadow-[0_22px_60px_rgba(4,10,18,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/42">
              Así aparece en desktop
            </p>
            <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">
              La captura móvil entra al mismo flujo de revisión
            </h3>
          </div>
          <span className="rounded-[8px] bg-white/6 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-white/52">
            Foto corroborable
          </span>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
          <ReceiptPhotoPreview />

          <div className="space-y-3">
            <div className="rounded-[8px] border border-white/8 bg-white/6 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Documento recibido desde campo</p>
                  <p className="mt-1 text-xs leading-5 text-white/52">
                    El equipo ve la foto real, los datos extraídos y el estado de la
                    sugerencia antes de confirmar.
                  </p>
                </div>
                <span className="rounded-[8px] bg-[#17322e] px-2.5 py-1 text-[11px] font-semibold text-[#9be3d3]">
                  Campo
                </span>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-white/72 sm:grid-cols-2">
              <div className="rounded-[8px] border border-white/8 bg-white/6 px-4 py-3">
                Proveedor: ANCAP Ruta 5
              </div>
              <div className="rounded-[8px] border border-white/8 bg-white/6 px-4 py-3">
                Total: $ 2.480
              </div>
              <div className="rounded-[8px] border border-white/8 bg-white/6 px-4 py-3">
                OCR: completado
              </div>
              <div className="rounded-[8px] border border-white/8 bg-white/6 px-4 py-3">
                Foto: visible para validar
              </div>
            </div>

            <div className="rounded-[8px] border border-white/8 bg-[linear-gradient(180deg,#132028_0%,#10181f_100%)] px-4 py-4">
              <p className="text-sm font-semibold">IA + motor determinístico</p>
              <div className="mt-3 space-y-2 text-xs text-white/68">
                <div className="flex items-center justify-between rounded-[8px] bg-black/15 px-3 py-2">
                  <span>Opinión IA</span>
                  <span>Gasto operativo con IVA compras</span>
                </div>
                <div className="flex items-center justify-between rounded-[8px] bg-black/15 px-3 py-2">
                  <span>Regla propuesta</span>
                  <span>Combustible + móvil</span>
                </div>
                <div className="flex items-center justify-between rounded-[8px] bg-black/15 px-3 py-2">
                  <span>Acción final</span>
                  <span>Revisión humana antes de importar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
