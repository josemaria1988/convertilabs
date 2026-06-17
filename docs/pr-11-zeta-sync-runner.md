> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# PR-11 soporte - Zeta sync runner e Inngest

Fecha: 2026-06-17

Este documento registra el cierre operativo del runner base de sincronizaciones Zetasoftware. Esta pieza queda asociada al bloque de integraciones del plan maestro, no al PR-04 de Trabajos MVP. Encola corridas via Inngest, crea/cierra `integration_sync_runs`, escribe cursores idempotentes y deja trazabilidad para modo mock/test sin implementar nuevos streams de negocio.

## Alcance ejecutado

- Se agregaron eventos Inngest typed para Zetasoftware:
  - `integrations/zeta.sync.requested`.
- Se agrego funcion Inngest propia:
  - `modules/integrations/zeta/inngest-function.ts`.
- Se agrego runner base:
  - `modules/integrations/zeta/sync/sync-runner.ts`;
  - `modules/integrations/zeta/sync/cursors.ts`.
- Las acciones de `Settings > Integraciones` y `Audit > Zetasoftware` ahora encolan runs en vez de ejecutar sync largo dentro de la request.
- El runner:
  - crea runs `queued`;
  - reclama runs como `running`;
  - cierra `completed`, `completed_with_warnings` o `failed`;
  - registra audit events;
  - escribe cursores por stream/periodo;
  - propaga `test_mode` y `test_run_key`;
  - mantiene `cleanup_status = not_required` para lecturas read-only.
- Se agrego lock persistente por organizacion + provider + stream con indice unico parcial para estados `queued` y `running`.

## Archivos principales

- `lib/inngest/client.ts`
- `lib/inngest/functions.ts`
- `modules/integrations/zeta/inngest-function.ts`
- `modules/integrations/zeta/sync/sync-runner.ts`
- `modules/integrations/zeta/sync/cursors.ts`
- `modules/integrations/zeta/services/sync-service.ts`
- `modules/integrations/repository.ts`
- `supabase/migrations/20260617_pr04_zeta_sync_runner.sql`
- `tests/zeta-sync-runner.test.cjs`

## Validaciones

Comandos ejecutados:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Resultado:

- `npm test`: OK, 368 tests.
- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run build`: OK.

## Decisiones

- El lock principal queda en DB con `idx_integration_sync_runs_one_active_per_stream`.
- Inngest tambien limita concurrencia por `organizationId + stream`.
- `monthly_documents` se traduce a dos runs independientes: `sales_documents` y `received_cfes`.
- Los runs test reciben `test_run_key` para correlacion y limpieza futura.
- El sync real sigue siendo read-only respecto de Zeta.

## Fuera de alcance

- No se agregaron nuevos streams funcionales.
- No se agrego materializacion nueva.
- No se escriben datos hacia Zeta.
