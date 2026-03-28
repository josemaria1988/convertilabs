# Administracion de reglas contables y aprendizaje

## Objetivo del modulo

Hacer visible y gobernable la capa reusable de decision contable: reglas aprendidas o creadas manualmente, lifecycle, prioridad, conflictos, simulacion y contexto consultivo.

## Superficies activas

- `/app/o/[slug]/rules`
- `/app/o/[slug]/rules/new`
- `/app/o/[slug]/rules/[ruleId]`
- `/app/o/[slug]/rules/[ruleId]/version`
- `/app/o/[slug]/settings/accounting-rules` como redirect legacy
- `components/rules/accounting-rules-page-shell.tsx`
- `components/rules/accounting-rules-table.tsx`
- `components/rules/accounting-rule-detail-panel.tsx`
- `components/rules/accounting-rule-editor.tsx`
- `components/rules/accounting-rule-ai-chat-panel.tsx`
- `components/rules/accounting-rule-timeline.tsx`
- `modules/accounting/rules-admin.ts`
- `modules/accounting/rules.ts`
- `modules/accounting/learning-approval-service.ts`
- `supabase/migrations/20260324_rule001_accounting_rules_admin_foundations.sql`
- `supabase/migrations/20260324_rule002_accounting_rules_admin_simulations_and_ai.sql`

## Que ya hace hoy esta superficie

### Listado y filtros

La pantalla principal ya permite filtrar por:

- texto;
- lifecycle (`active`, `paused`, `superseded`, `draft`);
- scope;
- source;
- vendor;
- account;
- categoria operativa;
- solo con conflictos;
- solo sin uso.

Tambien muestra metricas operativas de total, activas, pausadas, reemplazadas y creadas desde aprendizaje.

### Creacion y versionado

La UI ya soporta:

- crear reglas manuales nuevas;
- crear version superseding forward-only;
- dejar la regla historica trazable;
- simular impacto antes de confirmar una nueva version;
- abrir el editor dedicado sin mezclarlo con la vista de detalle.

### Lifecycle y seguridad

Ya existen acciones dedicadas para:

- pausar;
- reactivar;
- borrar solo si la regla no tuvo uso;
- mover prioridad arriba/abajo con simulacion previa.

No se rompe historial para editar una regla usada. La operativa correcta es versionar o pausar.

### Explainability y auditoria

Cada regla puede mostrar:

- que mira y que decide;
- metadata visible de scope, prioridad, cuenta, origen y familia;
- timeline de eventos;
- documentos recientes afectados;
- conflictos con otras reglas;
- simulaciones guardadas;
- chat consultivo de IA bajo demanda.

## Relacion con el workflow documental

Esta superficie no reemplaza el reviewer documental. Lo complementa:

- `Guardar como criterio` desde `Documentos` crea o fortalece esta capa reusable;
- la precedencia del motor sigue gobernada por `modules/accounting/rules.ts`;
- los documentos usan estas reglas en runtime y dejan evidencia en `document_assignment_runs`;
- la UI de `rules` permite entender por que una regla gana, donde aplica y que cambiaria si la versionas.

## Persistencia activa

- `accounting_rules`
- `accounting_rule_events`
- `accounting_rule_simulations`
- `accounting_rule_ai_threads`
- `accounting_rule_ai_messages`
- `document_assignment_runs`
- `audit_log`

## Roles actuales

- `owner`, `admin` y `accountant` pueden administrar reglas;
- roles consultivos altos pueden auditar, leer conflictos y usar el chat consultivo segun RLS;
- el chat no muta reglas por si solo: solo analiza cobertura, conflictos y acciones sugeridas.

## Limites actuales

- no existe aprobacion automatica desde el chat;
- no existe reescritura retrospectiva masiva de historicos;
- no existe modulo productivo de jobs/cost centers que amplie scopes de reglas;
- el bulk editing sigue siendo conservador y acotado.
