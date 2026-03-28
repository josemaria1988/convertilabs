# specs-driven-development-asistente-contable.md

**Estado editorial:** propuesto / implementacion en curso solo donde se indique explicitamente  
**Fecha:** 2026-03-22  
**Estado actual 2026-03-28:** el Asistente Contable ya existe como rail consultivo en `Documentos`; sigue acotado a analisis, refresh y sugerencias resolubles, sin mutaciones contables libres.  
**Objetivo:** formalizar la capa visible y auditable del Asistente Contable dentro de Convertilabs, sin mezclar la IA con el modelo de acceso humano ni darle capacidad de ejecutar mutaciones contables por fuera del dominio.

---

## 1. Tesis

La IA visible del producto debe llamarse **Asistente Contable**.

Ese nombre no implica un usuario humano ni una membresia real. Implica:

- identidad estable y visible en UI;
- trazabilidad por actor tecnico;
- explainability legible para el usuario final;
- sugerencias consultivas acotadas al workflow;
- ejecucion siempre mediada por decision humana y servicios de dominio existentes.

La identidad tecnica sigue viviendo fuera de `profiles` y `organization_members`.

Actor tecnico base:

- `system_ai_assistant`

Identidad visible de producto:

- `Asistente Contable`

Subtitulos o badges futuros:

- `Asistente Contable - Revision documental`
- `Asistente Contable - Fiscal`
- `Asistente Contable - Cierre`
- `Asistente Contable - Auditoria`

---

## 2. Principios no negociables

### 2.1 Actor visible si, usuario humano no

La IA no se modela en:

- `auth.users`
- `profiles`
- `organization_members`

La IA vive como actor auditable del sistema y se presenta en UI mediante personas visibles.

### 2.2 La IA no bypassa el dominio

Secuencia obligatoria:

```text
usuario pide o abre contexto
-> Asistente Contable analiza
-> Asistente Contable sugiere
-> humano acepta / rechaza / corrige
-> servicio de dominio ejecuta
```

Nunca:

```text
Asistente Contable -> journal_entries
Asistente Contable -> confirmacion final
Asistente Contable -> regla reusable aprobada sin humano
```

### 2.3 Guardrails y acotacion

El Asistente Contable:

- puede narrar, priorizar, advertir y sugerir;
- puede elegir dentro de sets permitidos;
- puede pedir contexto faltante;
- no puede inventar cuentas ni reglas fuera del set valido;
- no puede escribir historicos contables ni fiscales por si solo.

### 2.4 Compatibilidad con la arquitectura actual

La capa nueva reutiliza y amplia:

- `system_actors`
- `assistant_runs`
- `assistant_run_evidence_refs`
- `assistant_suggestions`
- `ai_decision_logs`

No reemplaza el intake IA ni la segunda IA contable ya existente.

---

## 3. Modelo operativo

### 3.1 Identidad visible

Se agrega `assistant_personas` como catalogo visible de producto.

Campos minimos:

- `code`
- `display_name`
- `scope`
- `system_actor_id`
- `avatar_asset_path`
- `tone`
- `specialty_md`
- `is_active`
- timestamps

MVP documental sembrado:

- `document_reviewer_assistant`
- `tax_assistant`
- `close_assistant`
- `audit_assistant`

Todas muestran `display_name = Asistente Contable`.

### 3.2 Hilos visibles

Se agrega `assistant_threads` para modelar un hilo por target de trabajo.

Campos minimos:

- `organization_id`
- `target_kind`
- `target_id`
- `persona_code`
- `opened_by_profile_id`
- `status`
- `current_input_hash`
- `stale_reason`
- `last_message_at`
- timestamps

Regla MVP:

- un hilo por `organization_id + target_kind + target_id + persona_code`

### 3.3 Mensajes visibles

Se agrega `assistant_messages`.

Campos minimos:

- `thread_id`
- `role`
- `persona_code`
- `created_by_profile_id`
- `system_actor_id`
- `assistant_run_id`
- `content_md`
- `structured_payload_json`
- timestamps

MVP:

- solo mensajes del asistente y del sistema;
- sin chat libre;
- el mensaje visible principal resume lo que ve, lo que sugiere y lo que el usuario puede decidir ahora.

### 3.4 Sugerencias accionables

`assistant_suggestions` se mantiene como tabla reusable y se amplia con:

- `thread_id`
- `message_id`
- `input_hash`
- `evidence_hash`
- `confidence`
- `rationale_md`
- `requested_by_profile_id`

Se agrega `assistant_suggestion_evidence_refs` para enlazar evidencia especifica por sugerencia.

### 3.5 Corridas tecnicas

`assistant_runs` sigue siendo el log tecnico canonico.

Se amplia con:

- `thread_id`
- `message_id`

Cada corrida relevante del Asistente Contable debe poder enlazarse a:

- el target;
- el hilo visible;
- el mensaje visible;
- las sugerencias concretas;
- la evidencia consultada.

---

## 4. Documentos como primer frente

### 4.1 Superficie MVP

La primera superficie activa es el review documental.

Se agrega un rail derecho persistente firmado como `Asistente Contable`.

Bloques fijos:

- `Que veo`
- `Que sugiero`
- `Que puedes decidir ahora`

### 4.2 Comportamiento

- al abrir un documento, si no existe hilo vigente para el hash actual, el asistente genera un primer analisis;
- si cambian facts, overrides, clasificacion o estado de la revision, el hilo queda `stale`;
- un hilo `stale` no se recalcula solo por cada guardado;
- la UI muestra `Actualizar analisis`;
- el asistente puede seguir mostrando el ultimo analisis valido mientras avisa que el contexto quedo obsoleto.

### 4.3 Tipos de sugerencia MVP

- `needs_context`
- `classification_review`
- `stale_recalculation`
- `posting_readiness`
- `learning_scope_recommendation`

### 4.4 Acciones humanas validas

El Asistente Contable puede disparar, con aprobacion humana:

- recalculo del analisis;
- clasificacion contable;
- posteo provisional;
- resolucion manual de sugerencia;
- rechazo de sugerencia.

No incluye chat libre ni aprobacion automatica de reglas.

---

## 5. Patron de IA

Se copia el patron bueno del carril hibrido de presets:

- consulta estructurada;
- input snapshot;
- `input_hash`;
- invalidacion al cambiar contexto;
- explainability visible;
- fallback deterministico;
- IA acotada a candidatos validos;
- persistencia auditable completa.

Salida estructurada minima:

- `summary_md`
- `what_i_see`
- `what_i_suggest`
- `what_you_can_decide_now`
- `suggestions`
- `warnings`
- `confidence`
- `needs_refresh`

---

## 6. Permisos

MVP documental visible y resoluble para:

- `owner`
- `admin`
- `accountant`
- `admin_processing`
- `reviewer`

No visible para:

- `operator`
- `viewer`

---

## 7. Orden de implementacion

### Etapa 1

- spec nueva;
- naming visible `Asistente Contable`;
- tablas de personas, hilos, mensajes y evidencia por sugerencia;
- servicio documental;
- rail derecho en review documental;
- refresh manual con invalidacion por hash.

### Etapa 2

- cola dedicada `pending-assignment`;
- agrupacion de similares;
- sugerencias por lote;
- propuesta de `session rule`;
- resolucion masiva desde cola.

### Etapa 3

- extender el mismo patron a VAT anomalies, cierre y auditoria.

---

## 8. Criterios de aceptacion

- el actor tecnico sigue fuera de `profiles` y `organization_members`;
- `system_ai_assistant` se mantiene estable;
- el usuario ve `Asistente Contable` como nombre del producto;
- una corrida historica con `persona = document_reviewer_assistant` se renderiza como `Asistente Contable`;
- un documento abierto sin hilo vigente genera analisis inicial;
- guardar facts, overrides o clasificacion deja el hilo obsoleto;
- el usuario puede refrescar el analisis sin perder trazabilidad previa;
- la IA no escribe `journal_entries`, no confirma final y no aprueba reglas sola;
- cada sugerencia deja rastro de request, evidencia, rationale, confianza y resolucion humana.

---

## 9. Nota editorial

Este documento es un working spec complementario a la documentacion oficial.

Mientras la epica este en curso:

- la spec puede describir el objetivo completo;
- la documentacion oficial solo debe marcar como `implementado` lo que efectivamente exista en codigo;
- lo no desplegado debe seguir marcado como `preparado` o `pendiente`.
