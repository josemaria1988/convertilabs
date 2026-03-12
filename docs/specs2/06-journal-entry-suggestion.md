# Spec 06 - Sugerencia de asiento contable

**Estado:** Draft / Blocked  
**Prioridad:** P1  
**Dependencias:** `01`, `03`, `04`, `05`, reglas contables por organización  
**Objetivo:** generar una propuesta de asiento estructurada, editable y auditable

---

## 1. Propósito

Definir cómo Convertilabs genera una **sugerencia de asiento contable** a partir de un documento procesado, sin convertir esa sugerencia en registración definitiva automática.

---

## 2. Principio central

La sugerencia de asiento MUST ser un **objeto estructurado**, no texto libre.

Debe incluir:
- líneas,
- cuentas,
- débitos / créditos,
- explicación,
- fuente de la decisión,
- confianza,
- dependencias usadas.

---

## 3. Alcance del V1

### Incluido
- sugerencia editable de asiento para compras y/o ventas según alcance finalmente aprobado,
- validación de balance,
- trazabilidad de reglas usadas,
- diferencia entre sugerencia automática y edición humana.

### Excluido
- posting irrevocable al libro diario,
- reversas automáticas,
- cierre contable,
- consolidación.

---

## 4. Precondiciones

Para que exista sugerencia contable MUST haber:

- draft documental creado,
- perfil organizacional vigente,
- plan de cuentas configurado,
- catálogo de plantillas contables definido,
- tipo documental y contexto de operación resueltos al menos provisionalmente.

---

## 5. Motor de decisión

### 5.1 Enfoque recomendado
Motor híbrido por capas:

1. **Reglas determinísticas**  
   Para mapping principal por tipo de operación.

2. **Heurísticas / defaults**  
   Para casos incompletos.

3. **Capa explicativa asistida**  
   Para justificar sugerencia, no para inventarla.

### 5.2 Regla de prudencia
La IA MAY ayudar a explicar o completar contexto, pero NO debe elegir cuentas fuera del plan configurado ni saltarse validaciones.

---

## 6. Inputs

- tipo de documento
- rol documental
- campos confirmados o candidatos
- importes
- contexto de operación
- perfil organizacional vigente
- plan de cuentas
- plantillas de asiento
- tratamiento fiscal sugerido o confirmado

**OPEN:** si el asiento depende del tratamiento fiscal confirmado o si se calcula en paralelo con iteración posterior.

---

## 7. Output esperado

```json
{
  "draft_suggestion_version": 1,
  "entry_date": "YYYY-MM-DD",
  "currency_code": "UYU",
  "lines": [
    {
      "line_number": 1,
      "account_code": "611000",
      "account_name": "Compras",
      "debit": 1000,
      "credit": 0,
      "provenance": "template_rule",
      "editable": true
    }
  ],
  "is_balanced": true,
  "confidence_score": 0.86,
  "explanation": "Sugerencia generada a partir del perfil de operación y plantilla de asiento",
  "dependencies": {
    "organization_profile_version_id": "uuid",
    "journal_template_id": "uuid",
    "tax_treatment_version": 2
  }
}
```

---

## 8. Modelo de datos sugerido

### `journal_templates`
Plantillas configurables.

Campos:
- `id`
- `organization_id` nullable
- `code`
- `label`
- `scope` (`purchase`, `sale`, `generic`)
- `conditions_json`
- `lines_template_json`
- `active`

### `document_journal_suggestions`
Sugerencias versionadas.

Campos:
- `id`
- `document_id`
- `draft_id`
- `version_number`
- `source_type` (`rule_engine`, `recalculated`, `user_edited`)
- `suggestion_json`
- `is_balanced`
- `confidence_score`
- `created_at`
- `superseded_by_id`

### `document_journal_diffs`
Diferencias entre sugerencia y edición.

Campos:
- `id`
- `journal_suggestion_id`
- `diff_json`
- `created_by`
- `created_at`

---

## 9. Reglas de negocio

1. Una sugerencia contable nunca es definitiva hasta la confirmación final.
2. Toda sugerencia MUST usar cuentas existentes del plan de cuentas del tenant.
3. Si no existe mapping suficiente, el sistema MUST generar sugerencia parcial o bloquear ese paso.
4. Si el usuario cambia importes o tratamiento fiscal, la sugerencia MUST quedar stale.
5. Si el asiento no balancea, no puede confirmarse.
6. Debe registrarse qué parte fue sugerida por regla y qué parte fue editada por usuario.

---

## 10. Compras vs ventas

El motor SHOULD soportar ambos con plantillas distintas.

### Ejemplos no vinculantes
- compras: gasto / IVA compras / proveedor
- ventas: cliente / ingreso / IVA ventas

**OPEN:** catálogo exacto de plantillas iniciales por tipo de operación.

---

## 11. UX

La UI de asiento MUST mostrar:
- líneas en tabla editable,
- estado de balance,
- explicación breve,
- origen de cada línea,
- warning si una edición invalida coherencia fiscal.

La UI SHOULD permitir:
- cambiar cuenta,
- ajustar importes,
- agregar o quitar líneas según permisos y política.

---

## 12. Validaciones

### Obligatorias
- balance débitos vs créditos,
- cuenta existente,
- cuenta activa,
- importes no negativos salvo convención definida,
- fecha válida.

### OPEN
- centros de costo obligatorios o no,
- auxiliares obligatorios o no,
- multi-moneda en V1 o no.

---

## 13. Escenarios de aceptación

### Escenario A - Compra simple
**Given** un documento de compra con importes válidos  
**And** una plantilla aplicable  
**When** se genera la sugerencia  
**Then** el sistema devuelve un asiento balanceado editable

### Escenario B - Sin plantilla
**Given** un documento clasificado  
**And** la organización sin plantilla de asiento aplicable  
**When** se intenta generar sugerencia  
**Then** el sistema muestra bloqueo explícito y no inventa cuentas

### Escenario C - Edición posterior
**Given** una sugerencia ya calculada  
**When** el usuario cambia la naturaleza fiscal  
**Then** la sugerencia se marca stale y requiere recálculo

---

## 14. Preguntas bloqueantes

1. ¿Se soportan compras y ventas desde el mismo V1 o solo compras?
2. ¿V1 usa plantillas obligatorias por organización o permite defaults globales?
3. ¿Los usuarios pueden agregar líneas manualmente?
4. ¿Se exige centro de costo?
5. ¿Se exige auxiliar de cliente/proveedor?
6. ¿Se puede confirmar asiento sin tratamiento fiscal confirmado?
7. ¿Qué políticas de edición pueden tener distintos roles?

---
