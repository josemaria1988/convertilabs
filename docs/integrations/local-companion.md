# Convertilabs Local · piloto privado

Uso: herramienta interna de administración de Rontil. El dominio abre únicamente el login, sin landing comercial ni registro público. Codex puede cargar documentos y descargar reportes mediante los comandos de esta guía. Complementa el [modelo de Convertilabs 2.0](../convertilabs-2.0-baseline-arquitectura.md); no crea otro ERP ni otra base de datos.

Verificación del piloto: 529 pruebas generales, 14 del proveedor Codex y 11 grupos PostgreSQL aislados aprobados; build, TypeScript y ESLint aprobados. Inicio real en Windows con login HTTP 200, escuchando sólo en `127.0.0.1:4318`, y parada comprobada. El 08/09/2026 se aplicó la migración de la cola al Supabase de Rontil tras ensayarla en una transacción con rollback. Los seis documentos existentes conservaron su estado. También se reparó el cifrado de la conexión Zeta existente tras verificar la identidad de Rontil y su huella de credenciales. Se conservó un respaldo cifrado y se sincronizó la clave con Vercel, sin cambiar la fuente `db_encrypted`. Salud y consulta de ventas reales aprobadas; la consulta del 07/09/2026 devolvió cero filas. No se enviaron comprobantes al ERP. El diagnóstico `doctor --cloud` comprueba la disponibilidad actual de la cola y la conexión Zeta.

## Qué permite esta entrega

Un componente Windows/Node reutiliza la aplicación Next.js, los servicios de documentos, las conexiones Zeta y Supabase. Se eligió este camino después de revisar el código: una aplicación .NET separada duplicaría captura, validaciones, revisión y exportación ya implementadas. La interfaz local se abre en `http://127.0.0.1:4318`, con un acceso `Convertilabs Local.cmd`; los comandos permiten que Codex cargue una foto o PDF y consulte estados/reportes.

Flujo: foto/PDF → Storage privado en Supabase → `document_processing_runs` → trabajador saliente en una PC → `codex exec` con sesión ChatGPT → validaciones de estructura/importes/identidad → borrador en las pantallas existentes → revisión humana → botón existente de envío de factura de gasto a Zeta. El trabajador nunca envía al ERP, confirma contabilidad ni emite comprobantes.

La IA sigue ejecutándose en OpenAI y consume el cupo de la cuenta ChatGPT. No es inferencia sin conexión. El modelo predeterminado es `gpt-5.6-terra`, configurable. No existe retorno automático a la API paga.

Los informes de ventas, compras, artículos, stock, precios base y precios de venta se leen de la copia compartida en Supabase. Una actualización diaria a las **18:00, America/Montevideo**, concentra las lecturas de Zeta. Se reutilizan las credenciales y los contratos existentes. Los precios de venta combinan las bases completas con las reglas de las listas seleccionadas; el nombre de una lista por sí solo no informa sus importes. Esta entrega no incorpora edición masiva de precios ni ajustes de stock en Zeta. El botón existente de facturas sigue limitado a compras/gastos admitidos por su preflight, no mercadería/stock.

## Activación y permisos

Para instalar esta versión en otro entorno:

1. Revisar y aplicar al Supabase correcto `20260908_local_document_worker.sql`, `20260909_zeta_daily_cache.sql` y `20260909_document_upload_identity.sql`, bajo `supabase/migrations/`. Incorporan reservas, publicación de la copia y protección de cargas repetidas. No modifican comprobantes existentes ni envían operaciones a Zeta.
2. Actualizar también el servidor web que accede a esa base. Las versiones anteriores pueden tratar la cola local como una corrida OpenAI detenida, o invocar IA paga al revisar el documento. No mezclar el worker nuevo con una web anterior a estos guards.
3. Verificar la clave `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` de la PC contra la conexión cifrada existente. Reutilizar exactamente la clave del mismo despliegue; generar una clave nueva no permite descifrar los datos anteriores.
4. Ejecutar `local doctor --cloud`, abrir la UI y probar una factura real con revisión humana antes de habilitar cualquier envío definitivo.

Este primer paquete es un piloto administrativo en PCs confiables, con el entorno del servidor en `.env.local`. `service_role` permite más que una sesión normal: el parámetro `--actor` es atribución auditada con membresía/rol activo, no una credencial de usuario. No distribuir estas claves a operadores o PCs ajenas. Para distribuir a usuarios se necesita una API de dispositivos autenticados, con credenciales revocables por PC. La cola y los datos ya admiten varios trabajadores; todavía no hay instalador general ni autenticación de dispositivos/MCP.

Las llamadas de la PC hacia Supabase, Zeta y Codex son salientes. La interfaz sólo escucha en loopback; no se abren puertos del router. La sesión web usa el login de Convertilabs. Si se usa OAuth, el callback de loopback debe estar permitido en Supabase.

## Instalación en Windows

Requisitos: Node compatible con `package.json` (en esta PC se verificó 24.18.1), dependencias del proyecto, Codex CLI nativo 0.153.4 o posterior compatible, sesión ChatGPT y Poppler para PDF.

```powershell
Set-Location D:\convertilabs
npm ci
npm run local -- doctor
npm run local -- configure --slug rontil-s-a --actor <UUID-del-usuario-miembro>
npm run local -- doctor --cloud
```

`configure` valida la empresa y la membresía en Supabase y guarda únicamente slug, UUID y URL en `.local-companion/config.json`. No solicita claves ni contraseñas. Las variables de `.env.example` documentan la configuración sin secretos; la CLI carga primero `.env.local` y luego `.env`, respetando variables ya definidas en el proceso.

La CLI antigua que aparezca como `codex` en PATH puede rechazar la configuración nueva. `local doctor` muestra el ejecutable nativo detectado dentro de Codex desktop. Para iniciar sesión, abrir Codex y usar su login oficial, o ejecutar ese `codex.exe`:

```powershell
# Reemplazar por el ejecutable verificado que muestra local doctor.
& 'C:\ruta\a\codex.exe' login
& 'C:\ruta\a\codex.exe' --ignore-user-config login status
```

No pegar tokens en el chat ni usar API keys para este proveedor. `forced_login_method=chatgpt` impide sustituir la sesión por facturación de API. El proceso de extracción ignora config/reglas del usuario y del repositorio, desactiva herramientas y recibe sólo los archivos del trabajo y su contexto documental; las credenciales de Supabase/Zeta/OpenAI API no se heredan.

## Inicio, carga y parada

Después de activar la cola, doble clic en `Convertilabs Local.cmd` inicia el programa y el worker ocultos y abre la interfaz. Alternativa visible para diagnóstico:

El trabajador consulta la cola al iniciarse y luego espera **4 horas entre revisiones automáticas**, también si hubo un error recuperable de conexión. Cada revisión toma como máximo una factura. Mientras espera no consulta Supabase ni llama a la IA; el log indica `nextCheckAt`. Las renovaciones de reserva cada 45 segundos sólo ocurren mientras se procesa una factura. `worker --once` permite pedir una revisión inmediata.

```powershell
npm run local -- serve --with-worker
# Sólo interfaz:
npm run local -- serve
# Sólo trabajador, concurrencia 1:
npm run local -- worker
# Tomar como máximo un trabajo, útil para el piloto:
npm run local -- worker --once
```

Cargar desde Codex o terminal:

```powershell
npm run local -- ingest --file 'C:\Facturas\foto.jpg'
npm run local -- ingest --file 'C:\Facturas\factura.pdf'
npm run local -- status --document <UUID-devuelto>
```

El resultado contiene `documentId`, `runId`, `status` y `reviewUrl`. La carga comprueba contenido PDF/JPG/PNG y un máximo de 20 MB. Repetir el mismo archivo reutiliza su identidad. Una subida interrumpida se retoma con el mismo comando tras vencer su reserva de cinco minutos; si el archivo ya quedó en Storage se verifica su hash antes de continuar. Los errores de extracción se reintentan desde el botón existente de la revisión. Nunca hay un comando `send` oculto en la CLI.

Web y móvil reservan el mismo identificador por organización y SHA-256 que usa la CLI. Cada intento tiene un token; una respuesta tardía no reinicia un documento procesado. Las cargas interrumpidas se retoman desde el canal que las inició: web/móvil o CLI. Pasar un archivo entre esos canales reutiliza el documento, pero no transfiere una reserva de subida fallida de un canal al otro. Fotos distintas del mismo comprobante requieren además la comparación fiscal; no se consideran archivos idénticos sólo por mostrar una factura parecida.

Las pantallas **Documentos** y **Campo / Subir** usan **Codex en mi PC · cuenta ChatGPT** cuando el servidor tiene `CONVERTILABS_PROCESSING_PROVIDER=codex_local` y `CONVERTILABS_DISABLE_PAID_AI=true`. Esta es la configuración interna de Rontil, tanto en la web como en el celular. El proveedor queda guardado en el documento; los documentos anteriores no se reprocesan al cambiar esta configuración. El ejecutable `npm run local` siempre fuerza `codex_local` y bloquea la API paga, aunque haya una clave configurada.

Desde el teléfono se conserva la app y su cámara: la foto se guarda en Supabase y espera al trabajador de una PC. No requiere estar en la misma red Wi-Fi. También se puede adjuntar una foto o PDF en Codex y pedir «cargá esta factura», o indicar la ruta de un archivo local. Codex informa el estado real y entrega el enlace para revisar. La carga y la extracción no envían la factura al ERP.

Antes del envío, la revisión contrasta la factura estructurada contra la copia mensual de compras. Esa copia debe ser posterior a la carga y tener menos de 24 horas; la fecha del comprobante debe estar dentro de la ventana efectivamente consultada. Un registro histórico acumulado no prueba que ese mes se haya vuelto a consultar. Si ya existe, si hay diferencias o si faltan datos suficientes para la comparación, se bloquea el envío. Sólo un faltante permite confirmar la carga al ERP, conservando el preflight puntual final y la reserva duradera del envío. No se consultan meses extra automáticamente al subir una foto.

```powershell
# Detiene las instancias administradas por serve/.cmd, incluida la extracción en curso:
npm run local -- stop
# Para worker directo en una terminal: Ctrl+C.
```

No se registra un servicio de Windows ni inicio automático. Los logs están en `.local-companion/app.log` y `app.error.log`; `supervisor.json` identifica la instancia administrada. `stop` pide una parada a esa instancia, sin detener otros servidores Node del usuario.

## Copia diaria de Zeta en Supabase

Aplicar `supabase/migrations/20260909_zeta_daily_cache.sql` junto con esta versión. Reutiliza `integration_sync_runs` e `integration_raw_records`: agrega control de horario, reserva por organización, presupuesto de solicitudes y publicación atómica de snapshots completos. No requiere duplicar las tablas documentales ni convertir facturas del ERP en cargas locales.

```powershell
# Plan sin consultar Zeta ni escribir en Supabase:
npm run local -- sync-zeta --dry-run
# Estado, fecha y cobertura de la copia, sólo lectura de Supabase:
npm run local -- cache-status
# Ejecución programada: una sola corrida por día, desde las 18:00 de Uruguay:
npm run local -- sync-zeta
# Sólo ante un pedido explícito del usuario de actualizar ahora:
npm run local -- sync-zeta --now --reason 'Pedido explícito del usuario de actualizar ahora la copia de Zeta'
```

La programación diaria se configura como automatización de Codex en esta PC. Requiere la PC encendida y Codex disponible; es independiente del trabajador de facturas. El horario se comprueba también con el reloj de Supabase: la ejecución programada no reserva una corrida ni llama a Zeta antes de las 18:00. Si ya se intentó ese día, tampoco vuelve a consultar, aunque la corrida haya fallado. No hay `--force`, reintentos de HTTP ni fallback de un informe hacia la API.

Ante un pedido explícito del usuario de actualizar ahora, `sync-zeta --now --reason '<motivo de la autorización humana>'` permite adelantar la única corrida de ese día de America/Montevideo. `--now` y `--reason` son obligatorios juntos; el motivo debe describir el pedido recibido. Una solicitud de informe o la falta de precios en la copia no autorizan por sí solas este adelanto. Se mantienen la reserva por organización, el presupuesto de llamadas, los controles de duplicados y la publicación atómica. Si el día ya tiene un intento, el adelanto también queda bloqueado. Si la corrida se adelantó, la ejecución programada de las 18:00 se omite por ese mismo control diario. La recurrencia de los días siguientes continúa a las 18:00. Agregar `--dry-run` sólo inspecciona el plan, sin reservar una corrida ni actualizar datos.

La configuración privada opcional es `.local-companion/zeta-daily.json`, o un archivo indicado con `--sync-config`. Campos admitidos: `maxRequests` (100 por defecto), `minIntervalMs` (2000), `maxPages` (100), `pricePairs` (pares explícitos `articleCode`/`priceBaseCode`) y `salesPriceLists` (hasta 20 códigos numéricos positivos de listas de venta, sin repetidos). Una selección como `"salesPriceLists": [1]` solicita la lista 1 y obtiene la base que declare su regla; no supone que se llame `LP`. Sin selección, no incorpora listas automáticamente. Esos límites son precauciones internas; no representan una cuota oficial informada por Zeta. Una actualización diaria puede necesitar varias peticiones por endpoints y paginación. El presupuesto se comparte entre todos ellos y se reserva antes de cada solicitud; agregar precios no lo aumenta.

Las ventas se consultan desde el último día sincronizado, con un solapamiento de fecha para cubrir comprobantes posteriores a las 18:00. La primera ejecución comienza por el día actual. Las compras y gastos usan una consulta masiva del mes actual, porque el contrato documentado no ofrece la consulta diaria de todos los proveedores juntos. El usuario autorizó esta excepción mensual dentro de la actualización diaria. Se acumula la historia en Supabase y se actualiza por identificador de Zeta; una relectura no crea otra factura. Las fechas consultadas son fechas de comprobante: cambios retroactivos fuera de esa ventana requieren una reconciliación explícita.

Se conservan las filas originales y las líneas de compras que entrega el servicio. También se actualizan los maestros existentes de proveedores, conceptos, impuestos y nombres de listas/precios base, necesarios para preparar gastos. No se agregan llamadas individuales por factura ni por cada proveedor. El detalle mensual de ventas tiene restricciones de moneda y uso; la copia de ventas debe indicar si sólo contiene cabeceras, sin presentarlas como líneas completas.

Contratos contrastados con [Facturas de Clientes](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-clientes/) y [Facturas de Proveedores](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-proveedores/): período obligatorio, filtros de fecha y alcance de consultas masivas. No se inventa una moneda de salida.

**Precios:** el [contrato de precios base](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/precio-base-y-precio-de-venta/) permite enviar `ArticuloCodigo` vacío para descargar todos los artículos de una base explícita. La sincronización consulta las [reglas de precios de venta](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/precios-de-venta/) de las listas seleccionadas, descarga una vez cada base requerida y aplica el [cálculo de Zeta](https://zetasoftware.info/ayuda/configuracion/stock/precios-de-venta/) conservando regla, base, moneda e importes decimales con cinco posiciones. Se publican tanto `base-prices` completos por base como `sales-prices` por lista en la misma corrida; una regla o base incompleta impide publicar el conjunto nuevo. No se expanden todos los artículos en cientos de solicitudes. Los pares explícitos de `pricePairs` siguen siendo compatibles con las copias anteriores.

Los precios de venta son genéricos de la lista: no incluyen condiciones particulares de cliente, forma de pago ni conversiones entre monedas. Cada moneda se conserva por separado, con precio sin IVA y con IVA. La lista seleccionada y la fecha de sus datos deben acompañar cualquier informe. Guardar la configuración o ejecutar `--dry-run` no significa que los importes ya estén actualizados: la nueva cobertura se publica al completar la sincronización diaria, en su horario habitual o adelantada ante un pedido explícito del usuario.

Para un artículo sin precio dentro de una base o lista completamente consultada se conserva `priceStatus: no_price_at_source`, `price: null` y filas vacías: es un resultado válido. Una base, lista o par que no fue consultado da `zeta_cache_coverage_missing`; nunca equivale a cero ni a ausencia confirmada. Las consultas por fecha de registro de precios base requieren exactamente la ventana de origen porque las filas no permiten reconstruir esa fecha. Una copia histórica que sólo consultó un par no se presenta como base completa.

Cada snapshot conserva sus páginas inmutables, hash, filtros y fecha. Sólo una corrida completa publica el nuevo conjunto de informes; una corrida interrumpida deja disponible la copia anterior. Se guardan dos copias completas del historial acumulado para limitar almacenamiento; la auditoría de corridas permanece. El estado distingue último intento y última copia completa. Los maestros existentes mantienen su propia trazabilidad. Las validaciones de una factura enviada por una persona conservan lecturas puntuales de preflight y reconciliación: no habilitan consultas administrativas generales. Las fotos/PDF son respaldo en Supabase; a Zeta se envía el comprobante estructurado por la API, con confirmación humana.

## Reportes desde Supabase

Los comandos generan archivos locales nuevos leyendo exclusivamente Supabase. No sobrescriben archivos ni modifican el ERP. Si falta cobertura, fallan con una explicación en lugar de consultar Zeta.

```powershell
npm run local -- report sales --from 2026-08-01 --to 2026-08-31 --out '.local-companion\reports\ventas-agosto.json'
npm run local -- report purchases --from 2026-08-01 --to 2026-08-31 --out '.local-companion\reports\compras-agosto.json'
npm run local -- report articles --out '.local-companion\reports\articulos.json'
npm run local -- report stock --out '.local-companion\reports\stock.json'
npm run local -- report base-prices --article '00001' --price-base '1' --out '.local-companion\reports\precio-00001.json'
npm run local -- report base-prices --price-base 'LP' --out '.local-companion\reports\precios-base.json'
npm run local -- report sales-prices --price-list 1 --out '.local-companion\reports\precios-venta.json'
npm run local -- report sales-prices --price-list 1 --article '000275' --currency 1 --out '.local-companion\reports\precio-venta-000275.json'
npm run local -- report stock --filters '.local-companion\filtros-stock.json' --out '.local-companion\reports\stock.csv'
```

Ejemplo de filtros: `{"DepositoCodigo":1,"LocalCodigo":1}`. Los códigos `00001`/`1` son ejemplos. Se rechazan filtros desconocidos y fechas inválidas. JSON conserva los tipos de origen, campos compuestos y ceros iniciales. CSV protege identificadores/fórmulas con un apóstrofo y agrega `.metadata.json`; para reprocesar fielmente se prefiere JSON. La evidencia incluye `source: supabase`, `dataAsOf`, antigüedad, cobertura, páginas y hash. Los datos de más de 24 horas se marcan `stale`. Un informe debe comunicar siempre su fecha, especialmente si se usa una copia anterior.

`sales` informa facturas de venta; `sales-prices` informa importes de listas de venta. Este último admite sólo `ArticuloCodigo` (texto exacto), `PrecioVentaCodigo` y `MonedaCodigo` (enteros positivos), equivalentes a `--article`, `--price-list` y `--currency`. Sin artículo devuelve la lista completa; sin moneda conserva todas sus monedas. Se puede omitir `--price-list` sólo cuando la copia publicada contiene una única lista, que queda identificada en la salida. Si hay varias, exige elegir una. `base-prices` exige `--price-base`, pero permite omitir el artículo cuando existe cobertura masiva de esa base.

## Recuperación y límites

Los workers reclaman `codex_local` por organización mediante un RPC atómico. La reserva dura 180 segundos y se renueva cada 45; cada nueva reserva genera un token. Una PC anterior no puede guardar después de perderlo. La finalización persiste todos los artefactos en una transacción y es idempotente. La misma cola bloquea extracción local e Inngest simultáneos del documento.

La cola local puede esperar con la PC apagada. Una interrupción recuperable permite hasta tres intentos, con espera. Al agotarse los intentos queda un error visible para intervención. Auth/cuota/configuración no disparan un retorno pago: el worker se pausa para preservar las demás facturas. Resolver la causa y reiniciar el programa; reintentar el documento afectado desde la revisión. Un error JSON no crea un borrador válido.

Cada invocación Codex tiene máximo 240 segundos. PDF: máximo 12 páginas; se rasterizan todas con Poppler, sin truncar ni ejecutar OCR pago. Si falta Poppler se puede cargar JPG/PNG. Los temporales se borran al terminar; un cierre forzado del sistema puede dejar archivos en `.local-companion/codex-jobs`. Los resultados duraderos y el original permanecen en Supabase.

Las validaciones determinísticas revisan campos faltantes, fechas, moneda, subtotal/impuestos/total y líneas. Las diferencias se marcan para revisar; no se rellenan importes o RUT ilegibles. La identidad fiscal y las reglas/revisión existentes siguen siendo autoridad antes del ERP. Nunca considerar un JSON válido como aprobación contable.

## Verificación reproducible

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run test:local:codex
# Motor PostgreSQL aislado, sin base remota ni cambios en el lockfile raíz:
npm install --prefix .local-companion/qa-sql --no-save --ignore-scripts @electric-sql/pglite
npm run test:local:queue
npm run test:internal:operations
npm run test:zeta:cache
npm run test:documents:identity
npm run local -- doctor --cloud
```

Las pruebas cubren rechazo de facturación paga antes de cualquier fetch (incluidos archivos, batch y polling), aislamiento asíncrono, protección de la revisión web, sesión/cuota, límites, salida inválida, cancelación, PDF multipágina, upload recuperable, duplicados, permisos, paginación y CSV. El smoke SQL usa tablas/constraints del schema canónico y comprueba rollback, idempotencia, leases, tokens vencidos, duplicados y grants. PGlite tiene un solo backend: no sustituye una prueba de carga multiconexión contra PostgreSQL/Supabase de ensayo.

La activación incluyó `20260908_internal_operations_schema.sql`: crea las 15 tablas administrativas que faltaban para tareas, procesos, obligaciones, comunicaciones, sugerencias y recepción de solicitudes. Conserva las migraciones históricas y corrige la política de sugerencias para usar membresías activas. Se ensayó con rollback antes de aplicarla; se verificaron RLS, permisos efectivos y paridad del esquema. No carga datos ni modifica los comprobantes existentes. Las cuatro pruebas adicionales de operaciones cubren instalación repetida, aislamiento entre organizaciones, miembros inactivos y roles de sólo lectura.

Prueba real realizada con una imagen sintética, sesión ChatGPT y el schema exacto de Convertilabs: 22,872 segundos; subtotal 100, IVA 22, total 122 y línea 2 × 50 correctos, RUT ausente conservado en null. Uso informado: 12.013 tokens compartidos de ChatGPT. Se verificó también el render local completo de un PDF sintético de dos páginas. Estos casos prueban compatibilidad técnica; no miden precisión de un lote de 10–20 facturas reales. No se enviaron comprobantes a Zeta durante la validación.

## Documentación oficial consultada

- [Codex no interactivo](https://learn.chatgpt.com/docs/non-interactive-mode): imágenes, JSON Schema, salida estructurada y configuración aislada.
- [Inicio de sesión](https://learn.chatgpt.com/docs/auth): autenticación oficial con ChatGPT.
- [Entrada de imágenes](https://learn.chatgpt.com/docs/image-inputs): adjuntos JPG/PNG y múltiples imágenes.
- [Configuración](https://learn.chatgpt.com/docs/config-file/config-reference): controles del ejecutable; se contrastaron con la ayuda y con una ejecución real de CLI 0.153.4.
- [Modelos y uso](https://learn.chatgpt.com/docs/pricing): modelos y cupo de cuenta.

## Archivos principales

- `scripts/local-companion/cli.cjs`, `start.ps1` y `Convertilabs Local.cmd`: comandos, supervisor e inicio/parada Windows.
- `modules/local-companion/codex-{provider,process,schema}.ts`: sesión oficial, ejecución aislada y validación estructural; `documents.ts`, `context.ts` y `zeta-reports.ts`: captura, alcance y reportes.
- `modules/documents/processing.ts` y `processing-provider.ts`: selección persistente, cola y reutilización del contrato documental.
- `db/schema/16_local_document_worker.sql`, su migración y `scripts/supabase/canonical-schema.mjs`: reservas, finalización atómica y permisos.
- `lib/llm/provider-policy.ts`, `openai-responses.ts` y asistentes: bloqueo de API paga, incluso durante revisión en la nube.
- Capturas de Documentos/Campo y sus server actions: selector visible y persistencia del proveedor.
- Registry Zeta: contratos de lectura de stock y precios base; tests nuevos y `.env.example`: verificaciones y configuración documentada.
