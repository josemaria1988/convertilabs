# Estado actual del proyecto, kernel contable y motor fiscal

Fecha de corte: `2026-03-28`
Branch analizada: `testing`
Base factual: rutas activas, `modules/`, migraciones hasta `20260324_rule002_*` y `64` archivos `*.test.cjs`.

## 1. Resumen ejecutivo

Convertilabs ya no es un prototipo de OCR con sugerencias. En el estado actual real del repo ya existe una plataforma privada y operable para Uruguay con:

- onboarding multi-tenant y bootstrap contable/fiscal por organizacion;
- intake documental binario con storage privado y pipeline durable por Inngest;
- intake masivo auditado por planilla con preview antes de materializar documentos;
- workflow documental con clasificacion, aprendizaje, posting provisional/final y reapertura controlada;
- admin de reglas contables con lifecycle, simulaciones, conflictos y chat consultivo;
- ledger posteado e inmutable con diario, balance y open items;
- VAT preview, VAT runs, workbench fiscal y conciliacion DGI base;
- cockpit de cierre con validator deterministico y locks efectivos sobre el workflow;
- bridge de import/export para convivir con ERP externo sin forzar migracion total.

La base ya sirve para una beta privada cobrable y conservadora en Uruguay. Lo que todavia no existe es un cierre anual integral con ajustes manuales maduros, reporting formal completo y modulos auxiliares no documentales.

## 2. Superficies operativas visibles hoy

### Top nav privado por organizacion

- `Documentos`: bandeja operativa, upload, filtros, cola `pending-assignment`, rail del Asistente Contable y tab de operaciones internacionales.
- `Auditoria`: planillas mensuales auditadas con preview estructurado, aceptar/rechazar parcial y historico por corrida.
- `Cierre`: estado formal del periodo, metricas del corte, validator y transiciones auditadas.
- `Contabilidad`: balance de comprobacion como puerta al diario y open items.
- `Impuestos`: VAT preview, corridas oficiales y workbench por periodo.
- `Mapa contable`: arbol, impacto, documento real e inspector lateral.
- `Reglas contables`: listado, detalle, versionado, conflictos, timeline y chat consultivo.
- `Configuracion`: datos base, perfil fiscal versionado, business profile, chart y conexiones CFE.

### Superficies privadas de soporte

- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/tax/reconciliation`
- `/app/o/[slug]/documents/[documentId]/original`

### Rutas cortas que resuelven organizacion primaria

- `/documents`
- `/rules`
- `/tax`
- `/settings`
- `/trial-balance`
- `/journal-entries`
- `/open-items`

## 3. Capas que ya estan consolidadas

### Identidad, tenancy y onboarding

El stack de acceso ya funciona con Supabase SSR, `profiles`, `organizations`, `organization_members` y guards server-side. El onboarding crea organizacion, membership owner, business profile versionado, preset inicial y snapshot operativo hacia adelante.

### Setup contable y fiscal por organizacion

La organizacion no arranca vacia. Ya existe:

- business profile por actividad y traits;
- perfil fiscal versionado;
- recomendacion de presets por reglas o IA;
- gestion de chart con cuentas provisionales, `external_code` y roles sistemicos;
- snapshot de reglas y perfil para no reescribir historia.

### Documentos y auditoria

Hoy hay dos carriles de entrada claramente separados:

- `Documentos` para upload privado de PDF/JPG/PNG con pipeline IA y revision posterior;
- `Auditoria` para planillas mensuales que primero quedan en staging auditable y despues materializan solo lo aceptado.

Ademas, el workspace ya expone cola `pending-assignment`, vista del original, warnings operativos y rail del Asistente Contable con threads, mensajes y sugerencias resolubles.

### Reglas, aprendizaje y decision contable

El motor contable ya favorece reglas auditables sobre IA libre. La precedencia activa es:

1. `manual_override`
2. `document_override`
3. `vendor_concept_operation_category`
4. `vendor_concept`
5. `concept_global`
6. `vendor_default`
7. `assistant`
8. `manual_review`

Lo nuevo del estado actual es que esas reglas ya no viven escondidas: existe una superficie dedicada en `/app/o/[slug]/rules` para listarlas, pausarlas, versionarlas, simular impacto y revisar conflictos o documentos afectados.

### Ledger, read models y bridge

El posting ya persiste artefactos formales (`source_events`, `posting_proposals`, `journal_entries`, `journal_entry_lines`, `ledger_open_items`, `ledger_settlement_links`) y alimenta vistas de lectura para:

- `/trial-balance`
- `/journal-entries`
- `/open-items`
- `/exports`

Esto confirma que el repo ya opera como mini-core contable document-driven y no solo como reviewer documental.

### Fiscal, IVA y cierre

El carril fiscal activo real sigue siendo IVA Uruguay, pero esta mas maduro que en los cortes anteriores:

- preview y corrida oficial por periodo;
- workbench para revisar universo, bloqueos y resoluciones manuales;
- conciliacion DGI base por buckets;
- export fiscal;
- estados robustos de periodo en `fiscal_periods`;
- cockpit de cierre con validator y locks efectivos sobre documentos y posting.

## 4. Infraestructura y observabilidad activas

La capa de plataforma ya sostiene:

- `GET /api/health` como liveness/config barato;
- `GET /api/ready` y `GET /api/health?mode=ready` como readiness real;
- wrapper estructurado de OpenAI en `lib/llm/openai-responses.ts`;
- pipeline durable de Inngest para procesamiento documental y batches por planilla;
- `audit_log`, `ai_decision_logs`, `assistant_runs`, `assistant_threads`, `assistant_messages`;
- `accounting_rule_events`, `accounting_rule_simulations`, `accounting_rule_ai_threads`, `accounting_rule_ai_messages`;
- `close_check_runs` y `fiscal_period_transition_logs`.

La observabilidad ya no es solo tecnica. Tambien existe traza funcional por documento, regla, periodo y corrida de importacion.

## 5. Alcance real hoy

### Dentro del perimetro operativo

- Uruguay only.
- Foco operativo en documentos, decision contable, IVA y bridge externo.
- Modo automatico conservador para `UY + SA|SRL|SAS + IRAE_GENERAL + IVA GENERAL + flujo local estandar`.
- Modo asistido para importaciones, perfiles fuera de perimetro y casos que requieren contexto humano.

### Fuera del perimetro automatico o todavia incompleto

- settlement cross-currency;
- cierres anuales y `hard_closed` real;
- `close_snapshots`;
- asientos manuales de cierre maduros;
- reporting formal completo de estados contables;
- payroll, BPS, bancos, activo fijo, inventario y multi-country.

## 6. Gaps importantes que siguen abiertos

- no hay workspace maduro de manual entries y ajustes de cierre;
- `hard_closed` y `audit_frozen` existen en el modelo pero no como operativa cerrada end-to-end;
- no existe experiencia completa de invitaciones/claim de organizaciones ni gestion rica de miembros;
- explainability todavia no es uniforme en todas las vistas privadas;
- cost centers, jobs y rentabilidad siguen documentados como futuro, no como modulo productivo real.

## 7. Lectura recomendada desde este punto

- `00-foundations/01-mapa-del-repo-y-rutas.md` para rutas, modulos y migraciones.
- `02-organization/business-profile-onboarding-and-settings.md` para setup y versionado por organizacion.
- `04-documents/01-document-intake-and-processing.md` y `04-documents/02-document-review-classification-and-posting.md` para el carril documental.
- `03-accounting/accounting-rules-admin-and-learning.md` para la superficie nueva de reglas.
- `03-accounting/close-cockpit-and-period-controls.md` y `05-tax/tax-platform-vat-fx-and-imports.md` para cierre e IVA.
- `07-platform/database-api-background-jobs-and-observability.md` para schema, APIs, jobs y observabilidad.
