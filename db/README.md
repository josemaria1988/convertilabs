# SQL canonico de base de datos

`db/` es la fuente SQL ordenada y consultable del modelo de datos de Convertilabs.

## Relacion con otras carpetas

- `docs/07-platform/database-api-background-jobs-and-observability.md` documenta el encaje funcional del schema, las APIs y la observabilidad.
- `docs/00-foundations/01-mapa-del-repo-y-rutas.md` resume rutas, migraciones y capas activas del producto.
- `db/schema/*.sql` contiene el schema ejecutable dividido por capas.
- `db/rls/supabase_rls_policies.sql` contiene las politicas de seguridad y RLS listas para ejecutar en Supabase.
- `supabase/migrations/` se mantiene como historial de despliegue existente en esta etapa.

## Orden de aplicacion

1. `db/schema/00_extensions.sql`
2. `db/schema/01_enums.sql`
3. `db/schema/02_identity_and_tenants.sql`
4. `db/schema/03_master_data.sql`
5. `db/schema/04_documents.sql`
6. `db/schema/05_accounting.sql`
7. `db/schema/06_tax_and_rules.sql`
8. `db/schema/07_integrations_and_audit.sql`
9. `db/schema/08_document_ai_pipeline.sql`
10. `db/schema/09_accounting_read_models.sql`
11. `db/schema/10_company_mother_model.sql`
12. `db/schema/11_legacy_bridges.sql`
13. `db/schema/12_operations_communications.sql`
14. `db/schema/13_operational_intelligence.sql`
15. `db/schema/14_treasury.sql`
16. `db/rls/supabase_rls_policies.sql`

Nota operativa:

- `db/schema/09_accounting_read_models.sql` es canonico para las vistas contables read-only;
- `db/schema/14_treasury.sql` contiene caja bancaria manual, vales y proyeccion de tesoreria;
- el generador `npm run db:generate:migration` arma la migracion consolidada desde `db/schema/* + RLS`.

## Regla de mantenimiento

Si cambia el schema o la estrategia de RLS:

1. actualizar primero `db/`
2. luego sincronizar `docs/`
3. y recien despues generar o ajustar migraciones de despliegue

## Scripts operativos

- `npm run db:generate:migration` regenera `supabase/migrations/20260311_sync_canonical_schema_and_rls.sql` desde el canon de `db/`.
- `npm run db:verify:parity` compara la base real contra tablas, columnas, FKs, uniques, indices, enums, funciones, triggers y politicas esperadas.
- `npm run db:smoke:profile-sync` crea un usuario temporal en Supabase Auth para verificar la creacion espejo inicial en `public.profiles`.
- `npm run db:smoke:organization-onboarding` crea usuarios temporales para verificar el RPC de onboarding, la membership owner y la resolucion de colision de slug.
- `npm run db:smoke:private-dashboard` crea un tenant temporal y un documento real para verificar el conteo SSR y el RPC `list_dashboard_documents`.
- `npm run db:smoke:document-upload` crea un usuario y tenant temporales, prepara metadata con `prepare_document_upload`, sube un PDF real a `documents-private`, finaliza el estado y valida que el dashboard lo liste.

## Estado real del schema hoy

Las ultimas migraciones activas del repo ya extienden:

- assistant threads y messages documentales;
- tax workbench por periodo;
- admin de reglas contables con eventos, simulaciones y chat consultivo.
