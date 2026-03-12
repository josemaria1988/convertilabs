# Spec 05 - Wizard modal de draft editable

**Estado:** Draft  
**Prioridad:** P0  
**Dependencias:** `02`, `03`, `04`, `06`, `07`  
**Objetivo:** modelar el flujo visual y transaccional del usuario

---

## 1. Propósito

Definir el flujo visual del dashboard donde el usuario revisa, corrige y confirma la información sugerida por el sistema.

El requisito clave es doble:

1. los datos deben mostrarse como **inputs editables**, y
2. todo debe persistir automáticamente como **borrador** mientras no exista confirmación final.

---

## 2. Principios UX

### 2.1 Modal secuencial
El flujo MUST abrirse como modal por pasos consecutivos.

### 2.2 Autosave
Todo cambio relevante MUST guardarse automáticamente como borrador.

### 2.3 Reversibilidad
El usuario MUST poder volver al paso anterior, incluso después de haberlo “confirmado” dentro del mismo flujo.

### 2.4 Transparencia
La UI MUST mostrar:
- qué sugirió el sistema,
- qué cambió el usuario,
- qué pasos están confirmados,
- qué pasos quedaron invalidos por un cambio posterior.

### 2.5 Cierre sin pérdida
Cerrar el modal no puede implicar pérdida de trabajo.

---

## 3. Paso a paso del wizard

### Paso 0 - Preview del documento
Muestra:
- PDF preview
- metadata básica
- estado del documento
- origen del procesamiento

Acciones:
- cerrar
- continuar

### Paso 1 - Identidad del documento
Campos:
- rol sugerido: compra / venta / otro
- tipo documental sugerido
- subtipo u operación si aplica

Persistencia:
- autosave inmediato

### Paso 2 - Datos extraídos
Campos editables:
- cabecera
- contraparte
- fechas
- moneda
- identificadores

Persistencia:
- autosave con debounce

### Paso 3 - Importes y consistencias
Campos editables:
- neto
- impuestos
- total
- descuentos / recargos

Comportamiento:
- recalcular consistencias al editar

### Paso 4 - Contexto de operación
Campos editables:
- tipo de compra o venta
- local / exterior
- gravado / exento / otro
- flags de operación

Comportamiento:
- cambios aquí pueden invalidar sugerencia contable/fiscal

### Paso 5 - Sugerencia de asiento
Vista estructurada editable:
- líneas
- cuentas
- débitos / créditos
- explicación

### Paso 6 - Sugerencia fiscal
Vista estructurada editable:
- tratamiento
- bases imponibles
- referencias normativas
- warnings

### Paso 7 - Confirmación final
Resumen:
- documento
- campos editados
- asiento
- tratamiento fiscal
- diferencias vs sugerencia original

Acción:
- `Confirmar documento`

---

## 4. Estado por paso

Cada paso debería tener su propio estado interno.

Valores propuestos:
- `not_started`
- `draft_saved`
- `confirmed`
- `stale_after_upstream_change`
- `blocked`
- `error`

### Regla crítica
Si el usuario cambia un paso anterior, todos los pasos dependientes MUST pasar a `stale_after_upstream_change`.

Ejemplo:
- cambia importes -> asiento y fiscal quedan stale
- cambia tipo de documento -> importes, asiento y fiscal pueden quedar stale
- cambia naturaleza de operación -> fiscal y asiento quedan stale

---

## 5. Modelo de datos sugerido

### `document_drafts`
Borrador principal.

Campos:
- `id`
- `document_id`
- `organization_id`
- `revision_number`
- `status` (`open`, `ready_for_confirmation`, `confirmed`, `superseded`)
- `document_role`
- `document_type`
- `operation_context_json`
- `fields_json`
- `journal_suggestion_json`
- `tax_treatment_json`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### `document_draft_steps`
Estado por paso.

Campos:
- `id`
- `draft_id`
- `step_code`
- `status`
- `last_saved_at`
- `last_confirmed_at`
- `stale_reason`
- `snapshot_json`

### `document_draft_autosaves`
Historial liviano de persistencia automática.

Campos:
- `id`
- `draft_id`
- `step_code`
- `payload_patch_json`
- `saved_by`
- `saved_at`

---

## 6. Reglas de autosave

### 6.1 Cuándo guardar
Autosave MUST correr:
- al blur de un input importante,
- con debounce en texto libre,
- al avanzar de paso,
- al cambiar selects críticos,
- al cerrar el modal si hay cambios pendientes.

### 6.2 Feedback visual
La UI MUST mostrar:
- `Guardando...`
- `Borrador guardado`
- `Error al guardar`

### 6.3 Colisiones
**OPEN:** qué hacer si dos usuarios editan el mismo borrador.

Opciones:
- lock optimista con versión,
- lock pesimista,
- merge parcial.

---

## 7. Confirmaciones parciales

Cada paso MAY tener un botón interno de “confirmar este paso”, pero esa confirmación:

- no puede convertir el documento en `classified`,
- no puede bloquear volver atrás,
- solo debe servir para marcar revisión hecha por el usuario.

---

## 8. Confirmación final

Solo la acción final del wizard puede:

- cambiar el estado del documento a `classified`,
- congelar una revisión confirmada,
- registrar snapshot final.

---

## 9. Reapertura

Si un documento ya confirmado se reabre:

1. se muestra la última revisión confirmada,
2. al primer cambio se crea una nueva revisión en borrador,
3. los pasos posteriores se marcan `stale` si corresponde,
4. la revisión anterior permanece inmutable.

---

## 10. Validaciones de UX

La UI MUST impedir confirmar si:
- hay autosave pendiente fallido,
- hay pasos `blocked`,
- hay sugerencias stale no recalculadas,
- el asiento no balancea,
- faltan campos obligatorios,
- el tratamiento fiscal no está completo.

---

## 11. API sugerida

### `GET /api/documents/:id/draft/current`
### `POST /api/documents/:id/draft/autosave`
### `POST /api/documents/:id/draft/confirm-step`
### `POST /api/documents/:id/draft/recalculate-dependent-steps`
### `POST /api/documents/:id/draft/final-confirmation`

---

## 12. Escenarios de aceptación

### Escenario A - Cerrar y retomar
**Given** un usuario modifica campos  
**When** cierra el modal  
**Then** el borrador persiste  
**And** al reabrir ve los cambios

### Escenario B - Volver atrás tras confirmar paso
**Given** el usuario confirmó un paso intermedio  
**When** vuelve al paso anterior y cambia datos  
**Then** el sistema lo permite  
**And** invalida los pasos dependientes

### Escenario C - Error de autosave
**Given** una falla al guardar  
**When** el usuario sigue editando  
**Then** la UI debe advertir claramente  
**And** no permitir confirmación final hasta resolverlo

---

## 13. Preguntas abiertas

1. ¿Qué pasos exactos lleva el V1: 5, 6 o 7?
2. ¿Habrá confirmación por paso o solo final?
3. ¿Se permitirá multiusuario concurrente?
4. ¿La UI debe mostrar el texto extraído crudo?
5. ¿Debe existir comparación “sugerencia original vs edición final” visible al usuario?

---
