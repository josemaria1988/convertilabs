# Convertilabs — Master Spec SDD para el MVP contable/fiscal

**Status:** Draft v0.1  
**Fecha:** 2026-03-13  
**Modo de trabajo:** Specs-Driven Development  
**Repositorio base:** `josemaria1988/convertilabs`

---

## 1. Objetivo del documento

Este documento consolida, en formato ejecutable y en orden, todo lo conversado desde el análisis del repositorio hasta la definición del flujo deseado para:

- procesamiento de facturas con IA,
- clasificación contable asistida,
- memoria contable por proveedor y por concepto,
- control de duplicados de factura,
- soporte de liquidación mensual de IVA Uruguay,
- exportación completa a Excel.

La idea no es escribir una lluvia de ideas simpática. La idea es dejar una **ruta de implementación concreta**, con decisiones de producto, tareas técnicas, criterios de aceptación y pruebas mínimas.

---

## 2. Resumen del estado actual del repo

### 2.1 Lo que ya está implementado y sirve como base real

1. **Base SaaS multi-tenant ya existente.** Hay auth, middleware para rutas privadas, onboarding y organizaciones.
2. **Pipeline documental ya iniciado.** Hay upload, storage, extracciones, drafts, candidates, revisión y workspace de documento.
3. **Soporte IVA ya presente en primera versión.** Existen VAT runs, pantalla de Tax y motor inicial de IVA Uruguay.
4. **Modelo de datos contable básico ya presente.** Existen `chart_of_accounts`, `vendors`, `customers` y estructura documental/fiscal.
5. **Arquitectura declarada correcta para la etapa.** El repo está pensado como modular monolith, con núcleo fiscal determinístico y AI asistiendo, no gobernando.

### 2.2 Inconsistencias y huecos detectados

1. **Desalineación narrativa del repo.** La identidad pública todavía arrastra el mensaje de “calculadora de conversiones”, mientras el producto real ya es contable/documental.
2. **Drift entre app, DB y migraciones.** El onboarding y el RPC de creación de organización muestran señales de desalineación que hay que cerrar antes de seguir agregando dominio.
3. **El dominio contable vive demasiado dentro de `modules/documents/review.ts`.** El módulo `accounting` existe como intención, pero todavía no como núcleo funcional.
4. **El pipeline de pasos no está del todo alineado entre `processing.ts` y `review.ts`.** Hay bloqueos “pending_deterministic_accounting_engine / pending_deterministic_vat_engine” en una parte, mientras en otra ya se recalculan sugerencias reales.
5. **La clasificación contable actual sigue demasiado hardcodeada.** Hay cuentas fijas y decisiones contables embebidas en lógica de revisión.
6. **La detección de duplicados hoy es demasiado corta.** Se chequea `file_hash`, pero no una identidad de factura de negocio.
7. **No existe todavía la memoria contable por concepto entre proveedores.** Eso es clave para que el sistema aprenda que “combustible” comprado en distintos proveedores sigue siendo el mismo gasto canónico.
8. **La capa de exportación todavía no está cerrada para el MVP.** La arquitectura la prevé, pero no está materializada como módulo operativo con Excel.
9. **La cobertura de tests todavía no toca el corazón del negocio.** Hay smoke scripts útiles, pero faltan pruebas fuertes para clasificación, IVA, duplicados y export.

---

## 3. Decisiones de producto y diseño ya acordadas

### 3.1 Principio rector

El sistema **no** debe preguntar al usuario cada vez que aparezca un proveedor nuevo. Eso sería una máquina de burocracia con teclado. El disparador correcto es:

> **Pedir contexto al usuario solo cuando no exista una regla determinística suficientemente confiable para clasificar el gasto.**

### 3.2 Proveedor y concepto son cosas distintas

Hay que separar claramente:

- **Proveedor:** quién emite la factura.
- **Factura duplicada:** si ese comprobante ya existe o no.
- **Concepto del gasto:** qué representa contablemente la compra.

Ejemplo: combustible en estación A y combustible en estación B son proveedores distintos, pero pueden mapear al mismo concepto canónico de la organización.

### 3.3 La memoria contable debe vivir en dos niveles

1. **Nivel proveedor + concepto**: reglas específicas del emisor.
2. **Nivel concepto global de la organización**: reglas reutilizables entre distintos proveedores.

### 3.4 El texto del usuario no es decorado

Cuando el sistema necesite contexto adicional, debe abrir un cuadro de texto para que el usuario explique:

- qué tipo de gasto es,
- con qué finalidad se incurrió,
- a qué operación/proyecto/actividad está vinculado,
- cualquier dato útil para deducibilidad o clasificación.

Ese texto debe:

- quedar guardado como dato auditable,
- formar parte del segundo prompt a la IA,
- poder influir tanto en la clasificación contable como en la lógica de IVA.

### 3.5 La IA no debe postear asientos sola

La IA puede:

- extraer,
- sugerir,
- explicar,
- proponer un concepto,
- proponer una cuenta,
- marcar incertidumbre.

La IA **no** debe:

- crear verdad contable irreversible,
- inventar cuentas inexistentes,
- saltearse reglas determinísticas,
- resolver duplicados por fe,
- cerrar períodos.

### 3.6 El aprendizaje debe ser explícito

Cuando el usuario/reviewer aprueba una clasificación corregida o asistida, el sistema debe permitir guardar esa decisión como:

- override de documento,
- regla proveedor + concepto,
- regla global por concepto,
- default de proveedor.

Nunca debe haber autoaprendizaje silencioso.

---

## 4. Alcance del MVP

### 4.1 Incluido en MVP

- facturas de compra y venta locales,
- upload y extracción con IA,
- detección de duplicados por archivo y por identidad de negocio,
- resolución de proveedor,
- resolución de concepto contable,
- segunda llamada a IA cuando falte contexto,
- sugerencia contable balanceada,
- revisión humana,
- aprendizaje explícito de reglas,
- VAT run mensual revisable,
- cierre/reapertura de período con auditoría,
- exportación completa a Excel.

### 4.2 Fuera de alcance del MVP

- scraping legal automático,
- filing directo con DGI,
- payroll/BPS,
- conciliación bancaria,
- multi-country,
- motor completo de IRAE/IP,
- prorata compleja,
- importaciones complejas,
- API pública completa para terceros,
- integración write-back con múltiples ERPs.

---

## 5. Flujo objetivo E2E del documento

### 5.1 Flujo objetivo

1. Usuario sube documento.
2. Se guarda archivo original y se crea documento.
3. Primera pasada de IA/OCR extrae facts, cabecera y conceptos/line items.
4. Se calcula identidad de factura.
5. Se corre deduplicación:
   - binaria por `file_hash`,
   - de negocio por proveedor + número + fecha (+ total/currency cuando aplique).
6. Se resuelve proveedor.
7. Se resuelven conceptos contra memoria histórica.
8. Si la clasificación sigue sin suficiente confianza, se abre paso `accounting_context`.
9. El usuario explica el gasto en texto libre.
10. Se realiza segunda llamada a IA especializada en clasificación contable.
11. El motor determinístico construye sugerencia contable final usando precedencia de reglas.
12. Se calcula tratamiento IVA.
13. Reviewer aprueba/edita/rechaza.
14. Si aprueba, puede persistir la decisión como regla reutilizable.
15. El documento confirmado impacta VAT run del período.
16. El usuario puede exportar Excel del período con resumen, libros, asientos y trazabilidad.

### 5.2 Precedencia deseada de clasificación

1. Override manual del documento.
2. Regla activa proveedor + concepto.
3. Regla global de concepto de la organización.
4. Default del proveedor.
5. Sugerencia IA asistida con contexto del usuario.
6. Revisión manual sin aprendizaje.

---

## 6. Reglas negativas de implementación

Estas reglas son obligatorias. Si una implementación las rompe, está mal aunque “funcione”.

1. **No preguntar por contexto solo porque el proveedor sea nuevo.**
2. **No comparar conceptos únicamente por descripción cruda.** Debe existir normalización y concepto canónico.
3. **No depender solo de `amount_breakdown.label` a largo plazo.** Debe existir modelo de `line_items` o conceptos extraídos.
4. **No usar cuentas IVA hardcodeadas como solución final.** Deben salir del plan de cuentas/mapping de la organización.
5. **No auto-confirmar duplicados dudosos.** Deben bloquear confirmación o requerir resolución explícita.
6. **No dejar que la UI sea el motor contable.** La lógica vive en `modules/accounting`.
7. **No confundir export con verdad contable.** El export sale del modelo canónico aprobado.
8. **No aprender reglas sin aprobación humana.**

---

## 7. Tareas ejecutables en orden

---

## TASK-00 — Alinear identidad del repo y congelar alcance del MVP

**Objetivo**  
Eliminar la desalineación narrativa del repositorio y dejar por escrito qué entra y qué no entra en MVP.

**Cambios requeridos**

- Actualizar `README.md` para describir el producto real.
- Actualizar manualmente el “About” del repo en GitHub.
- Crear/ubicar este spec dentro de `docs/` como referencia principal de ejecución.
- Dejar un documento corto de alcance MVP Uruguay fase 1.

**Archivos / módulos tocados**

- `README.md`
- `docs/`
- configuración manual del repo en GitHub

**Dependencias**  
Ninguna.

**Done cuando**

- El repo ya no menciona “calculadora de conversiones”.
- El alcance MVP está explícito y estable.
- El equipo puede leer una sola fuente y saber qué se construye primero.

**Pruebas mínimas**

- Revisión manual de README y About.
- Validación de que alcance incluido/excluido coincide con este documento.

---

## TASK-01 — Cerrar paridad entre app, SQL canónico y migraciones

**Objetivo**  
Eliminar drift estructural antes de sumar más dominio.

**Cambios requeridos**

- Revisar contrato real de `create_organization_with_owner`.
- Alinear `app/onboarding/actions.ts`, `db/schema/` y `supabase/migrations/`.
- Asegurar que los campos fiscales que usa onboarding realmente existan en la función RPC y persistan donde corresponde.
- Correr y dejar verde la verificación de paridad de esquema.

**Archivos / módulos tocados**

- `app/onboarding/actions.ts`
- `db/schema/02_identity_and_tenants.sql`
- `supabase/migrations/*`
- `scripts/supabase/verify-schema-parity.mjs`

**Dependencias**  
TASK-00.

**Done cuando**

- `npm run db:verify:parity` pasa.
- Onboarding persiste y retorna exactamente los datos que consume la app.
- No hay contratos huérfanos entre app, SQL canónico y migraciones.

**Pruebas mínimas**

- Smoke de onboarding de organización.
- Test de RPC con payload completo: nombre, tipo legal, tax id, tax regime, vat regime, dgi group, cfe status.

---

## TASK-02 — Extraer el dominio contable fuera de `modules/documents/review.ts`

**Objetivo**  
Sacar la lógica contable del archivo de review y darle un hogar real dentro de `modules/accounting`.

**Cambios requeridos**

### Backend / módulos

Crear al menos:

- `modules/accounting/types.ts`
- `modules/accounting/repository.ts`
- `modules/accounting/normalization.ts`
- `modules/accounting/vendor-resolution.ts`
- `modules/accounting/invoice-identity.ts`
- `modules/accounting/concept-resolution.ts`
- `modules/accounting/suggestion-engine.ts`
- `modules/accounting/rule-engine.ts`
- `modules/accounting/assistant.ts`
- `modules/accounting/index.ts`

### Refactor esperado

- `modules/documents/review.ts` debe quedar como orquestador/UI mapper.
- `modules/documents/processing.ts` debe invocar servicios de dominio, no contener lógica contable de negocio dispersa.
- Debe unificarse el contrato de estados y blockers entre `processing.ts` y `review.ts`.

**Dependencias**  
TASK-01.

**Done cuando**

- La clasificación contable ya no depende de lógica embebida en la pantalla de revisión.
- Los blockers de pasos son consistentes entre procesamiento y review.
- Hay una API interna clara para pedir una sugerencia contable.

**Pruebas mínimas**

- Unit tests del motor de sugerencias.
- Test de integración: review carga sugerencia usando `modules/accounting` y no lógica inline.

---

## TASK-03 — Ampliar el contrato de intake documental para soportar identidad de factura y conceptos

**Objetivo**  
La primera pasada de IA debe extraer no solo cabecera y montos, sino también los insumos necesarios para duplicados de negocio y memoria por concepto.

**Cambios requeridos**

### Estructura deseada del output de intake

Agregar o consolidar los siguientes campos estructurados:

- `issuer_name`
- `issuer_tax_id`
- `document_number`
- `document_date`
- `currency_code`
- `subtotal_amount`
- `tax_amount`
- `total_amount`
- `document_role_candidate`
- `document_type_candidate`
- `operation_category_candidate`
- `line_items[]`

### Contrato mínimo de `line_items[]`

Cada línea debe intentar traer:

- `line_number`
- `concept_code` (si existe)
- `concept_description`
- `quantity` (si existe)
- `unit_amount` (si existe)
- `net_amount`
- `tax_rate`
- `tax_amount`
- `total_amount`

### Regla de fallback

Si el documento no permite extraer líneas razonables:

- se usa `amount_breakdown` como fallback temporal,
- pero no se considera fuente ideal para memoria contable a largo plazo.

### Persistencia

El draft debe conservar:

- raw text,
- facts,
- warnings,
- amount breakdown,
- line items,
- confidence,
- explicaciones del modelo.

**Archivos / módulos tocados**

- `modules/documents/processing.ts`
- contrato de structured output
- tablas de extracciones / drafts / field candidates
- `modules/ai/*`

**Dependencias**  
TASK-02.

**Done cuando**

- La extracción inicial ya produce identidad de factura usable.
- El sistema puede leer conceptos/artículos/servicios desde la factura.
- La falta de line items no rompe el flujo; lo degrada con fallback controlado.

**Pruebas mínimas**

- Factura con líneas explícitas.
- Factura con solo totales y sin detalle.
- PDF y JPG/PNG.
- Caso OCR ambiguo con warnings.

---

## TASK-04 — Implementar identidad de factura y deduplicación de negocio

**Objetivo**  
Evitar duplicados reales aunque el archivo sea distinto.

**Decisión de diseño**  
Mantener dos capas de dedupe:

1. **Duplicado binario** por `file_hash`.
2. **Duplicado de negocio** por identidad de factura.

**Cambios requeridos**

### Nuevo modelo recomendado

Crear `document_invoice_identities` con al menos:

- `id`
- `organization_id`
- `document_id`
- `source_draft_id`
- `vendor_id` nullable
- `issuer_tax_id_normalized`
- `issuer_name_normalized`
- `document_number_normalized`
- `document_date`
- `total_amount`
- `currency_code`
- `identity_strategy`
- `invoice_identity_key`
- `duplicate_status`
- `duplicate_of_document_id` nullable
- `duplicate_reason` nullable
- `created_at`
- `updated_at`

### Estrategias de identidad

**Primaria**

- `issuer_tax_id_normalized + document_number_normalized + document_date`

**Secundaria** (si falta tax id)

- `issuer_name_normalized + document_number_normalized + document_date + total_amount + currency_code`

### Reglas de producto

- Si `file_hash` coincide: marcar `suspected_duplicate`.
- Si identidad de negocio coincide: marcar `suspected_duplicate`.
- La confirmación debe quedar bloqueada hasta resolver el duplicado.
- El reviewer puede marcar:
  - duplicado confirmado,
  - falso positivo,
  - continuar con justificación.
- Toda resolución debe quedar auditada.

**Archivos / módulos tocados**

- `modules/accounting/invoice-identity.ts`
- `modules/documents/processing.ts`
- `modules/documents/review.ts`
- `db/schema/*`

**Dependencias**  
TASK-03.

**Done cuando**

- El sistema detecta la misma factura aunque llegue como archivo distinto.
- El sistema sigue detectando duplicado por hash cuando el archivo es idéntico.
- Un duplicado no puede confirmarse sin resolución explícita.

**Pruebas mínimas**

- Mismo PDF subido dos veces.
- Misma factura en PDF escaneado y JPG.
- Factura con mismo número pero distinto proveedor.
- Falso positivo resuelto manualmente.

---

## TASK-05 — Endurecer resolución de proveedor y defaults por proveedor

**Objetivo**  
Convertir `vendors` en una pieza operativa real del flujo contable.

**Cambios requeridos**

### Modelo de datos

Extender `vendors` o agregar soporte complementario para:

- `tax_id_normalized`
- `name_normalized`
- aliases opcionales de nombre
- índice único parcial por `organization_id + tax_id_normalized` cuando exista

### Lógica de matching

Orden de matching:

1. tax id normalizado exacto,
2. alias normalizado exacto,
3. nombre normalizado exacto,
4. candidato ambiguo para revisión manual.

### Reglas de producto

- Proveedor nuevo **no** obliga por sí mismo a pedir contexto al usuario.
- Si existe default de proveedor y no hay mejor regla, puede usarse como fallback.
- Si el vendor match es ambiguo, se debe bloquear confirmación o pedir revisión.

**Archivos / módulos tocados**

- `db/schema/03_master_data.sql`
- `modules/accounting/vendor-resolution.ts`
- UI de revisión de documento

**Dependencias**  
TASK-04.

**Done cuando**

- El mismo proveedor con variaciones de formato se resuelve como una sola entidad.
- El sistema puede usar `default_account_id` y `default_tax_profile` de proveedor como fallback controlado.
- Ambigüedad de proveedor no pasa silenciosamente.

**Pruebas mínimas**

- Mismo RUT con guiones/espacios distintos.
- Mismo proveedor con nombre OCR levemente distinto.
- Dos proveedores distintos con nombres parecidos.

---

## TASK-06 — Crear memoria de conceptos contables reutilizable entre proveedores

**Objetivo**  
Representar el “qué se compró” como concepto canónico de organización, no como texto suelto.

**Cambios requeridos**

### Modelo de datos

Crear:

#### `organization_concepts`

- `id`
- `organization_id`
- `code`
- `canonical_name`
- `description`
- `document_role` (`purchase` / `sale`)
- `default_account_id`
- `default_vat_profile_json`
- `default_operation_category`
- `is_active`
- timestamps

#### `organization_concept_aliases`

- `id`
- `organization_id`
- `concept_id`
- `vendor_id` nullable
- `alias_code_normalized` nullable
- `alias_description_normalized`
- `match_scope` (`vendor`, `organization`)
- `source` (`manual`, `learned_from_approval`, `migration`)
- timestamps

#### `document_line_items`

- `id`
- `organization_id`
- `document_id`
- `draft_id`
- `line_number`
- `raw_concept_code`
- `raw_concept_description`
- `normalized_concept_code`
- `normalized_concept_description`
- `net_amount`
- `tax_rate`
- `tax_amount`
- `total_amount`
- `matched_concept_id` nullable
- `match_strategy`
- `match_confidence`
- `requires_user_context`
- timestamps

### Lógica de matching de conceptos

Orden recomendado:

1. alias proveedor + código exacto,
2. alias proveedor + descripción normalizada exacta,
3. alias global + código exacto,
4. alias global + descripción normalizada exacta,
5. matching semántico controlado,
6. sin match confiable.

### Regla clave

Dos proveedores distintos pueden terminar en el mismo `organization_concept`.

**Archivos / módulos tocados**

- `db/schema/*`
- `modules/accounting/concept-resolution.ts`
- `modules/accounting/normalization.ts`

**Dependencias**  
TASK-05.

**Done cuando**

- “Combustible” comprado a diferentes proveedores puede mapear al mismo concepto canónico.
- El sistema ya no depende solo de `description` cruda.
- Cada línea o concepto extraído puede quedar asociado a un concepto reusable.

**Pruebas mínimas**

- Combustible en estación A vs estación B.
- Mismo concepto con descripciones OCR levemente distintas.
- Conceptos distintos en un mismo proveedor.

---

## TASK-07 — Agregar paso `accounting_context` al workflow de revisión

**Objetivo**  
Capturar el contexto fino del gasto cuando la clasificación no sea suficientemente confiable.

**Cambios requeridos**

### Nuevo paso del draft

Insertar `accounting_context` entre `operation_context` y `journal`.

### Nueva tabla sugerida

`document_accounting_contexts`:

- `id`
- `organization_id`
- `document_id`
- `draft_id`
- `status`
- `reason_codes[]`
- `user_free_text`
- `structured_context_json`
- `ai_request_payload_json`
- `ai_response_json`
- `created_by`
- `updated_by`
- timestamps

### Razones válidas para requerir contexto

- concepto sin match confiable,
- proveedor ambiguo,
- concepto nuevo sin regla aplicable,
- posible tratamiento IVA dependiente de operación,
- múltiples cuentas candidatas sin suficiente separación,
- low confidence general.

### UX mínima

Mostrar un cuadro de texto con prompt guía, por ejemplo:

> Explicá qué tipo de gasto es, con qué finalidad se incurrió, a qué operación/proyecto/actividad está vinculado y cualquier otro dato útil para clasificarlo contable y fiscalmente.

**Regla de producto**

- Si el contexto no es necesario, el paso queda en `not_required` o equivalente.
- Si es necesario, la confirmación permanece bloqueada hasta recibir contexto o until reviewer resuelva manualmente.

**Archivos / módulos tocados**

- `modules/documents/review.ts`
- UI de workspace de documento
- `document_draft_steps`
- `modules/accounting/*`

**Dependencias**  
TASK-06.

**Done cuando**

- El sistema sabe pedir contexto solo cuando hace falta.
- El texto del usuario queda guardado, visible y auditable.
- El flujo de pasos ya no tiene blockers fantasma desalineados.

**Pruebas mínimas**

- Documento bien clasificado sin necesidad de contexto.
- Documento ambiguo que dispara el cuadro de texto.
- Documento con contexto agregado y re-cálculo posterior.

---

## TASK-08 — Implementar segunda llamada a IA especializada en clasificación contable

**Objetivo**  
Hacer una segunda pasada con IA solo cuando falte contexto o no haya regla suficientemente confiable.

**Cambios requeridos**

### Nuevo servicio

Crear `modules/accounting/assistant.ts` con una interfaz tipo:

```ts
export type AccountingAssistantInput = {
  organizationId: string;
  documentId: string;
  vendor: ResolvedVendor | null;
  invoiceIdentity: InvoiceIdentityResult;
  extractedFacts: DocumentFacts;
  lineItems: ExtractedLineItem[];
  candidateConcepts: CandidateConcept[];
  userContextText: string;
  allowedAccounts: PostableAccount[];
  allowedConcepts: OrganizationConcept[];
  priorApprovedExamples: PriorApprovalExample[];
  fiscalProfileSummary: FiscalProfileSummary;
};

export type AccountingAssistantOutput = {
  suggestedConceptId: string | null;
  suggestedAccountId: string | null;
  suggestedOperationCategory: string | null;
  linkedOperationType: string | null;
  vatContextHint: string | null;
  confidence: number;
  rationale: string;
  reviewFlags: string[];
  shouldBlockConfirmation: boolean;
};
```

### Reglas de guardrail

- La IA solo puede elegir entre cuentas/conceptos permitidos o devolver `null`.
- Si no hay suficiente confianza, debe devolver bloqueo explícito.
- El prompt debe incluir el texto libre del usuario.
- Deben guardarse hash del prompt, provider, modelo y respuesta estructurada.

### Provider abstraction mínima

Aunque el MVP use OpenAI, la integración debe pasar por una interfaz interna. No más hardcode desparramado como maleza digital.

**Dependencias**  
TASK-07.

**Done cuando**

- La segunda llamada no corre si una regla determinística ya resolvió el caso.
- Corre solo en casos ambiguos.
- Devuelve output estructurado y validado.
- El reviewer puede ver la explicación y los flags.

**Pruebas mínimas**

- Caso resuelto sin segunda IA.
- Caso ambiguo que dispara segunda IA.
- Fallo del provider con fallback a review manual.
- IA intentando devolver cuenta no permitida -> rechazo por validación.

---

## TASK-09 — Implementar motor determinístico de sugerencia contable con precedencia explícita

**Objetivo**  
Construir la sugerencia contable final desde reglas y mappings, no desde lógica dispersa en review.

**Cambios requeridos**

### Precedencia obligatoria

1. override manual del documento,
2. regla proveedor + concepto,
3. regla global de concepto,
4. default de proveedor,
5. output de segunda IA,
6. bloqueo para revisión manual.

### Reglas de construcción del asiento

- Solo usar cuentas postables.
- Nunca inventar códigos de cuenta.
- La sugerencia debe quedar balanceada.
- Las líneas deben incluir `provenance`.
- Debe existir explicación legible para reviewer.

### Cambio crítico

Eliminar la dependencia final de cuentas fijas hardcodeadas para IVA/contrapartida en la sugerencia contable. Todo debe venir de plan de cuentas/mappings de la organización.

### Persistencia recomendada

Mantener una representación canónica de sugerencia, con versión activa y trazabilidad de origen.

**Archivos / módulos tocados**

- `modules/accounting/suggestion-engine.ts`
- `modules/accounting/rule-engine.ts`
- `modules/documents/review.ts`
- tablas de suggestions / draft snapshots según diseño final

**Dependencias**  
TASK-08.

**Done cuando**

- El sistema genera asientos balanceados para casos MVP soportados.
- La UI puede mostrar de dónde salió cada línea.
- Si falta una cuenta o mapping, el sistema bloquea con razón explícita.

**Pruebas mínimas**

- Compra local estándar.
- Venta local estándar.
- Concepto conocido con proveedor nuevo.
- Concepto nuevo con contexto de usuario.
- Cuenta faltante -> bloqueo.

---

## TASK-10 — Persistir aprendizaje y reglas reutilizables tras la aprobación

**Objetivo**  
Convertir correcciones aprobadas en memoria contable explícita y reutilizable.

**Cambios requeridos**

### Modelo sugerido

Crear o extender una tabla de reglas contables con:

- `id`
- `organization_id`
- `scope` (`document_override`, `vendor_concept`, `concept_global`, `vendor_default`)
- `vendor_id` nullable
- `concept_id` nullable
- `document_role`
- `account_id`
- `vat_profile_json`
- `priority`
- `source` (`manual`, `learned_from_approval`)
- `created_by`
- `approved_by`
- `is_active`
- timestamps

### UX requerida

Al aprobar una clasificación editada o asistida, ofrecer:

- guardar solo este documento,
- guardar para este proveedor + este concepto,
- guardar para este concepto en toda la organización,
- actualizar default del proveedor.

### Snapshotting

Las reglas activas deben formar parte del snapshot usado por el procesamiento/revisión para mantener auditabilidad temporal.

**Dependencias**  
TASK-09.

**Done cuando**

- Una aprobación puede transformarse en regla reutilizable.
- La regla queda auditada y con scope explícito.
- Procesamientos futuros ya consumen esa memoria.

**Pruebas mínimas**

- Aprobar combustible proveedor A y guardar como concepto global.
- Subir combustible proveedor B y verificar reutilización.
- Aprobar regla específica solo para proveedor telecom.

---

## TASK-11 — Endurecer el motor IVA Uruguay para el MVP usable

**Objetivo**  
Pasar de soporte inicial a liquidación mensual revisable y defendible dentro del alcance MVP.

**Cambios requeridos**

### Casos mínimos soportados

- compras locales gravadas deducibles,
- compras locales no deducibles básicas,
- ventas gravadas 22%,
- ventas gravadas 10%,
- exentas / no gravadas básicas,
- notas de crédito simples,
- aggregation mensual.

### Relación con contexto

El motor IVA debe poder usar:

- concepto contable resuelto,
- texto/contexto estructurado del usuario,
- hints de linked operation,
- reglas activas del período.

### Regla importante

Cuando el tratamiento IVA dependa del vínculo con la operación y falte contexto suficiente, el caso debe quedar bloqueado o en `needs_review`, no “resuelto” con aire y entusiasmo.

### Datos de salida

Cada línea relevante debe quedar con tax tag estructurado, no inferido al vuelo al exportar.

**Archivos / módulos tocados**

- `modules/tax/*`
- `modules/accounting/*`
- UI de Tax y review

**Dependencias**  
TASK-10.

**Done cuando**

- El motor IVA usa contexto real del documento y no solo un guess superficial.
- Los documentos no deducibles quedan separados del crédito recuperable.
- Los blockers de IVA son explícitos.

**Pruebas mínimas**

- Compra gravada deducible.
- Compra gravada no deducible.
- Transporte vinculado a operación exenta.
- Documento con contexto faltante -> bloqueo.

---

## TASK-12 — Implementar lifecycle de período IVA: abierto, revisado, finalizado, locked, reopen

**Objetivo**  
Cerrar el circuito del período mensual para que la liquidación sea operable.

**Cambios requeridos**

### Estados mínimos

- `draft`
- `needs_review`
- `reviewed`
- `finalized`
- `locked`

### Reglas de negocio

- Mientras el período esté abierto, los cambios en documentos pueden regenerar VAT run.
- Un período finalizado puede pasar a locked.
- Un período locked no admite mutaciones rutinarias.
- Reabrir requiere acción explícita y auditoría.
- Si cambia un documento ya impactado en período cerrado, debe bloquear o exigir reapertura.

### UI mínima

- ver resumen por período,
- ver documentos incluidos,
- ver flags de revisión,
- finalizar,
- bloquear,
- reabrir con motivo.

**Archivos / módulos tocados**

- `modules/tax/vat-runs.ts`
- `app/app/o/[slug]/tax/*`
- tablas de `vat_runs` y auditoría

**Dependencias**  
TASK-11.

**Done cuando**

- Existe un ciclo de vida claro del período.
- Cambios posteriores no corrompen un período cerrado.
- Reapertura queda auditada.

**Pruebas mínimas**

- Confirmar documento en período abierto.
- Finalizar período.
- Intentar editar documento de período locked.
- Reabrir con motivo y recalcular.

---

## TASK-13 — Implementar `modules/exports` y exportación Excel del MVP

**Objetivo**  
Generar un informe exportable a Excel desde el modelo canónico aprobado.

**Cambios requeridos**

### Nuevo módulo

Crear:

- `modules/exports/types.ts`
- `modules/exports/repository.ts`
- `modules/exports/excel-workbook.ts`
- `modules/exports/jobs.ts`
- `modules/exports/index.ts`

### Job lifecycle mínimo

- `queued`
- `generating`
- `generated`
- `downloaded`
- `failed`
- `expired`

### Tecnología sugerida

Agregar librería de generación Excel para Node/TS (por ejemplo `exceljs`).

### Workbook mínimo del MVP

#### Hoja 1 — Resumen ejecutivo

- organización
- período
- cantidad de documentos
- base imponible compras
- base imponible ventas
- IVA débito
- IVA crédito
- IVA no deducible
- neto IVA del período
- warnings / exceptions count

#### Hoja 2 — Libro compras

- fecha
- proveedor
- RUT proveedor
- número de factura
- concepto principal
- base
- IVA
- total
- estado deducibilidad
- observaciones

#### Hoja 3 — Libro ventas

- fecha
- cliente
- número de comprobante
- base
- IVA
- total
- tasa
- observaciones

#### Hoja 4 — Asientos contables

- fecha
- número o referencia de documento
- cuenta
- descripción cuenta
- debe
- haber
- provenance

#### Hoja 5 — Trazabilidad y revisión

- documento
- proveedor resuelto
- duplicado detectado sí/no
- concept match strategy
- confidence
- reviewer
- fecha aprobación
- regla aplicada
- flags

### Reglas de producto

- Export solo desde datos aprobados o formalmente incluidos en el período.
- El Excel no debe “inventar” información faltante.
- Si el modelo canónico está incompleto, el export debe fallar con validación explícita.

**Archivos / módulos tocados**

- `package.json`
- `modules/exports/*`
- UI de Tax y/o Journal Entries
- Storage privado para artifacts

**Dependencias**  
TASK-12.

**Done cuando**

- El usuario puede generar y descargar un Excel del período.
- Los totales del workbook reconcilian con VAT run y asientos aprobados.
- El artifact queda almacenado de forma privada.

**Pruebas mínimas**

- Generación de Excel con período con compras y ventas.
- Validación de totales entre hojas.
- Export fallando por datos incompletos.
- Descarga con signed URL o flujo equivalente seguro.

---

## TASK-14 — Pruebas automáticas, observabilidad y CI del núcleo de negocio

**Objetivo**  
Blindar el MVP donde realmente duele: clasificación, duplicados, IVA y exportación.

**Cambios requeridos**

### Test runner

Agregar runner de tests y script estándar (`npm test`).

### Cobertura mínima obligatoria

#### Unit

- normalización de tax id/nombres,
- invoice identity keys,
- matching de proveedor,
- matching de concepto,
- precedencia de reglas,
- construcción de asientos balanceados,
- tagging IVA.

#### Integración

- upload -> extracción -> dedupe -> review,
- concepto nuevo -> contexto usuario -> segunda IA -> sugerencia,
- aprobación -> aprendizaje -> reprocesamiento futuro,
- VAT run mensual,
- export Excel.

#### Smoke / CI

Mantener y extender:

- parity DB,
- organization onboarding,
- private dashboard,
- document upload,
- flujo base de documento hasta confirmación,
- export generado.

### Observabilidad mínima

Registrar:

- latencia de primera IA,
- latencia de segunda IA,
- documentos con contexto requerido,
- duplicates detectados,
- false positives,
- reglas aprendidas,
- VAT runs finalizados,
- exports fallidos.

**Dependencias**  
TASK-13.

**Done cuando**

- Existe `npm test`.
- El pipeline CI corre lint + typecheck + tests + parity.
- El equipo puede detectar regresiones del dominio antes de producir desastres simpáticos.

**Pruebas mínimas**

- Suite verde completa.
- Fixtures representativos de compras/ventas UY.
- Fixture de combustible multivendor.
- Fixture de duplicado de negocio.

---

## 8. Orden de ejecución resumido

1. TASK-00 — identidad y alcance.
2. TASK-01 — paridad app/DB/migrations.
3. TASK-02 — extraer dominio accounting.
4. TASK-03 — ampliar intake documental.
5. TASK-04 — invoice identity + dedupe de negocio.
6. TASK-05 — resolución robusta de proveedor.
7. TASK-06 — memoria de conceptos canónicos.
8. TASK-07 — paso `accounting_context` en review.
9. TASK-08 — segunda IA especializada.
10. TASK-09 — motor determinístico de sugerencia contable.
11. TASK-10 — aprendizaje explícito tras aprobación.
12. TASK-11 — endurecer IVA UY.
13. TASK-12 — lifecycle de período.
14. TASK-13 — exports Excel.
15. TASK-14 — tests, observabilidad y CI.

---

## 9. Definición de éxito del MVP

El MVP se considera logrado cuando, para un conjunto representativo de facturas de compra y venta locales Uruguay:

1. el documento puede subirse y procesarse,
2. el sistema detecta duplicados binarios y de negocio,
3. el proveedor se resuelve correctamente,
4. el concepto puede reutilizar memoria entre proveedores,
5. los casos ambiguos piden contexto solo cuando hace falta,
6. la segunda IA sugiere clasificación útil y auditable,
7. el motor determinístico genera asientos balanceados,
8. el reviewer puede aprobar y guardar reglas reutilizables,
9. el VAT run mensual refleja IVA crédito/débito/no deducible de forma revisable,
10. el período puede cerrarse y reabrirse con auditoría,
11. el sistema exporta un Excel completo y consistente.

---

## 10. Referencias del repo que motivan este spec

Rutas y módulos relevantes observados en el repo actual:

- `README.md`
- `docs/doc_business_logic.md`
- `docs/doc_project_architecture.md`
- `docs/doc_VAT_support.md`
- `docs/doc_export_API_ready_architecture.md`
- `middleware.ts`
- `app/onboarding/actions.ts`
- `modules/documents/processing.ts`
- `modules/documents/review.ts`
- `modules/accounting/README.md`
- `db/schema/03_master_data.sql`
- `app/app/o/[slug]/tax/page.tsx`
- `package.json`

---

## 11. Nota final de implementación

La idea central no es “meter otro prompt”. La idea es construir una **memoria contable auditable** con cuatro piezas claras:

1. identidad de factura,
2. resolución de proveedor,
3. resolución de concepto,
4. contexto de negocio cuando haga falta.

La IA entra como asistente de clasificación. El sistema aprende solo cuando un humano lo autoriza. Y el resultado final sale por un motor determinístico y exportable.

Ahí está la diferencia entre una demo encantadora y un producto serio.
