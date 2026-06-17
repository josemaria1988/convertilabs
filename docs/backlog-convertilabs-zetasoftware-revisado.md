> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# Backlog Convertilabs x Zetasoftware

Fecha original: 2026-04-18  
Revision: 2026-04-19  
Estado: backlog revisado para ejecucion specs-driven-development con Codex.

## Actualizacion 2026-04-20 - siguiente PR contable Zeta

El estado operativo avanzo mas rapido que el backlog original: ya existe integracion Zeta real, importacion read-only de CFEs/ventas y un tramo de espejo contable para Plan de Cuentas, Conceptos y Tipos de Asiento.

El siguiente PR recomendado queda documentado como fuente ejecutable en:

- `docs/pr-next-zeta-posting-templates-role-map.md`

Ese PR debe ser acotado y de valor inmediato: **plantillas base por familia operativa + role map contable Zeta**. El objetivo es que el reviewer deje de pedir "una cuenta suelta" como flujo principal y resuelva:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> roles contables
-> cuentas reales del plan Zeta
-> preview multi-linea
```

No entra todavia exportacion a Bandeja, sincronizacion de Articulos, Bancos, Cajas, Contactos masivos ni conciliacion. Esas piezas quedan como PRs separados.

Orden recomendado despues de este PR:

1. Tasas de IVA Zeta deterministicas, si todavia no quedaron materializadas.
2. Rule runner Zeta-aware.
3. Preview multi-linea consolidado.
4. Export a Bandeja de Entrada de Asientos.
5. Reconciliacion contra Zeta.
6. Aprendizaje contable reusable.

Este backlog convierte el spec `docs/convertilabs-zetasoftware-v1-specs-driven-development.md` en una secuencia ejecutable por PRs, contrastada contra el estado actual del repositorio e incorporando seis ajustes criticos antes de comenzar la integracion real:

1. protocolo explicito para testing en produccion sin sandbox;
2. decision temprana sobre contactos Zeta, vendors/customers y contraparte documental;
3. contrato de FX definido antes de persistir raw records de ventas/CFEs;
4. contrato de Bandeja de Entrada de Asientos documentado temprano aunque outbound quede diferido;
5. soporte de proyecto/operacion/cost center apoyado en `documents.cost_center_id`, que ya existe;
6. alineacion explicita con primitivas actuales del repo: `parties`, `vendors`, `customers`, `organization_cost_centers` y `document_invoice_identities`.

La recomendacion central se mantiene: implementar Zeta como un dominio aislado de integracion, con ingesta deterministica y trazabilidad fuerte, sin mezclarlo con el flujo de upload/OCR ni con los importadores de planillas que ya existen.

## 1. Lectura ejecutiva

### Objetivo del plan

Lograr que Convertilabs pueda:

- conectar una organizacion a Zetasoftware desde `Settings > Integraciones`;
- leer datos estructurados desde Zeta por REST, sin IA para parseo factual;
- persistir raw records, runs, cursors y source refs con idempotencia;
- materializar ventas y CFEs recibidos como documentos canonicos;
- conservar trazabilidad completa entre documento, raw payload, corrida y origen externo;
- resolver identidad de contraparte sin bloquear la revision humana;
- preservar desde el inicio los datos monetarios y de FX necesarios para IVA/contabilidad;
- usar la asociacion opcional existente a proyecto/operacion para margen Rontil;
- preparar una salida futura hacia Bandeja de Entrada de Asientos, inicialmente solo en dry-run/test mode;
- operar pruebas reales en produccion Zeta sin sandbox mediante un runbook estricto de identificacion, limpieza y verificacion.

### Orden recomendado

1. Estabilizar piso tecnico del repo.
2. Congelar contrato real de endpoints Zeta a partir de la coleccion Postman oficial o fuente equivalente aprobada.
3. Documentar temprano el contrato de Bandeja aunque no se implemente outbound en v1.
4. Crear base persistente, segura e idempotente para integraciones, incluyendo hooks de FX y contraparte, y documentando el uso de `documents.cost_center_id`.
5. Agregar conexion/health en Settings.
6. Agregar sync runner, raw ingestion y materializacion por dominios.
7. Integrar workflow, tax, FX, UI de trazabilidad y luego outbound dry-run.
8. Ejecutar cualquier smoke real con protocolo de test mode, cleanup y evidencia.

### Decision de arquitectura

No conviene hacer una refactorizacion grande previa de todo el producto. Conviene abrir un modulo nuevo:

```text
modules/integrations/zeta/
```

y tocar hotspots existentes solo con adaptadores chicos:

- `lib/inngest/client.ts`
- `lib/inngest/functions.ts`
- `app/app/o/[slug]/settings/page.tsx`
- `app/app/o/[slug]/settings/actions.ts`
- `modules/organizations/settings.ts`
- `modules/presentation/labels.ts`
- componentes de documentos/review donde se muestre origen externo
- `db/schema/*` y migracion canonica

### Decisiones tempranas obligatorias

Estas decisiones deben quedar cerradas antes de que Codex empiece a materializar documentos Zeta. No son detalles de implementacion tardia: condicionan el schema, el contrato de normalizadores y la compatibilidad futura con Bandeja.

#### D-001 - Testing en produccion sin sandbox

Zeta no entrega sandbox para desarrolladores externos. Por lo tanto, cualquier prueba real se ejecuta contra una empresa productiva o semi-productiva y debe seguir un protocolo formal.

Decision:

- todos los runs reales de prueba deben tener `test_mode = true`;
- todo write real a Zeta queda prohibido hasta PR-15 y solo se permite con runbook aprobado;
- los registros creados por pruebas deben tener un `test_run_key` humano y maquina;
- cada run con write debe terminar con `cleanup_status = verified` o `cleanup_status = not_required` antes de considerarse cerrado;
- no se permite dejar datos de prueba ambiguos sin prefijo, referencia o evidencia de limpieza.

Convencion base:

```text
test_run_key: CVTLAB-ZETA-TST-YYYYMMDD-HHMM-<shortid>
referencia: CVTLAB TST <test_run_key>
concepto: CVTLAB TEST <test_run_key>
tipo_asiento_prueba: TST o el codigo acordado en Zeta
proveedor_prueba: CVTLAB PRUEBA <test_run_key>
```

#### D-002 - Contactos Zeta y contraparte documental

El backlog original decia correctamente que no hay que convertir automaticamente contactos Zeta en vendors/customers core sin una decision de mapping. Pero esa decision no puede quedar para despues de PR-05, porque PR-08 y PR-11 necesitan una identidad de cliente/proveedor para que la revision humana no llegue con un hueco.

Decision v1:

- los contactos y datos comerciales de Zeta se guardan siempre como raw records;
- se normalizan a `ZetaPartyCandidate`;
- se resuelven por RUT normalizado contra `parties` como identidad neutral y contra `vendors`/`customers` cuando el rol documental lo requiera;
- si existe `party`, `vendor` o `customer` equivalente, se crea link externo;
- si no existe y el documento necesita materializarse, se crea una `party` minima local con `party_kind = external` y metadata `integration_status = external_unreviewed`, con RUT, nombre, tipo probable y source ref;
- si un flujo downstream exige `vendor_id` o `customer_id`, se permite crear una fila minima de vendor/customer marcada como `external_unreviewed` en metadata, sin defaults contables automaticos;
- la creacion de esa entidad minima no implica que el usuario haya aprobado reglas contables ni datos comerciales completos.

Resultado esperado: PR-05 termina con contrato de party mapping cerrado y PR-08/PR-11 no quedan bloqueados por identidad de contraparte.

#### D-003 - FX raw contract antes de PR-06/PR-10

PR-07 implementa la politica monetaria completa, pero PR-06 y PR-10 ya persisten raw records. Por eso, el modelo de datos de FX debe existir antes de guardar ventas o CFEs.

Decision:

- `integration_raw_records` debe tener un sobre monetario normalizado desde PR-02;
- ventas y CFEs guardan la tasa informada por Zeta tal cual viene y, si existe, su fecha/semantica;
- no se normaliza destructivamente la tasa de Zeta;
- el resolver BCU de PR-07 compara, advierte o bloquea, pero no necesita migrar raw payloads ya guardados.

Campos minimos recomendados en raw records:

```text
document_date
currency_code
source_exchange_rate
source_exchange_rate_date
source_exchange_rate_kind
source_total_amount
source_net_amount
source_tax_amount
source_monetary_json
```

#### D-004 - Contrato Bandeja documentado temprano

Outbound queda diferido, pero el contrato de Bandeja de Entrada de Asientos puede afectar como materializamos documentos, line items, impuestos, referencias y contraparte.

Decision:

- PR-01 debe documentar el endpoint de Bandeja, sus campos y su mapper conceptual;
- PR-08/PR-11 deben preservar los facts necesarios para un futuro `posting_proposals -> Bandeja Save`;
- PR-15 implementa mapper y dry-run, pero no debe descubrir en ese momento que faltan facts documentales basicos.

Facts que deben quedar disponibles desde materializacion:

- documento: fecha, moneda, tipo de cambio, tipo de comprobante, serie, numero, referencia externa;
- contraparte: RUT, nombre/contacto, rol cliente/proveedor;
- lineas: importe, IVA, total, concepto, eventual cuenta/categoria si ya se resolvio;
- contabilidad: template/posting proposal cuando exista;
- operacion: proyecto/cost center opcional;
- auditoria: raw record, sync run, payload hash.

#### D-005 - Proyecto, operacion y margen Rontil

El objetivo de Rontil incluye asociar compras y ventas a proyectos/operaciones para estimar margen. Aunque la UI de rentabilidad se implemente mas tarde, el modelo documental debe soportar esa asociacion desde PR-02/PR-08.

Decision v1:

- reutilizar `organization_cost_centers` como entidad tecnica base;
- presentar el alias de producto como `Proyecto` u `Operacion` para Rontil;
- usar `documents.cost_center_id`, que ya existe, como asociacion opcional a nivel documento;
- no crear `project_cost_center_id` mientras `documents.cost_center_id` cubra el caso;
- para splits futuros por linea, usar metadata de `document_line_items` primero o crear una columna dedicada solo cuando haya un requerimiento real de split;
- PR-14 agrega UI/calculo y reglas de margen, pero no introduce el primer soporte de schema.

Nombre recomendado de dominio:

```text
cost_center_id  # columna existente en documents, referencia a organization_cost_centers
operation_code  # metadata opcional, texto externo/manual para compatibilidad o importaciones
```

#### D-006 - Dependencia de Zeta no debe congelar todo el Tramo A

PR-01 depende de respuesta de Zetasoftware. Si la coleccion Postman tarda, llega incompleta o requiere validacion con soporte, no debe bloquear todo el avance.

Decision:

- PR-00 y PR-02 pueden avanzar en paralelo al pedido de PR-01;
- PR-02 puede mergearse despues de PR-00 aunque PR-01 siga abierto, porque es persistencia generica;
- PR-03 y PR-04 pueden avanzar parcialmente con cliente mock/fixture, pero no pueden cerrar health real ni sync real sin contrato oficial;
- ningun endpoint real se inventa para destrabar PRs.

## 2. Contraste con el estado actual

| Area | Estado actual observado | Implicancia para Zeta |
|---|---|---|
| Zeta existente | Hay normalizadores `modules/documents/zeta-sale-import.ts` y `modules/documents/zeta-purchase-import.ts`, usados por importacion de planillas. | Reutilizar criterios de normalizacion y tests como referencia, pero no meter API Zeta en `modules/documents/spreadsheet-*`. |
| Documentos | `documents` ya soporta `source_type`, `source_reference`, `external_reference`, FX, metadata, drafts y `cost_center_id`. | Sirve para materializar Zeta como documento real, pero falta una tabla especifica `document_source_refs` para trazabilidad externa fuerte. Para proyecto/operacion se debe reutilizar `documents.cost_center_id` y no crear `project_cost_center_id` salvo que aparezca un requerimiento real distinto. |
| Contrapartes | Existen `parties`, `vendors`, `customers` y `document_invoice_identities`; el kernel contable ya usa `party_id`, `vendor_id` y `customer_id` en distintas capas. | El party mapping Zeta debe usar `parties` como identidad neutral, y crear/linkear `vendors` o `customers` solo cuando el flujo documental/contable lo requiera. |
| Proyectos/cost centers | Existen `organization_cost_centers`, `documents.cost_center_id`, servicios de asignacion y UI que ya los presenta como proyectos. | PR-14 debe productizar margen y UX, no introducir de cero el campo de proyecto. PR-02 solo debe documentar/reusar este hook y, si hace falta, agregar links externos hacia cost centers. |
| Pipeline documental | Existe OCR/IA y existe importacion por planilla. | Zeta debe entrar como `external_deterministic`, sin OCR y sin IA para datos factuales. |
| Inngest | Solo hay eventos de procesamiento documental y spreadsheet import. | Zeta necesita eventos propios, typed schemas y funciones separadas. |
| Settings | `app/app/o/[slug]/settings/page.tsx` es grande y la seccion Integraciones tiene CFE email inline. | Agregar Zeta directo ahi aumentaria deuda; extraer componentes de integraciones en PR chico. |
| Integraciones | Existe `organization_cfe_email_connections` y servicio server-only para CFE email. | Buen patron de audit/settings, pero Zeta necesita credenciales cifradas, runs, cursors, raw records, test mode y cleanup evidence. |
| Exports | Hay exports genericos CSV/XML/Excel, sin layout Zeta Bandeja. | Outbound debe ir en mapper nuevo y dry-run, no acoplarlo aun al export generico como flujo final. El contrato de Bandeja igual debe documentarse en PR-01. |
| DB | Hay esquema canonico y una migracion generada, pero la verificacion de parity estaba fallando en el diagnostico previo. | No iniciar Zeta funcional hasta corregir drift de DB y RLS. PR-02 no debe mergearse sin PR-00 verde. |
| CI | La CI corre install, lint, typecheck, tests y parity opcional; no ejecuta build. | Gate 0 debe agregar `npm run build` para evitar que Zeta nazca sobre una CI incompleta. |
| Dependencias | `package.json` fija Next `15.5.14`; el diagnostico previo detecto drift local con `node_modules` en `15.5.15` y audit con vulnerabilidades. | Gate 0 debe dejar lock/deps consistentes antes de PRs funcionales. |
| Tests | Hay tests de planillas Zeta-like y tests de schema compatibility. | Buen punto de partida para normalizadores, dedupe, FX raw contract, party mapping y compatibilidad de tablas nuevas. |

## 3. Reglas no negociables

- No adivinar endpoints, wrappers ni nombres de payload Zeta. La coleccion Postman oficial o fuente equivalente aprobada manda.
- No usar SOAP.
- No llamar Zeta desde componentes client.
- No guardar secretos en UI, logs, localStorage ni metadata visible.
- No pasar documentos Zeta por OCR.
- No usar IA para interpretar payloads estructurados de Zeta.
- No pisar documentos ya `posted_final` si Zeta cambia el payload; registrar drift y requerir revision.
- No hacer posting final automatico a Zeta en v1.
- No ejecutar writes reales a Zeta sin runbook, test_run_key y responsable asignado.
- No crear datos de prueba ambiguos en Zeta sin prefijo `CVTLAB TST` o equivalente.
- No cerrar un run de write si no tiene estado de limpieza/evidencia.
- No mezclar API Zeta con `modules/documents/upload.ts`, `spreadsheet-batch-import.ts` ni los importadores de planilla.
- No abrir una refactorizacion global antes de estabilizar y aislar la integracion.
- No dejar PR-05 sin decision de mapping de contactos/contrapartes.
- No persistir raw records de documentos sin el sobre monetario minimo definido.
- No postergar la decision de uso de `documents.cost_center_id` hasta PR-14.

## 4. Backlog por PRs

## PR-00 - Gate tecnico de estabilizacion

### Objetivo

Dejar el repositorio en estado confiable antes de sumar integracion Zeta.

### Scope

- Alinear `package.json`, `package-lock.json` y `node_modules` para que Next/eslint-config-next no queden en drift.
- Revisar `npm audit` y resolver o documentar excepciones justificadas.
- Corregir drift entre `db/schema/*`, `supabase/migrations/*` y la base configurada.
- Hacer que `npm run db:verify:parity` pase en el entorno objetivo.
- Agregar `npm run build` a CI.
- Documentar el gate en un archivo corto o en la descripcion del PR.

### Archivos probables

- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- `db/schema/*`
- `supabase/migrations/*`
- `scripts/supabase/*` si el verificador necesita ajuste menor

### Tests y validacion

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run db:verify:parity
```

### Done

- CI verde incluyendo build.
- DB parity verde.
- No hay codigo Zeta funcional en este PR.
- Cualquier vulnerabilidad restante queda justificada y con ticket.

### No scope

- No crear tablas Zeta.
- No crear UI Zeta.
- No tocar materializacion documental.

## PR-01 - Contrato oficial de endpoints Zeta

### Objetivo

Transformar la coleccion Postman oficial de Zeta, o fuente equivalente aprobada por Zeta, en un contrato versionado dentro del repo antes de escribir clientes funcionales.

### Scope

- Incorporar un artefacto documental derivado de la coleccion oficial, sin secretos.
- Registrar endpoints exactos, wrappers request/response, campos de paginacion, codigos de error y metodos disponibles.
- Definir claves externas por stream:
  - maestros;
  - ventas;
  - ventas enriquecidas/PDF;
  - CFEs recibidos;
  - Bandeja de Entrada de Asientos.
- Documentar el contrato de Bandeja aunque outbound quede para PR-15:
  - metodo `Save` o equivalente;
  - metodo `Query` o equivalente;
  - metodo `Load` si aplica;
  - metodo `Delete` si aplica;
  - campos requeridos y opcionales;
  - semantica de `AsientoId`, `RegistroId`, `Referencia`, `TipoAsiento`, moneda, tipo de cambio, RUT/contacto, cuenta, importe, Debe/Haber, centro de costos y literal tributario;
  - que campos vendran del documento, de line items, de maestros, de posting proposal o de defaults de integracion.
- Identificar campos monetarios/FX disponibles en cada stream documental.
- Crear `endpoint-registry.ts` solo si los nombres exactos ya estan confirmados.
- Marcar explicitamente endpoints bloqueados por falta de certeza.
- Crear una matriz `source facts -> future Bandeja fields` para que PR-08/PR-11 materialicen de forma compatible.

### Archivos probables

- `docs/zetasoftware-endpoints-contract.md`
- `docs/zetasoftware-bandeja-contract-notes.md`
- `modules/integrations/zeta/client/endpoint-registry.ts`
- `modules/integrations/zeta/contracts/*`
- `tests/zeta-endpoint-registry.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
```

### Done

- Cada endpoint usado por PRs posteriores tiene nombre, metodo, wrapper y payload ejemplo.
- No hay endpoint inventado.
- Se sabe que API se puede usar para `test connection`.
- El contrato de Bandeja queda documentado, aunque se marque `not_implemented` para v1.
- La matriz de compatibilidad futura con Bandeja queda versionada.
- Los campos de FX disponibles por stream quedan identificados.

### No scope

- No conectar contra produccion.
- No persistir credenciales.
- No hacer sync.
- No implementar outbound.

### Bloqueador y mitigacion

Este PR no se puede cerrar sin la coleccion Postman oficial o una fuente equivalente aprobada por Zeta.

Mitigacion para no congelar el proyecto:

- PR-00 puede avanzar y cerrar sin PR-01.
- PR-02 puede desarrollarse en paralelo como persistencia generica, pero no debe inventar endpoints.
- PR-03/PR-04 pueden avanzar con mocks/fixtures, pero no cerrar health real ni sync real.
- PR-05 en adelante requieren contrato real para los streams que toquen.

## PR-02 - Persistencia base de integraciones

### Objetivo

Agregar el modelo persistente generico para proveedores externos, preparado para Zeta pero no acoplado a una sola API.

### Scope

- Crear tablas:
  - `organization_integration_connections`;
  - `integration_sync_runs`;
  - `integration_sync_cursors`;
  - `integration_raw_records`;
  - `document_source_refs`;
  - `integration_entity_links` para vincular entidades externas con entidades core locales, incluyendo contacts/vendors/customers/proyectos si aplica;
  - `integration_document_links` solo si queda realmente justificado y no alcanza `document_source_refs`.
- Agregar indices de idempotencia:
  - `(organization_id, provider)`;
  - `(organization_id, provider, stream, cursor_key)`;
  - `(organization_id, provider, entity_type, external_key)`;
  - `(organization_id, provider, external_entity_type, external_key)`;
  - `(organization_id, provider, local_entity_type, local_entity_id)` si se crea `integration_entity_links`.
- Agregar RLS y policies con el mismo criterio de miembros/roles del resto del repo.
- Crear repositorios server-only para conexiones, runs, cursors, raw records, entity links y source refs.
- Crear helper de cifrado/descifrado de credenciales con fingerprint no reversible.
- Registrar audit events base.
- Agregar campos de test/cleanup a runs y, si aplica, raw records/outbound attempts:
  - `test_mode`;
  - `test_run_key`;
  - `cleanup_status` con valores como `not_required`, `pending`, `verified`, `failed`;
  - `cleanup_required_by`;
  - `cleanup_verified_at`;
  - `cleanup_evidence_json`.
- Agregar sobre monetario minimo a `integration_raw_records`:
  - `document_date`;
  - `currency_code`;
  - `source_exchange_rate`;
  - `source_exchange_rate_date`;
  - `source_exchange_rate_kind`;
  - `source_total_amount`;
  - `source_net_amount`;
  - `source_tax_amount`;
  - `source_monetary_json`.
- Documentar el uso de proyecto/cost center con el schema actual:
  - reutilizar `documents.cost_center_id`, ya existente, para proyecto/operacion a nivel documento;
  - no agregar `project_cost_center_id` en PR-02;
  - no agregar campo de cost center en `document_line_items` salvo que el alcance apruebe splits por linea;
  - guardar `operation_code` inicialmente en metadata de documento/source ref, y promoverlo a columna solo si sera filtro o clave de integracion.

### Archivos probables

- `db/schema/07_integrations_and_audit.sql`
- `db/schema/04_documents.sql` solo si parity demuestra que falta `cost_center_id` en el entorno objetivo
- `supabase/migrations/*`
- `modules/integrations/zeta/repositories/connection-repo.ts`
- `modules/integrations/zeta/repositories/sync-run-repo.ts`
- `modules/integrations/zeta/repositories/raw-record-repo.ts`
- `modules/integrations/zeta/repositories/source-ref-repo.ts`
- `modules/integrations/zeta/repositories/entity-link-repo.ts`
- `modules/integrations/zeta/services/credentials-service.ts`
- `tests/zeta-integration-persistence.test.cjs`
- `tests/*schema-compat*.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run db:verify:parity
```

### Done

- Tablas nuevas en esquema canonico y migracion.
- RLS habilitado.
- Repositorios no exponen service-role fuera del modulo.
- Secretos se guardan cifrados y se muestran solo masked.
- `integration_raw_records` puede persistir el contrato monetario/FX sin esperar PR-07.
- Existe forma de vincular una entidad externa Zeta con una entidad local o una party shell en `parties`.
- Queda documentado y testeado que proyecto/operacion usa `documents.cost_center_id`.
- Runs reales de prueba pueden marcarse y auditarse con `test_mode`, `test_run_key` y cleanup.

### No scope

- No UI.
- No llamadas a Zeta.
- No materializar documentos.
- No resolver la UI de proyectos/margen.

## PR-03 - Settings: conexion Zeta y health check

### Objetivo

Permitir guardar una conexion Zeta por organizacion y probarla desde `Settings > Integraciones`.

### Scope

- Crear componentes:
  - `components/settings/integrations/zetasoftware-connection-card.tsx`;
  - `components/settings/integrations/zetasoftware-sync-panel.tsx` en modo placeholder;
  - `components/settings/integrations/zetasoftware-run-history.tsx` en modo lectura vacia.
- Extraer, si conviene, parte de la UI actual de CFE email para que `settings/page.tsx` no siga creciendo.
- Agregar server actions para guardar credenciales y ejecutar `test connection`.
- Usar el endpoint de health definido en PR-01 cuando exista.
- Permitir modo mock/fixture en desarrollo local sin credenciales reales.
- Registrar audit events:
  - `zeta_connection_saved`;
  - `zeta_connection_tested`.
- Mostrar estados:
  - disconnected;
  - connected;
  - paused;
  - error.

### Archivos probables

- `app/app/o/[slug]/settings/page.tsx`
- `app/app/o/[slug]/settings/actions.ts`
- `modules/organizations/settings.ts`
- `modules/integrations/zeta/services/connection-service.ts`
- `modules/integrations/zeta/services/zeta-health-service.ts`
- `components/settings/integrations/*`
- `tests/zeta-connection-service.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Se guarda conexion por organizacion.
- `test connection` devuelve exito o error claro.
- La UI nunca muestra secreto completo.
- Los errores de Zeta quedan normalizados.
- El modo mock permite avanzar UI/servicios sin pegarle a Zeta.
- El health real no se habilita sin endpoint confirmado por PR-01.

### No scope

- No sync de datos.
- No runs/cursors visibles con datos reales.
- No writes a Zeta.

## PR-04 - Sync runner base e Inngest

### Objetivo

Crear la infraestructura de ejecucion de syncs sin implementar aun streams de negocio completos.

### Scope

- Agregar eventos Inngest typed para:
  - `integrations/zeta.sync.requested`;
  - `integrations/zeta.sync-window.requested` si hace falta granularidad.
- Agregar funcion Inngest propia para Zeta.
- Crear `sync-runner.ts` con:
  - lock/logico por organizacion + stream;
  - apertura/cierre de run;
  - counters;
  - manejo de errores;
  - reintentos controlados;
  - modo manual/backfill/test.
- Crear `cursors.ts` con lectura/escritura idempotente.
- Agregar UI minima para disparar sync manual deshabilitada o limitada a streams mock/dry-run.
- Soportar `test_mode` y `test_run_key` a nivel run desde el runner.
- Registrar `cleanup_status = not_required` por defecto en runs read-only.

### Archivos probables

- `lib/inngest/client.ts`
- `lib/inngest/functions.ts`
- `modules/integrations/zeta/inngest-function.ts`
- `modules/integrations/zeta/sync/sync-runner.ts`
- `modules/integrations/zeta/sync/cursors.ts`
- `modules/integrations/zeta/repositories/*`
- `tests/zeta-sync-runner.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Una corrida mock crea `integration_sync_runs` y la cierra correctamente.
- Un error deja status failed/partial y audit log.
- No se duplica una corrida concurrente del mismo stream.
- Un run read-only real queda marcado con `cleanup_status = not_required`.
- Un run test puede correlacionarse por `test_run_key`.

### No scope

- No fetch real de ventas.
- No fetch real de CFEs.
- No materializacion.

## PR-05 - Sync de maestros minimos y party mapping

### Objetivo

Traer catalogos base necesarios para interpretar ventas/CFEs y cerrar la decision de mapping de contactos/contrapartes antes de materializar documentos.

### Prerequisito explicito

Antes de cerrar PR-05 debe quedar aprobado `D-002 - Contactos Zeta y contraparte documental`.

Decision v1 que debe implementarse o documentarse como contrato:

- Zeta contacts/datos comerciales se guardan como raw records.
- Se normalizan a `ZetaPartyCandidate`.
- Se matchean por RUT normalizado primero contra `parties` y luego contra `vendors`/`customers` cuando el rol documental lo requiera.
- Si hay match, se crea `integration_entity_links` hacia la entidad local correspondiente.
- Si no hay match y un documento necesita contraparte, se permite crear una `party` minima en estado logico `external_unreviewed` via metadata.
- Si el flujo actual exige `vendor_id` o `customer_id`, se permite crear vendor/customer minimo tambien marcado `external_unreviewed`, sin default account ni reglas contables automaticas.
- La party shell no equivale a vendor/customer contable completamente aprobado.

### Scope

- Implementar cliente REST para endpoints de maestros confirmados.
- Sincronizar como raw records:
  - locales;
  - comprobantes;
  - tipos de CFE;
  - contactos;
  - datos comerciales cliente/proveedor;
  - tasas de IVA si la API lo permite.
- Crear normalizadores de maestros que produzcan contratos internos estables.
- Crear normalizador `ZetaPartyCandidate`.
- Implementar `party-resolver` o contrato equivalente:
  - normalizacion de RUT;
  - match contra `parties`, `vendors` y `customers`;
  - creacion de link externo;
  - creacion controlada de party shell en `parties`;
  - deteccion de conflictos de nombre/RUT;
  - salida `matched`, `external_shell_required`, `conflict`, `missing`.
- Guardar payload hash y detectar cambios.
- Exponer contadores por stream en panel/run history.

### Archivos probables

- `modules/integrations/zeta/client/rest-client.ts`
- `modules/integrations/zeta/client/auth.ts`
- `modules/integrations/zeta/client/errors.ts`
- `modules/integrations/zeta/contracts/masters.ts`
- `modules/integrations/zeta/contracts/party.ts`
- `modules/integrations/zeta/normalize/master-normalizer.ts`
- `modules/integrations/zeta/normalize/party-normalizer.ts`
- `modules/integrations/zeta/services/party-resolver.ts`
- `modules/integrations/zeta/sync/sync-masters.ts`
- `tests/zeta-master-normalizer.test.cjs`
- `tests/zeta-party-resolver.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
```

### Done

- Rerun no duplica raw records.
- Cambios actualizan `payload_hash`, `last_seen_at` y counters.
- El panel muestra ultimo run y contadores.
- Existe contrato estable de `ZetaPartyCandidate`.
- Existe decision cerrada y testeada para contraparte documental.
- PR-08 y PR-11 pueden materializar documentos sin hueco de identidad de cliente/proveedor.

### No scope

- No crear reglas contables por proveedor.
- No aprobar automaticamente vendor/customer como definitivo.
- No materializar documentos.

## PR-06 - Ventas: ingesta raw desde Comprobantes por Cliente

### Objetivo

Traer ventas estructuradas desde Zeta y persistirlas como raw records idempotentes, sin crear documentos todavia.

### Scope

- Implementar fetch por Mes/Anio y `ClienteCodigo=""` para todos los clientes.
- Implementar paginacion y rate/error handling segun contrato real.
- Definir `external_key` estable por comprobante.
- Guardar raw records `sales_voucher`.
- Persistir el sobre monetario/FX definido en PR-02:
  - fecha del documento;
  - moneda;
  - tasa Zeta raw;
  - fecha/semantica de la tasa si existe;
  - neto, IVA, total;
  - breakdown monetario raw.
- Persistir datos de contraparte suficientes para PR-05/PR-08:
  - RUT cliente si existe;
  - codigo Zeta de cliente/contacto;
  - nombre;
  - link externo si ya fue resuelto.
- Normalizar a contrato interno `ZetaSalesDocumentCandidate`.
- Detectar duplicados por external key y hash humano preliminar.
- Registrar counters:
  - fetched;
  - raw_upserted;
  - unchanged;
  - changed;
  - duplicate_suspected;
  - failed.

### Archivos probables

- `modules/integrations/zeta/contracts/sales.ts`
- `modules/integrations/zeta/normalize/sales-normalizer.ts`
- `modules/integrations/zeta/sync/sync-sales-documents.ts`
- `modules/integrations/zeta/repositories/raw-record-repo.ts`
- `tests/zeta-sales-normalizer.test.cjs`
- `tests/zeta-sales-sync.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
```

### Done

- Se puede traer mes actual y mes anterior en modo read-only.
- Rerun no duplica.
- No se crea ningun `documents` en este PR.
- Quedan raw records auditables.
- Cada raw record de venta tiene sobre monetario/FX queryable.
- No sera necesario migrar payloads de PR-06 cuando cierre PR-07.

### No scope

- No Facturas de Clientes enrichment.
- No PDF URL.
- No workflow documental.

## PR-07 - Politica monetaria y FX para Zeta

### Objetivo

Implementar como documentos Zeta manejan moneda, tasa origen y tasa oficial antes de materializarlos, sobre el raw FX contract ya definido en PR-02 y usado por PR-06/PR-10.

### Scope

- Reusar/adaptar servicios actuales de FX si existen para documentos e importaciones.
- Definir contrato final de resolucion:
  - moneda documento;
  - tasa informada por Zeta;
  - fecha de tasa origen;
  - tasa BCU oficial;
  - fecha BCU usada;
  - tolerancia;
  - warning/blocker.
- Implementar resolver:
  - moneda base UYU sin tasa;
  - moneda extranjera con tasa Zeta y BCU;
  - moneda extranjera sin tasa Zeta pero con BCU;
  - moneda extranjera sin BCU disponible.
- Definir campos a poblar en `documents` y `document_drafts`.
- Agregar pruebas que consuman fixtures raw generados con el contrato de PR-06/PR-10.
- Prohibir migraciones correctivas de raw records salvo bug real; el objetivo es que el contrato temprano haya sido suficiente.

### Archivos probables

- `modules/integrations/zeta/materialize/fx-policy.ts`
- `modules/documents/spreadsheet-fx-resolution.ts` como referencia, no como destino de logica Zeta si no corresponde
- `modules/tax/*` o `modules/imports/*` si ya centralizan FX
- `tests/zeta-fx-policy.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
```

### Done

- Ningun documento Zeta multi-moneda puede quedar con tasa inventada.
- Diferencias Zeta vs BCU generan warning segun tolerancia.
- Falta de tasa critica bloquea materializacion o deja documento en estado revisable, segun decision aprobada.
- Los raw records de PR-06/PR-10 ya contienen datos suficientes para resolver FX sin migracion.

### No scope

- No crear documentos todavia salvo fixtures unitarios.
- No resolver UX final de badges.

## PR-08 - Ventas: materializacion canonica

### Objetivo

Convertir ventas raw de Zeta en documentos Convertilabs de primera clase, preservando contraparte, FX y compatibilidad futura con Bandeja.

### Scope

- Crear `materialize-sales-document.ts`.
- Insertar/actualizar:
  - `documents`;
  - `document_drafts`;
  - `document_draft_steps`;
  - `document_line_items`;
  - `document_invoice_identities`;
  - `document_source_refs`.
- Usar `source_type = "zeta_api"` o nombre equivalente acordado.
- Usar `factual_trust_mode = "external_deterministic"` en source refs/metadata.
- Resolver contraparte con el contrato de PR-05:
  - match por RUT;
  - link externo;
  - party shell en `parties` si corresponde;
  - blocker si hay conflicto no seguro.
- Aplicar FX policy de PR-07.
- Poblar o dejar nullable el hook de proyecto/cost center:
  - `cost_center_id` si hay regla o mapping;
  - null si aun requiere asignacion humana;
  - `operation_code` en metadata si viene de Zeta o del usuario.
- Preservar facts necesarios para futuro Bandeja:
  - fecha, moneda, tipo de cambio;
  - RUT/contacto;
  - referencia documental;
  - line items y tax breakdown;
  - source raw/run/hash.
- Definir workflow inicial:
  - ready for review si datos minimos estan completos;
  - blocked si falta dato critico;
  - duplicate si identidad exacta ya existe;
  - drift pending review si el origen cambia luego de materializado.
- No pasar por OCR ni `document_processing_runs` de IA.

### Archivos probables

- `modules/integrations/zeta/materialize/materialize-sales-document.ts`
- `modules/integrations/zeta/materialize/source-change-policy.ts`
- `modules/integrations/zeta/materialize/bandeja-compatibility-facts.ts`
- `modules/documents/review.ts`
- `modules/presentation/labels.ts`
- `tests/zeta-sales-materialization.test.cjs`
- `tests/document-review-schema-compat.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Una venta Zeta aparece en Documents/Review.
- Line items y montos cuadran.
- La identidad de factura evita duplicados.
- El documento conserva link a raw record y run.
- No hay hueco de identidad de cliente.
- El documento conserva datos suficientes para futuro mapper de Bandeja.
- El campo de proyecto/cost center existe y puede quedar null sin romper flujo.

### No scope

- No PDF URL.
- No outbound.
- No vista de margen avanzada.

## PR-09 - Ventas: enriquecimiento y PDF bajo demanda

### Objetivo

Mejorar la usabilidad de ventas Zeta sin hacer mas pesado el sync base.

### Scope

- Implementar endpoints/servicios de Facturas de Clientes solo si estan confirmados por PR-01:
  - `QueryVentas`;
  - `VentasDetalladas`;
  - `VentaDetallada`;
  - `URLPDF`.
- Enriquecer raw records existentes con datos adicionales sin romper idempotencia.
- Resolver `URLPDF` bajo demanda, no como fetch masivo si Zeta no lo recomienda.
- Guardar `source_pdf_url` o metadata equivalente con expiracion/refresh si aplica.
- Registrar audit event `zeta_pdf_url_resolved`.

### Archivos probables

- `modules/integrations/zeta/services/pdf-url-service.ts`
- `modules/integrations/zeta/sync/sync-sales-enrichment.ts`
- `modules/integrations/zeta/contracts/sales-enrichment.ts`
- `components/documents/external-source-card.tsx`
- `tests/zeta-sales-enrichment.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- La UI puede ofrecer "Abrir PDF en Zeta" si existe URL.
- Fallo de PDF no rompe el documento base.
- No se cachea una URL expirada como verdad permanente.

### No scope

- No descargar binarios masivamente.
- No OCR sobre PDF Zeta.

## PR-10 - CFEs recibidos: ingesta raw y detalle

### Objetivo

Traer CFEs recibidos desde Zeta como raw records, con summary + detail, sin materializacion aun.

### Scope

- Implementar `CFERECIBIDOS` paginado/listado segun contrato real.
- Implementar `CFERECIBIDODETALLE` para detalle por comprobante.
- Definir `external_key` fuerte:
  - RUT emisor;
  - tipo CFE;
  - serie;
  - numero;
  - fecha/monto si hace falta como respaldo.
- Guardar raw records:
  - `received_cfe`;
  - `received_cfe_detail`.
- Persistir el sobre monetario/FX definido en PR-02:
  - fecha del documento;
  - moneda;
  - tasa Zeta raw;
  - fecha/semantica de la tasa si existe;
  - neto, IVA, total;
  - breakdown monetario raw.
- Persistir datos de contraparte suficientes para PR-05/PR-11:
  - RUT emisor;
  - codigo/contacto Zeta si existe;
  - nombre;
  - link externo si ya fue resuelto.
- Normalizar a `ZetaReceivedCfeCandidate`.
- Registrar estados del CFE y warnings de inconsistencia summary/detail.

### Archivos probables

- `modules/integrations/zeta/contracts/received-cfe.ts`
- `modules/integrations/zeta/normalize/received-cfe-normalizer.ts`
- `modules/integrations/zeta/sync/sync-received-cfes.ts`
- `tests/zeta-received-cfe-normalizer.test.cjs`
- `tests/zeta-received-cfe-sync.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
```

### Done

- Se pueden traer CFEs recibidos por rango.
- Rerun no duplica.
- Summary/detail quedan vinculados.
- Inconsistencias no se silencian.
- Cada raw record de CFE recibido tiene sobre monetario/FX queryable.
- No sera necesario migrar payloads de PR-10 cuando cierre PR-07.

### No scope

- No crear documentos de compra todavia.
- No resolver binarios/PDF si no esta confirmado.

## PR-11 - CFEs recibidos: materializacion canonica

### Objetivo

Convertir CFEs recibidos raw en documentos de compra dentro del flujo normal, preservando contraparte, FX, proyecto y compatibilidad futura con Bandeja.

### Scope

- Crear `materialize-received-cfe.ts`.
- Poblar:
  - `documents`;
  - `document_drafts`;
  - `document_draft_steps`;
  - `document_line_items`;
  - `document_invoice_identities`;
  - `document_source_refs`.
- Aplicar dedupe fuerte por RUT/tipo/serie/numero.
- Resolver contraparte proveedor con el contrato de PR-05:
  - match por RUT;
  - link externo;
  - party shell en `parties` si corresponde;
  - blocker si hay conflicto no seguro.
- Aplicar FX policy de PR-07.
- Poblar o dejar nullable el hook de proyecto/cost center:
  - `cost_center_id` si hay regla o mapping;
  - null si requiere asignacion humana;
  - `operation_code` en metadata si viene de Zeta o del usuario.
- Preservar facts necesarios para futuro Bandeja:
  - fecha, moneda, tipo de cambio;
  - RUT/contacto;
  - referencia documental;
  - line items y tax breakdown;
  - source raw/run/hash.
- Mapear estados de CFE a estado interno y warnings.
- Bloquear si hay datos fiscales criticos faltantes.
- Preparar datos para tax deterministic preview.

### Archivos probables

- `modules/integrations/zeta/materialize/materialize-received-cfe.ts`
- `modules/integrations/zeta/materialize/source-change-policy.ts`
- `modules/integrations/zeta/materialize/bandeja-compatibility-facts.ts`
- `modules/documents/review.ts`
- `tests/zeta-received-cfe-materialization.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Un CFE recibido aparece como documento de compra.
- Dedupe exacto funciona aunque el documento haya entrado antes por upload manual.
- Drift de origen no pisa finalizados.
- No hay hueco de identidad de proveedor.
- El documento conserva datos suficientes para futuro mapper de Bandeja.
- El campo de proyecto/cost center existe y puede quedar null sin romper flujo.

### No scope

- No outbound.
- No vista de margen avanzada.

## PR-12 - Workflow, clasificacion y tax para origen Zeta

### Objetivo

Hacer que documentos Zeta participen correctamente del flujo contable/fiscal existente.

### Scope

- Integrar documentos Zeta al reviewer actual, sin crear un segundo reviewer.
- Ajustar el estado inicial de pasos documentales para hechos estructurados.
- Hacer que classification/tax runner reciba factual facts desde Zeta.
- Explicar en UI:
  - dato de Zeta;
  - override local;
  - warning fiscal;
  - bloqueo por dato critico.
- Verificar que posting preview multi-linea use el mismo kernel que documentos manuales.
- Verificar que el proyecto/cost center nullable no rompa reglas existentes.
- Agregar tests de reglas para documentos Zeta.

### Archivos probables

- `modules/documents/review.ts`
- `modules/documents/workflow-state.ts`
- `modules/accounting/*`
- `modules/tax/*`
- `modules/explanations/*`
- `tests/zeta-document-workflow.test.cjs`
- `tests/zeta-tax-classification.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Documento Zeta puede llegar a review sin OCR.
- Tax preview se calcula de forma deterministica.
- Usuario puede corregir localmente sin perder trazabilidad del origen.
- La UI no recalcula verdad productiva.
- Proyecto/cost center queda disponible para asignacion sin forzar UI de margen.

### No scope

- No aprendizaje automatico nuevo salvo que use mecanismos existentes.
- No posting final a Zeta.

## PR-13 - UI de trazabilidad documental Zeta

### Objetivo

Hacer visible el origen Zeta en listados y detalle documental, sin duplicar flujo.

### Scope

- Crear:
  - `components/documents/source-badge.tsx`;
  - `components/documents/external-source-card.tsx`;
  - `components/documents/zeta-document-facts-card.tsx`.
- Mostrar:
  - origen `Zeta ventas` o `Zeta CFE recibido`;
  - run id/fecha;
  - external key;
  - estado de drift;
  - PDF URL si esta disponible;
  - factual trust mode;
  - estado de contraparte `matched`, `external shell`, `conflict` si aplica;
  - proyecto/cost center si ya fue asignado o estado `sin proyecto` si falta.
- Agregar labels en `modules/presentation/labels.ts`.
- Mantener layout estable y sin tarjetas anidadas innecesarias.

### Archivos probables

- `components/documents/source-badge.tsx`
- `components/documents/external-source-card.tsx`
- `components/documents/zeta-document-facts-card.tsx`
- `components/documents/*`
- `app/app/o/[slug]/documents/*`
- `modules/presentation/labels.ts`
- `tests/presentation-labels.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- El usuario distingue documentos manuales, planilla y Zeta.
- Un drift pendiente se ve claramente.
- La UI no muestra payload crudo ni secretos.
- La UI muestra si el documento esta sin proyecto sin bloquear el flujo principal.

### No scope

- No cambiar motor contable.
- No sumar dashboards amplios todavia.

## PR-14 - Proyectos y margen simple para piloto Rontil

### Objetivo

Cubrir la necesidad operativa de asociar compras y ventas por proyecto/obra/pedido sin convertir Convertilabs en ERP.

### Scope

- Reusar `organization_cost_centers` si alcanza semantica y UI.
- Si no alcanza, definir un alias de producto `Proyecto` sobre cost centers antes de crear tabla nueva.
- Usar `documents.cost_center_id` y los servicios actuales de cost centers.
- Permitir asociar documentos Zeta/manuales a proyecto.
- Permitir asignacion manual o correccion del proyecto en reviewer/document detail.
- Calcular margen bruto simple por proyecto:
  - ventas;
  - compras/costos;
  - impuestos segun criterio aprobado;
  - moneda base.
- Mostrar vista basica o card en documentos/proyecto.

### Archivos probables

- `modules/cost-centers/*`
- `components/settings/cost-centers-settings-panel.tsx`
- `modules/documents/review.ts`
- `modules/accounting/*read-model*`
- `tests/project-margin.test.cjs`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Una venta y una compra pueden compartir proyecto.
- Se ve margen bruto basico.
- No se modelan inventario, stock, ordenes ni ERP completo.
- PR-14 no introduce de cero el campo de proyecto en documentos; reutiliza `documents.cost_center_id`, ya existente.

### No scope

- No planificacion de obra.
- No control de stock.
- No rentabilidad avanzada.

## PR-15 - Outbound Bandeja: mapper, dry-run y smoke controlado

### Objetivo

Preparar salida futura hacia Zeta sin hacer posting final automatico y con protocolo seguro para el primer write real controlado.

### Scope

- Crear mapper `posting_proposals -> Bandeja Save`.
- Agregar `outbound/bandeja-mapper.ts`.
- Agregar `outbound/bandeja-test-mode.ts`.
- Crear dry-run que produce payload valido y auditable.
- Definir idempotency key por documento/posting proposal.
- Implementar `test_mode` obligatorio para cualquier write experimental.
- Forzar convenciones de identificacion en payload de prueba:
  - `TipoAsiento = TST` o codigo acordado;
  - `Referencia = CVTLAB TST <test_run_key>`;
  - `Concepto = CVTLAB TEST <test_run_key>` si el endpoint lo permite;
  - `AsientoId` deterministico por run/documento;
  - `RUT`/`Contacto` solo si el caso de prueba lo requiere.
- Registrar audit events:
  - `zeta_bandeja_save_attempted`;
  - `zeta_bandeja_save_succeeded`;
  - `zeta_bandeja_save_failed`;
  - `zeta_bandeja_dry_run_created`;
  - `zeta_bandeja_cleanup_marked`;
  - `zeta_bandeja_cleanup_verified`.
- Documentar runbook manual para smoke test controlado.
- Agregar checklist de cleanup antes de habilitar cualquier write real.

### Archivos probables

- `modules/integrations/zeta/outbound/bandeja-mapper.ts`
- `modules/integrations/zeta/outbound/bandeja-test-mode.ts`
- `modules/integrations/zeta/outbound/bandeja-cleanup-tracker.ts`
- `modules/exports/*` solo si se decide exponerlo como export/dry-run
- `tests/zeta-bandeja-mapper.test.cjs`
- `docs/zeta-bandeja-runbook.md`
- `docs/zeta-production-smoke-runbook.md`

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Se puede generar payload Bandeja sin enviar.
- El payload es estable e idempotente.
- No hay escritura masiva automatica a Zeta.
- Existe runbook de limpieza antes de cualquier write real.
- Cualquier write real requiere `test_mode=true`, `test_run_key` y responsable.
- El sistema registra evidencia de cleanup o marca explicitamente que no aplica.

### No scope

- No posting final automatico en Zeta.
- No limpieza destructiva automatizada sin aprobacion humana.
- No scheduler de outbound.

## PR-16 - Operabilidad, monitoreo y rollout piloto

### Objetivo

Dejar la integracion lista para operar con Rontil o piloto equivalente con controles visibles.

### Scope

- Agregar panel de historial de corridas con filtros por stream/status.
- Agregar resumen de errores recurrentes.
- Agregar comandos/scripts de smoke controlados si son seguros.
- Documentar runbook:
  - conectar;
  - sync maestros;
  - sync ventas;
  - sync CFEs;
  - revisar documentos bloqueados;
  - resolver drift;
  - probar dry-run Bandeja;
  - ejecutar write smoke si y solo si esta aprobado;
  - verificar limpieza.
- Definir cadencia recomendada:
  - manual;
  - diaria;
  - mensual/backfill;
  - limpieza post-smoke inmediata;
  - auditoria semanal de runs test durante piloto.
- Agregar checklist de soporte y datos necesarios por organizacion.
- Agregar vista o reporte de runs `test_mode=true` no cerrados/limpios.

### Archivos probables

- `components/settings/integrations/zetasoftware-run-history.tsx`
- `modules/integrations/zeta/services/*`
- `docs/zeta-operability-runbook.md`
- `scripts/*` solo si no requieren secretos ni writes peligrosos

### Tests y validacion

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Done

- Hay runbook operativo.
- El usuario puede entender ultimo estado de cada stream.
- Soporte puede diagnosticar sin acceder a secretos.
- Hay forma visible de encontrar pruebas reales pendientes de cleanup.
- No queda ningun run de write smoke sin responsable y estado de limpieza.

### No scope

- No automatizar procesos destructivos.
- No prometer SLA sin monitoreo externo.

## 5. Dependencias entre PRs

El backlog ya no debe interpretarse como una cadena estrictamente lineal. Hay dependencias duras, pero tambien trabajo que puede avanzar en paralelo para evitar que la respuesta de Zetasoftware bloquee todo.

### Carril A - Estabilizacion y persistencia generica

```text
PR-00
  -> PR-02
```

- PR-00 debe cerrar antes de mergear PR-02.
- PR-02 puede disenarse/draftearse mientras PR-01 espera respuesta de Zeta.
- PR-02 no debe incluir endpoints ni suposiciones Zeta.

### Carril B - Contrato externo Zeta

```text
PR-01
  -> PR-03 health real
  -> PR-05 maestros reales
  -> PR-06 ventas reales
  -> PR-10 CFEs reales
  -> PR-15 outbound real/dry-run compatible
```

- PR-01 bloquea cualquier llamada real a Zeta.
- PR-01 no bloquea mocks, fixtures ni persistencia generica.

### Carril C - UI/runner con mocks

```text
PR-02
  -> PR-03 mock/fixture
    -> PR-04 mock/fixture
```

- PR-03 y PR-04 pueden avanzar parcialmente con cliente mock.
- No pueden cerrar la parte real hasta que PR-01 confirme endpoint de health y wrappers.

### Carril D - Ingesta y materializacion

```text
PR-04 + PR-01
  -> PR-05
  -> PR-06
  -> PR-07
  -> PR-08

PR-04 + PR-01
  -> PR-10
  -> PR-07
  -> PR-11

PR-08 + PR-11
  -> PR-12
  -> PR-13
```

Notas:

- PR-05 debe cerrar decision de party mapping antes de PR-08/PR-11.
- PR-06 y PR-10 deben usar el raw FX contract de PR-02, aunque el resolver completo cierre en PR-07.
- PR-07 debe cerrar antes de materializar documentos multi-moneda.
- PR-08 y PR-11 deben conservar facts compatibles con Bandeja.

### Carril E - Proyecto, outbound y operabilidad

```text
PR-02
  -> documentar/reusar documents.cost_center_id
    -> PR-08/PR-11 lo preservan
      -> PR-14
        -> PR-15
          -> PR-16
```

Notas:

- PR-14 no debe introducir por primera vez el campo de proyecto; debe usar `documents.cost_center_id` y los servicios actuales.
- PR-15 no debe cerrarse antes de tener claro el modelo de posting proposals, contrato Bandeja y runbook manual.
- PR-16 cierra operabilidad y monitoreo, no agrega comportamiento destructivo.

## 6. Modelo de datos recomendado

### `organization_integration_connections`

Una fila por organizacion/proveedor.

Campos clave:

- `organization_id`
- `provider = "zetasoftware"`
- `mode = "read_only" | "read_write"`
- `status`
- `test_mode`
- `config_json`
- `encrypted_credentials`
- `credentials_fingerprint`
- `last_connection_test_at`
- `last_connection_test_ok`
- `last_error`

### `integration_sync_runs`

Una fila por corrida.

Streams iniciales:

- `masters`
- `sales_documents`
- `sales_enrichment`
- `received_cfes`
- `outbound_bandeja`

Campos adicionales recomendados para pruebas sin sandbox:

- `test_mode`
- `test_run_key`
- `initiated_by_user_id`
- `cleanup_status`
- `cleanup_required_by`
- `cleanup_verified_at`
- `cleanup_verified_by_user_id`
- `cleanup_evidence_json`

### `integration_sync_cursors`

Checkpoint por stream y ventana.

Ejemplos:

- `sales:2026-04`
- `received_cfes:2026-04-01:2026-04-30`
- `masters:contacts`

### `integration_raw_records`

Fuente de verdad del origen.

Entidad inicial:

- `sales_voucher`
- `sales_invoice_detail`
- `received_cfe`
- `received_cfe_detail`
- `contact`
- `commercial_data`
- `vat_rate`
- `voucher_type`

Campos minimos recomendados:

- `organization_id`
- `provider`
- `stream`
- `entity_type`
- `external_key`
- `external_version_key` si Zeta expone version o fecha de modificacion
- `payload_json`
- `payload_hash`
- `first_seen_at`
- `last_seen_at`
- `last_sync_run_id`
- `test_mode`
- `test_run_key`

Sobre monetario/FX queryable:

- `document_date`
- `currency_code`
- `source_exchange_rate`
- `source_exchange_rate_date`
- `source_exchange_rate_kind`
- `source_total_amount`
- `source_net_amount`
- `source_tax_amount`
- `source_monetary_json`

### `integration_entity_links`

Relacion generica entre entidad externa y entidad local.

Uso inicial:

- contacto Zeta -> `parties` como identidad neutral;
- contacto Zeta -> `vendors`/`customers` cuando el rol documental o contable lo requiera;
- contacto Zeta -> party shell en `parties` con metadata `integration_status = external_unreviewed`;
- eventual proyecto/cost center externo -> `organization_cost_centers` si Zeta expone algo equivalente;
- otros maestros Zeta -> entidades locales si se justifica.

Campos recomendados:

- `organization_id`
- `provider`
- `external_entity_type`
- `external_key`
- `local_entity_type`
- `local_entity_id`
- `match_method = rut_exact | manual | created_shell | imported_code | other`
- `confidence`
- `status = active | conflict | archived`
- `created_by_run_id`
- `reviewed_by_user_id`
- `reviewed_at`

### `document_source_refs`

Relacion controlada entre documento canonico y origen Zeta.

Debe permitir:

- saber de que raw record salio el documento;
- saber si hay drift;
- mostrar PDF/source URL;
- evitar rematerializar sobre documentos finalizados;
- auditar factual trust mode;
- encontrar los facts necesarios para mapper futuro a Bandeja.

Campos recomendados:

- `document_id`
- `provider`
- `source_kind`
- `raw_record_id`
- `sync_run_id`
- `external_key`
- `payload_hash_at_materialization`
- `current_payload_hash`
- `drift_status`
- `factual_trust_mode`
- `source_pdf_url`
- `source_pdf_url_expires_at`
- `bandeja_compatibility_json`

### Proyecto/cost center

La decision v1 es reutilizar `organization_cost_centers` como entidad tecnica base y presentar el alias de producto como `Proyecto` u `Operacion`.

Campos actuales a reutilizar:

- `documents.cost_center_id` nullable, ya existente;
- `documents.metadata.operation_code` o `document_source_refs.metadata_json.operation_code` para codigo externo/manual;
- `document_line_items.metadata.cost_center_id` solo como puente si se aprueban splits por linea; columna dedicada queda fuera de v1 salvo requerimiento confirmado.

Regla:

- PR-08/PR-11 pueden dejar estos campos null;
- PR-14 agrega asignacion y lectura de margen;
- no crear una entidad ERP de proyectos compleja en v1.

## 7. Convenciones de source, metadata y testing

### Source y metadata

Valores recomendados:

```text
provider: zetasoftware
source_type: zeta_api
source_kind: zeta_sales | zeta_received_cfe
factual_trust_mode: external_deterministic
upload_source: integration
```

Campos de metadata o source refs recomendados en documentos/drafts, complementarios a columnas ya existentes como `documents.cost_center_id`:

- `integration_provider`
- `integration_source_kind`
- `integration_external_key`
- `integration_sync_run_id`
- `integration_raw_record_id`
- `zeta_payload_hash`
- `zeta_endpoint`
- `zeta_observed_at`
- `source_change_pending_review`
- `zeta_party_resolution_status`
- `zeta_party_external_key`
- `cost_center_assignment_source`
- `operation_code`

### Testing sin sandbox

Convencion obligatoria para cualquier prueba real con riesgo de crear datos:

```text
test_mode: true
test_run_key: CVTLAB-ZETA-TST-YYYYMMDD-HHMM-<shortid>
referencia: CVTLAB TST <test_run_key>
concepto: CVTLAB TEST <test_run_key>
tipo_asiento: TST o codigo acordado
```

Responsables minimos:

- responsable tecnico Convertilabs: ejecuta o supervisa el smoke;
- responsable Rontil/Zeta: valida visualmente en Zeta y ejecuta acciones manuales si hacen falta;
- aprobador: confirma que el run quedo limpio o que no requeria limpieza.

Estados de cleanup:

- `not_required`: run read-only o dry-run sin write;
- `pending`: write ejecutado, falta limpiar/verificar;
- `verified`: limpieza/verificacion completada;
- `failed`: no se pudo limpiar o hay duda;
- `waived`: se decide conservar el registro por aprobacion explicita, con motivo.

## 8. Testing recomendado

### Unit tests

- endpoint registry no permite endpoints sin contrato.
- auth/client maskean secretos.
- normalizadores ventas y CFEs.
- normalizadores de party/contactos.
- resolver de party por RUT y conflictos.
- raw upsert idempotente.
- raw monetary envelope obligatorio para ventas/CFEs.
- dedupe por external key.
- dedupe por identidad humana.
- drift de payload.
- FX source vs BCU.
- mapper Bandeja dry-run.
- generador/validador de `test_run_key`.

### Integration tests locales

- conexion guardada y testeada con cliente mock.
- sync runner abre/cierra runs.
- cursor se actualiza solo en exito.
- materializacion crea documento + draft + line items + source ref.
- materializacion resuelve contraparte o bloquea conflicto.
- documento finalizado no se pisa ante payload hash distinto.
- proyecto/cost center nullable no rompe documentos existentes.
- Bandeja dry-run produce payload estable sin enviar.

### Smoke real controlado read-only

Solo despues de PR-03/PR-06/PR-10, con credenciales reales y read-only:

1. crear run manual con `test_mode=true` y `test_run_key`;
2. probar conexion;
3. sync maestros limitado;
4. sync ventas de un mes chico;
5. sync CFEs por rango chico;
6. comparar contadores con Zeta;
7. marcar `cleanup_status = not_required` porque no hubo write en Zeta;
8. dejar evidencia del rango consultado, contadores y usuario responsable.

No requiere limpieza en Zeta porque no crea registros alli, pero si requiere evidencia en Convertilabs.

### Smoke real controlado con write a Bandeja

Solo despues de PR-15 y solo si el responsable lo aprueba.

#### Que registros se crean

Maximo por primera prueba:

- 1 asiento en Bandeja de Entrada de Asientos;
- 2 lineas contables balanceadas Debe/Haber;
- sin proveedor nuevo si el payload de Bandeja permite omitir RUT/contacto;
- si se prueba proveedor, usar proveedor/contacto con nombre prefijado `CVTLAB PRUEBA <test_run_key>`.

#### Como se identifican

Todos los registros deben incluir, donde el contrato Zeta lo permita:

- `TipoAsiento = TST` o codigo acordado;
- `Referencia = CVTLAB TST <test_run_key>`;
- `Concepto/Leyenda = CVTLAB TEST <test_run_key>`;
- `AsientoId` deterministico que incluya hash corto del documento/run;
- metadata interna en Convertilabs con `test_run_key`, payload enviado y respuesta Zeta.

#### Quien lo hace

- Ejecucion tecnica: responsable tecnico Convertilabs.
- Validacion visual en Zeta: responsable Rontil/Zeta.
- Limpieza: responsable Rontil/Zeta si es manual en Zeta, o responsable tecnico si Zeta permite `Delete` seguro via API.
- Cierre del run: responsable tecnico Convertilabs, con evidencia del responsable Rontil/Zeta.

#### Cuando se limpia

- Inmediatamente despues de validar el smoke.
- Nunca dejar un write smoke sin limpiar/verificar mas de 24 horas.
- Durante piloto, revisar semanalmente todos los runs `test_mode=true` con cleanup no cerrado.

#### Como se limpia

Orden recomendado:

1. buscar en Bandeja por `Referencia`, `TipoAsiento=TST` y/o `AsientoId`;
2. si sigue en Bandeja y Zeta permite `Delete`, eliminar por API o manualmente;
3. si fue importado a contabilidad por error, usar la herramienta de Zeta correspondiente para borrar asientos filtrando por tipo/origen/referencia, con modo listar primero;
4. si se creo proveedor/contacto de prueba, borrar solo despues de eliminar movimientos relacionados;
5. marcar en Convertilabs `cleanup_status=verified` con evidencia.

#### Como se sabe que se limpio bien

Criterios de verificacion:

- busqueda en Bandeja por `test_run_key` sin resultados;
- busqueda en asientos importados por `Referencia`/`TipoAsiento` sin resultados, si hubo importacion;
- busqueda de proveedor/contacto test sin resultados o con estado acordado si se conserva;
- run en Convertilabs con `cleanup_status=verified`, `cleanup_verified_at`, usuario responsable y evidencia.

Si algun criterio no se cumple, el run queda `cleanup_status=failed` o `pending`, no `done`.

## 9. Criterios globales de aceptacion

- Una organizacion puede guardar y probar conexion Zeta.
- Las credenciales quedan cifradas y no aparecen en logs/UI.
- Los syncs read-only dejan runs, counters, cursors y raw records.
- Ventas y CFEs recibidos se pueden traer sin IA.
- Raw records de ventas/CFEs preservan moneda, montos y tasa fuente.
- Contactos Zeta tienen decision de mapping y no bloquean materializacion.
- Documentos Zeta aparecen en el flujo normal de review.
- Cada documento materializado tiene source ref y raw record asociado.
- Cada documento tiene hook nullable para proyecto/cost center.
- Los duplicados se detectan antes de posting.
- Las diferencias de origen posteriores quedan como drift revisable.
- FX no inventa tasas.
- Outbound Bandeja existe solo como dry-run/test mode hasta aprobacion posterior.
- Cualquier prueba real con write tiene `test_run_key`, responsable y cleanup verificado.

## 10. Preguntas abiertas que bloquean implementacion fina

1. Cual es la coleccion Postman oficial exacta y versionada que vamos a usar.
2. Que endpoint es seguro para `test connection`.
3. Como se autentica cada API REST y que campos de credenciales son obligatorios.
4. Cuales son los wrappers request/response exactos para cada endpoint.
5. Que campo o combinacion es external key estable para ventas.
6. Que campo o combinacion es external key estable para CFEs recibidos.
7. Si `URLPDF` expira, requiere auth adicional o permite abrir directo desde UI.
8. Si Zeta expone binario/XML/PDF de CFE recibido o solo metadata.
9. Que campos exactos de moneda/tipo de cambio expone cada endpoint Zeta.
10. Cual sera la tolerancia operativa Zeta vs BCU para FX.
11. En que casos el party shell en `parties` alcanza y en que casos debe crearse ademas `vendor` o `customer` minimo por requerimiento del flujo actual.
12. Cual sera el nombre tecnico final del hook de proyecto/cost center si el repo ya tiene campo equivalente.
13. Que codigo de Tipo de Asiento se usara para pruebas de Bandeja: `TST` u otro definido en Zeta.
14. Que datos de prueba son aceptables en produccion Zeta sin sandbox.
15. Quien sera el responsable Rontil/Zeta de validar y limpiar smokes reales.
16. Cual es la cadencia segura de sync y los limites/rate limits reales.
17. Cuales son las reglas de retencion de raw payloads con datos fiscales/personales.

## 11. Riesgos principales y mitigacion

| Riesgo | Mitigacion |
|---|---|
| Endpoint mal interpretado | PR-01 obligatorio con contrato oficial. Ningun endpoint inventado. |
| PR-01 queda bloqueado por demora de Zetasoftware | Ejecutar PR-00 y PR-02 en paralelo; avanzar PR-03/PR-04 con mocks; bloquear solo llamadas reales. |
| Duplicados entre upload manual, planilla y Zeta | Usar `document_invoice_identities` y `document_source_refs`; testear casos cruzados. |
| Secretos expuestos | Server-only, cifrado, masking, audit y tests. |
| Drift de DB/RLS | PR-00 obligatorio y `db:verify:parity` en PRs con schema. |
| Settings se vuelve inmantenible | Componentes de integraciones y servicios server-only. |
| Payload Zeta cambia despues del posting | Source change policy: warning, audit y revision formal. |
| Falta sandbox contamina produccion | Test mode obligatorio, prefijos visibles, runbook, responsables, cleanup verification y no writes antes de PR-15. |
| Limpieza de pruebas queda indefinida | Campos de cleanup en runs, panel de runs pendientes y evidencia obligatoria. |
| Contactos Zeta no mapean a vendors/customers | PR-05 cierra party mapping y permite party shell minima revisable en `parties`, con vendor/customer minimo solo cuando el flujo lo exige. |
| FX se define tarde y obliga a migrar raw records | PR-02 define monetary envelope; PR-06/PR-10 lo usan desde el primer raw record. |
| Outbound se adelanta demasiado | PR-15 solo dry-run/test mode, sin posting automatico. PR-01 documenta Bandeja temprano. |
| Proyecto/margen se agrega tarde y requiere migracion grande | PR-02 documenta y reutiliza `documents.cost_center_id`; PR-08/PR-11 lo preservan; PR-14 solo productiza. |

## 12. Recomendacion de ejecucion

Mi recomendacion es aprobar este backlog en tres tramos, con dos carriles paralelos al inicio.

### Tramo A1 - Estabilizacion tecnica

- PR-00

Resultado: repo, DB, dependencias y CI quedan confiables.

### Tramo A2 - Fundacion generica en paralelo a Zeta

- PR-02, disenado mientras se espera PR-01 y mergeado solo despues de PR-00.
- PR-03 mock/fixture.
- PR-04 mock/fixture.

Resultado: persistencia, seguridad, test mode, sync runner y UI base pueden avanzar sin depender de endpoints reales.

### Tramo A3 - Contrato Zeta real

- PR-01
- cierre real de PR-03 health
- habilitacion real de PR-05/PR-06/PR-10

Resultado: contrato validado, conexion segura y base lista para read-only real.

### Tramo B - Documentos operativos

- PR-05
- PR-06
- PR-07
- PR-08
- PR-09
- PR-10
- PR-11
- PR-12
- PR-13

Resultado: ventas y CFEs recibidos como documentos canonicos dentro del flujo real, con contraparte, FX, dedupe, source refs y hook de proyecto.

### Tramo C - Piloto y puente futuro

- PR-14
- PR-15
- PR-16

Resultado: necesidad Rontil cubierta de forma limitada, margen simple por proyecto, dry-run Bandeja y runbook operativo de pruebas reales.

## 13. Checklist antes del primer PR funcional

### Antes del primer PR tecnico

- [ ] Working tree limpio o cambios locales aislados.
- [ ] `npm ci` reproducible.
- [ ] `npm run lint` verde.
- [ ] `npm run typecheck` verde.
- [ ] `npm test` verde.
- [ ] `npm run build` verde.
- [ ] `npm run db:verify:parity` verde.

### Antes de cualquier PR con persistencia nueva

- [ ] PR-00 cerrado o rama sincronizada con su resultado.
- [ ] Schema canonico y migracion actualizados.
- [ ] RLS definido.
- [ ] Tests de schema compatibility actualizados.
- [ ] Campos de test/cleanup considerados para runs.
- [ ] Monetary envelope considerado para raw records documentales.
- [ ] Hook de proyecto/cost center definido o explicitamente verificado como existente.

### Antes de cualquier llamada real a Zeta

- [ ] Coleccion Postman oficial o fuente equivalente disponible.
- [ ] `docs/zetasoftware-endpoints-contract.md` versionado.
- [ ] Endpoint de health/test connection confirmado.
- [ ] Credenciales Zeta de lectura disponibles para entorno controlado.
- [ ] Rate limits o cadencia segura documentados, aunque sea de forma conservadora.

### Antes de materializar documentos Zeta

- [ ] Decision de party mapping documentada y testeada.
- [ ] Decision de tolerancia FX documentada.
- [ ] Raw records incluyen moneda, montos y tasa fuente.
- [ ] `document_source_refs` listo.
- [ ] Hook de proyecto/cost center disponible.
- [ ] Compatibilidad futura con Bandeja revisada contra contrato PR-01.

### Antes del primer write real a Zeta

- [ ] PR-15 cerrado en dry-run.
- [ ] `docs/zeta-production-smoke-runbook.md` aprobado.
- [ ] Responsable tecnico Convertilabs asignado.
- [ ] Responsable Rontil/Zeta asignado.
- [ ] `test_run_key` generado.
- [ ] TipoAsiento de prueba definido en Zeta.
- [ ] Criterios de limpieza y verificacion acordados.
- [ ] Plan de rollback/cleanup preparado antes de enviar payload.

## 14. Runbook corto obligatorio para smoke real sin sandbox

Este runbook resume el procedimiento minimo. El documento operativo final puede vivir en `docs/zeta-production-smoke-runbook.md`, pero ningun write real debe ejecutarse sin cubrir estos pasos.

### 14.1 Preparacion

1. Crear `test_run_key`:

```text
CVTLAB-ZETA-TST-YYYYMMDD-HHMM-<shortid>
```

2. Registrar responsables:

- ejecutor tecnico;
- validador Rontil/Zeta;
- aprobador de cierre.

3. Confirmar alcance:

- read-only;
- dry-run;
- write a Bandeja;
- creacion de proveedor/contacto de prueba, si aplica.

4. Confirmar que existe plan de limpieza antes de ejecutar.

### 14.2 Ejecucion read-only

1. Ejecutar `test connection`.
2. Ejecutar sync acotado.
3. Comparar contadores con Zeta.
4. Marcar run como `cleanup_status=not_required`.
5. Guardar evidencia.

### 14.3 Ejecucion write a Bandeja

1. Generar payload dry-run.
2. Revisar payload antes de enviar.
3. Enviar maximo 1 asiento / 2 lineas en primer smoke.
4. Verificar visualmente en Zeta que aparece con prefijo `CVTLAB TST`.
5. No importarlo a contabilidad final salvo que el test lo requiera explicitamente.
6. Limpiar inmediatamente.

### 14.4 Limpieza

1. Buscar por `test_run_key`, `Referencia`, `TipoAsiento` y/o `AsientoId`.
2. Eliminar de Bandeja si sigue pendiente.
3. Si fue importado por error, listar primero en herramienta de borrado y luego borrar el asiento de prueba.
4. Eliminar proveedor/contacto de prueba solo despues de borrar movimientos relacionados.
5. Registrar evidencia en Convertilabs.

### 14.5 Cierre

El run solo puede cerrarse como exitoso si:

- no quedan registros de prueba activos en Bandeja;
- no quedan asientos importados de prueba, salvo waiver documentado;
- no quedan proveedores/contactos de prueba, salvo waiver documentado;
- `cleanup_status=verified` o `not_required`;
- hay usuario, fecha y evidencia de cierre.
