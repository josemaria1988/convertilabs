# SQL canonico de base de datos

`db/` es la fuente SQL ordenada y consultable del modelo de datos de Convertilabs.

La documentacion de producto y arquitectura vive en:

- `docs/convertilabs-2.0-baseline-arquitectura.md`
- `docs/analisis-arquitectura-convertilabs-2.0.md`
- `docs/agent_rules.md`

## Relacion con otras carpetas

- `db/schema/*.sql` contiene el schema canonico dividido por capas.
- `db/rls/supabase_rls_policies.sql` contiene las politicas de seguridad y RLS listas para ejecutar en Supabase.
- `supabase/migrations/` se mantiene como historial de despliegue existente.
- `modules/` contiene servicios y logica de dominio que consumen este modelo.

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
16. `db/schema/15_work_intake.sql`
17. `db/rls/supabase_rls_policies.sql`

## Modelo Convertilabs 2.0

El schema actual ya contiene piezas del modelo madre:

- parties, roles, identificadores y contactos;
- work_units/trabajos;
- documents con party/work_unit;
- business_events, entity_links y evidence_refs;
- source refs, raw records e integration links;
- accounting, journal entries y open items;
- tax/IVA/cierre;
- tasks, processes, obligations, capture notes e interactions;
- operational_suggestions;
- treasury/bancos/vales.
- work_intake_items para solicitudes, cotizaciones y oportunidades previas a trabajo.

Las tablas legacy como `vendors`, `customers`, `organization_cost_centers` y `documents.cost_center_id` pueden seguir existiendo como bridges. No deben ser fuente primaria para features nuevas cuando exista `party` o `work_unit`.

## Regla de mantenimiento

Si cambia persistencia:

1. actualizar primero `db/schema/`;
2. actualizar `db/rls/` si corresponde;
3. agregar migracion en `supabase/migrations/`;
4. actualizar servicios/tests;
5. actualizar documentacion viva solo si cambia la arquitectura o una regla de producto.

## Scripts operativos

- `npm run db:generate:migration` regenera la migracion consolidada desde `db/schema/* + RLS`.
- `npm run db:verify:parity` compara la base real contra tablas, columnas, FKs, uniques, indices, enums, funciones, triggers y politicas esperadas.
- `npm run db:smoke:profile-sync` verifica la creacion espejo inicial en `public.profiles`.
- `npm run db:smoke:organization-onboarding` verifica el RPC de onboarding y membership owner.
- `npm run db:smoke:private-dashboard` verifica tenant, documento real y dashboard SSR.
- `npm run db:smoke:document-upload` valida preparacion, storage privado, finalizacion y listado de documento.
