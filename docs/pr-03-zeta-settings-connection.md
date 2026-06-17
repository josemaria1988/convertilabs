> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# PR-03 Zeta settings connection

Fecha: 2026-04-19

Este documento registra el cierre operativo de `Settings > Integraciones` para Zetasoftware. PR-03 permite guardar una conexion, probarla en modo mock y dejar preparada la UI de sync/historial sin llamar endpoints reales de Zeta.

## Alcance ejecutado

- Se agrego el dominio server-only de conexion Zeta:
  - `modules/integrations/zeta/services/connection-service.ts`;
  - `modules/integrations/zeta/services/zeta-health-service.ts`.
- Se agregaron componentes de settings:
  - `components/settings/integrations/zetasoftware-connection-card.tsx`;
  - `components/settings/integrations/zetasoftware-sync-panel.tsx`;
  - `components/settings/integrations/zetasoftware-run-history.tsx`.
- `Settings > Integraciones` ahora incluye:
  - card Zetasoftware;
  - guardado de codigo de empresa, usuario/API key, base URL aprobada y secreto;
  - modo mock activo por defecto;
  - estado `disconnected`, `connected`, `paused` o `error`;
  - boton de prueba de conexion;
  - panel placeholder de sync;
  - historial vacio hasta PR-04.
- Se agregaron server actions:
  - `upsertOrganizationZetaConnectionAction`;
  - `testOrganizationZetaConnectionAction`.
- La data de settings carga la conexion Zeta desde `organization_integration_connections`.
- Las credenciales no se muestran completas en UI ni audit logs.
- Los eventos de auditoria quedan registrados como:
  - `zeta_connection_saved`;
  - `zeta_connection_tested`.
- El health real queda bloqueado con mensaje explicito hasta que PR-01 confirme el endpoint oficial.

## Validaciones

Comandos ejecutados:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run db:verify:parity
npm audit --audit-level=moderate
```

Resultado:

- `npm test`: OK, 274 tests.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- `npm run db:verify:parity`: OK.
- `npm audit --audit-level=moderate`: OK, 0 vulnerabilidades.

## Decisiones

- Provider code: `zetasoftware`.
- Una organizacion mantiene una unica conexion Zeta por `(organization_id, provider)`.
- Roles habilitados para administrar la conexion: `owner`, `admin`, `developer`.
- El modo mock permite guardar/probar conexion sin secreto real.
- Si el usuario intenta modo real antes de PR-01, el health devuelve `zeta_real_health_pending_contract`.
- No se implemento sync ni lectura de datos reales en este PR.

## Estado para siguientes PRs

- PR-01 sigue bloqueando el contrato real de endpoints.
- PR-04 puede usar la conexion guardada y crear corridas mock en `integration_sync_runs`.
- PR-05 debe resolver maestros/contrapartes usando `integration_entity_links`.
- PR-06/PR-10 deben mantener datos Zeta como raw records antes de materializar documentos.
