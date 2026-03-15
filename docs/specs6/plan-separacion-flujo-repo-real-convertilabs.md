# Plan detallado para separar el flujo en bloques independientes (repo real de Convertilabs)

## 0. Objetivo de este documento

Este documento baja a tierra, sobre el **estado real actual del repo**, una refactorización por bloques para que el flujo deje de depender de una confirmación demasiado acoplada y pase a ser un pipeline explícito, trazable y fácil de operar.

La meta no es "romper todo y rehacerlo". La meta es:

- reutilizar lo que ya está bien hecho,
- separar acciones con efectos distintos,
- dejar cada paso con **input / output / estado / warnings / retry**,
- evitar reruns de IA innecesarios,
- mostrar siempre al usuario **por qué** el sistema decidió algo,
- permitir **posteo provisional**, **aprendizaje explícito**, **preview contable**, **VAT run de prueba** y **reapertura/manual remap** sin volver a correr IA si no hace falta.

---

## 1. Lo que ya existe hoy en el repo y conviene reutilizar

### 1.1. Fundaciones ya implementadas

No partimos de cero. El repo ya tiene varias piezas que sirven muchísimo para esta separación:

- **Onboarding con perfil de negocio + presets**
  - ya existen `primaryActivityCode`, `secondaryActivityCodes`, `selectedTraits`, `shortBusinessDescription`, `planSetupMode` y `selectedPresetComposition`.
  - ya existe aplicación de preset recomendado/alternativo/importado/minimal-temp.

- **Pasos persistidos de draft**
  - ya existe `document_draft_steps` con snapshots por paso:
    - `identity`
    - `fields`
    - `amounts`
    - `operation_context`
    - `accounting_context`
    - `journal`
    - `tax`
    - `confirmation`

- **Estados de posteo**
  - ya existe `posting_status` con:
    - `draft`
    - `vat_ready`
    - `posted_provisional`
    - `posted_final`
    - `locked`

- **Motor de reglas contables ya bastante avanzado**
  - hoy existen scopes:
    - `document_override`
    - `vendor_concept`
    - `concept_global`
    - `vendor_default`
  - además ya existe resolución con prioridad y `provenance`.

- **Review ya soporta reapertura y posteo provisional**
  - ya hay soporte para `post_provisional` y `reopen` en la UI/acciones.

- **Preview técnico ya disponible en datos derivados**
  - el `workspace` ya recibe:
    - `appliedRule`
    - `journalSuggestion`
    - `canPostProvisional`
    - `canConfirmFinal`
    - `postingStatus`

- **VAT runs ya leen documentos `posted_provisional` y `posted_final`**
  - eso es muy importante: el carril provisional ya existe en la base de la lógica fiscal.

- **Módulo de explicaciones ya existe**
  - hay un `modules/explanations/decision-comment-builder.ts` que conviene usar para comentarios `?`, tooltips, paneles “por qué el sistema decidió esto”.

### 1.2. El problema real hoy

El problema no es “falta de piezas”.

El problema es que todavía hay demasiada lógica encadenada dentro de la experiencia de review/confirmación, especialmente en `modules/documents/review.ts`, donde se mezclan demasiado:

- persistencia de artefactos contables,
- creación de reglas,
- sync de open items,
- rebuild de VAT run,
- snapshots,
- y cierre del documento.

Eso vuelve difícil:

- entender en qué punto falló el flujo,
- explicar al usuario qué pasó,
- reintentar sólo una parte,
- reabrir un documento sin reprocesar IA,
- y probar el sistema con masividad sin disparar costos de IA innecesarios.

### 1.3. Bug/issue de identidad que hay que arreglar ya

La organización **ya es una entidad separada del usuario** en el modelo actual (`organizations` + `organization_members`).

O sea: conceptualmente vas bien.

El bug actual no es de modelo conceptual, sino de identidad/constraints:

- hoy la RPC `create_organization_with_owner(...)` **no está frenando unicidad por `tax_id` / RUT**;
- sólo valida que el usuario no pertenezca a otra organización activa.

Por eso te dejó crear la misma empresa con otro usuario.

Esto hay que corregir **antes** de seguir metiendo producto arriba, porque si la identidad organizacional está floja todo lo demás se vuelve barro.

---

## 2. Arquitectura objetivo: separar el flujo en bloques explícitos

La idea central es esta:

> cada bloque hace una sola cosa, persiste su resultado, puede mostrar warnings propios, y no dispara efectos colaterales innecesarios de otros bloques.

### Bloques propuestos

1. **Bloque A — Ingesta y extracción IA**
2. **Bloque B — Validación factual / normalización**
3. **Bloque C — Cola “Procesados pendientes de asignación”**
4. **Bloque D — Clasificación contable asistida**
5. **Bloque E — Resolución de regla aplicada / explainability**
6. **Bloque F — Aprendizaje / creación de reglas**
7. **Bloque G — Preview de impacto contable y fiscal**
8. **Bloque H — Posteo provisional**
9. **Bloque I — Confirmación final**
10. **Bloque J — VAT run de prueba**
11. **Bloque K — VAT run definitivo**
12. **Bloque L — Reapertura y remapeo manual sin rerun de IA**

La regla de oro del rediseño:

- **ingesta ≠ clasificación**
- **clasificación ≠ aprendizaje**
- **aprendizaje ≠ posteo**
- **posteo ≠ VAT run definitivo**

---

## 3. Bloque por bloque: definición funcional + técnica

---

## 3.A. Bloque A — Ingesta y extracción IA

### Objetivo

Recibir el documento y extraer hechos brutos.

### Qué entra

- PDF / imagen / ZIP / lote
- organización
- usuario
- metadata de upload

### Qué sale

- `document`
- `document_draft`
- facts extraídos
- amount breakdown
- line items si existen
- snapshots iniciales de steps (`identity`, `fields`, `amounts`)

### Qué no debe hacer

- no clasifica contablemente,
- no crea reglas,
- no postea,
- no toca VAT run.

### Estado visible al usuario

- `Procesando documento`
- `Documento extraído`
- `Error de extracción`

### Warnings visibles

- OCR/lectura baja confianza
- faltan montos claves
- emisor/RUT no confiable
- moneda detectada con baja confianza

### Qué reutilizar

- pipeline de ingestion actual
- `document_draft_steps`
- contrato de intake existente

### Tareas para Codex

1. Revisar el pipeline actual de ingestión y asegurarse de que sólo termine con estado “extraído”.
2. Confirmar que no haya side effects contables o fiscales en esta etapa.
3. Si hoy los hay, moverlos a bloques posteriores.
4. Asegurar idempotencia por documento/subida.
5. Registrar métricas:
   - tiempo de extracción,
   - error rate,
   - confianza promedio.

---

## 3.B. Bloque B — Validación factual / normalización

### Objetivo

Revisar y normalizar lo que salió de IA antes de meterse con contabilidad.

### Qué entra

- facts extraídos
- amount breakdown
- line items

### Qué sale

- facts confirmados/ajustados
- identidad documental estable
- moneda estable
- tipo de cambio fiscal sugerido/guardado si aplica
- step snapshots actualizados

### Qué no debe hacer

- no elegir cuentas,
- no crear reglas,
- no generar journal.

### UI sugerida

Rail o cards por subpaso:

- Identidad del documento
- Emisor / RUT
- Fechas
- Moneda y tipo de cambio
- Importes
- Líneas / conceptos

### Comentarios `?` recomendados

- **Moneda original**: “Es la moneda en la que fue emitido el documento.”
- **Tipo de cambio fiscal**: “Se usará para convertir a UYU cuando el documento esté en USD u otra moneda extranjera y el impuesto deba liquidarse en pesos.”
- **Identidad del documento**: “Sirve para detectar duplicados y trazabilidad.”

### Tareas para Codex

1. Separar la UI factual del bloque de clasificación contable.
2. Mantener persistencia por step (`identity`, `fields`, `amounts`).
3. Agregar warnings explícitos de duplicado, inconsistencia de montos, RUT dudoso, falta de impuesto discriminado.
4. Guardar el tipo de cambio fiscal como dato propio del documento cuando corresponda.
5. No permitir que este bloque dispare clasificaciones en background sin acción explícita del usuario o auto-run controlado.

---

## 3.C. Bloque C — Cola “Procesados pendientes de asignación”

### Objetivo

Crear una cola separada y visible de documentos ya extraídos, pero todavía no asignados contablemente.

### Por qué importa

Porque esta cola hace visible el corte real entre:

- “la IA ya leyó el documento”
- “todavía no decidimos cómo entra en la contabilidad”

### Estado derivado sugerido

No crearía otro gran status duro duplicado si se puede evitar.

Haría una **vista derivada o helper service** que clasifique documentos en:

- `pending_factual_review`
- `pending_assignment`
- `pending_learning_decision`
- `ready_for_provisional_posting`
- `posted_provisional`
- `ready_for_final_confirmation`
- `posted_final`
- `reopened_needs_manual_remap`

### Tareas para Codex

1. Crear `modules/documents/workflow-state.ts`.
2. Ese módulo debe derivar la “cola” de cada documento usando:
   - `document_draft_steps`
   - `posting_status`
   - `derived.validation`
   - `appliedRule`
   - `journalSuggestion`
3. Crear página/listado “Documentos procesados pendientes de asignación”.
4. Incluir filtros:
   - organización
   - período
   - proveedor
   - moneda
   - con/sin regla aplicada
   - con/sin cuenta provisional
   - con warning geográfico
   - con warning fiscal

---

## 3.D. Bloque D — Clasificación contable asistida

### Objetivo

Tomar un documento ya procesado y correr la clasificación contra:

- plan de cuentas existente,
- reglas existentes,
- contexto extra del usuario,
- hints fiscales,
- templates/journals.

### Qué entra

- facts ya confirmados
- cuentas postables existentes
- tax profiles
- active rules
- contexto extra del usuario (`userFreeText`, `businessPurposeNote`)
- hints de razonabilidad (por ejemplo geografía)

### Qué sale

- sugerencia contable
- cuenta propuesta
- operación propuesta
- template/journal sugerido
- regla aplicada si hubo
- o necesidad de revisión manual

### Qué no debe hacer

- no crear regla todavía,
- no cerrar el documento,
- no disparar VAT run.

### Qué reutilizar

- `modules/accounting/suggestion-engine.ts`
- `modules/accounting/rule-engine.ts`
- `modules/accounting/journal-builder.ts`
- `modules/accounting/assistant.ts`

### Tareas para Codex

1. Crear `modules/accounting/classification-runner.ts`.
2. Mover a ese módulo la orquestación de “segunda IA + reglas + allowed accounts + templates”.
3. Hacer que devuelva un `classification_result` explícito y persistible.
4. Crear tabla nueva `document_assignment_runs` con:
   - `id`
   - `organization_id`
   - `document_id`
   - `draft_id`
   - `triggered_by_user_id`
   - `status` (`started`, `completed`, `failed`, `stale`)
   - `request_payload_json`
   - `response_json`
   - `selected_account_id`
   - `selected_operation_category`
   - `selected_template_code`
   - `selected_tax_profile_code`
   - `confidence`
   - `provider_code`
   - `model_code`
   - `latency_ms`
   - `created_at`
5. Si no querés tabla nueva en esta iteración, persistirlo primero en `document_accounting_contexts.ai_request_payload_json` / `ai_response_json`, pero mi recomendación es tabla separada.
6. Exponer acción “Clasificar ahora” separada de “Confirmar”.
7. Exponer estado “Última clasificación ejecutada / falló / necesita contexto / lista para revisión”.

### UX obligatoria

Después de correr clasificación, el usuario debe ver una tarjeta:

- **Cuenta propuesta**
- **Tipo de operación**
- **Tax profile sugerido**
- **Template sugerido**
- **Confianza**
- **Qué faltó / por qué quedó trabado**

---

## 3.E. Bloque E — Regla aplicada / explainability

### Objetivo

Mostrarle al usuario **por qué** la factura quedó clasificada así.

Este bloque es clave para confianza.

### Qué reutilizar

El repo ya tiene los datos base para esto:

- `appliedRule.scope`
- `appliedRule.provenance`
- `appliedRule.priority`
- `appliedRule.accountCode`
- `appliedRule.accountName`
- `appliedRule.status`
- `appliedRule.taxProfileCode`
- `appliedRule.templateCode`

### Qué falta

Hacerlo visible y entendible.

### UI recomendada

Card fija “Regla aplicada” con:

- **Qué regla ganó**
- **Qué otras reglas fueron consideradas** (opcional)
- **Qué datos dispararon esa regla**
- **Qué impacto tuvo**
- botón `Cambiar criterio`
- botón `Guardar nueva regla`

### Comentarios `?` recomendados

- **Regla aplicada**: “Es el criterio automático que el sistema usó para asignar esta factura.”
- **Scope**: “Define si la regla aplica a este proveedor, a este concepto, o a ambos.”
- **Provenance**: “Indica de dónde salió la decisión: regla existente, manual override o asistente.”
- **Prioridad**: “Si varias reglas podrían aplicar, gana la de mayor prioridad.”

### Tareas para Codex

1. Crear `modules/accounting/rule-explainer.ts`.
2. Ese módulo recibe `ResolvedAccountingRule + contexto del draft`.
3. Devuelve un objeto UI-ready:
   - `title`
   - `summary`
   - `matchedPredicates`
   - `impactSummary`
   - `riskNotes`
   - `canOverride`
4. Crear componente `components/documents/rule-application-card.tsx`.
5. Integrarlo de forma visible en el workspace.
6. Si no hay regla aplicada, mostrar explícitamente:
   - “No se aplicó ninguna regla reusable; esta clasificación depende de revisión manual o del asistente.”

---

## 3.F. Bloque F — Aprendizaje / creación de reglas

### Objetivo

Separar la decisión de “guardar esto como aprendizaje reusable” del acto de confirmar el documento.

### Estado actual real

Hoy ya existen sugerencias de aprendizaje con scopes:

- `vendor_concept`
- `concept_global`
- `vendor_default`

Además existe `document_override`, pero ese no es reusable globalmente; es una corrección puntual del documento.

### Qué sugiero agregar como nuevo scope

### Nuevo scope a implementar ahora: `vendor_concept_operation_category`

Este es el mejor siguiente paso porque:

- es más preciso que `vendor_concept`,
- se apoya en datos que ya tenés,
- no depende todavía de line item extraction perfecta,
- evita errores donde el mismo proveedor/concepto cae distinto según el tipo de operación.

Ejemplo:

- Proveedor: mismo proveedor de transporte
- Concepto: “flete”
- Operación: `transport` vs `import_cost` vs `sale_delivery`

Con eso separás mucho mejor el destino contable.

### Scope futuro opcional: `vendor_item`

Implementarlo más adelante cuando la extracción de líneas/artículos esté estable.

### Scopes finales recomendados

- `document_override`
- `vendor_concept`
- `vendor_concept_operation_category`
- `concept_global`
- `vendor_default`
- futuro: `vendor_item`

### UI recomendada

Bloque “Guardar criterio para próximas facturas” con opciones:

1. **Sólo esta factura** (no crea regla reusable)
2. **Todas las facturas de este proveedor con este concepto**
3. **Todas las facturas de este proveedor con este concepto y este tipo de operación**
4. **Todas las facturas de este concepto aunque cambie el proveedor**
5. **Usar esta cuenta por defecto para este proveedor**
6. futuro: **Usar esta cuenta para este artículo/SKU**

### Tareas para Codex

1. Extender enum/scope en `modules/accounting/types.ts`.
2. Extender `learning-suggestions.ts` para sugerir `vendor_concept_operation_category` cuando haya `operationCategory` confiable.
3. Extender `rule-engine.ts` para resolver en esta prioridad:
   1. `document_override`
   2. `vendor_concept_operation_category`
   3. `vendor_concept`
   4. `concept_global`
   5. `vendor_default`
   6. `assistant`
   7. `manual_review`
4. Crear `modules/accounting/learning-approval-service.ts`.
5. Mover la creación de regla fuera de la confirmación final.
6. La UI debe mostrar un CTA explícito:
   - `Guardar criterio`
   - `Guardar sólo para este proveedor`
   - `Guardar para este concepto`
7. Registrar quién aprobó la regla y sobre qué documento.

### Importante

La factura puede quedar bien clasificada y posteada **sin que el usuario todavía cree una regla reusable**.

Ese desacople baja fricción muchísimo.

---

## 3.G. Bloque G — Preview de impacto contable y fiscal

### Objetivo

Mostrar al usuario, antes de postear, a qué cuentas va la factura y qué impacto produce.

### Respuesta corta a tu pregunta

Sí, **se puede y se debe hacer**.

Y de hecho parte de la data ya existe en `journalSuggestion`.

### Qué debe mostrar el preview

#### Vista mínima

- cuenta principal asignada
- cuenta de IVA
- cuenta de contraparte
- si alguna es provisional
- moneda
- tipo de cambio fiscal usado
- balance del asiento (debe/haber)

#### Vista experta

- líneas del journal
- tax profile aplicado
- si genera open item
- si impacta en IVA compras o ventas
- si el IVA quedó:
  - directo
  - indirecto
  - no deducible
  - en suspenso
  - importación / anticipo
- warnings:
  - cuenta provisional
  - falta de business purpose
  - warning geográfico
  - impuesto no deducible

### UI recomendada

Componente `AccountingImpactPreview` con tabs:

- **Asiento**
- **IVA**
- **Cobros/Pagos**
- **Warnings**

### Tareas para Codex

1. Crear `modules/accounting/accounting-impact-preview.ts`.
2. Transformar `journalSuggestion + taxTreatment + appliedRule` en un payload amigable.
3. Crear componente `components/documents/accounting-impact-preview.tsx`.
4. Hacerlo visible inmediatamente después de la clasificación.
5. Si el asiento no está listo, mostrar qué falta exactamente.

### Comentarios `?` recomendados

- **Cuenta principal**: “Es la cuenta que representa el gasto, ingreso, activo o costo principal de esta factura.”
- **Contraparte**: “Es la cuenta que equilibra el asiento, normalmente proveedor, cliente o banco.”
- **Cuenta provisional**: “Sirve para no bloquear la operación mientras todavía no definís la cuenta final.”
- **Impacto IVA**: “Resume si el impuesto entra como crédito, débito o queda excluido/no deducible.”

---

## 3.H. Bloque H — Posteo provisional

### Objetivo

Permitir avanzar operativamente sin exigir perfección contable final.

### Cuándo entra

Cuando:

- el documento ya está suficientemente validado,
- el treatment fiscal está listo,
- el journal existe,
- pero alguna cuenta es provisional o la clasificación todavía no está finalizada del todo.

### Qué hace

- persiste artefactos contables mínimos,
- deja documento en `posted_provisional`,
- habilita que el documento entre en previews fiscales y VAT preview,
- **sin** crear todavía una regla reusable obligatoria,
- **sin** bloquear re-clasificación posterior.

### Qué no debería hacer automáticamente

- no debería crear regla approved por defecto,
- no debería disparar VAT run definitivo automáticamente,
- no debería cerrar para siempre la revisión.

### Tareas para Codex

1. Crear servicio explícito `modules/documents/post-provisional-service.ts`.
2. Mover la lógica de posteo provisional fuera del “confirm final”.
3. Asegurar que el servicio:
   - persista journal draft/posted provisional,
   - sincronice open items sólo si corresponde,
   - no cree aprendizaje approved automáticamente,
   - no lance rebuild definitivo de VAT run.
4. Mantener botón “Postear provisional” visible sólo si `canPostProvisional = true`.

---

## 3.I. Bloque I — Confirmación final

### Objetivo

Cerrar la imputación final del documento.

### Cuándo entra

Cuando:

- ya no quedan cuentas provisionales, o el usuario decide finalizar igual bajo política permitida,
- el journal está balanceado,
- el tratamiento fiscal está claro,
- el usuario ya vio el impacto.

### Qué hace

- cambia a `posted_final`,
- deja auditoría final,
- puede promover aprendizaje approved,
- deja el documento listo para reportes definitivos.

### Qué debe dejar de hacer

No debe seguir siendo el “botón mágico que hace todo”.

### Tareas para Codex

1. Crear `modules/documents/confirm-final-service.ts`.
2. El servicio sólo debe:
   - validar estado,
   - persistir confirmación final,
   - opcionalmente promover learning approved si el usuario así lo eligió,
   - disparar jobs posteriores por evento.
3. Reemplazar llamadas directas dentro de `review.ts` por eventos explícitos.
4. `review.ts` debe quedar como fachada/orquestador fino, no como cocina completa.

---

## 3.J. Bloque J — VAT run de prueba

### Respuesta corta a tu pregunta

Sí, **debería existir**.

Y es una excelente idea.

### Qué es

Una simulación del IVA del período:

- sin cerrar nada definitivamente,
- sin generar compromiso “final”,
- mostrando diferencias, warnings y exclusiones.

### Qué debe incluir

- resumen por tasa / rubro fiscal
- documentos incluidos
- documentos excluidos y por qué
- diferencias entre `posted_provisional` y `posted_final`
- warnings por:
  - documentos con cuenta provisional,
  - IVA indirecto/prorrata pendiente,
  - documentos reabiertos,
  - diferencias con DGI si ya existe resumen importado/conciliado

### Mi recomendación técnica

No mezclarlo con el VAT run definitivo.

Crear un servicio aparte:

- `modules/tax/vat-run-preview.ts`

### Tareas para Codex

1. Reutilizar la lógica base de agregación de `vat-runs.ts`.
2. Crear función `buildVatRunPreview({ organizationId, month, year, includeStatuses })`.
3. `includeStatuses` por defecto:
   - `posted_provisional`
   - `posted_final`
4. El preview no debe mutar el estado de documentos.
5. Crear componente `components/tax/vat-run-preview-card.tsx`.
6. Crear página `VAT Preview` o modal dentro del mes.
7. Mostrar claramente:
   - `Simulación`
   - `No definitiva`
   - `Última corrida`
   - `Diferencia contra DGI` si aplica.

### Extra útil

Si existe `modules/tax/dgi-reconciliation.ts`, usarlo después para comparar preview interno vs resumen/consulta DGI.

---

## 3.K. Bloque K — VAT run definitivo

### Objetivo

Generar el resultado fiscal definitivo del período o al menos la versión oficial dentro del sistema.

### Qué cambia respecto al preview

- queda persistido como corrida oficial,
- se congela el snapshot del período,
- se usa para exportación / conciliación / trabajo del contador.

### Tareas para Codex

1. Mantener `modules/tax/vat-runs.ts` como motor definitivo.
2. Separar claramente la UX:
   - `Simular IVA`
   - `Generar IVA definitivo`
3. No disparar corrida definitiva automáticamente al confirmar cada documento.
4. En lugar de eso, marcar el período como `needs_vat_refresh` o similar.
5. El VAT definitivo se corre:
   - manualmente,
   - o por job agendado,
   - pero no pegado al click de un documento individual.

---

## 3.L. Bloque L — Reapertura y remapeo manual sin rerun de IA

### Objetivo

Permitir que documentos ya procesados y hasta ya posteados puedan adaptarse a cambios del plan de cuentas sin volver a pagar IA.

### Tu criterio acá es correcto

Si el usuario cambia el plan de cuentas:

- las facturas viejas **no deben reprocesarse con IA automáticamente**;
- pero sí **deben poder reabrirse**;
- y el usuario **debe poder moverlas manualmente** al nuevo asiento/cuenta si lo necesita.

### Qué debe soportar el sistema

- reabrir documento,
- conservar facts originales,
- conservar clasificación histórica,
- mostrar “esto estaba así antes”,
- permitir reemplazar cuenta y/o template,
- permitir guardar nueva regla reusable desde esa reapertura,
- no rerun de IA salvo acción explícita muy excepcional.

### Tareas para Codex

1. Crear `modules/documents/reopen-remap-service.ts`.
2. Reusar el action `reopen` existente, pero separarlo del resto.
3. Al reabrir:
   - mantener `document_assignment_run` histórico,
   - marcar snapshot actual como stale,
   - dejar claro que no se rerun IA.
4. Crear UI “Reclasificar con nuevo plan” / “Remap manual”.
5. Mostrar diff:
   - cuenta anterior
   - cuenta nueva
   - tax profile anterior
   - tax profile nuevo
   - impacto contable anterior vs nuevo
6. Si cambia sólo la cuenta y no el hecho fiscal, no volver a llamar a la segunda IA.

---

## 4. Refactor técnico concreto por archivos y módulos

---

## 4.1. Crear módulos nuevos

### `modules/documents/workflow-state.ts`
Responsabilidad:

- derivar el estado operativo del documento,
- decir en qué cola cae,
- centralizar la lógica de “qué falta”.

### `modules/accounting/classification-runner.ts`
Responsabilidad:

- ejecutar segunda IA + rules + allowed targets + templates,
- persistir un assignment run,
- devolver resultado clasificable y explicable.

### `modules/accounting/rule-explainer.ts`
Responsabilidad:

- explicar por qué ganó una regla.

### `modules/accounting/learning-approval-service.ts`
Responsabilidad:

- convertir una decisión manual en regla reusable.

### `modules/accounting/accounting-impact-preview.ts`
Responsabilidad:

- transformar journal/tax/rule en vista previa entendible.

### `modules/documents/post-provisional-service.ts`
Responsabilidad:

- posteo provisional explícito.

### `modules/documents/confirm-final-service.ts`
Responsabilidad:

- confirmación final explícita.

### `modules/tax/vat-run-preview.ts`
Responsabilidad:

- simulación del IVA sin mutación definitiva.

### `modules/documents/reopen-remap-service.ts`
Responsabilidad:

- reapertura y remapeo manual sin rerun de IA.

---

## 4.2. Adelgazar módulos existentes

### `modules/documents/review.ts`
Objetivo:

convertirlo en una fachada/orquestador delgado.

### Sacarle de adentro, gradualmente

- persistencia de assignment runs
- aprobación de reglas reusables
- sync de open items como side effect interno escondido
- rebuild automático de VAT definitivo
- decisiones combinadas de confirmación total

### `modules/accounting/learning-suggestions.ts`
Objetivo:

- seguir sugiriendo scopes,
- pero dejar de ser el lugar donde se “cierra” el aprendizaje.

### `modules/accounting/rule-engine.ts`
Objetivo:

- sumar el nuevo scope `vendor_concept_operation_category`
- devolver explicación de match más rica.

### `modules/tax/vat-runs.ts`
Objetivo:

- quedar sólo para corrida definitiva / agregación oficial.
- el preview va aparte.

---

## 5. Cambios de base de datos recomendados

---

## 5.1. Organización única por RUT

### Hacer ya

1. Normalizar `tax_id` / RUT (`trim`, sin espacios raros, formato consistente).
2. Crear índice único en `organizations.tax_id_normalized`.
3. Cambiar RPC `create_organization_with_owner(...)`:
   - si ya existe una organización con ese RUT, no crear otra;
   - devolver error claro o flujo de solicitud de acceso.

### Mensaje recomendado

“Ya existe una organización registrada con este RUT. Si pertenecés a ella, pedí acceso al owner o al contador responsable.”

---

## 5.2. Roles de membresía (dejar planteado ya)

Aunque sea V2, conviene dejar base de datos planteada.

Agregar en `organization_members.role`:

- `owner`
- `accountant`
- `admin_processing`
- `viewer`

### Permisos sugeridos

- `owner`: todo
- `accountant`: casi todo igual a owner excepto ciertas configuraciones de suscripción/propiedad
- `admin_processing`: carga, review, clasificación, posteo, pero no cambia plan/políticas/global settings
- `viewer`: sólo lectura

No hace falta cerrar todo esto ahora, pero sí dejar el schema listo.

---

## 5.3. Assignment runs

Crear tabla `document_assignment_runs`.

Motivo:

- debugging,
- auditoría,
- explainability,
- retry control,
- no mezclar clasificación con confirmación.

---

## 5.4. Scope nuevo en accounting rules

Extender enum para `vendor_concept_operation_category`.

Campos necesarios según modelo actual:

- `vendor_id`
- `concept_id`
- `operation_category`
- `document_role`
- `account_id`
- `template_code`
- `tax_profile_code`
- `status`
- `priority`

---

## 5.5. VAT run previews

Opción A (rápida): no persistir previews, sólo recalcular bajo demanda.

Opción B (mejor para auditoría):
crear `vat_run_previews` con:

- `organization_id`
- `period`
- `input_filters_json`
- `summary_json`
- `included_document_ids`
- `excluded_document_ids`
- `differences_json`
- `created_by_user_id`
- `created_at`

Mi recomendación:

- empezar con opción A,
- pasar a B si el piloto la pide.

---

## 6. UX: separar la pantalla de review en bloques visibles

Hoy el workspace ya tiene mucha data. El problema no es falta de data; es que la experiencia todavía puede sentirse encadenada.

## 6.1. Nueva estructura visual del workspace

### Paso 1 — Documento leído
- identidad
- emisor
- fecha
- moneda
- importes

### Paso 2 — Contexto operativo/fiscal
- categoría de operación
- contexto extra del usuario
- business purpose
- warnings de razonabilidad

### Paso 3 — Clasificación contable
- sugerencia IA
- cuenta propuesta
- template
- tax profile

### Paso 4 — Regla aplicada
- qué regla ganó
- por qué ganó
- botón cambiar

### Paso 5 — Aprendizaje
- guardar criterio reusable
- scope elegido

### Paso 6 — Impacto contable y fiscal
- asiento
- IVA
- open items
- warnings

### Paso 7 — Decisión de posteo
- post provisional
- confirm final
- reabrir

---

## 6.2. Sistema de comentarios `?`

No saturar UI con párrafos eternos.

### Regla de diseño

- ícono `?` o `i`
- hover en desktop / click en mobile
- popover corto
- botón “ver detalle” opcional
- cierre automático al perder foco

### Tipos de comentario

#### Nivel 1 — Microayuda
1 a 3 líneas.

Ejemplo:
> **Cuenta provisional**
> Se usa para no bloquear la operación mientras definís la cuenta definitiva.

#### Nivel 2 — Impacto
Qué cambia si aceptás eso.

Ejemplo:
> **Guardar criterio para este proveedor y concepto**
> Las próximas facturas similares se clasificarán automáticamente con esta cuenta.

#### Nivel 3 — Nota experta
Para usuarios quisquillosos/contadores.

Ejemplo:
> **IVA indirecto**
> Se usa cuando el gasto no se puede imputar exclusivamente a operaciones gravadas o no gravadas y puede requerir prorrata.

### Recomendación técnica

Aprovechar `modules/explanations/decision-comment-builder.ts` y extenderlo para:

- explainability del onboarding/preset,
- explainability de regla aplicada,
- explainability de preview contable,
- explainability de VAT preview.

---

## 7. Qué pasos exactos le pediría a Codex (orden recomendado)

---

## Fase 1 — Guardrails y correcciones base

### Tarea 1
Arreglar identidad de organización por RUT.

**Objetivo:** impedir duplicados cross-user.

**Entregables:**
- migración SQL para índice único sobre tax_id normalizado,
- cambios a RPC `create_organization_with_owner(...)`,
- mensajes UI de error/flujo alternativo.

### Tarea 2
Agregar/confirmar role enum en `organization_members`.

**Objetivo:** dejar base lista para owner/accountant/admin_processing/viewer.

---

## Fase 2 — Estado del workflow como servicio separado

### Tarea 3
Crear `modules/documents/workflow-state.ts`.

**Objetivo:** que una sola función derive el estado operativo del documento.

**Debe devolver:**
- queueCode
- stepStatuses
- nextRecommendedAction
- visibleWarnings
- canRunClassification
- canCreateLearningRule
- canPostProvisional
- canConfirmFinal
- canRunVatPreview

### Tarea 4
Crear tests unitarios exhaustivos para `workflow-state.ts`.

Casos:
- documento recién extraído
- documento con facts listos pero sin contexto
- documento clasificado con cuenta provisional
- documento con regla applied y preview listo
- documento posteado provisional
- documento reabierto

---

## Fase 3 — Separar clasificación de confirmación

### Tarea 5
Crear `modules/accounting/classification-runner.ts`.

**Objetivo:** ejecutar clasificación como acción independiente.

**Debe usar:**
- rule-engine
- suggestion-engine
- assistant
- journal-builder
- accounting context

**No debe hacer:**
- crear regla reusable,
- confirmar documento,
- disparar VAT definitivo.

### Tarea 6
Crear tabla `document_assignment_runs` + repositorio.

### Tarea 7
Agregar acción UI “Clasificar ahora” en documentos pendientes de asignación.

### Tarea 8
Agregar card visible de resultado de clasificación.

---

## Fase 4 — Explainability de regla aplicada

### Tarea 9
Crear `modules/accounting/rule-explainer.ts`.

### Tarea 10
Crear componente `rule-application-card.tsx`.

**Debe mostrar:**
- scope
- provenance
- prioridad
- cuenta
- tax profile
- template
- matched predicates
- por qué ganó
- advertencias

### Tarea 11
Hacer que esta card aparezca siempre después de la clasificación.

---

## Fase 5 — Separar aprendizaje en bloque propio

### Tarea 12
Extender scopes con `vendor_concept_operation_category`.

### Tarea 13
Refactor de `learning-suggestions.ts` para recomendar:
- `vendor_concept_operation_category`
- `vendor_concept`
- `concept_global`
- `vendor_default`

### Tarea 14
Crear `learning-approval-service.ts`.

### Tarea 15
Agregar bloque UI “Guardar criterio para futuras facturas”.

**Con opciones:**
- sólo este documento
- proveedor + concepto
- proveedor + concepto + categoría de operación
- concepto global
- proveedor default

---

## Fase 6 — Preview contable/fiscal explícito

### Tarea 16
Crear `accounting-impact-preview.ts`.

### Tarea 17
Crear componente UI con tabs:
- Asiento
- IVA
- Open items
- Warnings

### Tarea 18
Mostrar preview antes de permitir `post provisional` o `confirm final`.

---

## Fase 7 — Posteo provisional y final separados

### Tarea 19
Crear `post-provisional-service.ts`.

### Tarea 20
Crear `confirm-final-service.ts`.

### Tarea 21
Quitar de `review.ts` side effects innecesarios y dejarlo como fachada/orquestador delgado.

**Meta:** que cada acción llame a un servicio propio.

---

## Fase 8 — VAT run preview

### Tarea 22
Crear `modules/tax/vat-run-preview.ts`.

### Tarea 23
Agregar botón “Simular IVA del período”.

### Tarea 24
Mostrar:
- documentos incluidos
- excluidos
- diferencias
- warnings
- resumen por rubro/tasa

### Tarea 25
No ejecutar `vat-runs.ts` definitivo automáticamente por documento.

---

## Fase 9 — Reapertura y remapeo sin IA

### Tarea 26
Crear `reopen-remap-service.ts`.

### Tarea 27
Agregar UI de diff vieja cuenta vs nueva cuenta.

### Tarea 28
Permitir manual remap sin rerun de IA.

### Tarea 29
Permitir guardar regla reusable desde la reapertura.

---

## Fase 10 — Procesamiento masivo para piloto

### Tarea 30
Crear flujo batch claro:

- subir lote,
- ver avance por documento,
- ver errores por documento,
- reintentar sólo fallidos,
- enviar a cola “pendientes de asignación”.

### Tarea 31
Agregar concurrencia limitada y trazabilidad:
- max concurrent docs
- max concurrent second-pass AI calls
- retry con backoff
- no duplicar trabajo

### Tarea 32
Agregar filtros de prueba piloto:
- por mes
- por proveedor
- por estado
- por moneda
- por warnings

---

## 8. Tests que le pediría a Codex en cada fase

---

## 8.1. Tests de identidad organizacional

- no permite crear otra organización con mismo RUT desde otro usuario
- sí permite invitar/agregar miembro a organización existente
- no rompe organizaciones sin RUT normalizado anterior (migración)

---

## 8.2. Tests de workflow-state

- intake listo pero facts incompletos
- facts completos pero sin clasificación
- clasificación lista pero sin regla reusable
- posted provisional
- posted final
- reopened_needs_manual_remap

---

## 8.3. Tests de classification-runner

- con regla `vendor_concept` aplica cuenta correcta
- con `concept_global` aplica fallback correcto
- con `vendor_default` cae bien cuando no hay concepto confiable
- con `vendor_concept_operation_category` gana sobre `vendor_concept`
- con cuenta provisional devuelve `postingMode = provisional`
- con falta de contexto devuelve razón bloqueante clara

---

## 8.4. Tests de explainability

- muestra el scope correcto
- muestra provenance correcto
- muestra matched predicates correctos
- no inventa explicación cuando fue manual_review

---

## 8.5. Tests de aprendizaje

- guardar regla reusable no requiere confirm final
- confirm final no crea regla approved si el usuario no la pidió
- reapertura puede crear regla nueva sin rerun de IA

---

## 8.6. Tests de preview contable

- muestra cuentas correctas
- marca cuentas provisionales
- muestra efecto IVA correcto
- muestra open item cuando corresponde

---

## 8.7. Tests de VAT preview

- incluye `posted_provisional`
- incluye `posted_final`
- excluye `draft`
- no muta estado ni crea corrida definitiva
- informa diferencias respecto a corrida definitiva previa si existe

---

## 8.8. Tests de reapertura/remap

- reabre documento sin rerun IA
- conserva assignment run histórico
- permite cambiar cuenta manualmente
- recalcula preview con nuevo mapping

---

## 9. Qué haría yo primero, si mañana sólo hubiera tiempo para 5 cosas

1. **Unicidad de organización por RUT**
2. **workflow-state.ts**
3. **classification-runner separado**
4. **card visible de regla aplicada + por qué**
5. **VAT run preview**

Porque esas cinco cosas cambian mucho la claridad del sistema sin exigir una demolición total.

---

## 10. Criterio de éxito de esta refactorización

La refactorización está bien hecha si, al terminar:

- un documento puede leerse sin clasificarlo todavía,
- puede clasificarse sin confirmarlo,
- puede aprender una regla sin cerrar todo el flujo,
- puede mostrar su impacto antes de postearse,
- puede entrar en una simulación fiscal sin cerrar el período,
- puede reabrirse y remapearse sin volver a pagar IA,
- y el usuario siempre entiende **qué hizo el sistema, por qué lo hizo y qué le falta para avanzar**.

Ese es el punto en que el flujo deja de ser un bicho encadenado y pasa a ser una máquina seria.

---

## 11. Resumen ejecutivo para decidir ya

### Sí haría ya

- separar clasificación de confirmación,
- separar aprendizaje de confirmación,
- hacer visible la regla aplicada,
- mostrar preview contable/fiscal,
- construir VAT run preview,
- arreglar identidad organizacional por RUT.

### No haría ya

- rehacer todo el dominio,
- meter multiusuario completo antes de arreglar identidad,
- reprocesar IA automáticamente cuando cambia el plan de cuentas,
- seguir escondiendo demasiada lógica detrás de “confirmar”.

### Nueva lógica mental del producto

- **procesar**
- **revisar hechos**
- **clasificar**
- **explicar**
- **aprender**
- **previsualizar impacto**
- **postear provisional o final**
- **simular IVA**
- **cerrar cuando corresponda**

Ese es el flujo que te va a dejar probar, vender y depurar sin sentir que cada botón dispara acciones opacas en la sombra.
