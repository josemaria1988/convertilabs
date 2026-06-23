# Plan de acción Codex — Convertilabs 2.0

> Este plan de acción nace a raíz del análisis de arquitectura detallado en el archivo `docs/analisis-arquitectura-convertilabs-2.0.md`.

Actuá como Arquitecto Senior de Sistemas de Gestión Empresarial y desarrollador principal de Convertilabs.

## Contexto general

Convertilabs está en una refundación total.

La versión anterior estaba orientada a motor documental, contable y fiscal. La nueva visión es convertir Convertilabs en el sistema operativo integral de gestión de Rontil: una capa de control, tablero, memoria operativa e integración que conecta ZetaSoftware, la web, email, documentos, clientes, proveedores, trabajos, ventas, compras, cobros, pagos, contabilidad, IVA, tareas, procesos, vencimientos y continuidad administrativa.

### Importante

- ZetaSoftware NO se reemplaza.
- La web NO se reemplaza.
- El email NO se reemplaza.
- Convertilabs debe conectar y ordenar todo eso en un modelo canónico propio.
- Zeta será fuente externa estructurada para contactos, facturas, comprobantes, stock/artículos, centros de costo y datos contables cuando aplique.
- La web seguirá siendo canal comercial/catálogo/cotizaciones.
- El email puede funcionar como canal inicial de captura de cotizaciones o comunicaciones.
- Convertilabs será el centro de mando, memoria y tablero ejecutivo-operativo.

La prioridad no es hacer “más módulos”. La prioridad es cerrar un flujo real de punta a punta usando el caso Nueva Palmira como prueba principal.

## Regla general de trabajo

Trabajá en PRs chicos, ordenados y verificables.

No saltees etapas.

Después de cada PR, dejá un resumen con:

1. qué cambiaste;
2. qué archivos tocaste;
3. qué decisiones de arquitectura tomaste;
4. qué riesgos quedan;
5. qué verificaciones corriste;
6. qué PR debería venir después.

No hagas escrituras reales contra ZetaSoftware en esta etapa.

No implementes automatización irreversible.

No uses IA para tomar decisiones finales sin revisión humana.

No crees dashboards decorativos con datos inventados.

No metas lógica de negocio en componentes de UI.

No abuses de `entity_links` para relaciones críticas que deberían ser foreign keys reales.

---

# Fase 1 — Alinear la verdad oficial del proyecto

## PR 1 — Baseline Convertilabs 2.0 y reglas de arquitectura

### Objetivo

Dejar documentada la nueva verdad oficial de Convertilabs 2.0 y evitar que la documentación vieja siga compitiendo con la refundación.

Este PR debe ser principalmente documental. No tocar lógica de negocio, schema ni UI salvo que sea estrictamente necesario para actualizar referencias.

### Tareas

1. Agregar o consolidar un documento rector nuevo:

   `docs/convertilabs-2.0-baseline-arquitectura.md`

2. Este documento debe declarar explícitamente:

   - Convertilabs 2.0 es el sistema operativo integral de gestión de Rontil.
   - No reemplaza ZetaSoftware, web ni email.
   - Convertilabs conecta, normaliza, relaciona y muestra.
   - El centro del sistema deja de ser solo `document`.
   - El centro conceptual pasa a ser el hecho operativo de empresa.
   - `party` es la identidad canónica para clientes, proveedores, bancos, organismos, contactos y terceros.
   - `work_unit` es la identidad canónica para trabajos, proyectos, operaciones, obras o centros de costo operativos.
   - `document` sigue siendo una entidad clave, pero ya no es el único centro del producto.
   - `business_event` representa hechos operativos relevantes.
   - `entity_links` sirve para vínculos flexibles, pero no reemplaza relaciones críticas.
   - `Zeta external IDs` son referencias externas, no primary keys internas.
   - `vendors`, `customers`, `organization_cost_centers` y otros modelos legacy deben tratarse como bridges si existen, no como fuente principal para features nuevas.
   - Nueva Palmira será el acceptance test principal.

3. Actualizar `docs/agent_rules.md` o crear un nuevo archivo de reglas para Codex 2.0.

   La regla vieja “Convertilabs no es ERP” debe reemplazarse por:

   > Convertilabs no es un ERP genérico ni una suite modular desconectada.  
   > Convertilabs es el sistema operativo integral de gestión de Rontil, conectado a ZetaSoftware, web, email y procesos internos.

4. Actualizar la documentación de producto que diga que ERP full, rentabilidad, jobs, centros de costo o margen están fuera del core.

   No hace falta borrar historia, pero sí marcar esa definición como legacy/superada por la refundación.

5. Agregar una sección llamada:

   `Modelo canónico Convertilabs 2.0`

   Con esta jerarquía mínima:

   - organization
   - member
   - party
   - contact
   - work_unit
   - document
   - document_line
   - business_event
   - financial_event
   - open_item
   - payment / collection
   - journal_entry
   - tax_period / tax_event
   - task
   - process
   - obligation
   - interaction
   - evidence_ref
   - source_ref
   - entity_link
   - integration_raw_record
   - integration_entity_link

### Criterios de aceptación

- Existe un documento rector nuevo de Convertilabs 2.0.
- La documentación vieja queda marcada como legacy cuando contradice la refundación.
- Codex ya no debería interpretar “no ERP” como prohibición de trabajos, dinero, contactos, margen o procesos.
- No se tocó schema.
- No se tocó lógica de negocio.
- No se activaron integraciones nuevas.
- Se dejó claro cuál es el primer circuito operativo: Nueva Palmira.

### Verificación

- Revisar que no queden dos tesis activas contradictorias en los documentos principales.
- Buscar ocurrencias de “no es ERP”, “ERP full”, “rentabilidad”, “jobs”, “centros de costo”, “margen” y marcar si son legacy, actuales o requieren actualización.
- No correr migraciones.

---

# Fase 2 — Lenguaje, navegación y fronteras de dominios

## PR 2 — Alinear lenguaje de producto y navegación

### Objetivo

Definir el lenguaje oficial visible para Convertilabs 2.0 sin todavía construir módulos nuevos grandes.

### Decisiones esperadas

Usar esta navegación principal como hipótesis:

- Inicio
- Trabajos
- Documentos
- Dinero
- Agenda
- Más

Dentro de `Más` deberían vivir, según corresponda:

- Contactos / Directorio
- Procesos
- Continuidad
- Contabilidad
- IVA / Impuestos
- Cierre
- Integraciones
- Auditoría
- Ajustes
- Avanzado

### Tareas

1. Revisar navegación actual en:

   - `modules/organizations/private-nav.ts`
   - shells privados
   - bottom nav mobile
   - dashboard shell
   - rutas privadas principales

2. No necesariamente implementar toda la navegación nueva todavía, pero sí:

   - documentar la navegación objetivo;
   - identificar qué rutas actuales quedan como core;
   - identificar qué rutas actuales quedan como expertas;
   - identificar qué rutas son legacy;
   - decidir si `Tesorería` queda como subdominio de `Dinero`.

3. Definir frontera entre `Money` y `Treasury`:

   - `Dinero / Money` = vista ejecutiva de deudores, acreedores, cobros, pagos, vencimientos y open items.
   - `Tesorería / Treasury` = subdominio más específico de bancos, caja, vales y movimientos financieros.

4. Documentar que la UI principal debe responder:

   > Qué está pasando y qué tengo que hacer ahora.

5. No llenar Inicio con KPIs falsos, charts inventados o métricas sin datos reales.

### Criterios de aceptación

- Hay un documento o sección clara sobre lenguaje y navegación Convertilabs 2.0.
- `Dinero` queda definido como dominio principal visible.
- `Tesorería` queda definida como subdominio, no como reemplazo del concepto general.
- `Trabajos` queda como nombre visible preferido para `work_units`.
- `Inicio` queda definido como centro de mando, no dashboard decorativo.

### Verificación

- Revisar rutas y navegación existentes.
- No romper rutas actuales.
- No borrar rutas legacy sin plan de compatibilidad.
- No introducir navegación falsa a pantallas inexistentes salvo como documentación de objetivo.

---

# Fase 3 — Modelo canónico y bridges legacy

## PR 3 — Política de modelo canónico y legacy bridges

### Objetivo

Dejar establecida la jerarquía técnica entre entidades nuevas y tablas/estructuras legacy.

### Tareas

1. Auditar en código y schema el estado de:

   - `parties`
   - `contacts`
   - `party_roles`
   - `party_identifiers`
   - `work_units`
   - `organization_cost_centers`
   - `vendors`
   - `customers`
   - `documents`
   - `documents.cost_center_id`
   - `business_events`
   - `entity_links`
   - `evidence_refs`
   - `integration_raw_records`
   - `integration_entity_links`
   - `document_source_refs`

2. Crear un documento:

   `docs/convertilabs-2.0-canonical-model-and-bridges.md`

3. En ese documento definir:

   - `party` manda sobre `vendor/customer`.
   - `work_unit` manda sobre `cost_center` para nuevas features.
   - `organization_cost_centers` puede sobrevivir como bridge o compatibilidad si ya se usa.
   - `documents.cost_center_id` puede mantenerse temporalmente, pero el objetivo es que documentos operativos se relacionen con `work_unit`.
   - `entity_links` no debe ser usado como reemplazo de FK en relaciones críticas.
   - relaciones críticas deben tener columna directa cuando gobiernen dinero, dashboard, filtros diarios, cierre o permisos.

4. Proponer, sin implementar todavía si es grande, una tabla o estrategia de mapeo:

   - Zeta CentroCosto → work_unit
   - Zeta Contacto → party
   - Zeta Comprobante/Factura → document
   - Zeta external record → integration_raw_record/source_ref

5. Identificar todos los lugares donde el código todavía depende de entidades legacy como fuente principal.

### Criterios de aceptación

- Existe una política clara de canon vs legacy.
- Está claro qué entidades deben usarse para features nuevas.
- Hay un listado de deuda: pantallas o módulos que todavía leen modelos legacy.
- No se cambió comportamiento productivo todavía, salvo documentación.

### Verificación

- `npm run typecheck` si se tocó algún archivo TS.
- Si solo se tocó documentación, no hace falta ejecutar suite completa.
- Reportar explícitamente que no hubo migraciones.

---

# Fase 4 — Acceptance test operativo Nueva Palmira

## PR 4 — Fixture/playbook Nueva Palmira sin depender de Zeta real

### Objetivo

Crear un circuito de prueba local/controlado para validar Convertilabs 2.0 sin depender todavía de Zeta real.

El objetivo no es cargar datos perfectos. El objetivo es probar si el modelo puede representar un trabajo real de punta a punta.

### Caso a representar

Trabajo: Nueva Palmira

Debe incluir:

- cliente;
- contacto;
- trabajo / work_unit;
- cotización o solicitud inicial simulada;
- venta asociada;
- gasto asociado;
- documento de venta;
- documento de compra/gasto;
- deudor / cuenta a cobrar;
- acreedor / cuenta a pagar;
- margen documental estimado;
- tarea pendiente;
- señal visible para Inicio.

### Tareas

1. Crear un fixture o seed de prueba, según convenga al repo.

2. Crear o reutilizar tests que validen:

   - existe un `party` cliente;
   - existe un `work_unit` Nueva Palmira;
   - existe al menos una venta asociada al trabajo;
   - existe al menos un gasto asociado al trabajo;
   - existe un open item de cliente;
   - existe un open item de proveedor;
   - el margen documental estimado se puede calcular;
   - hay al menos una tarea pendiente asociada;
   - Inicio puede mostrar una señal accionable derivada de ese trabajo.

3. Si ya existen tests de Nueva Palmira, consolidarlos en un playbook único.

4. Crear un documento:

   `docs/playbooks/nueva-palmira-acceptance-test.md`

   Con el flujo esperado:

   ```text
   solicitud/cotización
   -> party cliente
   -> work_unit Nueva Palmira
   -> venta
   -> gastos
   -> margen
   -> open items
   -> tareas
   -> Inicio
   ```

### Criterios de aceptación

- Hay un fixture o playbook verificable.
- El caso Nueva Palmira puede ejecutarse en entorno local/test.
- El flujo no depende de Zeta real.
- El test falla si margen, pendientes o relación con trabajo no aparecen.
- No se simulan KPIs decorativos.
- Todo dato mostrado debe venir de entidades reales o fixture explícito.

### Verificación

Ejecutar lo proporcional:

- `npm run typecheck`
- tests específicos creados/modificados
- si toca DB/schema, revisar migración y RLS
- si no toca DB, explicar por qué

---

# Fase 5 — ZetaSoftware read-only y mapeo operativo

## PR 5 — Validación Zeta read-only y fuentes externas

### Objetivo

Validar integración Zeta en modo lectura, sin escribir nada en Zeta.

Zeta debe ser fuente externa estructurada. Convertilabs debe guardar raw, normalizar y mapear a su modelo canónico.

### Prohibido en este PR

- No usar endpoints Save/Delete de Zeta.
- No escribir a Bandeja de Entrada de Asientos.
- No crear datos productivos irreversibles en Zeta.
- No asumir que un ID externo es estable si no está verificado.

### Tareas

1. Auditar integración Zeta existente:

   - endpoints soportados;
   - registry de endpoints;
   - REST client;
   - credenciales;
   - health check;
   - sync runs;
   - cursors;
   - raw records;
   - materialización actual.

2. Confirmar estado de lectura para:

   - Contactos;
   - Centros de costo;
   - Comprobantes de cliente / ventas;
   - CFEs recibidos / compras;
   - Artículos / stock, solo como referencia si ya existe;
   - Asientos o balance, solo si ya está contemplado.

Crear o actualizar un documento:

`docs/integrations/zeta-readonly-validation-plan.md`

3. Definir mapeos:

   - Zeta contacto -> party / contact / party_identifier
   - Zeta centro costo -> work_unit
   - Zeta comprobante cliente -> document + business_event + party + work_unit_candidate
   - Zeta CFE recibido -> document + business_event + party + work_unit_candidate
   - Zeta artículo -> external catalog reference, no stock maestro interno

4. Registrar gaps:

   - si no se sabe si CentroCostoCodigo equivale a trabajo real;
   - si hay ventas sin centro de costo;
   - si hay contactos sin RUT;
   - si hay centros de costo ambiguos;
   - si no se puede validar contra Zeta real;
   - si faltan credenciales;
   - si no hay sandbox;
   - si faltan garantías de idempotencia.

### Criterios de aceptación

- Zeta queda documentado como fuente externa read-only por ahora.
- Hay listado claro de endpoints confiables y endpoints pendientes.
- Hay política explícita de no escritura.
- Hay mapeo propuesto hacia entidades canónicas.
- Se identifican riesgos de duplicado, identidad externa, timeout e idempotencia.

### Verificación

- Ejecutar tests de integración si existen y no requieren credenciales reales.
- Si no se pueden ejecutar por falta de entorno, registrar limitación.
- No forzar credenciales.
- No ejecutar llamadas destructivas.

## PR 6 — Mapping Zeta → party / work_unit / document con bandeja de resolución

### Objetivo

Empezar a convertir datos Zeta en entidades canónicas de Convertilabs, pero con revisión humana cuando haya ambigüedad.

### Tareas

1. Implementar o consolidar el mapeo:

   - contactos Zeta a party;
   - contactos Zeta a contact;
   - RUT/documento/email/teléfono a party_identifiers;
   - centros de costo Zeta a work_unit;
   - comprobantes de cliente a document;
   - CFEs recibidos a document;
   - raw externo a integration_raw_records;
   - links externos a integration_entity_links o document_source_refs.

2. Crear bandeja o estado de resolución para casos ambiguos:

   - contacto sin match;
   - posible duplicado de party;
   - centro de costo sin work_unit;
   - venta sin trabajo;
   - gasto sin trabajo;
   - documento con party dudoso;
   - documento con moneda/IVA dudoso.

3. No auto-finalizar casos ambiguos.

4. Crear tests para:

   - contacto claro → party;
   - contacto duplicado → pendiente resolución;
   - centro de costo claro → work_unit;
   - centro de costo ambiguo → pendiente resolución;
   - venta con centro de costo claro → document + work_unit;
   - venta sin centro de costo → document + pendiente asignación a trabajo.

### Criterios de aceptación

- Datos claros se mapean automáticamente.
- Datos ambiguos quedan visibles para resolución.
- No se crean duplicados silenciosos.
- No se pisa historia.
- Los raw records quedan preservados.
- Cada entidad materializada conserva referencia a origen Zeta.

### Verificación

- Tests unitarios o de integración del mapper.
- `npm run typecheck`
- `npm run lint` si se tocaron varios archivos TS.
- Si toca schema: migración + RLS + paridad.

---

# Fase 6 — Intake operativo/cotizaciones

## PR 7 — Intake manual de cotizaciones / oportunidades

### Objetivo

Crear primero un ingreso manual simple para solicitudes, oportunidades o cotizaciones, antes de automatizar email o webhooks.

No empezar por email. Primero definir bien el dominio.

### Nombre recomendado

Usar una entidad amplia:

`work_intake_items`

No limitarse a quote_requests, porque no todo será una cotización formal.

### Qué representa

Un work_intake_item representa algo que entra a la empresa y puede transformarse en trabajo, cotización, tarea o seguimiento.

Puede venir de:

- llamada;
- WhatsApp;
- email;
- web;
- conversación;
- visita;
- pedido directo;
- cotización formal;
- nota interna.

### Campos mínimos sugeridos

- `id`
- `organization_id`
- `source_type`
- `source_ref_id` nullable
- `raw_text`
- `title`
- `description`
- `customer_name` nullable
- `customer_email` nullable
- `customer_phone` nullable
- `party_id` nullable
- `contact_id` nullable
- `work_unit_id` nullable
- `location_text` nullable
- `estimated_amount` nullable
- `currency` nullable
- `requested_date` nullable
- `status`
- `priority`
- `assigned_to_member_id` nullable
- `next_action`
- `due_date` nullable
- `created_by`
- `created_at`
- `updated_at`

### Estados sugeridos

- `captured`
- `needs_review`
- `linked_to_party`
- `linked_to_work`
- `converted_to_work`
- `quoted`
- `won`
- `lost`
- `archived`

### Tareas

1. Diseñar schema mínimo si no existe entidad equivalente.

2. Crear módulo de dominio:

   `modules/work-intake/`

   o integrarlo bajo `modules/work/` si ya existe ese dominio.

3. Crear UI mínima, no sofisticada:

   - crear intake;
   - ver lista;
   - asociar a party;
   - crear/asociar work_unit;
   - crear tarea de seguimiento;
   - cambiar estado.

4. Integrarlo con Inicio de forma honesta:

   - “3 solicitudes/cotizaciones pendientes de revisar”
   - “1 solicitud sin cliente asociado”
   - “2 solicitudes con seguimiento vencido”

5. No usar IA todavía para crear trabajos automáticamente.

### Criterios de aceptación

- Puedo cargar manualmente una solicitud/cotización de Nueva Palmira.
- Puedo asociarla a un cliente.
- Puedo crear o asociar el trabajo Nueva Palmira.
- Puedo crear una tarea de seguimiento.
- Aparece en Inicio como pendiente real.
- No se crean ventas ni documentos falsos.

### Verificación

- Test de creación de intake.
- Test de promoción/asociación a work_unit.
- Test de tarea de seguimiento.
- Smoke UI si hay pantalla.
- RLS si hay tabla nueva.

## PR 8 — Intake web/API tokenizado

### Objetivo

Permitir que la web de Rontil envíe cotizaciones o solicitudes a Convertilabs mediante API, sin depender todavía de parsing de email.

### Tareas

1. Crear endpoint server-side.

Ejemplo:

`/api/integrations/rontil-web/work-intake`

Debe usar:

- token secreto por organización o integración;
- idempotency key;
- payload versionado;
- validación de schema;
- source_ref;
- raw payload preservado.
Payload mínimo:

- `quote_id` externo opcional;
- fecha;
- nombre cliente;
- email;
- teléfono;
- texto;
- líneas cotizadas opcional;
- total opcional;
- moneda;
- URL/origen;
- metadata.

El endpoint debe crear:

- integration raw record;
- work_intake_item;
- evidence/source ref;
- posible party candidate, no party definitivo si no hay match claro;
- tarea de revisión si corresponde.

No crear ventas automáticamente.

No crear work_unit automáticamente salvo que la regla sea segura o sea modo asistido con confirmación posterior.

### Criterios de aceptación

- La web puede mandar una cotización/s solicitud.
- El mismo payload repetido no duplica intake.
- El intake aparece en bandeja de revisión.
- Hay raw payload auditable.
- Hay source ref.
- Hay tarea o señal en Inicio.
- Si el cliente no matchea claro, queda pendiente de resolución.

### Verificación

- Test de endpoint con payload válido.
- Test de idempotencia.
- Test de payload inválido.
- Test de token inválido.
- Typecheck/lint.

## PR 9 — Intake email con revisión humana

### Objetivo

Capturar emails de cotizaciones o comunicaciones comerciales sin crear basura automática.

### Tareas

Definir casilla/canal esperado:

Ejemplo:

cotizaciones@...
forward desde web;
BCC desde módulo de cotizaciones;
conexión Gmail/email si ya existe infraestructura.
El sistema debe guardar:

- raw email;
- asunto;
- remitente;
- destinatarios;
- fecha;
- cuerpo;
- adjuntos si aplica;
- message-id;
- source ref.

Crear interaction/email si ya existe dominio de comunicaciones.

Crear o sugerir work_intake_item.

Usar IA solo para sugerir:

- posible cliente;
- posible trabajo;
- monto;
- ubicación;
- próxima acción;
- resumen.

No permitir que IA:

- cree venta final;
- marque cotización como ganada;
- cree trabajo activo sin revisión si el match no es claro;
- invente datos faltantes.

Todo email parseado debe pasar por revisión humana al principio.

### Criterios de aceptación

- Un email de cotización queda registrado.
- Se puede ver evidencia raw.
- Se genera intake en estado needs_review.
- Se sugiere party/work_unit cuando sea posible.
- El usuario confirma antes de convertir en trabajo.
- Hay tarea de seguimiento si corresponde.

### Verificación

- Test con email simple.
- Test con email duplicado por Message-ID.
- Test con email ambiguo.
- Test con adjunto opcional si aplica.
- No usar credenciales reales en tests.

---

# Fase 7 — Dinero, open items y margen

## PR 10 — Dinero canónico mínimo

### Objetivo

Convertir open_items, cobros, pagos y vencimientos en una vista operativa de dinero conectada a parties y work_units.

### Definición

Dinero debe responder:

- quién me debe;
- a quién debo;
- qué vence;
- qué está vencido;
- qué está cobrado;
- qué está pagado;
- qué afecta a cada trabajo;
- qué está pendiente de conciliación.

### Tareas

1. Auditar estado actual de:

   - ledger_open_items
   - ledger_settlement_links
   - payments/collections si existen
   - financial_events si existen
   - treasury/vales si existen
   - read models de open items

2. Definir si hacen falta FKs directas:

   - open_item.party_id
   - open_item.work_unit_id
   - open_item.document_id
   - open_item.due_date
   - open_item.status
   - open_item.currency
   - open_item.amount_open

3. Evitar resolver todo por entity_links si las consultas serán críticas para tablero.

4. Crear read model o presenter:

   - deudores;
   - acreedores;
   - vencidos;
   - próximos vencimientos;
   - por trabajo;
   - por party.

5. Conectar Nueva Palmira:

   - venta → cuenta a cobrar;
   - gasto → cuenta a pagar;
   - margen documental;
   - estado de cobro/pago.

### Criterios de aceptación

- Se puede ver deuda de cliente asociada a Nueva Palmira.
- Se puede ver deuda a proveedor asociada a Nueva Palmira.
- Se puede ver vencimiento.
- Se puede ver monto abierto.
- Se puede ver estado.
- Inicio puede mostrar al menos una señal real de dinero.
- No hay settlements automáticos inseguros entre monedas.

### Verificación

- Tests de open items por party.
- Tests de open items por work_unit.
- Tests de moneda.
- Tests de vencimiento.
- Typecheck/lint.
- Si toca schema: migración, RLS y paridad.

## PR 11 — Margen documental estimado por trabajo

### Objetivo

Mostrar margen básico de un trabajo sin venderlo como contabilidad gerencial perfecta.

### Definición inicial

Margen documental estimado:

```text
ventas documentadas asociadas al work_unit
-
gastos/compras documentadas asociadas al work_unit
=
margen documental estimado
```

### Tareas

Crear servicio/presenter:

`modules/work/work-unit-financial-summary.ts`

o equivalente.

Calcular:

- ingresos documentados;
- costos documentados;
- margen bruto estimado;
- documentos sin clasificar;
- gastos sin work_unit;
- ventas sin work_unit;
- cobros pendientes;
- pagos pendientes.

Mostrar disclaimer/copy honesto:

“Margen documental estimado. Puede faltar documentación, cobros, pagos o ajustes.”

Conectar con Nueva Palmira.
No inventar costos.
No estimar margen con IA.
No completar huecos con promedios.

### Criterios de aceptación

- Nueva Palmira muestra ingresos.
- Nueva Palmira muestra costos.
- Nueva Palmira muestra margen estimado.
- Nueva Palmira muestra documentos pendientes o sin clasificar si existen.
- El margen se marca como estimado.
- Si faltan datos, se ve el motivo.

### Verificación

- Test de margen positivo.
- Test de margen con gasto sin asignar.
- Test de trabajo sin ventas.
- Test de trabajo sin gastos.
- Typecheck/lint.

---

# Fase 8 — Dashboard por trabajo e Inicio ejecutivo

## PR 12 — Vista de Trabajo Nueva Palmira

### Objetivo

Crear una vista de trabajo que muestre toda la operación relacionada, sin mezclar todo en una pantalla caótica.

### Ruta sugerida

`/app/o/[slug]/work/[workUnitId]`

o según convención existente.

### Debe mostrar

- nombre del trabajo;
- cliente;
- estado;
- responsable;
- fechas;
- cotización/intake asociado;
- ventas;
- gastos;
- margen documental estimado;
- deudores;
- acreedores;
- documentos;
- tareas;
- interacciones;
- evidencia;
- próximos pasos.

### Tareas

1. Crear presenter de trabajo.
2. La UI debe consumir presenter, no recalcular lógica.
3. Separar en bloques:

   - Resumen;
   - Dinero;
   - Documentos;
   - Tareas;
   - Historial;
   - Riesgos/bloqueos.

4. Evitar tablas gigantes como experiencia principal.
5. Mobile-first.

### Criterios de aceptación

- Puedo abrir Nueva Palmira.
- Entiendo qué pasó.
- Veo qué falta.
- Veo margen estimado.
- Veo documentos asociados.
- Veo deudores/acreedores.
- Veo tareas.
- Veo historial o empty state honesto.

### Verificación

- Smoke UI.
- Test/presenter si aplica.
- Typecheck/lint.

## PR 13 — Inicio ejecutivo Convertilabs 2.0

### Objetivo

Convertir Inicio en centro de mando operativo real.

Inicio debe responder:

Qué está pasando y qué tengo que hacer ahora.

### Bloques iniciales

Hoy / atención requerida:

- cotizaciones/intakes pendientes;
- trabajos con pendientes;
- ventas sin trabajo;
- gastos sin trabajo;
- documentos bloqueados;
- pagos próximos;
- cobros próximos;
- IVA/vencimientos relevantes;
- tareas vencidas.

Trabajos activos:

- Nueva Palmira;
- otros trabajos.

Dinero:

- deudores;
- acreedores;
- vencimientos.

Administración:

- procesos/trámites/tareas críticas, si existen.

Integraciones:

- Zeta sync status;
- errores de importación;
- mapeos pendientes.

### Tareas

- Crear presenter/read model para Inicio.
- No consultar 20 tablas directo desde componentes.
- Mostrar empty states honestos.
- Mostrar señales accionables, no decoración.
- Conectar al playbook Nueva Palmira.

### Criterios de aceptación

- Inicio muestra Nueva Palmira si está activo.
- Inicio muestra intakes pendientes.
- Inicio muestra dinero pendiente si existe.
- Inicio muestra documentos/trabajos sin asignar.
- Inicio muestra errores/mapeos pendientes de Zeta si existen.
- No hay KPIs falsos.
- Cada card debe tener acción clara.

### Verificación

- Smoke del dashboard.
- Test de presenter si aplica.
- Typecheck/lint.
- No romper mobile nav.

---

# Fase 9 — Procesos y continuidad

## PR 14 — Procesos administrativos mínimos

### Objetivo

Empezar a capturar “cómo se hace” sin crear todavía un módulo gigante.

### Entidades mínimas

- processes
- process_steps
- process_runs
- tasks
- obligations

Si ya existen, auditar y reutilizar.

### Primeros procesos sugeridos

- Pago a proveedores;
- Preparación IVA mensual;
- Envío de documentación al contador;
- Seguimiento de cotizaciones;
- Cierre mensual básico;
- Renovación de certificados/trámites críticos.

### Reglas

- No crear tabla por proceso.
- Cada proceso es un registro.
- Cada paso es un registro.
- Cada ejecución es una instancia.
- Todo proceso activo debe tener responsable.
- Todo proceso recurrente debe tener frecuencia.
- Todo bloqueo debe tener motivo.
- Texto libre puede existir como nota, pero no como única fuente operativa.

### Criterios de aceptación

- Puedo crear proceso.
- Puedo agregar pasos.
- Puedo asignar responsable.
- Puedo crear obligación recurrente.
- Puedo generar tarea.
- Puedo ver bloqueo con motivo.
- Inicio puede mostrar tareas/procesos críticos.

### Verificación

- Tests de procesos si hay dominio.
- RLS si hay schema nuevo.
- Typecheck/lint.

---

# Fase 10 — Escritura a Zeta, solo después

## PR futuro — Zeta write / Bandeja de Entrada de Asientos

### Condición previa

No avanzar con escritura a Zeta hasta que se cumpla todo esto:

- Nueva Palmira funciona read-only de punta a punta.
- Zeta read-only fue validado.
- Los mapeos party/work_unit/document están resueltos.
- Hay idempotencia clara.
- Hay runbook de limpieza.
- Hay dry-run.
- Hay responsable humano de aprobación.
- Hay logging y evidencia.
- Hay política de timeout/respuesta desconocida.
- Hay ambiente de prueba o protocolo controlado en producción.

### Prohibido antes de eso

- Save real en Zeta.
- Delete real en Zeta.
- Crear asientos reales.
- Modificar contactos reales.
- Modificar artículos/stock.
- Enviar datos contables sin revisión.

---

# Reglas de arquitectura transversales

## 1. Modelo canónico

Para features nuevas:

- usar party, no vendor/customer como identidad principal;
- usar work_unit, no solo cost_center;
- usar document como evidencia/hecho documental;
- usar business_event para hechos operativos;
- usar open_item para dinero pendiente;
- usar task para acción pendiente;
- usar interaction para historial de contacto;
- usar source_ref/evidence_ref para trazabilidad;
- usar entity_links solo para vínculos flexibles o secundarios.

## 2. Relaciones críticas

Estas relaciones deberían tender a FK directa si gobiernan tablero, dinero, filtros o cierre:

- document.party_id
- document.work_unit_id
- open_item.party_id
- open_item.work_unit_id
- task.party_id
- task.work_unit_id
- interaction.party_id
- interaction.work_unit_id
- business_event.party_id / work_unit_id si aplica al diseño

No esconder todo en entity_links.

## 3. IA

La IA puede:

- extraer;
- resumir;
- sugerir;
- clasificar dentro de opciones permitidas.

La IA no puede:

- crear ventas finales;
- marcar oportunidades como ganadas;
- inventar importes;
- crear asientos irreversibles;
- confirmar IVA;
- escribir a Zeta;
- saltarse revisión humana en casos ambiguos.

## 4. Zeta

Zeta es fuente externa estructurada.

Convertilabs debe:

- preservar raw;
- mapear a modelo canónico;
- registrar source refs;
- deduplicar;
- mantener idempotencia;
- mostrar mapeos pendientes;
- no escribir sin etapa futura controlada.

## 5. UX

Cada pantalla debe:

- tener una acción principal;
- mostrar qué está pasando;
- mostrar qué falta;
- mostrar por qué algo está bloqueado;
- evitar tablas gigantes como experiencia principal;
- funcionar mobile-first;
- no usar KPIs inventados.

## 6. Testing

Todo PR debe incluir verificación proporcional.

Mínimo:

- `npm run typecheck`
- tests relevantes
- `npm run lint` si se tocaron varias superficies
- migración + RLS + parity si se toca DB
- smoke manual documentado si se toca UI

Si algo no se pudo correr, explicarlo.

# Orden de ejecución recomendado

Cada vez que se ejecute un PR, marcarlo en esta lista como realizado:

- PR 1 — Baseline Convertilabs 2.0 y reglas de arquitectura. - OK
- PR 2 — Lenguaje, navegación y frontera Dinero/Tesorería.
- PR 3 — Modelo canónico y bridges legacy.
- PR 4 — Fixture/playbook Nueva Palmira.
- PR 5 — Zeta read-only validation.
- PR 6 — Mapping Zeta a party/work_unit/document con resolución humana.
- PR 7 — Intake manual de cotizaciones/oportunidades.
- PR 8 — Intake web/API tokenizado.
- PR 9 — Intake email con revisión humana.
- PR 10 — Dinero canónico mínimo.
- PR 11 — Margen documental estimado por trabajo.
- PR 12 — Vista de Trabajo Nueva Palmira.
- PR 13 — Inicio ejecutivo Convertilabs 2.0.
- PR 14 — Procesos administrativos mínimos.
- PR futuro — Escritura controlada a Zeta.

