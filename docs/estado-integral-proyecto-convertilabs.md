# Convertilabs - Documento integral de estado del proyecto

Fecha de corte: 2026-07-03  
Zona de trabajo relevada: `America/Montevideo`  
Repositorio local: `C:\Users\jmsos\_desarrollo_web\convertilabs`  
Rama relevada: `testing`  
Ultimo commit relevado: `4f84ef4` / `4f84ef47d39d50ed32d7faaa48554eeb488c6ba3`  
Mensaje de ultimo commit: `arreglando Dinero`  
Fecha de ultimo commit: `2026-07-02 13:32:29 -0300`

## 1. Proposito de este documento

Este documento compacta la documentacion viva, la arquitectura, el estado funcional, el modelo de datos, las integraciones, las pruebas y las decisiones pendientes de Convertilabs en una sola fuente de lectura para un equipo de trabajo.

La intencion no es repetir cada archivo existente, sino dejar una foto accionable y profunda: que es Convertilabs, que partes ya existen, como se conectan, que se comprobo localmente, que no esta validado aun con sistemas reales y cuales son las mejores decisiones siguientes.

Notas importantes de lectura:

- No se leyo ni se copio ningun secreto de `.env`, `.env.local` u otros archivos sensibles. La configuracion documentada sale de `.env.example` y de `lib/env.ts`.
- Hay documentos historicos que describen PRs futuros o incompletos. Cuando hay conflicto, este documento prioriza el codigo actual, `docs/plan_de_accion_convertilabs2_PRs_analisis.md`, tests vigentes y estado del repositorio.
- La documentacion viva indica que PR 1 a PR 14 estan OK. La escritura contable controlada hacia Zeta, especialmente Bandeja de Entrada de Asientos, queda como PR futuro.
- La validacion de esta lectura fue local. No sustituye una prueba con Supabase productivo, credenciales reales de Zeta, Inngest cloud, email real, bancos ni datos reales completos de Rontil.

## 2. Resumen ejecutivo

Convertilabs ya no debe tratarse como una bandeja de documentos ni como un prototipo aislado. La tesis actual del proyecto es construir el sistema operativo integral de gestion de Rontil: una capa propia que conecta hechos operativos, personas/empresas, trabajos, documentos, dinero, contabilidad, impuestos, tareas, procesos y decisiones.

El producto no busca reemplazar Zeta, la web, el email, los bancos ni los procesos humanos. Busca tomar esos sistemas como fuentes, conservar evidencia, normalizar informacion y darle a Rontil una vista operativa propia para decidir y ejecutar.

El loop operativo minimo ya esta representado en codigo:

```text
solicitud/cotizacion
  -> party/contacto
  -> work_unit/trabajo
  -> documentos de venta y gasto
  -> margen documental
  -> open items / dinero pendiente
  -> tareas / procesos / obligaciones
  -> Inicio como tablero madre
```

El caso de aceptacion principal sigue siendo Nueva Palmira: desde una solicitud o cotizacion, asociar cliente, crear o vincular trabajo, adjuntar documentos de venta y gasto, ver margen, ver cobros/pagos pendientes, generar tareas y verlo todo desde Inicio.

Estado general:

- Arquitectura base: solida y modular.
- Modelo canonico: implementado en SQL, migraciones, RLS, servicios y tests.
- Navegacion operativa: implementada como Inicio, Trabajos, Documentos, Dinero, Agenda y Mas.
- Dominio de trabajos: implementado con `work_units`, intake, clientes, documentos, margen, open items y eventos.
- Dominio de documentos: implementado con upload, pipeline IA/Inngest, revision, drafts, line items, duplicados, spreadsheet imports y posting.
- Dominio contable: implementado con reglas, templates, role maps, propuestas, asientos, open items, read models y guardrails.
- Dominio Dinero/Tesoreria: implementado como tablero de deudores/acreedores y MVP de caja, bancos, vales, reservas, alertas y proyeccion.
- Dominio de operaciones: implementado con tareas, procesos, obligaciones, continuidad, capturas y senales para Inicio.
- Integracion Zeta: fuerte en modo read-only, normalizacion, raw records, materializacion canonica y tests; escrituras contables a Bandeja siguen como futuro controlado.
- Calidad local: `npm test` y `npm run typecheck` pasan. `npm run lint` falla por 1 error `prefer-const` y muestra 2 warnings.

Diagnostico sintetico:

Convertilabs esta listo para dejar de preguntarse "que plataforma hay que imaginar" y pasar a decidir "que flujo real de Rontil se va a pilotear y endurecer primero". El mayor riesgo ya no es ausencia de modelo, sino falta de validacion operacional con datos reales, usuarios reales e integraciones reales.

## 3. Decisiones que el equipo puede tomar ahora

### 3.1 Decision principal recomendada

Hacer un piloto interno acotado, con datos reales, sin agregar grandes features nuevas, durante una semana de uso diario.

Objetivo del piloto:

- Cargar o sincronizar datos reales suficientes de Rontil.
- Ejecutar el flujo Nueva Palmira de punta a punta.
- Usar Inicio, Trabajos, Documentos, Dinero y Agenda todos los dias.
- Registrar fricciones reales en `docs/piloto-interno-rontil-hallazgos.md`.
- Decidir desde evidencia si el siguiente bloque debe ser Zeta read-only productivo, Zeta write, bancos/caja, documentos o procesos.

### 3.2 Alternativas estrategicas

Opcion A - Piloto operativo primero:

- Congela features nuevas.
- Arregla hygiene minima.
- Carga Rontil real.
- Corre Nueva Palmira, pagos/cobros, IVA/cierre simple y procesos criticos.
- Mejor si el equipo necesita aprender como se comporta el producto en la realidad.

Opcion B - Zeta read-only productivo primero:

- Valida credenciales reales.
- Corre health check, contactos, centros de costo, facturas de venta, CFEs recibidos, plan de cuentas y conceptos.
- Materializa entidades canonicas y detecta casos ambiguos.
- Mejor si el cuello de botella es confianza en la fuente Zeta.

Opcion C - Dinero/Tesoreria diario primero:

- Usa bancos, vales, open items y manual receivables como ritual de caja diaria.
- Enfoca caja libre, compromisos, vencimientos y alertas.
- Mejor si la urgencia de negocio es liquidez y compromisos.

Opcion D - Documentos/contabilidad primero:

- Endurece pipeline de documentos, revision, templates, asientos y open items.
- Mejor si el dolor principal es carga administrativa, conciliacion y cierre mensual.

Opcion E - Zeta write controlado:

- Solo despues de validar lectura, mapeos, duplicados, runbook y aprobacion humana.
- No deberia ser el primer paso si no se hizo piloto real.

## 4. Tesis de producto

Convertilabs 2.0 se define como el sistema operativo de gestion de Rontil.

No es:

- Un ERP generico.
- Un reemplazo directo de Zeta.
- Una bandeja de PDFs.
- Una suite de pantallas desconectadas.
- Un asistente IA que toma decisiones irreversibles.

Si es:

- Una capa canonica propia para interpretar la empresa.
- Un integrador de fuentes externas.
- Un sistema de seguimiento de trabajo, dinero, documentos y procesos.
- Un tablero de decisiones basado en hechos y evidencia.
- Un mecanismo para que IA sugiera, pero humanos validen.

Modelo mental oficial:

```text
hecho operativo
  -> party/contacto
  -> work_unit/trabajo
  -> document/evidencia
  -> dinero
  -> contabilidad
  -> IVA/cumplimiento
  -> tareas/procesos
  -> Inicio
```

Reglas conceptuales:

- `party` es la entidad canonica para clientes, proveedores, bancos, instituciones, contador, empleados, socios y otros actores.
- `contact` representa personas o canales dentro de un `party`.
- `work_unit` representa trabajos, proyectos, operaciones, areas, centros de costo o unidades de gestion.
- `document` representa evidencia documental normalizada, con referencia a origen.
- `business_event` registra hechos operativos.
- `financial_event`, `open_item`, `payment`, `collection`, `journal_entry` y similares conectan dinero y contabilidad.
- `task`, `process`, `obligation` e `interaction` conectan acciones humanas y continuidad operativa.
- Los IDs externos de Zeta, web, email u otros sistemas son referencias, no claves primarias internas.

## 5. Estado Git y calidad local

Estado Git relevado al inicio:

- Rama: `testing`.
- Relacion remota: `origin/testing`.
- Worktree: limpio antes de generar este documento.
- Ultimo commit: `4f84ef4` (`arreglando Dinero`).

Comandos de calidad ejecutados localmente en esta revision:

```text
npm test
```

Resultado:

- Pasa.
- `442` tests ejecutados.
- `442` pasan.
- `0` fallos.

```text
npm run typecheck
```

Resultado:

- Pasa.
- `next typegen` genero tipos de rutas correctamente.
- `tsc --noEmit` finalizo sin errores.

```text
npm run lint
```

Resultado:

- Falla.
- 1 error:
  - `modules/money/repository.ts:282:15` - `error` nunca se reasigna; ESLint pide `const` (`prefer-const`).
- 2 warnings:
  - `modules/treasury/repository.ts:9:3` - `addDaysIso` definido pero no usado.
  - `tests/money-mvp.test.cjs:189:51` - `query` definido pero no usado.

Lectura:

- La base funcional tiene muy buena cobertura local.
- El bloqueo de lint parece hygiene menor y de bajo riesgo, pero deja CI/lint rojo hasta corregirse.
- No se ejecuto `npm run build` en este relevamiento.

## 6. Stack tecnico

Tecnologias principales:

- Next.js `^15.5.19`.
- React `19.1.0`.
- React DOM `19.1.0`.
- TypeScript `^5`.
- Supabase SSR `^0.9.0`.
- Supabase JS `^2.99.1`.
- Inngest `3.54.0`.
- OpenAI via configuracion propia y pipeline de Responses.
- Tailwind/CSS segun estructura Next y estilos existentes.
- `react-markdown` para rendering Markdown.
- Node requerido: `>=20.19.0`.

Scripts principales en `package.json`:

```text
npm run dev
npm run inngest:dev
npm run build
npm run start
npm run lint
npm test
npm run typecheck
npm run pilot:summary
npm run zeta:sync:contacts
npm run documents:repair:stale-processing
npm run db:generate:migration
npm run db:verify:parity
```

Tambien existen scripts de smoke DB y scripts TWA/mobile.

## 7. Estructura del repositorio

Directorios principales:

```text
app/                 Rutas Next App Router, APIs, server actions y pantallas.
components/          Componentes UI por dominio y shells.
modules/             Logica de dominio: types, services, repositories, loaders.
db/                  Schema SQL canonico, RLS, README y helpers DB.
supabase/migrations/ Migraciones incrementales.
docs/                Documentacion viva, playbooks, analisis y planes.
tests/               Suite local de tests CJS.
lib/                 Env, Supabase clients, utilidades compartidas.
data/                Datos de apoyo/catalogos.
scripts/             Scripts operativos.
android-twa/         Configuracion/artefactos para Trusted Web Activity.
public/              Assets publicos.
```

Convencion arquitectonica:

- La UI debe depender de `modules/`, no al reves.
- Cada dominio importante usa combinacion de `types`, `service`, `repository`, loaders y componentes.
- Las server actions viven cerca de rutas privadas cuando mutan datos.
- Las relaciones criticas se modelan con FKs directas. `entity_links` se reserva para trazabilidad, relaciones secundarias o compatibilidad.
- Los cambios persistentes deben incluir schema, migracion, RLS, servicios/tests y documentacion cuando aplique.

## 8. Navegacion y superficies

Navegacion privada canonica:

| Seccion | Ruta principal | Proposito |
| --- | --- | --- |
| Inicio | `/app/o/[slug]/dashboard` | Tablero madre operativo. |
| Trabajos | `/app/o/[slug]/work` | Trabajos, solicitudes, intake, margen. |
| Documentos | `/app/o/[slug]/documents` | Upload, revision, procesamiento, asignacion. |
| Dinero | `/app/o/[slug]/money` | Deudores, acreedores, caja, bancos, vales. |
| Agenda | `/app/o/[slug]/agenda` | Tareas, obligaciones, IVA/cierre, operaciones. |
| Mas | `/app/o/[slug]/advanced` | Acceso a dominios expertos. |

Rutas privadas relevantes:

- `/app/o/[slug]/work`
- `/app/o/[slug]/work/[workUnitId]`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/documents/pending-assignment`
- `/app/o/[slug]/documents/[documentId]/original`
- `/app/o/[slug]/money`
- `/app/o/[slug]/money/vales/[valeId]`
- `/app/o/[slug]/agenda`
- `/app/o/[slug]/directory`
- `/app/o/[slug]/directory/[partyId]`
- `/app/o/[slug]/processes`
- `/app/o/[slug]/continuity`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/tax/reconciliation`
- `/app/o/[slug]/close`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/rules`
- `/app/o/[slug]/field`
- `/app/o/[slug]/field/upload`
- `/app/o/[slug]/field/activity`
- `/app/o/[slug]/field/projects`

Rutas legacy/canonicas:

- `/app/o/[slug]/treasury` y `/app/o/[slug]/tesoreria` redirigen a `/app/o/[slug]/money`.
- Existen rutas top-level legacy para compatibilidad en `/work`, `/documents`, `/review`, `/money`, `/treasury` y otras.

APIs relevantes:

- `/api/health`
- `/api/ready`
- `/api/inngest`
- `/api/integrations/rontil-web/work-intake`
- `/api/preset-ai-recommendation`
- `/api/preset-ai-recommendation/cost-center-draft`
- `/api/v1/auth/login`
- `/api/v1/auth/signup`
- `/api/v1/documents/[documentId]/processing-status`

## 9. Modelo de datos

### 9.1 Cobertura SQL

El schema canonico vive en `db/schema/`.

Resumen extraido del repositorio:

- 130 tablas declaradas.
- 35 enums.
- 6 vistas contables/read models.
- RLS habilitado en 84 tablas.

Vistas detectadas:

- `v_balance_sheet`
- `v_income_statement`
- `v_journal_entries_read`
- `v_journal_lineage`
- `v_open_items_outstanding`
- `v_trial_balance`

Orden canonico de aplicacion de schema segun `db/README.md`:

1. `00_extensions`
2. `01_enums`
3. `02_identity_and_tenants`
4. `03_master_data`
5. `04_documents`
6. `05_accounting`
7. `06_tax_and_rules`
8. `07_integrations_and_audit`
9. `08_document_ai_pipeline`
10. `09_accounting_read_models`
11. `10_company_mother_model`
12. `11_legacy_bridges`
13. `12_operations_communications`
14. `13_operational_intelligence`
15. `14_treasury`
16. `15_work_intake`
17. RLS

### 9.2 Grupos principales de tablas

Identidad y tenancy:

- `profiles`
- `organizations`
- `organization_members`

Master data y directorio:

- `parties`
- `party_roles`
- `party_identifiers`
- `contacts`
- `party_contacts`
- `vendors`
- `vendor_aliases`
- `customers`
- `chart_of_accounts`
- `account_groups`
- `account_role_bindings`
- `currencies`
- `exchange_rates`
- `journal_types`
- `uy_locations`

Trabajo y modelo madre:

- `work_units`
- `business_events`
- `entity_links`
- `evidence_refs`
- `organization_cost_centers`

Documentos:

- `documents`
- `document_extractions`
- `document_relations`
- `document_processing_runs`
- `document_field_candidates`
- `document_classification_candidates`
- `document_drafts`
- `document_draft_steps`
- `document_draft_autosaves`
- `document_line_items`
- `document_accounting_contexts`
- `document_confirmations`
- `document_revisions`
- `document_invoice_identities`
- `document_assignment_runs`
- `document_source_refs`

Contabilidad:

- `accounting_rules`
- `accounting_rule_events`
- `accounting_rule_simulations`
- `accounting_rule_ai_threads`
- `accounting_rule_ai_messages`
- `accounting_suggestions`
- `accounting_suggestion_lines`
- `source_events`
- `source_event_facts`
- `posting_proposals`
- `posting_proposal_lines`
- `posting_decision_logs`
- `journal_entries`
- `journal_entry_lines`
- `ledger_open_items`
- `ledger_settlement_links`
- `organization_accounting_snapshots`

Impuestos y cierre:

- `tax_rules`
- `tax_periods`
- `tax_period_document_selections`
- `vat_runs`
- `dgi_reconciliation_runs`
- `dgi_reconciliation_buckets`
- `fiscal_periods`
- `close_check_runs`
- `close_check_results`
- `fiscal_period_transition_logs`
- `vat_form_exports`

Integraciones y auditoria:

- `api_clients`
- `api_keys`
- `webhook_subscriptions`
- `organization_integration_connections`
- `integration_sync_runs`
- `integration_sync_cursors`
- `integration_raw_records`
- `integration_entity_links`
- `organization_cfe_email_connections`
- `audit_log`
- `system_actors`
- `exports`
- `organization_spreadsheet_import_runs`

IA/asistente:

- `assistant_personas`
- `assistant_threads`
- `assistant_runs`
- `assistant_run_evidence_refs`
- `assistant_messages`
- `assistant_suggestions`
- `assistant_suggestion_evidence_refs`
- `ai_decision_logs`
- `organization_profile_versions`
- `organization_business_profile_versions`
- `organization_business_profile_activities`
- `organization_business_profile_traits`
- `organization_preset_applications`
- `organization_preset_ai_runs`
- `organization_rule_snapshots`

Operaciones y continuidad:

- `tasks`
- `processes`
- `process_versions`
- `process_steps`
- `process_runs`
- `process_run_steps`
- `obligations`
- `obligation_occurrences`
- `interactions`
- `interaction_participants`
- `interaction_links`
- `capture_notes`
- `continuity_risks`
- `operational_suggestions`

Tesoreria:

- `treasury_bank_accounts`
- `treasury_bank_balance_snapshots`
- `treasury_vales`
- `treasury_vale_terms`
- `treasury_vale_events`
- `treasury_manual_receivables`
- `treasury_reserve_rules`

Intake comercial:

- `work_intake_items`

### 9.3 Enums clave

Enums relevantes:

- `member_role`
- `document_direction`
- `document_status`
- `document_posting_status`
- `document_processing_run_status`
- `document_draft_status`
- `entry_status`
- `journal_posting_mode`
- `tax_type`
- `tax_period_status`
- `fiscal_period_status`
- `party_role_type`
- `party_identifier_type`
- `work_unit_kind`
- `work_unit_status`
- `business_event_type`
- `entity_type`
- `entity_relation_type`
- `evidence_ref_type`
- `account_type`
- `normal_side`
- `export_status`
- `rule_scope`
- `accounting_rule_status`

### 9.4 Canon vs legacy

Regla general:

- `party` reemplaza conceptualmente a `vendor` y `customer`, pero los bridges legacy sobreviven.
- `work_unit` reemplaza conceptualmente a `organization_cost_centers`, pero el centro de costo sigue como puente cuando corresponde.
- `documents.work_unit_id` es preferido sobre `documents.cost_center_id`.
- `ledger_open_items.party_id` y `ledger_open_items.work_unit_id` conectan dinero con actores y trabajos.
- `tasks.party_id` y `tasks.work_unit_id` conectan acciones humanas con contexto operativo.
- `work_intake_items.party_id` y `work_intake_items.work_unit_id` permiten pasar de solicitud a trabajo real.

Uso de `entity_links`:

- No debe reemplazar FKs criticas.
- Sirve para relaciones secundarias, evidencia, trazabilidad y compatibilidad.

Deuda activa:

- Algunas pantallas y servicios todavia pueden exponer vocabulario o bridges legacy.
- La migracion de `cost_center` a `work_unit` requiere pruebas con datos reales.
- Casos ambiguos de Zeta deben resolverse por revision humana, no por autoasignacion silenciosa.

## 10. Dominio Inicio

Inicio es el tablero madre de Convertilabs.

Piezas principales:

- `app/app/o/[slug]/dashboard/page.tsx`
- `modules/presentation/company-home-loader.ts`
- `modules/presentation/company-home.ts`
- `components/dashboard/company-home-dashboard.tsx`

Que carga:

- Documentos de la organizacion.
- Trabajos recientes.
- Totales por `work_unit`.
- Parties recientes.
- Intakes abiertos.
- Open items desde `v_open_items_outstanding`.
- Dashboard de tesoreria.
- Senales de operaciones: tareas, procesos, capturas, cierre, IVA.

Que muestra:

- Solicitudes/cotizaciones pendientes.
- Trabajos activos.
- Documentos accionables.
- Dinero y caja.
- Agenda operativa.
- IVA y cierre.
- Riesgos de continuidad.
- Acciones concretas: revisar intakes, asociar clientes, resolver documentos, mirar vencidos, desbloquear tareas.

Patron importante:

- No inventa KPIs si falta data.
- Degrada con honestidad si una relacion o tabla falta.
- Prioriza bloqueos reales y acciones humanas.

## 11. Dominio Trabajos

Trabajos es la superficie donde la operacion deja de ser documento suelto y pasa a ser unidad gestionable.

Piezas principales:

- `modules/work/types.ts`
- `modules/work/service.ts`
- `modules/work/repository.ts`
- `modules/work/work-unit-financial-summary.ts`
- `components/work/work-list-page.tsx`
- `components/work/work-detail-page.tsx`
- `app/app/o/[slug]/work/actions.ts`

`work_unit` soporta tipos como:

- `job`
- `project`
- `operation`
- `department`
- `internal_cost_center`
- `service`
- `maintenance`
- `administration`
- `cost_center`
- `area`

Estados:

- `planned`
- `active`
- `paused`
- `blocked`
- `completed`
- `cancelled`
- `archived`

Capacidades implementadas:

- Listar trabajos.
- Crear trabajos.
- Crear cliente rapido como `party` con rol `customer`.
- Buscar clientes por nombre/RUT.
- Vincular documentos a trabajos.
- Propagar `work_unit_id` a documentos, open items y settlement links.
- Registrar `business_event`.
- Calcular venta documental, costo documental, margen y ratio.
- Mostrar impacto contable/fiscal: asientos, open items, IVA compras, IVA ventas.
- Mostrar documentos relacionados y estados de revision/posting.
- Conectar intakes de origen comercial.

Nueva Palmira esta cubierto por tests:

- El detalle de trabajo computa venta/costo desde documentos vinculados.
- La asociacion de documentos vincula documentos, open items y eventos al trabajo.
- El margen documental queda visible como criterio operativo.

## 12. Work intake: solicitudes, cotizaciones y oportunidades

Piezas principales:

- `modules/work-intake/types.ts`
- `modules/work-intake/service.ts`
- `modules/work-intake/repository.ts`
- `components/work-intake/work-intake-panel.tsx`
- `app/api/integrations/rontil-web/work-intake/route.ts`

Tipos de origen:

- `manual`
- `web_form`
- `email`
- `api`
- `zeta`
- `whatsapp`
- `phone`
- `visit`
- `other`

Estados:

- `captured`
- `needs_review`
- `linked_to_party`
- `linked_to_work`
- `converted_to_work`
- `quoted`
- `won`
- `lost`
- `archived`

Capacidades:

- Crear intake manual.
- Recibir intake web/API tokenizado.
- Construir input desde email.
- Reutilizar intake por idempotency key o external source key.
- Mantener raw payload en integraciones.
- Vincular a `party`.
- Vincular a `work_unit`.
- Convertir intake en trabajo.
- Crear tarea de seguimiento vinculada.
- Registrar `business_event`.
- Revalidar Inicio, Trabajos, Agenda, Documentos y Dinero tras acciones.

Regla de producto:

- La entrada web/email/API no crea automaticamente cliente definitivo, trabajo definitivo, venta ni documento contable.
- Si hay ambiguedad, queda para revision humana.

Endpoint web:

- `POST /api/integrations/rontil-web/work-intake`
- Autenticacion por bearer token o `x-convertilabs-token`.
- Secret validado contra `webhook_subscriptions.secret_hash`.
- Validacion exige contenido y senal de cliente.

## 13. Directorio: parties, contactos e historial

Piezas principales:

- `modules/directory/types.ts`
- `modules/directory/service.ts`
- `modules/directory/repository.ts`
- `components/directory/directory-page.tsx`

Roles soportados:

- `customer`
- `vendor`
- `bank`
- `institution`
- `accountant`
- `employee`
- `partner`
- `transport`
- `internal`
- `other`

Identificadores:

- `rut`
- `tax_id`
- `email`
- `phone`
- codigos Zeta
- `external_code`
- `other`

Capacidades:

- Crear party con roles.
- Normalizar RUT, email y telefono.
- Agregar contactos.
- Listar parties con filtros.
- Cargar perfil completo de party.
- Ver trabajos, documentos, open items, tareas e interacciones relacionadas.
- Mantener bridge con proveedores/clientes legacy.

Lectura:

- Este dominio es clave para dejar de duplicar clientes/proveedores y empezar a razonar sobre actores reales.
- Debe validarse con Rontil real, especialmente dedupe por RUT, nombre y codigos Zeta.

## 14. Documentos

Piezas principales:

- `modules/documents/`
- `components/documents/`
- `app/app/o/[slug]/documents`
- `app/api/v1/documents/[documentId]/processing-status`
- `modules/ai/README.md`

Capacidades documentadas e implementadas:

- Upload privado de PDF/JPG/PNG.
- Preservacion del original.
- Storage path por organizacion.
- Pipeline Inngest para procesamiento.
- Extraccion IA estructurada.
- Candidatos de campos y clasificacion.
- Drafts y steps de revision.
- Autosaves.
- Line items.
- Identidad de factura y dedupe.
- Revision factual separada de asignacion contable.
- Fast lane para documentos resolubles.
- Pending assignment.
- Importacion desde spreadsheets.
- Normalizacion de formatos Zeta-like.
- Duplicados por identidad o referencia externa.
- Reintentos y reparacion de runs stale.
- Vista del documento original.
- Trazabilidad por audit/eventos.

Estados importantes:

- Documento puede estar en procesamiento, revision, bloqueado, listo, posteado o terminal.
- La revision no debe mezclar hecho documental con decision contable sin trazabilidad.
- Duplicados y FX faltante bloquean.
- Manual overrides quedan registrados.

Riesgos/pendientes:

- Validar comportamiento con volumen y documentos reales.
- Validar OpenAI/Inngest contra ambiente real.
- Validar storage/RLS en Supabase desplegado.

## 15. Contabilidad

Piezas principales:

- `modules/accounting/`
- `modules/accounting/README.md`
- `app/app/o/[slug]/journal-entries`
- `app/app/o/[slug]/trial-balance`
- `app/app/o/[slug]/open-items`
- `app/app/o/[slug]/chart-map`
- `app/app/o/[slug]/rules`

Capacidades:

- Normalizacion de documentos.
- Identidad de factura/dedupe.
- Resolucion de proveedor/concepto.
- Reglas contables.
- Templates de posting.
- Role maps de cuentas.
- Sugerencias contables.
- Bloqueos por ambiguedad.
- Manual override.
- Propuestas de posting.
- Asientos contables.
- Lineas de asiento.
- Open items AR/AP.
- Settlements.
- Read models: balance, resultados, mayor/vistas de asientos, trial balance, lineage.
- Export adapter.
- Guardrails de periodos.
- Reversals y ajustes.

Principios:

- La IA sugiere; no materializa acciones irreversibles sin aprobacion.
- Cuentas no imputables no pueden usarse como roles materiales.
- Asientos finales son inmutables o protegidos por guardrails.
- Periodos cerrados bloquean posting.
- Moneda extranjera requiere snapshot FX confiable.

Tests cubren:

- Golden fixtures de compra, venta, pago, cobro, notas de credito, USD y ajustes.
- Reglas, sugerencias, role maps, templates, open items, export, read models y guardrails.

## 16. Dinero y Tesoreria

Piezas principales:

- `modules/money/types.ts`
- `modules/money/repository.ts`
- `components/money/money-dashboard.tsx`
- `app/app/o/[slug]/money/page.tsx`
- `modules/treasury/types.ts`
- `modules/treasury/calculations.ts`
- `modules/treasury/repository.ts`
- `components/treasury/treasury-workspace.tsx`

Dinero canonico:

- Usa `v_open_items_outstanding`.
- Agrupa por party y work unit.
- Resume deudores, acreedores, vencidos, semana y neto.
- Filtra por query, party, work y vencimiento.
- Degrada si el read model viejo no tiene columnas nuevas de `work_unit`.

Tesoreria MVP:

- Bancos/cuentas.
- Snapshots de saldos.
- Vales.
- Terminos de vales.
- Eventos de vales.
- Receivables manuales.
- Reglas de reserva/buffer.
- Alertas.
- Proyeccion 45 dias.
- Simulador de retiro.
- Caja libre calculada como saldo bancario menos vencimientos, compromisos inevitables y reservas.

Reglas clave:

- Receivables no se suman a caja actual.
- Renovacion de vale confirmada impacta intereses, fees y amortizacion.
- Renovacion no confirmada se trata conservadoramente como cierre.
- Cierre de vale usa capital, intereses y fees.
- No se permite borrar en MVP de treasury segun tests/RLS.

Estado:

- Dominio fuerte para piloto de caja.
- Lint actual tiene un warning por import no usado en `modules/treasury/repository.ts`.

## 17. Agenda, operaciones y continuidad

Piezas principales:

- `modules/operations/types.ts`
- `modules/operations/service.ts`
- `modules/operations/repository.ts`
- `components/operations/agenda-dashboard.tsx`
- `app/app/o/[slug]/agenda`
- `app/app/o/[slug]/processes`
- `app/app/o/[slug]/continuity`

Capacidades:

- Crear tareas.
- Vincular tareas a party, work unit y documento.
- Crear procesos con versiones y pasos.
- Publicar version inicial.
- Iniciar corridas de proceso desde version publicada.
- Bloquear pasos.
- Crear obligaciones.
- Crear ocurrencias de obligaciones.
- Capturar notas crudas.
- Detectar riesgos de continuidad.
- Exponer senales de IVA y cierre en Agenda.

Riesgos detectables:

- Procesos criticos sin pasos publicados.
- Procesos criticos sin owner futuro.
- Obligaciones sin owner futuro.
- Tareas bloqueadas.
- Capturas crudas sin estructurar.

Uso esperado en piloto:

- Cargar procesos administrativos reales: pago proveedores, IVA mensual, envio al contador, control banco, renovacion certificado DGI, facturacion/cobro.
- Usar Agenda como lista operativa real, no solo demo.

## 18. IVA, impuestos y cierre

Piezas principales:

- `modules/tax/`
- `app/app/o/[slug]/tax`
- `app/app/o/[slug]/tax/reconciliation`
- `app/app/o/[slug]/close`

Capacidades:

- Motor VAT Uruguay.
- Preview de IVA sin mutar corrida oficial.
- Corridas oficiales por periodo.
- Workbench de periodo.
- Universo de documentos.
- Selecciones, exclusiones y bloqueos.
- DGI reconciliation base.
- VAT form exports.
- Cierre mensual con check runs y results.
- Guardrails de soft close/hard close.
- Conversacion con Inicio y Agenda: flags, blockers y acciones.

Feature flags relevantes:

- `VAT_UY_MVP_ENABLED`
- `VAT_UY_EXPORT_AUTO_DISABLED`
- `VAT_UY_MIXED_USE_MANUAL_REVIEW`
- `VAT_UY_SIMPLIFIED_REGIME_AUTO_DISABLED`

Lectura:

- El dominio esta preparado para un ciclo simple de IVA/cierre.
- Falta validarlo con una corrida real de Rontil y criterios del contador.

## 19. Integraciones

### 19.1 ZetaSoftware

Documentos base:

- `docs/zetasoftware-endpoints-contract.md`
- `docs/zetasoftware-bandeja-contract-notes.md`
- `docs/integrations/zeta-readonly-validation-plan.md`
- `docs/pr-next-zeta-posting-templates-role-map.md`

Codigo principal:

- `modules/integrations/repository.ts`
- `modules/integrations/zeta/client/endpoint-registry.ts`
- `modules/integrations/zeta/services/sync-service.ts`
- `modules/integrations/zeta/canonical-mapping.ts`
- `modules/integrations/zeta/services/materialization-service.ts`
- `modules/integrations/zeta/export/`

Contrato endpoint:

- La coleccion Postman observada contiene 262 endpoints.
- Patron comun: `POST {{baseUrl}}/APIs/<EndpointName>`.
- El cliente usa wrappers especificos por endpoint.

Dominios Zeta relevantes:

- Roles de usuario / health.
- Contactos.
- Datos comerciales de clientes/proveedores.
- Monedas y cotizaciones.
- Centros de costo.
- Tasas de IVA.
- Plan de cuentas.
- Locales.
- Referencias.
- RUTs.
- Tipos de asiento.
- Tipos de documento.
- Facturas de clientes.
- Saldos pendientes de clientes/proveedores.
- CFEs recibidos.
- Bandeja de Entrada de Asientos.
- Facturas proveedor / compras para exportaciones controladas.

Persistencia local:

- Conexiones por organizacion con credenciales cifradas.
- Sync runs.
- Cursors.
- Raw records.
- Source refs de documentos.
- Integration entity links.
- Audit log.
- Hashes de payload y envelopes monetarios.

Streams implementados:

- `contacts`
- `masters`
- `accounting_masters`
- `sales_documents`
- `received_cfes`

Materializacion:

- Contactos Zeta pueden convertirse en `party`, roles, identifiers y external links.
- Centros de costo pueden mapear a `work_unit` o quedar para revision.
- Sales/received CFEs pueden convertirse en `document`, `document_draft`, line items, source refs y auditoria.
- Duplicados se detectan por source refs e identidad de factura.
- Drift de fuente externa queda como cambio pendiente de revision.

Read-only:

- La arquitectura y reglas de docs priorizan Zeta read-only para validacion.
- Las escrituras a Bandeja de Entrada de Asientos quedan como PR futuro con runbook, dry-run, idempotencia, test key y aprobacion humana.

Matiz importante:

- El codigo y tests actuales incluyen un flujo de exportacion controlada de gasto/compra hacia Zeta (`FacturaProveedorAgregar`) con preflight, bloqueo por duplicados, reconciliacion y estados como `timeout_unknown`.
- Eso no equivale a habilitar escritura contable libre ni escritura a Bandeja. Debe tratarse como camino especifico, guardado por reglas y pendiente de validacion real.

### 19.2 Web/API intake

Ya descrito en Work intake.

Estado:

- Implementado.
- Tokenizado.
- Idempotente.
- Conserva raw payload.
- No crea ventas/trabajos definitivos automaticamente.

### 19.3 Email

Estado:

- Existe modelo y builder para intake desde email.
- Existe dominio de conexiones CFE email.
- No consta como conexion productiva final en la documentacion viva.

Decision:

- Usar como fuente revisada, no como automatizacion irreversible.

### 19.4 Inngest

Usos:

- Procesamiento de documentos.
- Encolado de sync Zeta.
- Background automation.

Configuracion:

- `INNGEST_DEV`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_BASE_URL`

El runtime considera configurado Inngest si:

- Esta en dev mode explicitamente, o
- Tiene event key y signing key.

### 19.5 OpenAI

Usos:

- Extraccion y normalizacion documental.
- Mapeo de spreadsheets.
- Recomendaciones de presets.
- Asistente contable.
- Sugerencias operativas.

Guardrail:

- IA sugiere, humanos aprueban.
- Sugerencias quedan con evidencia y decision logs.
- No se deben materializar cambios irreversibles sin aprobacion.

## 20. Configuracion de entorno

Variables principales segun `.env.example` y `lib/env.ts`:

Aplicacion:

- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `VERCEL_PROJECT_PRODUCTION_URL`
- `VERCEL_BRANCH_URL`
- `VERCEL_URL`

Supabase public:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Aliases soportados con prefijo `NEXT_PUBLIC_SUPABASE_CONVERTILABS_*`.

Supabase server:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- Aliases soportados con prefijo `SUPABASE_CONVERTILABS_*`.

OpenAI:

- `OPENAI_API_KEY`
- `OPENAI_PRIMARY_MODEL`
- `OPENAI_MINI_MODEL`
- `OPENAI_USE_MINI_BY_DEFAULT`
- `OPENAI_DOCUMENT_MODEL`
- `OPENAI_RULES_MODEL`
- `OPENAI_ACCOUNTING_MODEL`
- `OPENAI_HTTP_MAX_RETRIES`
- `OPENAI_HTTP_RETRY_DELAY_MS`
- `OPENAI_USAGE_COST_INPUT_USD_PER_1M`
- `OPENAI_USAGE_COST_OUTPUT_USD_PER_1M`

Zeta:

- `ZETASOFTWARE_BASE_URL`
- `ZETASOFTWARE_DESARROLLADOR_CODIGO`
- `ZETASOFTWARE_DESARROLLADOR_CLAVE`
- `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY`
- `ZETASOFTWARE_EMPRESA_CODIGO`
- `ZETASOFTWARE_EMPRESA_CLAVE`
- `ZETASOFTWARE_USUARIOCODIGO`
- `ZETASOFTWARE_ROLCODIGO`
- Perfil opcional `ZETASOFTWARE_RONTIL_*`.

Inngest:

- `INNGEST_DEV`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_BASE_URL`

IVA Uruguay:

- `VAT_UY_MVP_ENABLED`
- `VAT_UY_EXPORT_AUTO_DISABLED`
- `VAT_UY_MIXED_USE_MANUAL_REVIEW`
- `VAT_UY_SIMPLIFIED_REGIME_AUTO_DISABLED`

Reglas de seguridad:

- No commitear secretos.
- Preferir credenciales Zeta cifradas en `organization_integration_connections` para produccion.
- Usar fallback de env solo en desarrollo/controlado.
- El service role debe permanecer server-only.

## 21. Migraciones Supabase

Migraciones presentes:

- `20260311_auth001_profiles_ssr.sql`
- `20260311_create_profiles_and_auth_sync.sql`
- `20260311_dash001_private_dashboard.sql`
- `20260311_doc001_documents_upload.sql`
- `20260311_doc001_document_status_enum.sql`
- `20260311_org001_organizations_onboarding.sql`
- `20260311_sync_canonical_schema_and_rls.sql`
- `20260312_doc002_ai_pipeline_and_profiles.sql`
- `20260312_doc003_ai_pipeline_rls.sql`
- `20260312_tax001_uy_vat_profile_alignment.sql`
- `20260313_doc004_invoice_identity_dedupe.sql`
- `20260313_doc005_accounting_memory_vat_exports.sql`
- `20260313_doc006_inngest_document_processing.sql`
- `20260314_doc007_step4_foundations.sql`
- `20260314_doc008_step4_accounting_resolution.sql`
- `20260314_doc009_spreadsheet_import_runs.sql`
- `20260314_doc010_step4_remaining_domain.sql`
- `20260314_doc011_step5_domain_foundations.sql`
- `20260314_fix_db_parity.sql`
- `20260315_doc012_step5_location_reasonability.sql`
- `20260315_doc013_step6_onboarding_presets.sql`
- `20260315_doc014_workflow_separation_foundations.sql`
- `20260315_doc015_preset_ai_hybrid_recommendations.sql`
- `20260315_doc016_business_profile_catalog_version.sql`
- `20260317_doc012_accounting_kernel_foundations.sql`
- `20260317_int002_cfe_email_connections.sql`
- `20260318_doc013_accounting_read_models.sql`
- `20260318_doc015_document_spreadsheet_import_bucket.sql`
- `20260320_close001_period_close_and_assistant_runs.sql`
- `20260322_doc017_accounting_assistant_threads.sql`
- `20260322_tax018_period_workbench.sql`
- `20260324_rule001_accounting_rules_admin_foundations.sql`
- `20260324_rule002_accounting_rules_admin_simulations_and_ai.sql`
- `20260403_mobile001_field_cost_centers.sql`
- `20260419_chart_of_accounts_provider_mirror.sql`
- `20260419_integration_foundation.sql`
- `20260419_repair_current_db_parity.sql`
- `20260617_pr01_company_mother_model.sql`
- `20260617_pr02_legacy_bridges.sql`
- `20260617_pr04_zeta_sync_runner.sql`
- `20260617_pr06_money_work_unit_read_model.sql`
- `20260617_pr07_pr09_operations_communications.sql`
- `20260617_pr12_operational_intelligence.sql`
- `20260618_pr14_treasury_mvp.sql`
- `20260623_pr07_work_intake_items.sql`

Lectura:

- La historia de migraciones muestra una primera etapa centrada en auth/documentos/contabilidad/IVA y una segunda etapa fuerte Convertilabs 2.0 desde junio 2026.
- Es recomendable correr `npm run db:verify:parity` contra el ambiente real antes de piloto.

## 22. Pruebas

La suite tiene 106 archivos `*.test.cjs`.

Cobertura por temas:

- Account role maps.
- Roles contables.
- Assistant/personas.
- Auditoria UI contable.
- Bootstrap contable.
- Dominio contable.
- Export adapter.
- Fiscal integration MVP.
- Golden fixtures.
- Imports.
- Kernel contable.
- Guardrails de periodo.
- Read models.
- Rules admin.
- Suggestions.
- Activity catalog/search.
- Tax export assistant.
- BCU FX.
- CFE email settings.
- Chart map.
- Close schema/service.
- Company home dashboard.
- Company mother model schema/services.
- Decision log.
- DGI reconciliation.
- Directory/communications.
- Document audit/decision/review/intake/upload/processing/spreadsheet/pagination.
- FX policy.
- Hardening pilot.
- Help hints.
- Import operations/review policy.
- Ingestion hooks.
- Inngest document processing.
- Integration foundation/helpers.
- Invite-only signup.
- Journal adjustments.
- Launch scope.
- Location risk engine.
- Money MVP.
- MVP navigation.
- Onboarding schema.
- Open items.
- OpenAI responses.
- Operational intelligence.
- Operations MVP.
- Ops health.
- Organization identity/RPC guardrails.
- Posting templates/resolver.
- Preset AI recommendation.
- Private dashboard shell.
- Review queue.
- Rontil pilot.
- Spreadsheet schema/imports.
- Tax canonical/period/VAT.
- Transaction family resolution.
- Treasury calculations/repository/schema.
- Work customer search.
- Work intake.
- Work MVP.
- Workflow state.
- Zeta mapping, materialization, credentials, endpoints, exports, REST client, sync runner.

Senal fuerte:

- La suite no es superficial. Cubre dominios de negocio, schema, compatibilidad, guardrails, integraciones y edge cases.

Senal debil:

- Tests locales no sustituyen pruebas end-to-end con infraestructura externa real.
- No se corrio Playwright/browser visual en este relevamiento.

## 23. Caso de aceptacion Nueva Palmira

Documento base:

- `docs/playbooks/nueva-palmira-acceptance-test.md`

Flujo esperado:

1. Cargar o recibir solicitud/cotizacion Nueva Palmira.
2. Verla en Trabajos, seccion de solicitudes/cotizaciones.
3. Asociar o crear cliente como `party`.
4. Convertir o vincular a `work_unit`.
5. Crear tarea de seguimiento.
6. Asociar documentos de venta.
7. Asociar documentos de gasto.
8. Ver margen documental.
9. Ver cobros/pagos pendientes en Dinero.
10. Ver acciones pendientes en Inicio.

Tests asociados:

- `work-mvp`
- `work-intake`
- `work-intake-schema`
- `money-mvp`
- `company-home-dashboard`

Criterio de exito:

- El trabajo no es solo una ficha.
- Debe conectar solicitud, cliente, documentos, dinero, margen y tareas.

## 24. Documentacion viva relevante

Archivos de lectura obligatoria:

- `README.md`
- `docs/README.md`
- `docs/convertilabs-2.0-baseline-arquitectura.md`
- `docs/analisis-arquitectura-convertilabs-2.0.md`
- `docs/plan_de_accion_convertilabs2_PRs_analisis.md`
- `docs/agent_rules.md`
- `docs/convertilabs-2.0-navigation-and-domains.md`
- `docs/convertilabs-2.0-canonical-model-and-bridges.md`

Integraciones:

- `docs/integrations/zeta-readonly-validation-plan.md`
- `docs/integrations/work-intake-web-email.md`
- `docs/zetasoftware-endpoints-contract.md`
- `docs/zetasoftware-bandeja-contract-notes.md`
- `docs/pr-next-zeta-posting-templates-role-map.md`

Playbooks y piloto:

- `docs/playbooks/nueva-palmira-acceptance-test.md`
- `docs/pr-13-hardening-piloto-interno.md`
- `docs/piloto-interno-rontil-hallazgos.md`

Estado de PRs segun plan vivo:

- PR 1 - Baseline Convertilabs 2.0 y reglas de arquitectura: OK.
- PR 2 - Lenguaje, navegacion y frontera Dinero/Tesoreria: OK.
- PR 3 - Modelo canonico y bridges legacy: OK.
- PR 4 - Fixture/playbook Nueva Palmira: OK.
- PR 5 - Zeta read-only validation: OK.
- PR 6 - Mapping Zeta a party/work_unit/document con resolucion humana: OK.
- PR 7 - Intake manual de cotizaciones/oportunidades: OK.
- PR 8 - Intake web/API tokenizado: OK.
- PR 9 - Intake email con revision humana: OK.
- PR 10 - Dinero canonico minimo: OK.
- PR 11 - Margen documental estimado por trabajo: OK.
- PR 12 - Vista de Trabajo Nueva Palmira: OK.
- PR 13 - Inicio ejecutivo Convertilabs 2.0: OK.
- PR 14 - Procesos administrativos minimos: OK.
- PR futuro - Escritura controlada a Zeta.

## 25. Riesgos y deudas actuales

### 25.1 Riesgos tecnicos

- `npm run lint` falla por 1 error `prefer-const`.
- Hay 2 warnings de lint por variables/imports no usados.
- No se ejecuto build en este relevamiento.
- No se valido Supabase real ni RLS real en este turno.
- No se valido Inngest cloud.
- No se valido OpenAI real con documentos de produccion.
- No se hizo smoke browser manual ni screenshot.

### 25.2 Riesgos de integracion

- Zeta read-only necesita validacion contra endpoints reales y datos reales.
- Centros de costo Zeta pueden no mapear 1:1 a `work_unit`.
- Contactos duplicados o sin RUT requieren resolucion humana.
- Ventas sin centro de costo deben quedar como documento + pendiente de asignacion.
- Escrituras a Zeta requieren dry-run, idempotencia, runbook, cleanup y aprobacion humana.
- Email productivo aun no esta probado como fuente estable.
- Bancos no estan integrados automaticamente; tesoreria depende de snapshots/manual data.

### 25.3 Riesgos de producto

- Construir mas pantallas sin piloto puede esconder problemas reales.
- Si el equipo intenta reemplazar Zeta demasiado pronto, aumenta riesgo operativo.
- Si se automatizan decisiones contables sin aprobacion humana, se rompe el principio central.
- Si `work_unit` se usa como etiqueta generica sin disciplina, se pierde margen real por trabajo.
- Si Inicio se llena de metricas inventadas, pierde confianza.

### 25.4 Riesgos de datos

- Legacy vendors/customers/cost centers deben migrar con cuidado.
- Dedupe de party depende de RUT, aliases y codigos externos.
- Moneda extranjera necesita FX confiable.
- Open items en distintas monedas no se auto-settlean.
- Documentos duplicados o con drift externo deben quedar bloqueados/revisados.

## 26. Preguntas abiertas para el equipo

Producto:

- Cual es el primer flujo real que Rontil quiere operar todos los dias: Nueva Palmira, caja, documentos, IVA/cierre o procesos?
- Que define "exito" del piloto de una semana?
- Quien sera el usuario responsable de Inicio?
- Quien tendra autoridad para aprobar asientos, cierres y exports?

Datos:

- Cual es la regla operativa para convertir centro de costo Zeta en `work_unit`?
- Que datos de Zeta son confiables hoy y cuales requieren revision?
- Como se tratara un cliente/proveedor sin RUT o con nombre ambiguo?
- Cual sera la fuente de verdad de saldos bancarios?

Integraciones:

- Se validara primero Zeta read-only completo antes de cualquier write?
- Que operaciones, si alguna, se habilitaran para escritura hacia Zeta?
- Se usara email como fuente de CFEs o solo como intake revisado?
- Inngest correra cloud o dev en piloto?

Operacion:

- Que procesos administrativos son criticos y quien los conoce?
- Que tareas recurrentes deben aparecer en Agenda?
- Que bloqueos de IVA/cierre debe ver Inicio?
- Que decisiones no debe tomar nunca la IA?

## 27. Recomendacion de proximo plan

### 27.1 Primeras 24 horas

1. Corregir lint minimo:
   - `modules/money/repository.ts:282:15`
   - `modules/treasury/repository.ts:9:3`
   - `tests/money-mvp.test.cjs:189:51`
2. Correr:
   - `npm run lint`
   - `npm test`
   - `npm run typecheck`
   - `npm run build`
3. Confirmar ambiente Supabase objetivo.
4. Correr `npm run db:verify:parity` contra ambiente objetivo.
5. Definir usuarios y roles del piloto.

### 27.2 Primera semana

1. Cargar organizacion Rontil real.
2. Cargar parties iniciales:
   - contador
   - banco principal
   - clientes clave
   - proveedores clave
   - organismos
   - contactos internos
3. Cargar procesos iniciales:
   - pago proveedores
   - preparacion IVA mensual
   - envio documentos contador
   - control banco
   - renovacion certificado DGI
   - facturacion/cobro
4. Ejecutar Nueva Palmira real o fixture realista.
5. Usar Dinero/Tesoreria diariamente.
6. Registrar hallazgos en `docs/piloto-interno-rontil-hallazgos.md`.
7. Al final de la semana, decidir siguiente bloque.

### 27.3 Segundo bloque recomendado

Si el piloto confirma valor:

- Validar Zeta read-only con credenciales reales.
- Materializar contactos, centros de costo, ventas y CFEs recibidos.
- Armar bandeja de resolucion humana para duplicados/ambiguos.
- Comparar margen Nueva Palmira con Zeta/documentos reales.

### 27.4 Tercer bloque posible

Solo despues:

- Evaluar escritura controlada a Zeta.
- Empezar por el flujo mas acotado y reversible.
- Mantener runbook, test key, dry-run, idempotencia y reconciliacion.

## 28. Como presentar este proyecto al equipo

Mensaje corto:

> Convertilabs es una capa operativa propia para Rontil. Ya tiene el modelo y muchas piezas implementadas: trabajos, documentos, dinero, contabilidad, IVA, tareas, procesos, Zeta read-only e Inicio. El siguiente paso no es imaginar otro sistema, sino pilotear un flujo real y decidir con evidencia que endurecer.

Mensaje tecnico:

> El repositorio contiene una arquitectura modular Next/Supabase con 130 tablas, 84 tablas con RLS, 106 archivos de tests y 442 tests pasando. El modelo canonico gira alrededor de party, work_unit, document, business_event, open_items, journal_entries, tasks y process. Hay bridges legacy para vendors/customers/cost centers y guardrails para IA, contabilidad y Zeta.

Mensaje de riesgo:

> La deuda principal es validacion real, no falta de codigo. Zeta, Supabase, email, bancos, Inngest y documentos reales deben probarse antes de automatizar escrituras o expandir features.

Mensaje de decision:

> El equipo debe elegir un piloto operacional concreto. Recomendacion: Nueva Palmira + dinero + agenda durante una semana, con Rontil real.

## 29. Anexo: inventario de modulos por dominio

Auth:

- `modules/auth/`
- Supabase SSR.
- Invite-only signup.
- Confirmacion email.
- Middleware de sesion.
- Guards de rutas privadas.

Organizations:

- `modules/organizations/`
- Tenancy.
- Members.
- Settings.
- Business profile.
- Feature flags.
- Private nav.

Documents:

- `modules/documents/`
- Upload, review, AI pipeline, spreadsheet import, posting, original preservation.

Accounting:

- `modules/accounting/`
- Reglas, templates, role maps, suggestions, proposals, journals, open items.

Tax:

- `modules/tax/`
- VAT Uruguay, workbench, DGI reconciliation, exports.

AI:

- `modules/ai/`
- Responses, extraction, mapping, recommendation, assistant lanes.

Work:

- `modules/work/`
- Work units, margins, document association, customer party creation.

Work intake:

- `modules/work-intake/`
- Manual/web/email/API intake, idempotency, party/work linking.

Directory:

- `modules/directory/`
- Parties, contacts, roles, identifiers, profiles.

Operations:

- `modules/operations/`
- Tasks, processes, obligations, continuity, captures.

Money:

- `modules/money/`
- Open items, receivables/payables, grouping and filters.

Treasury:

- `modules/treasury/`
- Banks, balances, vales, receivables, reserves, alerts, projection.

Integrations:

- `modules/integrations/`
- Generic integration repository and Zeta-specific client/services/export.

Presentation:

- `modules/presentation/`
- Company home loader and dashboard summary.

## 30. Anexo: comandos utiles

Desarrollo:

```text
npm run dev
npm run inngest:dev
```

Calidad:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

Base de datos:

```text
npm run db:generate:migration
npm run db:verify:parity
```

Operativo:

```text
npm run pilot:summary
npm run documents:repair:stale-processing
npm run zeta:sync:contacts
```

## 31. Conclusiones

Convertilabs tiene una base muy amplia y coherente para convertirse en el sistema operativo de gestion de Rontil. El codigo ya expresa la arquitectura Convertilabs 2.0: `party`, `work_unit`, documentos, dinero, contabilidad, impuestos, tareas, procesos, integraciones y tablero Inicio.

El hito siguiente debe ser operativo, no teorico. La mejor decision es elegir un flujo real, usarlo con datos reales, registrar hallazgos y endurecer desde ahi.

La recomendacion final de este documento:

1. Corregir hygiene de lint.
2. Verificar build y DB parity.
3. Preparar ambiente piloto.
4. Correr Nueva Palmira + Dinero + Agenda durante una semana.
5. Validar Zeta read-only con credenciales reales.
6. Decidir si el siguiente gran paso es Zeta write, bancos/caja, documentos o cierre/IVA.

