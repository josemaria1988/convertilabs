# Convertilabs Local · piloto privado

Uso: herramienta interna de administración de Rontil. El dominio abre únicamente el login, sin landing comercial ni registro público. Codex puede cargar documentos y descargar reportes mediante los comandos de esta guía. Complementa el [modelo de Convertilabs 2.0](../convertilabs-2.0-baseline-arquitectura.md); no crea otro ERP ni otra base de datos.

Verificación del piloto: 529 pruebas generales, 14 del proveedor Codex y 11 grupos PostgreSQL aislados aprobados; build, TypeScript y ESLint aprobados. Inicio real en Windows con login HTTP 200, escuchando sólo en `127.0.0.1:4318`, y parada comprobada. El 08/09/2026 se aplicó la migración de la cola al Supabase de Rontil tras ensayarla en una transacción con rollback. Los seis documentos existentes conservaron su estado. También se reparó el cifrado de la conexión Zeta existente tras verificar la identidad de Rontil y su huella de credenciales. Se conservó un respaldo cifrado y se sincronizó la clave con Vercel, sin cambiar la fuente `db_encrypted`. Salud y consulta de ventas reales aprobadas; la consulta del 07/09/2026 devolvió cero filas. No se enviaron comprobantes al ERP. El diagnóstico `doctor --cloud` comprueba la disponibilidad actual de la cola y la conexión Zeta.

## Qué permite esta entrega

Un componente Windows/Node reutiliza la aplicación Next.js, los servicios de documentos, las conexiones Zeta y Supabase. Se eligió este camino después de revisar el código: una aplicación .NET separada duplicaría captura, validaciones, revisión y exportación ya implementadas. La interfaz local se abre en `http://127.0.0.1:4318`, con un acceso `Convertilabs Local.cmd`; los comandos permiten que Codex cargue una foto o PDF y consulte estados/reportes.

Flujo: foto/PDF → Storage privado en Supabase → `document_processing_runs` → trabajador saliente en una PC → `codex exec` con sesión ChatGPT → validaciones de estructura/importes/identidad → borrador en las pantallas existentes → revisión humana → botón existente de envío de factura de gasto a Zeta. El trabajador nunca envía al ERP, confirma contabilidad ni emite comprobantes.

La IA sigue ejecutándose en OpenAI y consume el cupo de la cuenta ChatGPT. No es inferencia sin conexión. El modelo predeterminado es `gpt-5.6-terra`, configurable. No existe retorno automático a la API paga.

Consultas de reportes incorporadas: ventas, stock actual y precios base por artículo/código de precio. Se conservan las credenciales y los contratos de la integración existente. El endpoint de listas de precios devuelve nombres de listas y no sustituye valores por artículo. Esta entrega no incorpora edición masiva de precios ni ajustes de stock en Zeta. Esas escrituras necesitan un flujo de cambios propuestos/revisados, validación real del endpoint e idempotencia; no deben inferirse de un reporte. El botón existente de facturas sigue limitado a compras/gastos admitidos por su preflight, no mercadería/stock.

## Activación y permisos

Para instalar esta versión en otro entorno:

1. Revisar y aplicar `supabase/migrations/20260908_local_document_worker.sql` al Supabase correcto. El script agrega columnas/funciones/trigger; no modifica comprobantes ni envía operaciones a Zeta.
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

Las pantallas **Documentos** y **Campo / Subir** usan **Codex en mi PC · cuenta ChatGPT** cuando el servidor tiene `CONVERTILABS_PROCESSING_PROVIDER=codex_local` y `CONVERTILABS_DISABLE_PAID_AI=true`. Esta es la configuración interna de Rontil, tanto en la web como en el celular. El proveedor queda guardado en el documento; los documentos anteriores no se reprocesan al cambiar esta configuración. El ejecutable `npm run local` siempre fuerza `codex_local` y bloquea la API paga, aunque haya una clave configurada.

Desde el teléfono se conserva la app y su cámara: la foto se guarda en Supabase y espera al trabajador de una PC. No requiere estar en la misma red Wi-Fi. También se puede adjuntar una foto o PDF en Codex y pedir «cargá esta factura», o indicar la ruta de un archivo local. Codex informa el estado real y entrega el enlace para revisar. La carga y la extracción no envían la factura al ERP.

```powershell
# Detiene las instancias administradas por serve/.cmd, incluida la extracción en curso:
npm run local -- stop
# Para worker directo en una terminal: Ctrl+C.
```

No se registra un servicio de Windows ni inicio automático. Los logs están en `.local-companion/app.log` y `app.error.log`; `supervisor.json` identifica la instancia administrada. `stop` pide una parada a esa instancia, sin detener otros servidores Node del usuario.

## Reportes Zeta

Los comandos consultan Zeta y guardan archivos locales nuevos. No importan automáticamente el reporte a Supabase ni modifican el ERP. No sobrescriben archivos existentes.

```powershell
npm run local -- report sales --from 2026-08-01 --to 2026-08-31 --out '.local-companion\reports\ventas-agosto.json'
npm run local -- report stock --out '.local-companion\reports\stock.json'
npm run local -- report base-prices --article '00001' --price-base '1' --out '.local-companion\reports\precio-00001.json'
npm run local -- report stock --filters '.local-companion\filtros-stock.json' --out '.local-companion\reports\stock.csv'
```

Ejemplo de filtros: `{"DepositoCodigo":1,"LocalCodigo":1}`. Los códigos reales se eligen de la conexión; `00001`/`1` son ejemplos. Se rechazan filtros desconocidos y fechas inválidas. JSON conserva los tipos de origen y los ceros iniciales. CSV protege los identificadores y las fórmulas con un apóstrofo y agrega un archivo `.metadata.json`; para reprocesar fielmente se prefiere JSON. La evidencia registra endpoint, filtros, fechas, páginas, filas y hash. Una paginación incompleta o repetida detiene la exportación, sin entregar resultados truncados como completos.

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
