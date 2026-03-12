# Spec 04 - Procesamiento de factura de venta

**Estado:** Draft / Blocked  
**Prioridad:** P0  
**Dependencias:** `01`, `02`, `05`, `06`, `07`, decisión de alcance  
**Bloqueante principal:** definir si Convertilabs procesa ventas documentadas o emite ventas

---

## 1. Propósito

Definir cómo se modela y procesa la **factura de venta** dentro de Convertilabs.

Este spec existe porque la tributación no puede pensarse solo desde la compra. La venta define la salida fiscal, el tipo de comprobante, el tratamiento frente a IVA y parte de la lógica del asiento. O sea, la parte divertida de equivocarse caro.

---

## 2. Decisión de alcance aún no tomada

Antes de diseñar código, debe definirse cuál de estos modelos aplica.

### Modelo A - Ingestión / interpretación
Convertilabs recibe PDFs o representaciones de facturas de venta ya emitidas por otro sistema y:
- las clasifica,
- extrae datos,
- sugiere tratamiento y asiento,
- pero no las emite.

### Modelo B - Emisión asistida
Convertilabs genera la pre-carga de la venta y produce el documento para emisión en otro sistema o módulo.

### Modelo C - Emisión nativa
Convertilabs es emisor / integrador directo del comprobante electrónico.

**OPEN / BLOCKING:** elegir modelo del V1.

> Este spec asume por defecto una redacción compatible con A y parcialmente con B. No debe inferirse C sin decisión explícita.

---

## 3. Problemas específicos de la venta

A diferencia de la compra, una venta depende fuertemente de:

- el perfil de la organización emisora,
- el tipo de operación comercial,
- la condición del cliente,
- el comprobante habilitado,
- la naturaleza fiscal de la operación,
- la condición de exportación / exención / no gravado.

Por eso la venta no puede modelarse como “otro PDF parecido”.

---

## 4. Alcance funcional propuesto

### Incluido en el corte base
- reconocer documento de venta,
- separar venta de compra,
- precargar datos editables,
- sugerir subtipo de operación,
- sugerir asiento de ingreso / impuestos,
- sugerir tratamiento fiscal.

### Fuera de alcance hasta decisión
- emisión real de CFE,
- numeración,
- CAE / autorización,
- firma y envío,
- ciclo de contingencia,
- anulación oficial del comprobante.

---

## 5. Requisitos de datos maestros previos

Para que exista procesamiento serio de venta, la organización MUST tener:

- perfil jurídico y tributario vigente,
- condición CFE definida,
- perfiles de operación de venta configurados,
- plantillas o catálogos de tipos de documento permitidos,
- plan de cuentas para ventas e impuestos,
- políticas de exportación / exención si aplican.

---

## 6. Modelo conceptual

### 6.1 Ejes que deben separarse
- tipo documental de venta
- perfil comercial de operación
- tratamiento fiscal
- plantilla de asiento
- condición del receptor
- país / jurisdicción del receptor si impacta

### 6.2 No asumir “un solo modelo de factura”
Aunque una organización pueda tener una plantilla dominante, el sistema debe permitir múltiples perfiles de venta.

Ejemplos tentativos:
- venta local gravada
- venta local exenta
- venta exportación
- venta a consumo final
- venta B2B
- otra

**OPEN:** catálogo mínimo del V1.

---

## 7. Datos mínimos a capturar o extraer

### Del emisor (organización)
- perfil vigente
- condición CFE
- operación habilitada

### Del receptor
- nombre / denominación
- identificador fiscal si corresponde
- país
- categoría del cliente si aplica

### Del documento
- tipo de comprobante
- serie / número
- fecha
- moneda
- condición de pago

### De importes
- neto
- IVA / impuesto por componente
- total
- descuentos
- recargos

### De operación
- tipo de venta
- destino local / exterior
- gravado / exento / no gravado
- bienes / servicios / mixto

---

## 8. Reglas de negocio propuestas

1. La venta MUST resolver usando el perfil vigente de la organización a la fecha del documento.
2. Si el sistema no puede determinar la naturaleza de la operación, MUST crear draft y pedir confirmación.
3. Si el tipo de comprobante sugerido no está habilitado en el perfil de la organización, el sistema MUST marcar error de consistencia.
4. Si un cambio del usuario en datos de operación altera el tratamiento fiscal, el sistema MUST invalidar y recalcular sugerencias contables/fiscales.
5. Si la venta es de exportación o exenta, el sistema MUST exigir confirmación explícita del usuario en el paso fiscal.

---

## 9. Entidades propuestas

### `sale_operation_profiles`
Configuración por organización.

Campos:
- `id`
- `organization_profile_version_id`
- `code`
- `label`
- `document_type_catalog_json`
- `default_tax_rule_set_id`
- `default_journal_template_id`
- `active`

### `document_sale_context`
Contexto derivado del documento.

Campos:
- `document_id`
- `draft_id`
- `sale_operation_profile_code`
- `customer_role_code`
- `destination_country_code`
- `requires_manual_review`
- `review_reasons_json`

---

## 10. UX específica de venta

El wizard de venta SHOULD incluir un paso que no existe en compra o tiene menos peso:

### Paso “Naturaleza de la venta”
Campos editables:
- operación de venta
- cliente / tipo de cliente
- local / exterior
- gravado / exento / no gravado
- exportación sí/no
- documento sugerido

Este paso es obligatorio porque una misma plantilla visual de factura puede disparar tratamientos distintos.

---

## 11. Integración con emisión futura

El diseño SHOULD dejar espacio para que más adelante, si se decide, exista:

- motor de numeración,
- integración con proveedor habilitado,
- validación previa de campos,
- emisión del CFE.

Pero nada de eso debe asumirse como parte del V1 actual.

---

## 12. Escenarios de aceptación

### Escenario A - Venta procesada desde PDF existente
**Given** una factura de venta PDF  
**And** una organización con perfil de venta configurado  
**When** se procesa  
**Then** el sistema genera draft editable  
**And** sugiere subtipo de venta  
**And** sugiere asiento y tratamiento fiscal

### Escenario B - Operación incompatible con perfil
**Given** una venta marcada como exportación  
**And** la organización no tiene ese perfil habilitado  
**When** se recalculan sugerencias  
**Then** el sistema bloquea confirmación final y muestra el motivo

### Escenario C - Cambio de naturaleza en el wizard
**Given** una venta inicialmente detectada como local gravada  
**When** el usuario la cambia a exenta  
**Then** el sistema invalida sugerencias previas y obliga a recálculo

---

## 13. Preguntas bloqueantes

1. ¿V1 incluye ventas o quedan como V1.1?
2. ¿Ventas en V1 significan procesar PDFs ya emitidos, o también prearmar datos para emisión?
3. ¿Cuál es el catálogo inicial de perfiles de venta?
4. ¿Se modelará cliente / tipo de cliente desde el inicio?
5. ¿Qué tributos o tratamientos debe sugerir el V1 en ventas?
6. ¿Cómo validar que una organización está habilitada para determinado tipo de comprobante?
7. ¿Se soportarán ventas en moneda extranjera desde el primer corte?

---

## 14. Out of scope provisional

- CAE/CAF equivalentes o validación ante tercero
- firma digital
- envío al receptor
- anulación oficial del comprobante
- reporting regulatorio externo

---
