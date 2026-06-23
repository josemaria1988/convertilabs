# Análisis Arquitectónico Convertilabs 2.0

## 1. Resumen ejecutivo

Convertilabs ya no esta solo en el estado viejo de "motor documental-contable-fiscal". El repositorio tiene piezas reales de Convertilabs 2.0: `parties`, `contacts`, `work_units`, `business_events`, `entity_links`, `evidence_refs`, operaciones, comunicaciones, inteligencia operacional, tesoreria, ZetaSoftware y un Inicio que mezcla documentos, trabajos, dinero, agenda y riesgos.

La conclusion principal: no hay que tirar todo. Hay una base tecnica aprovechable. Pero tampoco hay un sistema operativo de gestion cerrado. Lo que existe es una coleccion avanzada de MVPs conectados por puentes. El flujo operativo que importa para Rontil todavia necesita endurecerse:

`cotizacion/trabajo Nueva Palmira -> cliente -> documentos de venta/gasto -> margen -> pendientes -> tablero`.

El mayor cambio no es tecnologico. Es de centro de gravedad:

- antes: documento -> clasificacion -> asiento -> IVA;
- ahora: hecho operativo -> contacto/party -> trabajo -> documentos -> dinero -> contabilidad/IVA -> tareas/procesos -> tablero.

El codigo acompaña parte de esa vision, pero quedan contradicciones:

- la documentacion nueva habla de `Dinero`; la UI principal decia `Tesoreria` y queda resuelto en PR 2: `Dinero` es dominio principal, `Tesoreria` subdominio/alias;
- hay dominios canonicos nuevos, pero los legados `vendors`, `customers`, `organization_cost_centers` y `documents.cost_center_id` siguen vivos;
- Zeta esta bastante avanzado como integracion estructurada, pero falta validar contra entorno real y cerrar el mapeo operativo Zeta -> trabajo;
- existe configuracion de email de CFE, pero no vi un pipeline comercial de cotizaciones desde web/email;
- el dashboard es real, no fake, pero todavia depende de que el dato ya este bien enlazado;
- operaciones, tareas y continuidad existen, pero aun no gobiernan el caso diario.

Verificacion ejecutada:

- `npm test`: 441 tests pasados, 0 fallos.
- `npm run typecheck`: OK.
- `npm run lint`: 0 errores, 2 warnings existentes en Treasury.
- No valide credenciales reales de Zeta, Supabase remoto, Inngest real, email real ni banco real.

## 2. Estado actual del producto según documentación vieja

La documentacion previa describe un producto fuerte en:

- ingesta documental;
- extraccion y revision asistida;
- reglas contables;
- propuestas de asiento;
- libro diario / mayor / trial balance;
- IVA compras / IVA ventas / conciliacion fiscal;
- cierres;
- auditoria;
- importaciones/exportaciones;
- integraciones fiscales y Zeta como fuente externa;
- asistente IA controlado y explicable.

Eso sirve, pero no alcanza para la refundacion.

La tesis vieja implicita era:

- el documento era el centro del producto;
- la contabilidad y el IVA eran el destino principal;
- clientes/proveedores/centros de costo eran auxiliares;
- "Convertilabs no es un ERP" funcionaba como limite de producto.

Esa tesis quedo corta para Rontil. La documentacion refundacional la contradice de forma explicita: Convertilabs no debe ser un ERP generico, pero si debe ser el sistema operativo personalizado de gestion de Rontil.

Piezas viejas que siguen siendo valiosas:

- pipeline documental;
- normalizacion fiscal;
- reglas contables;
- ledger/open items;
- auditoria;
- RLS y organizacion multi-tenant;
- trazabilidad de fuente;
- revision humana antes de efectos finales;
- tests de contabilidad, IVA, documentos y Zeta.

Piezas viejas que deben bajar de jerarquia:

- `Documentos` como centro absoluto;
- `Revision` como superficie diaria principal;
- `vendors/customers/cost_centers` como modelo madre;
- dashboards contables/fiscales como tablero ejecutivo unico.

Piezas viejas incompatibles con Convertilabs 2.0:

- cualquier copy o decision de arquitectura que diga "no somos ERP" como excusa para no modelar trabajos, contactos, dinero, procesos y continuidad;
- considerar Zeta como modelo interno en vez de fuente externa estructurada;
- dejar el negocio reducido a documentos ya emitidos.

## 3. Nueva visión refundacional

La nueva vision define a Convertilabs como sistema operativo de gestion de Rontil. El objetivo no es competir con Zeta, sino orquestar la operacion real alrededor de Rontil.

El objeto central no es el documento. Es el hecho operativo.

Modelo mental recomendado:

```text
hecho operativo
  -> party/contacto
  -> trabajo/work_unit
  -> documentos
  -> dinero
  -> contabilidad
  -> IVA/cumplimiento
  -> tareas/procesos
  -> evidencia
  -> tablero Inicio
```

Las entidades madre de la refundacion son:

- organizacion;
- parties, roles, identificadores y contactos;
- work_units/trabajos;
- documentos canonicos;
- business_events;
- entity_links;
- evidence_refs;
- dinero, open items, cobros, pagos, bancos y caja;
- contabilidad;
- IVA/cumplimiento;
- procesos, tareas, obligaciones y continuidad;
- comunicaciones/interacciones;
- integraciones y raw records;
- auditoria e inteligencia operacional.

Zeta debe quedar en este rol:

- fuente estructurada externa;
- destino externo controlado cuando corresponda;
- nunca modelo canonico interno;
- nunca sustituto del modelo operativo de Rontil.

El caso minimo para validar la refundacion es Nueva Palmira:

```text
Nueva Palmira
  -> cliente/contacto
  -> trabajo
  -> documentos de venta y gasto
  -> margen
  -> cuentas por cobrar/pagar
  -> tareas/pendientes
  -> tablero ejecutivo
```

Si ese flujo no se puede operar de punta a punta, Convertilabs 2.0 todavia no existe en terminos practicos.

## 4. Estado actual del código

Stack verificado en `package.json`:

- Next.js 15;
- React 19;
- TypeScript;
- Supabase;
- Inngest;
- OpenAI SDK;
- Tailwind;
- ESLint;
- runner de tests propio en `tests/run-tests.cjs`.

Estructura general observada:

- `app/`: rutas Next.js, app privada por organizacion, APIs, marketing, auth.
- `components/`: UI de dashboard, documentos, directorio, dinero, settings, work, etc.
- `modules/`: dominios de negocio.
- `db/schema/`: schema modular.
- `supabase/migrations/`: migraciones historicas y PRs 2.0.
- `docs/`: documentacion refundacional, PR docs, Zeta, tesoreria, auditorias.
- `tests/`: cobertura unitaria/integracion local bastante amplia.

Rutas privadas principales observadas:

- `/app/o/[slug]/dashboard`: Inicio;
- `/work` y `/work/[workUnitId]`: trabajos;
- `/documents`, `/documents/[documentId]`, `/documents/pending-assignment`;
- `/review`;
- `/money`, `/money/vales/[valeId]`;
- aliases de tesoreria;
- `/directory`, `/directory/[partyId]`;
- `/agenda`;
- `/processes`;
- `/continuity`;
- `/tax`, `/tax/reconciliation`;
- `/close`;
- `/journal-entries`, `/trial-balance`, `/open-items`, `/chart-map`;
- `/imports`, `/exports`, `/audit`, `/settings`, `/advanced`.

Navegacion principal verificada:

- `Inicio`;
- `Trabajos`;
- `Documentos`;
- `Tesoreria`;
- `Agenda`;
- `Mas`.

Esto esta cerca de la vision nueva, pero no coincide con el lenguaje de docs que prioriza `Dinero`.

Schema actual:

- `01_enums.sql`: estados, tipos y enums base.
- `02_identity_and_tenants.sql`: perfiles, organizaciones, membresias.
- `03_master_data.sql`: monedas, FX, clientes/proveedores/cost centers legacy.
- `04_documents.sql`: documentos, lineas, identidades, workflow documental.
- `05_accounting.sql`: reglas, source events, propuestas, asientos, open items.
- `06_tax_and_rules.sql`: IVA, periodos fiscales, conciliacion.
- `07_integrations_and_audit.sql`: integraciones, raw records, source refs, audit, CFE email settings.
- `08_document_ai_pipeline.sql`: pipeline IA/documental.
- `09_accounting_read_models.sql`: vistas, entre ellas open items con work unit.
- `10_company_mother_model.sql`: parties, contacts, work_units, business_events, links, evidence.
- `11_legacy_bridges.sql`: puentes legacy hacia modelo madre.
- `12_operations_communications.sql`: tareas, procesos, obligaciones, notas, continuidad, interacciones.
- `13_operational_intelligence.sql`: sugerencias operacionales.
- `14_treasury.sql`: bancos, saldos, vales, eventos, cobranzas manuales y reservas.

El codigo no esta vacio: la refundacion ya empezo.

Modulos relevantes verificados:

- `modules/work`: trabajos, resumen financiero, asignacion de documentos.
- `modules/directory`: parties/contactos/perfiles.
- `modules/money`: open items y vista de deudores/acreedores.
- `modules/treasury`: cuentas bancarias, snapshots, vales, proyecciones.
- `modules/operations`: tareas, procesos, obligaciones, continuidad.
- `modules/communications`: interacciones enlazadas a entidades.
- `modules/intelligence`: sugerencias operacionales.
- `modules/presentation`: loader y UI del Inicio.
- `modules/integrations/zeta`: endpoints, REST client, credenciales, sync, materializacion, export de compras/gastos.
- `modules/documents`: ingesta, revision, workflow, importaciones.
- `modules/accounting`, `modules/tax`, `modules/close`: nucleo contable/fiscal.

Estado de pruebas:

- `npm test` paso con 434 tests.
- Hay tests especificos de work MVP, Nueva Palmira, money, operations, open items, Zeta, export de compra/gasto, posting templates, documentos, IVA y mas.

Limitaciones de verificacion:

- No confirme ejecucion contra Supabase remoto.
- No confirme credenciales reales de Zeta.
- No confirme Inngest real.
- No confirme ingestion real de email.
- No confirme entorno de banco real.

## 5. Mapa de dominios existentes

| Dominio | Evidencia en codigo/schema | Estado |
| --- | --- | --- |
| Organizacion y auth | `modules/auth`, `modules/organizations`, `db/schema/02_identity_and_tenants.sql` | Solido, reusable |
| Documentos canonicos | `modules/documents`, `db/schema/04_documents.sql` | Solido, todavia demasiado central |
| Contabilidad | `modules/accounting`, `db/schema/05_accounting.sql` | Solido, debe quedar como consecuencia del negocio |
| IVA / tax | `modules/tax`, `db/schema/06_tax_and_rules.sql` | Solido, no debe gobernar la operacion diaria |
| Cierre | `modules/close` | Util, rol posterior |
| Parties/contactos | `modules/directory`, `db/schema/10_company_mother_model.sql` | Existe y es clave; requiere consolidar legacy |
| Work units/trabajos | `modules/work`, `db/schema/10_company_mother_model.sql` | Existe; falta convertirlo en eje operativo real |
| Business events | `business_events` | Existe; falta que sea columna vertebral consistente |
| Entity links | `entity_links`, `integration_entity_links` | Existe; util como capa transversal |
| Evidence refs | `evidence_refs`, `document_source_refs` | Existe; requiere uso uniforme fuera de documentos |
| Open items | `ledger_open_items`, `v_open_items_outstanding` | Existe; base buena para dinero |
| Tesoreria | `modules/treasury`, `db/schema/14_treasury.sql` | MVP potente; aun separado de pagos/cobros canonicos |
| Operaciones/tareas | `modules/operations`, `db/schema/12_operations_communications.sql` | Existe; todavia no gobierna el caso diario |
| Comunicaciones | `modules/communications` | Existe; no vi ingestion automatica comercial desde email |
| Inteligencia operacional | `modules/intelligence`, `operational_suggestions` | Existe; materializacion parcial |
| Zeta | `modules/integrations/zeta` | Avanzado; falta validacion real y cerrar mapeos operativos |
| Web/email/cotizaciones comerciales | busquedas en `app`, `modules`, `db`, `docs` | Gap claro; no vi pipeline de cotizacion/trabajo |
| Dashboard ejecutivo | `modules/presentation`, `components/dashboard` | Real y conectado; depende de datos enlazados |

## 6. Matriz documentación nueva vs código actual

| Vision nueva | Codigo actual | Brecha / veredicto |
| --- | --- | --- |
| Convertilabs como sistema operativo de Rontil | Hay Inicio, trabajos, dinero/tesoreria, agenda, procesos, directorio, docs, contabilidad | Parcialmente implementado. Falta flujo operativo cerrado. |
| Parties/contactos como entidad madre | `parties`, `party_roles`, `party_identifiers`, `contacts`, UI de directorio | Bien encaminado. Falta terminar transicion desde `vendors/customers`. |
| Work units/trabajos como eje operativo | `work_units`, paginas de trabajo, asignacion de documentos, resumen financiero | Existe. Falta intake/cotizacion y automatismos desde Zeta/email/web. |
| Documentos canonicos subordinados al hecho operativo | `documents` tiene `party_id`, `vendor_party_id`, `customer_party_id`, `work_unit_id` | Bien. Todavia hay `cost_center_id` legacy y UI documental fuerte. |
| Business events y evidence refs | Tablas y eventos en creacion/asignacion | Existe. Falta disciplina uniforme de eventos para todos los efectos. |
| Zeta como fuente externa estructurada | endpoints, client, sync, raw records, materializacion, export parcial de compras/gastos | Avanzado. No validado contra Zeta real en este analisis. |
| Ventas/compras importadas desde Zeta | normalizadores sales/received CFE y materializacion; export compra/gasto | Existe a nivel tecnico. Falta probar el circuito operativo Rontil completo. |
| Cotizaciones desde email/API web | No vi dominio/rutas/schema especificos para cotizaciones comerciales | Gap central para Convertilabs 2.0. |
| Dinero/deudores/acreedores | `ledger_open_items`, `modules/money`, dashboard dinero | Base buena. Falta pagos/cobros/banco como modelo canonico unificado. |
| Tesoreria/banco/vales | `modules/treasury`, schema PR-14 | Existe. Debe integrarse mejor con dinero/open items. |
| Tablero ejecutivo | `company-home-loader`, `company-home-dashboard` | Existe y no parece fake. Falta drill-down por caso/trabajo. |
| Procesos/tareas/continuidad | `tasks`, `processes`, `obligations`, `continuity_risks`, UI agenda/processes/continuity | Existe. Falta que conduzca la operacion diaria. |
| IA como asistente, no autoridad | Docs y tests apuntan a control humano | Alineado. Mantener. |

## 7. KEEP / REWRITE / DELETE / CREATE

KEEP:

- Stack actual: Next.js, React, TypeScript, Supabase, Inngest, tests.
- Auth, organizaciones, roles y RLS.
- Pipeline documental y almacenamiento de evidencia.
- Modelo contable: reglas, propuestas, asientos, lineas, open items.
- IVA, conciliacion fiscal y cierre.
- Auditoria y trazabilidad.
- Integration foundation: connections, sync runs, cursors, raw records, source refs, entity links.
- Zeta endpoint registry, REST client, normalizadores, sync y materializacion.
- Export de compras/gastos a Zeta con preflight, en estado controlado y testeado localmente.
- `parties`, `contacts`, `party_roles`, `party_identifiers`.
- `work_units` y UI de trabajos.
- `business_events`, `entity_links`, `evidence_refs`.
- `modules/money` como lectura de deudores/acreedores.
- `modules/treasury` como subdominio bancario/vales.
- `modules/operations`, `communications`, `intelligence`.
- Inicio actual como base de tablero ejecutivo.
- Tests existentes, especialmente los de Nueva Palmira, Zeta y open items.

REWRITE:

- Jerarquia de producto: documentos y revision no deben ser el centro mental.
- Lenguaje de navegacion: decidir si el concepto usuario es `Dinero` o `Tesoreria`; hoy hay inconsistencia.
- Legacy bridges: deben ser transicion controlada, no arquitectura permanente.
- Mapeo Zeta CentroCosto -> `work_units`: debe quedar como flujo operativo principal, no helper suelto.
- Politica de mutabilidad de documentos finalizados/asentados al asignar trabajo.
- Relacion entre `modules/money` y `modules/treasury`: hoy hay dos lecturas de dinero con fronteras que pueden confundirse.
- Inteligencia operacional: aceptar una sugerencia deberia materializar efectos concretos o declarar explicitamente que es solo decision registrada.
- Docs de PR viejos: algunos quedaron desactualizados frente al codigo actual, especialmente Zeta/export.

DELETE / DEPRECATE:

- La tesis "Convertilabs no es ERP" como limite funcional.
- Copy o docs que reduzcan el producto a contabilidad/IVA/documentos.
- Uso de `vendors`, `customers` y `organization_cost_centers` como fuente primaria cuando exista `party`/`work_unit`.
- Dependencia mental de `documents.cost_center_id`.
- Rutas o dashboards legacy que compitan con Inicio sin aportar una tarea clara.
- Cualquier KPI simulado o placeholder en tablero ejecutivo.
- Cualquier parsing IA que pueda escribir hechos finales sin revision.

CREATE:

- Dominio de intake/cotizaciones comerciales: web, email, manual/API.
- Tabla o modelo para `quote_requests` / `work_intake_items` con fuente, evidencia, estado, party candidate y posible work unit.
- Flujo de promocion: intake -> party/contact -> work_unit -> tarea -> documento/venta.
- Ingestion web/API para solicitudes de cotizacion.
- Ingestion email comercial inicial con review humana.
- Mapeo operativo Zeta: contacto -> party, centro de costo -> work_unit, venta/compra -> documento -> open item -> margen.
- UI de resolucion de mapeos Zeta cuando falta party/work_unit.
- Modelo canonico de cobros/pagos/bank movements/financial accounts, separado pero conectado a tesoreria.
- Caso Nueva Palmira como fixture/playbook operativo reproducible.
- Drill-down ejecutivo por trabajo: documentos, margen, pendientes, tareas, evidencia.
- Runbook de validacion con datos reales de Rontil/Zeta.

## 8. Integración Zeta: estado actual y gaps

Estado actual verificado:

- Existe registry de endpoints en `modules/integrations/zeta/client/endpoint-registry.ts`.
- Hay REST client server-only con manejo de wrappers, timeouts y errores.
- Hay servicio de conexion con credenciales cifradas, health check, modo mock y audit.
- Hay sync runs, cursors, raw records y cleanup.
- Hay streams para contactos, maestros, maestros contables, ventas y CFEs recibidos.
- Hay materializacion de contactos a parties/roles/identificadores.
- Hay normalizacion de ventas y CFEs recibidos a documentos canonicos.
- Hay source refs y links externos para preservar origen.
- Hay pruebas de registry, normalizadores, credenciales, sync runner y materializacion.
- Hay soporte de export de compra/gasto a Zeta (`FacturaProveedorAgregar`) con preflight de duplicados, reconciliacion por `QueryCompras`, paid_by_partner y bloqueo de mercaderia/stock.
- Hay tests que prueban envio simulado, snapshots, duplicados, timeout y reconciliacion.

Gaps:

- No valide contra credenciales reales ni entorno real de Zeta.
- No verifique si los IDs `RegistroId`, `FacturaId`, `AsientoId` son estables en produccion.
- No verifique sandbox real. Si no hay sandbox, cada prueba de escritura es riesgosa.
- La importacion Zeta debe cerrar el flujo operativo, no solo crear documentos.
- El mapeo `CentroCosto` -> `work_unit` necesita ser tratado como pieza central del caso Rontil.
- Falta ver una pantalla fuerte de "resolver mapeos Zeta pendientes" para party/work_unit/documento.
- No vi endpoint confirmado para binarios XML/PDF de todos los CFEs. La documentacion tambien lo marca como riesgo.
- La exportacion de compras/gastos existe, pero mercaderia/stock queda bloqueada. Eso parece correcto, pero limita casos operativos.
- Falta decidir si Zeta sera tambien fuente de saldos pendientes o si Convertilabs calcula open items y solo reconcilia.
- Falta politica clara de reintentos idempotentes cuando Zeta responde timeout/desconocido.

Regla recomendada:

Zeta no debe escribir el modelo interno. Zeta debe entregar hechos externos versionados. Convertilabs los normaliza, conserva raw, crea documentos/parties/work_units canonicos, y deja toda decision ambigua en bandeja de resolucion.

## 9. Integración web/email/cotizaciones: propuesta inicial

No vi un pipeline implementado para cotizaciones comerciales desde web/email/API. Vi:

- configuracion de email de CFE;
- `webhook_subscriptions`;
- `interactions` con tipo `email`;
- fuentes de ingestion genericas;
- mucha logica de "cotizacion" BCU, que no es cotizacion comercial.

Eso no resuelve el caso "cotizacion o trabajo Nueva Palmira".

Propuesta inicial:

Crear un dominio de intake operativo, no empezar directo por documentos ni por trabajos finales.

Entidad recomendada:

```text
work_intake_items / quote_requests
```

Campos minimos:

- `organization_id`;
- `source_type`: `web_form`, `email`, `manual`, `api`, `zeta`, `other`;
- `source_ref_id` o `evidence_ref_id`;
- `raw_subject`;
- `raw_text`;
- `contact_name`;
- `contact_email`;
- `contact_phone`;
- `party_candidate_id`;
- `party_id`;
- `work_unit_id`;
- `location_text`;
- `service_text`;
- `requested_date`;
- `amount_estimate`;
- `currency_code`;
- `status`: `new`, `needs_party_resolution`, `needs_work_decision`, `converted`, `discarded`;
- `confidence_json`;
- `metadata_json`.

Flujo:

```text
web/email/manual
  -> raw intake
  -> evidencia/source ref
  -> normalizacion asistida
  -> resolver party/contact
  -> crear o asociar work_unit
  -> crear tarea de seguimiento
  -> registrar business_event
  -> mostrar en Inicio y Trabajos
```

Decisiones de seguridad:

- El email no debe crear trabajos finales sin aprobacion humana al inicio.
- La IA puede sugerir party, trabajo, monto y proxima accion; no debe confirmar ventas ni compromisos.
- Todo intake debe quedar auditable.
- Si no hay party confiable, se crea candidato o queda en bandeja.

Para web/API:

- endpoint autenticado o tokenizado para formularios de Rontil;
- payload simple y versionado;
- source ref obligatorio;
- idempotency key por envio externo;
- posibilidad de adjuntar documentos/evidencia.

Para email:

- comenzar con forward controlado;
- guardar raw text y adjuntos;
- registrar `interaction`;
- crear intake en estado `new`;
- luego resolver manualmente.

## 10. Modelo canónico recomendado

Modelo canonico recomendado para Convertilabs 2.0:

```text
Organization
  Party
    PartyRole
    PartyIdentifier
    Contact
    Interaction

  WorkUnit
    customer_party_id
    status
    commercial/operational metadata

  Document
    party_id
    customer_party_id
    vendor_party_id
    work_unit_id
    source refs
    line items

  Money
    ledger_open_items
    payments/collections
    settlement links
    financial accounts
    bank/cash movements

  Accounting
    source events
    posting proposals
    journal entries
    journal lines

  Tax
    VAT runs
    reconciliation
    obligations

  Operations
    tasks
    processes
    obligations
    continuity risks

  Integrations
    connections
    sync runs
    raw records
    external links

  Evidence
    evidence refs
    document source refs
    audit events
```

Reglas:

- `party_id` y `work_unit_id` deben ser FK directas cuando gobiernan dinero, documentos, tareas o dashboard.
- `entity_links` sirve para relaciones auxiliares, historicas o multiples; no debe reemplazar las FK principales.
- `business_events` debe registrar los cambios relevantes, no ser decorativo.
- Todo hecho que venga de Zeta, email, web o carga manual debe conservar raw/evidencia.
- Contabilidad e IVA son consecuencias, no origen del modelo.
- Zeta IDs deben quedar como referencias externas, no como PK internas.
- Los legados pueden existir durante transicion, pero no deben ser fuente primaria de nuevas features.

Gap canonico mas importante:

Falta un modelo de intake/cotizacion/trabajo previo a documento. Sin eso, Convertilabs sigue reaccionando a papeles emitidos, no gestionando operacion.

Segundo gap:

Falta modelo canonico completo de dinero real:

- pagos;
- cobros;
- cuentas financieras;
- movimientos bancarios/caja;
- conciliacion banco/open item;
- relacion clara con tesoreria y vales.

## 11. Riesgos técnicos

- Puentes legacy permanentes: si `vendors/customers/cost_centers` siguen siendo fuente primaria, el modelo madre queda decorativo.
- Doble lenguaje dinero/tesoreria: puede producir rutas, permisos y mental models duplicados.
- Mutabilidad de documentos finales: tests muestran asignacion de documento a trabajo y propagacion a open items. Hay que confirmar politica para documentos `posted_final` o cerrados.
- Zeta sin sandbox: exportar a Zeta con datos reales puede ser peligroso si no hay limpieza/reconciliacion segura.
- Idempotencia Zeta: timeouts y respuestas desconocidas pueden duplicar facturas si no se mantiene la estrategia conservadora.
- Drift de contratos Zeta: endpoints externos pueden cambiar wrappers/campos.
- Mapeos incompletos Zeta -> canonico: contacto, RUT, centro de costo, documento, moneda, IVA, tipo comprobante.
- Vistas/read models dependientes de migraciones: si una base no tiene PRs nuevos aplicados, pantallas pueden fallar.
- `entity_links` abusado: puede ocultar relaciones criticas que deberian ser FK.
- Inteligencia operacional parcial: aceptar sugerencias sin efecto real puede generar falsa confianza.
- Email intake sin seguridad: spoofing, adjuntos, duplicados y datos personales.
- Falta de E2E browser/real env para el flujo Nueva Palmira.
- `metadata` vs `metadata_json` y campos legacy/nuevos conviviendo: riesgo de inconsistencias.
- Dependencia de service role en loaders: potente, pero debe cuidarse para no saltar controles de organizacion.

## 12. Riesgos operativos

- El usuario puede seguir entrando por documentos y no por trabajos.
- Rontil puede necesitar respuestas diarias antes de que el modelo este completo.
- Si Zeta no entrega datos limpios, Convertilabs necesita bandejas de resolucion, no automatismos optimistas.
- Si no se modelan contactos y comunicaciones, el sistema no captura la memoria real del negocio.
- Si no se registra el trabajo antes de los documentos, el margen llega tarde.
- Si tesoreria queda manual y separada, el tablero de dinero puede contradecir open items.
- Si los procesos/tareas no se usan de verdad, continuidad queda como modulo decorativo.
- Si la IA se presenta como resolutora final, aumenta el riesgo de errores fiscales/contables.
- Si el caso Nueva Palmira no se prueba con datos reales o fixtures realistas, el producto puede parecer completo sin estarlo.
- Si Rontil depende de informacion de web bancaria y emails de ejecutiva, hay riesgo operativo por captura manual y falta de API.

## 13. Roadmap técnico sugerido

Etapa 0 - Baseline controlado:

- Mantener el reporte como snapshot de arquitectura.
- Confirmar que `npm test` siga verde.
- Levantar estado de migraciones en Supabase real.
- Verificar variables y credenciales disponibles: Supabase, Inngest, Zeta, storage.

Etapa 1 - Modelo madre estable:

- Declarar `party` y `work_unit` como entidades canonicas para nuevas features.
- Documentar que `vendors/customers/cost_centers` son legacy/bridge.
- Revisar mutabilidad de `documents.work_unit_id` en documentos asentados/cerrados.
- Alinear navegacion: elegir `Dinero` o `Tesoreria`.

Etapa 2 - Zeta como fuente externa estructurada:

- Probar sync real read-only de contactos, centros de costo, ventas, compras/CFEs.
- Materializar contacto -> party con trazabilidad.
- Materializar centro de costo -> work_unit o mapping revisable.
- Importar ventas/compras con source refs.
- No activar escrituras sin runbook, idempotencia y prueba controlada.

Etapa 3 - Parties/contactos:

- Resolver duplicados por RUT/email/nombre.
- Consolidar vendors/customers a party roles.
- Mostrar historia por party: trabajos, documentos, dinero, interacciones.

Etapa 4 - Work units/trabajos:

- Hacer de Trabajos la superficie operativa principal.
- Crear flujo rapido: cliente -> trabajo -> asignar documentos -> ver margen.
- Agregar estados simples: prospecto, activo, pausado, cerrado.

Etapa 5 - Documentos canonicos enlazados:

- Permitir preasignar documentos a trabajo desde upload/import/Zeta.
- Mejorar pending assignment por party/work/Zeta center.
- Asegurar que documento, open item, asiento y dashboard mantengan la misma relacion operativa.

Etapa 6 - Ventas/compras importadas:

- Cerrar importacion de venta/gasto desde Zeta al trabajo.
- Calcular revenue/cost/margin por work_unit.
- Mostrar descomposicion por documento y tipo.

Etapa 7 - Cotizaciones desde web/email:

- Crear intake/cotizaciones comerciales.
- Web/API minimo para nueva solicitud.
- Email forward inicial con revision humana.
- Promover intake a party/contact/work_unit.

Etapa 8 - Dinero/deudores/acreedores:

- Separar y conectar: open items, cobros, pagos, cuentas financieras, banco/caja, vales.
- Registrar cobro/pago manual minimo.
- Conciliar contra open items.
- Reflejar impacto en tablero y trabajo.

Etapa 9 - Tablero ejecutivo:

- Inicio debe responder:
  - que trabajos estan vivos;
  - cuanto margen tienen;
  - quien debe;
  - a quien se debe;
  - que vence;
  - que esta trabado;
  - que necesita decision.
- Drill-down por Nueva Palmira.

Etapa 10 - Procesos/tareas/continuidad:

- Convertir tareas y procesos en mecanismo diario.
- Plantillas para ventas, compras, cobranza, pagos, cierre IVA, renovacion de vales.
- Continuidad como vista de riesgo real, no solo inventario.

Corte operativo minimo Nueva Palmira:

1. Crear o resolver party/contacto del cliente.
2. Crear `work_unit` Nueva Palmira.
3. Ingresar o importar al menos una venta y un gasto asociados al trabajo.
4. Generar o leer open items de venta/gasto.
5. Mostrar margen por trabajo.
6. Mostrar deudor/acreedor pendiente.
7. Crear una tarea operativa ligada al trabajo.
8. Mostrar todo en Inicio sin datos fake.
9. Tener un test/playbook que lo verifique.

## 14. Primeros PRs recomendados

PR 1 - Congelar baseline de arquitectura:

- Agregar este reporte.
- Agregar una tabla de estado "implementado / parcial / ausente" si se quiere mantener viva en docs.
- No tocar schema.

PR 2 - Alinear lenguaje y navegacion:

- Decidir `Dinero` vs `Tesoreria`.
- Si `Tesoreria` queda como subdominio, la nav principal deberia decir `Dinero`.
- Si Rontil entiende mejor `Tesoreria`, actualizar docs nuevas para no prometer otra cosa.

PR 3 - Politica de legacy bridges:

- Documentar fuente canonica por entidad.
- Marcar `vendors/customers/cost_centers` como legacy bridge para nuevas features.
- Revisar queries que todavia los usan como fuente principal.

PR 4 - Zeta CentroCosto -> WorkUnit operativo:

- Confirmar si el helper actual esta conectado al sync real.
- Crear/usar mapping revisable cuando el centro de costo no sea automaticamente confiable.
- Llevar ese mapping al detalle del trabajo y a importacion documental.

PR 5 - Nueva Palmira fixture/playbook:

- Fixture local o test de dominio que cree party, work_unit, venta, gasto, open items, task y dashboard signal.
- Debe fallar si el margen o pendientes no aparecen.

PR 6 - Intake de cotizaciones:

- Disenar schema minimo de `work_intake_items` o `quote_requests`.
- Crear ingreso manual primero.
- Luego API/web.
- Luego email con review.

PR 7 - Dinero canonico minimo:

- Definir frontera `money` vs `treasury`.
- Crear cobro/pago manual minimo si no existe.
- Enlazar con open items y work_unit.

PR 8 - Dashboard por trabajo:

- Drill-down Nueva Palmira desde Inicio.
- Acciones concretas: asignar documento, resolver party, cobrar, pagar, crear tarea.

## 15. Preguntas abiertas

- Rontil quiere que la nav diga `Dinero` o `Tesoreria`?
- Que representa exactamente Nueva Palmira: cliente, plaza, proyecto, sucursal, obra, operacion recurrente?
- Zeta tiene centros de costo equivalentes a trabajos reales o son solo codigos contables?
- Hay sandbox Zeta para escrituras?
- Que endpoints Zeta estan habilitados en produccion para Rontil?
- Los saldos pendientes deben venir de Zeta, de Convertilabs o de una reconciliacion entre ambos?
- Que datos llegan hoy desde la web de Rontil?
- Las cotizaciones comerciales llegan por formulario, email, WhatsApp, telefono o mezcla?
- Que nivel de automatizacion se acepta para crear trabajos desde email?
- Quien aprueba una cotizacion o convierte una solicitud en trabajo?
- Que significa "margen" para Rontil: margen documental, margen cobrado, margen devengado, margen despues de gastos bancarios?
- Los vales bancarios afectan margen de trabajos o solo posicion financiera global?
- Que eventos deben bloquear cierre operativo mensual?
- Que procesos criticos dependen de una persona y deben entrar primero en continuidad?

## 16. Conclusión cruda

Convertilabs 2.0 no es una idea sobre papel: el repo ya contiene buena parte del esqueleto. Hay modelo madre, trabajos, parties, dinero, tesoreria, operaciones, Zeta, dashboard y tests.

Pero todavia no es el sistema operativo de Rontil. Le falta el nervio operativo: capturar una oportunidad/cotizacion, convertirla en trabajo, arrastrar ventas/gastos reales, mostrar margen y pendientes, y obligar al tablero a decir que hacer hoy.

La prioridad no deberia ser otro modulo grande. La prioridad deberia ser cerrar un caso real hasta el final.

Nueva Palmira es el corte correcto. Si Nueva Palmira funciona con datos trazables, margen visible, deudas visibles y tareas accionables, la refundacion tiene piso. Si no funciona, todo lo demas queda como arquitectura prometedora alrededor de un flujo todavia incompleto.
