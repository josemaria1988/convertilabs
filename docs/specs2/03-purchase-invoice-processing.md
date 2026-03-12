# Spec 03 - Procesamiento de factura de compra

**Estado:** Draft  
**Prioridad:** P0  
**Dependencias:** `01`, `02`, `05`, `06`, `07`  
**Objetivo del corte:** convertir una factura de compra PDF en un draft utilizable, con datos editables y preparación para sugerencia contable/fiscal

---

## 1. Propósito

Definir el comportamiento de negocio para documentos que representan **facturas de compra** o equivalentes del lado proveedor -> organización.

---

## 2. Alcance del V1 propuesto

### Incluido
- PDF de factura de compra
- extracción de datos básicos
- clasificación como compra
- edición humana de campos
- sugerencia contable editable
- sugerencia fiscal editable
- confirmación final

### No incluido todavía
- órdenes de compra
- remitos sin importe
- conciliación con pagos
- matching con recepciones
- validación contra portal externo del emisor

---

## 3. Requisito central

Una factura de compra en V1 MUST pasar por este recorrido:

1. extracción técnica,
2. clasificación sugerida como documento de compra,
3. pre-carga editable,
4. sugerencia de asiento,
5. sugerencia fiscal,
6. confirmación humana.

No existe “clasificación definitiva” automática.

---

## 4. Tipos de compra a contemplar

Este punto queda **abierto** y no debe cerrarse en código sin decisión de negocio.

### Catálogos tentativos
- compra local gravada
- compra local exenta
- compra local no gravada
- compra importación
- compra de servicios del exterior
- compra de activo fijo
- otro

**OPEN:** lista exacta del V1.

---

## 5. Datos mínimos a extraer

### 5.1 Campos del emisor
- nombre / razón social
- identificador fiscal del emisor
- país del emisor si aplica

### 5.2 Campos del documento
- tipo de comprobante
- serie
- número
- fecha de emisión
- fecha de vencimiento si existe
- moneda
- observaciones libres

### 5.3 Importes
- subtotal
- IVA por tasa o por componente detectado
- total
- otros cargos / descuentos si existen

### 5.4 Campos contextuales
- condición de compra estimada
- si parece operación local / exterior
- si parece bien / servicio / mixto

**OPEN:** si V1 exige extracción de líneas de detalle del documento.

---

## 6. Clasificación de compra

El sistema MUST resolver al menos estas capas:

### 6.1 Rol documental
`purchase`

### 6.2 Tipo documental
Ejemplos:
- invoice
- credit_note
- debit_note
- receipt
- ticket

### 6.3 Subtipo de compra
Ejemplos:
- local_taxed
- local_exempt
- import
- export_related_input
- service_from_abroad

**OPEN:** si la capa 6.3 vive aquí o se delega al motor fiscal.

---

## 7. Reglas de negocio

1. Si el documento no puede diferenciarse claramente entre compra y venta, MUST quedar como sugerencia editable y warning visible.
2. Si faltan importes básicos, el draft igual debe existir, pero con bloqueo para asiento y tratamiento final.
3. Si los importes no cierran matemáticamente, el draft MUST quedar con inconsistencia visible.
4. Si el proveedor ya existe en master data, el sistema SHOULD usarlo para enriquecer la sugerencia.
5. Si la organización no tiene perfil contable configurado, la sugerencia fiscal puede correr, pero la contable no debe confirmarse.
6. Si la organización no tiene perfil fiscal suficiente, la sugerencia fiscal no debe presentarse como “lista para confirmar”.

---

## 8. Modelo de datos adicional sugerido

### `purchase_document_profiles`
Catálogo o configuración de tipos de compra.

Campos:
- `id`
- `organization_id` nullable
- `code`
- `label`
- `active`
- `default_tax_rule_set_id`
- `default_journal_template_id`

### `document_purchase_context`
Contexto derivado del documento.

Campos:
- `document_id`
- `draft_id`
- `purchase_profile_code`
- `supplier_id` nullable
- `is_import`
- `is_fixed_asset_candidate`
- `requires_manual_review`
- `review_reasons_json`

---

## 9. UX del flujo de compra

### Paso 1 - Identificación del documento
El modal debe mostrar:
- preview
- “Esto parece una factura de compra”
- score
- posibilidad de cambiar a otro tipo

### Paso 2 - Datos de cabecera
Inputs editables:
- emisor
- RUT / identificador
- fecha
- moneda
- número
- tipo documental

### Paso 3 - Importes
Inputs editables:
- subtotal
- IVA
- total
- otros

### Paso 4 - Naturaleza de la compra
Inputs o selects:
- tipo de compra
- local / exterior
- bien / servicio
- activo fijo / gasto

### Paso 5 - Sugerencias
- asiento
- tratamiento fiscal

### Paso 6 - Confirmación final
Resumen consolidado.

---

## 10. Dependencias funcionales

La factura de compra depende de:

- perfil organizacional vigente,
- perfil contable de la organización,
- taxonomía mínima de tipos de compra,
- base normativa activa,
- wizard de draft editable.

---

## 11. Criterios de aceptación

### Escenario A - Compra local simple
**Given** una factura de compra PDF con datos legibles  
**When** el pipeline termina  
**Then** el documento queda en `draft_ready`  
**And** el usuario ve datos pre-cargados editables  
**And** puede confirmar al final

### Escenario B - Inconsistencia matemática
**Given** un documento donde subtotal + impuestos != total  
**When** se construye el draft  
**Then** el sistema muestra warning  
**And** no impide la edición  
**But** impide confirmación final hasta corregir o justificar según política

### Escenario C - Perfil fiscal insuficiente
**Given** una compra correctamente extraída  
**And** la organización no tiene condición fiscal suficiente  
**When** se abre el wizard  
**Then** el paso fiscal se muestra bloqueado con motivo explícito

---

## 12. No objetivos de este spec

- validar contablemente el gasto deducible en sentido amplio
- resolver amortizaciones de activo fijo
- automatizar impuestos patrimoniales
- confirmar compras por AI sin revisión

---

## 13. Open questions

1. ¿V1 compra incluye importaciones?
2. ¿V1 compra incluye servicios del exterior?
3. ¿V1 compra requiere líneas de detalle o solo cabecera + totales?
4. ¿Cuál es la taxonomía inicial de tipos de compra?
5. ¿Qué campos son obligatorios para confirmar una compra?
6. ¿Habrá matching con proveedor existente por RUT?
7. ¿Cómo se trata una factura de compra con varias tasas o conceptos fiscales?

---
