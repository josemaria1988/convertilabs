# Mapa real del repo y superficies activas

## Stack operativo

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres y Storage
- OpenAI Responses API para salidas estructuradas
- Inngest para orquestacion durable del pipeline documental

## Estructura principal del repo

```text
app/
components/
modules/
supabase/migrations/
tests/
docs/
```

### Dominios presentes en `modules/`

- `accounting`
- `ai`
- `auth`
- `documents`
- `evals`
- `explanations`
- `exports`
- `integrations`
- `imports`
- `ingestion`
- `organizations`
- `presentation`
- `spreadsheets`
- `tax`
- `ui`

### Dominios presentes en `components/`

- `accounting`
- `auth`
- `chart-map`
- `dashboard`
- `documents`
- `marketing`
- `onboarding`
- `settings`
- `tax`
- `ui`

## Superficies de aplicacion

### Publicas core

- `/(marketing)`
- `/login`
- `/signup`
- `/logout`
- `/auth/confirm`
- `/onboarding`

### Publicas congeladas o redirigidas

- `/about`
- `/pricing`
- `/product`
- `/api`

### Privadas core por organizacion

- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/chart-map`

### Privadas de lectura y soporte por organizacion

- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/tax/reconciliation`

### Privadas legacy, redirigidas o fuera del top nav

- `/app/o/[slug]/dashboard`
- `/documents`
- `/tax`
- `/settings`
- `/trial-balance`
- `/journal-entries`
- `/open-items`

### APIs internas activas

- `/api/health`
- `/api/inngest`
- `/api/v1/auth/login`
- `/api/v1/auth/signup`
- `/api/v1/documents/[documentId]/processing-status`
- `/api/preset-ai-recommendation`

### APIs internas congeladas o cerradas

- `/api/preset-ai-recommendation/cost-center-draft`

## Flujos reales hoy

### Flujo de alta

1. signup/login;
2. si el usuario no tiene membresia, redireccion a `/onboarding`;
3. se crea la organizacion con owner;
4. se crea el business profile versionado con actividad principal, secundarias y traits;
5. se aplica preset recomendado, alternativo o modo minimo;
6. opcionalmente se consulta IA para la recomendacion hibrida;
7. se activa el perfil fiscal y el snapshot de reglas;
8. el usuario entra a `/app/o/[slug]/documents`.

### Flujo documental

1. upload a storage privado o importacion batch desde planilla;
2. `prepare_document_upload` y `complete_document_upload`;
3. Inngest dispara procesamiento estructurado;
4. OpenAI devuelve estructura documental;
5. se persiste draft, steps y artefactos;
6. el usuario revisa, clasifica, aplica reglas, reabre o confirma;
7. el posting alimenta ledger, VAT y superficies de lectura contable.

### Flujo contable y fiscal

1. el ledger posteado alimenta balance, diario y open items via read models;
2. `tax` construye VAT preview y VAT runs desde documentos confirmados;
3. `tax/reconciliation` compara buckets DGI contra el sistema;
4. `exports` genera artefactos contables o fiscales sobre el periodo elegido.

### Flujo de settings

1. edicion de datos base;
2. activacion de nueva version fiscal;
3. actualizacion de perfil de negocio;
4. gestion del plan de cuentas;
5. configuracion de casilla CFE por usuario y organizacion;
6. acceso opcional a imports/exports como carriles de soporte.

## Mapa de componentes relevantes

### Onboarding y settings

- `components/organization-onboarding-form.tsx`
- `components/onboarding/business-profile-configurator.tsx`
- `components/onboarding/preset-recommendation-card.tsx`
- `components/onboarding/preset-ai-recommendation-card.tsx`
- `components/settings/business-profile-settings.tsx`
- `components/settings/settings-capabilities-list.tsx`

### Documentos

- `components/documents/documents-workspace-table.tsx`
- `components/documents/document-review-workspace.tsx`
- `components/documents/international-operations-workspace.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/upload-dropzone.tsx`

### Contabilidad y explainability

- `components/accounting/accounting-workspace-tabs.tsx`
- `components/chart-map/chart-impact-canvas.tsx`
- `components/chart-map/chart-inspector.tsx`
- `components/chart-map/chart-tree-panel.tsx`
- `components/ui/help-hint.tsx`
- `modules/ui/help-hints-registry.ts`

### Tax y soporte

- `components/tax/vat-run-preview-card.tsx`

## Mapa de migraciones por fase

- `20260311_*`: auth, dashboard privado, upload y esquema canonico base.
- `20260312_*`: perfiles versionados, pipeline IA y alineacion VAT UY.
- `20260313_*`: dedupe de facturas, memoria contable, VAT y exports.
- `20260314_*`: fundaciones step4/step5, open items, spreadsheet imports, import operations, reconciliacion DGI.
- `20260315_doc013_*`: onboarding con business profile y preset applications.
- `20260315_doc014_*`: separacion de workflow, `admin_processing` y `document_assignment_runs`.
- `20260315_doc015_*`: recomendacion hibrida de presets con IA y auditoria.
- `20260315_doc016_*`: versionado del catalogo de business profile.
- `20260317_doc012_*`: fundaciones del kernel contable.
- `20260317_int002_*`: conexiones de email CFE por organizacion/usuario.
- `20260318_doc013_*`: read models contables para balance, diario y open items.

## Pruebas presentes

El repo tiene suite por dominio:

- auth y organizations
- document upload e ingestion
- accounting kernel, read models, suggestions, chart map y exports
- activity search y preset recommendations
- preset AI recommendation
- tax, DGI reconciliation y VAT preview
- cfe email settings, help hints y decision log
- workflow state
- spreadsheets e imports

## Regla de lectura del resto de esta documentacion

El resto de los archivos ya no describe fases viejas por numero de spec. Cada documento responde a un modulo o tema vivo del producto y diferencia siempre:

- implementado hoy;
- parcial/en consolidacion;
- preparado para futuro.
