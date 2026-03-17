# Mapa contable / Accounting Map / Impact Graph

## Estado

- Propuesta de producto y arquitectura.
- No implementado todavia como feature dedicada.
- Objetivo recomendado: Epic P0 + P1.

## Objetivo

Crear una superficie privada dedicada que permita entender visualmente:

- como esta estructurado el plan de cuentas;
- que regla gana para cada evento o documento;
- que template se usa;
- que cuentas impacta;
- que warnings fiscales o de export aparecen;
- que cambiaria si se modifica una cuenta o binding.

La feature correcta no es un canvas libre. Debe ser una vista coordinada y controlada sobre logica contable ya existente, con simulacion y versionado forward-only.

## Decision madre

### Opcion recomendada

- Enfoque de producto: hibrido versionado.
- Nombre usuario: `Mapa contable`.
- Nombre tecnico: `Accounting Map` / `Impact Graph`.

### Alternativas descartadas

- Solo arbol editable:
  - sirve para jerarquia;
  - no explica impacto, reglas ni documentos reales;
  - valor insuficiente para demo y adopcion.
- Grafo libre editable:
  - visualmente atractivo;
  - muy alto riesgo de convertir la UI en fuente de verdad;
  - rompe el modelo actual de reglas deterministicas, explainability y cambios hacia adelante.

## Encaje con el repo actual

Hoy ya existen piezas fuertes del dominio:

- gestion del chart en `app/app/o/[slug]/settings/page.tsx`;
- carga, edicion y resumen de cuentas en `modules/accounting/chart-admin.ts`;
- metadata rica en cuentas:
  - `externalCode`
  - `taxProfileHint`
  - tags funcionales
  - `currencyPolicy`
  - `isProvisional`
- import / export de planillas;
- explainability documental y preview contable/fiscal en:
  - `components/documents/document-review-workspace.tsx`
  - `components/documents/accounting-impact-preview.tsx`
- reglas activas y runtime contable en:
  - `modules/accounting/repository.ts`
  - `modules/accounting/rule-engine.ts`
  - `modules/accounting/template-resolver.ts`
- templates base por codigo en `modules/accounting/journal-templates.ts`.

El hueco principal no es de dominio. Es de visibilidad unificada.

## Problema a resolver

Hoy el usuario puede:

- tener plan de cuentas;
- aplicar presets;
- importar desde planilla;
- ver sugerencias y previews desde un documento.

Pero no puede ver en un solo lugar:

- arbol del plan;
- conexiones entre evento, regla, template y cuentas;
- camino exacto de un documento real;
- impacto potencial de un cambio antes de activarlo.

## Ubicacion en la app

### Decision

Crear ruta propia visible en la navegacion privada:

- `/app/o/[slug]/chart-map`

### Enlaces recomendados

- desde `Settings`: `Abrir mapa contable`
- desde revision documental: `Ver en mapa`
- desde post-onboarding o post-preset: `Ver como quedo tu plan`

### No recomendado

- enterrarlo solo en `Settings`;
- limitarlo a un teaser en `Dashboard`.

## Modelo conceptual

La feature tiene tres capas que no deben mezclarse.

### A. Estructura

Representa el plan de cuentas como arbol:

- padre / hijo;
- orden;
- grupos;
- cuentas postables y no postables;
- badges:
  - provisional
  - export
  - tax hint
  - moneda
  - origen preset

### B. Impacto

Relaciona:

- evento contable o documental;
- regla que gana;
- template o posting pattern;
- lineas Debe / Haber;
- cuentas afectadas.

### C. Documento real

Muestra el camino concreto de un documento:

- documento;
- assignment run o artefacto equivalente;
- regla ganadora;
- template aplicado;
- lineas resultantes;
- snapshot contable usada para explicarlo.

## Resultado de producto esperado

El usuario debe poder:

1. Entrar a una pantalla dedicada y ver el plan como arbol.
2. Elegir un evento tipo:
   - venta contado
   - venta credito
   - e-ticket
   - nota de credito
   - recibo
3. Ver que regla o template se usa y que cuentas impacta.
4. Seleccionar una cuenta y ver:
   - donde se usa
   - con que frecuencia
   - si es provisional
   - si le falta `externalCode`
   - que `taxProfileHint` tiene
   - de que preset o import salio
5. Editar de forma controlada sin tocar historicos.
6. Ver una simulacion antes de guardar.
7. Activar una nueva version hacia adelante.
8. Desde un documento real, saltar al mapa y ver el camino exacto que siguio.

## Lo que no entra en V1

- canvas libre como fuente de verdad;
- layout manual pixel-perfect persistido por usuario;
- rerun masivo automatico de historicos;
- IA inventando estructura o reglas duras;
- mapa fiscal completo en canvas desde el dia 1.

La IA solo puede sugerir, explicar o elegir dentro de sets permitidos. No debe inventar estructura contable arbitraria.

## UX recomendada

Pantalla unica con tres modos.

### Modo 1: Tree

Vista principal del plan.

Incluye:

- busqueda por codigo, nombre, tag y `externalCode`;
- filtros:
  - solo usadas
  - solo provisionales
  - sin `externalCode`
  - con warning fiscal
  - por preset origen
  - por moneda o policy
- arbol expandible;
- highlight de cuentas impactadas por la seleccion actual;
- inspector lateral de cuenta.

### Modo 2: Impact

Vista por capas:

- evento
- regla / precedencia
- template
- lineas Debe / Haber
- cuentas

Debe mostrar explicacion humana, warnings y ejemplos de documentos reales.

### Modo 3: Document

Abre desde un documento real y resalta:

- documento;
- ladder de precedencia;
- regla ganadora;
- template aplicado;
- cuentas impactadas;
- before / after si existe snapshot mas nueva.

## Reglas de producto no negociables

- Read-only por defecto.
- Edit mode explicito.
- Toda mutacion pasa por simulacion.
- Nada historico cambia automaticamente.
- Activar cambios es una accion separada de editarlos.
- El canvas no crea reglas arbitrarias.
- Toda vista visual debe tener traduccion textual en inspector.

Esto debe respetar el comportamiento actual del producto:

- cambios hacia adelante;
- reapertura controlada;
- explainability;
- no rerun automatico.

## Arquitectura de informacion y UI

### Ruta

- `app/app/o/[slug]/chart-map/page.tsx`
- `app/app/o/[slug]/chart-map/loading.tsx`

### Componentes propuestos

- `components/chart-map/chart-map-shell.tsx`
- `components/chart-map/chart-map-toolbar.tsx`
- `components/chart-map/chart-tree-panel.tsx`
- `components/chart-map/chart-impact-canvas.tsx`
- `components/chart-map/chart-inspector.tsx`
- `components/chart-map/chart-legend.tsx`
- `components/chart-map/change-preview-drawer.tsx`
- `components/chart-map/document-impact-banner.tsx`
- `components/chart-map/snapshot-selector.tsx`

### Modulos de dominio

- `modules/accounting/chart-map/graph-builder.ts`
- `modules/accounting/chart-map/event-taxonomy.ts`
- `modules/accounting/chart-map/snapshot-service.ts`
- `modules/accounting/chart-map/change-simulator.ts`
- `modules/accounting/chart-map/selectors.ts`
- `modules/accounting/chart-map/permissions.ts`
- `modules/accounting/chart-map/layout.ts`

## Reutilizacion obligatoria

El mapa no debe duplicar logica ya existente.

Debe reutilizar o apoyarse en:

- `components/documents/accounting-impact-preview.tsx`
- `components/documents/document-review-workspace.tsx`
- `components/ui/help-hint.tsx`
- `modules/accounting/chart-admin.ts`
- `modules/accounting/presets/*`
- `modules/accounting/repository.ts`
- `modules/accounting/journal-templates.ts`

## Modelo de datos recomendado

### Fuente viva actual a reutilizar

- `chart_of_accounts`
- `accounting_rules`
- `document_assignment_runs`
- `journal_entries`
- `journal_entry_lines`
- `organization_rule_snapshots`
- metadata de preset / import cuando exista

### Nuevas entidades minimas

#### A. `accounting_event_types`

Taxonomia explicita de eventos contables o documentales.

Campos sugeridos:

- `id`
- `organization_id` nullable para defaults del sistema
- `code`
- `label`
- `family`
- `sort_order`
- `is_system`
- `is_active`
- `metadata_json`

#### B. Persistencia explicita de templates

Si la aplicacion sigue operando solo con `templateCode`, conviene introducir storage visible y consultable:

- `journal_templates`
- `journal_template_lines`

Campos sugeridos:

`journal_templates`

- `id`
- `organization_id`
- `event_type_id`
- `code`
- `label`
- `is_active`
- `metadata_json`

`journal_template_lines`

- `id`
- `template_id`
- `line_no`
- `side`
- `account_id`
- `amount_basis`
- `formula_json`
- `metadata_json`

#### C. `organization_accounting_snapshots`

Pieza clave para reproducibilidad y simulacion.

Campos sugeridos:

- `id`
- `organization_id`
- `version_no`
- `status`
- `rule_snapshot_id`
- `chart_snapshot_json`
- `template_snapshot_json`
- `summary_json`
- `created_by`
- `activated_by`
- `created_at`
- `activated_at`

La estrategia pragmatica recomendada es:

- tablas vivas como fuente editable;
- snapshot inmutable en JSONB al activar;
- relacion clara entre documento / asiento y snapshot usada.

#### D. Foreign keys nuevas

Agregar `accounting_snapshot_id` a:

- `document_assignment_runs`
- `document_confirmations`
- `journal_entries`

### Jerarquia real del chart

El arbol necesita como minimo:

- `parent_id`
- `sort_order`

Hoy el repo ya usa `parent_id`; si `sort_order` falta, debe agregarse para no depender solo del codigo como orden visual.

## Contratos TypeScript sugeridos

```ts
export type ChartMapMode = "tree" | "impact" | "document";

export type ChartMapNodeType =
  | "account"
  | "group"
  | "event"
  | "template"
  | "rule"
  | "document";

export type ChartMapEdgeType =
  | "hierarchy"
  | "matches_rule"
  | "uses_template"
  | "debit"
  | "credit"
  | "impacts"
  | "origin";

export interface ChartMapNode {
  id: string;
  type: ChartMapNodeType;
  label: string;
  status?: "active" | "provisional" | "warning" | "inactive";
  parentId?: string;
  snapshotId: string;
  metadata: Record<string, unknown>;
}

export interface ChartMapEdge {
  id: string;
  type: ChartMapEdgeType;
  source: string;
  target: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ChartMapPayload {
  mode: ChartMapMode;
  snapshot: {
    id: string;
    version: number;
    status: "draft" | "active" | "superseded";
  };
  nodes: ChartMapNode[];
  edges: ChartMapEdge[];
  warnings: Array<{
    code: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
}

export interface ChangePreview {
  draftSnapshotId: string;
  affectedTemplates: number;
  affectedRules: number;
  affectedOpenDocuments: number;
  affectedExports: number;
  blockers: string[];
  warnings: string[];
  beforeAfterExamples: Array<{
    label: string;
    before: Array<{ side: "debit" | "credit"; account: string; amountBasis: string }>;
    after: Array<{ side: "debit" | "credit"; account: string; amountBasis: string }>;
  }>;
  canActivate: boolean;
}
```

## Lecturas y mutaciones sugeridas

### Lectura

- `getChartMapPayload(orgId, mode, filters, snapshotId?)`
- `getDocumentImpactPath(orgId, documentId, snapshotId?)`
- `getAccountUsageInspector(orgId, accountId, snapshotId?)`
- `compareAccountingSnapshots(orgId, fromSnapshotId, toSnapshotId)`

### Mutacion

- `createAccountingSnapshotDraft(orgId)`
- `moveChartAccount(orgId, draftSnapshotId, accountId, newParentId, newIndex)`
- `createChartAccount(orgId, draftSnapshotId, input)`
- `updateChartAccount(orgId, draftSnapshotId, input)`
- `rebindTemplateLineAccount(orgId, draftSnapshotId, templateLineId, newAccountId)`
- `simulateAccountingChange(orgId, draftSnapshotId, changeSet)`
- `activateAccountingSnapshot(orgId, draftSnapshotId)`

## Permisos recomendados

Gating inicial grueso:

- `viewer`, `operator`, `reviewer`, `admin_processing`: solo lectura
- `accountant`, `admin`, `owner`: edicion, simulacion y activacion
- `developer`: lectura extendida y debug

No abrir edicion generalizada.

## Flujos clave

### Flujo A: entender el sistema

1. Usuario entra a `chart-map`.
2. Modo default: `impact`.
3. Evento default: `sale_cash` o equivalente visible.
4. Ve camino completo.
5. Hace click en cuenta.
6. Revisa inspector.
7. Cambia a `tree` para ver jerarquia.

### Flujo B: entender un documento

1. Desde review documental hace click en `Ver en mapa`.
2. Abre `document`.
3. Se resalta:
   - documento
   - ladder de precedencia
   - regla ganadora
   - template
   - cuentas afectadas

### Flujo C: editar sin romper

1. Usuario autorizado entra en edit mode.
2. Mueve cuenta o rebindea una linea.
3. Se abre `ChangePreview`.
4. Revisa warnings y blockers.
5. Guarda draft snapshot.
6. Activa snapshot.
7. Los cambios solo aplican hacia adelante.

### Flujo D: post-onboarding o post-preset

1. Usuario aplica preset o importa plan.
2. CTA: `Ver mapa`.
3. Inspector muestra origen:
   - base preset
   - overlays
   - import externo
   - metadata de aplicacion

## Simulacion obligatoria

Toda mutacion debe producir preview con:

- cuentas afectadas;
- templates afectados;
- reglas afectadas;
- documentos abiertos potencialmente afectados;
- riesgo de export por `externalCode`;
- riesgo fiscal por `taxProfileHint`;
- ejemplos before / after;
- blockers y warnings.

### Blockers minimos

- cuenta inexistente;
- cuenta inactiva;
- loop en jerarquia;
- mover bajo un hijo;
- cuenta usada en template critico sin reemplazo valido;
- desactivar cuenta usada por templates activos;
- perdida de `externalCode` en cuenta exportable.

## Versionado y comportamiento frente a documentos

Reglas requeridas:

- todo cambio estructural o de binding crea draft snapshot;
- activar snapshot es explicito;
- nuevos documentos usan snapshot activa nueva;
- documentos ya posteados quedan anclados a snapshot anterior;
- documentos abiertos no se recalculan solos;
- si existe snapshot nueva, debe haber banner:
  - `Existe una version contable mas nueva`
  - accion sugerida: `Recalcular con version nueva`

Esto debe alinearse con la politica actual de cambios forward-only y reapertura controlada.

## Implementacion por fases

### Fase 0 - Fundaciones

Prioridad: `P0`

- crear `accounting_event_types`
- definir eventos iniciales del sistema
- explicitar persistencia de templates si hace falta
- crear `organization_accounting_snapshots`
- agregar `accounting_snapshot_id` a runs / confirmations / journal entries
- agregar `sort_order` si falta en chart
- crear feature flags:
  - `CHART_MAP_ENABLED`
  - `CHART_MAP_EDIT_ENABLED`
  - `CHART_MAP_DOCUMENT_DEEPLINKS_ENABLED`

### Fase 1 - Read model y ruta read-only

Prioridad: `P0`

- `graph-builder.ts`
- payload para `tree`, `impact`, `document`
- ruta privada `/chart-map`
- toolbar con busqueda y filtros
- inspector
- highlight sincronizado entre vistas

### Fase 2 - Deep link desde documentos

Prioridad: `P0`

- boton `Ver en mapa` en review workspace
- query param `documentId`
- regla ganadora resaltada
- ladder de precedencia
- asiento y cuentas impactadas

### Fase 3 - Edicion controlada

Prioridad: `P1`

- edit mode por rol
- crear cuenta
- mover cuenta en arbol
- rebind de linea de template
- editar metadata
- prohibir creacion libre de edges

### Fase 4 - Simulacion y diff

Prioridad: `P1`

- `change-simulator.ts`
- drawer before / after
- conteo de docs abiertos afectados
- riesgo de export
- warnings fiscales
- blockers y severidades

### Fase 5 - Activacion forward-only

Prioridad: `P1`

- activar draft snapshot
- supersede snapshot anterior
- banner en documentos abiertos si hay snapshot nueva
- sin rerun automatico

### Fase 6 - Pulido

Prioridad: `P2`

- heatmap de uso por cuenta
- vistas guardadas
- filtros rapidos para provisionales y sin `externalCode`
- `help-hint`
- CTA post-preset

## Criterios de aceptacion

La feature queda lista cuando:

- existe una ruta privada dedicada;
- se puede seleccionar un evento y ver que cuentas mueve;
- se puede abrir un documento y ver su camino exacto;
- un usuario autorizado puede editar con preview;
- toda mutacion genera simulacion;
- activar snapshot no cambia documentos ya posteados;
- la vista muestra metadata y warnings relevantes;
- el arbol resalta cuentas afectadas desde `impact`;
- se reutiliza explainability existente;
- hay tests unitarios, integracion y e2e suficientes.

## Testing recomendado

### Unit

- `graph-builder.test.ts`
- `change-simulator.test.ts`
- `event-taxonomy.test.ts`
- `snapshot-service.test.ts`

### Integracion

- `chart-map-page.test.tsx`
- `document-impact-path.test.ts`
- `activate-accounting-snapshot.test.ts`

### E2E

- abrir mapa desde nav
- abrir mapa desde documento
- mover cuenta + preview + activar
- verificar que documento viejo siga anclado a snapshot previa

### DB smoke

- integridad de snapshot
- no mutacion historica
- guardas de ciclos en jerarquia
- validez de binding de template line

## Metricas recomendadas

### Producto

- tiempo hasta entender un `sale_cash`
- clicks desde documento a explicacion completa
- tasa de preview de cambio antes de activar
- reduccion de cuentas provisionales en uso

### Negocio

- menos soporte por "por que fue a esta cuenta"
- menos correcciones manuales post-clasificacion
- mejor demoabilidad
- mejor onboarding post-preset

### Telemetria minima

- `chart_map_opened`
- `chart_map_event_selected`
- `chart_map_account_inspected`
- `chart_map_document_opened`
- `chart_map_change_previewed`
- `chart_map_snapshot_activated`

## Riesgos principales

### Riesgo 1: pantalla espagueti

Mitigacion:

- modos separados;
- filtros;
- colapsado por defecto;
- no abrir todo el grafo de entrada.

### Riesgo 2: snapshot incompleta

Mitigacion:

- snapshot contable efectiva, no solo del arbol.

### Riesgo 3: drag/drop peligroso

Mitigacion:

- edit mode;
- preview obligatoria;
- activacion separada.

### Riesgo 4: exceso de texto

Mitigacion:

- canvas + inspector + help-hint corto;
- evitar parrafos eternos en la UI.

### Riesgo 5: meter mapa fiscal total demasiado temprano

Mitigacion:

- V1 contable con badges fiscales;
- overlay fiscal profunda despues.

## Siguiente paso recomendado

Crear el Epic `P0 Mapa contable` con este orden:

1. snapshot contable efectiva;
2. read model;
3. ruta `chart-map`;
4. deep link desde documentos.

Dejar para `P1`:

- edicion controlada;
- simulacion;
- activacion forward-only;
- diff before / after.

La regla principal es no arrancar por "dibujar nodos". Primero hay que hacer visible la logica que el producto ya tiene.
