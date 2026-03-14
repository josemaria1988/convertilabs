# Convertilabs — specs-driven-development-steps4

**Status:** Draft v0.2  
**Fecha:** 2026-03-14  
**Modo:** Specs-Driven Development  
**Base:** `docs/specs3/convertilabs_mvp_spec_sdd.md` + `docs/specs3/uruguay_mvp_phase1_scope.md`  
**Objetivo de este delta:** cerrar el MVP V1 para que pueda usarse con datos reales de Rontil y, al mismo tiempo, dejar plantadas las piezas correctas para la adopción masiva por parte de contadores uruguayos.

---

## 1. Qué cambia en este STEP4

Este documento deja de pensar el sistema como “extracción de facturas + alguna magia de IA” y lo redefine como una **herramienta contable-fiscal asistida por IA, auditada, determinística donde importa, y útil para trabajo real**.

Pasan a ser parte del plan obligatorio:

1. **Ventas resueltas en forma determinística por identidad de la organización.**
   - Si el emisor coincide con la organización logueada por RUT normalizado o por alias fuertes de nombre, el documento pertenece a la familia venta.
   - La IA no decide eso primero; primero decide la identidad de la organización.

2. **Debe / Haber + cuentas a cobrar / pagar + saldos abiertos entran en MVP1.**
   - No quedan como idea futura.
   - El sistema debe poder generar asientos balanceados y open items básicos.

3. **Importaciones fase 1 acotada entran al MVP1.**
   - Debe existir la entidad `operación de importación`.
   - Deben poder agruparse DUA y documentos relacionados.
   - Se debe incluir en la liquidación de IVA al menos:
     - IVA importación,
     - anticipo IVA,
     - y persistencia de otros tributos para auditoría.

4. **Import desde planillas entra como acelerador de adopción.**
   - El contador podrá subir planillas históricas.
   - La IA deberá interpretar la intención de la planilla y devolver JSON canónico persistible.
   - Debe soportar, como mínimo:
     - liquidaciones históricas de IVA,
     - estructuras de asientos,
     - plan de cuentas, si existe en la planilla.

5. **OpenAI queda conectado en modo productivo con `gpt-4o`.**
   - Intake documental.
   - Segunda IA contable.
   - Import de planillas.
   - Intake/agregación de importaciones.
   - Uso de Background mode y Batch API donde convenga.

6. **La fricción de entrada se reduce de verdad.**
   - Upload unitario y múltiple.
   - Import de históricos.
   - Aprendizaje explícito de reglas y conceptos.
   - Vista clara de por qué el sistema sugirió lo que sugirió.

7. **La confianza se vuelve parte explícita del producto.**
   - Audit log de decisiones.
   - Semáforo de certeza.
   - Human-in-the-loop proactivo.
   - Evidencia y motivo de cada clasificación.

8. **La salida para el contador debe hablar su idioma.**
   - Export a Excel/XML compatible y luego `.xlsx` si se decide.
   - Totales mapeados a líneas/códigos del formulario DGI configurable.
   - Export adapters pensados para software contable usado en Uruguay.

---

## 2. El principio rector: esto ya no es un MVP de juguete

Este STEP4 parte de una realidad simple: si Convertilabs quiere venderse “como pan caliente” en Uruguay, no alcanza con que la IA “saque datos”. Tiene que construir **confianza operativa**.

La barrera de compra no es técnica. La barrera de compra es esta:

> “¿Puedo dejar que esta cosa me ayude de verdad sin miedo a que me invente un IVA, me cambie una compra por venta, o me rompa una importación?”

Por eso, el producto debe cumplir con cuatro pilares:

1. **Determinismo cuando el dato lo permite.**  
   Ejemplo clásico: si el emisor es la organización logueada, eso es venta. Punto. Nada de poesía probabilística.

2. **IA estructurada cuando el dato no alcanza.**  
   La IA sirve para intake multimodal, interpretación de planillas, clasificación de conceptos y consolidación de documentos complejos.

3. **Revisión humana dirigida y no burocrática.**  
   No revisar todo. Revisar solo donde hay duda real o un caso fuera de alcance.

4. **Trazabilidad total.**  
   Cada sugerencia debe poder explicar:
   - qué regla o evidencia disparó la propuesta,
   - con qué confianza,
   - con qué versión de prompt/schema/modelo,
   - y qué hizo el humano después.

---

## 3. Alcance del MVP V1 después de este delta

### 3.1 Incluido

- Upload unitario y múltiple de PDF/JPG/PNG.
- Intake IA multimodal sobre documentos.
- Detección compra / venta / nota de crédito / recibo / comprobante de pago.
- Dedupe por archivo e identidad de negocio.
- Memoria contable por proveedor, concepto y organización.
- Segunda IA contable con texto libre del usuario.
- Asiento sugerido balanceado.
- Cuentas a cobrar / pagar y saldos abiertos.
- IVA Uruguay sobre:
  - compras locales estándar,
  - ventas locales estándar,
  - importaciones fase 1 estándar.
- Import desde planillas:
  - liquidaciones históricas de IVA,
  - estructuras de asientos,
  - plan de cuentas.
- Export canónico para contador:
  - resumen ejecutivo,
  - libro compras,
  - libro ventas,
  - asientos,
  - trazabilidad,
  - resumen por líneas DGI configurables.

### 3.2 Fuera de alcance del MVP V1, pero con hooks dejados prontos

- Filing directo con DGI.
- Emisión CFE desde el sistema.
- Integración directa con software de terceros en todos los formatos.
- Conciliación bancaria automática.
- Diferencias de cambio completas y ajuste por cotización.
- Importaciones complejas:
  - suspenso,
  - exoneraciones especiales,
  - zona franca,
  - parcializaciones complejas,
  - reliquidaciones avanzadas.
- Inbox CFE automático y casilla dedicada full hands-free.
- Forecast fiscal avanzado y dashboard financiero predictivo.

### 3.3 No se va a bloquear el MVP por lo que no entra

Se dejarán:
- tablas preparadas,
- flags de configuración,
- hooks de servicios,
- y contratos canónicos,

para que la expansión posterior no requiera reescribir el corazón del sistema.

---

## 4. Estado de partida del repo y lectura operativa

### 4.1 Ya existe y es aprovechable

- SaaS multi-tenant con onboarding, auth y rutas privadas.
- Upload privado de documentos y pipeline async.
- Wrapper server-side de OpenAI Responses API.
- Contrato estructurado de intake documental con `facts`, `amount_breakdown` y `line_items`.
- Segunda IA contable ya encaminada.
- Dedupe / memoria contable / vendors / conceptos ya bastante avanzados.
- Módulo fiscal UY y exportación tipo Excel XML.

### 4.2 Hay que endurecer sí o sí

1. El upload sigue siendo unitario.
2. La metadata inicial del upload todavía arranca con `p_direction = "purchase"` o equivalente placeholder.
3. El scope anterior dejaba importaciones complejas fuera de alcance de forma demasiado grosera para Rontil.
4. La integración OpenAI debe quedar unificada y auditada para producción.
5. No existe todavía el import desde planillas.
6. La resolución determinística compra/venta por identidad de organización debe centralizarse.
7. Debe/Haber, cuentas a cobrar/pagar y saldos deben formalizarse.
8. La capa de confianza todavía debe volverse visible como feature y como dato persistido.
9. La exportación para contador debe incorporar mapeo configurable a líneas/códigos de formulario DGI.

---

## 5. Reglas de producto no negociables

1. **La IA no crea verdad contable irreversible.** Sugiere, clasifica, explica, alerta y bloquea cuando corresponde.
2. **No se pide contexto al usuario porque sí.** Solo cuando no existe una regla determinística suficientemente confiable.
3. **Ventas = emisor coincide con la organización.**
4. **Compras = receptor coincide con la organización y emisor no coincide.**
5. **Si ambos coinciden o ninguno coincide con suficiente confianza, se bloquea a revisión.**
6. **Las reglas se aprenden solo por aceptación explícita.**
7. **Toda salida AI crítica debe ser JSON estricto, versionado y auditable.**
8. **Toda importación desde planilla debe tener preview y warnings antes de persistir.**
9. **Toda importación fase 1 debe priorizar el carril estándar y bloquear lo especial.**
10. **No se hardcodean cuentas finales como solución estructural.** Se permite fallback transitorio, pero el destino del sistema es mapping por plan de cuentas + perfil fiscal + reglas.
11. **Todo flujo crítico debe dejar evidencia de por qué pasó lo que pasó.**
12. **La UI debe mostrar dónde dudó el sistema.** No se esconde la incertidumbre.

---

## 6. Reglas técnicas adicionales para que esto quede “como guante de seda”

### 6.1 Identidad fiscal de organización

Debe existir una capa única y reutilizable de identidad de organización con:

- `organization.tax_id` normalizado,
- variantes con y sin guiones,
- razón social legal,
- nombre de fantasía,
- aliases administrativos aceptados,
- normalización sin mayúsculas/minúsculas,
- limpieza de puntuación,
- matching fuerte por tokens.

**No** se debe dispersar esta lógica por componentes, prompts y handlers. Debe vivir en un módulo único.

### 6.2 Moneda y tipo de cambio

Aunque el MVP1 no resuelva todavía todas las diferencias de cambio, el sistema debe guardar desde ya:

- moneda original del documento,
- importe original,
- tipo de cambio aplicado,
- fuente del tipo de cambio,
- fecha de tipo de cambio,
- importe funcional/base en moneda de la organización.

Esto aplica especialmente a:
- open items,
- importaciones,
- asientos,
- liquidaciones históricas importadas.

### 6.3 Dos velocidades de IA

**Velocidad 1 — online / interactiva**
- intake documental,
- segunda IA contable,
- intake/agregación de importaciones.

**Velocidad 2 — diferida / batch**
- import de históricos,
- interpretación de planillas grandes,
- backfills masivos.

La arquitectura debe soportar ambas desde el inicio.

### 6.4 La IA interpreta intención, no solo celdas

En planillas no se debe partir de un mapeo rígido tipo “columna A es fecha”.  
La IA debe inferir intención usando:
- nombres de sheets,
- headers,
- patrones repetidos,
- vocabulario contable,
- totales,
- formatos de fecha,
- formatos de RUT,
- tasas de IVA,
- filas de sumatoria.

### 6.5 El sistema debe poder explicar cada sugerencia

Toda sugerencia debe poder descomponerse en:
- fuente de decisión,
- confianza,
- evidencia,
- reglas aplicadas,
- alternativas descartadas,
- warnings.

---

## 7. Flujos objetivo del MVP V1

### 7.1 Flujo A — documento local de compra o venta

1. Usuario sube 1 o N archivos.
2. Se persiste el archivo y metadata inicial mínima.
3. Se manda a OpenAI `document_intake_v2`.
4. Se obtiene JSON estructurado persistible.
5. Se resuelve familia transaccional con prioridad:
   - identidad de organización por RUT/alias,
   - candidato del intake,
   - revisión humana.
6. Se calcula identidad de factura y duplicados.
7. Se resuelve contraparte.
8. Se resuelven conceptos contra memoria histórica.
9. Si no alcanza la confianza, se abre `accounting_context`.
10. Usuario explica el gasto o la operación.
11. Segunda IA contable sugiere cuenta/concepto/categoría usando solo opciones permitidas.
12. Motor determinístico arma sugerencia final de asiento.
13. Motor fiscal arma tratamiento IVA.
14. Al aprobar:
   - se persiste asiento,
   - se impacta IVA,
   - se genera open item si corresponde,
   - se registra audit log,
   - se ofrece guardar regla si aplica.

### 7.2 Flujo B — importación fase 1

1. Usuario crea una **operación de importación**.
2. Sube DUA y documentos relacionados.
3. Cada documento se procesa con intake documental o intake específico de importación.
4. Se consolida la operación por referencias comunes.
5. Se separan:
   - tributos de importación,
   - documentos de servicios locales relacionados,
   - gastos del despachante,
   - flete/seguro.
6. Se calculan:
   - IVA importación,
   - anticipo IVA,
   - otros tributos detectados,
   - warnings,
   - necesidad o no de revisión manual.
7. La operación aprobada impacta IVA y contabilidad.

### 7.3 Flujo C — import desde planillas

1. Contador sube una planilla.
2. Se detecta tipo de planilla:
   - liquidación histórica de IVA,
   - estructura de asientos,
   - plan de cuentas,
   - mixto,
   - no soportado.
3. OpenAI devuelve JSON canónico versionado.
4. El sistema muestra preview, warnings y mapeo interpretado.
5. Usuario confirma o corrige.
6. El sistema persiste en tablas canónicas.
7. Si la carga es grande:
   - se procesa por Background mode / Batch API,
   - se notifica estado,
   - se permite descargar preview JSON.

### 7.4 Flujo D — cuentas a cobrar / pagar

1. Factura de venta aprobada crea saldo a cobrar.
2. Factura de compra aprobada crea saldo a pagar.
3. Nota de crédito ajusta o revierte saldo.
4. Recibo/cobro/pago cancela o reduce saldo abierto.
5. El sistema muestra saldo por documento, contraparte y moneda.

### 7.5 Flujo E — confianza y aprendizaje

1. El sistema clasifica y muestra semáforo por campo/documento.
2. Si detecta proveedor nuevo o concepto nuevo sin regla confiable:
   - propone pedir contexto al usuario.
3. Si luego de aprobar existe un patrón reusable:
   - pregunta si desea guardar la regla.
4. El audit log deja:
   - qué regla disparó,
   - cuándo se creó,
   - qué usuario aprobó,
   - con qué confianza.

---

## 8. Definiciones funcionales nuevas o reforzadas

### 8.1 Identidad de ventas por organización

**Regla obligatoria**

- Si `facts.issuer_tax_id` coincide con `organization.tax_id_normalized`, el documento es de familia venta.
- Si `facts.receiver_tax_id` coincide con `organization.tax_id_normalized` y el emisor no coincide, el documento es de familia compra.
- Si falta RUT pero el nombre coincide con:
  - razón social,
  - nombre de fantasía,
  - alias de organización,
  con match fuerte, se marca coincidencia tentativa con confianza reducida.
- Si ambos coinciden o ninguno coincide, se fuerza revisión.

### 8.2 RUT y nombre deben normalizarse así

**RUT**
- remover guiones,
- remover espacios,
- conservar solo dígitos,
- validar longitud esperada,
- almacenar versión cruda y normalizada.

**Nombre**
- uppercase o lowercase estable,
- sin puntuación innecesaria,
- sin dobles espacios,
- sin sufijos societarios irrelevantes para matching, cuando la estrategia lo permita,
- tokenización básica para match fuerte.

### 8.3 Cuentas a cobrar / pagar en MVP1

Toda factura aprobada que genere saldo debe persistir, como mínimo:

- documento origen,
- contraparte,
- fecha emisión,
- fecha vencimiento,
- moneda original,
- tipo de cambio,
- importe original,
- importe funcional/base,
- cancelado,
- saldo pendiente,
- estado,
- referencia al asiento.

### 8.4 Importaciones fase 1 acotada

**Incluido**
- DUA / despacho como documento principal.
- Factura comercial asociada.
- Flete / seguro / gastos asociados si vienen documentados.
- IVA importación.
- Anticipo IVA.
- Persistencia de otros tributos detectados para auditoría.
- Separación de gastos del despachante y otros servicios locales cuando correspondan.

**Bloqueado a revisión manual**
- suspenso,
- exoneraciones especiales,
- zona franca,
- parcializaciones complejas,
- reliquidaciones raras,
- casuística aduanera especial fuera del carril estándar.

### 8.5 Import desde planillas

Debe soportar, al menos:

1. Cargar liquidaciones históricas de IVA.
2. Cargar estructuras de asientos.
3. Cargar plan de cuentas.
4. Detectar si una planilla mezcla varias cosas y devolver advertencia.
5. Permitir confirmación parcial si algunas sheets están bien y otras no.

### 8.6 El lenguaje del contador importa

El sistema debe poder producir un resumen configurable del tipo:

- formulario,
- línea/código,
- etiqueta humana,
- valor total,
- origen del cálculo,
- si fue:
  - calculado por sistema,
  - importado,
  - ajustado manualmente.

Ejemplo de diseño:
- `form_code = 2176`
- `line_code = 114`
- `metric_key = output_vat`

**Importante:** no hardcodear formularios en el motor. Usar configuración/versionado.

---

## 9. Modelo de datos nuevo o ampliado

### 9.1 Entidades nuevas mínimas

#### `organization_identity_aliases`

Permite reconocer la organización aunque aparezca con otra forma de nombre.

Campos mínimos:
- `id`
- `organization_id`
- `alias_type` (`legal_name`, `trade_name`, `billing_name`, `other`)
- `alias_value`
- `normalized_value`
- `is_active`
- `created_at`

#### `organization_import_operations`

- `id`
- `organization_id`
- `reference_code`
- `dua_number`
- `dua_year`
- `customs_broker_name`
- `supplier_name`
- `supplier_tax_id`
- `currency_code`
- `operation_date`
- `payment_date`
- `status`
- `warnings_json`
- `raw_summary_json`
- `created_at`
- `updated_at`

#### `organization_import_operation_documents`

- `id`
- `organization_id`
- `import_operation_id`
- `document_id`
- `document_type`
- `is_primary`
- `created_at`

#### `organization_import_operation_taxes`

- `id`
- `organization_id`
- `import_operation_id`
- `tax_code`
- `tax_label`
- `external_tax_code`
- `amount`
- `currency_code`
- `is_creditable_vat`
- `is_vat_advance`
- `is_other_tax`
- `source_document_id`
- `metadata_json`
- `created_at`

> `external_tax_code` sirve para guardar el código de tributo tal como venga del documento aduanero o del estándar operativo usado por el despacho.

#### `organization_spreadsheet_import_runs`

- `id`
- `organization_id`
- `source_document_id`
- `import_type`
- `status`
- `provider_code`
- `model_code`
- `prompt_version`
- `schema_version`
- `warnings_json`
- `preview_json`
- `result_json`
- `confirmed_at`
- `confirmed_by`
- `created_at`

#### `ledger_open_items`

- `id`
- `organization_id`
- `counterparty_type` (`vendor` | `customer`)
- `counterparty_id`
- `source_document_id`
- `document_role`
- `document_type`
- `issue_date`
- `due_date`
- `currency_code`
- `fx_rate`
- `fx_rate_date`
- `functional_currency_code`
- `original_amount`
- `functional_amount`
- `settled_amount`
- `outstanding_amount`
- `status`
- `journal_entry_id`
- `created_at`
- `updated_at`

#### `ledger_settlement_links`

- `id`
- `organization_id`
- `open_item_id`
- `settlement_document_id`
- `settlement_journal_entry_id`
- `currency_code`
- `fx_rate`
- `fx_rate_date`
- `amount`
- `functional_amount`
- `settled_at`
- `created_at`

#### `ai_decision_logs`

Audit log de decisiones de IA y reglas.

Campos mínimos:
- `id`
- `organization_id`
- `document_id`
- `run_type`
- `provider_code`
- `model_code`
- `prompt_version`
- `schema_version`
- `response_id`
- `decision_source` (`deterministic_rule`, `vendor_rule`, `concept_rule`, `assistant`, `manual_override`, `imported`)
- `confidence_score`
- `certainty_level` (`green`, `yellow`, `red`)
- `evidence_json`
- `rationale_text`
- `warnings_json`
- `created_at`

#### `organization_dgi_form_mappings`

- `id`
- `organization_id`
- `form_code`
- `line_code`
- `metric_key`
- `label`
- `calculation_mode`
- `configuration_json`
- `version`
- `is_active`
- `created_at`

#### `vat_form_exports`

- `id`
- `organization_id`
- `vat_run_id`
- `form_code`
- `version`
- `summary_json`
- `source_payload_json`
- `export_artifact_id`
- `created_at`

### 9.2 Entidades existentes a ampliar

- `documents`
- `document_drafts`
- `document_processing_runs`
- `document_invoice_identities`
- `vendors`
- `customers`
- `organization_concepts`
- `organization_accounting_rules`
- `vat_runs`
- `journal_entries`
- `journal_entry_lines`

### 9.3 Campos nuevos recomendados en `document_drafts`

- `transaction_family_candidate`
- `issuer_matches_organization`
- `receiver_matches_organization`
- `document_subtype_candidate`
- `payment_reference_candidate`
- `open_item_candidate`
- `counterparty_candidate`
- `import_operation_candidate`
- `certainty_breakdown_json`
- `decision_path_json`

---

## 10. OpenAI en producción con GPT-4o

### 10.1 Decisión técnica

Se estandariza la integración con:

- **OpenAI Responses API**
- **Structured Outputs strict JSON Schema**
- **file inputs**
- **background mode**
- **Batch API para históricos/backfills**

### 10.2 Variables de entorno objetivo

```env
OPENAI_API_KEY=your-openai-api-key
OPENAI_DOCUMENT_MODEL=gpt-4o
OPENAI_ACCOUNTING_MODEL=gpt-4o
OPENAI_SPREADSHEET_IMPORT_MODEL=gpt-4o
OPENAI_IMPORTS_MODEL=gpt-4o
OPENAI_RULES_MODEL=gpt-4o
OPENAI_PROMPT_VERSION=2026-03-14
OPENAI_SCHEMA_VERSION=2026-03-14
OPENAI_BACKGROUND_POLL_INTERVAL_MS=10000
OPENAI_BACKGROUND_MAX_ATTEMPTS=60
OPENAI_BATCH_ENABLED=true
OPENAI_BATCH_WINDOW=24h
OPENAI_BATCH_MAX_FILE_BYTES=52428800
```

### 10.3 Reglas de implementación

1. La API key solo existe server-side.
2. Todo output crítico usa schema estricto.
3. Todo prompt queda versionado.
4. Toda respuesta guarda:
   - `response_id`,
   - `model_code`,
   - `usage`,
   - `prompt_hash`,
   - `schema_version`,
   - `prompt_version`,
   - `warnings`,
   - `cost_estimate` opcional.
5. Todo flujo AI puede caer a `manual_review_required`.
6. Background mode para procesos interactivos largos.
7. Batch API para históricos/importes masivos no urgentes.

### 10.4 Módulos a tocar

- `.env.example`
- `lib/env.ts`
- `lib/llm/openai-responses.ts`
- `modules/documents/processing.ts`
- `modules/accounting/assistant.ts`
- `modules/imports/*`
- `modules/spreadsheets/*`
- `modules/evals/*`
- `tests/*`

### 10.5 Wrapper central esperado

`lib/llm/openai-responses.ts` debe exponer helpers reutilizables:

- `createStructuredOpenAIResponse`
- `createBackgroundStructuredOpenAIResponse`
- `createBatchStructuredOpenAIJob`
- `retrieveOpenAIResponse`
- `retrieveOpenAIBatchJob`
- `uploadOpenAIUserDataFile`
- `extractStructuredOutputFromOpenAIResponse`
- `estimateOpenAICost`
- `persistAIDecisionLog`

---

## 11. Estructuras de prompts y contratos AI

> Estos prompts son estructuras base. Deben vivir versionados en módulos separados, con su JSON schema estricto, tests de parsing y fixtures de ejemplo.

### 11.1 Caso de uso 1 — `document_intake_v2`

**Objetivo**  
Analizar exactamente un documento de negocio y devolver facts estructurados, familia transaccional, line items, señales organizacionales y warnings.

**Modelo**  
`gpt-4o`

**System prompt base**

```text
You are the Convertilabs Uruguay document intake model.

Analyze exactly one business document and return only valid JSON matching the schema.

Hard rules:
- Logged organization name: "{organization_name}"
- Logged organization tax id: "{organization_tax_id}"
- Logged organization aliases: {organization_aliases_json}
- Normalize Uruguay tax ids by removing spaces and dashes before comparing.
- If issuer tax id matches the logged organization tax id, transaction family must be sale.
- If receiver tax id matches the logged organization tax id and issuer does not match, transaction family must be purchase.
- If tax ids are missing, use organization aliases carefully and lower confidence.
- Never invent legal certainty, totals, tax rates, counterparties, or dates.
- Distinguish invoices, credit notes, receipts, payment supports, customs/import documents, and other non-standard documents.
- Extract line items whenever possible.
- If line items are not reliably visible, keep them empty and explain the limitation in warnings.
- Return no prose outside JSON.

Context:
- Country: Uruguay
- Allowed top-level roles: purchase, sale, other
- Allowed transaction families: purchase, sale, import_operation, other
- Fiscal snapshot summary: {rule_snapshot_summary}
```

**User prompt base**

```text
Analyze the attached file.
Filename: {filename}
MIME type: {mime_type}

Return structured facts, transaction family, document subtype, line items, tax clues, and warnings.
```

### 11.2 Caso de uso 2 — `accounting_assistant_v2`

**Objetivo**  
Cuando la memoria contable no alcanza, usar texto libre del usuario y ejemplos aprobados para sugerir solo opciones válidas.

**Modelo**  
`gpt-4o`

**System prompt base**

```text
You are the Convertilabs accounting classification assistant.

You are only allowed to suggest concept ids and account ids from the provided allowed lists.
If you are not confident enough, return null ids, explicit review flags, and should_block_confirmation=true.
Do not invent accounts, concepts, tax certainty, legal certainty, or counterparties.
Use the user free-text context, extracted facts, line items, prior approved examples, organization fiscal summary, and prior vendor/concept rules.
Prefer deterministic rules and approved examples over creativity.
If the suggested treatment depends on missing information, explain the gap and block confirmation.
Return only JSON matching the schema.
```

**User prompt base**

```text
Document id: {document_id}
Counterparty summary: {counterparty_summary}
Invoice identity key: {invoice_identity_key}
User context: {user_free_text}
Extracted facts: {facts_json}
Line items: {line_summary}
Candidate concepts: {candidate_concepts}
Allowed concepts: {allowed_concepts}
Allowed accounts: {allowed_accounts}
Prior approved examples: {prior_examples}
Known organization rules: {rule_summary}

Suggest the best supported accounting classification.
```

### 11.3 Caso de uso 3 — `spreadsheet_import_interpreter_v1`

**Objetivo**  
Interpretar la intención de una planilla contable/fiscal y devolver JSON canónico persistible.

**Modelo**  
`gpt-4o`

**System prompt base**

```text
You are the Convertilabs spreadsheet import interpreter.

Inspect one spreadsheet file and classify its purpose.

Supported purposes:
- historical_vat_liquidation
- journal_structure
- chart_of_accounts
- mixed
- unsupported

Do not rigidly map fixed columns.
Infer intent using sheet names, headers, repeated patterns, totals, tax vocabulary, account vocabulary, date patterns, tax ids, and numeric structures.
Map the spreadsheet into canonical Convertilabs JSON.
Do not invent rows, accounts, dates, or numeric values.
If a sheet or column is ambiguous, preserve the ambiguity in warnings.
Return only JSON matching the schema.
```

**User prompt base**

```text
Analyze the attached spreadsheet.
Organization: {organization_name}
Country: Uruguay
Expected import types: historical VAT settlements, journal structures, chart of accounts.
Return canonical JSON, detected intent, warnings, and confidence.
```

### 11.4 Caso de uso 4 — `import_document_intake_v1`

**Objetivo**  
Leer documentos aduaneros o relacionados a importaciones y devolver facts específicos.

**Modelo**  
`gpt-4o`

**System prompt base**

```text
You are the Convertilabs Uruguay import-document intake model.

Analyze exactly one import-related document and return only valid JSON matching the schema.

Supported document kinds include:
- DUA / customs clearance
- commercial invoice
- freight
- insurance
- customs broker invoice
- customs tax support
- payment support

Rules:
- Extract import VAT and VAT advance separately when visible.
- Preserve tax codes exactly as shown when visible.
- Preserve other taxes separately.
- If the document appears to be a local service invoice from a customs broker or local provider, warn that it may not belong to customs taxes and may need separate local-purchase accounting treatment.
- Do not merge taxes from different conceptual origins.
- Return warnings when the document does not clearly belong to the same import operation.
Return only JSON matching the schema.
```

**User prompt base**

```text
Analyze the attached import-related document.
Organization: {organization_name}
Tax id: {organization_tax_id}
Return structured import facts, references, tax lines, external tax codes, and warnings.
```

### 11.5 Caso de uso 5 — `import_operation_aggregator_v1`

**Objetivo**  
Consolidar varios documentos ya interpretados de una misma operación de importación.

**Modelo**  
`gpt-4o`

**System prompt base**

```text
You are the Convertilabs import operation aggregator.

You receive structured JSON from multiple documents that may belong to one Uruguay import operation.
Consolidate them into one canonical import operation summary.
Prefer exact references like DUA number, year, supplier, operation date, payment date, and tax lines.
Do not merge unrelated operations.
Keep customs taxes separate from local service invoices when they represent different accounting treatments.
If documents conflict materially, return warnings and block confirmation.
Return only JSON matching the schema.
```

### 11.6 Caso de uso 6 — `vat_form_mapper_v1`

**Objetivo**  
Mapear un `vat_run` canónico a líneas/códigos de formulario configurables para contador.

**Modelo**  
Por defecto **no necesita IA**.  
Solo usar IA como asistente de configuración inicial si el usuario importa una planilla histórica con estructura de formulario.

**System prompt base para setup opcional**

```text
You are the Convertilabs VAT form mapping assistant.

You help infer candidate mappings between spreadsheet/form labels and Convertilabs canonical VAT metrics.
You must not invent legal certainty.
Return only candidate mappings with confidence and warnings.
```

---

## 12. Capa de confianza: audit log, semáforo y aprendizaje proactivo

### 12.1 Audit log de decisiones

Cada documento u operación debe poder mostrar algo como:

- “Sugerido por IA (95% confianza)”
- “Basado en regla vendor_concept creada el 2026-03-12”
- “Coincidencia determinística por RUT de organización”
- “Bloqueado por falta de evidencia en RUT / concepto”

### 12.2 Semáforo de certeza

Definir nivel de certeza por documento y por campo:

- **Verde**
  - regla determinística o match fuerte,
  - o IA con alta confianza + evidencia suficiente + sin warnings críticos.
- **Amarillo**
  - IA razonable, pero con warnings o match incompleto.
- **Rojo**
  - dato material faltante, duplicado dudoso, documento ambiguo o caso fuera de alcance.

**Sugerencia inicial de umbrales**
- `green >= 0.90`
- `yellow >= 0.65 and < 0.90`
- `red < 0.65`

Los umbrales deben ser configurables, no hardcode absoluto.

### 12.3 Human-in-the-loop proactivo

El sistema debe detectar casos como:

- nuevo proveedor,
- nuevo concepto,
- nueva combinación proveedor + concepto,
- factura sin regla reusable,
- documento de importación con servicio local mezclado.

Y entonces sugerir acciones tipo:

- “¿Querés guardar esta clasificación como regla para este proveedor?”
- “He detectado un nuevo proveedor, ¿querés asociarlo a Gasto de Energía Eléctrica?”
- “Este concepto ya existe en otros proveedores. ¿Querés reutilizar esa clasificación?”

### 12.4 Implementación mínima obligatoria

- tabla `ai_decision_logs`,
- badges de certeza,
- panel de “por qué se sugirió esto”,
- CTA explícita para guardar regla,
- warnings visibles antes de confirmar.

---

## 13. Tareas ejecutables en orden

## STEP4-TASK-00 — Hotfixes inmediatos y limpieza del flujo base

**Objetivo**  
Sacar del medio los gremlins obvios antes de seguir agregando más dominio.

**Implementación**
- Corregir el prepare upload para que el documento no nazca como `purchase` por default.
- Permitir `direction = null | unknown` hasta la resolución definitiva.
- Habilitar selección múltiple y drag-and-drop múltiple.
- Congelar una taxonomía única de estados documentales.
- Agregar validación de MIME y tamaño en carga múltiple.
- Agregar estrategia de encolado individual por archivo dentro del lote.

**Archivos**
- `app/app/o/[slug]/dashboard/actions.ts`
- `components/documents/upload-dropzone.tsx`
- `modules/documents/*`
- RPC/SQL si aplica

**Tests**
- upload de 1 archivo,
- upload de N archivos mixtos,
- venta no nace como compra,
- estados consistentes en UI y DB.

**Done cuando**
- Se pueden subir varios archivos en un gesto.
- Ninguna venta nace con familia incorrecta por placeholder.
- Los estados visibles y persistidos no se pisan entre sí.

---

## STEP4-TASK-01 — Wiring productivo de OpenAI con GPT-4o

**Objetivo**  
Dejar la integración AI lista para producción base.

**Implementación**
- Actualizar `.env.example` y `lib/env.ts`.
- Unificar wrapper central para:
  - respuestas estructuradas,
  - background mode,
  - batch jobs,
  - file uploads.
- Persistir metadatos de costo/uso/versionado.
- Agregar feature flag para cambiar a `gpt-4o-mini` más adelante, sin romper contratos.
- Crear interfaz única `AIPipelineRun`.

**Archivos**
- `.env.example`
- `lib/env.ts`
- `lib/llm/openai-responses.ts`
- `modules/shared/ai/*` si se decide separar
- `tests/llm/*`

**Tests**
- wrapper sync,
- wrapper background,
- wrapper batch,
- parse JSON estricto,
- fallbacks de error y reintento.

**Done cuando**
- Todo flujo AI corre contra `gpt-4o` por default.
- Cada corrida tiene trazabilidad técnica y de costo.

---

## STEP4-TASK-02 — Intake documental v2

**Objetivo**  
Que la primera IA devuelva todo lo necesario para compras, ventas, recibos, notas de crédito e import-related docs.

**Implementación**
- Extender schema con:
  - `transaction_family_candidate`
  - `document_subtype_candidate`
  - `issuer_matches_organization`
  - `receiver_matches_organization`
  - `certainty_breakdown_json`
- Inyectar aliases de organización en el prompt.
- Normalizar RUT antes de comparar.
- Mantener `line_items` como insumo prioritario.
- Registrar evidencias visibles.

**Archivos**
- `modules/ai/document-intake-contract.ts`
- `modules/documents/processing.ts`
- `modules/accounting/organization-identity.ts`
- `document_drafts` migration

**Tests**
- compra local,
- venta local,
- nombre de fantasía,
- RUT con y sin guiones,
- nota de crédito,
- recibo.

**Done cuando**
- El intake ya sale “pensando en la organización” y no como OCR ciego.

---

## STEP4-TASK-03 — Resolución determinística de familia transaccional por identidad de organización

**Objetivo**  
Sacar compra/venta del terreno blando cuando el dato permite determinismo.

**Implementación**
- Crear módulo único `organization-identity-resolution.ts`.
- Normalizar:
  - RUT crudo,
  - RUT con guiones,
  - RUT sin guiones,
  - nombre legal,
  - nombre de fantasía,
  - aliases.
- Resolver prioridad:
  1. issuer tax id == org tax id => sale
  2. receiver tax id == org tax id and issuer != org => purchase
  3. match fuerte por alias => tentative
  4. ambiguo => review
- Subtipar:
  - `sale_invoice`
  - `sale_credit_note`
  - `sale_receipt`
  - `purchase_invoice`
  - `purchase_credit_note`
  - `purchase_payment_support`

**Archivos**
- `modules/accounting/organization-identity.ts`
- `modules/accounting/transaction-family-resolution.ts`
- `components/documents/document-review-workspace.tsx`

**Tests**
- RUT exacto,
- RUT con formato distinto,
- alias de marca,
- ambos lados coinciden,
- ninguno coincide.

**Done cuando**
- Las ventas de Rontil se resuelven por identidad y no por corazonada del modelo.

---

## STEP4-TASK-04 — Debe/Haber, open items y moneda

**Objetivo**  
Formalizar el básico contable natural del sistema.

**Implementación**
- Crear `ledger_open_items` y `ledger_settlement_links`.
- Generar open items al aprobar:
  - factura venta => AR
  - factura compra => AP
  - nota crédito => ajuste/reversión
  - recibo/cobro/pago => liquidación parcial/total
- Guardar:
  - moneda original,
  - tipo de cambio,
  - fecha de tipo de cambio,
  - moneda funcional,
  - importes en ambas.
- Extender asientos para garantizar balance.

**Archivos**
- `modules/accounting/open-items.ts`
- `modules/accounting/journal-builder.ts`
- `journal_entries` migrations
- `ledger_open_items` migrations
- `app/app/o/[slug]/journal-entries/*`

**Tests**
- AP local UYU,
- AR USD,
- cancelación parcial,
- nota de crédito,
- saldo residual correcto.

**Done cuando**
- Cada factura aprobada genera, cuando corresponde, saldo abierto claro y trazable.

---

## STEP4-TASK-05 — Capa de confianza: audit log, semáforo y explicación

**Objetivo**  
Cerrar el “trust gap” desde el producto y desde la persistencia.

**Implementación**
- Crear `ai_decision_logs`.
- Calcular `certainty_level` por documento y por decisión.
- Mostrar en UI:
  - fuente de la sugerencia,
  - confianza,
  - warnings,
  - evidencia,
  - fecha de creación de regla si aplica.
- Registrar `decision_source`:
  - deterministic_rule,
  - vendor_rule,
  - concept_rule,
  - assistant,
  - manual_override,
  - imported.
- Agregar chips y panel de explicación.

**Archivos**
- `modules/accounting/decision-log.ts`
- `components/documents/*`
- `components/tax/*`
- SQL nuevo

**Tests**
- audit log en compra,
- audit log en venta,
- regla previa,
- override manual,
- certainty color correcto.

**Done cuando**
- El usuario puede leer “por qué” y no solo “qué”.

---

## STEP4-TASK-06 — Duplicados y memoria contable final

**Objetivo**  
Dejar cerrados dedupe de negocio + memoria por proveedor/concepto + concepto global.

**Implementación**
- Endurecer identidad de factura.
- Revalidar precedencia:
  1. manual override
  2. document override
  3. vendor + concept
  4. concept global
  5. vendor default
  6. assistant
  7. manual review
- Separar:
  - descripción cruda,
  - descripción normalizada,
  - concepto canónico.
- Reutilizar concepto entre proveedores distintos.
- Bloquear duplicado dudoso.

**Archivos**
- `modules/accounting/invoice-identity.ts`
- `modules/accounting/concept-resolution.ts`
- `modules/accounting/rules.ts`

**Tests**
- mismo archivo,
- misma factura con archivo distinto,
- mismo concepto con proveedor distinto,
- duplicado dudoso.

**Done cuando**
- El sistema aprende criterio contable reusable sin volverse un loro confuso.

---

## STEP4-TASK-07 — Segunda IA contable y aprendizaje proactivo

**Objetivo**  
Cerrar el loop fino de clasificación humana asistida.

**Implementación**
- Consolidar `accounting_context` como paso obligatorio solo cuando falte regla confiable.
- Guardar el texto libre del usuario como artifact auditable.
- Ejecutar `accounting_assistant_v2` solo cuando corresponda.
- Bloquear confirmación si:
  - falta dato material,
  - la confianza es baja,
  - la IA no puede elegir entre opciones permitidas.
- Agregar CTA proactivo:
  - guardar regla proveedor,
  - guardar regla proveedor+concepto,
  - guardar regla concepto global.

**Archivos**
- `components/documents/document-review-workspace.tsx`
- `modules/accounting/assistant.ts`
- `modules/accounting/learning-suggestions.ts`

**Tests**
- proveedor nuevo,
- concepto nuevo,
- sugerencia reusable,
- bloqueo por baja confianza.

**Done cuando**
- El usuario puede explicar “qué onda con la factura” y además convertir esa corrección en memoria reusable.

---

## STEP4-TASK-08 — Import desde planillas: motor canónico

**Objetivo**  
Bajar drásticamente la fricción de adopción.

**Implementación**
- Crear `modules/spreadsheets/`.
- Soportar `.xlsx`, `.xls`, `.csv`, `.tsv`.
- Parse estructural inicial:
  - sheets,
  - headers,
  - preview tabular,
  - rango usado.
- Luego mandar la representación necesaria a OpenAI.
- Pedir interpretación por intención y no por columnas fijas.
- Persistir:
  - `preview_json`,
  - `result_json`,
  - warnings,
  - confidence,
  - mapeo detectado.

**Archivos**
- `modules/spreadsheets/parser.ts`
- `modules/spreadsheets/interpreter.ts`
- `modules/spreadsheets/persistence.ts`
- `lib/llm/openai-responses.ts`
- UI wizard

**Tests**
- CSV simple,
- XLSX con varias hojas,
- planilla desordenada,
- sheet irrelevante,
- mixed import.

**Done cuando**
- Una planilla real puede convertirse en JSON canónico revisable antes de persistir.

---

## STEP4-TASK-09 — Import de históricos: IVA, plantillas y Batch API

**Objetivo**  
Permitir que un contador traiga su historia previa sin empezar desde cero.

**Implementación**
- Definir JSON canónico para:
  - `historical_vat_liquidation`
  - `journal_template_import`
  - `chart_of_accounts_import`
- Crear import runner con dos modos:
  - interactivo para archivos chicos,
  - Batch API para backfills pesados.
- Permitir “importado” vs “calculado por sistema”.
- Dejar reintentos, seguimiento de estado y descarga del preview interpretado.
- Registrar costo estimado y lote.

**Archivos**
- `modules/spreadsheets/import-runner.ts`
- `modules/spreadsheets/batch.ts`
- `organization_spreadsheet_import_runs` migration
- UI de progreso

**Tests**
- import histórico de varios períodos,
- backfill batch,
- cancelación/reintento,
- período importado visible en timeline fiscal.

**Done cuando**
- Se pueden cargar 1 o varios años históricos sin derretir costo ni UX.

---

## STEP4-TASK-10 — Import de estructuras de asientos y plan de cuentas

**Objetivo**  
Acelerar el setup contable inicial.

**Implementación**
- Importar plantillas de asientos y plan de cuentas.
- Convertirlas en:
  - cuentas postables,
  - conceptos canónicos,
  - reglas sugeribles,
  - defaults por categoría.
- Validar duplicados de cuenta/código.
- Permitir preview y confirmación parcial.

**Archivos**
- `modules/accounting/chart-import.ts`
- `modules/accounting/template-import.ts`
- UI de wizard

**Tests**
- plan de cuentas simple,
- estructura de asiento simple,
- duplicado de código,
- plantilla con IVA.

**Done cuando**
- El sistema puede arrancar con memoria inicial importada y no solo “aprender con el tiempo”.

---

## STEP4-TASK-11 — Operación de importación como entidad compuesta

**Objetivo**  
Modelar importaciones reales de Rontil sin tragarse toda la aduana del universo.

**Implementación**
- Crear `organization_import_operations`.
- Crear UI propia de `Importaciones`.
- Permitir vincular documentos a operación.
- Resolver referencias comunes:
  - número DUA,
  - año,
  - proveedor,
  - fecha operación,
  - fecha pago,
  - moneda.
- Permitir estado:
  - draft
  - processing
  - ready_for_review
  - approved
  - blocked_manual_review

**Archivos**
- `modules/imports/*`
- SQL nuevo
- `app/app/o/[slug]/imports/*`

**Tests**
- una operación con 1 DUA,
- una operación con DUA + factura comercial,
- conflicto de referencias.

**Done cuando**
- El usuario puede trabajar una importación como operación compuesta y no como papeles huérfanos.

---

## STEP4-TASK-12 — Intake específico de importación y separación de tributos

**Objetivo**  
Leer DUA y relacionados con semántica de importación, no como compras locales genéricas.

**Implementación**
- Implementar `import_document_intake_v1`.
- Implementar `import_operation_aggregator_v1`.
- Extraer específicamente:
  - IVA importación,
  - anticipo IVA,
  - otros tributos,
  - `external_tax_code` o código visible de tributo,
  - advertencia si un documento parece ser gasto local del despachante.
- Separar:
  - impuestos aduaneros,
  - honorarios/gastos locales,
  - facturas de servicios locales relacionadas a la importación.
- Si el sistema detecta “gasto despachante” como compra local, debe sugerir tratamiento como documento de compra local, no como tributo aduanero.

**Archivos**
- `modules/imports/intake.ts`
- `modules/imports/aggregate.ts`
- `modules/imports/tax-classification.ts`

**Tests**
- DUA estándar,
- documento con códigos de tributo,
- factura del despachante,
- operación mixta.

**Done cuando**
- El sistema deja de mezclar aduana con gasto local como si todo fuera la misma sopa.

---

## STEP4-TASK-13 — IVA UY v1 completo para Rontil + mapping DGI

**Objetivo**  
Llegar a una liquidación de IVA útil para un importador y presentable para contador.

**Implementación**
- Extender VAT engine para incluir:
  - compras locales,
  - ventas locales,
  - IVA importación,
  - anticipo IVA.
- Persistir otros tributos detectados aunque no todos entren en automatismo fino.
- Crear capa `organization_dgi_form_mappings`.
- Generar resumen configurable por formulario/línea.
- Exportar un bloque tipo:
  - formulario,
  - línea,
  - total,
  - origen del dato,
  - warning si parte del dato viene de import histórico o ajuste manual.
- No hardcodear líneas legales dentro del motor.

**Archivos**
- `modules/tax/*`
- `modules/exports/*`
- SQL nuevo para mappings

**Tests**
- run local simple,
- run con importación,
- run mixto,
- mapping configurable de línea DGI.

**Done cuando**
- El contador puede mirar el resumen fiscal y ver cómo cae a su formulario sin adivinar.

---

## STEP4-TASK-14 — Export / import paritario del modelo canónico

**Objetivo**  
Que export e import hablen el mismo idioma interno.

**Implementación**
- Definir:
  - `canonical_tax_payload`
  - `canonical_accounting_payload`
- El export sale de ese canon.
- El import AI mapea hacia ese mismo canon.
- Mantener `source_type`:
  - `system_generated`
  - `imported_from_spreadsheet`
  - `imported_from_document`
  - `manual_override`
- Preparar adapters:
  - Excel XML actual,
  - `.xlsx` futuro,
  - adapters de software contable en backlog.

**Archivos**
- `modules/exports/canonical.ts`
- `modules/exports/jobs.ts`
- `modules/spreadsheets/canonical.ts`

**Tests**
- roundtrip import/export,
- source tracking,
- período mixto.

**Done cuando**
- Un período o plantilla puede entrar por import y salir por export sin perder semántica.

---

## STEP4-TASK-15 — UI mínima de administración real

**Objetivo**  
No dejar el dominio listo y la UI muda como estatua.

**Implementación**
- Vista de documentos con:
  - badges de familia,
  - semáforo,
  - duplicados,
  - fuente de decisión.
- Wizard de import planilla.
- Nueva sección `Importaciones`.
- Vista de open items.
- Vista de resumen fiscal por líneas DGI.
- Panel “por qué se sugirió esto”.

**Archivos**
- `app/app/o/[slug]/documents/*`
- `app/app/o/[slug]/imports/*`
- `app/app/o/[slug]/tax/*`
- `app/app/o/[slug]/open-items/*`

**Tests**
- smoke UI por flujo,
- navegación básica,
- warnings visibles.

**Done cuando**
- Un usuario no técnico puede usar el sistema sin SQL ni interpretación chamánica.

---

## STEP4-TASK-16 — Hooks de automatización manos libres y conectores futuros

**Objetivo**  
Dejar preparado el terreno para lo que después vende solo.

**Implementación ahora**
- Definir interfaces de ingestión desacopladas:
  - `DocumentIngestionSource`
  - `EmailIngestionSource`
  - `CFEIngestionSource`
- Permitir `source_type` en documentos:
  - manual_upload
  - batch_upload
  - email_inbox
  - cfe_feed
  - spreadsheet_import
- No implementar todavía integración completa, pero sí:
  - tablas/campos necesarios,
  - event hooks,
  - contratos de parseo,
  - dedupe por message id / attachment hash / invoice identity.

**Valor futuro**
- Casilla dedicada para proveedores.
- Inbox CFE.
- Integración directa con DGI / receptor electrónico si se encara más adelante.

**Done cuando**
- La arquitectura ya no asume que todo entra por upload manual.

---

## STEP4-TASK-17 — QA, evals y piloto real con Rontil

**Objetivo**  
Salir del laboratorio con control y no a ciegas.

**Implementación**
- Dataset de prueba real controlado de Rontil.
- Evals mínimas por carril:
  - compra local,
  - venta local,
  - nota de crédito,
  - recibo/pago,
  - duplicados,
  - proveedor nuevo,
  - concepto nuevo,
  - importación estándar,
  - factura despachante,
  - import planilla,
  - histórico IVA,
  - mapping DGI.
- Métricas mínimas:
  - extracción usable,
  - clasificación correcta,
  - bloqueo correcto cuando no sabe,
  - IVA correcto en casos soportados,
  - tiempo de revisión razonable,
  - costo promedio por documento/lote.

**Criterio de salida**
- El piloto se considera exitoso cuando puede cerrarse un período de prueba con revisión humana razonable y sin diferencias materiales no explicadas.

**Done cuando**
- Rontil puede usar el sistema para pruebas reales con confianza operativa.

---

## 14. JSON canónicos recomendados

### 14.1 `historical_vat_liquidation`

```json
{
  "importType": "historical_vat_liquidation",
  "organizationId": "org_123",
  "periods": [
    {
      "periodLabel": "2025-12",
      "documentCount": 0,
      "purchaseTaxableBase": 0,
      "saleTaxableBase": 0,
      "outputVat": 0,
      "inputVatCreditable": 0,
      "inputVatNonDeductible": 0,
      "importVat": 0,
      "importVatAdvance": 0,
      "netVatPayable": 0,
      "notes": ""
    }
  ],
  "warnings": []
}
```

### 14.2 `journal_template_import`

```json
{
  "importType": "journal_structure",
  "organizationId": "org_123",
  "templates": [
    {
      "templateName": "Compra combustible",
      "documentRole": "purchase",
      "documentSubtype": "supplier_invoice",
      "operationCategory": "fuel_and_lubricants",
      "conceptName": "Combustible",
      "mainAccountCode": "6105",
      "vatAccountCode": "1181",
      "counterpartyAccountCode": "2110",
      "notes": "Uso operativo de flota"
    }
  ],
  "warnings": []
}
```

### 14.3 `chart_of_accounts_import`

```json
{
  "importType": "chart_of_accounts",
  "organizationId": "org_123",
  "accounts": [
    {
      "code": "6105",
      "name": "Gastos de locomocion",
      "accountType": "expense",
      "normalSide": "debit",
      "isPostable": true
    }
  ],
  "warnings": []
}
```

### 14.4 `dgi_form_export_summary`

```json
{
  "organizationId": "org_123",
  "vatRunId": "vat_123",
  "formCode": "2176",
  "lines": [
    {
      "lineCode": "114",
      "label": "IVA débito fiscal",
      "metricKey": "outputVat",
      "value": 125000.0,
      "sourceType": "system_generated",
      "warnings": []
    }
  ]
}
```

---

## 15. Criterios de aceptación del MVP1 después de este delta

El MVP1 queda listo cuando se cumplan, al menos, estas condiciones:

1. Se pueden subir uno o varios documentos.
2. Intake AI devuelve JSON guardable para compra, venta y documentos comunes soportados.
3. Las ventas se detectan correctamente cuando el emisor es la organización, incluso con RUT con/ sin guiones y alias de nombre.
4. El sistema puede sugerir asientos y pedir contexto solo cuando corresponde.
5. Se generan Debe/Haber y open items a cobrar/pagar.
6. Se guarda moneda original y tipo de cambio donde corresponde.
7. Se detectan duplicados por archivo e identidad de negocio.
8. Se pueden cargar planillas históricas y ver preview antes de persistir.
9. El import desde planillas usa interpretación flexible y no un mapeo rígido frágil.
10. Se puede crear una operación de importación con DUA y separar tributos aduaneros de gastos locales.
11. La liquidación IVA combina compras, ventas e importaciones estándar.
12. El contador puede ver resumen por líneas/códigos DGI configurables.
13. Export e import usan el mismo modelo canónico.
14. Todo flujo crítico AI queda conectado a `gpt-4o` con JSON schema estricto.
15. Existe audit log de decisiones y semáforo de certeza visible.

---

## 16. Orden realista de ejecución recomendado

1. `STEP4-TASK-00` Hotfixes inmediatos.
2. `STEP4-TASK-01` Wiring OpenAI productivo.
3. `STEP4-TASK-02` Intake documental v2.
4. `STEP4-TASK-03` Resolución determinística por identidad de organización.
5. `STEP4-TASK-04` Debe/Haber + open items + moneda.
6. `STEP4-TASK-05` Capa de confianza.
7. `STEP4-TASK-06` Duplicados + memoria contable.
8. `STEP4-TASK-07` Segunda IA + aprendizaje proactivo.
9. `STEP4-TASK-08` Motor base de import planillas.
10. `STEP4-TASK-09` Históricos + Batch API.
11. `STEP4-TASK-10` Plantillas y plan de cuentas.
12. `STEP4-TASK-11` Operación de importación.
13. `STEP4-TASK-12` Intake/agregación de importaciones.
14. `STEP4-TASK-13` IVA Rontil + mapping DGI.
15. `STEP4-TASK-14` Canon import/export.
16. `STEP4-TASK-15` UI mínima de administración real.
17. `STEP4-TASK-16` Hooks manos libres.
18. `STEP4-TASK-17` QA + piloto Rontil.

---

## 17. Backlog posterior al freeze del MVP1

Estas ideas son valiosísimas comercialmente, pero no deben romper el foco del MVP1. Sí deben dejarse preparadas arquitectónicamente.

### 17.1 Inbox de email dedicado

- Dirección dedicada por organización.
- Parsing de adjuntos.
- Dedupe por `message_id`, `attachment_hash`, `invoice_identity`.
- Regla de ingestión por remitente conocido.

### 17.2 Conector CFE / XML-first

- Si el XML existe, debe tener prioridad sobre OCR/PDF.
- PDF queda como apoyo visual.
- Contrato `cfe_payload_import`.

### 17.3 Dashboard de previsión fiscal

- “Vas acumulando X de IVA a pagar”
- comparación con períodos previos,
- alertas por documentos pendientes de revisar.

### 17.4 Export multi-software

- Adapters Memory, Zeta u otros cuando el negocio lo justifique.
- No competir con el software contable; ser el mejor insumo posible.

---

## 18. Nota final de producto

Este STEP4 mueve a Convertilabs desde una demo documental simpática hacia una herramienta que puede empezar a ser útil en operación real para un contador uruguayo.

La clave no es “meter más IA por todas partes”. La clave es meterla donde realmente crea valor:

- intake multimodal estructurado,
- interpretación flexible de planillas,
- clasificación contable cuando la regla no alcanza,
- consolidación de importaciones,
- ayuda para bajar fricción de adopción.

Y dejar determinístico, auditable y defendible todo lo que sí puede serlo:

- ventas por identidad de organización,
- duplicados,
- reglas aprobadas,
- estructura de asientos,
- IVA en casos estándar,
- trazabilidad de decisiones.

Ese equilibrio es el punto dulce.  
Sin eso, tenés humo con JSON.  
Con eso, empezás a tener un producto serio.
