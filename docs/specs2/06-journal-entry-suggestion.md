# Spec 06 - Sugerencia de asiento contable

**Estado:** Approved with follow-up  
**Prioridad:** P1  
**Dependencias:** `01`, `03`, `04`, `05`

---

## 1. Decision cerrada

La sugerencia contable V1 es:

- estructurada
- editable a nivel draft
- trazable
- congelada al confirmar

La IA no elige cuentas libremente. El asiento sale de reglas deterministicas y catalogos resumidos.

---

## 2. Alcance V1

Incluido:

- compra
- venta
- balance basico
- explicacion
- `journal_entry` en `draft` al confirmar

No incluido:

- posting definitivo
- centro de costo obligatorio
- auxiliares obligatorios
- multimoneda

---

## 3. Catalogo V1

Compras:

- mercaderias para reventa
- servicios
- gastos administrativos
- transporte / fletes
- combustible y lubricantes
- honorarios profesionales
- alquileres

Ventas:

- ventas gravadas 22%
- ventas gravadas 10%
- ventas exentas / exportacion
- ventas no gravadas

---

## 4. Estado de implementacion

Implementado:

- sugerencia contable visible en review
- lineas, balance y explicacion
- persistencia en draft
- `accounting_suggestions`
- `journal_entries` draft al confirmar

Pendiente:

- mapping completo a `chart_of_accounts`
- lineas reales garantizadas para todos los tenants
- edicion avanzada por rol
