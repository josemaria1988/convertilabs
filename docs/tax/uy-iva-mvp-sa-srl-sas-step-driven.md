# UY IVA MVP para S.A., S.R.L. y SAS  
## Spec + estudio normativo + reglas curadas para system prompt + Step-driven development

**Estado:** Draft operativo para congelar en repo  
**Fecha de elaboración:** 2026-03-12  
**Jurisdicción:** Uruguay  
**Dominio fiscal activo en MVP:** IVA únicamente  
**Formas jurídicas objetivo del MVP:** S.A., S.R.L., SAS  
**Advertencia crítica:** la forma jurídica **no alcanza** para determinar el régimen de IVA. El perfil organizacional debe incluir **vat_regime** explícito. Ver sección 2.2.

---

## 0. Propósito del documento

Este archivo fija una base **lista para Codex** para construir el primer MVP de liquidación de IVA en Uruguay usando:

1. **Procesamiento documental con OpenAI** como capa primaria de extracción y clasificación.
2. **Reglas determinísticas** como fuente final de verdad fiscal/contable.
3. **Snapshots curados por organización** como único contexto normativo que puede viajar al modelo.
4. **Confirmación humana final única** antes de generar `journal_entry.status = 'draft'`.
5. **Liquidación mensual de IVA** basada solo en documentos confirmados.

Este documento mezcla tres capas que deben quedar separadas en código aunque convivan aquí por conveniencia humana, esa vieja costumbre de meter todo junto y después culpar al framework:

- **Capa normativa oficial**: qué dicen DGI / IMPO / e-Factura.
- **Capa de producto**: qué soporta o no soporta el MVP.
- **Capa de IA**: qué reglas se permiten pasar al `system prompt` y qué queda fuera.

---

## 1. Decisiones no negociables para V1

### 1.1 Alcance fiscal del MVP
V1 cubre únicamente:

- IVA compras
- IVA ventas
- notas de crédito y débito que ajusten IVA
- cálculo de `vat_run` mensual
- sugerencia contable asociada al documento
- confirmación humana final

V1 **no** cubre:

- IRAE
- IP
- BPS
- retenciones
- prorrata compleja fuera de reglas acotadas
- emisión/preemisión de comprobantes
- cumplimiento automático total de casos de exportación o mixtos sin revisión humana

### 1.2 Formas jurídicas objetivo
El MVP se enfoca en:

- S.A.
- S.R.L.
- SAS

### 1.3 Regla crítica de perfil organizacional
**No se debe inferir el régimen de IVA a partir de la forma jurídica.**

El perfil fiscal mínimo obligatorio para que el motor de IVA quede habilitado es:

```ts
type OrganizationTaxProfile = {
  country_code: "UY";
  legal_entity_type: "SA" | "SRL" | "SAS";
  tax_id: string; // RUT
  vat_regime: "GENERAL" | "IVA_MINIMO" | "OTRO" | "UNKNOWN";
  dgi_group: "NO_CEDE" | "CEDE" | "GC" | "UNKNOWN";
  cfe_status: "ELECTRONIC_ISSUER" | "NON_ELECTRONIC" | "UNKNOWN";
  profile_version: number;
  effective_from: string; // ISO date
};
```

### 1.4 Regla operativa de scope real
**La automatización fiscal del MVP solo se activa cuando:**

- `country_code = "UY"`
- `legal_entity_type ∈ {SA, SRL, SAS}`
- `vat_regime = "GENERAL"`

Si `vat_regime != "GENERAL"` o está ausente:

- el sistema puede procesar el documento
- el sistema puede clasificar y extraer datos
- pero **no debe liquidar IVA automáticamente**
- debe marcar `requires_manual_review = true`

### 1.5 Confirmación
Solo existe **una confirmación final**:

- el usuario aprueba el resultado completo
- el sistema genera `journal_entry` en estado `draft`
- el documento pasa a `classified` / `confirmed`

No hay aprobaciones intermedias de extracción, clasificación o IVA.

---

## 2. Estudio normativo profundo y hallazgos que cambian el diseño

### 2.1 Fuentes oficiales utilizadas
Este documento se basa en portales oficiales:

- **DGI**: normativa operativa, guías, formularios, preguntas frecuentes y regímenes.
- **e-Factura DGI**: universo CFE, tipos de comprobantes y universalización.
- **IMPO**: Texto Ordenado 1996 / Título 10 y decretos reglamentarios vigentes o consolidados.

Las referencias completas están en la sección 13.

### 2.2 Hallazgo 1: la forma jurídica no define por sí sola el régimen de IVA
DGI informa que el régimen de **IVA Mínimo / Pequeña Empresa** puede aplicar a contribuyentes **cualquiera sea su forma jurídica**. Además, hay materiales donde DGI menciona expresamente que una **S.A.** puede ampararse al régimen de Pequeña Empresa si obtiene rentas empresariales, y también referencias a **S.R.L.** tributando IVA mínimo.  
**Implicancia de producto:** no se puede asumir que “S.A., S.R.L. y SAS = IVA general”. Ese supuesto es falso y rompe la liquidación. El sistema necesita `vat_regime` explícito en la organización.  
**Decisión de MVP:** automatización fiscal solo para `vat_regime = GENERAL`; otros regímenes quedan fuera o en revisión manual.

### 2.3 Hallazgo 2: universalización de facturación electrónica
DGI/e-Factura fijó la universalización de la facturación electrónica para los restantes contribuyentes de IVA, con plazo al **31/12/2024**, y desde **01/01/2025** los contribuyentes de IVA pasan a ser emisores electrónicos, con excepciones específicas.  
**Implicancia de producto:** para el MVP 2026, el supuesto operativo razonable es que las organizaciones objetivo deberían tener `cfe_status = ELECTRONIC_ISSUER` salvo casos especiales.  
**Regla de IA/producto:** cuando el documento sea de venta y la organización sea emisora electrónica, el sistema debe preferir clasificaciones CFE (`e-Factura`, `e-Ticket`, `e-Factura de Exportación`, `e-Nota de Crédito`, etc.) antes que inventar formatos genéricos.

### 2.4 Hallazgo 3: formularios vigentes por grupo DGI
Para contribuyentes **CEDE y Grandes Contribuyentes**, el formulario mensual vigente desde obligaciones generadas a partir de **octubre 2021** es el **1376** mediante PADI; el **2176** queda para períodos anteriores a octubre 2021.  
Para **NO CEDE**, el formulario operativo relevante de IVA/IRAE/IP/ICOSA es **2178**.  
**Implicancia de producto:** no modelar “CEDE = 2176” como regla actual.  
**Decisión de MVP:** la app genera `vat_runs` internos y no depende del formulario para calcular. Pero sí debe guardar `dgi_group` porque más adelante la exportación a DJ o conciliación cambia por grupo.

### 2.5 Hallazgo 4: hecho generador y ámbito del IVA
El IVA grava la **circulación interna de bienes**, la **prestación de servicios dentro del territorio nacional**, la introducción definitiva de bienes y ciertas agregaciones específicas. La exportación de bienes no está gravada; ciertos servicios de exportación tienen tratamiento no gravado/exonerado según norma específica.  
**Implicancia de producto:** el motor no puede tratar “venta” como una sola bolsa. Necesita identificar al menos:

- venta gravada interna
- venta exenta
- venta no gravada
- exportación de bienes
- candidato a exportación de servicios
- operación mixta o indeterminada

### 2.6 Hallazgo 5: liquidación del impuesto
La liquidación parte del **impuesto facturado en ventas** y deduce el IVA incluido en compras e importaciones que integren directa o indirectamente el costo de bienes/servicios gravados. Cuando hay compras vinculadas indistintamente a operaciones gravadas y exentas, corresponde proporcionalidad en función de operaciones gravadas.  
**Implicancia de producto:** el núcleo del motor es:

```txt
IVA neto = IVA ventas - IVA compras creditable
```

pero con reglas de exclusión, proporcionalidad y créditos no deducibles.  
**Decisión de MVP seguro:** automatizar sin revisión los casos de compra/venta interna claramente gravada y marcar revisión manual para mixtas, exportaciones y usos parcialmente gravados, salvo reglas aprobadas.

### 2.7 Hallazgo 6: para tomar crédito fiscal no alcanza con “tener un PDF”
La reglamentación exige, para el cómputo del IVA compras, que el impuesto esté **discriminado** en la documentación y que el adquirente esté **individualizado con nombre y RUT**, además del cumplimiento de requisitos formales y sustanciales.  
**Implicancia de producto:** una compra no otorga crédito fiscal por existir como archivo.  
**Reglas obligatorias para el motor:**
- si el IVA no está discriminado, no dar crédito automático
- si el comprador no está identificado con nombre y RUT cuando corresponde, no dar crédito automático
- si el documento no es apto o faltan requisitos esenciales, marcar no creditable o revisión manual

### 2.8 Hallazgo 7: e-Ticket no da derecho a crédito fiscal de IVA compras
La documentación oficial de e-Factura diferencia:

- **e-Factura**: comprobante para contribuyentes
- **e-Ticket**: comprobante para consumo final y **sin derecho a crédito fiscal de IVA compras**

**Implicancia de producto:** si el documento de compra es `e-Ticket`, el motor debe por defecto marcar:

```txt
input_credit_status = non_creditable
reason = purchase_ticket_no_input_credit
```

salvo que el producto decida soportar alguna excepción documental futura, cosa que V1 no debería hacer porque ya tenemos suficientes maneras de complicar lo simple.

### 2.9 Hallazgo 8: proveedores en IVA mínimo / Literal E
La reglamentación impide deducir como crédito el IVA de operaciones realizadas por contribuyentes comprendidos en determinado literal del régimen simplificado / IVA mínimo, además de otros supuestos documentales.  
**Implicancia de producto:** si el proveedor está identificado como `vat_regime = IVA_MINIMO` o la documentación corresponde a ese régimen, el motor no debe generar crédito fiscal automático.

### 2.10 Hallazgo 9: tasas 22% y 10%
El Decreto reglamentario fija:

- **22%** tasa básica
- **10%** tasa mínima

La tasa mínima aplica a supuestos específicos normativos, no a intuiciones poéticas del modelo.  
**Implicancia de producto:** el modelo **no debe inferir 10% por descripción textual libre** salvo que:
- la tasa esté explícita en el documento, o
- exista una regla aprobada en el snapshot de la organización que encuadre la operación

### 2.11 Hallazgo 10: exentas y no gravadas son una zona peligrosa
Las exoneraciones del IVA en la ley son específicas y numerosas. No conviene que el modelo adivine exoneraciones leyendo un concepto comercial ambiguo.  
**Decisión de MVP:**  
`exenta`, `no gravada`, `exportación de bienes`, `exportación de servicios` y `mixta` se soportan como clasificación y almacenamiento, pero **la liquidación automática sin revisión** solo se habilita cuando haya regla aprobada y snapshot suficiente. Si no, `requires_manual_review = true`.

### 2.12 Hallazgo 11: notas de crédito y débito
La documentación oficial CFE define que:

- la **nota de crédito** anula o disminuye el monto imponible del comprobante original
- la **nota de débito** documenta recargos o ajustes relacionados

**Implicancia de producto:** en el `vat_run`:
- nota de crédito de venta => ajuste negativo del IVA ventas
- nota de débito de venta => ajuste positivo del IVA ventas
- nota de crédito de compra => ajuste negativo del IVA compras creditable
- nota de débito de compra => ajuste positivo del IVA compras creditable

### 2.13 Hallazgo 12: exceso de crédito y arrastre
Cuando el IVA compras creditable supera el IVA ventas, el saldo no se devuelve por regla general, sino que se **arrastra** a la declaración siguiente, salvo regímenes/operaciones especiales como exportaciones.  
**Implicancia de producto:** el `vat_run` mensual debe soportar:

- `carryforward_in`
- `carryforward_out`

y separar los supuestos especiales de exportación para revisión o reglas futuras.

### 2.14 Hallazgo 13: uso parcial / mixto
La reglamentación contempla deducción proporcional para bienes/servicios aplicados parcialmente a operaciones gravadas, con topes y exigencia de prueba fehaciente para apartarse de ciertos límites.  
**Implicancia de producto:** esto **no debe automatizarse libremente** en V1.  
**Decisión de MVP:** cuando un documento o categoría caiga en uso mixto/parcial:
- se crea borrador
- se clasifica
- se propone `input_credit_status = partial`
- `requires_manual_review = true`

### 2.15 Hallazgo 14: exportación y mezclas rompen la comodidad
La propia DGI, en servicios de DJ prellenada para NO CEDE, excluye de ciertos flujos automáticos a quienes tienen ventas de exportación/asimiladas o combinan ventas gravadas y no gravadas.  
**Implicancia de producto:** usar eso como alarma de diseño.  
**Decisión de MVP segura:** las exportaciones y operaciones mixtas deben entrar con mayor prudencia:
- clasificar y almacenar sí
- liquidación automática completa solo con reglas explícitas y aprobadas
- en caso contrario, revisión manual obligatoria

---

## 3. Delimitación exacta del MVP

### 3.1 In-scope para automatización fiscal
El MVP **sí** automatiza, con baja ambigüedad:

#### Compras
- e-Factura / factura de compra nacional gravada
- nota de crédito de compra
- nota de débito de compra
- clasificación de categorías contables soportadas
- determinación de IVA compras creditable o no creditable en casos evidentes

#### Ventas
- e-Factura / factura de venta nacional gravada
- e-Ticket / ticket de venta nacional gravada
- nota de crédito de venta
- nota de débito de venta
- carga manual o import resumido de ventas, con validación de totales e IVA output

#### Liquidación
- cálculo mensual de IVA neto
- saldo técnico mensual
- arrastre simple al mes siguiente
- trazabilidad a documento confirmado, snapshot y reglas aplicadas

### 3.2 In-scope solo con revisión manual
El MVP **detecta** y conserva, pero no liquida automáticamente sin revisión, estos casos:

- exportación de bienes
- candidato a exportación de servicios
- ventas exentas
- ventas no gravadas
- compras vinculadas a operaciones mixtas
- compras con uso parcial
- documentos sin IVA discriminado
- compras con documentación no apta
- compras a proveedor bajo IVA mínimo / régimen simplificado
- operaciones con tasa 10% inferida solo por texto sin soporte expreso
- documentos con inconsistencia matemática
- documentos donde no se pueda individualizar al adquirente cuando corresponda

### 3.3 Out-of-scope para V1
- liquidación automática de exportación de servicios compleja
- prorrata sofisticada multiactividad
- importación de servicios y ajustes de cambio de sujeto, salvo decisión expresa posterior
- percepciones / retenciones
- cierre anual por diferencia de tasas con capitalización a costo sin revisión humana
- conciliación bancaria / cobranzas
- emisión de CFE

---

## 4. Regla fundamental de diseño del motor fiscal

### 4.1 Separar tres cosas
Nunca mezclar en una sola decisión:

1. **Qué documento es**
2. **Qué hechos económicos contiene**
3. **Qué tratamiento de IVA corresponde**

La IA ayuda en 1 y 2.  
La decisión final de 3 la toma el motor determinístico usando snapshot aprobado.

### 4.2 No permitir que la IA “haga derecho tributario”
La IA puede:

- extraer
- clasificar
- proponer
- explicar brevemente

La IA **no** puede:

- crear una exoneración inexistente
- asumir que un 10% aplica por intuición
- asumir que una SA siempre es régimen general
- habilitar crédito fiscal sin documentación apta
- saltarse el snapshot vigente

---

## 5. Reglas curadas para system prompt

> **Objetivo:** este bloque es la base para el `system prompt` del intake documental.  
> **Importante:** no enviar la normativa completa. Solo estas reglas resumidas más el `organization_rule_snapshot` específico.

### 5.1 System prompt base sugerido

```text
Eres un asistente de intake documental y preliquidación de IVA para Uruguay.

Debes trabajar únicamente con:
1) el archivo o los datos del documento,
2) el perfil organizacional vigente,
3) el snapshot de reglas aprobado para esa organización.

No debes inventar normas ni usar conocimiento externo no incluido en el snapshot o en estas reglas base.

REGLAS DE ALCANCE:
- Solo automatiza IVA para organizaciones Uruguay con legal_entity_type SA, SRL o SAS y vat_regime = GENERAL.
- Nunca infieras vat_regime a partir de legal_entity_type.
- Si vat_regime es distinto de GENERAL, falta, o es ambiguo, marca requires_manual_review = true.
- Si country_code != UY, marca out_of_scope.

REGLAS DE CLASIFICACIÓN DOCUMENTAL:
- Prioriza tipos CFE cuando el documento sea compatible con facturación electrónica en Uruguay.
- Usa document_type entre:
  purchase_invoice, purchase_ticket, sales_invoice, sales_ticket,
  credit_note_purchase, debit_note_purchase,
  credit_note_sale, debit_note_sale,
  export_invoice, manual_sales_summary, unknown
- Usa document_subtype entre:
  e_factura, e_ticket, e_factura_exportacion, e_nota_credito, e_nota_debito,
  e_boleta_entrada, paper_invoice, manual_summary, unknown

REGLAS DE IVA COMPRAS:
- No concedas crédito fiscal automáticamente si el IVA no está discriminado.
- No concedas crédito fiscal automáticamente si el comprador no está individualizado con nombre y RUT cuando corresponda.
- Si el documento es e-Ticket o ticket de consumo final, marca input_credit_status = non_creditable.
- Si el proveedor está identificado o inferido con alta confianza como régimen simplificado / IVA mínimo, marca input_credit_status = non_creditable.
- Si el documento corresponde a compra vinculada a actividad mixta, exportación, exenta o uso parcial, marca input_credit_status = partial o unknown y requires_manual_review = true.
- Si la documentación es insuficiente o incompatible, marca input_credit_status = unknown y requires_manual_review = true.

REGLAS DE IVA VENTAS:
- Si la venta es nacional gravada y la tasa está explícita, calcula output VAT con esa tasa.
- Solo usa tasa 22 o 10.
- No infieras tasa 10 solo por descripción del bien o servicio salvo que esté explícita o exista regla aprobada en el snapshot.
- Si el documento es una nota de crédito de venta, el ajuste del IVA ventas es negativo.
- Si el documento es una nota de débito de venta, el ajuste del IVA ventas es positivo.
- Si es exportación, exenta o no gravada, clasifica el caso pero requiere revisión manual salvo que el snapshot contenga una regla explícita aprobada para resolverlo.

REGLAS DE CONSISTENCIA:
- Verifica cierre matemático entre neto, IVA y total.
- Si hay inconsistencia matemática, marca requires_manual_review = true.
- Si faltan datos esenciales, marca requires_manual_review = true.
- Nunca balances o clasifiques definitivamente un documento fuera del snapshot aprobado.

SALIDA:
- Debes devolver exclusivamente JSON válido según el schema provisto.
- No escribas texto fuera del JSON.
- Incluye rule_codes aplicados, warnings, confidence_score y requires_manual_review.
```

### 5.2 Rule codes mínimos para el snapshot / motor
Estos códigos deben existir como catálogo interno. El prompt los menciona, pero la decisión final vive en el motor determinístico.

| Rule Code | Descripción resumida | Acción |
|---|---|---|
| `UY_VAT_SCOPE_GENERAL_ONLY` | Solo automatizar para `vat_regime=GENERAL` | manual review si no |
| `UY_VAT_NEVER_INFER_REGIME_FROM_LEGAL_FORM` | No inferir régimen por forma jurídica | bloqueo |
| `UY_VAT_RATE_BASIC_22` | Tasa básica 22% | output/input según caso |
| `UY_VAT_RATE_MINIMUM_10_EXPLICIT_ONLY` | Tasa 10% solo si explícita o reglada | manual review si inferida |
| `UY_VAT_PURCHASE_REQUIRES_VAT_DISCLOSURE` | Crédito exige IVA discriminado | no credit / review |
| `UY_VAT_PURCHASE_REQUIRES_BUYER_IDENTIFICATION` | Crédito exige adquirente individualizado | no credit / review |
| `UY_VAT_PURCHASE_TICKET_NO_CREDIT` | e-Ticket/ticket no da crédito | no credit |
| `UY_VAT_PURCHASE_SUPPLIER_SIMPLIFIED_NO_CREDIT` | Compra a IVA mínimo/simplificado no da crédito | no credit |
| `UY_VAT_PURCHASE_MIXED_USE_REVIEW` | Uso parcial/mixto requiere revisión | partial/review |
| `UY_VAT_SALE_CREDIT_NOTE_NEGATIVE` | Nota de crédito de venta ajusta IVA en negativo | ajustar output |
| `UY_VAT_SALE_DEBIT_NOTE_POSITIVE` | Nota de débito de venta ajusta IVA en positivo | ajustar output |
| `UY_VAT_PURCHASE_CREDIT_NOTE_NEGATIVE` | Nota de crédito de compra ajusta IVA compras en negativo | ajustar input |
| `UY_VAT_PURCHASE_DEBIT_NOTE_POSITIVE` | Nota de débito de compra ajusta IVA compras en positivo | ajustar input |
| `UY_VAT_EXPORT_REQUIRES_APPROVED_RULE` | Exportaciones solo con regla aprobada | review si no |
| `UY_VAT_EXEMPT_OR_NON_TAXED_REQUIRES_APPROVED_RULE` | Exentas/no gravadas solo con regla aprobada | review si no |
| `UY_VAT_MATH_CHECK_REQUIRED` | Neto + IVA = total | review si no |
| `UY_VAT_CARRYFORWARD_ALLOWED` | Saldo técnico arrastra al siguiente período | vat_run |
| `UY_VAT_EXPORT_SPECIAL_CREDIT_HANDLING` | Exportación puede tener tratamiento especial de crédito | review/rule |
| `UY_VAT_FORM_GROUP_NO_CEDE_2178` | referencia operativa grupo NO CEDE | metadata |
| `UY_VAT_FORM_GROUP_CEDE_GC_1376` | referencia operativa grupo CEDE/GC | metadata |

### 5.3 JSON schema conceptual de salida del intake
La salida del modelo debe mapear a algo de este estilo:

```json
{
  "scope_status": "in_scope",
  "document_type": "purchase_invoice",
  "document_subtype": "e_factura",
  "organization_scope_check": {
    "country_code": "UY",
    "legal_entity_type": "SA",
    "vat_regime": "GENERAL",
    "is_supported": true
  },
  "counterparty": {
    "name": "Proveedor SA",
    "tax_id": "210000000012",
    "role": "supplier",
    "vat_regime_candidate": "UNKNOWN",
    "confidence": 0.55
  },
  "document_identification": {
    "series": "A",
    "number": "12345",
    "issue_date": "2026-03-01",
    "currency": "UYU"
  },
  "amounts": {
    "net_taxed_22": 1000,
    "net_taxed_10": 0,
    "net_exempt": 0,
    "net_non_taxed": 0,
    "vat_22": 220,
    "vat_10": 0,
    "total": 1220
  },
  "vat_determination": {
    "operation_nature": "domestic_taxed",
    "rate_detected": 22,
    "input_credit_status": "creditable",
    "output_tax_status": "not_applicable",
    "requires_manual_review": false
  },
  "warnings": [],
  "rule_codes": [
    "UY_VAT_SCOPE_GENERAL_ONLY",
    "UY_VAT_PURCHASE_REQUIRES_VAT_DISCLOSURE",
    "UY_VAT_PURCHASE_REQUIRES_BUYER_IDENTIFICATION",
    "UY_VAT_RATE_BASIC_22",
    "UY_VAT_MATH_CHECK_REQUIRED"
  ],
  "confidence_score": 0.94,
  "short_explanation": "Factura de compra nacional gravada a tasa básica con IVA discriminado."
}
```

---

## 6. Modelo determinístico posterior a IA

### 6.1 Orden correcto de ejecución
1. **IA extrae y clasifica**.
2. **Normalizador** limpia fechas, importes, RUT, moneda y tipos documentales.
3. **Validador matemático** controla neto/IVA/total.
4. **Motor de reglas IVA** decide tratamiento.
5. **Motor contable** propone asiento.
6. **Se persiste draft**.
7. **Usuario confirma o reabre**.

### 6.2 Reglas determinísticas mínimas del IVA engine
Implementar como funciones puras, no como ramas sueltas por toda la app.

#### `resolveScope(profile)`
- si `country_code != UY` => `out_of_scope`
- si `legal_entity_type ∉ {SA, SRL, SAS}` => `manual_review`
- si `vat_regime != GENERAL` => `manual_review`
- si falta `tax_id` => `manual_review`

#### `resolvePurchaseCredit(document, profile, snapshot)`
Devuelve:

```ts
type PurchaseCreditResolution = {
  status: "creditable" | "non_creditable" | "partial" | "unknown";
  reason_codes: string[];
  requires_manual_review: boolean;
};
```

Reglas:

- ticket / e-ticket => `non_creditable`
- IVA no discriminado => `non_creditable`
- comprador no identificado cuando corresponde => `unknown` o `non_creditable`
- proveedor simplificado / IVA mínimo => `non_creditable`
- uso mixto/parcial => `partial` + review
- exportación / exenta / no gravada sin regla explícita => review
- inconsistencia matemática => review

#### `resolveSalesOutput(document, profile, snapshot)`
Devuelve:

```ts
type SalesOutputResolution = {
  status: "output_taxable" | "exempt" | "non_taxed" | "export" | "unknown";
  rate: 22 | 10 | 0 | null;
  vat_amount: number | null;
  reason_codes: string[];
  requires_manual_review: boolean;
};
```

Reglas:

- tasa 22 explícita => usar 22
- tasa 10 explícita => usar 10
- 10 inferida por texto sin respaldo => review
- crédito/débito según tipo documental
- export/exenta/no gravada => solo automática si snapshot lo soporta expresamente

### 6.3 Reglas contables mínimas
Separar del motor IVA pero alimentadas por él.

#### Compras
- neto gravado => cuenta de gasto/costo/categoría
- IVA creditable => cuenta `IVA Compras`
- IVA no creditable => capitalizar al gasto/costo o cuenta especial según snapshot
- contrapartida => proveedor / caja / banco según flujo o default

#### Ventas
- neto gravado => cuenta de ingresos
- IVA output => cuenta `IVA Ventas`
- contrapartida => deudores / caja / banco / resumen ventas

---

## 7. Scope operativo exacto para la liquidación mensual de IVA

### 7.1 Fórmula base del `vat_run`
```txt
vat_run.net_vat = output_vat
                - input_vat_creditable
                + input_vat_non_deductible_adjustments
                + other_positive_adjustments
                - carryforward_in
```

Para V1, mantenerlo simple y explícito:

```txt
output_vat = suma IVA ventas confirmadas
input_vat_creditable = suma IVA compras confirmadas con status creditable
input_vat_non_creditable = suma IVA compras confirmadas con status non_creditable (solo trazabilidad, no deduce)
vat_to_pay_or_carry = output_vat - input_vat_creditable - carryforward_in
```

Si `vat_to_pay_or_carry < 0`:
- no devolver automáticamente
- generar `carryforward_out = abs(valor)`
- salvo casos especiales aprobados para exportación, que en V1 deben pasar por revisión

### 7.2 Qué entra al vat_run
Solo documentos:

- confirmados por usuario
- dentro del período mensual
- no anulados
- con snapshot fiscal trazable

### 7.3 Qué no entra
- drafts no confirmados
- documentos con error
- documentos reabiertos y pendientes
- documentos fuera de período
- documentos manual_review sin resolución final

---

## 8. OpenAI: guardrails obligatorios para intake documental

Esta sección incorpora el consejo operativo que ya estaba definido y se congela ahora como estándar de implementación.

### 8.1 API
Usar **Responses API**.

No usar Chat Completions para esta pieza.

### 8.2 Structured output estricto
Usar `text.format.type = "json_schema"` con `strict = true`.

### 8.3 Background mode
Todos los procesamientos documentales deben ejecutarse con `background: true`.

### 8.4 Persistencia remota mínima
Usar `store: false` por defecto.

### 8.5 Política de transporte de archivos
El adapter debe soportar:

- `base64`
- `file_id`
- `signed_url` interna cuando corresponda

Regla práctica:

- archivos chicos one-shot => `base64`
- archivos grandes o con reintentos => `file_id`
- no subir siempre a Files por reflejo

### 8.6 Contexto normativo mínimo
Nunca enviar normativa completa.  
Solo enviar:

- `organization_tax_profile`
- `organization_rule_snapshot`
- instrucciones base
- archivo/documento

### 8.7 Budget de contexto
Definir límites de tamaño para snapshots:

```ts
type RuleSnapshotBudget = {
  max_rules: number;
  max_chars_prompt_brief: number;
  max_tokens_estimate: number;
};
```

Sugerencia inicial:

- `max_rules = 50`
- `max_chars_prompt_brief = 6000`
- `max_tokens_estimate = 2500`

Si el snapshot excede eso:
- compactar
- resumir
- o marcar el documento para pipeline alternativo

### 8.8 Suite de evals obligatoria
Antes de mover versión de prompt o snapshot a producción, correr evals:

- PDF con texto
- PDF escaneado
- JPG
- PNG
- compra 22 simple
- compra ticket no creditable
- compra con IVA no discriminado
- venta 22
- venta 10 explícita
- nota de crédito
- nota de débito
- exportación detectada
- exenta detectada
- snapshot inválido
- timeout
- schema inválido
- duplicado por hash
- org con `vat_regime != GENERAL`

### 8.9 Metadatos obligatorios por corrida
Persistir en `document_processing_runs`:

- `model`
- `provider`
- `response_id`
- `background_job_id` si aplica
- `schema_version`
- `snapshot_id`
- `profile_version`
- `latency_ms`
- `usage_input_tokens`
- `usage_output_tokens`
- `transport_mode`
- `store_remote`
- `status`
- `error_code`
- `error_message`

---

## 9. Step-driven development plan listo para Codex

> Cada step termina con criterios de aceptación.  
> Ningún step debe asumir normas fuera de este documento o del snapshot aprobado.

---

### STEP 0 - Congelar alcance, fuentes y banderas de bloqueo

**Objetivo**  
Congelar en repo el alcance fiscal exacto y las decisiones que Codex no debe adivinar.

**Tareas**
- Crear `docs/tax/uy-iva-mvp-sa-srl-sas.md` con este contenido.
- Crear `docs/tax/blockers.md` con decisiones pendientes.
- Fijar feature flags:
  - `VAT_UY_MVP_ENABLED`
  - `VAT_UY_EXPORT_AUTO_DISABLED`
  - `VAT_UY_MIXED_USE_MANUAL_REVIEW`
  - `VAT_UY_SIMPLIFIED_REGIME_AUTO_DISABLED`

**Aceptación**
- El repo tiene este spec como fuente canónica.
- Exportaciones, mixtas y simplificados quedan explícitamente bloqueados o bajo revisión.

---

### STEP 1 - Modelar perfil fiscal organizacional

**Objetivo**  
Impedir que el sistema use solo la forma jurídica para decidir IVA.

**Tareas**
- Agregar tabla `organization_profile_versions`.
- Campos mínimos:
  - `organization_id`
  - `country_code`
  - `legal_entity_type`
  - `tax_id`
  - `vat_regime`
  - `dgi_group`
  - `cfe_status`
  - `effective_from`
  - `effective_to`
  - `version`
  - `created_by`
- Validar:
  - `country_code = UY`
  - `legal_entity_type ∈ {SA, SRL, SAS, OTHER}`
  - `vat_regime ∈ {GENERAL, IVA_MINIMO, OTRO, UNKNOWN}`
- Bloquear motor fiscal si falta alguno de:
  - `country_code`
  - `tax_id`
  - `vat_regime`

**Aceptación**
- No existe camino de cálculo de IVA sin `vat_regime`.
- Cambiar el perfil genera una nueva versión, no pisa la anterior.

---

### STEP 2 - Modelar snapshots de reglas por organización

**Objetivo**  
Materializar un snapshot chico, versionado y apto para prompt.

**Tareas**
- Crear tabla `organization_rule_snapshots`.
- Campos:
  - `id`
  - `organization_id`
  - `profile_version_id`
  - `jurisdiction = UY`
  - `tax_domain = IVA`
  - `snapshot_json`
  - `prompt_brief`
  - `rule_codes`
  - `status = draft|approved|retired`
  - `effective_from`
  - `effective_to`
  - `created_at`
- `snapshot_json` debe incluir:
  - tasas activas permitidas
  - reglas de crédito fiscal
  - categorías contables base
  - operaciones soportadas
  - operaciones que fuerzan review
  - referencias normativas resumidas

**Aceptación**
- Cada documento nuevo puede enlazar un `snapshot_id`.
- Los drafts viejos quedan congelados con su snapshot original.

---

### STEP 3 - Capa OpenAI con contrato estricto

**Objetivo**  
Implementar el adapter de IA sin mezclar normativa completa ni lógica fiscal final.

**Tareas**
- Crear módulo `modules/ai/openai-document-intake.ts`.
- Usar Responses API.
- Implementar options:
  - `background: true`
  - `store: false`
- Implementar transporte:
  - `base64`
  - `file_id`
  - `signed_url`
- Forzar salida con `json_schema strict`.
- Versionar:
  - `prompt_version`
  - `schema_version`

**Aceptación**
- Ninguna llamada sale sin schema estricto.
- Ninguna llamada usa normativa completa.
- Toda corrida queda auditada.

---

### STEP 4 - Pipeline documental con draft persistente

**Objetivo**  
Convertir archivo o carga manual en draft persistente.

**Tareas**
- Crear tablas:
  - `document_processing_runs`
  - `document_field_candidates`
  - `document_classification_candidates`
  - `document_drafts`
  - `document_draft_revisions`
- Estados del documento:
  - `uploaded`
  - `queued`
  - `processing`
  - `draft_ready`
  - `classified`
  - `error`
- Persistir siempre un draft aunque la confianza sea baja.
- Separar:
  - extracción
  - clasificación
  - determinación IVA preliminar
  - sugerencia contable preliminar

**Aceptación**
- Cerrar modal o recargar no pierde trabajo.
- Todo procesamiento exitoso termina en `draft_ready`, no en `classified`.

---

### STEP 5 - Motor determinístico de IVA compras

**Objetivo**  
Resolver crédito fiscal de compras usando reglas aprobadas.

**Tareas**
- Implementar `resolvePurchaseCredit`.
- Inputs:
  - `document_type`
  - `document_subtype`
  - `amounts`
  - `counterparty`
  - `organization_profile`
  - `snapshot`
- Casos mínimos:
  - compra 22 con IVA discriminado => `creditable`
  - compra 10 explícita => `creditable` si snapshot la soporta
  - ticket/e-ticket => `non_creditable`
  - IVA no discriminado => `non_creditable` o `unknown`
  - proveedor simplificado => `non_creditable`
  - mixta/parcial => `partial + review`

**Aceptación**
- Ningún ticket genera crédito.
- Ninguna compra sin IVA discriminado entra como crédito automático.
- Todo caso mixto/parcial fuerza review.

---

### STEP 6 - Motor determinístico de IVA ventas

**Objetivo**  
Resolver IVA output de ventas y ajustes.

**Tareas**
- Implementar `resolveSalesOutput`.
- Casos mínimos:
  - venta 22 explícita => output 22
  - venta 10 explícita => output 10
  - nota de crédito => ajuste negativo
  - nota de débito => ajuste positivo
  - e-ticket venta => output sí, crédito compras no aplica
  - export/exenta/no gravada => clasificar y review salvo regla explícita

**Aceptación**
- El motor no inventa 10% por texto.
- Notas corrigen el impuesto en el signo correcto.
- Exportaciones sin regla aprobada no se liquidan solas.

---

### STEP 7 - Sugerencia contable acoplada al resultado fiscal

**Objetivo**  
Generar `journal_entry` draft coherente con la resolución fiscal.

**Tareas**
- Crear `journal_entry_suggestions`.
- Mapear:
  - compra gravada => gasto/costo + IVA compras + proveedor
  - compra no creditable => gasto/costo totalizado
  - venta gravada => cliente/caja + ingresos + IVA ventas
  - notas => asiento reverso o ajuste
- Mantener editable por usuario.

**Aceptación**
- Débitos/créditos balancean.
- El asiento refleja si el IVA compras es creditable o no.

---

### STEP 8 - Wizard modal con única confirmación final

**Objetivo**  
Permitir edición humana y confirmación del conjunto.

**Tareas**
- Pasos del wizard:
  1. clasificación y vista previa
  2. datos extraídos
  3. resultado IVA
  4. asiento sugerido
  5. resumen final
- Autosave de draft en cada paso.
- Botón único final: `Confirmar y crear borrador contable`.

**Aceptación**
- El usuario puede volver atrás.
- Solo el paso final cambia estado a confirmado.
- Confirmar crea `journal_entry.status = 'draft'`.

---

### STEP 9 - vat_runs mensuales

**Objetivo**  
Calcular liquidación mensual desde documentos confirmados.

**Tareas**
- Crear `vat_runs`.
- Campos mínimos:
  - `organization_id`
  - `period_ym`
  - `snapshot_id`
  - `carryforward_in`
  - `output_vat`
  - `input_vat_creditable`
  - `input_vat_non_creditable`
  - `carryforward_out`
  - `net_vat_payable`
  - `status`
- Construir desde documentos confirmados del período.
- Excluir drafts y documentos pendientes.

**Aceptación**
- Cada línea del vat_run es trazable a documentos confirmados.
- Los saldos negativos arrastran como `carryforward_out`.

---

### STEP 10 - Suite de pruebas y evals

**Objetivo**  
Evitar regresiones fiscales y de intake.

**Tareas**
- Crear fixtures reales anonimizados:
  - compra e-factura 22
  - compra ticket
  - venta e-factura 22
  - venta 10 explícita
  - nota de crédito
  - export invoice
  - documento con neto/IVA/total roto
  - proveedor simplificado
- Tests unitarios para motor fiscal.
- Evals de schema para IA.
- Test de congelación de snapshot.

**Aceptación**
- `schema_pass_rate` > objetivo definido
- `manual_review_rate` medido
- `field_accuracy` medido
- `vat_resolution_accuracy` medido en dataset curado

---

## 10. Casos de negocio y reglas de resolución

### 10.1 Compra nacional gravada 22%
**Entrada típica**
- e-Factura de proveedor
- neto + IVA 22 discriminado
- comprador identificado

**Resultado**
- `input_credit_status = creditable`
- `requires_manual_review = false`
- asiento:
  - débito gasto/costo
  - débito IVA compras
  - crédito proveedor/caja

### 10.2 Compra en e-Ticket
**Resultado**
- `input_credit_status = non_creditable`
- `reason_code = UY_VAT_PURCHASE_TICKET_NO_CREDIT`
- asiento:
  - débito gasto/costo por total
  - crédito caja/tarjeta/proveedor

### 10.3 Compra con IVA no discriminado
**Resultado**
- no crédito automático
- revisión manual o `non_creditable`

### 10.4 Venta nacional 22%
**Resultado**
- `output_tax_status = output_taxable`
- `rate = 22`
- asiento:
  - débito cliente/caja
  - crédito ingresos
  - crédito IVA ventas

### 10.5 Venta nacional 10% explícita
**Resultado**
- `output_tax_status = output_taxable`
- `rate = 10`
- si la tasa no surge con claridad del documento o snapshot => review

### 10.6 Nota de crédito de venta
**Resultado**
- reduce base e IVA output del comprobante relacionado
- si no puede vincularse al origen => review

### 10.7 Proveedor bajo IVA mínimo / simplificado
**Resultado**
- compra se registra, pero sin crédito fiscal automático

### 10.8 Exportación
**Resultado MVP**
- clasificar y guardar
- `requires_manual_review = true` salvo regla específica aprobada

### 10.9 Exenta / no gravada
**Resultado MVP**
- clasificar y guardar
- `requires_manual_review = true` salvo snapshot aprobado

---

## 11. Preguntas bloqueantes que Codex NO debe asumir

Estas preguntas deben quedar resueltas por owner antes de ampliar el MVP. Mientras no estén aprobadas, el código debe mantener el fallback seguro.

1. **¿Exportación de bienes entra en auto-liquidación V1 o solo clasificación + review?**  
   Recomendación segura: clasificación + review.

2. **¿Exportación de servicios entra en V1 automático?**  
   Recomendación segura: no. Solo detección + review.

3. **¿Ventas exentas/no gravadas se auto-liquidan o solo se registran?**  
   Recomendación segura: solo registro + review salvo regla aprobada.

4. **¿Cómo se resuelve la prorrata de compras mixtas en V1?**  
   Recomendación segura: manual review.

5. **¿Cómo se resuelve la diferencia de tasas al cierre anual?**  
   Recomendación segura: fuera de auto-liquidación V1.

6. **¿Se soportará importación de servicios o cambio de sujeto?**  
   Recomendación segura: fuera de V1.

7. **¿Se exigirá vínculo obligatorio entre notas y comprobante original?**  
   Recomendación segura: sí; si no hay vínculo confiable => review.

---

## 12. Recomendación práctica de freeze para el primer release útil

Si el objetivo es salir rápido sin fabricar un error fiscal automatizado con UX linda, el release 1 debería congelarse así:

### Perfil organizacional obligatorio
- `country_code`
- `legal_entity_type`
- `tax_id`
- `vat_regime`
- `dgi_group`
- `cfe_status`

### Automatización fiscal habilitada solo para
- SA / SRL / SAS
- Uruguay
- `vat_regime = GENERAL`
- operaciones internas gravadas
- compras con documentación apta
- ventas con tasa explícita 22 o 10
- notas asociadas

### Clasificación + review obligatoria para
- exportaciones
- exentas / no gravadas
- mixtas / parciales
- simplificados
- documentación incompleta

Ese recorte ya da un MVP serio para IVA mensual. Lo otro también se puede hacer, claro. También se puede poner alas a una licuadora. No por eso conviene.

---

## 13. Fuentes oficiales utilizadas

### DGI / GUB
- DGI. **Régimen de IVA mínimo - Pequeña Empresa**. Indica que puede aplicar cualquiera sea la forma jurídica y menciona obligaciones/documentación del régimen.  
  URL: `https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/regimen-iva-minimo-pequena-empresa`

- DGI. **Una sociedad anónima puede ampararse en el régimen de Pequeña Empresa**.  
  URL: `https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/sociedad-anonima-puede-ampararse-regimen-pequena-empresa`

- DGI. **Sujetos obligados a la presentación del formulario 2148**. Incluye referencia a SRL que tributan IVA mínimo.  
  URL: `https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/sujetos-obligados-presentacion-del-formulario-2148`

- DGI. **Declaraciones juradas grupo No CEDE**. Referencias operativas formulario 2178 y condiciones de uso de servicios con datos precargados.  
  URL: `https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/declaraciones-juradas-grupo-no-cede`

- DGI. **Formularios incluidos en la aplicación PADI**. Incluye referencia a formulario 1376 para CEDE/GC a partir de obligaciones de octubre 2021.  
  URL: `https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/formularios-incluidos-aplicacion-padi`

- DGI. **Guía de ingreso a facturación electrónica**. Universalización e ingreso al régimen.  
  URL: `https://www.gub.uy/direccion-general-impositiva/guia-ingreso-facturacion-electronica`

### e-Factura DGI
- e-Factura DGI. **Universalización de facturación electrónica: plazo para restantes contribuyentes de IVA**.  
  URL: `https://www.efactura.dgi.gub.uy/principal/ampliacion_de_contenido/universalizacion-de-facturacion-electronica-plazo-para-restantes-contribuyentes-de-iva?es=`

- e-Factura DGI. Materiales y preguntas frecuentes sobre CFE, tipos de comprobantes, e-Factura, e-Ticket, e-Notas, e-Boleta de Entrada y exportación.  
  URL base: `https://www.efactura.dgi.gub.uy/`

### IMPO
- IMPO. **Texto Ordenado 1996 - Título 10 - IVA**.  
  URL: `https://www.impo.com.uy/bases/todgi/10-1996`

- IMPO / Diario Oficial. **Decreto 220/998 y modificaciones**. Incluye tasas, reglas de deducción y artículos reglamentarios relevantes.  
  URL de referencia de modificación consultada: `https://www.impo.com.uy/diariooficial/2007/06/26/documentos.pdf`

---

## 14. Apéndice: criterios mínimos de acceptance para Codex

### Acceptance funcional
- No se calcula IVA automático sin `vat_regime`.
- No se infiere régimen por forma jurídica.
- No se concede crédito fiscal a tickets.
- No se concede crédito fiscal automático si no hay IVA discriminado.
- No se auto-liquida exportación sin regla explícita.
- Solo existe una confirmación final.
- `vat_run` mensual se arma solo con documentos confirmados.

### Acceptance técnico
- Responses API + `json_schema strict`
- `background: true`
- `store: false`
- snapshot por organización pequeño y versionado
- trazabilidad de snapshot y profile version por documento
- evals documentales obligatorias

### Acceptance de auditoría
- Cada documento confirmado muestra:
  - snapshot usado
  - perfil usado
  - reglas aplicadas
  - decisión de crédito / output
  - usuario que confirmó
  - asiento borrador generado
  - período de IVA impactado

---

## 15. Instrucción final para implementación

**No implementar** lógica fiscal fuera de:

- `organization_profile_versions`
- `organization_rule_snapshots`
- `vat engine`
- `journal suggestion engine`

Si una decisión fiscal aparece incrustada en UI, prompt ad hoc, controller o componente random:
- se considera bug de arquitectura
- debe moverse a motor o snapshot

Porque si la norma vive en cinco lugares, deja de ser norma y pasa a ser una sesión de espiritismo con PostgreSQL.