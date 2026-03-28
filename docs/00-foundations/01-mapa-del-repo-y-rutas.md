# Mapa real del repo y superficies activas

## Stack operativo

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres y Storage
- OpenAI Responses API para salidas estructuradas
- Inngest para orquestacion durable del pipeline documental
- Tailwind CSS 4
- ESLint 9

## Estructura principal del repo

```text
app/
components/
db/
modules/
scripts/
supabase/migrations/
tests/
docs/
```

### Dominios presentes en `modules/`

- `accounting`
- `assistant`
- `audit`
- `ai`
- `auth`
- `close`
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
- `audit`
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

- `/app/o/[slug]/dashboard`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/review`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/close`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/advanced`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/rules`

### Privadas de lectura y soporte por organizacion

- `/app/o/[slug]/documents/pending-assignment`
- `/app/o/[slug]/documents/[documentId]/original`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/tax/reconciliation`

### Privadas legacy, redirigidas o fuera del top nav

- `/app/o/[slug]/audit` visible como `Importacion masiva` dentro de `Avanzado`
- `/documents`
- `/dashboard`
- `/review`
- `/advanced`
- `/close`
- `/rules`
- `/tax`
- `/settings`
- `/trial-balance`
- `/journal-entries`
- `/open-items`

### APIs internas activas

- `/api/health` liveness/config
- `/api/ready` readiness real
- `/api/health?mode=ready` alias de readiness
- `/api/inngest`
- `/api/v1/auth/login`
- `/api/v1/auth/signup`
- `/api/v1/documents/[documentId]/processing-status`
- `/api/preset-ai-recommendation`
- `/api/preset-ai-recommendation/cost-center-draft` cerrado con `410`

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
8. el usuario entra a `/app/o/[slug]/dashboard`.

### Flujo documental

1. `documents` queda dedicado a upload y resumen del ultimo lote, mientras `audit` se presenta como `Importacion masiva`;
2. `prepare_document_upload` y `complete_document_upload` resuelven el upload privado de originales;
3. la auditoria batch genera un `document_batch_import`, corre en background y deja `preview_ready` antes de crear documentos;
4. el usuario acepta o rechaza filas individuales o el batch completo;
5. solo lo aceptado materializa `documents`, drafts y artefactos;
6. la cola principal humana vive en `/review`, y `pending-assignment` queda como soporte especializado antes del reviewer detallado;
7. el usuario revisa, clasifica, aplica reglas, conversa con el Asistente Contable opcional, reabre o confirma;
8. el posting alimenta ledger, VAT y superficies de lectura contable.

### Flujo contable y fiscal

1. el ledger posteado alimenta balance, diario y open items via read models;
2. `rules` gobierna la capa reusable de aprendizaje, prioridades, conflictos y versionado;
3. `tax` construye VAT preview, VAT runs y workbench desde documentos confirmados;
4. `tax/reconciliation` compara buckets DGI contra el sistema;
5. `close` centraliza estado del periodo, validator y transiciones formales;
6. `exports` genera artefactos contables o fiscales sobre el periodo elegido.

### Flujo de settings

1. `settings` ahora se organiza por tabs `Empresa`, `Perfil fiscal`, `Plan contable`, `Integraciones` y `Avanzado`;
2. edicion de datos base y mapa de capacidades en `Empresa`;
3. activacion de nueva version fiscal y snapshots en `Perfil fiscal`;
4. gestion del plan de cuentas en `Plan contable`;
5. configuracion de casilla CFE por usuario y organizacion en `Integraciones`;
6. acceso opcional a imports/exports y superficies expertas desde `Avanzado`;
7. la ruta legacy `settings/accounting-rules` redirige al workspace dedicado de `rules`.

## Mapa de componentes relevantes

### Onboarding y settings

- `components/organization-onboarding-form.tsx`
- `components/onboarding/business-profile-configurator.tsx`
- `components/onboarding/preset-recommendation-card.tsx`
- `components/onboarding/preset-ai-recommendation-card.tsx`
- `components/settings/business-profile-settings.tsx`
- `components/settings/settings-capabilities-list.tsx`

### Documentos y Auditoria

- `components/documents/documents-workspace-table.tsx`
- `components/documents/document-review-workspace.tsx`
- `components/documents/document-review-staged-workspace.tsx`
- `components/documents/document-accounting-assistant-rail.tsx`
- `components/documents/international-operations-workspace.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/upload-dropzone.tsx`
- `components/audit/document-audit-upload-panel.tsx`
- `components/audit/document-audit-preview-workspace.tsx`

### Contabilidad y explainability

- `components/accounting/accounting-workspace-tabs.tsx`
- `components/chart-map/chart-impact-canvas.tsx`
- `components/chart-map/chart-inspector.tsx`
- `components/chart-map/chart-tree-panel.tsx`
- `components/rules/accounting-rules-table.tsx`
- `components/rules/accounting-rule-detail-panel.tsx`
- `components/rules/accounting-rule-editor.tsx`
- `components/ui/help-hint.tsx`
- `modules/ui/help-hints-registry.ts`

### Tax y soporte

- `components/tax/vat-run-preview-card.tsx`

### Cierre y trazabilidad

- `app/app/o/[slug]/close/page.tsx`
- `app/app/o/[slug]/close/actions.ts`
- `modules/close/service.ts`
- `modules/accounting/fiscal-period-status.ts`
- `modules/assistant/runs.ts`
- `modules/assistant/document-assistant.ts`
- `modules/accounting/rules-admin.ts`

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
- `20260320_close001_*`: estados robustos de periodo, close validator, cockpit base y trazabilidad IA transversal.
- `20260322_doc017_*`: threads y mensajes persistidos del Asistente Contable.
- `20260322_tax018_*`: workbench fiscal por periodo y resoluciones manuales.
- `20260324_rule001_*`: fundaciones del admin de reglas y eventos de lifecycle.
- `20260324_rule002_*`: simulaciones y chat consultivo del admin de reglas.

## Pruebas presentes

El repo tiene `64` pruebas `*.test.cjs` repartidas por dominio:

- auth y organizations
- document upload e ingestion
- document assistant, audit preview y pending-assignment
- accounting kernel, read models, suggestions, chart map y exports
- accounting rules admin, close service y period guardrails
- activity search y preset recommendations
- preset AI recommendation
- tax, DGI reconciliation, VAT preview y workbench
- cfe email settings, help hints y decision log
- workflow state
- spreadsheets e imports

## Regla de lectura del resto de esta documentacion

El resto de los archivos ya no describe fases viejas por numero de spec. Cada documento responde a un modulo o tema vivo del producto y diferencia siempre:

- implementado hoy;
- parcial/en consolidacion;
- preparado para futuro.
