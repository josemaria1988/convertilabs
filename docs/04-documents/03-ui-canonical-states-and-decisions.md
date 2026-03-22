# UI canonical states and decisions

## Objetivo

Definir una sola semantica visible para la operacion documental de Convertilabs.

Este documento no reemplaza el workflow tecnico. Lo traduce a un lenguaje estable para UI,
copy, explainability y soporte funcional.

## Regla principal

La UI operativa no debe colgarse directamente de nombres heredados de `documents.status`,
`posting_status`, corridas IA o flags sueltos. Debe apoyarse en un snapshot canonico de
decision y en este vocabulario.

## Workflow visible oficial

Estos son los estados que deben dominar la experiencia principal:

- `pending_factual_review`
- `pending_assignment`
- `pending_learning_decision`
- `ready_for_provisional_posting`
- `posted_provisional`
- `ready_for_final_confirmation`
- `posted_final`
- `reopened_needs_manual_remap`
- `locked`

## Significado operativo

### `pending_factual_review`

- Todavia faltan validar datos del comprobante.
- CTA principal: revisar datos del comprobante.

### `pending_assignment`

- El documento ya tiene base factual, pero la resolucion contable no quedo consolidada.
- CTA principal: resolver clasificacion.

### `pending_learning_decision`

- El documento ya puede avanzar y solo falta decidir si guardar criterio reusable.
- CTA principal: decidir aprendizaje.

### `ready_for_provisional_posting`

- El documento ya puede impactar contabilidad en modo provisional.
- CTA principal: postear provisional.

### `posted_provisional`

- El documento ya impacto en contabilidad, pero aun puede requerir cierre final.
- CTA principal: revisar para confirmacion final.

### `ready_for_final_confirmation`

- La resolucion quedo cerrada y ya puede confirmarse como definitiva.
- CTA principal: confirmar final.

### `posted_final`

- El documento ya quedo confirmado y solo admite reapertura controlada.
- CTA principal: ver trazabilidad o reabrir si corresponde.

### `reopened_needs_manual_remap`

- La revision fue reabierta y requiere remapeo manual.
- CTA principal: remapear manualmente.

### `locked`

- El documento o su periodo ya no admiten cambios sin reapertura formal.
- CTA principal: revisar bloqueo.

## Estados auxiliares que no deben dominar la UX principal

Estos estados pueden aparecer en vista avanzada, diagnostico o auditoria tecnica, pero no
deben ser la narrativa principal de la UI:

- estados heredados de `documents.status`
- estados tecnicos de processing
- estados intermedios de `document_assignment_runs`
- detalles internos de `assistant_runs`
- flags parciales de steps

## Fuente de resolucion oficial

Toda superficie visible debe usar solo estas fuentes:

- `rule`
- `ai`
- `manual`
- `mixed`
- `unknown`

## Semantica por fuente

### `rule`

- La resolucion efectiva salio de una regla deterministica o reusable.

### `ai`

- La resolucion efectiva dependio de la sugerencia IA.

### `manual`

- La resolucion efectiva quedo fijada por override o confirmacion manual explicita.

### `mixed`

- Regla e IA convergieron o ambas aportaron una resolucion consistente.

### `unknown`

- Todavia no hay fuente consolidada visible para el usuario.

## Posting state oficial

Para copy y explainability, el estado contable visible debe expresarse como:

- `draft`
- `ready_provisional`
- `posted_provisional`
- `ready_final`
- `posted_final`
- `locked`

## Checklist base obligatorio

Todo reviewer documental deberia poder expresar, desde un solo snapshot, al menos estos checks:

- datos documentales revisados
- contexto contable resuelto
- clasificacion resuelta
- cuenta principal definida
- asiento balanceado
- tratamiento fiscal resuelto
- sin cuentas temporales
- sin bloqueos criticos
- listo para posting provisional
- listo para confirmacion final
- elegible para VAT preview
- elegible para VAT run oficial

## Anti-regla

Una pantalla no deberia inventar estados nuevos si ya existe uno canonico que explica la misma
situacion operativa.
