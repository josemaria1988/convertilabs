# Spec 04 - Procesamiento de factura de venta

**Estado:** Approved  
**Prioridad:** P0  
**Dependencias:** `01`, `02`, `05`, `06`, `07`

---

## 1. Decision cerrada

La venta entra en V1.

Pero entra solo bajo este modelo:

- ingestion e interpretacion de documentos ya emitidos
- carga/import manual resumida cuando no hay archivo
- sin emision
- sin pre-emision
- sin integracion CFE en runtime

---

## 2. Alcance fiscal

Venta V1 existe para:

- calcular IVA output
- alimentar `vat_runs`
- alimentar sugerencia contable
- soportar auditoria interna/externa

No existe aun soporte para emission workflow.

---

## 3. Catalogo resumido aprobado

Categorias de venta V1:

- `taxed_basic_22`
- `taxed_minimum_10`
- `exempt_or_export`
- `non_taxed`

No hay sugerencia comercial fina. El sistema valida totales y calcula IVA output sobre ese set resumido.

---

## 4. Reglas V1

1. Compra y venta se separan desde el primer paso del draft.
2. Si falta categoria resumida de venta, no se confirma.
3. Si la venta queda en exportacion o exenta, el tratamiento queda visible y auditable, pero sigue siendo parte del dominio IVA-only.

---

## 5. Estado de implementacion

Implementado:

- soporte documental de `sale`
- categorias resumidas de venta en review
- sugerencia contable de venta
- tratamiento IVA output
- confirmacion final y trazabilidad

Pendiente:

- carga/import manual masiva de ventas
- heuristicas mas ricas para distinguir exenta vs no gravada
- validacion contra configuracion CFE real
