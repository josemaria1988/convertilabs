# PR-02 integration foundation

Fecha: 2026-04-19

Este documento registra el cierre operativo de la fundacion generica para integraciones. PR-02 no implementa llamadas a Zetasoftware ni asume endpoints reales: deja el sustrato persistente, seguro e idempotente para que PR-03/PR-04 puedan avanzar con mocks y para que PR-01 siga bloqueando solo el contrato REST oficial.

## Alcance ejecutado

- Schema canonico de integraciones agregado en `db/schema/07_integrations_and_audit.sql`:
  - `organization_integration_connections`;
  - `integration_sync_runs`;
  - `integration_sync_cursors`;
  - `integration_raw_records`;
  - `document_source_refs`;
  - `integration_entity_links`.
- Se omitio deliberadamente `integration_document_links`: la relacion documento-origen queda cubierta por `document_source_refs`.
- Idempotencia base:
  - una conexion por `(organization_id, provider)`;
  - cursores por `(organization_id, provider, stream, cursor_key)`;
  - raw records por `(organization_id, provider, entity_type, external_key)`;
  - source refs por `(organization_id, provider, source_kind, external_key)`;
  - entity links por `(organization_id, provider, external_entity_type, external_key)`.
- `integration_raw_records` incluye sobre monetario/FX desde el primer dia:
  - fecha documental;
  - moneda;
  - tasa origen;
  - fecha y semantica de tasa origen;
  - total, neto, impuesto y payload monetario auxiliar.
- `integration_sync_runs` incluye soporte de pruebas y limpieza:
  - `test_mode`;
  - `test_run_key`;
  - `cleanup_status`;
  - `cleanup_required_by`;
  - `cleanup_verified_at`;
  - `cleanup_evidence_json`.
- `document_source_refs` conserva trazabilidad factual:
  - `factual_trust_mode = external_deterministic`;
  - `drift_status`;
  - hashes de payload materializado/current;
  - compatibilidad futura con Bandeja;
  - URL PDF bajo demanda si el proveedor la ofrece.
- RLS agregado para las seis tablas nuevas.
- Migracion incremental creada y aplicada:
  - `supabase/migrations/20260419_integration_foundation.sql`.
- Migracion canonica consolidada regenerada:
  - `supabase/migrations/20260311_sync_canonical_schema_and_rls.sql`.
- Helpers server-only agregados:
  - cifrado/descifrado de credenciales;
  - fingerprint no reversible;
  - masking seguro de secretos;
  - test-run key `CVTLAB-<PROVIDER>-TST-YYYYMMDD-HHMM-<SUFFIX>`;
  - repositorio generico para conexiones, runs, cursores, raw records, source refs y entity links;
  - helper base para audit log de integraciones.

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

- `npm test`: OK, 271 tests.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- `npm run db:verify:parity`: OK.
- `npm audit --audit-level=moderate`: OK, 0 vulnerabilidades.
- Migracion PR-02 aplicada en la DB objetivo: OK.

## Nota sobre paridad DB

`npm run db:verify:parity` pasa despues de aplicar `20260419_integration_foundation.sql`.

El verificador sigue mostrando warnings por politicas RLS extra existentes en la DB objetivo. No son bloqueantes: las politicas faltantes, tablas faltantes, columnas faltantes, FKs, uniques, indices, funciones, triggers y enums siguen fallando como error.

## Estado para siguientes PRs

- PR-01 sigue bloqueado por contrato oficial/Postman de Zeta.
- PR-03 puede avanzar con UI/servicio de conexion usando la tabla generica y mocks, sin llamadas reales.
- PR-04 puede avanzar con Inngest runner mock y escritura real en `integration_sync_runs`, `integration_sync_cursors` y `integration_raw_records`.
- PR-06/PR-10 deben usar el sobre monetario de `integration_raw_records`.
- PR-08/PR-11 deben materializar documentos usando `document_source_refs` y reutilizando `documents.cost_center_id` para proyecto/operacion.
