# Spec 08 - Confirmacion final y reapertura

**Estado:** Approved  
**Prioridad:** P1  
**Dependencias:** `05`, `06`, `07`

---

## 1. Decision cerrada

Existe una sola confirmacion obligatoria:

- confirmacion final

Esa accion:

- confirma draft
- crea `document_confirmations`
- crea `journal_entry` en `draft`
- actualiza `documents.status = classified`

---

## 2. Roles aprobados

Pueden confirmar:

- `owner`
- `admin`
- `accountant`
- `reviewer`

Pueden reabrir:

- `owner`
- `admin`

Pueden reconfirmar:

- `owner`
- `admin`
- `accountant`
- `reviewer`

`operator` y `viewer` no confirman ni reabren.

---

## 3. Semantica de reapertura

Cuando un documento confirmado se reabre:

1. la revision confirmada anterior queda intacta
2. se clona a un nuevo draft
3. el documento pasa a `classified_with_open_revision`
4. la nueva revision requiere reconfirmacion

La ultima confirmacion valida sigue siendo la que alimenta IVA mensual hasta reconfirmar.

---

## 4. Politicas V1

- no hay aprobaciones parciales
- no hay posting contable definitivo
- no hay cierre fiscal definitivo
- no hay reversa automatica

---

## 5. Estado de implementacion

Implementado:

- confirmacion final desde UI de review
- reapertura desde UI de review
- `document_confirmations`
- `document_revisions`
- `classified_with_open_revision`

Pendiente:

- motivo obligatorio de reapertura
- politicas avanzadas de doble aprobacion
