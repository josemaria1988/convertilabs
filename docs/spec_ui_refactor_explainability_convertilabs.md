# Spec — Refactor de UI y Explainability

## Objetivo

Refactorizar la UI de Convertilabs para que el sistema sea entendible, operable e intuitivo para un usuario real sin necesidad de reconstruir mentalmente lógica oculta del backend.

Este refactor no busca reescribir el producto ni mezclar otra vez capas separadas. Busca:

1. traducir la arquitectura real a un lenguaje visible y consistente;
2. unificar estados, gates y decisiones visibles;
3. hacer que cada acción del usuario tenga una consecuencia clara;
4. exponer explainability útil y accionable;
5. reducir frustración operativa, soporte y errores de interpretación.

---

# 1. Diagnóstico del problema actual

## 1.1 Problema raíz

El sistema ya tiene una separación de capas bastante correcta en dominio, pero la UI no la expresa bien.

Hoy conviven varias verdades al mismo tiempo:

- una verdad de extracción documental;
- una verdad de revisión factual;
- una verdad de clasificación contable;
- una verdad fiscal;
- una verdad de posting;
- una verdad de tax preview / tax runs;
- una verdad de auditoría;
- una verdad visual parcial en cada pantalla.

El usuario suele ver una sola capa y asume que esa capa gobierna todo. Pero no es así.

## 1.2 Síntomas visibles

- el preview contable puede verse correcto, pero el documento seguir bloqueado;
- el usuario guarda una asignación y cree que ya “cerró”, cuando técnicamente no consolidó resolución manual;
- la pantalla de IVA puede verse vacía aunque haya documentos clasificados en el período;
- los nombres de estados no coinciden entre lo que entiende el usuario, lo que muestra la UI y lo que realmente usa el dominio;
- hay explainability parcial, pero no uniforme;
- faltan motivos de bloqueo presentados de forma simple y accionable.

## 1.3 Riesgo de negocio

Si el sistema requiere que el propio fundador reconstruya reglas ocultas para operar, entonces:

- la curva de aprendizaje del usuario final será demasiado alta;
- el soporte comercial y funcional se vuelve caro;
- la percepción de calidad cae aunque el motor esté bien hecho;
- el producto parece arbitrario;
- se pierde confianza.

---

# 2. Principios rectores del refactor

## 2.1 No reescribir el producto

No rehacer todo.

Hay que refactorizar semántica, estructura visual y contratos de decisión.

## 2.2 Una sola verdad visible por decisión

Cada botón, badge, checklist, warning y CTA debe salir de una única estructura derivada y no de lógica dispersa.

## 2.3 Separación explícita de capas

La UI debe reflejar que el flujo no es una sola caja negra.

Capas visibles:

1. extracción;
2. revisión factual;
3. contexto contable;
4. clasificación/resolución;
5. preview contable y fiscal;
6. posting provisional/final;
7. corrida fiscal / IVA;
8. exportación.

## 2.4 Explainability como producto, no como tooltip decorativo

Explainability no es solo “mostrar una razón”.

Debe responder siempre estas preguntas:

- qué decidió el sistema;
- por qué lo decidió;
- con qué fuente de resolución;
- qué falta para avanzar;
- qué puede hacer ahora el usuario;
- qué impacto tendrá esa acción.

## 2.5 El usuario nunca debe adivinar

Si un botón está deshabilitado, el usuario debe poder entender inmediatamente:

- por qué;
- qué condición falta;
- cómo resolverla.

---

# 3. Resultado funcional esperado

Al terminar este refactor, cualquier usuario debería poder responder sin ayuda:

- en qué etapa está este documento;
- si la clasificación ya quedó resuelta o no;
- si la resolución vino de IA, regla o decisión manual;
- si puede postear provisional;
- si puede confirmar final;
- si el documento entra o no entra en IVA preview;
- si el documento entra o no entra en IVA definitivo;
- qué blockers existen;
- qué acción específica lo destraba.

---

# 4. Fase 1 — Canonical UX Model

## 4.1 Crear vocabulario oficial del sistema

Definir y documentar un único vocabulario para el producto.

### Entregable

Archivo nuevo sugerido:

`docs/04-documents/03-ui-canonical-states-and-decisions.md`

### Contenido mínimo

#### Estados de workflow visibles

- `pending_factual_review`
- `pending_assignment`
- `pending_learning_decision`
- `ready_for_provisional_posting`
- `posted_provisional`
- `ready_for_final_confirmation`
- `posted_final`
- `reopened_needs_manual_remap`
- `locked`

#### Estados auxiliares que no deben dominar la UX principal

- estados heredados de `documents.status`
- estados técnicos de processing
- estados intermedios internos de corridas IA

### Regla

La UI principal no debe basarse directamente en nombres heredados si ya existe un workflow operativo más claro.

## 4.2 Crear contrato único de decisión visible

### Entregable

Crear un contrato central del tipo:

`modules/documents/document-decision-snapshot.ts`

### Shape sugerido

```ts
export type ResolutionSource = 'rule' | 'ai' | 'manual' | 'mixed' | 'unknown'

export type PostingState =
  | 'draft'
  | 'ready_provisional'
  | 'posted_provisional'
  | 'ready_final'
  | 'posted_final'
  | 'locked'

export type EligibilityDecision = {
  ok: boolean
  reasons: string[]
  missingConditions: string[]
}

export type DecisionChecklistItem = {
  code: string
  label: string
  done: boolean
  severity: 'info' | 'warning' | 'blocking'
  explanation?: string
  actionHint?: string
}

export type DocumentDecisionSnapshot = {
  workflowState: string
  resolutionSource: ResolutionSource
  resolutionConfidence: number | null
  factualReviewResolved: boolean
  accountingContextResolved: boolean
  classificationResolved: boolean
  previewBalanced: boolean
  hasTemporaryAccounts: boolean
  fiscalTreatmentResolved: boolean
  postingState: PostingState
  canPostProvisional: boolean
  canConfirmFinal: boolean
  provisionalEligibility: EligibilityDecision
  finalEligibility: EligibilityDecision
  vatPreviewEligibility: EligibilityDecision
  vatRunEligibility: EligibilityDecision
  blockers: string[]
  warnings: string[]
  nextBestAction: string | null
  checklist: DecisionChecklistItem[]
}
```

## 4.3 Regla de arquitectura

Toda UI operativa debe leer este snapshot.

No calcular flags críticos por separado en cada componente.

---

# 5. Fase 2 — Rediseño del reviewer documental

## 5.1 Reordenar la pantalla por etapas humanas

La pantalla de revisión debe dejar de parecer una mezcla de paneles técnicos.

### Nuevo orden visual recomendado

1. **Estado actual del documento**
2. **Paso 1 — Revisar datos del comprobante**
3. **Paso 2 — Completar contexto contable**
4. **Paso 3 — Confirmar clasificación y cuentas**
5. **Paso 4 — Ver impacto contable y fiscal**
6. **Paso 5 — Resolver aprendizaje opcional**
7. **Paso 6 — Cerrar documento**

## 5.2 Header operativo obligatorio

Agregar un encabezado persistente arriba con:

- estado del documento;
- fuente de resolución;
- confianza;
- readiness para provisional;
- readiness para final;
- CTA recomendado.

### Ejemplo visual

- Estado: Pendiente de asignación
- Fuente de resolución actual: IA de baja confianza
- Puede postear provisional: No
- Puede confirmar final: No
- Siguiente acción recomendada: Confirmar cuenta principal manualmente

## 5.3 Separar “preview” de “decisión confirmada”

### Problema

Ver una cuenta correcta no significa que la resolución esté consolidada.

### Cambio requerido

Agregar una acción explícita:

**Confirmar asignación manual**

Esa acción debe:

- fijar la cuenta efectiva actual como resolución manual;
- actualizar `resolutionSource = manual`;
- limpiar blockers dependientes solo de baja confianza IA, cuando corresponda;
- dejar trazabilidad explícita.

## 5.4 Renombrar CTAs ambiguos

### Reemplazos sugeridos

- `Guardar etapa 1` → `Guardar contexto documental`
- `Guardar etapa 1 y recalcular asiento` → `Guardar y recalcular sugerencia`
- `Guardar asignación` → `Guardar cuentas seleccionadas`
- nuevo botón: `Confirmar asignación manual`
- `Aplicar clasificación con este contexto` → `Recalcular clasificación con este contexto`

### Regla

Ningún botón debe sonar más definitivo de lo que realmente hace.

## 5.5 Cierre con checklist visible

Reemplazar el bloque de cierre actual por checklist operativo.

### Checklist sugerido

- Datos documentales revisados
- Clasificación resuelta
- Cuenta principal definida
- Asiento balanceado
- Tratamiento fiscal resuelto
- Sin cuentas temporales
- Sin bloqueos críticos
- Listo para posting provisional
- Listo para confirmación final

### Regla UX

Cada ítem debe mostrar:

- estado;
- explicación breve;
- enlace o CTA directo para resolver.

---

# 6. Fase 3 — Explainability transversal

## 6.1 Crear un Explainability Card unificado

### Entregable

Nuevo componente sugerido:

`components/explainability/decision-explainability-card.tsx`

### Debe responder

1. Qué decidió el sistema
2. Por qué
3. Con qué evidencia
4. Con qué fuente de resolución
5. Qué podría cambiar la decisión
6. Qué riesgos o warnings existen

## 6.2 Estructura estándar de explainability

Cada decisión material del producto debería compartir este shape:

```ts
export type ExplainabilityBlock = {
  title: string
  summary: string
  decision: string
  source: 'rule' | 'ai' | 'manual' | 'mixed'
  confidence?: number | null
  rationale?: string[]
  evidence?: Array<{
    label: string
    value: string
  }>
  blockers?: string[]
  warnings?: string[]
  nextActions?: string[]
}
```

## 6.3 Decisiones que deben usar explainability estándar

- clasificación documental;
- asignación de cuenta principal;
- tratamiento IVA;
- readiness provisional;
- readiness final;
- elegibilidad para VAT preview;
- elegibilidad para VAT run;
- recomendación híbrida de presets;
- exportación generada.

## 6.4 Fuentes de resolución visibles en toda la app

Usar siempre el mismo sistema de fuentes:

- Regla
- IA
- Revisión manual
- Mixto
- Pendiente

No inventar sinónimos por pantalla.

## 6.5 Decision trail visible

Agregar un panel o drawer `Ver historial de decisión` con:

- última clasificación;
- corridas previas;
- overrides manuales;
- aprendizaje aprobado o no;
- reaperturas;
- posteo provisional/final;
- cambios relevantes de contexto.

---

# 7. Fase 4 — IVA / Tax UX

## 7.1 Separar explícitamente preview fiscal de corrida oficial

La pantalla de Impuestos debe distinguir visualmente:

1. **Preview operativo del período**
2. **Corrida oficial del período**

## 7.2 Mostrar universo fiscal con transparencia

Agregar un resumen arriba de la página:

- documentos del período;
- documentos elegibles para VAT preview;
- documentos excluidos del preview;
- documentos elegibles para VAT run oficial;
- documentos excluidos del run oficial.

## 7.3 Motivos de exclusión legibles

Cada exclusión debe mostrar razón humana:

- documento sigue en draft;
- clasificación no resuelta;
- tratamiento fiscal incompleto;
- sin posting suficiente para corrida oficial;
- documento reabierto;
- documento duplicado o archivado.

## 7.4 Regla de UI crítica

No marcar un período como “Listo” solo porque existe un run.

Mostrar estados más honestos:

- Sin corrida
- Corrida borrador
- Corrida con base incompleta
- Corrida lista para revisión
- Corrida confirmada

## 7.5 Nuevo contrato de elegibilidad fiscal

### Entregable

Crear utilidades puras:

- `eligibleForVatPreview(snapshot)`
- `eligibleForVatRun(snapshot)`

### Regla

La lógica fiscal no debe quedar escondida en JSX ni duplicada entre preview y runs.

---

# 8. Fase 5 — Cola operativa y vistas resumidas

## 8.1 Crear cola dedicada de pendientes de asignación

### Problema

Hoy la separación conceptual existe, pero no se siente como una operación diaria clara.

### Entregable

Nueva vista operativa para `pending_assignment`.

### Debe permitir

- filtrar por estado de workflow;
- filtrar por confianza;
- filtrar por blockers;
- filtrar por proveedor;
- ver siguiente acción recomendada;
- operar por lote cuando aplique.

## 8.2 Lista documental con badges útiles

En `/documents`, cada fila debería mostrar al menos:

- workflow state real;
- fuente de resolución;
- readiness provisional/final;
- estado fiscal;
- número de blockers;
- CTA principal.

## 8.3 Evitar badges de humo

No mostrar badges que no cambian la operativa del usuario.

Todo badge debe responder: “¿qué hago con esto?”.

---

# 9. Fase 6 — Contratos de copy y lenguaje de producto

## 9.1 Crear diccionario de copy oficial

### Entregable

Archivo nuevo sugerido:

`docs/00-foundations/product-language-and-copy-dictionary.md`

### Debe definir

- nombres oficiales de etapas;
- nombres oficiales de estados;
- nombres oficiales de fuentes de resolución;
- texto de blockers;
- texto de warnings;
- nombres de CTA;
- glosario de términos para usuario final.

## 9.2 Regla editorial

Una misma cosa no puede tener tres nombres distintos según pantalla o iteración histórica.

## 9.3 Simplificación obligatoria

Evitar lenguaje interno si no agrega valor:

- “assignment run” no debería dominar la UI final;
- “second pass” no debería ser el texto visible principal;
- “posting status” puede verse como “estado contable” o equivalente entendible.

---

# 10. Fase 7 — Instrumentación y observabilidad visible

## 10.1 Observabilidad funcional para el usuario

No solo auditoría técnica.

Agregar una capa visible de “por qué pasó esto” dentro de la experiencia.

## 10.2 Panel de diagnóstico por documento

### Entregable

Un panel de diagnóstico expandible con:

- workflow state derivado;
- flags críticos;
- blockers actuales;
- warnings actuales;
- resolución actual;
- elegibilidad fiscal;
- última corrida IA/regla;
- hashes o IDs solo en modo técnico.

## 10.3 Modo avanzado opcional

Para usuario experto o interno, agregar un toggle:

- Vista simple
- Vista avanzada

La vista avanzada puede mostrar:

- tabla de decisiones;
- IDs técnicos;
- trazabilidad completa;
- detalle de corridas.

La simple no debe contaminarse con jerga interna.

---

# 11. Fase 8 — Testing específico del refactor UX

## 11.1 Tests de snapshot de decisión

Crear suite dedicada para `DocumentDecisionSnapshot`.

### Casos mínimos

- preview correcto pero clasificación no resuelta;
- override manual que destraba cierre;
- documento balanceado pero con blockers fiscales;
- documento elegible para provisional pero no para final;
- documento elegible para VAT preview pero no para VAT run;
- documento reabierto;
- documento con cuentas temporales.

## 11.2 Tests de contratos de copy

Validar que el mismo estado siempre renderice el mismo label principal.

## 11.3 Tests de accesibilidad y claridad

Agregar pruebas sobre:

- botones deshabilitados con razón visible;
- checklist visible;
- CTA principal único por estado;
- consistencia de badges.

## 11.4 Smoke tests operativos

Escenarios reales de punta a punta:

1. factura compra simple;
2. factura venta contado;
3. documento con baja confianza IA;
4. documento corregido manualmente;
5. documento que entra en IVA preview;
6. documento que queda fuera del IVA definitivo.

---

# 12. Priorización real

## P0 — urgente

1. contrato `DocumentDecisionSnapshot`
2. header operativo del reviewer
3. checklist de cierre visible
4. acción `Confirmar asignación manual`
5. motivos visibles de botón deshabilitado
6. fuente de resolución visible
7. separación clara entre VAT preview y VAT run

## P1 — muy importante

1. explainability card unificado
2. decision trail
3. cola `pending_assignment`
4. elegibilidad fiscal declarativa
5. renombre de CTAs ambiguos
6. badges más útiles en listados

## P2 — siguiente consolidación

1. diccionario oficial de lenguaje
2. panel de diagnóstico avanzado
3. operación masiva guiada
4. explainability transversal en imports/exports/settings

---

# 13. Orden recomendado de implementación

## Sprint 1

- definir vocabulario canónico;
- implementar `DocumentDecisionSnapshot`;
- reemplazar flags sueltos del reviewer por snapshot;
- agregar header operativo;
- agregar fuente de resolución;
- agregar razón visible de bloqueo.

## Sprint 2

- implementar checklist de cierre;
- agregar `Confirmar asignación manual`;
- separar visualmente preview vs resolución confirmada;
- renombrar CTAs ambiguos.

## Sprint 3

- refactor de pantalla de IVA;
- contratos `eligibleForVatPreview` y `eligibleForVatRun`;
- motivos de exclusión legibles;
- estados honestos de corrida.

## Sprint 4

- explainability card transversal;
- decision trail;
- panel de diagnóstico avanzado;
- cola dedicada de pendientes de asignación.

---

# 14. Checklist ejecutivo de aceptación

El refactor se considera exitoso cuando se cumpla esto:

- un usuario entiende en qué etapa está el documento sin leer documentación externa;
- un botón deshabilitado siempre explica por qué;
- la UI diferencia claramente preview de resolución consolidada;
- la fuente de resolución es visible y consistente;
- la pantalla de IVA explica qué entra, qué no entra y por qué;
- el reviewer tiene una sola narrativa de trabajo;
- el lenguaje visible coincide con el modelo real del dominio;
- explainability es uniforme y no un parche local;
- el sistema da “siguiente mejor acción” en lugar de dejar al usuario adivinar.

---

# 15. Antiobjetivos

No hacer esto:

- meter más lógica crítica directamente en JSX;
- seguir multiplicando badges sin semántica;
- usar nombres distintos para la misma cosa;
- esconder blockers detrás de tooltips vagos;
- llamar “final” a acciones que solo recalculan;
- mezclar de nuevo extracción con revisión;
- mezclar preview fiscal con corrida oficial;
- usar explainability solo como texto bonito de IA.

---

# 16. Recomendación final

La prioridad no es “hacerlo más lindo”.

La prioridad es convertir el sistema en una máquina operable y legible.

El núcleo del refactor es este:

1. unificar estados;
2. unificar decisiones visibles;
3. unificar explainability;
4. hacer explícito qué falta para avanzar.

Si eso se resuelve, la UI deja de ser una pantalla que parece caprichosa y pasa a sentirse como una herramienta seria de trabajo.

