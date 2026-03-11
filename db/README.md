# SQL canonico de base de datos

`db/` es la fuente SQL ordenada y consultable del modelo de datos de Convertilabs.

## Relacion con otras carpetas

- `docs/doc_supabase_schema.md` conserva el razonamiento de diseno y el contexto funcional.
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
9. `db/rls/supabase_rls_policies.sql`

## Regla de mantenimiento

Si cambia el schema o la estrategia de RLS:

1. actualizar primero `db/`
2. luego sincronizar `docs/`
3. y recien despues generar o ajustar migraciones de despliegue
