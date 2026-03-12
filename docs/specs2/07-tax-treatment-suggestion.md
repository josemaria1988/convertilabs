# Spec 07 - Sugerencia de tratamiento fiscal

**Estado:** Draft / Blocked  
**Prioridad:** P1  
**Dependencias:** `01`, `03`, `04`, `05`, `09`  
**Objetivo:** construir una sugerencia fiscal explicable, editable y soportada por normativa interna versionada

---

## 1. Propósito

Definir el motor y la estructura de datos para sugerir el **tratamiento fiscal** de un documento, sin que eso equivalga a una determinación tributaria definitiva o automática.

---

## 2. Principio central

El tratamiento fiscal MUST salir de la combinación de:

- perfil organizacional vigente,
- naturaleza del documento,
- contexto de operación,
- reglas versionadas,
- normativa interna curada.

No debe salir de un prompt suelto con delirio fiscal incorporado. El país ya tiene suficiente con los problemas humanos normales.

---

## 3. Alcance

### Incluido
- sugerencia fiscal estructurada,
- explicación,
- referencias normativas utilizadas,
- edición humana,
- invalidación y recálculo ante cambios de contexto.

### Excluido hasta decisión
- liquidación completa de todos los tributos,
- declaraciones juradas,
- presentación ante organismos,
- cálculo anual de renta,
- gestión de sanciones / multas.

---

## 4. Pregunta bloqueante principal

**OPEN / P0:** ¿Qué dominios tributarios cubre el V1?

Opciones posibles:
- solo IVA / equivalentes operativos del documento,
- IVA + retenciones / percepciones,
- IVA + impuestos por tipo de operación,
- otro alcance.

Nada debe codificarse hasta que esto quede decidido.

---

## 5. Inputs requeridos

- documento y draft vigente,
- rol documental,
- tipo documental,
- contexto de operación,
- perfil organizacional vigente,
- catálogos de operación,
- base normativa activa,
- reglas fiscales versionadas.

---

## 6. Output esperado

```json
{
  "version": 1,
  "tax_domain_scope": ["iva"],
  "operation_tax_profile_code": "purchase_local_taxed",
  "determination": {
    "vat_treatment_code": "basic_rate_purchase_credit",
    "taxable_amount": 1000,
    "tax_amount": 220,
    "currency_code": "UYU"
  },
  "support": {
    "rule_code": "uy_purchase_local_taxed_v1",
    "organization_profile_version_id": "uuid",
    "normative_refs": [
      {
        "normative_item_id": "uuid",
        "label": "Referencia normativa interna"
      }
    ]
  },
  "confidence_score": 0.84,
  "warnings": [],
  "editable": true
}
```

---

## 7. Modelo de datos propuesto

### `tax_rule_sets`
Colección versionada de reglas.

Campos:
- `id`
- `jurisdiction_code`
- `scope_code`
- `version`
- `status`
- `effective_from`
- `effective_to`

### `tax_rules`
Reglas individuales.

Campos:
- `id`
- `tax_rule_set_id`
- `rule_code`
- `name`
- `conditions_json`
- `determination_json`
- `priority`
- `active`

### `document_tax_treatment_suggestions`
Sugerencias versionadas.

Campos:
- `id`
- `document_id`
- `draft_id`
- `version_number`
- `suggestion_json`
- `confidence_score`
- `created_at`
- `superseded_by_id`

### `document_tax_diffs`
Historial de cambios humanos.

Campos:
- `id`
- `tax_treatment_suggestion_id`
- `diff_json`
- `created_by`
- `created_at`

---

## 8. Reglas de negocio

1. Toda sugerencia fiscal MUST referenciar la versión del perfil organizacional usada.
2. Toda sugerencia fiscal MUST referenciar las reglas fiscales usadas.
3. Toda sugerencia fiscal SHOULD referenciar al menos un item normativo interno cuando el caso no sea trivial.
4. Si la organización no tiene encuadre suficiente, el paso fiscal MUST quedar bloqueado.
5. Si el usuario cambia datos base, la sugerencia fiscal MUST quedar stale.
6. El sistema MUST distinguir entre:
   - sugerencia automática,
   - edición manual,
   - confirmación final.

---

## 9. Casos a modelar

### 9.1 Compra
Casos tentativos:
- compra gravada
- compra exenta
- compra exterior
- activo fijo

### 9.2 Venta
Casos tentativos:
- venta gravada
- venta exenta
- exportación
- venta local sin IVA por motivo normativo específico

**OPEN:** catálogo inicial exacto.

---

## 10. Relación con la normativa

El motor fiscal MUST consultar primero una base interna curada, no internet abierto.

Cada decisión SHOULD poder responder:
- qué regla aplicó,
- qué versión,
- qué fuente normativa interna la sostiene,
- qué parte fue cambiada por el usuario.

### Regla adicional para IA
Si una llamada a LLM participa en explicación o clasificación previa, MUST usar
solo reglas resumidas y aprobadas para la organizacion. La normativa completa no
entra al prompt.

---

## 11. UX requerida

La UI fiscal MUST mostrar:
- tipo de tratamiento sugerido,
- parámetros calculados,
- referencias normativas o al menos su resumen,
- warnings por incertidumbre,
- edición habilitada según rol.

La UI SHOULD mostrar también:
- por qué se eligió ese tratamiento,
- qué cambió el usuario respecto a la sugerencia.

---

## 12. Validaciones

### Mínimas
- perfil fiscal organizacional completo,
- tipo de operación definido,
- fechas válidas,
- importes coherentes,
- reglas vigentes a la fecha del documento.

### OPEN
- si el usuario puede confirmar con warning,
- si ciertos tratamientos exigen doble validación,
- si exportación requiere campo de destino obligatorio.

---

## 13. Escenarios de aceptación

### Escenario A - Tratamiento disponible
**Given** un documento con contexto fiscal claro  
**And** reglas disponibles  
**When** se calcula la sugerencia  
**Then** el sistema devuelve tratamiento estructurado editable y referenciado

### Escenario B - Base normativa incompleta
**Given** un caso de operación no cubierto por reglas activas  
**When** se solicita sugerencia fiscal  
**Then** el sistema no inventa  
**And** deja el paso bloqueado o en revisión según política

### Escenario C - Cambio del usuario
**Given** una venta detectada como gravada  
**When** el usuario la cambia a exportación  
**Then** el tratamiento anterior queda stale  
**And** debe recalcularse con nuevas reglas

---

## 14. Preguntas bloqueantes

1. ¿El V1 cubre solo IVA o algo más?
2. ¿Qué catálogo de operaciones fiscales entra en V1?
3. ¿Se permitirá confirmar con warnings?
4. ¿Qué rol puede editar tratamiento fiscal?
5. ¿El usuario verá referencias normativas completas o solo resumen?
6. ¿Cómo se trata un caso sin regla activa?
7. ¿Cómo se diferencian reglas generales versus overrides por organización?

---
