# specs-driven-development-steps5.md

## Objetivo

Implementar una evolución del flujo contable/fiscal para Convertilabs que:

1. destrabe el MVP de liquidación de IVA;
2. mantenga trazabilidad fuerte;
3. permita operar aun cuando falte clasificación contable fina;
4. soporte importación inteligente de planes de cuentas desde planillas heterogéneas;
5. deje la base lista para otros impuestos y cierre anual;
6. incorpore correctamente la capa bimonetaria Uruguay (UYU/USD) con persistencia del tipo de cambio fiscal usado;
7. reencuadre el MVP como capa de conciliación y decisión fiscal sobre CFE/DGI, sin competir con DGI como simple resumen de IVA ni exigir migración de ERP;
8. incorpore una capa determinística de razonabilidad geográfica para ayudar a decidir deducibilidad, viáticos y revisión manual sin depender de APIs pagas.

---

## Decisión de producto adoptada

### Decisión principal

Adoptar un híbrido de:

- mejor setup inicial,
- separación entre madurez documental/fiscal y resolución contable final,
- posteo provisional controlado,
- aprendizaje provisional con promoción posterior.

### Lo que sí se hará

1. Mantener la IA acotada a `schemas`, `allowed sets` y validaciones.
2. Mantener la determinística fuerte para:
   - identidad documental,
   - duplicados,
   - tratamiento IVA,
   - validación de journal,
   - tipo de cambio fiscal.
3. Permitir `posted_provisional` cuando el documento ya está fiscalmente entendido y el journal está balanceado, aun si la cuenta principal definitiva todavía no existe.
4. Hacer que el VAT run tome documentos en `posted_provisional` y `posted_final`.
5. Conservar `posted_final` para aprendizaje aprobado, reporting fino y cierres.
6. Agregar un plan de cuentas estándar del sistema, importador-friendly y NIIF-ready.
7. Agregar importación inteligente de plan de cuentas desde XLSX/CSV con IA + schema estricto.
8. Persistir montos originales y montos convertidos a UYU con tipo de cambio fiscal trazable.
9. Agregar validación determinística de geolocalización por departamento/ciudad con dataset offline de Uruguay.
10. Tratar la geolocalización como señal de riesgo y evidencia de razonabilidad, no como sustituto del criterio contable/tributario humano.

### Lo que no se hará

1. No permitir que la IA invente cuentas o asientos fuera del set permitido.
2. No usar un “plan oficial del MEF” porque para empresas privadas generales el MEF publica normas contables adecuadas, no un plan universal obligatorio.
3. No meter el mapping final a líneas DGI dentro del motor contable central.
4. No usar sólo una confirmación monolítica para todo el downstream.
5. No usar el tipo de cambio “del mismo día de factura” como regla fiscal automática: se debe modelar la regla normativa y guardar la fecha BCU realmente usada.
6. No posicionar el producto como reemplazo del ERP del cliente ni como un duplicado del resumen fiscal de DGI.
7. No tratar la distancia como una regla legal dura de DGI: debe modelarse como señal de riesgo auditable.
8. No depender de Google Maps ni APIs pagas en el hot path documental.
9. No negar el crédito fiscal únicamente por geografía sin posibilidad de justificación documentada y override auditado.

---

## Reencuadre estratégico del MVP frente a DGI

### Hallazgo que cambia el pitch, no el problema de fondo

La DGI ya ofrece consulta de CFE recibidos y formularios de IVA con datos precargados que el contribuyente puede confirmar o modificar.

Consecuencia: el MVP no debe venderse como una simple “sumadora prolija de CFE para saber cuánto IVA da el mes”. Ese valor, por sí solo, ya quedó parcialmente cubierto por la fuente fiscal.

### Tesis de producto adoptada

Convertilabs no compite con DGI como resumen fiscal ni con el ERP del cliente como contabilidad general.

Convertilabs se posiciona como la capa intermedia que:

1. concilia el universo documental propio contra lo que ve DGI;
2. decide el tratamiento del crédito fiscal de IVA;
3. resuelve excepciones documentales, fiscales y contables;
4. deja evidencia y trazabilidad de cada decisión;
5. exporta el resultado al sistema existente del cliente sin exigir migración.

### Qué DGI no resuelve sola y debe resolver Convertilabs

1. IVA compras directo vs indirecto.
2. Deducible vs no deducible.
3. Prorrata / porcentual / distribución del indirecto cuando corresponda.
4. Diferencias entre comprobantes realmente procesados por la empresa y los totales precargados o consultables en DGI.
5. Propósito económico/operativo del gasto o compra.
6. Cuenta destino o template contable que debe alimentarse en el ERP del cliente.
7. Open items, deuda con proveedores, vencimientos, importaciones vinculadas y demás efectos operativos.
8. Razonabilidad geográfica del gasto y evidencia contextual de propósito empresarial.

### Nueva definición del MVP

El MVP ya no se mide por “calcular el IVA mensual desde cero”.

El MVP se mide por lograr, para cada período:

1. conciliación entre documentos procesados y baseline DGI;
2. clasificación correcta del IVA compras utilizable;
3. separación entre directo, indirecto, no deducible y casos de prorrata;
4. explicación auditable de las diferencias;
5. exportación lista para el sistema contable existente.

### Métrica principal de éxito

`Concilié 100% de los CFE relevantes contra DGI, resolví el crédito fiscal correcto y exporté el resultado sin obligar al cliente a cambiar de sistema.`

### Restricción de alcance derivada

No convertir Convertilabs en un ERP generalista como respuesta al hallazgo de DGI.

Sí convertirlo en:
- capa de decisión fiscal,
- capa de conciliación,
- capa de estructuración/exportación,
- y puente entre documentos, DGI y el sistema contable del cliente.

### Nueva cuña adicional: razonabilidad geográfica

La geolocalización no entra como una regla legal autónoma de DGI del tipo “si está a X km entonces no deduce”.

Entra como una señal de razonabilidad y de riesgo fiscal/contable que ayuda a responder preguntas que hoy muchos contadores resuelven “a ojo”:

- ¿la ubicación del emisor parece compatible con el uso empresarial declarado?
- ¿esto parece compra operativa, viático, gasto de representación o gasto personal?
- ¿corresponde pedir justificación antes de tomar el IVA como deducible?

Por diseño, esta capa debe:

1. ser determinística y barata;
2. correr offline con datos de Uruguay;
3. producir warning, evidencia y sugerencia;
4. no reemplazar el juicio profesional ni la política fiscal de la organización.

---

## Contexto del repo actual que se debe respetar

Del workflow actual ya surge que:

- existen `starter accounts`;
- ya existe creación inline de cuenta desde la review;
- la segunda IA contable sólo opera si hay `allowedAccounts`;
- la segunda IA no es un generador libre de asientos;
- hoy la confirmación dispara journal, aprendizaje, open items, logs de IA y VAT run;
- hoy varios bloqueos aparecen mezclados en una sola tarjeta;
- hoy la confirmación exige demasiada madurez contable demasiado temprano.

Por lo tanto, este rediseño debe extender el flujo existente y no demolerlo.

## Capa determinística de geolocalización fiscal

### Decisión adoptada

Implementar una primera versión simple, robusta y barata basada en `departamento + ciudad`, corriendo offline con datos oficiales de Uruguay.

### Motivo

El objetivo no es “hacer mapas”. El objetivo es automatizar una prueba de razonabilidad que muchos contadores hoy hacen manualmente al mirar supermercado, restaurante, farmacia, hotel, peaje o tickets similares.

### Diseño elegido

#### Fase 1 — Offline y suficiente para el piloto

Comparar:

- `organization.fiscal_department`
- `organization.fiscal_city`
- `document.issuer_department`
- `document.issuer_city`
- `vendor.merchant_category_hint`

Con eso alcanza para generar señales útiles en la mayoría de los casos del piloto, sin costo operativo externo.

#### Fase 2 — Mejoras opcionales

Agregar cuando exista evidencia suficiente:

- lat/long de la organización;
- lat/long del emisor/sucursal;
- distancia geodésica;
- branch mapping por proveedor recurrente.

#### Fase 3 — Nunca en el hot path inicial

No llamar a APIs pagas ni a geocodificación online en cada documento.

Si en el futuro se usa un servicio de geocodificación, debe ser sólo para enriquecimiento asíncrono y cacheado.

### Principios de implementación

1. `department mismatch` es una señal fuerte pero no una condena automática.
2. `same department + different city` es señal media y se usa para revisión contextual.
3. La categoría del proveedor pesa tanto como la distancia.
4. La política final la define la organización y puede ser más o menos conservadora.
5. Toda decisión derivada de esta capa debe dejar auditoría y explicación visible.

---

## Modelo objetivo: separación de poderes

### 1. Chart of Accounts

La cuenta contable deja de ser el lugar donde viven todas las decisiones del universo.

Campos mínimos propuestos:

- `id`
- `organization_id`
- `code`
- `name`
- `type` (`asset`, `liability`, `equity`, `revenue`, `expense`)
- `postable`
- `is_provisional`
- `normal_balance`
- `source` (`system`, `starter`, `preset`, `imported`, `manual`)
- `external_code`
- `statement_section`
- `nature_tag`
- `function_tag`
- `cashflow_tag`
- `tax_profile_hint`
- `currency_policy` (`mono_currency`, `multi_currency`, `revaluation_required`)
- `active`

### 2. Tax Profiles

Capa fiscal reusable. No decide la cuenta; decide el tratamiento tributario.

Ejemplos:

- `UY_VAT_PURCHASE_BASIC`
- `UY_VAT_PURCHASE_MINIMUM`
- `UY_VAT_PURCHASE_EXEMPT`
- `UY_VAT_SALE_BASIC`
- `UY_VAT_SALE_MINIMUM`
- `UY_VAT_EXPORT`
- `UY_VAT_IMPORT_CREDITABLE`
- `UY_VAT_IMPORT_SUSPENSO`
- `UY_VAT_IMPORT_ANTICIPO`
- `UY_VAT_NON_DEDUCTIBLE`

Campos mínimos:

- `code`
- `document_role`
- `document_type_scope`
- `vat_rate`
- `is_creditable`
- `is_export_related`
- `is_import_related`
- `requires_linked_import_operation`
- `result_kind`
- `default_dgi_mapping_key`
- `block_if_missing_fx_rate`

### 3. Journal Templates

Esqueletos con slots, no asientos rígidos por cuenta fija.

Ejemplos:

- compra local gravada
- compra local tasa mínima
- venta local gravada
- exportación
- importación mercadería proveedor exterior
- liquidación DUA / gastos de importación
- importación de activo fijo
- nota de crédito compra
- nota de crédito venta

Campos mínimos:

- `template_code`
- `document_role`
- `operation_family`
- `lines[]`
- `required_slots[]`
- `allows_provisional_main_account`
- `requires_fx_context`
- `default_tax_profile_code`

### 4. Learning Rules

Puente entre el mundo del documento y la resolución reusable.

Campos mínimos:

- `id`
- `organization_id`
- `scope` (`document_override`, `vendor_concept`, `concept_global`, `vendor_default`)
- `status` (`candidate`, `provisional`, `approved`)
- `vendor_id`
- `concept_id`
- `template_code`
- `account_id`
- `tax_profile_code`
- `source_document_id`
- `confidence`
- `times_reused`
- `times_corrected`
- `last_applied_at`

---
### 5. Location Risk Signals

Capa determinística auxiliar. No decide sola la deducibilidad; produce señal de riesgo y puede exigir justificación.

Objetivos:

- elevar precisión en deducible / no deducible;
- distinguir mejor entre gasto operativo, viático, representación y gasto personal probable;
- dar tranquilidad a contadores conservadores sin llenar el sistema de criterios mágicos.

Fuentes de evidencia:

- domicilio fiscal de la organización;
- dirección/ciudad/departamento del emisor extraídos del documento;
- código de sucursal/local cuando el documento lo muestre;
- padrón offline de localidades y, más adelante, direcciones geográficas oficiales de Uruguay.

Salida mínima del engine:

- `none`
- `same_city`
- `same_department_other_city`
- `other_department`
- `distance_outlier`
- `travel_pattern`
- `sensitive_merchant_far_from_base`
- `missing_location_evidence`

Campos mínimos asociados:

- `location_signal_code`
- `location_signal_severity` (`info`, `warning`, `high`)
- `location_signal_payload`
- `requires_business_purpose_review`
- `business_purpose_note`
- `suggested_expense_family`
- `suggested_tax_profile_code`

Reglas de producto:

1. La geografía es evidencia contextual, no sentencia tributaria automática.
2. Para rubros sensibles (`supermercado`, `restaurante`, `farmacia`, `retail_general`) y señal fuerte, el sistema debe exigir revisión o justificación antes de `posted_final`.
3. Para rubros naturalmente itinerantes (`hotel`, `peaje`, `combustible_ruta`, `pasajes`, `logística`) la misma señal puede sugerir `viático` o `travel_pattern`, no necesariamente `no_deducible`.
4. El criterio debe ser parametrizable por organización y por categoría de proveedor.
5. La primera versión debe comparar principalmente `departamento` y `ciudad`; la distancia geodésica exacta queda como mejora opcional cuando ambas ubicaciones estén geocodificadas con suficiente confianza.

---

## Nuevo lifecycle de documentos

No reemplazar el `documents.status` actual. Agregar una dimensión ortogonal: `posting_status`.

### `posting_status`

Valores:

- `draft`
- `vat_ready`
- `posted_provisional`
- `posted_final`
- `locked`

### Significado exacto

#### `draft`
Documento todavía en revisión o con bloqueos duros.

#### `vat_ready`
Documento ya quedó entendido documental y fiscalmente, pero todavía no tiene un journal persistido que alimente downstream.

Uso:
- estado intermedio útil para UX
- no alimenta VAT run por sí solo

#### `posted_provisional`
Documento con journal balanceado y persistido, pero con al menos una cuenta provisional o una resolución contable todavía no promovida a final.

Uso:
- sí alimenta VAT run
- sí permite trazabilidad fiscal
- sí permite open items cuando corresponda
- no promueve aprendizaje fuerte
- debe aparecer en bandeja de recategorización

#### `posted_final`
Documento con journal final, cuentas definitivas y aprendizaje aprobable.

Uso:
- sí alimenta VAT run
- sí alimenta reporting contable final
- sí puede disparar aprendizaje `approved`
- sí sirve para cierres y analytics contables

#### `locked`
Documento inmovilizado por cierre de período u otro lock operativo.

---

## Regla central para el IVA

### Regla adoptada

El VAT run debe alimentarse desde:

- `posted_provisional`
- `posted_final`

### Regla rechazada

No usar `vat_ready` como fuente suficiente del VAT run.

Motivo:
si el documento no tiene journal persistido, se vuelve más difícil mantener coherencia entre:
- base imponible,
- IVA,
- open items,
- exportaciones,
- reaperturas,
- reaplicación de reglas,
- auditoría.

---

## Cuentas provisionales del sistema

Estas cuentas deben existir siempre.

### System / starter accounts mínimas actuales

Mantener:

- `SYS-AR`
- `SYS-AP`
- `SYS-VAT-IN`
- `SYS-VAT-OUT`
- `GEN-SALE`
- `GEN-EXP`

### Nuevas cuentas provisionales obligatorias

Agregar:

- `TEMP-EXP` — gasto por clasificar
- `TEMP-REV` — ingreso por clasificar
- `TEMP-INV` — inventario / mercadería por clasificar
- `TEMP-AST` — activo por clasificar
- `TEMP-LIA` — pasivo por clasificar

Todas con:

- `is_provisional = true`
- `postable = true`
- `source = system`
- `active = true`

---

## Plan de cuentas estándar del sistema

## Nombre comercial interno del preset

`Convertilabs Uruguay NIIF-ready / Importadores`

### Principios del preset

1. No se presenta como plan oficial universal.
2. Está alineado con normas contables adecuadas vigentes en Uruguay.
3. Está pensado para empresas comerciales/industriales/importadoras no reguladas por planes sectoriales del BCU.
4. Prioriza:
   - IVA compras / ventas,
   - importaciones,
   - multi-moneda,
   - inventarios,
   - activo fijo,
   - reporting futuro.

---

## Estructura propuesta del preset

### 1. Activo corriente

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 1.1.1.01 | Caja UYU | asset | no | cash |
| 1.1.1.02 | Bancos UYU | asset | no | cash |
| 1.1.1.03 | Bancos USD | asset | no | cash_fx |
| 1.1.1.04 | Valores a depositar | asset | no | cash |
| 1.1.2.01 | Créditos por ventas plaza | asset | no | receivables |
| 1.1.2.02 | Documentos a cobrar | asset | no | receivables |
| 1.1.2.03 | Deudores varios | asset | no | receivables_other |
| 1.1.2.04 | Anticipos a proveedores | asset | no | advances |
| 1.1.3.01 | IVA compras plaza crédito fiscal | asset | no | vat_input |
| 1.1.3.02 | IVA importación crédito fiscal | asset | no | vat_input_import |
| 1.1.3.03 | Anticipo IVA importación recuperable | asset | no | vat_advance_import |
| 1.1.3.04 | Otras percepciones / retenciones recuperables | asset | no | tax_credit |
| 1.1.4.01 | Mercaderías | asset | no | inventory |
| 1.1.4.02 | Materias primas e insumos | asset | no | inventory |
| 1.1.4.03 | Repuestos | asset | no | inventory_spares |
| 1.1.4.04 | Mercaderías en tránsito | asset | no | inventory_in_transit |
| 1.1.4.05 | Gastos de importación a distribuir | asset | no | import_cost_pool |
| 1.1.5.01 | Gastos pagados por adelantado | asset | no | prepaid |
| 1.1.5.02 | Seguros pagados por adelantado | asset | no | prepaid |

### 1.2 Activo no corriente

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 1.2.1.01 | Maquinaria y equipos | asset | no | ppe |
| 1.2.1.02 | Rodados | asset | no | ppe |
| 1.2.1.03 | Muebles y útiles | asset | no | ppe |
| 1.2.1.04 | Equipos informáticos | asset | no | ppe |
| 1.2.1.05 | Mejoras en inmuebles arrendados | asset | no | ppe |
| 1.2.1.06 | Activo fijo en curso / importado en montaje | asset | no | ppe_cip |
| 1.2.9.01 | Depreciación acumulada maquinaria y equipos | asset | no | contra_asset |
| 1.2.9.02 | Depreciación acumulada rodados | asset | no | contra_asset |
| 1.2.9.03 | Depreciación acumulada muebles y útiles | asset | no | contra_asset |
| 1.2.9.04 | Depreciación acumulada equipos informáticos | asset | no | contra_asset |

### 2. Pasivo corriente

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 2.1.1.01 | Proveedores plaza | liability | no | payables |
| 2.1.1.02 | Proveedores del exterior | liability | no | payables_fx |
| 2.1.1.03 | Documentos a pagar | liability | no | payables |
| 2.1.1.04 | Acreedores varios / despachante a rendir | liability | no | payables_other |
| 2.1.2.01 | IVA ventas débito fiscal | liability | no | vat_output |
| 2.1.2.02 | IVA a pagar / saldo de liquidación | liability | no | vat_payable |
| 2.1.2.03 | Retenciones y percepciones por pagar | liability | no | tax_payable |
| 2.1.2.04 | Anticipos de clientes | liability | no | advances_received |
| 2.1.2.05 | Tributos aduaneros a pagar | liability | no | customs_payable |
| 2.1.2.06 | Diferencias de cambio realizadas a pagar | liability | no | fx_result_short |

### 2.2 Pasivo no corriente

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 2.2.1.01 | Préstamos y obligaciones financieras LP | liability | no | debt_long |
| 2.2.1.02 | Pasivo por arrendamientos LP | liability | no | lease_long |

### 3. Patrimonio

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 3.1.1.01 | Capital integrado | equity | no | equity |
| 3.1.2.01 | Reservas | equity | no | equity |
| 3.1.3.01 | Resultados acumulados | equity | no | retained_earnings |
| 3.1.3.02 | Resultado del ejercicio | equity | no | current_year_result |

### 4. Ingresos

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 4.1.1.01 | Ventas plaza tasa básica | revenue | no | sales_basic |
| 4.1.1.02 | Ventas plaza tasa mínima | revenue | no | sales_minimum |
| 4.1.1.03 | Ventas exentas / no gravadas | revenue | no | sales_exempt |
| 4.1.1.04 | Exportaciones | revenue | no | export_sales |
| 4.1.2.01 | Servicios gravados | revenue | no | services |
| 4.1.9.01 | Descuentos y devoluciones sobre ventas | revenue | no | contra_revenue |
| 4.1.9.02 | Diferencias de cambio realizadas ganadas | revenue | no | fx_gain |

### 5. Costos y gastos

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| 5.1.1.01 | Costo de ventas mercaderías | expense | no | cogs |
| 5.1.1.02 | Consumo de materias primas e insumos | expense | no | cogs |
| 5.1.1.03 | Variación de inventarios | expense | no | inventory_variation |
| 5.1.2.01 | Gastos de importación no capitalizables | expense | no | import_expense |
| 5.1.2.02 | Fletes y seguros de compra no capitalizables | expense | no | import_expense |
| 5.2.1.01 | Sueldos y cargas | expense | no | admin_expense |
| 5.2.1.02 | Honorarios profesionales | expense | no | admin_expense |
| 5.2.1.03 | Arrendamientos | expense | no | admin_expense |
| 5.2.1.04 | Electricidad, agua y telecomunicaciones | expense | no | admin_expense |
| 5.2.1.05 | Papelería y gastos generales | expense | no | admin_expense |
| 5.2.1.06 | Reparaciones y mantenimiento | expense | no | admin_expense |
| 5.2.1.07 | Fletes y distribución ventas | expense | no | selling_expense |
| 5.2.1.08 | Comisiones de ventas | expense | no | selling_expense |
| 5.2.1.09 | Gastos bancarios | expense | no | finance_expense |
| 5.2.1.10 | Intereses perdidos | expense | no | finance_expense |
| 5.2.1.11 | Diferencias de cambio realizadas perdidas | expense | no | fx_loss |
| 5.2.2.01 | Depreciación maquinaria y equipos | expense | no | depreciation |
| 5.2.2.02 | Depreciación rodados | expense | no | depreciation |
| 5.2.2.03 | Depreciación muebles y útiles | expense | no | depreciation |
| 5.2.2.04 | Depreciación equipos informáticos | expense | no | depreciation |

### 9. Cuentas técnicas del sistema

| Código | Nombre | Tipo | Provisional | Tag principal |
| --- | --- | --- | --- | --- |
| SYS-AR | Accounts Receivable del sistema | asset | no | system |
| SYS-AP | Accounts Payable del sistema | liability | no | system |
| SYS-VAT-IN | VAT Input Creditable del sistema | asset | no | system |
| SYS-VAT-OUT | VAT Output Payable del sistema | liability | no | system |
| GEN-SALE | Ingreso genérico starter | revenue | no | system_generic |
| GEN-EXP | Gasto genérico starter | expense | no | system_generic |
| TEMP-EXP | Gasto por clasificar | expense | sí | provisional |
| TEMP-REV | Ingreso por clasificar | revenue | sí | provisional |
| TEMP-INV | Inventario por clasificar | asset | sí | provisional |
| TEMP-AST | Activo por clasificar | asset | sí | provisional |
| TEMP-LIA | Pasivo por clasificar | liability | sí | provisional |

---

## Reglas contables importantes para importadores

### Regla 1
El IVA importación recuperable no debe capitalizarse al costo del inventario ni del activo fijo cuando sea crédito fiscal deducible. Debe ir a una cuenta de crédito fiscal.

### Regla 2
Los aranceles, otros impuestos no recuperables y los costos directamente atribuibles a traer la mercadería a su ubicación y condición sí pueden integrar el costo de inventarios.

### Regla 3
En activos fijos importados, los costos directamente atribuibles a poner el activo en condiciones de uso deben capitalizarse en el activo fijo o en activo fijo en curso.

### Regla 4
`Anticipo IVA importación` no debe tratarse como universal. Debe quedar parametrizado por régimen/perfil fiscal y con cuenta específica sólo cuando aplique.

### Regla 5
Deben existir cuentas separadas para:
- proveedor exterior,
- mercadería en tránsito,
- IVA importación crédito fiscal,
- gastos de importación a distribuir,
- diferencias de cambio.

---

## Journal templates estándar

## T1. Compra local gravada 22%

Plantilla:

- Dr `main_purchase_slot`
- Dr `vat_input_slot`
- Cr `ap_slot`

Condiciones:
- `main_purchase_slot` puede resolver a inventario, gasto o activo fijo según contexto
- si no hay cuenta definitiva, puede resolver a `TEMP-EXP`, `TEMP-INV` o `TEMP-AST`

## T2. Venta local gravada 22%

Plantilla:

- Dr `ar_slot`
- Cr `main_revenue_slot`
- Cr `vat_output_slot`

## T3. Compra local tasa mínima

Igual que T1, pero con perfil fiscal de tasa mínima.

## T4. Nota de crédito compra

Plantilla inversa de T1.

## T5. Nota de crédito venta

Plantilla inversa de T2.

## T6. Factura proveedor exterior por mercadería

Plantilla:

- Dr `inventory_in_transit_slot`
- Cr `foreign_supplier_slot`

Observación:
todavía no nace el IVA importación por la sola factura comercial exterior; el impacto tributario local relevante aparecerá normalmente con la operación aduanera / DUA.

## T7. DUA / liquidación aduanera de importación de mercadería

Plantilla:

- Dr `inventory_in_transit_slot` por tributos/costos no recuperables y costos directamente atribuibles
- Dr `vat_import_credit_slot` por IVA importación recuperable cuando corresponda
- Dr `vat_import_advance_slot` por anticipo IVA importación cuando corresponda
- Cr `customs_payable_slot` o `bank_slot` o `broker_payable_slot`

## T8. Recepción definitiva en stock

Plantilla:

- Dr `inventory_slot`
- Cr `inventory_in_transit_slot`

## T9. Importación de activo fijo

Plantilla:

- Dr `ppe_in_progress_slot`
- Dr `vat_import_credit_slot` cuando corresponda
- Cr `foreign_supplier_slot` / `customs_payable_slot` / `bank_slot`

## T10. Reclasificación de provisional a final

Plantilla:

- Dr / Cr cuenta final
- Cr / Dr cuenta provisional
- sin tocar el tax profile ya consolidado salvo reapertura deliberada

---

## Capa bimonetaria y tipo de cambio BCU

## Decisión funcional

Toda factura/documento debe guardar:

- moneda original del documento,
- montos originales en moneda documento,
- montos fiscales convertidos a UYU,
- tipo de cambio utilizado,
- fecha BCU usada,
- origen del tipo de cambio,
- evidencia del tipo de cambio informado por el comprobante cuando exista.

## Regla fiscal adoptada

Para operaciones en moneda extranjera, la conversión a UYU para fines fiscales debe seguir la regla normativa aplicable y persistir la fecha efectivamente utilizada.

### Política base para USD y monedas extranjeras

Guardar:

- `document_currency_code`
- `document_net_amount_original`
- `document_tax_amount_original`
- `document_total_amount_original`
- `fx_rate_policy_code = dgi_previous_business_day_interbank`
- `fx_rate_bcu_value`
- `fx_rate_bcu_date_used`
- `fx_rate_bcu_series`
- `fx_rate_document_value` (si el CFE lo informa)
- `fx_rate_document_date` (si surge del documento)
- `fx_rate_source` (`bcu`, `cfe`, `manual_override`)
- `fx_rate_override_reason`
- `net_amount_uyu`
- `tax_amount_uyu`
- `total_amount_uyu`

### Regla de aplicación

1. Detectar la fecha de operación / fecha documento.
2. Buscar cotización BCU exigida por política fiscal.
3. Si para la fecha requerida no hay cotización, usar el último día hábil anterior.
4. Persistir la cotización usada y su fecha.
5. Si el comprobante es CFE y trae tipo de cambio informado, persistir también ese valor.
6. Si el tipo de cambio del documento y el tipo de cambio fiscal difieren por encima del umbral permitido, mostrar warning o blocker según política.
7. El motor de IVA debe usar siempre los montos en UYU convertidos según la política fiscal.
8. El libro contable debe conservar además los montos originales para diferencias de cambio y conciliaciones.

### Regla operativa extra

No usar como única fuente el tipo de cambio digitado por el usuario.
Debe ser sólo:
- importado desde CFE,
- obtenido desde BCU,
- o manual override con motivo y auditoría.

---

## Estados y comportamiento multi-moneda

### Documento en USD, compra local o importación

- se conserva original en USD,
- se convierte a UYU para IVA,
- el journal puede llevar:
  - importe local en UYU para rubros tributarios,
  - importe original y moneda para saldo abierto,
  - metadata FX para revaluación futura.

### Open items

Los open items deben guardar:

- `original_currency`
- `original_amount`
- `functional_amount_uyu_at_origin`
- `fx_rate_origin`
- `fx_rate_origin_date`

### Diferencia de cambio

No resolver automáticamente por IVA.
Debe quedar preparada para futuras liquidaciones contables y cierre.

---

## Cambios de base de datos

## 1. `documents`

Agregar:

- `posting_status`
- `vat_ready_at`
- `posted_provisional_at`
- `posted_final_at`
- `document_currency_code`
- `document_net_amount_original`
- `document_tax_amount_original`
- `document_total_amount_original`
- `net_amount_uyu`
- `tax_amount_uyu`
- `total_amount_uyu`
- `fx_rate_policy_code`
- `fx_rate_bcu_value`
- `fx_rate_bcu_date_used`
- `fx_rate_bcu_series`
- `fx_rate_document_value`
- `fx_rate_document_date`
- `fx_rate_source`
- `fx_rate_override_reason`

## 2. `chart_of_accounts`

Agregar:

- `is_provisional`
- `source`
- `external_code`
- `statement_section`
- `nature_tag`
- `function_tag`
- `cashflow_tag`
- `tax_profile_hint`
- `currency_policy`

## 3. `accounting_rules`

Agregar:

- `status`
- `source_document_id`
- `template_code`
- `tax_profile_code`
- `times_reused`
- `times_corrected`

## 4. `journal_entries`

Agregar:

- `posting_mode` (`provisional`, `final`)
- `functional_currency` (default UYU)
- `source_currency_present`
- `fx_rate_bcu_value`
- `fx_rate_bcu_date_used`

## 5. `journal_entry_lines`

Agregar:

- `original_currency_code`
- `original_amount`
- `functional_amount_uyu`
- `fx_rate_applied`

## 6. `ledger_open_items`

Agregar:

- `original_currency_code`
- `original_amount`
- `functional_amount_origin_uyu`
- `fx_rate_origin`
- `fx_rate_origin_date`

## 7. `organization_spreadsheet_import_runs`

Agregar o confirmar campos para:

- `import_type`
- `ai_parse_status`
- `ai_parse_payload`
- `normalized_payload`
- `error_report`

## 8. `organization_profile_versions`

Agregar:

- `fiscal_address_text`
- `fiscal_department`
- `fiscal_city`
- `fiscal_postal_code`
- `fiscal_lat`
- `fiscal_long`
- `location_risk_policy` (`soft_warn`, `warn_and_require_note`, `suggest_non_deductible`)
- `travel_radius_km_policy` (nullable; no usar en v1 como regla única)

## 9. `vendors`

Agregar:

- `fiscal_address_text`
- `fiscal_department`
- `fiscal_city`
- `fiscal_lat`
- `fiscal_long`
- `issuer_branch_code`
- `merchant_category_hint`
- `location_confidence`

## 10. `document_drafts` o tabla equivalente de facts persistidos

Persistir, cuando surjan del intake:

- `issuer_address_raw`
- `issuer_department`
- `issuer_city`
- `issuer_branch_code`
- `location_signal_code`
- `location_signal_severity`
- `location_signal_payload`
- `requires_business_purpose_review`
- `business_purpose_note`

## 11. `document_accounting_contexts` o tabla equivalente

Agregar reason code nuevo:

- `location_outlier`
- `travel_pattern`
- `sensitive_merchant_far_from_base`

## 12. Nueva tabla seed/local registry

Crear:

- `uy_locations`

Campos mínimos:

- `department`
- `city`
- `postal_code`
- `lat`
- `long`
- `source`
- `source_version`

Opcional futura:

- `vendor_branch_locations` para mapear sucursales recurrentes a ubicación validada.

---

## Módulos a tocar

## Módulos existentes a modificar

### `modules/accounting/starter-accounts.ts`
Extender para sembrar:
- starter actuales,
- provisionales,
- preset estándar si la organización opta por él.

### `modules/accounting/repository.ts`
Agregar soporte a:
- nuevas columnas de cuentas,
- seeding de presets,
- búsqueda por `external_code`,
- promoción de cuentas importadas.

### `modules/accounting/runtime.ts`
Cambiar `allowedAccounts` por `allowedTargets`:
- cuentas reales
- starter
- provisionales
- importadas
- preset

### `modules/accounting/suggestion-engine.ts`
Resolver contra:
- regla aprobada
- regla provisional
- template contable
- tax profile
- location signal
- cuentas provisionales cuando falte cuenta fina

### `modules/accounting/journal-builder.ts`
Permitir:
- `posted_provisional`
- journal con cuentas `TEMP-*`
- journal multi-moneda
- persistencia de FX aplicado

### `modules/accounting/learning-suggestions.ts`
Implementar promoción:
- `candidate -> provisional -> approved`

### `modules/tax/uy-vat-engine.ts`
Consumir:
- montos UYU ya convertidos,
- `fx_rate_policy_code`,
- `tax_profile_code`,
- `location_signal_code`,
- `requires_business_purpose_review`,
- `posted_provisional` como elegible downstream

Regla importante:
- la geolocalización no debe reescribir sola el tratamiento IVA final; debe actuar como señal que puede sugerir `UY_VAT_NON_DEDUCTIBLE`, `viático` o revisión obligatoria según política.

### `modules/tax/vat-runs.ts`
Tomar documentos en:
- `posted_provisional`
- `posted_final`

No tomar:
- `draft`
- `vat_ready`

### `modules/exports/repository.ts`
Hacer el salto final:
- `tax_profile_code` -> `organization_dgi_form_mappings`
- nunca inferir la línea DGI desde la cuenta sola

### `modules/ai/document-intake-contract.ts`
Extender extracción documental con:
- `issuer_address_raw`
- `issuer_department`
- `issuer_city`
- `issuer_branch_code`
- `merchant_category_hints`
- `location_extraction_confidence`

### `modules/accounting/vendor-resolution.ts`
Permitir enriquecimiento y persistencia incremental de:
- departamento / ciudad del proveedor
- sucursal si se detecta
- categoría de comercio sugerida

### `modules/documents/review.ts`
Separar:
- validación documental/fiscal
- posteo provisional
- posteo final
- reapertura y recategorización
- captura de justificación de propósito empresarial cuando el signal geográfico lo requiera

### `components/documents/document-review-workspace.tsx`
Agregar:
- UI de blockers segmentados
- botón `Postear provisional`
- indicador de cuenta provisional
- CTA para `Asignar cuenta definitiva`
- CTA para `Importar plan de cuentas`
- warning de razonabilidad geográfica
- campo obligatorio de justificación cuando la política lo requiera

### `modules/spreadsheets/import-runner.ts`
Extender con modo:
- `chart_of_accounts`

### `app/app/o/[slug]/imports/actions.ts`
Agregar flujo para:
- subir plan de cuentas
- parsear
- previsualizar
- aprobar adopción

---

## Nuevos módulos recomendados

- `modules/accounting/chart-presets.ts`
- `modules/accounting/chart-manager.ts`
- `modules/accounting/journal-templates.ts`
- `modules/tax/uy-tax-profiles.ts`
- `modules/ai/chart-of-accounts-import-contract.ts`
- `modules/accounting/chart-import-normalizer.ts`
- `modules/accounting/fx-policy.ts`
- `modules/accounting/bcu-fx-service.ts`
- `modules/accounting/location-risk-engine.ts`
- `modules/accounting/location-parser.ts`
- `modules/accounting/uy-location-registry.ts`

---

## Importación inteligente de plan de cuentas desde planilla

## Objetivo

Aceptar planillas exportadas de sistemas externos o hechas a mano, donde el orden y los nombres de columnas cambian, y obtener una salida estructurada lista para adoptar por el sistema.

## Formatos de entrada esperados

- CSV
- XLSX
- planillas manuales
- exportaciones de ERPs
- exportaciones con jerarquías por niveles
- exportaciones con código y descripción mezclados
- archivos con filas vacías, encabezados duplicados o múltiples hojas

## Reglas del parser IA

1. La IA puede interpretar columnas variables.
2. La IA no puede inventar cuentas inexistentes en la planilla sin marcarlo.
3. La IA debe separar:
   - `code`
   - `name`
   - `type`
   - `parent_code`
   - `postable`
   - `is_provisional`
   - `external_code`
   - `aliases`
   - `suggested_statement_section`
   - `suggested_nature_tag`
   - `suggested_tax_profile_hint`
4. Si una fila es ambigua, debe marcarla como `needs_review`.
5. Si detecta títulos de grupo no postables, debe modelarlos como nodos parent.
6. Si detecta una cuenta técnica del sistema, debe mapearla o sugerir equivalencia.
7. Si detecta moneda, centro de costo u otra dimensión, debe preservarla como metadata, no mezclarla dentro del `name`.
8. Si no encuentra una columna explícita de tipo, puede inferirla por:
   - código,
   - nombre,
   - jerarquía,
   - normalidad contable del grupo,
   pero debe señalar el nivel de confianza.

---

## Nuevo system prompt para importar plan de cuentas

> Eres el normalizador contable de Convertilabs para Uruguay.
>
> Tu trabajo es interpretar una planilla de plan de cuentas subida por un usuario y devolver un JSON estructurado, consistente y seguro para adopción por el sistema.
>
> Debes trabajar con archivos cuyo orden de columnas puede variar mucho, con encabezados imperfectos, cuentas agrupadoras, cuentas postables, celdas vacías, múltiples hojas, filas de comentario y estructuras exportadas por ERPs o hechas manualmente.
>
> Objetivo:
> - identificar cuentas reales;
> - distinguir nodos agrupadores de cuentas postables;
> - mapear cada fila a una estructura normalizada;
> - detectar jerarquías;
> - inferir tipo contable cuando sea razonable;
> - proponer metadata útil para NIIF-ready y fiscalidad uruguaya;
> - marcar ambigüedades sin inventar certeza falsa.
>
> Reglas duras:
> 1. Nunca inventes una cuenta que no esté presente en el archivo, salvo que la declares explícitamente como `synthetic_helper = true` y sólo si es imprescindible para representar jerarquía rota.
> 2. Nunca asumas que una columna llamada “Cuenta” significa código; puede ser nombre.
> 3. Nunca mezcles diferentes filas sólo por similitud visual.
> 4. Si una fila no tiene evidencia suficiente, márcala `needs_review = true`.
> 5. Conserva siempre el valor original de cada celda relevante en `source_snapshot`.
> 6. Devuelve únicamente JSON válido conforme al schema entregado.
> 7. No uses markdown.
> 8. No devuelvas comentarios fuera del JSON.
>
> Debes detectar, cuando existan:
> - `code`
> - `name`
> - `type`
> - `parent_code`
> - `postable`
> - `currency_hint`
> - `external_code`
> - `aliases`
> - `statement_section`
> - `nature_tag`
> - `tax_profile_hint`
> - `confidence`
> - `needs_review`
>
> Heurísticas válidas:
> - Si el código muestra jerarquía por prefijos, úsala.
> - Si la fila parece título de grupo y no tiene saldo/movimiento/postabilidad, trátala como agrupadora.
> - Si el nombre contiene patrones como IVA, Clientes, Proveedores, Ventas, Compras, Mercaderías, Caja, Banco, Importación, Anticipo, Maquinaria, Depreciación, interpreta eso como señal contable.
> - Si una fila parece cuenta provisional o técnica del sistema, no la crees automáticamente; marca sugerencia.
> - Si aparece moneda, detecta cuentas multi-moneda o de banco en USD.
> - Si aparecen cuentas de importación, tránsito, despachante, IVA importación o anticipos, sugiere tax/profile hints acordes.
>
> Salida requerida:
> ```json
> {
>   "file_summary": {
>     "detected_sheets": [],
>     "header_strategy": "",
>     "hierarchy_strategy": "",
>     "warnings": []
>   },
>   "accounts": [
>     {
>       "row_ref": "",
>       "source_snapshot": {},
>       "code": "",
>       "name": "",
>       "type": "asset|liability|equity|revenue|expense|unknown",
>       "parent_code": null,
>       "postable": true,
>       "external_code": null,
>       "aliases": [],
>       "currency_hint": null,
>       "statement_section": null,
>       "nature_tag": null,
>       "tax_profile_hint": null,
>       "synthetic_helper": false,
>       "confidence": 0.0,
>       "needs_review": false,
>       "review_reason": null
>     }
>   ]
> }
> ```
>
> Prioridad:
> 1. seguridad estructural,
> 2. trazabilidad,
> 3. mínima invención,
> 4. máxima recuperación útil.

---

## Extensión del intake documental para geolocalización

Además del contrato actual de intake documental, agregar extracción explícita de ubicación del emisor con este criterio:

1. priorizar `issuer_branch_code` o identificadores de local/sucursal cuando existan;
2. extraer `issuer_address_raw` como texto completo;
3. inferir `issuer_department` e `issuer_city` sólo cuando haya evidencia textual suficiente;
4. si no hay evidencia suficiente, devolver `null` y `needs_review`, no inventar;
5. devolver `location_extraction_confidence`;
6. conservar snapshot textual para auditoría.

### Mini system prompt adicional para intake documental

> Extrae la ubicación del emisor sólo cuando exista evidencia suficiente en el documento.
> Prioriza códigos de sucursal/local, ciudad, departamento y dirección completa.
> No inventes departamento o ciudad a partir del nombre comercial solamente.
> Si la evidencia es parcial, devuelve `issuer_address_raw` y deja `issuer_department` o `issuer_city` en null.
> Devuelve siempre `location_extraction_confidence` y una breve explicación estructurada de dónde surgió la ubicación.

## Flujo de adopción de plan de cuentas importado

1. usuario sube archivo;
2. `import-runner` detecta `chart_of_accounts`;
3. se extrae preview tabular;
4. la IA devuelve JSON normalizado;
5. se corre validador schema;
6. se ejecuta un normalizador determinístico;
7. se presenta preview al usuario;
8. el usuario aprueba:
   - adoptar todo,
   - adoptar parcial,
   - mapear a cuentas existentes,
   - descartar ambiguas;
9. se insertan cuentas con `source = imported`;
10. se recalculan drafts pendientes;
11. se regeneran `allowedTargets`.

---

## Reglas de matching posteriores a la importación

Luego de importar, el sistema debe:

- mapear por `external_code`,
- mapear por nombre exacto,
- mapear por alias,
- mapear por similitud,
- detectar equivalencias con cuentas del preset,
- sugerir fusión o mantener paralelas.

Nunca fusionar automáticamente cuentas importadas con cuentas existentes sin aprobación humana.

---

## Reglas determinísticas de geolocalización

### Objetivo operativo

Aumentar precisión en la decisión de IVA deducible / no deducible y mejorar la detección temprana de viáticos, representación o gasto personal probable.

### Política adoptada para v1

#### 1. Fuente de datos

Usar datasets oficiales de Uruguay para seed offline:

- localidades del país;
- opcionalmente direcciones geográficas para enriquecimiento posterior.

#### 2. Motor mínimo

`location-risk-engine.ts` debe evaluar, como mínimo:

- departamento de la organización vs departamento del emisor;
- ciudad de la organización vs ciudad del emisor;
- categoría del proveedor / comercio;
- presencia de palabras de contexto como viaje, hotel, peaje, terminal, aeropuerto, ruta, viático.

#### 3. Tabla de decisión simplificada v1

- `same_city + supermercado` -> riesgo bajo/medio; no bloquear, sólo clasificar con contexto normal.
- `other_department + supermercado` -> riesgo alto; sugerir `requires_business_purpose_review`.
- `other_department + restaurante` -> sugerir `travel_pattern` o `viático`, no negar automáticamente.
- `other_department + hotel/peaje/pasaje` -> sugerir `travel_pattern`.
- `missing_location_evidence` -> no inferir riesgo alto por ausencia de dato.

#### 4. Resultado en el workflow

El engine debe devolver:

- `location_signal_code`
- `severity`
- `explanation`
- `suggested_tax_profile_code` (nullable)
- `suggested_expense_family` (nullable)
- `requires_user_justification`

#### 5. Cómo impacta en IVA

- si la política organizacional es conservadora y el signal es alto, el sistema puede sugerir `UY_VAT_NON_DEDUCTIBLE`;
- pero la confirmación final debe admitir override con nota y auditoría;
- para `posted_provisional`, basta con persistir el signal y la sugerencia, aunque la cuenta definitiva llegue después.

#### 6. Qué no debe hacer

- no bloquear sólo por km cuando no existe categoría sensible;
- no usar APIs pagas;
- no usar regex frágiles como única verdad si existe código de sucursal mejor;
- no convertir esto en una policía absurda del yogur del domingo sin posibilidad de explicar el contexto.

---

## UI mínima requerida

## En onboarding

Agregar paso opcional:

`Configurar plan de cuentas`

Opciones:
- usar plan estándar del sistema,
- importar desde planilla,
- arrancar sólo con starter + provisionales.

## En workspace de revisión

Agregar:

- badge `Provisional`
- botón `Postear provisional`
- botón `Asignar cuenta definitiva`
- botón `Crear cuenta`
- botón `Importar plan de cuentas`
- panel `FX` cuando moneda != UYU
- mensaje separado por familias:
  - documental
  - fiscal
  - contable
  - IA
  - duplicados
  - período
  - razonabilidad geográfica
- banner específico cuando exista `location_signal_code`
- selector de motivo / nota cuando el usuario overridee un caso de riesgo

## En configuración contable

Nueva pantalla:

`Chart Manager`

Tabs:
- plan actual
- provisionales pendientes
- importaciones
- presets
- equivalencias
- recategorización
- reglas geográficas

---

## Reglas de aprendizaje

### Al usar cuenta provisional

Guardar:
- `status = provisional`
- `times_reused += 1`
- tax profile y template sí
- cuenta definitiva no

### Al usar cuenta definitiva manual o creada

Guardar:
- `status = candidate` o `approved` según scope y política
- si el usuario marca reusable o si se confirma final, promover

### Promoción recomendada

- `candidate` -> cuando se corrige una vez
- `provisional` -> cuando existe intención fiscal pero cuenta no definitiva
- `approved` -> sólo en `posted_final` o aprobación explícita

---

## Criterios de aceptación

## A. Flujo MVP IVA

1. Una organización nueva puede operar con:
   - onboarding fiscal completo,
   - starter accounts,
   - provisionales,
   - sin plan completo cargado.
2. Una compra en UYU con IVA básico puede llegar a `posted_provisional`.
3. Una compra en USD puede llegar a `posted_provisional` sólo si quedó persistido:
   - monto original,
   - tipo de cambio,
   - fecha BCU usada,
   - montos UYU.
4. El VAT run incluye documentos `posted_provisional`.
5. El VAT run excluye `draft` y `vat_ready`.

## B. Importación plan de cuentas

1. El sistema acepta XLSX/CSV con columnas reordenadas.
2. La IA devuelve JSON válido y trazable.
3. Las filas ambiguas quedan marcadas `needs_review`.
4. El usuario puede aprobar adopción parcial.
5. Las cuentas importadas quedan utilizables en `allowedTargets`.

## C. Recategorización

1. Un documento `posted_provisional` puede pasar a `posted_final`.
2. El cambio no rompe VAT run.
3. Queda auditoría de reclasificación.
4. Si cambia el tratamiento fiscal, debe existir reapertura deliberada.

## D. Multi-moneda

1. Para moneda extranjera, siempre se persiste:
   - moneda original,
   - montos originales,
   - montos UYU,
   - tipo de cambio,
   - fecha usada,
   - fuente.
2. El sistema puede reabrir y recalcular si cambia la fecha documental.
3. Los open items conservan moneda original.
4. Las diferencias de cambio futuras quedan soportadas.

## E. Geolocalización y razonabilidad

1. El sistema puede operar sin geolocalización exacta; `department/city` alcanzan para v1.
2. Un documento sensible con `location_signal_severity = high` muestra warning separado y explicación.
3. La ausencia de dato de ubicación no se trata como prueba de improcedencia.
4. Un override sobre un caso geográfico de riesgo guarda nota y auditoría.
5. El `uy-vat-engine` puede sugerir `non_deductible` o `viático` por geolocalización, pero nunca cerrar el caso sin dejar rastro de la regla aplicada.
6. El hot path documental no realiza llamadas a APIs pagas de mapas.

---

## Testing

## Unit tests

- `fx-policy`
- `chart import ai contract`
- `chart import normalizer`
- `journal-builder provisional`
- `vat-run eligibility`
- `learning promotion`
- `dgi mapping by tax profile`
- `location-risk-engine department/city matrix`
- `location parser from issuer address`

## Integration tests

- compra local UYU
- compra local USD
- venta local USD
- factura proveedor exterior + DUA
- documento con `TEMP-EXP`
- importación de plan de cuentas heterogéneo
- promoción provisional a final
- supermercado en otro departamento con warning y nota
- restaurante fuera de sede sugerido como viático

## Regression tests

- no romper starter accounts actuales
- no romper create account inline
- no romper bloqueo por duplicados
- no romper `runAssistant: false` en carga inicial del review workspace
- no romper confirmación de documentos sin ubicación extraíble

---

## Roadmap de implementación sugerido para Codex

## Fase 1 — Base de dominio
1. migraciones DB
2. `posting_status`
3. cuentas provisionales
4. campos FX
5. preset estándar

## Fase 2 — Journal y VAT
1. `journal-builder` provisional
2. `uy-vat-engine` con montos UYU
3. `vat-runs` con `posted_provisional`

## Fase 3 — UX y review
1. blockers segmentados
2. botón `Postear provisional`
3. panel FX
4. bandeja de provisionales pendientes

## Fase 3B — Geolocalización y razonabilidad
1. migraciones de dirección y ubicación
2. seed `uy_locations`
3. extensión del intake para dirección del emisor
4. `location-risk-engine` offline
5. warnings y nota obligatoria en UI
6. integración con `uy-vat-engine` como señal, no como juez único

## Fase 4 — Importación IA de plan de cuentas
1. nuevo contrato IA
2. `import-runner` modo `chart_of_accounts`
3. preview + aprobación
4. adopción parcial

## Fase 5 — Promoción y reporting
1. aprendizaje `candidate/provisional/approved`
2. recategorización a final
3. tags NIIF-ready
4. export mapping por `tax_profile`

---

## Instrucción concreta para Codex

Implementar este documento en el repo actual respetando estos principios:

- extender, no reescribir de cero;
- mantener compatibilidad con starter accounts existentes;
- mantener IA acotada por schema y sets permitidos;
- no introducir asientos libres;
- no romper el flujo actual de revisión;
- añadir posteo provisional, importación inteligente de plan de cuentas, capa multi-moneda con tipo de cambio fiscal persistido y capa de razonabilidad geográfica determinística.

Si alguna tabla o módulo ya cubre parcialmente una pieza del diseño:
- reutilizarlo;
- documentar la adaptación;
- evitar duplicación de modelos.

Si alguna parte requiere decisión adicional:
- dejar `TODO(decision)` con explicación corta y propuesta concreta.


---

## Base normativa utilizada para este diseño

Este preset y estas reglas no pretenden sustituir asesoramiento contable ni tributario. Se apoyan en estas ideas normativas:

1. En Uruguay, el MEF publica las normas contables adecuadas aplicables, incluyendo NIIF para PYMES y NICs/NIIF según la reglamentación vigente.
2. Para entidades privadas no reguladas por un plan sectorial específico, el diseño del plan de cuentas operativo debe ser propio, aunque alineado con esas normas.
3. Para sectores regulados por BCU existen planes de cuentas específicos, por lo que este preset no debe imponerse a bancos, seguros u otros sujetos con regulación sectorial propia.
4. En importaciones, el IVA importación y los anticipos en importación deben tratarse según el régimen tributario aplicable; por eso el preset separa:
   - IVA importación crédito fiscal,
   - anticipo IVA importación,
   - tributos/costos no recuperables,
   - mercadería en tránsito / activo fijo en curso.
5. En inventarios, los impuestos recuperables no deben capitalizarse al costo; los costos no recuperables y directamente atribuibles sí pueden formar parte del costo.
6. En activos fijos, los costos directamente atribuibles a poner el bien en condiciones de uso deben capitalizarse.
7. Para operaciones en moneda extranjera, los montos fiscales deben convertirse a moneda nacional con una política explícita y trazable; además debe conservarse la moneda original del documento.
8. IFRS 18 debe impactar principalmente en presentación/tags/reporting futuro, no en el diseño mínimo del asiento operativo del MVP.
9. DGI ya ofrece consulta de CFE y formularios con datos precargados que pueden confirmarse o modificarse; por eso el valor del producto debe concentrarse en conciliación, clasificación y explicación de diferencias, no en duplicar un resumen fiscal.
10. En formularios y guías de IVA agro/régimen especial, la administración exige separar IVA compras directo e indirecto y aplicar prorrata cuando corresponde; por eso el motor fiscal debe modelar esa separación explícitamente.
11. La geolocalización propuesta en este documento no surge de una regla legal dura publicada por DGI. Se usa como prueba de razonabilidad y evidencia contextual para reforzar la evaluación de necesidad, vínculo con la actividad y revisión humana.
12. Para poblar la capa geográfica offline deben priorizarse fuentes oficiales de datos abiertos de Uruguay (localidades y, opcionalmente, direcciones geográficas) antes que servicios privados o APIs pagas.

