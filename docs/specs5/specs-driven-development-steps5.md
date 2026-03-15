# specs-driven-development-steps5.md

## Objetivo

Implementar una evolución del flujo contable/fiscal para Convertilabs que:

1. destrabe el MVP de liquidación de IVA;
2. mantenga trazabilidad fuerte;
3. permita operar aun cuando falte clasificación contable fina;
4. soporte importación inteligente de planes de cuentas desde planillas heterogéneas;
5. deje la base lista para otros impuestos y cierre anual;
6. incorpore correctamente la capa bimonetaria Uruguay (UYU/USD) con persistencia del tipo de cambio fiscal usado;
7. reencuadre el MVP como capa de conciliación y decisión fiscal sobre CFE/DGI, sin competir con DGI como simple resumen de IVA ni exigir migración de ERP.

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

### Lo que no se hará

1. No permitir que la IA invente cuentas o asientos fuera del set permitido.
2. No usar un “plan oficial del MEF” porque para empresas privadas generales el MEF publica normas contables adecuadas, no un plan universal obligatorio.
3. No meter el mapping final a líneas DGI dentro del motor contable central.
4. No usar sólo una confirmación monolítica para todo el downstream.
5. No usar el tipo de cambio “del mismo día de factura” como regla fiscal automática: se debe modelar la regla normativa y guardar la fecha BCU realmente usada.
6. No posicionar el producto como reemplazo del ERP del cliente ni como un duplicado del resumen fiscal de DGI.

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
- `vat_credit_category`
- `deductibility_mode`
- `requires_proration`
- `requires_business_purpose_review`
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
- requiere que el tratamiento fiscal mínimo ya esté resuelto
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

## Motor de crédito fiscal y prorrata

Este es uno de los diferenciales reales del producto frente al simple resumen de DGI.

Todo documento de compra, gasto, importación o activo con potencial impacto en IVA debe terminar con una resolución explícita de crédito fiscal.

### Resultado fiscal mínimo por documento

Persistir como mínimo:

- `vat_credit_category` (`input_direct`, `input_indirect`, `input_import`, `input_non_deductible`, `not_applicable`)
- `vat_deductibility_status` (`full`, `partial_prorrata`, `none`, `pending_review`)
- `vat_direct_tax_amount_uyu`
- `vat_indirect_tax_amount_uyu`
- `vat_deductible_tax_amount_uyu`
- `vat_nondeductible_tax_amount_uyu`
- `vat_proration_coefficient`
- `business_link_status` (`linked`, `not_linked`, `needs_review`)

### Reglas funcionales

1. El baseline de DGI nunca sustituye esta clasificación; solo sirve como referencia y conciliación.
2. Para llegar a `posted_provisional`, el documento ya debe tener resuelto el tratamiento fiscal mínimo de IVA; `pending_review` no puede alimentar el VAT run.
3. El IVA no deducible o parcialmente deducible no debe quedar silenciosamente registrado como 100% crédito fiscal.
4. La porción no deducible podrá:
   - absorberse en la cuenta principal del documento, o
   - ir a una cuenta/configuración técnica específica,
   según template y política de la organización.
5. Cuando haya ventas gravadas, no gravadas, exentas, exportaciones o regímenes mixtos, el engine debe soportar prorrata / porcentual con coeficiente por período.
6. La UI de review debe mostrar esta decisión de forma separada de la cuenta contable.

### Regla de seguridad

No inferir automáticamente que un IVA compras es deducible solo porque existe una factura electrónica en DGI.
La deducibilidad depende de la operación, del vínculo con la actividad y del régimen aplicable.

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

## T1B. Compra local gravada con IVA parcialmente deducible / prorrata

Plantilla:

- Dr `main_purchase_slot` por neto + porción IVA no deducible
- Dr `vat_input_slot` por porción IVA deducible
- Cr `ap_slot`

## T1C. Compra local gravada con IVA no deducible

Plantilla:

- Dr `main_purchase_slot` por neto + IVA total
- Cr `ap_slot`

Observación:
no debe usarse `vat_input_slot` salvo política específica de puente técnico.

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
- `vat_credit_category`
- `vat_deductibility_status`
- `vat_direct_tax_amount_uyu`
- `vat_indirect_tax_amount_uyu`
- `vat_deductible_tax_amount_uyu`
- `vat_nondeductible_tax_amount_uyu`
- `vat_proration_coefficient`
- `business_link_status`
- `dgi_reconciliation_status`

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


## 8. `dgi_reconciliation_runs`

Agregar tabla para conciliación mensual contra baseline DGI:

- `id`
- `organization_id`
- `period_year`
- `period_month`
- `source_kind` (`manual_summary`, `imported_file`, `future_connector`)
- `status` (`draft`, `computed`, `reviewed`, `closed`)
- `baseline_payload`
- `differences_payload`
- `created_by`
- `reviewed_at`

## 9. `dgi_reconciliation_buckets`

Agregar tabla hija opcional o vista materializada con buckets calculados:

- `run_id`
- `bucket_code`
- `dgi_net_amount_uyu`
- `system_net_amount_uyu`
- `dgi_tax_amount_uyu`
- `system_tax_amount_uyu`
- `delta_net_amount_uyu`
- `delta_tax_amount_uyu`
- `difference_status`

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
Consumir y producir:
- montos UYU ya convertidos,
- `fx_rate_policy_code`,
- `tax_profile_code`,
- `posted_provisional` como elegible downstream,
- clasificación `directo / indirecto / no deducible / importación`,
- montos deducibles y no deducibles,
- coeficiente de prorrata cuando corresponda

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

### `modules/documents/review.ts`
Separar:
- validación documental/fiscal
- posteo provisional
- posteo final
- reapertura y recategorización

### `components/documents/document-review-workspace.tsx`
Agregar:
- UI de blockers segmentados
- botón `Postear provisional`
- indicador de cuenta provisional
- CTA para `Asignar cuenta definitiva`
- CTA para `Importar plan de cuentas`
- panel `Crédito fiscal` con directo / indirecto / no deducible / prorrata
- warning separado cuando existe diferencia con baseline DGI del período

### `modules/spreadsheets/import-runner.ts`
Extender con modo:
- `chart_of_accounts`

### `app/app/o/[slug]/imports/actions.ts`
Agregar flujo para:
- subir plan de cuentas
- parsear
- previsualizar
- aprobar adopción

### `modules/tax/dgi-reconciliation.ts`
Nuevo servicio para:
- recibir baseline DGI del período
- calcular buckets comparables
- detectar diferencias
- producir payload auditable de conciliación

### `modules/tax/dgi-reconciliation-repository.ts`
Persistir corridas, buckets y estados de conciliación.

### `modules/exports/accounting-adapters.ts`
Agregar exportación contable genérica sin migración:
- CSV/XLSX de journals
- mapping por `external_code`
- layouts configurables por cliente/sistema destino

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
- `modules/tax/dgi-summary-normalizer.ts`
- `components/tax/dgi-reconciliation-workspace.tsx`
- `modules/exports/external-system-layouts.ts`

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

## Capacidad nueva obligatoria: conciliación contra DGI

### Objetivo

Usar DGI como baseline y validador fiscal, no como enemigo de producto.

El sistema debe poder comparar lo que Convertilabs procesó contra lo que el contribuyente ve en DGI para el mismo período y explicar diferencias.

### Formas de entrada del baseline DGI para MVP

1. carga manual asistida de totales por bucket;
2. importación de archivo estructurado si el usuario lo obtiene desde su flujo;
3. futura integración/conector sólo si existe un canal técnico/operativo estable y legalmente adecuado.

### Fuera de alcance del MVP

- OCR de capturas de pantalla como vía principal;
- scraping frágil del portal DGI;
- autoajuste ciego del sistema sólo porque el total DGI difiere.

### Buckets mínimos de conciliación

- IVA básica ventas
- IVA básica compras
- IVA mínima ventas
- IVA mínima compras
- no gravado / exento
- importaciones / anticipos IVA importación cuando aplique
- percepciones / retenciones si el régimen del cliente las usa

### Estados mínimos de diferencia

- `matched`
- `missing_in_system`
- `extra_in_system`
- `amount_mismatch`
- `tax_treatment_mismatch`
- `pending_manual_adjustment`

### Regla importante

La conciliación DGI nunca debe sobreescribir de forma automática la clasificación fiscal-documental interna.
Solo debe:
- mostrar diferencias,
- proponer investigación,
- y generar evidencia para ajuste o reapertura deliberada.

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

## En conciliación fiscal mensual

Nueva pantalla:

`Conciliación DGI`

Elementos mínimos:
- selector de período
- carga de baseline DGI
- comparación por bucket
- diferencias `missing / extra / mismatch / treatment`
- acciones: justificar, reabrir documento, marcar ajuste externo

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

---

## Integración sin migración del sistema contable del cliente

### Principio

Convertilabs no debe obligar al cliente a abandonar su ERP o sistema contable actual para capturar valor.

### Requerimientos mínimos

1. Exportar journals y/o movimientos en CSV/XLSX genérico.
2. Permitir mapping por `external_code` y alias de cuenta.
3. Soportar layouts configurables por cliente.
4. Permitir export mensual de:
   - asientos finales,
   - asientos provisionales si la política lo permite,
   - resumen de diferencias DGI,
   - cola de recategorización pendiente.
5. No exigir write-back en tiempo real como condición del MVP.

### Regla de producto

El discurso comercial y la UX deben presentar a Convertilabs como acelerador y filtro inteligente para el sistema actual del cliente, no como reemplazo obligatorio de su backoffice contable.

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


## E. Crédito fiscal y prorrata

1. Todo documento elegible para IVA compras termina con `vat_credit_category` y `vat_deductibility_status`.
2. Un documento no puede llegar a `posted_provisional` si sigue en `pending_review` para el crédito fiscal.
3. El engine puede distinguir al menos:
   - directo,
   - indirecto,
   - no deducible,
   - importación,
   - no aplicable.
4. Cuando corresponda prorrata, el sistema persiste coeficiente y montos deducible/no deducible en UYU.

## F. Conciliación DGI

1. El usuario puede crear una corrida mensual de conciliación contra baseline DGI.
2. El sistema compara por bucket y detecta:
   - faltantes en sistema,
   - sobrantes en sistema,
   - diferencias de monto,
   - diferencias de tratamiento fiscal.
3. La conciliación no reescribe automáticamente journals ni tax profiles.
4. El usuario puede dejar una diferencia marcada como ajuste externo o disparar reapertura deliberada.

## G. Exportación sin migración

1. El sistema puede exportar journals a CSV/XLSX genérico usando `external_code` si existe.
2. Un cliente puede seguir usando su sistema contable actual y obtener valor del flujo sin cambiar de ERP.
3. La exportación distingue provisionales y finales.

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
- `vat credit classifier direct/indirect/prorrata`
- `dgi reconciliation bucket matcher`
- `external accounting export adapter`

## Integration tests

- compra local UYU
- compra local USD
- venta local USD
- factura proveedor exterior + DUA
- documento con `TEMP-EXP`
- importación de plan de cuentas heterogéneo
- promoción provisional a final
- conciliación mensual contra baseline DGI
- exportación CSV/XLSX a sistema externo

## Regression tests

- no romper starter accounts actuales
- no romper create account inline
- no romper bloqueo por duplicados
- no romper `runAssistant: false` en carga inicial del review workspace

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

## Fase 3 — UX, review y crédito fiscal
1. blockers segmentados
2. botón `Postear provisional`
3. panel FX
4. panel de crédito fiscal
5. bandeja de provisionales pendientes

## Fase 4 — Conciliación DGI
1. modelo de corrida de conciliación
2. buckets comparables por período
3. pantalla `Conciliación DGI`
4. manejo de diferencias y reapertura deliberada

## Fase 5 — Importación IA de plan de cuentas
1. nuevo contrato IA
2. `import-runner` modo `chart_of_accounts`
3. preview + aprobación
4. adopción parcial

## Fase 6 — Promoción, reporting y exportación
1. aprendizaje `candidate/provisional/approved`
2. recategorización a final
3. tags NIIF-ready
4. export mapping por `tax_profile`
5. layouts de exportación a sistemas externos

---

## Instrucción concreta para Codex

Implementar este documento en el repo actual respetando estos principios:

- extender, no reescribir de cero;
- mantener compatibilidad con starter accounts existentes;
- mantener IA acotada por schema y sets permitidos;
- no introducir asientos libres;
- no romper el flujo actual de revisión;
- añadir posteo provisional, importación inteligente de plan de cuentas y capa multi-moneda con tipo de cambio fiscal persistido;
- usar DGI como baseline de conciliación y no como simple competidor;
- mantener a Convertilabs como capa de decisión/exportación, no como ERP obligatorio.

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
9. DGI ya dispone de servicios de consulta de CFE recibidos y de formularios/servicios con datos precargados que pueden confirmarse o modificarse; por eso el producto debe usar a DGI como baseline y validador, no como enemigo a reemplazar.
10. La determinación del IVA compras deducible exige separar directo e indirecto y, cuando corresponda, aplicar prorrata/porcentual; el formulario puede distribuir automáticamente el indirecto una vez cargados los datos correctos, pero no decide por sí mismo esa clasificación.
11. En regímenes agro o mixtos, la asignación de IVA compras y las reglas de suspenso, exportación o ingresos no gravados generan un diferencial real de producto frente al simple resumen por tasa.
12. Los formularios precargados admiten ajustes por diferencias en comprobantes electrónicos o por comprobantes manuales/no precargados, por lo que la conciliación mensual sigue siendo una necesidad operativa real.
13. Para hacer uso del crédito fiscal, la documentación debe cumplir condiciones formales y de identificación del comprador en los casos aplicables; la existencia del comprobante en DGI no equivale automáticamente a crédito fiscal utilizable.


---

## Fuentes oficiales específicas consideradas en este reencuadre

- DGI — Servicios en línea / Consulta de CFE recibidos.
- DGI — Formulario 2178 con datos precargados y sus instructivos.
- DGI — `Cálculo del IVA compras deducible (Rubro 3 del Formulario 1379)`.
- DGI — `Datos a ingresar en el Formulario 2178`.
- DGI — Instructivo `Declaración Jurada 1306 IVA Agropecuario – NO CEDE`.
- DGI — `Tratamiento del IVA compras`.
- DGI — `Operaciones en moneda extranjera`.
- MEF — `Normas contables adecuadas publicadas según reglamentación`.
- BCU — cotizaciones y normativa sectorial cuando existan planes de cuentas regulados.
