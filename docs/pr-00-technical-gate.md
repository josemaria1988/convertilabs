> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# PR-00 technical gate

Fecha: 2026-04-19

Este documento registra el cierre operativo del gate tecnico previo a la integracion Zetasoftware.

## Alcance ejecutado

- Dependencias directas alineadas:
  - `next` de `15.5.14` a `15.5.15`;
  - `eslint-config-next` de `15.5.14` a `15.5.15`.
- `npm audit fix` aplicado sin `--force`.
- Auditoria npm queda en 0 vulnerabilidades.
- CI ahora ejecuta `npm run build`.
- El generador canonico de DB incorpora `db/schema/09_accounting_read_models.sql`.
- El verificador de parity deja de tratar vistas como tablas base.
- El schema canonico incluye tablas/columnas que ya estaban activas por migraciones intermedias:
  - business profile versions/activities/traits;
  - preset applications y preset AI runs;
  - spreadsheet import runs;
  - location reasonability fields;
  - `uy_locations`.
- Se regenero la migracion consolidada `supabase/migrations/20260311_sync_canonical_schema_and_rls.sql`.
- Se aplicaron en la DB objetivo las migraciones pendientes:
  - `20260320_close001_period_close_and_assistant_runs.sql`;
  - `20260322_doc017_accounting_assistant_threads.sql`;
  - `20260322_tax018_period_workbench.sql`.
- Se agrego y ejecuto una reparacion idempotente de paridad para la base actual:
  - `supabase/migrations/20260419_repair_current_db_parity.sql`.
- Se ajusto `public.finalize_journal_entry()` para evitar resoluciones ambiguas de variables PL/pgSQL en el SQL Editor de Supabase.

## Validaciones

Comandos ejecutados:

```bash
npm ci
npm audit --audit-level=moderate
npm ls next eslint-config-next --depth=0
npm run lint
npm test
npm run typecheck
npm run db:verify:parity
npm run build
```

Resultado:

- `npm ci`: OK.
- `npm audit --audit-level=moderate`: OK, 0 vulnerabilidades.
- `npm ls next eslint-config-next --depth=0`: OK, ambos en `15.5.15`.
- `npm run lint`: OK.
- `npm test`: OK, 264 tests.
- `npm run typecheck`: OK.
- `npm run db:verify:parity`: OK.
- `npm run build`: OK.
- SQL repair de paridad: OK en Supabase.

## Nota sobre RLS

`npm run db:verify:parity` pasa. El comando informa warnings por politicas RLS extra existentes en la DB objetivo. El gate las considera no bloqueantes porque:

- las politicas faltantes siguen siendo error;
- tablas, columnas, FKs, uniques, indices, enums, funciones, triggers y RLS faltantes siguen siendo error;
- una politica adicional no rompe el contrato esperado de la aplicacion.

Si se quiere eliminar el ruido antes de PR-02, el siguiente paso es volcar esas politicas extra al canon RLS o definir una lista explicita de allowlist.

## Estado para Zeta

PR-00 queda listo para sostener PR-02:

- dependencias reproducibles;
- build dentro de CI;
- auditoria npm limpia;
- schema canonico actualizado;
- reparacion puntual de DB actual documentada;
- parity de DB en verde contra la base objetivo;
- sin codigo funcional Zeta todavia.
