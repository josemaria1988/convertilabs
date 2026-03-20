# Cockpit de cierre y controles de periodo

## Objetivo del modulo

Convertir al periodo contable en una unidad operativa visible y gobernable: estado formal, validator deterministico, transiciones auditadas y locks que realmente impactan el workflow documental y contable.

## Superficies activas

- `app/app/o/[slug]/close/page.tsx`
- `app/app/o/[slug]/close/actions.ts`
- `modules/close/service.ts`
- `modules/accounting/fiscal-period-status.ts`
- `modules/assistant/runs.ts`
- `db/schema/05_accounting.sql`
- `db/schema/07_integrations_and_audit.sql`
- `supabase/migrations/20260320_close001_period_close_and_assistant_runs.sql`

## Estado implementado hoy

### Maquina de estados del periodo

`fiscal_periods` ya soporta el lifecycle operativo nuevo:

- `open`
- `ready_to_close`
- `soft_closed`
- `tax_locked`
- `hard_closed`
- `audit_frozen`

El codigo mantiene compatibilidad con estados legacy (`review`, `closed`, `locked`) para no romper historia, pero el flujo nuevo normaliza y transiciona sobre los estados canonicos.

### Semantica real actual

- `open`: el periodo admite posting documental y reaperturas normales.
- `ready_to_close`: el mes sigue mutable, pero ya se trabaja con foco de cierre.
- `soft_closed`: se bloquean nuevas mutaciones documentales y posting operativo.
- `tax_locked`: ademas del lock operativo, el periodo exige VAT run finalizado o locked para avanzar.
- `hard_closed` y `audit_frozen`: el modelo ya los contempla, pero la transicion real queda reservada hasta la fase de `close_snapshots`.

## Close validator

`modules/close/service.ts` ya construye una corrida deterministica del corte con snapshot y resultados persistidos en:

- `close_check_runs`
- `close_check_results`
- `fiscal_period_transition_logs`

Checks activos hoy:

- documentos del periodo listos para cierre;
- postings provisionales resueltos;
- asientos finalizados e inmutables;
- trial balance balanceado;
- VAT run finalizado o locked;
- conciliacion DGI cerrada;
- documentos cargados fuera de ventana;
- open items abiertos visibles para el corte.

Cada corrida clasifica resultados como `pass`, `warning` o `blocker`, y el cockpit muestra el resumen vivo aun antes de persistir una corrida formal.

## Cockpit y transiciones

La pantalla `/app/o/[slug]/close` ya ofrece:

- seleccion de periodo;
- resumen del estado formal del mes;
- metricas del corte;
- ejecucion manual del validator;
- visualizacion de checks y semaforos;
- botones de transicion habilitados segun politica actual;
- enlace rapido hacia `tax`.

Las transiciones hoy soportadas son:

- `open -> ready_to_close`
- `ready_to_close -> open`
- `ready_to_close -> soft_closed`
- `soft_closed -> open`
- `soft_closed -> tax_locked`
- `tax_locked -> open`

Cuando una transicion requiere gate de cierre, el sistema corre el validator antes de actualizar el periodo y deja traza en `audit_log` y `fiscal_period_transition_logs`.

## Guardrails sobre documentos

El workflow documental ya consulta `assertFiscalPeriodAllowsDocumentMutation(...)` antes de:

- postear provisionalmente;
- confirmar final;
- reabrir una revision confirmada.

Eso evita que un documento vuelva a mutar un mes ya `soft_closed`, `tax_locked`, `hard_closed` o `audit_frozen`, incluso si el usuario todavia esta trabajando desde la UI de revision.

## Trazabilidad IA asociada

La misma epica agrega una capa transversal de observabilidad para sugerencias IA:

- `system_actors`
- `assistant_runs`
- `assistant_run_evidence_refs`
- `assistant_suggestions`

En el flujo documental actual, las sugerencias del assistant quedan registradas, se superseden cuando aparece una corrida mas nueva y se resuelven como aceptadas o rechazadas cuando la aprobacion humana materializa el resultado final.

## Limites actuales y siguiente fase

Implementado:

- cockpit base de cierre;
- validator deterministico;
- period guards reales;
- trazabilidad IA transversal minima.

Pendiente:

- `close_snapshots`, `hard_closed` real y `audit_frozen` operativo;
- manual entries y ajustes de cierre avanzados;
- workspace de auditor externo;
- checks mas profundos para bancos, FX, provisionales por materialidad y reporting formal.
