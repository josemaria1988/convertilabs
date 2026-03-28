# Revision documental, clasificacion, aprendizaje y posting

## Objetivo del modulo

Tomar un draft ya extraido, revisarlo, clasificarlo contable y fiscalmente, permitir overrides y aprendizaje, mostrar preview y terminar en posting provisional o final sin mezclar todo en una sola caja negra.

Desde `2026-03-28`, esta capacidad ya no entra por `Documentos`: la cola principal vive en `/app/o/[slug]/review` y el detalle sigue en `/app/o/[slug]/documents/[documentId]` con UX guiada por pasos, rail del asistente opcional y detalles tecnicos colapsados.

## Superficies activas

- `app/app/o/[slug]/documents/pending-assignment/page.tsx`
- `components/documents/document-review-staged-workspace.tsx`
- `components/documents/document-review-workspace.tsx`
- `components/documents/document-accounting-assistant-rail.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `modules/documents/review.ts`
- `modules/documents/workflow-state.ts`
- `modules/accounting/classification-runner.ts`
- `modules/accounting/learning-approval-service.ts`
- `modules/accounting/rules-admin.ts`
- `modules/assistant/document-assistant.ts`
- `modules/assistant/runs.ts`
- `modules/documents/post-provisional-service.ts`
- `modules/documents/confirm-final-service.ts`
- `modules/documents/reopen-remap-service.ts`

## Capas reales del workflow

### 1. Revision factual

El usuario corrige o confirma:

- identidad documental;
- campos;
- montos;
- categoria operativa.

### 2. Accounting context

Si la clasificacion necesita contexto adicional, el sistema pide:

- texto libre;
- nota de proposito empresarial;
- override manual de cuenta;
- override de concepto;
- override de categoria operativa.

### 3. Seleccion de regla contable

El orden de precedencia actual en `modules/accounting/rule-engine.ts` es:

1. `manual_override`
2. `document_override`
3. `vendor_concept_operation_category`
4. `vendor_concept`
5. `concept_global`
6. `vendor_default`
7. `assistant`
8. `manual_review`

Esto ya refleja el scope nuevo recomendado por el rector:

- primero gana la decision manual visible;
- despues entran reglas reutilizables y auditables;
- la IA queda tarde y acotada, no como bypass del dominio.

### 4. Tratamiento fiscal

Se resuelve por motor deterministico, hoy principalmente IVA Uruguay.

### 5. Preview

El usuario ve:

- cuenta sugerida;
- regla aplicada;
- warnings;
- preview contable;
- impacto fiscal;
- readiness para provisional/final.

### 6. Aprendizaje

Separado del posting principal. El usuario puede guardar o no un criterio reusable.

La superficie staged ahora lo hace visible como decision explicita:

- `Resolver solo este documento` mantiene la resolucion dentro del draft actual;
- `Guardar como criterio` llama `learning-approval-service.ts` y crea una regla reusable visible en `accounting_rules`;
- la bandeja documental reaplica esos criterios guardados en lote cuando el usuario ejecuta la accion correspondiente.

### 7. Posting

Estados de posting soportados:

- `posted_provisional`
- `posted_final`
- `locked`

Y existe reapertura controlada.

## Workflow state activo

`deriveDocumentWorkflowState(...)` ya construye una vista operativa mas cercana al rector con colas como:

- `pending_factual_review`
- `pending_assignment`
- `pending_learning_decision`
- `ready_for_provisional_posting`
- `posted_provisional`
- `ready_for_final_confirmation`
- `posted_final`
- `reopened_needs_manual_remap`

## Explainability real

El reviewer ya puede ver:

- regla aplicada;
- alcance de aprendizaje reusable sugerido;
- decision comment;
- warnings y blockers;
- rationale del assistant;
- preview contable;
- preview VAT;
- impacto de cambios.

Herramientas activas:

- `DecisionComment`
- `HelpHintContent`
- `rule-explainer.ts`
- `decision-log.ts`
- `components/ui/help-hint.tsx`

## Persistencia y auditoria

### Tablas y artefactos

- `document_assignment_runs`
- `accounting_rules`
- `journal_entries`
- `journal_entry_lines`
- `ledger_open_items`
- `document_confirmations`
- `document_revisions`
- `ai_decision_logs`
- `assistant_runs`
- `assistant_run_evidence_refs`
- `assistant_suggestions`

### Corridas de clasificacion

`document_assignment_runs` deja registro de:

- request/response;
- cuenta y categoria seleccionada;
- template y tax profile;
- proveedor y modelo;
- latencia;
- confianza.

Adicionalmente, `assistant_runs` deja trazabilidad transversal de:

- persona operativa del assistant;
- prompt/version/modelo;
- request/response estructurado;
- evidencia leida;
- sugerencia pendiente;
- resolucion humana posterior.

Desde `20260322_doc017_*`, esa capa ya tiene ademas `assistant_threads` y `assistant_messages`, lo que permite UI consultiva visible en el rail documental.

## Posting provisional y final

### Regla operativa

El repo ya adopta el principio correcto: si el documento puede quedar razonablemente balanceado y trazado, debe poder postear provisional antes de quedar final.

### Provisional

- persiste artefactos;
- actualiza `posting_status`;
- puede alimentar VAT preview;
- respeta locks del periodo contable antes de materializar;
- deja cola de recategorizacion hacia export.

### Final

- confirma draft;
- genera confirmacion y journal final;
- sincroniza open items;
- puede crear regla aprobada si el usuario lo decide;
- resuelve la sugerencia IA asociada como aceptada o rechazada;
- actualiza VAT run del periodo.

## Reapertura

`reopenDocumentReview(...)`:

- clona el ultimo draft confirmado;
- abre nueva revision;
- reusa contexto y hechos persistidos;
- marca assignment runs como stale;
- valida que el periodo contable siga mutable antes de reabrir;
- no rerunea IA automaticamente.

Esto esta alineado con el rector y es una de las reglas mas importantes del producto.

## Gaps actuales frente al rector

- existe una cola dedicada `pending-assignment`, pero la operativa masiva sigue siendo acotada y no cubre todos los casos por lote;
- falta session rule para lotes grandes;
- la relacion con jobs/cost centers aun no existe como modulo productivo completo;
- explainability aun no es uniforme en todas las vistas privadas.
