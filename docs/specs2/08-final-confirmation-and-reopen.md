# Spec 08 - Confirmación final y reapertura de revisión

**Estado:** Draft  
**Prioridad:** P1  
**Dependencias:** `05`, `06`, `07`  
**Objetivo:** definir cuándo un documento pasa de draft a clasificado y cómo puede reabrirse sin destruir historial

---

## 1. Propósito

Definir la semántica de:

- confirmación final,
- versión confirmada,
- reapertura,
- cambios posteriores,
- invalidación de confirmaciones previas.

---

## 2. Requisito central

Un documento solo puede pasar a `classified` cuando el usuario ejecuta la **confirmación final** del wizard y todas las validaciones críticas están cumplidas.

---

## 3. Lo que NO hace la confirmación final

La confirmación final no implica necesariamente:

- posting automático al diario,
- envío a organismo,
- cierre fiscal definitivo,
- imposibilidad de editar en el futuro.

Eso dependerá de workflows posteriores no definidos aún.

---

## 4. Estados propuestos

### Estado del documento
- `uploaded`
- `draft_ready`
- `classified`
- `classified_with_open_revision`
- `error`

### Estado del draft
- `open`
- `ready_for_confirmation`
- `confirmed`
- `superseded`

### Estado de revisión
- `none`
- `opened_after_confirmation`
- `pending_reconfirmation`
- `reconfirmed`

---

## 5. Reglas de confirmación final

El sistema MUST verificar:

1. no hay autosaves pendientes fallidos,
2. no hay pasos bloqueados,
3. no hay pasos stale sin recalcular,
4. campos obligatorios completos,
5. asiento balanceado,
6. tratamiento fiscal consistente,
7. perfil organizacional vigente resoluble.

Si cualquier condición falla, NO puede existir confirmación final.

---

## 6. Efectos de la confirmación final

Al confirmar:

- `documents.status = classified`
- `document_drafts.status = confirmed`
- se persiste snapshot final
- se registra evento de dominio
- se registra usuario y timestamp
- se congela la revisión confirmada

---

## 7. Reapertura

### Regla
Un documento clasificado MUST poder reabrirse para revisión si el rol del usuario lo permite.

### Comportamiento
Al reabrir:
1. se muestra la última revisión confirmada,
2. al primer cambio se clona la revisión en un nuevo draft,
3. la revisión confirmada previa queda inmutable,
4. el documento pasa a `classified_with_open_revision` o equivalente.

**OPEN:** nombre exacto del estado del documento al haber revisión abierta.

---

## 8. Confirmaciones parciales anteriores

Si el usuario había confirmado pasos intermedios en el wizard y luego cambia datos upstream:
- esas confirmaciones parciales quedan invalidadas,
- debe registrarse el motivo,
- el sistema debe pedir re-confirmación.

---

## 9. Modelo de datos sugerido

### `document_confirmations`
Campos:
- `id`
- `document_id`
- `draft_id`
- `confirmation_type` (`step`, `final`, `reconfirmation`)
- `step_code` nullable
- `confirmed_by`
- `confirmed_at`
- `snapshot_json`

### `document_revisions`
Campos:
- `id`
- `document_id`
- `revision_number`
- `base_confirmed_draft_id`
- `working_draft_id`
- `status`
- `opened_by`
- `opened_at`
- `reconfirmed_by`
- `reconfirmed_at`

### `document_invalidation_events`
Campos:
- `id`
- `document_id`
- `revision_number`
- `invalidated_step_code`
- `reason_code`
- `payload_json`
- `created_at`

---

## 10. Reglas de permisos

**OPEN / BLOCKING:** definir qué roles pueden:

- confirmar final,
- reabrir,
- reconfirmar,
- editar tratamiento fiscal,
- editar asiento.

Propuesta inicial no cerrada:
- owner/admin: todo
- accountant/fiscal role: confirmar fiscal y final
- operator: editar draft pero no confirmar final

---

## 11. Escenarios de aceptación

### Escenario A - Confirmación final exitosa
**Given** un draft sin bloqueos  
**And** un asiento balanceado  
**And** tratamiento fiscal consistente  
**When** el usuario confirma  
**Then** el documento queda en `classified`  
**And** el snapshot final persiste

### Escenario B - Reapertura posterior
**Given** un documento clasificado  
**When** un usuario autorizado lo reabre y cambia importes  
**Then** se crea nueva revisión borrador  
**And** la revisión anterior queda intacta

### Escenario C - Cambio upstream tras confirmación parcial
**Given** un paso fiscal ya confirmado  
**When** el usuario cambia la naturaleza de la operación  
**Then** la confirmación fiscal previa se invalida  
**And** el sistema exige recálculo y re-confirmación

---

## 12. No objetivos

- política de reversas contables posteriores
- rectificativas regulatorias
- ciclo de aprobación multinivel fuera del wizard

---

## 13. Preguntas abiertas

1. ¿Quién puede reabrir un clasificado?
2. ¿Se necesita motivo obligatorio al reabrir?
3. ¿Se requiere doble aprobación para cambios fiscales después de confirmado?
4. ¿El estado del documento cambia o solo cambia la revisión activa?
5. ¿Cuál es la diferencia operativa entre `classified` y `posted`, si luego existirá posting?

---
