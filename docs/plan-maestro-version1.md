# Plan Maestro Convertilabs 2.0 — Versión 1

**Estado:** plan operativo inicial para ejecutar la refundación total de Convertilabs  
**Fecha:** 2026-06-17  
**Fuente base:** `documento-refundacional-convertilabs.md` + plan maestro generado por Codex + lectura del estado actual del repo  
**Destino:** convertir Convertilabs en el super ERP personalizado / sistema operativo integral de la empresa  
**Modo de uso:** documento rector para guiar a Codex, al desarrollador y a cualquier intervención futura sobre producto, arquitectura, schema, UX, IA, contabilidad, impuestos, integraciones y operación real.

---

## 0. Resumen ejecutivo

Convertilabs deja de ser pensado como un motor documental, contable y fiscal vendible hacia afuera y pasa a ser refundado como el sistema operativo integral de la empresa.

La nueva visión es:

> **Convertilabs es el super ERP personalizado donde se gestiona toda la empresa.**

Esto incluye:

- trabajos;
- clientes;
- proveedores;
- contactos;
- documentos;
- compras;
- ventas;
- gastos;
- facturación;
- bancos;
- caja;
- cobros;
- pagos;
- deudores;
- acreedores;
- contabilidad;
- IVA;
- cierre;
- trámites;
- vencimientos;
- procesos;
- tareas;
- historial de contacto;
- decisiones;
- evidencia;
- memoria administrativa;
- continuidad operativa.

La refundación no exige conservar el producto anterior por compatibilidad artificial, porque Convertilabs no llegó a tener uso operativo real. Se conserva lo que sirve y se reescribe lo que limite la nueva visión.

Se conservan como activos principales:

- el nombre **Convertilabs**;
- el dominio ya comprado;
- el hosting existente;
- el stack útil;
- la base técnica útil del repo;
- auth multi-tenant;
- Supabase;
- storage privado;
- IA estructurada;
- Inngest;
- documentos;
- reglas contables;
- kernel contable multilínea;
- IVA Uruguay;
- cierre;
- open items;
- import/export;
- Zeta como integración externa;
- trazabilidad y auditoría.

Se redefine o reescribe:

- la tesis de producto;
- `agent_rules.md`;
- los documentos oficiales actuales;
- la navegación principal;
- el dashboard;
- el modelo de clientes/proveedores;
- el modelo de trabajos/proyectos/centros de costo;
- el modelo de dinero;
- el modelo de procesos, tareas y continuidad;
- el historial de contacto;
- la forma en que contabilidad, IVA y cierre se conectan al resto de la empresa.

La regla madre del plan es:

> **Pensar grande desde la arquitectura e implementar por cortes operativos verificables.**

---

## 1. Principios no negociables de Convertilabs 2.0

### 1.1 Convertilabs es un sistema integral, no una suma de módulos aislados

No se debe construir una colección de módulos independientes tipo:

```text
Clientes
Proveedores
Ventas
Compras
Documentos
Tareas
Contabilidad
IVA
Bancos
Trabajos
CRM
```

La arquitectura correcta es:

```text
modelo madre conectado
+ dominios especializados
+ vistas enfocadas
+ tablero real
```

Cada dato importante debe entrar una vez y quedar conectado a las entidades que corresponda.

### 1.2 El centro del sistema es el hecho operativo de empresa

El sistema no debe girar solo alrededor de documentos.

Debe girar alrededor de hechos reales:

- se inició un trabajo;
- se emitió una factura;
- llegó una compra;
- se pagó a un proveedor;
- se cobró a un cliente;
- se abrió un trámite;
- venció una obligación;
- se habló con un cliente;
- se tomó una decisión;
- se bloqueó un proceso;
- se cerró un período.

Cada hecho debe poder responder:

1. **Qué pasó.**
2. **A quién involucra.**
3. **A qué trabajo/proyecto/área pertenece.**
4. **Cómo impacta en dinero, contabilidad, IVA, tareas y operación.**
5. **Qué hay que hacer ahora.**

### 1.3 No conservar por nostalgia ni compatibilidad falsa

Como no hay datos productivos reales que proteger, se prioriza un diseño limpio.

No se debe mantener:

- una tabla;
- una ruta;
- una pantalla;
- una nomenclatura;
- una regla de producto;
- una navegación;
- una abstracción;
- una migración conceptual;

solo porque ya existe.

Todo lo existente debe clasificarse como:

```text
KEEP
REWRITE
DELETE
```

### 1.4 Todo debe ser trazable

Cualquier dato relevante debe poder explicar:

- de dónde salió;
- cuándo entró;
- quién lo confirmó;
- qué documento, fuente o evidencia lo respalda;
- qué cambió;
- a qué entidades afecta;
- qué proceso lo generó;
- qué decisión humana o automática lo produjo.

### 1.5 IA asistente, no autoridad

La IA puede:

- extraer datos;
- resumir;
- sugerir clasificaciones;
- proponer tareas;
- convertir texto crudo en procesos estructurados;
- detectar bloqueos;
- explicar impacto;
- sugerir reglas reutilizables.

La IA no puede:

- confirmar operaciones críticas sin revisión;
- inventar datos contables o fiscales;
- saltarse reglas determinísticas;
- cerrar períodos por sí sola;
- publicar cambios irreversibles sin evidencia;
- reemplazar al usuario, contador o responsable administrativo.

### 1.6 Tablero real, no dashboard decorativo

El Inicio debe responder:

> **Qué está pasando y qué tengo que hacer ahora.**

No debe llenarse con gráficos inventados ni KPIs sin historia.

Debe mostrar estado real:

- trabajos activos;
- documentos pendientes;
- IVA y vencimientos;
- tareas;
- cobros pendientes;
- pagos pendientes;
- deudores;
- acreedores;
- bloqueos;
- procesos críticos;
- dependencias humanas;
- próximos pasos.

---

## 2. Orden general de ejecución

Este plan se ejecuta en 11 etapas maestras.

| Etapa | Nombre | Resultado principal |
|---|---|---|
| 1 | Alineación refundacional | Docs y reglas oficiales dejan de empujar contra la nueva visión |
| 2 | Modelo madre | Entidades canónicas: `parties`, `work_units`, `business_events`, `entity_links`, `evidence_refs` |
| 3 | Centro de mando e IA de navegación | Inicio vuelve a ser tablero real de empresa |
| 4 | Primer corte operativo Nueva Palmira | Caso fundacional end-to-end funcionando |
| 5 | Dinero, deudores y acreedores | Dominio `money` operativo sobre open items, pagos, cobros y vencimientos |
| 6 | Procesos, tareas y continuidad | Agenda, procesos, obligaciones y modo continuidad |
| 7 | Directorio e historial | Clientes/proveedores/contactos bajo `parties` e interacciones vinculadas |
| 8 | Contabilidad, IVA y cierre integrados | El kernel existente se conecta al nuevo modelo operativo |
| 9 | Integraciones | Zeta y fuentes externas se conectan al modelo canónico |
| 10 | Inteligencia operativa | IA convierte datos y decisiones en orden accionable |
| 11 | Hardening y piloto interno | Uso real de la empresa propia con pruebas, limpieza y estabilidad |

Regla de ejecución:

> No se debe avanzar a una etapa que dependa de entidades canónicas si esas entidades todavía no existen o no tienen RLS, servicios de dominio y tests mínimos.

---

# Etapa 1 — Alineación refundacional

## 1.1 Objetivo

Reescribir la verdad oficial del proyecto para que Codex, el repo, los documentos y las decisiones futuras de ingeniería trabajen bajo la tesis Convertilabs 2.0.

El objetivo no es solo documentar una idea. Es impedir que la documentación vieja siga bloqueando o contradiciendo la refundación.

## 1.2 Problema que resuelve

El proyecto actual todavía contiene una tesis anterior:

```text
Convertilabs no es un ERP.
Convertilabs es un motor documental-contable-fiscal.
ERP full, jobs, centros de costo y rentabilidad quedan fuera del core.
```

Esa tesis ya no sirve.

La nueva tesis es:

```text
Convertilabs no es un ERP genérico.
Convertilabs es el super ERP personalizado y sistema operativo integral de la empresa.
```

## 1.3 Paso a paso

### Paso 1.3.1 — Crear carpeta o sección de refundación

Crear o consolidar una ubicación oficial para la nueva documentación.

Opciones recomendadas:

```text
docs/00-refundacion-convertilabs-2.md
docs/plan-maestro-version1.md
docs/agent_rules.md
docs/00-core-product-and-organization.md
docs/01-workflows-ux-and-surfaces.md
docs/02-accounting-tax-and-integrations.md
docs/03-platform-quality-and-roadmap.md
```

El documento refundacional debe quedar como fuente primaria de producto.

### Paso 1.3.2 — Marcar documentación anterior como subordinada o legacy

No borrar de inmediato documentación útil, pero sí evitar que compita con la nueva verdad.

Agregar al comienzo de documentos anteriores una nota de estado:

```md
> Estado Convertilabs 2.0: este documento pertenece a la etapa anterior y queda subordinado al documento refundacional y al plan maestro 2.0.
```

Aplicar esto a todo documento que diga o implique:

- no ERP;
- ERP full fuera de perímetro;
- jobs fuera de core;
- centros de costo fuera de core;
- rentabilidad fuera de core;
- dashboard solo documental/fiscal;
- producto vendible primero.

### Paso 1.3.3 — Reescribir `agent_rules.md`

`agent_rules.md` debe ser actualizado antes de pedir a Codex cambios grandes de código.

Nueva tesis obligatoria:

```md
Convertilabs 2.0 es el super ERP personalizado y sistema operativo integral de la empresa.

Toda decisión de ingeniería debe reforzar al menos uno de estos objetivos:

1. capturar hechos reales de la empresa;
2. conectar esos hechos con personas, trabajos, documentos, dinero, impuestos y tareas;
3. reducir dependencia de memoria humana no documentada;
4. mostrar estado operativo claro;
5. preservar trazabilidad y evidencia;
6. ayudar a decidir qué hacer ahora.
```

Eliminar o cambiar reglas que digan:

```text
Si una iniciativa no mejora motor documental, contable o fiscal, no entra.
```

Reemplazar por:

```text
Si una iniciativa no mejora la visión integral de empresa conectada, no entra.
```

### Paso 1.3.4 — Reescribir `00-core-product-and-organization.md`

El nuevo core debe declarar:

- Convertilabs como super ERP personalizado;
- destino inicial: empresa propia;
- nombre, dominio y hosting se conservan;
- no hay obligación de compatibilidad histórica estricta;
- el centro del sistema es el hecho operativo;
- los dominios madre son `directory`, `work`, `documents`, `money`, `accounting`, `tax`, `operations`, `communications`, `integrations`, `intelligence` y `presentation`.

### Paso 1.3.5 — Reescribir `01-workflows-ux-and-surfaces.md`

Actualizar la UX desde:

```text
Inicio / Documentos / Revisar / IVA / Ajustes
```

hacia una navegación orientada a empresa completa.

Propuesta inicial:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Más
```

En `Más`:

```text
Contactos
Contabilidad
IVA
Cierre
Procesos
Continuidad
Integraciones
Auditoría
Ajustes
```

Mantener el principio mobile-first y una decisión por pantalla, pero eliminar la prohibición de “UI tipo ERP” como dogma mal entendido. La nueva regla debe ser:

```text
No copiar un ERP genérico lleno de tablas desconectadas.
Sí construir un sistema integral con pantallas enfocadas y modelo conectado.
```

### Paso 1.3.6 — Reescribir `02-accounting-tax-and-integrations.md`

Mantener lo valioso:

- modelo multilínea;
- templates;
- settlement;
- open items;
- IVA Uruguay;
- cierre;
- reglas;
- imports/exports;
- Zeta.

Agregar la nueva integración con:

- `parties`;
- `work_units`;
- `business_events`;
- `money`;
- `tasks`;
- `obligations`;
- `entity_links`;
- `evidence_refs`.

Nueva regla:

```text
Contabilidad, IVA y cierre no son islas. Son consecuencias estructuradas de hechos operativos de empresa.
```

### Paso 1.3.7 — Reescribir `03-platform-quality-and-roadmap.md`

Actualizar roadmap y QA para que las nuevas entidades tengan:

- schema canónico;
- migraciones;
- RLS;
- servicios de dominio;
- tests unitarios;
- tests de tenancy;
- smokes;
- read models;
- trazabilidad.

Agregar nuevos dominios visibles:

```text
directory
work
events
money
operations
communications
continuity
```

### Paso 1.3.8 — Crear auditoría KEEP / REWRITE / DELETE

Crear archivo:

```text
docs/auditoria-repo-convertilabs-2-keep-rewrite-delete.md
```

Estructura mínima:

```md
# Auditoría repo Convertilabs 2.0 — KEEP / REWRITE / DELETE

## KEEP
- auth multi-tenant
- Supabase Auth/Postgres/Storage
- RLS base
- documentos/intake/storage
- IA estructurada
- Inngest
- kernel contable multilínea
- rules admin si está sano
- IVA Uruguay
- close cockpit
- open items / settlements
- imports / exports
- Zeta como integración externa
- audit_log / ai_decision_logs

## REWRITE
- tesis de producto
- agent_rules
- navegación principal
- dashboard
- modelo clientes/proveedores
- trabajos/centros de costo
- dinero como dominio visible
- procesos/tareas/continuidad
- contactos/historial
- docs oficiales

## DELETE
- restricciones activas “no ERP”
- rutas legacy sin uso real
- pantallas que solo existen para beta anterior
- copy que limite el producto a documentos/IVA
- features de demo sin conexión al modelo madre
```

### Paso 1.3.9 — Buscar contradicciones activas

Ejecutar búsquedas en el repo:

```bash
rg "no es un ERP|ERP full|fuera del perimetro|fuera del perímetro|jobs|centros de costo|rentabilidad" docs README.md modules app components
```

Clasificar cada aparición como:

```text
A. debe eliminarse;
B. debe reescribirse;
C. puede quedar como nota histórica legacy;
D. sigue siendo válida bajo nueva interpretación.
```

### Paso 1.3.10 — Cerrar etapa con commit documental

El primer PR o commit de la refundación debe ser documental.

Nombre sugerido:

```text
refactor-docs-convertilabs-2-refundacion
```

## 1.4 Entregables

- `docs/00-refundacion-convertilabs-2.md` consolidado.
- `docs/plan-maestro-version1.md` incorporado al repo.
- `docs/agent_rules.md` reescrito.
- `docs/00-core-product-and-organization.md` reescrito.
- `docs/01-workflows-ux-and-surfaces.md` reescrito.
- `docs/02-accounting-tax-and-integrations.md` reescrito.
- `docs/03-platform-quality-and-roadmap.md` reescrito.
- `docs/auditoria-repo-convertilabs-2-keep-rewrite-delete.md` creado.
- README actualizado.

## 1.5 Criterios de aceptación

La etapa 1 está completa cuando:

- no hay reglas activas que digan que Convertilabs no puede ser ERP;
- los docs nuevos declaran Convertilabs 2.0 como super ERP personalizado;
- Codex tiene instrucciones alineadas con la refundación;
- las piezas anteriores quedan marcadas como legacy, subordinadas o reescritas;
- existe un mapa KEEP / REWRITE / DELETE;
- el roadmap nuevo ya menciona `parties`, `work_units`, `business_events`, `entity_links`, `money`, `operations`, `communications` y `continuity`.

## 1.6 Riesgos

| Riesgo | Mitigación |
|---|---|
| Codex siga obedeciendo docs viejos | Reescribir primero `agent_rules.md` |
| Borrar conocimiento útil | Marcar legacy antes de eliminar |
| Redefinir demasiado sin plan operativo | Este documento convierte la tesis en etapas ejecutables |
| Confundir “super ERP” con pantallas gigantes | Reforzar modelo conectado + pantallas enfocadas |

---

# Etapa 2 — Modelo madre

## 2.1 Objetivo

Crear el modelo canónico que permita meter toda la empresa dentro de Convertilabs sin convertir la base de datos en un reflejo del caos actual.

Esta es la etapa más importante de arquitectura.

Sin modelo madre, todo lo demás se vuelve módulos sueltos.

## 2.2 Entidades canónicas nuevas

Crear o consolidar estas entidades:

```text
parties
party_roles
contacts
party_contacts
party_identifiers
work_units
business_events
entity_links
evidence_refs
```

## 2.3 Decisiones de diseño

### 2.3.1 `parties` reemplaza la fragmentación cliente/proveedor

Una misma entidad puede ser:

- cliente;
- proveedor;
- banco;
- organismo;
- contador;
- contacto institucional;
- transportista;
- socio;
- empleado externo;
- contraparte.

No crear tablas nuevas independientes para cada rol si pueden vivir como roles sobre una misma party.

Modelo:

```text
party
+ party_roles
+ party_identifiers
+ contacts
+ party_contacts
```

### 2.3.2 `work_units` reemplaza proyecto/trabajo/obra/centro de costo como entidad operativa

Producto visible inicial:

```text
Trabajos
```

Técnicamente:

```text
work_units
```

Una `work_unit` puede representar:

- trabajo;
- obra;
- proyecto;
- operación;
- servicio;
- centro de costo;
- área interna;
- unidad administrativa.

No crear por separado:

```text
projects
jobs
operations
cost_centers
```

hasta que haya una necesidad real que lo justifique.

### 2.3.3 `business_events` modela hechos operativos

Ejemplos:

```text
work_unit_created
purchase_document_received
sales_document_issued
payment_made
collection_received
tax_obligation_due
process_run_started
process_run_blocked
client_contacted
document_posted
vat_run_generated
```

### 2.3.4 `entity_links` permite relación universal controlada

No todo debe tener una FK directa, pero todo debe poder relacionarse de forma tipada.

Ejemplos:

```text
document belongs_to work_unit
document issued_by party
task blocks work_unit
interaction discussed document
payment settles open_item
process_run generated task
business_event affected tax_period
```

### 2.3.5 `evidence_refs` conserva prueba y procedencia funcional

Evidencia puede ser:

- archivo;
- documento;
- mail;
- nota;
- payload externo;
- registro Zeta;
- comprobante;
- screenshot;
- transcripción;
- comentario humano;
- corrida IA;
- asiento;
- export.

## 2.4 Paso a paso

### Paso 2.4.1 — Auditar schema actual

Revisar:

```text
db/schema/
supabase/migrations/
db/rls/
modules/
```

Identificar tablas actuales relacionadas:

```text
vendors
customers
organization_cost_centers
documents
document_line_items
document_invoice_identities
source_events
posting_proposals
journal_entries
ledger_open_items
ledger_settlement_links
audit_log
ai_decision_logs
```

Clasificar cada tabla:

```text
mantener igual
mantener como puente
migrar a entidad nueva
reescribir
eliminar luego
```

### Paso 2.4.2 — Diseñar enums y constraints

Definir enums o checks para:

```text
party_role_type
party_identifier_type
work_unit_kind
work_unit_status
business_event_type
entity_type
entity_relation_type
evidence_ref_type
```

Regla:

> Los estados y tipos visibles no deben ser texto libre si gobiernan lógica de producto.

### Paso 2.4.3 — Crear schema canónico para `directory`

Tablas mínimas:

```sql
parties (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  display_name text not null,
  legal_name text,
  normalized_name text,
  country_code text,
  default_currency text,
  status text not null default 'active',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

```sql
party_roles (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  party_id uuid not null references parties(id),
  role_type text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, party_id, role_type)
);
```

```sql
party_identifiers (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  party_id uuid not null references parties(id),
  identifier_type text not null,
  identifier_value text not null,
  country_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, identifier_type, identifier_value)
);
```

```sql
contacts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  full_name text not null,
  email text,
  phone text,
  mobile text,
  notes text,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

```sql
party_contacts (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  party_id uuid not null references parties(id),
  contact_id uuid not null references contacts(id),
  relationship_label text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, party_id, contact_id)
);
```

### Paso 2.4.4 — Crear schema canónico para `work`

Tabla mínima:

```sql
work_units (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  code text,
  name text not null,
  kind text not null default 'job',
  status text not null default 'planned',
  customer_party_id uuid references parties(id),
  owner_member_id uuid references organization_members(id),
  start_date date,
  end_date date,
  estimated_revenue numeric(18,2),
  estimated_cost numeric(18,2),
  currency text,
  description text,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
```

Estados iniciales:

```text
planned
active
paused
completed
cancelled
archived
```

Kinds iniciales:

```text
job
project
operation
internal
cost_center
area
```

### Paso 2.4.5 — Definir estrategia con `organization_cost_centers`

No eliminar de entrada si ya está usado.

Definir puente temporal:

```text
organization_cost_centers -> work_units
```

Opciones:

1. `organization_cost_centers` queda como legacy y se migra a `work_units`.
2. `organization_cost_centers` se convierte en vista o alias técnico.
3. `documents.cost_center_id` queda como campo puente mientras se agrega `documents.work_unit_id`.

Decisión recomendada:

```text
Crear documents.work_unit_id nullable.
Mantener documents.cost_center_id temporalmente.
Crear backfill opcional de cost centers hacia work units.
Nuevas features usan work_unit_id.
```

### Paso 2.4.6 — Crear schema canónico para `events`

```sql
business_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  event_type text not null,
  occurred_at timestamptz not null default now(),
  summary text,
  source_entity_type text,
  source_entity_id uuid,
  actor_member_id uuid references organization_members(id),
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

```sql
entity_links (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  source_entity_type text not null,
  source_entity_id uuid not null,
  target_entity_type text not null,
  target_entity_id uuid not null,
  relation_type text not null,
  metadata_json jsonb not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (
    organization_id,
    source_entity_type,
    source_entity_id,
    target_entity_type,
    target_entity_id,
    relation_type
  )
);
```

```sql
evidence_refs (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  evidence_type text not null,
  title text,
  description text,
  storage_bucket text,
  storage_path text,
  external_url text,
  source_entity_type text,
  source_entity_id uuid,
  metadata_json jsonb not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```

### Paso 2.4.7 — Agregar FKs directas donde sí conviene

Para relaciones críticas y consultadas todo el tiempo, usar columnas directas.

Agregar progresivamente:

```text
documents.party_id
documents.vendor_party_id
documents.customer_party_id
documents.work_unit_id
posting_proposals.work_unit_id
journal_entries.work_unit_id
ledger_open_items.party_id
ledger_open_items.work_unit_id
tasks.work_unit_id
interactions.party_id
interactions.work_unit_id
```

No abusar de `entity_links` para lo que se consulta en cada pantalla.

### Paso 2.4.8 — Crear RLS para todas las entidades nuevas

Toda tabla nueva debe obedecer:

```text
organization_id + membership activa
```

Patrón:

- `owner`, `admin` pueden crear/editar todo;
- roles operativos pueden crear/editar según dominio;
- `viewer` solo lectura;
- service role para backfills e integraciones server-only.

### Paso 2.4.9 — Crear módulos de dominio

Nuevas carpetas:

```text
modules/directory/
modules/work/
modules/events/
```

Archivos sugeridos:

```text
modules/directory/parties.ts
modules/directory/contacts.ts
modules/directory/party-identifiers.ts
modules/directory/party-roles.ts
modules/directory/party-presenter.ts

modules/work/work-units.ts
modules/work/work-unit-financial-summary.ts
modules/work/work-unit-presenter.ts

modules/events/business-events.ts
modules/events/entity-links.ts
modules/events/evidence-refs.ts
modules/events/event-presenter.ts
```

### Paso 2.4.10 — Crear adaptadores legacy

Para no romper todo de golpe, crear adaptadores:

```text
modules/directory/legacy-vendor-adapter.ts
modules/directory/legacy-customer-adapter.ts
modules/work/legacy-cost-center-adapter.ts
```

Regla:

> El código nuevo no debe depender directamente de `vendors`, `customers` u `organization_cost_centers` si existe entidad canónica nueva.

### Paso 2.4.11 — Crear tests de schema, RLS y dominio

Tests mínimos:

```text
- owner puede crear party
- viewer no puede crear party
- miembro de otra organización no ve parties ajenas
- party puede tener roles customer y vendor al mismo tiempo
- work_unit pertenece a organización
- work_unit puede tener customer_party_id
- document puede asociarse a work_unit_id
- entity_link no cruza organización
- evidence_ref no cruza organización
```

### Paso 2.4.12 — Generar migración y verificar paridad

Comandos esperados:

```bash
npm run db:generate:migration
npm run db:verify:parity
npm run typecheck
npm run test
```

Si algún comando no corre, documentar motivo.

## 2.5 Entregables

- Schema canónico actualizado.
- Migración Supabase generada.
- RLS nueva.
- Módulos `directory`, `work`, `events`.
- Adaptadores legacy mínimos.
- Tests de tenancy.
- `documents.work_unit_id` agregado.
- `documents.cost_center_id` documentado como puente temporal.

## 2.6 Criterios de aceptación

La etapa 2 está completa cuando:

- se puede crear una party con rol cliente;
- se puede crear una party con rol proveedor;
- una misma party puede tener ambos roles;
- se puede crear un trabajo visible como `Trabajo`;
- se puede asociar un documento a un trabajo;
- se puede crear un business event;
- se puede vincular cualquier entidad con `entity_links` de forma tipada;
- RLS impide cruces entre organizaciones;
- el código nuevo usa `parties` y `work_units`, no `vendors/customers/cost_centers` como fuente primaria.

---

# Etapa 3 — Centro de mando e IA de navegación

## 3.1 Objetivo

Convertir `/app/o/[slug]/dashboard` en el verdadero Inicio de Convertilabs 2.0: el centro de mando de la empresa.

Debe dejar de ser una pantalla documental o un redirect.

Debe responder:

> **Qué está pasando en la empresa y qué tengo que hacer ahora.**

## 3.2 Decisión de navegación

Navegación principal inicial:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Más
```

En mobile, si se mantiene límite de 5 items, usar:

```text
Inicio
Trabajos
Documentos
Dinero
Más
```

`Agenda` puede entrar dentro de Inicio o Más en mobile si hace falta.

`Más` agrupa:

```text
Contactos
Contabilidad
IVA
Cierre
Procesos
Continuidad
Integraciones
Auditoría
Ajustes
```

## 3.3 Paso a paso

### Paso 3.3.1 — Auditar navegación actual

Revisar:

```text
modules/organizations/private-nav.ts
components/dashboard/private-dashboard-shell.tsx
components/dashboard/organization-work-center.tsx
app/app/o/[slug]/dashboard
app/app/o/[slug]/documents
app/app/o/[slug]/review
```

Detectar:

- redirects actuales;
- labels viejos;
- items del bottom nav;
- dependencias del dashboard anterior;
- rutas legacy que no deben ser entrypoint principal.

### Paso 3.3.2 — Definir rutas nuevas

Rutas canónicas recomendadas:

```text
/app/o/[slug]/dashboard       -> Inicio
/app/o/[slug]/work            -> Trabajos
/app/o/[slug]/documents       -> Documentos
/app/o/[slug]/money           -> Dinero
/app/o/[slug]/agenda          -> Agenda
/app/o/[slug]/directory       -> Contactos / Directorio
/app/o/[slug]/operations      -> Procesos / tareas
/app/o/[slug]/continuity      -> Continuidad
/app/o/[slug]/more            -> Más
```

Las rutas existentes de contabilidad, IVA y cierre sobreviven, pero como superficies dentro de Más o accesos contextuales:

```text
/app/o/[slug]/tax
/app/o/[slug]/close
/app/o/[slug]/journal-entries
/app/o/[slug]/open-items
/app/o/[slug]/rules
/app/o/[slug]/chart-map
/app/o/[slug]/imports
/app/o/[slug]/exports
/app/o/[slug]/audit
/app/o/[slug]/settings
```

### Paso 3.3.3 — Crear servicio de dashboard 2.0

Crear:

```text
modules/presentation/company-command-center.ts
```

o:

```text
modules/dashboard/company-command-center.ts
```

Responsabilidad:

- consultar datos reales;
- no inventar KPIs;
- devolver secciones con estado y acciones;
- centralizar la narrativa de Inicio para que la UI no recomponga verdad.

Contrato sugerido:

```ts
type CompanyCommandCenter = {
  today: TodayBlock;
  urgentActions: CommandAction[];
  activeWorkUnits: WorkUnitSummary[];
  documents: DocumentOperationalSummary;
  money: MoneySummary;
  taxAndClose: TaxCloseSummary;
  agenda: AgendaSummary;
  blockers: BlockerSummary[];
  continuity: ContinuitySummary;
  recentActivity: RecentActivityItem[];
};
```

### Paso 3.3.4 — Definir bloques de Inicio

Bloques iniciales:

```text
1. Hoy / Qué requiere atención
2. Trabajos activos
3. Documentos pendientes
4. Dinero: cobros y pagos
5. IVA, cierre y vencimientos
6. Agenda y procesos
7. Bloqueos
8. Continuidad administrativa
9. Actividad reciente
```

### Paso 3.3.5 — Crear empty states honestos

Si no hay datos:

No mostrar:

```text
$0 facturación
0% margen
Gráfico vacío
```

Mostrar:

```text
Todavía no hay trabajos cargados.
Crear el primer trabajo.
```

```text
Todavía no hay documentos asociados a trabajos.
Cargar documento o asociar existente.
```

### Paso 3.3.6 — Agregar IA de navegación como asistente contextual

No como chatbot dominante.

Ejemplos de ayuda:

```text
- “¿Qué tengo pendiente hoy?”
- “¿Qué falta para cerrar IVA?”
- “¿Qué trabajos tienen gastos sin venta asociada?”
- “¿Qué cosas dependen de mamá?”
- “¿Qué pagos vencen esta semana?”
```

La IA debe consumir read models y evidencia, no inventar.

### Paso 3.3.7 — Actualizar UI

Crear o modificar componentes:

```text
components/dashboard/company-command-center.tsx
components/dashboard/today-actions-card.tsx
components/dashboard/active-work-units-card.tsx
components/dashboard/money-summary-card.tsx
components/dashboard/tax-close-card.tsx
components/dashboard/continuity-risk-card.tsx
components/dashboard/blockers-card.tsx
```

### Paso 3.3.8 — Tests y smokes

Tests mínimos:

```text
- Inicio carga sin datos y muestra empty states honestos
- Inicio muestra trabajo activo si existe
- Inicio muestra documento pendiente si existe
- Inicio muestra open item si existe
- Inicio no muestra datos de otra organización
- Inicio no inventa métricas sin datos
```

## 3.4 Entregables

- Dashboard 2.0 operativo.
- Navegación nueva.
- Servicio de presentación centralizado.
- Empty states honestos.
- Accesos a Trabajos, Documentos, Dinero y Agenda.
- IA de navegación como ayuda contextual, no autoridad.

## 3.5 Criterios de aceptación

La etapa 3 está completa cuando:

- `/dashboard` es Inicio real;
- no redirige a documentos;
- muestra al menos trabajos, documentos, dinero, impuestos/cierre, agenda y bloqueos;
- la navegación principal refleja Convertilabs 2.0;
- el dashboard consume datos reales;
- no hay KPIs inventados.

---

# Etapa 4 — Primer corte operativo: Nueva Palmira

## 4.1 Objetivo

Construir el primer caso fundacional end-to-end de Convertilabs 2.0:

> Crear un trabajo real, asociarlo a cliente, cargar gastos y ventas, ver margen, documentos, cobros, pagos, IVA, contabilidad, tareas y estado en Inicio.

Este caso se llama:

```text
Trabajo Nueva Palmira
```

## 4.2 Por qué este caso es fundacional

Nueva Palmira representa la nueva tesis completa:

```text
Un trabajo no vive aislado.
Un documento no vive aislado.
Una factura de gasto impacta contabilidad, IVA, proveedor, dinero y margen del trabajo.
Una factura de venta impacta cliente, cobro, IVA, ingresos y margen.
Todo debe aparecer conectado.
```

## 4.3 Paso a paso funcional

### Paso 4.3.1 — Crear cliente como party

Crear party:

```text
Nombre: Cliente Nueva Palmira
Rol: customer
Identificador: RUT si existe
Contacto principal: opcional
```

Validar:

- aparece en Directorio;
- tiene rol cliente;
- puede vincularse a work unit.

### Paso 4.3.2 — Crear trabajo

Crear `work_unit`:

```text
Nombre: Trabajo Nueva Palmira
Código: NP-2026-001
Kind: job
Estado: active
Cliente: Cliente Nueva Palmira
Responsable: usuario actual
Fecha inicio: fecha actual o real
Moneda: UYU o USD según corresponda
```

Vista del trabajo debe mostrar:

```text
Resumen
Documentos
Ventas
Costos
Margen
Cobros
Pagos
Tareas
Historial
Contabilidad / IVA cuando aplique
```

### Paso 4.3.3 — Asociar factura de gasto

Caso ejemplo:

```text
Factura de combustible / viaje / hotel / insumo
Proveedor: party con rol vendor
Trabajo: Nueva Palmira
Tipo: compra / gasto operativo
```

El documento debe conectar:

```text
document -> vendor_party
document -> work_unit
document -> business_event purchase_document_received
document -> accounting proposal
document -> VAT input
document -> open item o payment
document -> evidence
```

### Paso 4.3.4 — Asociar factura de venta

Caso ejemplo:

```text
Factura de servicio realizado
Cliente: Cliente Nueva Palmira
Trabajo: Nueva Palmira
Tipo: venta servicio plaza
```

Debe conectar:

```text
document -> customer_party
document -> work_unit
document -> business_event sales_document_issued
document -> accounting proposal
document -> VAT output
document -> receivable open item
document -> evidence
```

### Paso 4.3.5 — Mostrar margen básico

Crear servicio:

```text
modules/work/work-unit-financial-summary.ts
```

Cálculo inicial:

```text
ventas asociadas al trabajo
- costos/gastos asociados al trabajo
= margen bruto estimado
```

No incluir todavía:

- prorrateos complejos;
- stock avanzado;
- nómina;
- costos indirectos automáticos;
- depreciaciones;
- ajustes manuales sofisticados.

Mostrar como:

```text
Margen básico estimado
```

No venderlo como contabilidad analítica definitiva.

### Paso 4.3.6 — Mostrar documentos del trabajo

Vista:

```text
Documentos asociados
- compras/gastos
- ventas
- pendientes de revisión
- bloqueados
- posteados
```

Debe permitir:

- asociar documento existente al trabajo;
- cargar documento nuevo ya asociado al trabajo;
- cambiar asociación con trazabilidad si el período no está cerrado.

### Paso 4.3.7 — Mostrar cobros y pagos del trabajo

Desde open items:

```text
Cuentas a cobrar del trabajo
Cuentas a pagar del trabajo
Pagado
Cobrado
Vencido
Pendiente
```

### Paso 4.3.8 — Crear tarea vinculada al trabajo

Ejemplos:

```text
Confirmar viáticos Nueva Palmira
Enviar factura al cliente
Reclamar cobro
Pagar proveedor X
Adjuntar comprobante de combustible
```

Debe quedar vinculada a:

```text
task -> work_unit
task -> party opcional
task -> document opcional
task -> due_date opcional
```

### Paso 4.3.9 — Mostrar Nueva Palmira en Inicio

Inicio debe mostrar:

```text
Trabajo Nueva Palmira
Estado: activo
Ventas: X
Costos: Y
Margen básico: Z
Documentos pendientes: N
Cobros pendientes: N
Pagos pendientes: N
Tareas abiertas: N
Bloqueos: N
```

### Paso 4.3.10 — Crear test E2E Nueva Palmira

Test principal:

```text
crear cliente
crear trabajo
cargar gasto
cargar venta
asociar ambos al trabajo
generar open item
crear tarea
ver dashboard
ver margen
ver documentos
ver dinero
```

Nombre sugerido:

```text
tests/e2e/convertilabs-2-nueva-palmira.spec.ts
```

## 4.4 Entregables

- Vista Trabajos.
- Crear/editar trabajo.
- Vista detalle Trabajo Nueva Palmira.
- Asociación documento -> trabajo.
- Margen básico.
- Cobros/pagos por trabajo.
- Tareas vinculadas.
- Dashboard mostrando trabajo activo.
- Test E2E Nueva Palmira.

## 4.5 Criterios de aceptación

La etapa 4 está completa cuando se puede demostrar:

```text
1. Existe Cliente Nueva Palmira.
2. Existe Trabajo Nueva Palmira.
3. Hay al menos un gasto asociado.
4. Hay al menos una venta asociada.
5. Se ve margen básico.
6. Se ven documentos del trabajo.
7. Se ven cobros y pagos relacionados.
8. Hay una tarea vinculada.
9. Inicio muestra el estado del trabajo.
10. El test E2E pasa.
```

---

# Etapa 5 — Dinero, deudores y acreedores

## 5.1 Objetivo

Elevar `ledger_open_items` y settlements a un dominio visible llamado `money`, para que Convertilabs pueda responder:

- qué debo;
- qué me deben;
- qué vence;
- qué está cobrado;
- qué está pagado;
- qué está vencido;
- qué afecta caja;
- qué está asociado a cada trabajo, cliente o proveedor.

## 5.2 Decisión de arquitectura

No tirar `ledger_open_items` si sirve.

Reutilizarlo como base contable/financiera, pero crear un dominio de producto:

```text
modules/money/
```

El usuario no debe pensar en “ledger open items”.

El usuario debe ver:

```text
Deudores
Acreedores
Cobros
Pagos
Vencimientos
Caja/Bancos
```

## 5.3 Paso a paso

### Paso 5.3.1 — Auditar open items existentes

Revisar:

```text
ledger_open_items
ledger_settlement_links
journal_entries
journal_entry_lines
v_open_items_outstanding
```

Determinar:

- si open item ya distingue customer/vendor;
- si tiene due date;
- si tiene currency;
- si puede relacionarse con party;
- si puede relacionarse con work unit;
- si settlement está completo;
- qué falta para mostrar dinero operativo.

### Paso 5.3.2 — Agregar relaciones faltantes

Campos esperados:

```text
ledger_open_items.party_id
ledger_open_items.work_unit_id
ledger_open_items.document_id
ledger_open_items.due_date
ledger_open_items.direction
ledger_open_items.status
```

`direction`:

```text
receivable
payable
```

Estados:

```text
open
partially_settled
settled
overdue
cancelled
written_off
```

### Paso 5.3.3 — Crear módulo `money`

Archivos sugeridos:

```text
modules/money/open-items.ts
modules/money/payments.ts
modules/money/collections.ts
modules/money/settlements.ts
modules/money/money-summary.ts
modules/money/due-dates.ts
modules/money/work-unit-money-summary.ts
modules/money/party-money-summary.ts
```

### Paso 5.3.4 — Crear vista `/money`

Bloques:

```text
1. Cobros pendientes
2. Pagos pendientes
3. Vencidos
4. Vencen esta semana
5. Por cliente
6. Por proveedor
7. Por trabajo
8. Caja/Bancos básico
```

### Paso 5.3.5 — Crear pagos y cobros operativos

Si el sistema actual solo settlement contable, crear entidades operativas si hace falta:

```text
payments
collections
financial_accounts
```

Versión mínima:

```text
financial_accounts:
- banco
- caja
- cuenta puente

payments:
- party
- document/open item
- amount
- currency
- date
- method
- evidence

collections:
- party
- document/open item
- amount
- currency
- date
- method
- evidence
```

### Paso 5.3.6 — Conectar pagos/cobros a documentos y trabajos

Cada pago/cobro debe poder vincularse a:

```text
party
work_unit
document
open_item
evidence_ref
business_event
```

### Paso 5.3.7 — Mostrar dinero en Inicio

Inicio debe mostrar:

```text
Cobros pendientes: N / monto
Pagos pendientes: N / monto
Vencidos: N
Vencen esta semana: N
Trabajos con saldo pendiente: N
```

### Paso 5.3.8 — Tests

Tests mínimos:

```text
- factura de venta crea receivable
- factura de compra crea payable
- cobro parcial cambia estado a partially_settled
- cobro total cambia estado a settled
- pago se vincula a proveedor
- open item puede filtrarse por work_unit
- otra organización no ve dinero ajeno
```

## 5.4 Entregables

- Dominio `modules/money`.
- Vista Dinero.
- Deudores.
- Acreedores.
- Vencimientos.
- Pagos/cobros básicos.
- Conexión con trabajos, documentos y parties.
- Resumen en Inicio.

## 5.5 Criterios de aceptación

La etapa 5 está completa cuando:

- se ve qué debe la empresa;
- se ve qué le deben a la empresa;
- se ven vencimientos;
- se puede filtrar por cliente, proveedor y trabajo;
- los pagos/cobros tienen evidencia;
- Nueva Palmira muestra sus cobros y pagos;
- Inicio muestra dinero real.

---

# Etapa 6 — Procesos, tareas y continuidad

## 6.1 Objetivo

Crear el sistema que transforma conocimiento administrativo disperso en procesos, tareas, vencimientos y memoria operativa.

Esta etapa responde al miedo original:

> ¿Qué pasa el día que mi madre no esté y yo tenga que hacerme cargo de papeles, cuentas, trámites y administración?

## 6.2 Entidades

Crear:

```text
tasks
processes
process_versions
process_steps
process_runs
process_run_steps
obligations
obligation_occurrences
capture_notes
continuity_risks
```

## 6.3 Paso a paso

### Paso 6.3.1 — Crear `tasks`

Tabla mínima:

```sql
tasks (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  title text not null,
  description text,
  status text not null default 'pending',
  priority text not null default 'normal',
  due_date date,
  assigned_to_member_id uuid references organization_members(id),
  party_id uuid references parties(id),
  work_unit_id uuid references work_units(id),
  document_id uuid references documents(id),
  process_run_id uuid,
  blocked_reason text,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Estados:

```text
pending
in_progress
blocked
done
cancelled
```

No permitir estados libres.

### Paso 6.3.2 — Crear procesos versionados

Tablas:

```text
processes
process_versions
process_steps
```

Un proceso es la receta.

Una ejecución es cada vez que se hace.

No crear una tabla por proceso.

Ejemplo:

```text
Proceso: Pago a proveedores
Versión: 1
Pasos:
1. Revisar facturas pendientes
2. Verificar vencimientos
3. Verificar caja/banco
4. Priorizar pagos
5. Hacer transferencia
6. Guardar comprobante
```

### Paso 6.3.3 — Crear ejecuciones de procesos

Tablas:

```text
process_runs
process_run_steps
```

Ejemplo:

```text
Pago a proveedores semana 2026-06-17
Estado: blocked
Motivo: falta saldo actualizado del banco
```

### Paso 6.3.4 — Crear obligaciones recurrentes

Tablas:

```text
obligations
obligation_occurrences
```

Ejemplos:

```text
IVA mensual
Pago semanal proveedores
Enviar documentación al contador
Renovar certificado DGI
Control banco lunes
```

### Paso 6.3.5 — Crear captura cruda

Tabla:

```text
capture_notes
```

Debe permitir ingresar:

- texto libre;
- nota dictada;
- transcripción;
- indicación de mamá;
- trámite explicado;
- checklist informal;
- “esto se hace así”.

Pero la captura cruda no gobierna el sistema.

Flujo:

```text
texto crudo
-> propuesta estructurada
-> revisión humana
-> proceso/tarea/obligación
```

### Paso 6.3.6 — Crear Modo continuidad

Crear vista:

```text
/app/o/[slug]/continuity
```

Debe mostrar:

```text
Procesos críticos no documentados
Procesos que dependen de mamá
Próximos vencimientos
Trámites abiertos
Contactos esenciales
Tareas sin responsable
Documentos importantes
Riesgos administrativos
Cosas bloqueadas por falta de conocimiento
```

### Paso 6.3.7 — Conectar continuidad con Inicio

Inicio debe mostrar:

```text
Riesgos de continuidad
- 3 procesos críticos sin pasos documentados
- 2 obligaciones sin responsable futuro
- 1 trámite bloqueado
```

### Paso 6.3.8 — IA para estructurar procesos

La IA puede tomar:

```text
“Mamá todos los viernes revisa facturas, mira el banco, decide qué pagar y guarda comprobantes...”
```

Y proponer:

```text
Proceso: Pago semanal a proveedores
Frecuencia: semanal
Responsable actual: mamá
Criticidad: alta
Pasos:
1. Revisar facturas recibidas
2. Identificar vencimientos
3. Verificar saldo bancario
4. Priorizar proveedores
5. Hacer transferencias
6. Guardar comprobantes
```

Debe quedar como propuesta, no activo automático.

### Paso 6.3.9 — Tests

Tests mínimos:

```text
- crear tarea manual
- vincular tarea a trabajo
- vincular tarea a documento
- crear proceso
- publicar versión
- crear ejecución
- bloquear paso con motivo
- crear obligación recurrente
- generar occurrence
- continuidad detecta proceso crítico sin responsable futuro
```

## 6.4 Entregables

- Dominio `modules/operations`.
- Vista Agenda.
- Vista Procesos.
- Vista Continuidad.
- Tareas vinculadas a work units, documents, parties y money.
- Captura cruda estructurable.
- Obligaciones recurrentes.
- IA asistida para procesos.

## 6.5 Criterios de aceptación

La etapa 6 está completa cuando:

- se puede crear una tarea;
- se puede vincular a trabajo, documento y party;
- se puede documentar un proceso;
- se puede ejecutar un proceso;
- se puede bloquear con motivo;
- se pueden crear obligaciones recurrentes;
- Inicio muestra vencimientos y tareas;
- Modo continuidad muestra riesgos reales.

---

# Etapa 7 — Directorio e historial

## 7.1 Objetivo

Consolidar clientes, proveedores, bancos, organismos, contador y contactos bajo `parties`, y crear historial de interacción vinculado a trabajos, documentos, tareas, cobros y pagos.

Esto convierte Convertilabs en memoria relacional de la empresa.

## 7.2 Paso a paso

### Paso 7.2.1 — Migrar mentalmente clientes/proveedores a parties

Regla:

```text
customer = party con role customer
vendor = party con role vendor
bank = party con role bank
institution = party con role institution
accountant = party/contact con role accountant
```

### Paso 7.2.2 — Crear vista Directorio

Ruta:

```text
/app/o/[slug]/directory
```

Debe permitir:

- buscar parties;
- filtrar por rol;
- ver clientes;
- ver proveedores;
- ver bancos;
- ver organismos;
- ver contactos;
- crear party;
- agregar roles;
- agregar identificadores;
- agregar contactos.

### Paso 7.2.3 — Crear perfil de party

Vista de una party:

```text
Resumen
Roles
Identificadores
Contactos
Trabajos
Documentos
Cobros/Pagos
Open items
Tareas
Interacciones
Notas
Evidencia
```

### Paso 7.2.4 — Crear interacciones

Tablas:

```text
interactions
interaction_participants
interaction_links
```

Tipos:

```text
call
email
whatsapp
meeting
note
visit
message
system_note
```

Una interacción puede vincularse a:

```text
party
contact
work_unit
document
task
open_item
payment
collection
process_run
```

### Paso 7.2.5 — Crear historial contextual

Ejemplo:

```text
Cliente Nueva Palmira
- llamada sobre fecha de trabajo
- factura emitida
- cobro pendiente
- reclamo enviado
- tarea de seguimiento
```

### Paso 7.2.6 — Migración gradual legacy

No romper de golpe reglas existentes que usen vendors/customers.

Crear:

```text
vendor -> party adapter
customer -> party adapter
```

Luego migrar reglas/documentos gradualmente.

### Paso 7.2.7 — Tests

Tests mínimos:

```text
- una party puede ser cliente y proveedor
- una party puede tener varios contactos
- una interacción se vincula a un trabajo
- una interacción se vincula a un documento
- historial de party no muestra otra organización
- documentos legacy pueden resolverse vía adapter
```

## 7.3 Entregables

- Vista Directorio.
- Perfil de party.
- Interacciones.
- Historial contextual.
- Adaptadores legacy.
- Conexión con trabajos, documentos, dinero y tareas.

## 7.4 Criterios de aceptación

La etapa 7 está completa cuando:

- clientes/proveedores se ven como parties;
- se puede abrir un cliente y ver trabajos, documentos, cobros y contactos;
- se puede registrar una interacción;
- una llamada o nota puede vincularse a Nueva Palmira;
- el historial queda visible y trazable.

---

# Etapa 8 — Contabilidad, IVA y cierre integrados

## 8.1 Objetivo

Conservar el kernel contable, IVA Uruguay y cierre, pero conectarlos al nuevo modelo operativo.

La nueva regla es:

> Contabilidad, IVA y cierre son consecuencias estructuradas de hechos operativos, no islas separadas.

## 8.2 Lo que se conserva

Mantener si está sano:

```text
posting_proposals
journal_entries
journal_entry_lines
ledger_open_items
ledger_settlement_links
accounting_rules
accounting_rule_events
accounting_rule_simulations
chart_of_accounts
vat_runs
dgi_reconciliation_runs
vat_form_exports
close_check_runs
close_check_results
fiscal_periods
```

## 8.3 Paso a paso

### Paso 8.3.1 — Auditar kernel actual

Confirmar:

- cómo se genera posting;
- cómo se abre open item;
- cómo se calcula IVA;
- cómo se bloquea cierre;
- cómo se guarda evidencia;
- qué dependencias usan `vendor/customer`;
- qué dependencias usan `cost_center_id`.

### Paso 8.3.2 — Agregar `party_id` y `work_unit_id` donde corresponda

Campos deseables:

```text
posting_proposals.party_id
posting_proposals.work_unit_id
journal_entries.party_id
journal_entries.work_unit_id
journal_entry_lines.work_unit_id
ledger_open_items.party_id
ledger_open_items.work_unit_id
vat_runs.generated_from_business_events optional
```

### Paso 8.3.3 — Conectar documentos a business events

Cuando un documento se confirma o postea, crear business events:

```text
document_confirmed
document_posted_provisional
document_posted_final
vat_relevant_document_ready
open_item_created
```

### Paso 8.3.4 — Mostrar impacto contable desde trabajo

En Trabajo Nueva Palmira:

```text
Documentos posteados
Asientos relacionados
Cuentas a cobrar / pagar
IVA compras / ventas asociado
Margen básico
```

### Paso 8.3.5 — Mostrar IVA como obligación y tablero

IVA debe aparecer en:

```text
Inicio
Agenda
Obligaciones
Cierre
Tax view
```

No solo en `/tax`.

Debe poder decir:

```text
IVA junio vence en X días
Faltan N documentos por revisar
Hay M bloqueos fiscales
Última corrida oficial: fecha
```

### Paso 8.3.6 — Conectar cierre con tareas y bloqueos

Si cierre detecta problemas, generar o sugerir tareas:

```text
Resolver documento bloqueado
Confirmar open item
Revisar IVA
Asociar documento a trabajo
Corregir falta de FX
```

### Paso 8.3.7 — Tests de regresión

Correr:

```bash
npm run test
npm run typecheck
npm run db:verify:parity
```

Tests específicos:

```text
- documento con work_unit genera asiento conservando work_unit
- venta genera receivable con party/work_unit
- compra genera payable con party/work_unit
- IVA no pierde elegibilidad por nuevo modelo
- cierre detecta bloqueo y lo expone en Inicio
```

## 8.4 Entregables

- Kernel conectado a parties/work_units.
- IVA visible en Inicio y Agenda.
- Cierre conectado a tareas/bloqueos.
- Work units con impacto contable y fiscal.
- Tests de regresión.

## 8.5 Criterios de aceptación

La etapa 8 está completa cuando:

- una factura asociada a Nueva Palmira impacta contabilidad, IVA, dinero y margen;
- IVA no vive solo en `/tax`;
- cierre genera bloqueos accionables;
- open items usan parties/work_units;
- no se rompió el kernel contable existente.

---

# Etapa 9 — Integraciones

## 9.1 Objetivo

Mantener Zeta y otras integraciones como fuentes/destinos externos, pero no permitir que definan el modelo interno.

Regla:

```text
Zeta se adapta a Convertilabs, no Convertilabs a Zeta.
```

## 9.2 Decisión de arquitectura

Modelo canónico interno:

```text
parties
work_units
documents
business_events
journal_entries
money
```

Modelo externo Zeta:

```text
Contactos
Centros de costo
CFEs
Asientos
Bandeja de Entrada de Asientos
Comprobantes
Bancos
Cajas
Conceptos
```

Crear mapping explícito.

## 9.3 Paso a paso

### Paso 9.3.1 — Auditar integración Zeta actual

Revisar:

```text
modules/integrations
modules/exports
modules/imports
docs/zeta*
Api ZetaSoftware collection.json
```

Identificar endpoints útiles:

- CFEs recibidos;
- comprobantes;
- asientos;
- bandeja de entrada de asientos;
- centros de costo;
- contactos/clientes/proveedores;
- bancos/cajas;
- conceptos.

### Paso 9.3.2 — Crear modelo de fuente externa

Tablas sugeridas si no existen:

```text
integration_connections
integration_raw_records
integration_entity_links
integration_sync_runs
integration_errors
```

### Paso 9.3.3 — Mapear Zeta a modelo canónico

Ejemplos:

```text
Zeta Contacto -> party
Zeta RUT -> party_identifier
Zeta CentroCosto -> work_unit o external mapping
Zeta CFE recibido -> document + source_ref
Zeta Asiento -> journal_entry external source
Zeta Bandeja Entrada Asientos -> export target
```

### Paso 9.3.4 — Import auditable primero

No escribir directo en entidades finales sin staging.

Flujo:

```text
sync/import externo
-> raw record
-> staging
-> propuesta de materialización
-> aceptación o regla confiable
-> entidad canónica
-> entity_link/integration_entity_link
```

### Paso 9.3.5 — Export a Zeta después del modelo estable

Prioridad:

1. modelo canónico estable;
2. contabilidad integrada;
3. dinero y trabajos conectados;
4. recién luego export robusto.

Export debe incluir:

```text
Cuenta
Importe
Debe/Haber
Fecha
Concepto
Contacto/RUT
CentroCostos desde work_unit
Referencia
Moneda
TipoCambio
LiteralTributario si aplica
```

### Paso 9.3.6 — Tests

Tests mínimos:

```text
- raw record Zeta se guarda sin perder payload
- CFE recibido se materializa como document
- CentroCosto externo se mapea a work_unit
- export de asiento incluye work_unit como CentroCostos
- error externo queda trazado
- otra organización no ve credenciales ni records
```

## 9.4 Entregables

- Mapeo Zeta documentado.
- Raw records auditables.
- Entity links externos.
- Import staging.
- Export contable usando work_units.
- Tests de integración sin depender de datos reales sensibles.

## 9.5 Criterios de aceptación

La etapa 9 está completa cuando:

- Zeta no define el modelo interno;
- los records externos quedan auditados;
- se puede mapear CentroCosto a work_unit;
- se puede exportar asiento con CentroCostos desde trabajo;
- los errores quedan visibles y trazables.

---

# Etapa 10 — Inteligencia operativa

## 10.1 Objetivo

Agregar IA para reducir carga cognitiva y transformar datos dispersos en orden accionable, sin permitir que la IA gobierne operaciones críticas.

## 10.2 Usos permitidos

La IA puede ayudar a:

```text
extraer datos de documentos
resumir estado de empresa
proponer asociación a trabajo
proponer party probable
detectar documentos sin trabajo
detectar tareas sugeridas
convertir notas crudas en procesos
resumir historial de cliente
identificar bloqueos
explicar impacto contable/fiscal
sugerir reglas reutilizables
preparar borradores de checklist
```

## 10.3 Usos prohibidos

La IA no debe:

```text
postear final sin reglas y revisión
cerrar IVA automáticamente sin control
inventar FX
inventar cuentas
crear pagos/cobros irreversibles sin evidencia
confirmar trámites
borrar historial
reescribir documentos confirmados
saltarse RLS
```

## 10.4 Paso a paso

### Paso 10.4.1 — Auditar capa IA existente

Revisar:

```text
lib/llm/openai-responses.ts
modules/ai
modules/assistant
assistant_runs
assistant_threads
assistant_messages
assistant_suggestions
ai_decision_logs
```

### Paso 10.4.2 — Crear contratos estructurados nuevos

Contratos sugeridos:

```text
work_unit_assignment_suggestion
party_resolution_suggestion
task_suggestion
process_structuring_suggestion
continuity_risk_suggestion
company_status_summary
money_risk_summary
```

### Paso 10.4.3 — Crear revisión humana de sugerencias

Toda sugerencia accionable debe tener:

```text
suggestion_id
organization_id
source_entity
suggested_action
confidence
reason
required_evidence
status: pending/accepted/rejected/expired
reviewed_by
reviewed_at
```

### Paso 10.4.4 — IA en Inicio

Permitir preguntas como:

```text
¿Qué tengo que mirar hoy?
¿Qué está bloqueado?
¿Qué trabajos tienen gastos sin venta?
¿Qué cobros están vencidos?
¿Qué procesos dependen de mamá?
¿Qué falta para IVA?
```

Respuesta siempre con links a entidades reales.

### Paso 10.4.5 — IA para procesos

Flujo:

```text
captura cruda
-> propuesta de proceso
-> usuario corrige
-> publicar versión
-> generar tareas/obligaciones si corresponde
```

### Paso 10.4.6 — Tests y logs

Tests mínimos:

```text
- sugerencia IA no modifica entidad sin aceptación
- rechazo queda trazado
- aceptación crea entity_link o task según contrato
- IA no ve datos de otra organización
- respuesta de Inicio cita entidades reales
```

## 10.5 Entregables

- Contratos IA nuevos.
- Sugerencias revisables.
- IA contextual en Inicio.
- IA para estructurar procesos.
- IA para detectar bloqueos y tareas.
- Trazabilidad completa.

## 10.6 Criterios de aceptación

La etapa 10 está completa cuando:

- la IA ayuda a ordenar sin confirmar sola;
- toda sugerencia accionable se acepta o rechaza;
- hay evidencia y trazabilidad;
- las respuestas apuntan a entidades reales;
- no existe automatización crítica sin revisión.

---

# Etapa 11 — Hardening y piloto interno

## 11.1 Objetivo

Preparar Convertilabs 2.0 para uso real interno de la empresa propia antes de pensar en venderlo como SaaS externo.

## 11.2 Paso a paso

### Paso 11.2.1 — Limpiar rutas legacy

Clasificar rutas:

```text
mantener
redirigir
ocultar de navegación
eliminar
```

No eliminar rutas que aún usan flujos necesarios, pero sí sacar de navegación principal todo lo que contradiga Convertilabs 2.0.

### Paso 11.2.2 — Revisar copy completo

Buscar frases viejas:

```bash
rg "motor documental|no es ERP|beta privada|review|Bandeja Documental|IVA" app components modules docs
```

Actualizar copy hacia:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Continuidad
```

### Paso 11.2.3 — Validar mobile y desktop

Superficies mínimas:

```text
Inicio
Trabajos
Detalle de trabajo
Documentos
Dinero
Agenda
Continuidad
Directorio
```

Reglas:

- mobile permite captura y estado;
- desktop permite administración más completa;
- no tablas gigantes como experiencia principal mobile;
- cada pantalla tiene acción principal clara.

### Paso 11.2.4 — Ejecutar calidad técnica

Comandos esperados:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:verify:parity
npm run db:smoke:profile-sync
npm run db:smoke:organization-onboarding
npm run db:smoke:private-dashboard
npm run db:smoke:document-upload
```

### Paso 11.2.5 — Validar E2E Nueva Palmira

Debe pasar completo:

```text
cliente
trabajo
gasto
venta
margen
open item
tarea
dashboard
IVA/contabilidad cuando aplique
```

### Paso 11.2.6 — Cargar procesos reales mínimos

Antes del piloto interno, cargar al menos:

```text
Pago a proveedores
Preparación IVA mensual
Enviar documentación al contador
Control banco
Renovación certificado DGI
Facturación/cobro a cliente
```

### Paso 11.2.7 — Cargar parties reales mínimas

Cargar:

```text
contador
banco principal
principales clientes
principales proveedores
organismos relevantes
contactos internos clave
```

### Paso 11.2.8 — Cargar trabajos reales

Cargar al menos:

```text
Trabajo Nueva Palmira
1 o 2 trabajos reales adicionales
Administración interna como work_unit internal si corresponde
```

### Paso 11.2.9 — Usar Convertilabs durante un ciclo operativo real

Piloto mínimo:

```text
1 semana de uso diario
1 cierre mensual simple o simulación real
1 ciclo IVA o pre-IVA
1 ciclo de pagos/cobros
1 proceso documentado con mamá
```

### Paso 11.2.10 — Registrar hallazgos

Crear documento:

```text
docs/piloto-interno-rontil-hallazgos.md
```

Secciones:

```text
Qué funcionó
Qué confundió
Qué faltó
Qué sobró
Qué datos se repitieron
Qué se cargó dos veces
Qué no apareció en Inicio
Qué dependió de memoria humana
Qué debe automatizarse
Qué debe quedar manual
```

## 11.3 Entregables

- Rutas legacy ordenadas.
- Copy alineado.
- Tests y smokes ejecutados.
- Piloto Nueva Palmira completo.
- Procesos reales iniciales cargados.
- Parties reales iniciales cargadas.
- Hallazgos del piloto.

## 11.4 Criterios de aceptación

La etapa 11 está completa cuando:

- Convertilabs puede usarse internamente todos los días;
- Inicio sirve para saber dónde está parada la empresa;
- Nueva Palmira funciona end-to-end;
- documentos, dinero, trabajos, tareas e IVA están conectados;
- continuidad muestra riesgos reales;
- los tests críticos pasan;
- existe feedback de uso real.

---

## 12. Secuencia sugerida de PRs o intervenciones Codex

Esta sección traduce las etapas en cortes implementables.

### PR-00 — Documentación refundacional

**Objetivo:** alinear docs y agent rules.

Toca:

```text
docs/
README.md
```

No toca:

```text
schema
UI
lógica de dominio
```

Entrega:

```text
agent_rules 2.0
docs core 2.0
plan maestro
KEEP/REWRITE/DELETE
```

### PR-01 — Schema madre: directory/work/events

Toca:

```text
db/schema
supabase/migrations
db/rls
modules/directory
modules/work
modules/events
tests
```

Entrega:

```text
parties
party_roles
contacts
party_contacts
party_identifiers
work_units
business_events
entity_links
evidence_refs
RLS
tests
```

### PR-02 — Adaptadores legacy y documents.work_unit_id

Toca:

```text
documents
cost centers
vendors/customers adapters
```

Entrega:

```text
documents.work_unit_id
bridge cost_center -> work_unit
party adapters
sin romper reviewer actual
```

### PR-03 — Navegación e Inicio 2.0

Toca:

```text
private-nav
dashboard route
components/dashboard
modules/presentation
```

Entrega:

```text
Inicio real
nav nueva
empty states honestos
cards base
```

### PR-04 — Trabajos MVP

Toca:

```text
/app/o/[slug]/work
modules/work
components/work
```

Entrega:

```text
listado de trabajos
crear trabajo
detalle trabajo
asociación cliente
```

### PR-05 — Nueva Palmira E2E

Toca:

```text
documents association
work financial summary
tests/e2e
```

Entrega:

```text
cliente + trabajo + gasto + venta + margen + dashboard
```

### PR-06 — Money MVP

Toca:

```text
modules/money
/app/o/[slug]/money
open_items
settlements
```

Entrega:

```text
deudores
acreedores
vencimientos
por party
por work_unit
```

### PR-07 — Tasks y Agenda MVP

Toca:

```text
tasks schema
modules/operations
/app/o/[slug]/agenda
```

Entrega:

```text
tareas
vencimientos simples
vinculación con trabajo/documento/party
```

### PR-08 — Procesos y Continuidad MVP

Toca:

```text
processes schema
obligations
capture_notes
continuity
```

Entrega:

```text
procesos versionados
obligaciones
modo continuidad
```

### PR-09 — Directorio e Historial MVP

Toca:

```text
/app/o/[slug]/directory
interactions schema
modules/communications
```

Entrega:

```text
perfil party
contactos
interacciones
historial vinculado
```

### PR-10 — Integración contable/fiscal con modelo madre

Toca:

```text
accounting
tax
close
money
work
```

Entrega:

```text
party/work_unit en posting/open_items
IVA visible en Inicio/Agenda
cierre genera bloqueos accionables
```

### PR-11 — Integraciones Zeta 2.0

Toca:

```text
integrations
imports
exports
Zeta mapping
```

Entrega:

```text
raw records
integration_entity_links
map centro costo -> work_unit
export con CentroCostos
```

### PR-12 — IA operativa

Toca:

```text
modules/ai
modules/assistant
modules/intelligence
suggestions
```

Entrega:

```text
sugerencias revisables
procesos desde notas
resumen de Inicio
bloqueos/tareas sugeridas
```

### PR-13 — Hardening piloto interno

Toca:

```text
todo lo necesario para estabilidad
```

Entrega:

```text
lint/typecheck/test/db parity
smokes
limpieza legacy
piloto Nueva Palmira
piloto interno documentado
```

---

## 13. Matriz KEEP / REWRITE / DELETE inicial

### KEEP candidato

| Área | Motivo |
|---|---|
| Nombre Convertilabs | Activo de marca ya decidido |
| Dominio | Ya comprado |
| Hosting | Infraestructura reutilizable |
| Next.js | Stack vigente útil |
| Supabase Auth | Multi-tenant ya encaminado |
| Supabase Postgres | Base adecuada para modelo relacional fuerte |
| Supabase Storage | Útil para documentos/evidencia |
| RLS | Necesario para seguridad multi-tenant |
| IA estructurada | Útil para extracción y asistencia |
| Inngest | Útil para procesos durables |
| Document intake | Base útil para documentos y evidencia |
| Kernel contable multilínea | Pieza central a conservar |
| Accounting rules | Memoria reutilizable |
| IVA Uruguay | Vertical fiscal inicial |
| Close cockpit | Base de cierre y bloqueos |
| Open items | Base de dinero |
| Imports/exports | Carriles útiles |
| Zeta | Integración externa importante |
| Audit logs | Trazabilidad indispensable |

### REWRITE candidato

| Área | Motivo |
|---|---|
| Tesis del producto | Ya no es motor documental/fiscal solamente |
| Agent rules | Hoy empuja contra ERP full |
| Docs oficiales | Deben alinearse a Convertilabs 2.0 |
| Dashboard | Debe ser centro de mando integral |
| Navegación | Debe reflejar empresa completa |
| Clientes/proveedores | Deben consolidarse en parties |
| Centros de costo | Deben convertirse o migrar a work_units |
| Cost centers como feature secundaria | Ahora son núcleo operativo |
| Review como centro del producto | Documentos son parte, no todo |
| IA contable aislada | Debe pasar a inteligencia operativa general |
| Mobile field limitado | Debe integrarse con trabajos/dinero/agenda |

### DELETE candidato

| Área | Motivo |
|---|---|
| Restricción activa “no ERP” | Contradice la refundación |
| Copy de beta documental | Reduce visión del producto |
| Dashboards con relleno | No aportan estado real |
| Rutas legacy sin uso | Generan confusión |
| Estados duplicados de UI | Crean doble verdad |
| Features sin conexión al modelo madre | Aumentan caos |
| Configuradores sin uso operativo | Distraen del sistema integral |

---

## 14. Definition of Done global

Una etapa o PR no se considera terminada hasta cumplir, proporcionalmente:

```text
1. Documentación actualizada si cambia la verdad oficial.
2. Schema canónico actualizado si toca persistencia.
3. Migración creada si toca DB.
4. RLS revisada si hay tablas nuevas.
5. Servicios de dominio en modules/.
6. UI consume módulos/presenters, no recompone lógica de negocio.
7. Tests unitarios o smokes proporcionales.
8. No hay datos inventados en dashboard.
9. No hay bypass de IA sobre reglas críticas.
10. No hay cruces entre organizaciones.
11. Se documentan comandos corridos y comandos no corridos.
```

---

## 15. Checklist rápido antes de pedir una tarea a Codex

Antes de cada intervención, especificar:

```text
1. Etapa del plan maestro.
2. Objetivo exacto.
3. Archivos o dominios esperados.
4. Qué no debe tocar.
5. Entregables.
6. Tests o smokes esperados.
7. Criterio de aceptación.
```

Formato sugerido:

```md
Estamos en la Etapa X del Plan Maestro Convertilabs 2.0.
Quiero implementar [objetivo].
Debe respetar [principios].
Debe tocar aproximadamente [archivos/domínios].
No debe tocar [límites].
Debe entregar [entregables].
Debe validar con [tests/comandos].
Antes de editar, analizá el estado actual y proponé plan breve.
```

---

## 16. Riesgos globales del plan

| Riesgo | Señal de alerta | Mitigación |
|---|---|---|
| Hacer módulos aislados | Clientes, trabajos, dinero y tareas no se conectan | Modelo madre primero |
| Crear ERP genérico pesado | Muchas tablas/pantallas sin flujo real | Caso Nueva Palmira como prueba permanente |
| Romper kernel contable | IVA/posting dejan de funcionar | Tests de regresión desde etapa 8 |
| Duplicar clientes/proveedores | Vendors/customers y parties compiten | Adapters y migración gradual |
| Abusar de entity_links | Todo se vuelve genérico e ineficiente | FK directa para relaciones críticas |
| IA con demasiado poder | Sugerencias modifican datos sin revisión | Sugerencias revisables y auditadas |
| Dashboard decorativo | KPIs sin datos reales | Empty states honestos |
| Perder foco personal | Se diseña para SaaS externo primero | Piloto interno antes de comercializar |
| Mantener legacy por miedo | La arquitectura queda trabada | KEEP/REWRITE/DELETE explícito |
| Hacer todo a la vez | Demasiadas dependencias abiertas | PRs por cortes operativos |

---

## 17. Primeros comandos concretos recomendados

Cuando este plan entre al repo, los primeros pasos prácticos son:

```bash
# 1. Buscar contradicciones documentales
rg "no es un ERP|ERP full|fuera del perimetro|fuera del perímetro|jobs|centros de costo|rentabilidad" docs README.md modules app components

# 2. Buscar uso de cost centers
rg "cost_center|costCenter|organization_cost_centers|CentroCostos" db supabase modules app components docs

# 3. Buscar vendors/customers
rg "vendors|customers|vendor_id|customer_id|Proveedor|Cliente" db supabase modules app components docs

# 4. Buscar dashboard actual
rg "dashboard|Inicio|Bandeja|Review|Revisar" app components modules docs

# 5. Verificar estado base
npm run typecheck
npm run test
npm run db:verify:parity
```

Si algún comando falla antes de cambios, registrar como baseline y no atribuirlo automáticamente a la refundación.

---

## 18. Conclusión operativa

Este plan convierte la refundación conceptual de Convertilabs en una secuencia ejecutable.

La prioridad no es agregar pantallas por agregar.

La prioridad es construir el sistema madre donde:

```text
party
+ work_unit
+ document
+ business_event
+ money
+ accounting
+ tax
+ task
+ process
+ interaction
+ evidence
```

formen una red única y navegable.

El primer resultado real debe ser simple pero completo:

> Crear el Trabajo Nueva Palmira, asociar cliente, gastos, venta, margen, cobros, pagos, tareas, documentos, IVA, contabilidad e Inicio.

Si Nueva Palmira funciona, Convertilabs 2.0 deja de ser una idea y empieza a ser el sistema operativo real de la empresa.

