# Revision documental, clasificacion, aprendizaje y posting

## Objetivo del modulo

Tomar un draft ya extraido, revisarlo, clasificarlo contable y fiscalmente, permitir overrides y aprendizaje, mostrar preview y terminar en posting provisional o final sin mezclar todo en una sola caja negra.

## Superficies activas

- `components/documents/document-review-workspace.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `modules/documents/review.ts`
- `modules/documents/workflow-state.ts`
- `modules/accounting/classification-runner.ts`
- `modules/accounting/learning-approval-service.ts`
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

1. `document_override`
2. `vendor_concept_operation_category`
3. `vendor_concept`
4. `concept_global`
5. `vendor_default`
6. defaults del proveedor
7. assistant second pass
8. `manual_review`

Esto ya refleja el scope nuevo recomendado por el rector:

- `vendor_concept_operation_category`

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

### Corridas de clasificacion

`document_assignment_runs` deja registro de:

- request/response;
- cuenta y categoria seleccionada;
- template y tax profile;
- proveedor y modelo;
- latencia;
- confianza.

## Posting provisional y final

### Regla operativa

El repo ya adopta el principio correcto: si el documento puede quedar razonablemente balanceado y trazado, debe poder postear provisional antes de quedar final.

### Provisional

- persiste artefactos;
- actualiza `posting_status`;
- puede alimentar VAT preview;
- deja cola de recategorizacion hacia export.

### Final

- confirma draft;
- genera confirmacion y journal final;
- sincroniza open items;
- puede crear regla aprobada si el usuario lo decide;
- actualiza VAT run del periodo.

## Reapertura

`reopenDocumentReview(...)`:

- clona el ultimo draft confirmado;
- abre nueva revision;
- reusa contexto y hechos persistidos;
- marca assignment runs como stale;
- no rerunea IA automaticamente.

Esto esta alineado con el rector y es una de las reglas mas importantes del producto.

## Gaps actuales frente al rector

- falta una cola dedicada, filtrable y masiva de "pendientes de asignacion";
- falta session rule para lotes grandes;
- la relacion con jobs/cost centers aun no existe como modulo productivo completo;
- explainability aun no es uniforme en todas las vistas privadas.
