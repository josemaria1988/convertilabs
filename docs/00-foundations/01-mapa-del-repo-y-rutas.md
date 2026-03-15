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
- `imports`
- `ingestion`
- `organizations`
- `presentation`
- `spreadsheets`
- `tax`
- `ui`

### Dominios presentes en `components/`

- `dashboard`
- `documents`
- `onboarding`
- `settings`
- `tax`
- `ui`

## Superficies de aplicacion

### Publicas

- `/(marketing)`
- `/login`
- `/logout`
- `/auth/confirm`
- `/onboarding`

### Privadas por organizacion

- `/app/o/[slug]/dashboard`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/tax/reconciliation`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`

### APIs internas activas

- `/api/health`
- `/api/inngest`
- `/api/v1/auth/login`
- `/api/v1/auth/signup`
- `/api/v1/documents/[documentId]/processing-status`
- `/api/preset-ai-recommendation`
- `/api/preset-ai-recommendation/cost-center-draft`

## Flujos reales hoy

### Flujo de alta

1. signup/login;
2. si el usuario no tiene membresia, redireccion a `/onboarding`;
3. se crea la organizacion con owner;
4. se crea el business profile versionado;
5. se aplica preset recomendado, alternativo o modo minimo;
6. opcionalmente se consulta IA para la recomendacion hibrida;
7. el usuario entra al espacio privado.

### Flujo documental

1. upload a storage privado;
2. `prepare_document_upload` y `complete_document_upload`;
3. Inngest dispara procesamiento;
4. OpenAI devuelve estructura documental;
5. se persiste draft, steps y artefactos;
6. el usuario revisa, clasifica, aprende y postea;
7. VAT preview / VAT run / export quedan como carriles separados.

### Flujo de settings

1. edicion de datos base;
2. activacion de nueva version fiscal;
3. actualizacion de perfil de negocio;
4. gestion del plan de cuentas;
5. importacion de planillas y exportaciones.

## Mapa de componentes relevantes

### Onboarding y settings

- `components/organization-onboarding-form.tsx`
- `components/onboarding/business-profile-configurator.tsx`
- `components/onboarding/preset-recommendation-card.tsx`
- `components/onboarding/preset-ai-recommendation-card.tsx`
- `components/settings/business-profile-settings.tsx`

### Documentos

- `components/documents/document-review-workspace.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/upload-dropzone.tsx`

### Tax

- `components/tax/vat-run-preview-card.tsx`

### Explainability

- `components/ui/help-hint.tsx`
- `modules/ui/help-hints-registry.ts`

## Mapa de migraciones por fase

- `20260311_*`: auth, dashboard privado, upload y esquema canonico base.
- `20260312_*`: perfiles versionados, pipeline IA y alineacion VAT UY.
- `20260313_*`: dedupe de facturas, memoria contable, VAT y exports.
- `20260314_*`: fundaciones step4/step5, open items, spreadsheet imports, import operations, reconciliacion DGI.
- `20260315_doc013_*`: onboarding con business profile y preset applications.
- `20260315_doc014_*`: separacion de workflow, `admin_processing` y `document_assignment_runs`.
- `20260315_doc015_*`: recomendacion hibrida de presets con IA y auditoria.

## Pruebas presentes

El repo tiene suite por dominio:

- auth y organizations
- document upload e ingestion
- accounting bootstrap, suggestions, rule logic y exports
- activity search y preset recommendations
- preset AI recommendation
- tax, DGI reconciliation y VAT preview
- workflow state
- spreadsheets e imports

## Regla de lectura del resto de esta documentacion

El resto de los archivos ya no describe fases viejas por numero de spec. Cada documento responde a un modulo o tema vivo del producto y diferencia siempre:

- implementado hoy;
- parcial/en consolidacion;
- preparado para futuro.
