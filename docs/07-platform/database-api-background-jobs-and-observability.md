# Base de datos, APIs, background jobs y observabilidad

## Objetivo del modulo

Documentar la infraestructura real que sostiene el producto: schemas, migraciones, RLS, rutas API, OpenAI wrappers, Inngest y auditoria.

## Base de datos y migraciones

El esquema vive en dos capas:

- `db/schema/00..09_*` como referencia canonica consolidada;
- `supabase/migrations/` como historial aplicable por hitos de producto.

Migraciones recientes que cambian el mapa operativo actual:

- `20260315_doc016_business_profile_catalog_version.sql`
- `20260317_doc012_accounting_kernel_foundations.sql`
- `20260317_int002_cfe_email_connections.sql`
- `20260318_doc013_accounting_read_models.sql`

## Grupos de tablas activos

### Identidad y tenancy

- `profiles`
- `organizations`
- `organization_members`

### Perfil y snapshots

- `organization_profile_versions`
- `organization_rule_snapshots`
- `organization_business_profile_versions`
- `organization_business_profile_activities`
- `organization_business_profile_traits`
- `organization_preset_applications`
- `organization_preset_ai_runs`

### Documentos y workflow

- `documents`
- `document_processing_runs`
- `document_drafts`
- `document_draft_steps`
- `document_confirmations`
- `document_revisions`
- `document_accounting_contexts`
- `document_line_items`
- `document_assignment_runs`
- `document_invoice_identities`

### Contabilidad transaccional

- `fiscal_periods`
- `source_events`
- `posting_proposals`
- `journal_types`
- `auxiliary_books`
- `chart_of_accounts`
- `accounting_rules`
- `accounting_suggestions`
- `journal_entries`
- `journal_entry_lines`
- `ledger_open_items`
- `ledger_settlement_links`

### Read models contables

- `v_journal_entries_read`
- `v_journal_lineage`
- `v_trial_balance`
- `v_open_items_outstanding`
- `v_balance_sheet`
- `v_income_statement`

Estas vistas leen el ledger posteado e inmutable y alimentan las superficies `/trial-balance`, `/journal-entries` y `/open-items`.

### Fiscal

- `vat_runs`
- `dgi_reconciliation_runs`
- `dgi_reconciliation_buckets`
- `vat_form_exports`
- `organization_import_operations`
- `organization_import_operation_documents`
- `organization_import_operation_taxes`

### Integracion y auditoria

- `exports`
- `organization_spreadsheet_import_runs`
- `organization_cfe_email_connections`
- `audit_log`
- `ai_decision_logs`

## RLS y accesos

El repo usa mezcla de:

- cliente SSR autenticado para lectura y operaciones del usuario;
- service role para acciones de dominio server-only;
- helpers SQL para membresia/roles.

Regla de uso actual:

- la UI nunca habla con llaves privilegiadas;
- los servicios server-only si usan service role cuando necesitan saltar limitaciones del cliente SSR para orchestration o persistencia interna.
- `organization_cfe_email_connections` queda acotada por organizacion y por usuario dueno de la casilla, con lectura ampliada a roles altos;
- las vistas contables usan `security_invoker = true` para no escapar del contexto del invocador.

## APIs internas relevantes

### Auth y health

- `/api/health`
- `/api/v1/auth/signup`
- `/api/v1/auth/login`

### Documentos

- `/api/v1/documents/[documentId]/processing-status`

### Preset IA

- `/api/preset-ai-recommendation`
- `/api/preset-ai-recommendation/cost-center-draft` cerrado en MVP V1 (`410`)

### Orquestacion

- `/api/inngest`

## OpenAI layer

Wrapper central:

- `lib/llm/openai-responses.ts`

Capacidades actuales:

- sync structured responses;
- background structured responses;
- batch jobs;
- file uploads;
- usage accounting y costo estimado;
- soporte para intake documental, interpretacion de planillas y recomendacion hibrida de presets.

Model config:

- `OPENAI_PRIMARY_MODEL`
- `OPENAI_MINI_MODEL`
- `OPENAI_DOCUMENT_MODEL`
- `OPENAI_RULES_MODEL`
- `OPENAI_ACCOUNTING_MODEL`

Defaults efectivos:

- `gpt-4o`
- `gpt-4o-mini`

## Background jobs

### Inngest

Se usa para el pipeline documental durable y su orquestacion en background.

### Sync server actions

Se usan para:

- onboarding;
- settings;
- conexiones CFE;
- posting;
- exportaciones;
- consultas IA de presets;
- conciliacion DGI;
- lifecycle de VAT runs;
- materializaciones de chart e imports.

## Observabilidad y auditoria

### Activos hoy

- `audit_log` para eventos funcionales;
- `ai_decision_logs` para decisiones IA/documentales;
- `document_assignment_runs`;
- `organization_preset_ai_runs`;
- cambios de conexiones CFE y settings sensibles;
- timestamps y snapshots a traves del dominio.

### Lo que aun falta

- panel unificado de observabilidad funcional;
- alertas operativas mas ricas;
- trazabilidad transversal visible al usuario final en todas las pantallas.

## Compatibilidad y deuda controlada

Existen helpers de compatibilidad de schema como:

- `schema-compat`
- `step5-schema-compat`
- `vat-run-schema-compat`
- `chart-write-compat`

Esto indica que el repo esta cuidando transiciones de base reales mientras converge hacia la arquitectura rectora.
