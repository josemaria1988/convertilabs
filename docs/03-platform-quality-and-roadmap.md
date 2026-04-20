# 03 - Platform, quality and roadmap

## Para que existe este documento

Este es el resumen rapido de la infraestructura real del repo, las APIs, el modelo de observabilidad, la estrategia de verificacion y los gaps mas importantes del MVP.

Leelo si vas a tocar:

- schema;
- migraciones;
- RLS;
- APIs;
- background jobs;
- health y readiness;
- tests;
- rollout;
- hardening del piloto.

## 1. Stack y estructura del repo

### Stack operativo

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth + Postgres + Storage
- OpenAI Responses API
- Inngest
- Tailwind CSS 4
- ESLint 9

### Estructura principal

```text
app/
components/
db/
docs/
lib/
modules/
supabase/migrations/
tests/
scripts/
```

### Dominios visibles en el repo

- auth
- organizations
- documents
- accounting
- tax
- close
- assistant
- audit
- imports
- exports
- spreadsheets
- ui / presentation

## 2. Capas de schema y persistencia

El esquema vive en dos niveles:

1. `db/schema/00..09_*` como referencia canonica consolidada;
2. `supabase/migrations/` como historial aplicable real.

Regla practica:

Si tocas persistencia, no alcanza con editar un archivo aislado. Debes revisar:

- schema canonico;
- migracion;
- RLS;
- compatibilidad;
- tests o smoke.

## 3. Grupos de tablas que importan

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
- `organization_cost_centers`
- `document_processing_runs`
- `document_drafts`
- `document_draft_steps`
- `document_confirmations`
- `document_revisions`
- `document_accounting_contexts`
- `document_line_items`
- `document_assignment_runs`
- `document_invoice_identities`

Notas operativas relevantes:

- `documents.file_hash` participa en el guard de duplicado exacto para archivos binarios;
- `documents.cost_center_id` deja asociar un documento a un proyecto o centro de costo minimo y hoy ya queda visible/editable tambien desde desktop;
- `organization_cost_centers` concentra la taxonomia operativa minima reutilizada por mobile y administrada desde desktop, siempre gobernada por membership + RLS;
- `document_invoice_identities` conserva la identidad documental normalizada y el estado de duplicado;
- una corrida puede terminar en `skipped` cuando el documento se rechaza por duplicado exacto;
- el motivo funcional debe quedar trazado en metadata y surfaces derivadas.

### Kernel contable

- `fiscal_periods`
- `fiscal_period_transition_logs`
- `close_check_runs`
- `close_check_results`
- `source_events`
- `posting_proposals`
- `chart_of_accounts`
- `accounting_rules`
- `accounting_rule_events`
- `accounting_rule_simulations`
- `journal_entries`
- `journal_entry_lines`
- `ledger_open_items`
- `ledger_settlement_links`

### Read models

- `v_trial_balance`
- `v_journal_entries_read`
- `v_open_items_outstanding`
- `v_balance_sheet`
- `v_income_statement`

### Fiscal

- `vat_runs`
- `dgi_reconciliation_runs`
- `dgi_reconciliation_buckets`
- `vat_form_exports`
- `organization_import_operations`
- `organization_import_operation_documents`
- `organization_import_operation_taxes`

### Integracion y observabilidad

- `exports`
- `organization_spreadsheet_import_runs`
- `organization_cfe_email_connections`
- `system_actors`
- `assistant_runs`
- `assistant_threads`
- `assistant_messages`
- `assistant_run_evidence_refs`
- `assistant_suggestions`
- `audit_log`
- `ai_decision_logs`

## 4. RLS y modelo de ejecucion

Regla de arquitectura actual:

- la UI no usa llaves privilegiadas;
- el cliente SSR autenticado hace lo que puede con permisos normales;
- servicios server-only pueden usar service role cuando la operacion lo requiere;
- RLS sigue siendo parte de la seguridad del producto, no un detalle secundario.

Implicancia:

No resolver atajos de permisos moviendo logica delicada al cliente.

## 5. APIs internas relevantes

### Salud y readiness

- `GET /api/health`
- `GET /api/ready`
- `GET /api/health?mode=ready`

Semantica:

- `health` = liveness/config barato;
- `ready` = readiness real contra dependencias minimas.

### Auth

- `/api/v1/auth/signup`
- `/api/v1/auth/login`

### Documentos

- `/api/v1/documents/[documentId]/processing-status`

### Superficie mobile y distribucion

- `app/manifest.ts` expone el web manifest del carril field;
- `public/sw.js` aplica caching conservador solo sobre shell estatico y offline page;
- `/.well-known/assetlinks.json` se sirve desde App Router para la TWA Android;
- `/android-twa` contiene la configuracion Bubblewrap reproducible y scripts de build.

### Presets IA

- `/api/preset-ai-recommendation`
- `/api/preset-ai-recommendation/cost-center-draft` cerrado en MVP V1 con `410`

### Orquestacion

- `/api/inngest`

## 6. OpenAI layer y jobs

### Wrapper central

- `lib/llm/openai-responses.ts`

### Lo que hace hoy

- sync structured responses;
- background structured responses;
- batch jobs;
- file uploads;
- usage accounting;
- costo estimado.

### Config relevante

- `OPENAI_PRIMARY_MODEL`
- `OPENAI_MINI_MODEL`
- `OPENAI_DOCUMENT_MODEL`
- `OPENAI_RULES_MODEL`
- `OPENAI_ACCOUNTING_MODEL`

### Jobs

- Inngest para procesos durables;
- server actions para onboarding, settings, posting, reglas, imports, exports, VAT, assistant y audit.

## 7. Observabilidad funcional minima

La trazabilidad actual no es solo tecnica. Tambien es funcional.

Debe existir evidencia suficiente en:

- decisiones IA;
- runs documentales;
- reglas y simulaciones;
- close checks;
- transiciones de periodo;
- corridas de importacion y auditoria;
- cambios sensibles de settings y conexiones.

Tablas a no olvidar:

- `audit_log`
- `ai_decision_logs`
- `assistant_*`
- `accounting_rule_*`
- `document_assignment_runs`
- `organization_spreadsheet_import_runs`
- `close_check_*`
- `fiscal_period_transition_logs`

Para duplicados exactos, la evidencia minima esperada incluye:

- documento relacionado cuando exista;
- motivo (`file_hash_match`, identidad de negocio o combinacion de ambos);
- estado derivado visible en UI como rechazo o bloqueo, no como pendiente silencioso.

## 8. Testing y comandos de calidad

### Comandos base

- `npm run dev`
- `npm run inngest:dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

### DB / smoke

- `npm run db:generate:migration`
- `npm run db:verify:parity`
- `npm run db:smoke:profile-sync`
- `npm run db:smoke:organization-onboarding`
- `npm run db:smoke:private-dashboard`
- `npm run db:smoke:document-upload`

### Piloto

- `npm run pilot:summary -- docs/samples/rontil-pilot-demo-ready.json`
- `npm run pilot:summary -- docs/samples/rontil-pilot-demo-blocked.json`

### Regla de evidencia

Una feature solo deberia documentarse como implementada si hay al menos:

1. codigo de dominio;
2. persistencia o contrato real;
3. UI visible o prueba que la vuelva operativa.

## 9. Watchlist actual del MVP

### A. Integridad monetaria

Riesgo:

- divergencia entre journal y open items;
- settlement entre monedas equivocadas;
- FX inventado.

Direccion correcta:

- misma moneda o snapshot confiable;
- si no, asistido o bloqueado.

### B. Estados canonicos del documento

Riesgo:

- que la UI vuelva a colgarse de estados legacy o flags sueltos.

Direccion correcta:

- estado canonico derivado;
- copy consistente;
- buckets accionables.

Aplicacion concreta:

- `duplicate` no debe verse como `processing` ni como `pendiente`;
- un rechazo por duplicado exacto debe quedar claramente fuera del flujo normal de review.
- la ruta guiada del reviewer debe consumir `workflow-state` y `document-decision-snapshot` a traves de un presenter canonico;
- no derivar estados de review desde flags de UI como `showManualFlow`, `mobileStep` o affordances locales.

### C. Dashboard y metricas

Riesgo:

- inventar charts o labels sinteticos.

Direccion correcta:

- empty state honesto;
- nada de relleno visual sin historia real.

### D. Alcance de automatizacion

Riesgo:

- vender como automatico lo que todavia es asistido o bloqueado.

Direccion correcta:

- perimetro explicito;
- degradacion conservadora;
- no sobre-prometer.

### E. Imports ambiguos

Riesgo:

- materializar o finalizar casos ambiguos como si fueran seguros.

Direccion correcta:

- preview;
- warnings;
- aceptacion explicita;
- posible bloqueo.

### F. Naming de DGI

Riesgo:

- hacer parecer la conciliacion base como filing o matching exhaustivo.

Direccion correcta:

- llamarla por lo que es.

### G. Health vs readiness

Riesgo:

- creer que el sistema esta sano porque hay un endpoint barato.

Direccion correcta:

- separar liveness de readiness.

## 10. Roadmap condensado

### Zeta contable inmediato

El siguiente PR operativo para Zeta esta documentado en `docs/pr-next-zeta-posting-templates-role-map.md`.

Objetivo:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> role map
-> cuenta Zeta imputable
-> preview multi-linea
```

Orden recomendado despues del espejo de Plan de Cuentas, Conceptos y Tipos de Asiento:

1. Plantillas base por familia operativa + Role Map Zeta.
2. Tasas de IVA Zeta deterministicas, si faltan.
3. Rule runner Zeta-aware.
4. Preview multi-linea consolidado.
5. Export a Bandeja.
6. Reconciliacion.
7. Aprendizaje contable reusable.

No adelantar exportacion a Zeta mientras falten roles criticos, preview balanceado o evidencia de cuentas imputables.

### Ya fuerte

- onboarding y presets;
- documentos, review y posting;
- VAT y cierre base;
- audit, import y export;
- reglas contables administrables.

### Parcial

- FX end-to-end;
- explainability uniforme;
- adapters ERP especificos;
- bulk ops mas maduras;
- close snapshots y hard close real.

### Preparado

- cost centers, jobs y rentabilidad;
- mas impuestos;
- mas integraciones externas;
- multi-country.

## 11. Regla de cambios seguros

Cuando hagas un cambio importante:

1. identifica el dominio principal;
2. identifica si toca UI, dominio, schema o workflow;
3. busca el estado canonico ya existente antes de inventar otro;
4. manten la solucion conservadora;
5. actualiza docs si cambio la verdad oficial o si cambio el estado de implementacion.

Si la UI necesita narrar un workflow complejo:

- extrae esa narrativa a `modules/presentation`;
- deja al componente consumir un presenter estable;
- no recompongas la verdad productiva mezclando flags visuales con estado de dominio.

## 12. Checklist mental rapido

Si estas tocando plataforma u ops, verifica que tu cambio:

- no rompa RLS ni tenancy;
- no deje APIs mintiendo sobre readiness;
- no meta logica de negocio en UI;
- preserve auditabilidad;
- tenga verificacion proporcionada;
- mantenga el producto listo para beta privada seria, no para demo vacia.
