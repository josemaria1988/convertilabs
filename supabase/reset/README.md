# Reset limpio Convertilabs 2.0

Este directorio existe para reconstruir una base Supabase no productiva desde cero bajo el modelo Convertilabs 2.0.

## Orden de ejecucion

1. Ejecutar `supabase/reset/00_clean_public_schema.sql`.
2. Ejecutar los schemas canonicos, en este orden:
   - `db/schema/00_extensions.sql`
   - `db/schema/01_enums.sql`
   - `db/schema/02_identity_and_tenants.sql`
   - `db/schema/03_master_data.sql`
   - `db/schema/04_documents.sql`
   - `db/schema/05_accounting.sql`
   - `db/schema/06_tax_and_rules.sql`
   - `db/schema/07_integrations_and_audit.sql`
   - `db/schema/08_document_ai_pipeline.sql`
   - `db/schema/09_accounting_read_models.sql`
   - `db/schema/10_company_mother_model.sql`
   - `db/schema/11_legacy_bridges.sql`
   - `db/rls/supabase_rls_policies.sql`

## Alternativa sin reset

Para una base existente, ejecutar solo:

- `supabase/migrations/20260617_pr01_company_mother_model.sql`
- `supabase/migrations/20260617_pr02_legacy_bridges.sql`

## Nota

El reset borra todo lo que viva en `public`. No usarlo sobre una base con datos reales que deban conservarse.
