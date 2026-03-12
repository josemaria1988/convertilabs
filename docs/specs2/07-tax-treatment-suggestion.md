# Spec 07 - Sugerencia de tratamiento fiscal

**Estado:** Approved  
**Prioridad:** P1  
**Dependencias:** `01`, `03`, `04`, `05`, `09`

---

## 1. Decision cerrada

El V1 fiscal cubre solo IVA.

Incluye:

- IVA compras
- IVA ventas
- `vat_runs` mensuales

No incluye:

- IRAE
- IP
- retenciones
- BPS
- prorrata compleja

---

## 2. Regla central

La sugerencia fiscal sale de:

- perfil organizacional vigente al momento de generar el draft
- contexto de operacion
- reglas versionadas
- snapshot resumido por organizacion

No sale de pegar normativa completa dentro del prompt.

---

## 3. Salidas V1

### Compras

- `input_creditable`
- `input_non_deductible`
- `input_exempt`

### Ventas

- `output_vat` para `22%`
- `output_vat` para `10%`
- `0` para `exempt_or_export`
- `0` para `non_taxed`

---

## 4. Politica cuando falta regla

Si no hay regla activa o el caso queda fuera del catalogo:

- el sistema no inventa
- deja el draft en revision o con bloqueo
- mantiene trazabilidad al snapshot y a las refs deterministicas

---

## 5. Estado de implementacion

Implementado:

- tratamiento IVA visible en review
- explicacion
- refs deterministicas del snapshot
- persistencia dentro del draft confirmado
- alimentacion de `vat_runs`

Pendiente:

- UI normativa mas rica
- warnings y excepciones por rubro real mas detalladas
