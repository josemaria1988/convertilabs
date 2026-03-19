# Spec — settlement-aware posting y asientos multi-linea

Estado: implementado parcial
Ambito: backend + frontend + datos + IA + rollout
Modulo principal: `04-documents/` con soporte en `03-accounting/`, `06-integrations/` y `07-platform/`

Nota editorial 2026-03-19:

- ya existen piezas activas en el repo para `template-resolver`, `settlementContext`, `SettlementMethodCard`, preview multi-linea, `journal_entries`/`open_items` y persistencia del contexto en review;
- este documento sigue siendo util como spec viva y contrato de evolucion, pero ya no describe solo trabajo futuro;
- lo pendiente hoy se concentra en follow-up settlements mas profundos, simulacion/operacion masiva y cierre mas uniforme de la UX.

## 1. Problema a resolver

El problema original de esta spec era que el review documental estaba demasiado centrado en una sola `cuenta sugerida`. Ese limite ya se corrigio en parte, pero sigue siendo un buen marco para explicar por que el producto evoluciono hacia templates, settlement context y preview multi-linea.

Una factura no "va a una cuenta". Una factura dispara una **plantilla de asiento** con varias lineas:

- contrapartida de cobro/pago o cuenta a cobrar/pagar;
- cuenta principal de ingreso, gasto, inventario o activo;
- linea fiscal (IVA u otra);
- eventualmente lineas complementarias o evento posterior de settlement.

Ejemplos:

### Venta contado cobrada en efectivo

- Debe: Caja
- Haber: Ventas
- Haber: IVA ventas

### Venta credito

- Debe: Deudores por ventas
- Haber: Ventas
- Haber: IVA ventas

### Venta contado con tarjeta

Asiento al vender:

- Debe: Tarjetas a cobrar / adquirente
- Haber: Ventas
- Haber: IVA ventas

Asiento posterior al liquidar la tarjeta:

- Debe: Banco
- Debe: Comision / IVA comision si aplica
- Haber: Tarjetas a cobrar / adquirente

## 2. Objetivo funcional

Consolidar un modelo de posting donde:

1. el documento siga siendo el disparador principal;
2. la IA extraiga y sugiera solo lo que el documento realmente permite inferir;
3. el usuario complete el contexto minimo faltante cuando el documento no alcanza;
4. el motor deterministico seleccione una plantilla contable;
5. el sistema genere multiples lineas de asiento, no una sola cuenta;
6. los cobros/pagos posteriores se registren como eventos separados cuando corresponda;
7. las decisiones del usuario alimenten reglas reutilizables sin reescribir historicos.

## 3. Principios no negociables

1. **Separacion documento vs settlement**
   - La factura o documento comercial no siempre prueba el medio efectivo de cobro/pago.
   - El settlement debe modelarse por separado.

2. **IA acotada**
   - Puede extraer `payment_terms` y `settlement_method` solo si aparecen explicitamente.
   - Puede sugerir una `template_code` dentro de un set permitido.
   - No puede inventar medios de pago ni crear reglas duras sola.

3. **Template primero, cuentas despues**
   - El sistema elige una familia operativa y una plantilla.
   - Luego resuelve las cuentas por rol.

4. **Fallback honesto**
   - Si el medio de settlement no se conoce, no se adivina.
   - Se usa cuenta puente provisoria y queda pendiente de resolucion.

5. **Historia inmutable**
   - Cambios de reglas o mappings operan hacia adelante.
   - Un documento ya confirmado solo cambia con reapertura controlada.

## 4. Alcance MVP

Incluido en esta spec:

- ventas locales contado y credito;
- compras locales contado y credito;
- recepciones de recibos/cobranzas o pagos posteriores;
- ventas contado con medio explicito o desconocido;
- ventas con tarjeta como clearing previo a liquidacion;
- pagos mixtos simples;
- preview multi-linea;
- aprendizaje de reglas que incluyan `payment_terms` y `settlement_method` cuando existan.

Fuera de alcance de esta iteracion:

- emision CFE;
- tesoreria bancaria avanzada;
- conciliacion bancaria completa;
- integracion POS/adquirentes en tiempo real;
- tesoreria multi-caja profunda;
- retenciones complejas fuera del flujo basico;
- reconciliacion automatica total de extractos.

## 5. Modelo conceptual

Nuevo modelo canonico:

```text
Documento
→ Hechos extraidos
→ Operacion contable (sale / purchase / receipt / payment / credit_note / etc.)
→ Payment terms (cash / credit)
→ Settlement method (cash / bank / card / check / mixed / unknown)
→ Plantilla contable
→ Resolucion de cuentas por rol
→ Preview multi-linea
→ Posting provisional/final
→ Settlement posterior si aplica
→ Aprendizaje
```

## 6. Tipos y enums canonicos

### 6.1 OperationKind

```ts
export type OperationKind =
  | 'sale_invoice'
  | 'purchase_invoice'
  | 'customer_receipt'
  | 'supplier_payment'
  | 'sale_credit_note'
  | 'purchase_credit_note'
  | 'card_settlement'
  | 'bank_transfer_settlement'
  | 'manual_settlement_adjustment';
```

### 6.2 PaymentTerms

```ts
export type PaymentTerms = 'cash' | 'credit' | 'unknown';
```

### 6.3 SettlementMethod

```ts
export type SettlementMethod =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'check'
  | 'mixed'
  | 'unknown';
```

### 6.4 SettlementEvidenceSource

```ts
export type SettlementEvidenceSource =
  | 'invoice_document'
  | 'receipt_document'
  | 'bank_statement'
  | 'card_settlement_document'
  | 'user_input'
  | 'imported_erp'
  | 'none';
```

### 6.5 PostingTemplateCode

```ts
export type PostingTemplateCode =
  | 'sale_local_cash'
  | 'sale_local_credit'
  | 'purchase_local_cash'
  | 'purchase_local_credit'
  | 'customer_collection'
  | 'supplier_payment'
  | 'sale_cash_unknown_clearing'
  | 'purchase_cash_unknown_clearing'
  | 'card_sale_clearing'
  | 'card_settlement'
  | 'sale_export_cash'
  | 'sale_export_credit';
```

### 6.6 AccountRoleCode

```ts
export type AccountRoleCode =
  | 'revenue_account'
  | 'expense_account'
  | 'inventory_account'
  | 'fixed_asset_account'
  | 'output_vat_account'
  | 'input_vat_account'
  | 'accounts_receivable_account'
  | 'accounts_payable_account'
  | 'cash_account'
  | 'bank_account'
  | 'card_clearing_account'
  | 'check_clearing_account'
  | 'cash_sales_unidentified_account'
  | 'cash_purchases_unidentified_account'
  | 'bank_fees_account'
  | 'fx_difference_account';
```

## 7. Cambios de modelo de datos

La regla general es **reusar lo que ya existe** y agregar lo minimo necesario.

### 7.1 Extender `document_accounting_contexts`

Agregar columnas o `metadata_json` tipada para:

- `operation_kind`
- `payment_terms`
- `settlement_method`
- `settlement_evidence_source`
- `settlement_status`
- `settlement_allocations_json`
- `primary_account_id`
- `template_code`
- `requires_followup_settlement`
- `counterparty_role` (`customer` / `supplier`)
- `currency_code`
- `origin_channel` (`document`, `manual`, `imported`)

#### settlement_status

```ts
export type SettlementStatus =
  | 'not_applicable'
  | 'settled_on_document'
  | 'open_receivable'
  | 'open_payable'
  | 'pending_resolution'
  | 'pending_followup_event'
  | 'resolved';
```

### 7.2 Extender `document_assignment_runs`

Persistir en request/response:

- `suggested_operation_kind`
- `suggested_payment_terms`
- `suggested_settlement_method`
- `suggested_template_code`
- `suggested_account_roles_json`
- `generated_preview_lines_json`
- `settlement_needs_user_confirmation`
- `settlement_reasoning`
- `evidence_breakdown_json`

### 7.3 Extender `accounting_rules`

Agregar condiciones nuevas en `conditions_json`:

- `operation_kind`
- `payment_terms`
- `settlement_method`
- `counterparty_role`
- `tax_profile_code`
- `currency_policy`

Agregar scopes sugeridos:

- `vendor_concept_operation_terms`
- `operation_terms_settlement`
- `template_override`
- `settlement_override`

### 7.4 Formalizar `journal_templates`

Si el repo ya maneja templates como concepto importable, llevarlo a persistencia activa.

Nueva tabla:

`journal_templates`

Campos minimos:

- `id`
- `organization_id nullable` (null = sistema)
- `code`
- `name`
- `description`
- `operation_kind`
- `payment_terms`
- `settlement_method nullable`
- `structure_json`
- `is_system`
- `is_active`
- `version`
- `created_at`
- `updated_at`

`structure_json` define lineas por rol, no cuentas fijas.

Ejemplo:

```json
{
  "lines": [
    { "side": "debit", "role": "cash_account", "amount": "document.total" },
    { "side": "credit", "role": "revenue_account", "amount": "document.net_amount" },
    { "side": "credit", "role": "output_vat_account", "amount": "document.vat_amount" }
  ]
}
```

### 7.5 Reusar `chart_of_accounts`

Agregar o estandarizar metadata:

- `defaultRoleCodes[]`
- `settlementMethodHints[]`
- `currencyPolicy`
- `is_provisional`
- `externalCode`

Esto evita introducir una tabla paralela de mapeos si no hace falta.

### 7.6 Extender `journal_entries`

Agregar o estandarizar metadata:

- `operation_kind`
- `template_code`
- `payment_terms`
- `settlement_method`
- `source_document_id`
- `settlement_status`
- `posting_stage`
- `origin_event_type`

### 7.7 Extender `journal_entry_lines`

Agregar o estandarizar metadata:

- `role_code`
- `line_purpose`
- `tax_component`
- `settlement_component`
- `source_document_id`

### 7.8 Reusar `ledger_open_items`

Soportar tres clases:

```ts
export type OpenItemKind = 'receivable' | 'payable' | 'clearing';
```

Usos:

- `receivable`: factura credito venta
- `payable`: factura credito compra
- `clearing`: contado con medio desconocido o clearing de tarjeta pendiente

### 7.9 Reusar `ledger_settlement_links`

Usar para vincular:

- factura credito → recibo/cobro
- factura credito compra → pago
- clearing tarjeta → liquidacion tarjeta
- clearing contado desconocido → resolucion posterior

No crear otra tabla si `ledger_settlement_links` puede soportar source/target con `journal_entry_line_id` u `open_item_id`.

## 8. Templates contables minimos del MVP

### 8.1 `sale_local_cash`

Condicion:

- `operation_kind = sale_invoice`
- `payment_terms = cash`
- `settlement_method in (cash, bank_transfer)`

Lineas:

- Debe `cash_account` o `bank_account` por total
- Haber `revenue_account` por neto
- Haber `output_vat_account` por IVA

### 8.2 `card_sale_clearing`

Condicion:

- `operation_kind = sale_invoice`
- `payment_terms = cash`
- `settlement_method = card`

Lineas:

- Debe `card_clearing_account` por total
- Haber `revenue_account` por neto
- Haber `output_vat_account` por IVA

### 8.3 `sale_local_credit`

Condicion:

- `operation_kind = sale_invoice`
- `payment_terms = credit`

Lineas:

- Debe `accounts_receivable_account` por total
- Haber `revenue_account` por neto
- Haber `output_vat_account` por IVA

Abre `ledger_open_item(kind=receivable)`.

### 8.4 `sale_cash_unknown_clearing`

Condicion:

- `operation_kind = sale_invoice`
- `payment_terms = cash`
- `settlement_method = unknown`

Lineas:

- Debe `cash_sales_unidentified_account` por total
- Haber `revenue_account` por neto
- Haber `output_vat_account` por IVA

Crea `ledger_open_item(kind=clearing)` opcional para seguimiento.

### 8.5 `purchase_local_cash`

Condicion:

- `operation_kind = purchase_invoice`
- `payment_terms = cash`
- `settlement_method in (cash, bank_transfer, check)`

Lineas:

- Debe `expense_account` o `inventory_account` por neto
- Debe `input_vat_account` por IVA deducible
- Haber `cash_account` / `bank_account` / `check_clearing_account` por total

### 8.6 `purchase_local_credit`

Condicion:

- `operation_kind = purchase_invoice`
- `payment_terms = credit`

Lineas:

- Debe `expense_account` o `inventory_account` por neto
- Debe `input_vat_account` por IVA deducible
- Haber `accounts_payable_account` por total

Abre `ledger_open_item(kind=payable)`.

### 8.7 `purchase_cash_unknown_clearing`

Condicion:

- `operation_kind = purchase_invoice`
- `payment_terms = cash`
- `settlement_method = unknown`

Lineas:

- Debe `expense_account` o `inventory_account` por neto
- Debe `input_vat_account` por IVA deducible
- Haber `cash_purchases_unidentified_account` por total

### 8.8 `customer_collection`

Condicion:

- `operation_kind = customer_receipt`

Lineas:

- Debe medio de ingreso real
- Haber `accounts_receivable_account`

Aplica settlement link al open item.

### 8.9 `supplier_payment`

Condicion:

- `operation_kind = supplier_payment`

Lineas:

- Debe `accounts_payable_account`
- Haber medio de salida real

Aplica settlement link al open item.

### 8.10 `card_settlement`

Condicion:

- `operation_kind = card_settlement`

Lineas basicas:

- Debe `bank_account` por neto acreditado
- Debe `bank_fees_account` por arancel
- Haber `card_clearing_account` por bruto

Si se quiere mas prolijidad futura, se agrega IVA de comision como linea separada.

## 9. Resolucion deterministica

### 9.1 Motor de templates

Nuevo modulo:

- `modules/accounting/template-resolver.ts`

Responsabilidad:

1. recibir facts del documento + accounting context;
2. decidir `operation_kind`;
3. decidir `payment_terms`;
4. decidir `settlement_method` si hay evidencia;
5. seleccionar `template_code`;
6. devolver blockers si falta contexto.

### 9.2 Motor de cuentas por rol

Nuevo modulo:

- `modules/accounting/account-role-resolver.ts`

Responsabilidad:

resolver cada `AccountRoleCode` a un `chart_of_accounts.id` usando este orden:

1. override del documento;
2. regla aprobada especifica;
3. mapping por rol en metadata de cuenta;
4. preset activo / overlay;
5. cuenta provisional `TEMP-*`.

### 9.3 Constructor de lineas

Nuevo modulo:

- `modules/accounting/journal-entry-builder.ts`

Responsabilidad:

1. leer template;
2. evaluar formulas de montos;
3. resolver cuentas;
4. generar `journal_entry_lines`;
5. validar balance;
6. devolver preview estructurado.

### 9.4 Servicio de follow-up settlement

Nuevo modulo:

- `modules/accounting/settlement-resolution-service.ts`

Responsabilidad:

1. tomar un open item o clearing pendiente;
2. registrar evento de settlement;
3. crear journal entry complementario;
4. vincular mediante `ledger_settlement_links`;
5. cerrar estado pendiente.

## 10. Reglas IA

### 10.1 Cambios al contrato de intake

Extender `modules/ai/document-intake-contract.ts` con campos opcionales:

```ts
paymentTerms?: 'cash' | 'credit' | 'unknown';
settlementMethodExplicit?: SettlementMethod;
settlementMethodEvidenceText?: string;
hasReceiptLanguage?: boolean;
hasCardVoucherLanguage?: boolean;
hasBankTransferReference?: boolean;
```

La IA solo puede completar estos campos si hay evidencia textual/visual clara en el documento.

### 10.2 Nuevo contrato de sugerencia contable

Crear:

- `modules/ai/accounting-template-suggestion-contract.ts`

Salida permitida:

```ts
{
  suggestedOperationKind: OperationKind;
  suggestedPaymentTerms: PaymentTerms;
  suggestedSettlementMethod: SettlementMethod;
  suggestedTemplateCode: PostingTemplateCode;
  suggestedPrimaryAccountId?: string;
  suggestedRoleAccounts?: Array<{ role: AccountRoleCode; accountId: string }>;
  blockers: string[];
  warnings: string[];
  rationale: string;
  confidence: number;
  needsUserSettlementConfirmation: boolean;
}
```

### 10.3 Guardrails

La IA no puede:

- inventar una cuenta fuera del set habilitado;
- marcar settlement method si la evidencia no existe;
- crear una nueva plantilla automaticamente;
- postear;
- crear una regla aprobada sin decision humana.

### 10.4 Aprendizaje

`modules/accounting/learning-approval-service.ts` debe poder materializar reglas como:

```text
vendor = ANTEL
operation_kind = purchase_invoice
payment_terms = credit
→ template = purchase_local_credit
→ expense_account = telecom_expense
```

Y tambien:

```text
document_type = sale_invoice
payment_terms = cash
settlement_method = card
→ template = card_sale_clearing
→ card_clearing_account = pos_clearing_default
```

Solo se crea regla si la decision fue confirmada por usuario o provenia de mapping operativo importado.

## 11. UX / Frontend

### 11.1 Objetivo UX

La UI ya no debe pedir una sola cuenta. Debe pedir:

- familia operativa;
- condicion contado/credito;
- settlement solo si hace falta;
- cuenta principal;
- preview multi-linea;
- guardar criterio reusable.

### 11.2 Rediseño del review workspace

Archivo principal:

- `components/documents/document-review-workspace.tsx`

Nueva estructura sugerida:

#### Paso A. Revision factual

Sin cambio fuerte.

#### Paso B. Operacion y settlement

Campos:

- `operationKind` (autocompletado, editable)
- `paymentTerms` (autocompletado, editable)
- `settlementMethod` (condicional)
- `settlementEvidenceSource` (readonly o editable si es manual)
- `settlementAllocations[]` si `mixed`
- `requiresFollowupSettlement` (readonly)

Reglas UX:

- si `paymentTerms = credit`, ocultar selector de medio salvo override avanzado;
- si `paymentTerms = cash` y no hay medio explicito, mostrar selector obligatorio con opcion `No lo se todavia`;
- si `settlementMethod = mixed`, abrir sub-grid con montos por metodo.

#### Paso C. Cuenta principal

Renombrar actual `Cuenta a usar` a algo mas correcto:

- `Cuenta principal`
- o `Cuenta de ingreso / gasto / inventario`

No representa el asiento entero.

#### Paso D. Preview contable completo

Archivo principal:

- `components/documents/accounting-impact-preview.tsx`

Debe mostrar:

- template elegida;
- lineas debit/credit;
- rol de cada linea;
- si alguna cuenta es provisional;
- warning si el settlement esta en clearing pendiente;
- open item que se abrira si corresponde.

#### Paso E. Aprendizaje

Checkboxes sugeridos:

- `Guardar criterio de cuenta principal`
- `Guardar criterio de template`
- `Guardar criterio de settlement method` (solo si se confirma manualmente y aplica)

### 11.3 Nuevo componente `settlement-method-card.tsx`

Ubicacion:

- `components/documents/settlement-method-card.tsx`

Responsabilidad:

- mostrar el medio detectado;
- permitir override;
- mostrar fuente de evidencia;
- mostrar warning `documento no prueba medio de settlement`;
- soportar `mixed`.

### 11.4 Nuevo componente `template-preview-card.tsx`

Ubicacion:

- `components/documents/template-preview-card.tsx`

Responsabilidad:

- mostrar familia operativa;
- explicar por que se eligio la plantilla;
- mostrar si necesita follow-up settlement;
- linkear a `rule-application-card`.

### 11.5 Ajustes en settings

No abrir otra seccion protagonista. Mantener el norte documental.

En `app/app/o/[slug]/settings/page.tsx` agregar bloque:

**Roles contables operativos**

Mappings minimos:

- Caja moneda base
- Banco moneda base
- Caja USD / Banco USD si existe
- Clientes
- Proveedores
- Tarjetas a cobrar
- Cheques a depositar
- Cobros contado a identificar
- Pagos contado a identificar
- IVA ventas tasa basica
- IVA compras deducible basico
- Comisiones tarjetas

Esto puede vivir en settings dentro del chart admin, no como modulo aparte.

### 11.6 Pendientes y seguimiento

No reabrir `/open-items` como seccion visible principal.

Agregar en `/documents` filtros/chips:

- `Pendientes de asignacion`
- `Pendientes de settlement`
- `Con clearing provisional`
- `Listos para provisional`
- `Posteados finales`

Y en el detalle del documento:

- tarjeta `Settlement follow-up`

## 12. Server actions y endpoints

### 12.1 Mantener superficie privada basada en server actions

Alinear con arquitectura actual.

No hace falta abrir APIs publicas nuevas para el MVP.

### 12.2 Nuevas server actions sugeridas

- `saveDocumentSettlementContextAction(...)`
- `previewDocumentPostingAction(...)`
- `approveDocumentLearningAction(...)`
- `resolveSettlementAction(...)`
- `applyMixedSettlementAction(...)`

### 12.3 Endpoint opcional interno de estado

Solo si hace falta polling o integración puntual:

- `/api/v1/documents/[documentId]/settlement-status`

No es prioridad inicial si la UI ya usa server actions.

## 13. Flujo backend paso a paso

### 13.1 Upload e intake

Sin romper flujo actual:

1. upload privado;
2. procesamiento Inngest;
3. `DocumentIntakeOutput`;
4. persistencia de facts;
5. draft listo.

Cambios:

- intake debe intentar extraer `paymentTerms`;
- si existe evidencia, extraer `settlementMethodExplicit`;
- persistir hints en `document_accounting_contexts` o draft step.

### 13.2 Review

1. usuario entra al documento;
2. se cargan facts + hints + account mappings por rol;
3. `classification-runner` pide sugerencia IA acotada si aplica;
4. `template-resolver` arma template;
5. `journal-entry-builder` arma preview;
6. UI muestra preview y bloqueos;
7. usuario confirma o corrige.

### 13.3 Posting provisional

`post-provisional-service.ts` debe:

1. validar template resuelta;
2. validar cuentas por rol;
3. generar `journal_entries` y `journal_entry_lines` multi-linea;
4. abrir `ledger_open_items` si corresponde;
5. marcar `settlement_status`;
6. persistir explainability;
7. actualizar `posting_status`.

### 13.4 Posting final

`confirm-final-service.ts` debe:

1. confirmar journal;
2. congelar snapshot de template y cuentas;
3. materializar regla aprobada si usuario lo pidio;
4. sincronizar VAT run;
5. dejar trazabilidad de decision.

### 13.5 Settlement posterior

`settlement-resolution-service.ts` debe poder correr desde:

- documento recibo/pago;
- accion manual sobre clearing;
- importacion ERP;
- futura integración banco/tarjeta.

## 14. Casos de negocio y expected accounting

### Caso 1 — Venta contado efectivo

Input:

- `operation_kind = sale_invoice`
- `payment_terms = cash`
- `settlement_method = cash`

Resultado:

- Debe Caja
- Haber Ventas
- Haber IVA ventas

### Caso 2 — Venta contado transferencia

Resultado:

- Debe Banco
- Haber Ventas
- Haber IVA ventas

### Caso 3 — Venta contado tarjeta

Resultado inicial:

- Debe Tarjetas a cobrar
- Haber Ventas
- Haber IVA ventas

Settlement posterior:

- Debe Banco
- Debe Comisiones
- Haber Tarjetas a cobrar

### Caso 4 — Venta credito

Resultado:

- Debe Clientes
- Haber Ventas
- Haber IVA ventas

Mas open item.

### Caso 5 — Cobranza posterior

Resultado:

- Debe Banco/Caja
- Haber Clientes

Y cierre de open item.

### Caso 6 — Compra contado banco

Resultado:

- Debe Gasto/Inventario
- Debe IVA compras
- Haber Banco

### Caso 7 — Compra credito

Resultado:

- Debe Gasto/Inventario
- Debe IVA compras
- Haber Proveedores

Mas open item.

### Caso 8 — Compra contado con medio desconocido

Resultado:

- Debe Gasto/Inventario
- Debe IVA compras
- Haber Pagos contado a identificar

### Caso 9 — Venta contado con medio desconocido

Resultado:

- Debe Cobros contado a identificar
- Haber Ventas
- Haber IVA ventas

### Caso 10 — Pago mixto

Input:

- total 1.100
- efectivo 500
- tarjeta 600

Resultado:

- Debe Caja 500
- Debe Tarjetas a cobrar 600
- Haber Ventas netas
- Haber IVA ventas

## 15. Cambios en exportaciones

`modules/exports/accounting-adapters.ts` y layouts externos deben soportar:

- journal entries con mas de 2 lineas;
- `template_code` y `operation_kind` en metadata exportable;
- `externalCode` del plan para todas las lineas;
- scope por `posted_provisional` o `posted_final` ya existente;
- familias nuevas (`card_settlement`, `customer_collection`, etc.).

No hay que pegar la logica a Zeta ni a un ERP especifico. Primero se mantiene el modelo canonico interno.

## 16. Migraciones propuestas

### Migration A — settlement context

- extender `document_accounting_contexts`
- extender `document_assignment_runs`
- extender `accounting_rules`

### Migration B — journal templates

- crear `journal_templates`
- backfill minimo de templates del sistema

### Migration C — ledger improvements

- extender `ledger_open_items` con `kind`
- adaptar `ledger_settlement_links`

### Migration D — chart role metadata

- backfill en `chart_of_accounts.metadata`
- marcar cuentas provisionales de settlement si no existen

## 17. Plan de implementacion por fases

### Fase 1 — Fundacion de datos y templates

Entregables:

- enums y tipos canonicos;
- migraciones A/B/D;
- `journal_templates` del sistema;
- resolucion basica `sale_local_cash`, `sale_local_credit`, `purchase_local_cash`, `purchase_local_credit`.

### Fase 2 — Review UI y preview multi-linea

Entregables:

- nuevo bloque settlement en review workspace;
- preview multi-linea;
- cuenta principal renombrada;
- warning y fallback `unknown`.

### Fase 3 — Posting multi-linea y open items

Entregables:

- posting services reescritos sobre templates;
- creacion de `ledger_open_items`;
- settlement status persistido;
- export adapters validados.

### Fase 4 — Follow-up settlement

Entregables:

- `customer_collection`;
- `supplier_payment`;
- `card_settlement`;
- `ledger_settlement_links`;
- filtros de pendientes de settlement.

### Fase 5 — Aprendizaje avanzado

Entregables:

- reglas con `payment_terms` y `settlement_method`;
- materializacion aprobada por usuario;
- explainability mejorada.

## 18. Pruebas obligatorias

### Unit

- `template-resolver.test.ts`
- `account-role-resolver.test.ts`
- `journal-entry-builder.test.ts`
- `settlement-resolution-service.test.ts`

### Integration

- venta contado efectivo
- venta contado tarjeta
- venta credito
- compra credito
- compra contado medio desconocido
- cobro posterior con cierre de open item
- settlement mixto
- export contable multi-linea

### DB smoke

- migration parity
- posting provisional/final con templates
- cierre de open item via settlement

### UI / e2e

- review muestra settlement card cuando corresponde
- `No lo se todavia` crea cuenta puente
- `payment_terms=credit` no obliga medio
- preview refleja varias lineas

## 19. Feature flags sugeridas

- `DOCUMENT_SETTLEMENT_MODEL_ENABLED`
- `DOCUMENT_MULTI_LINE_POSTING_ENABLED`
- `DOCUMENT_SETTLEMENT_FOLLOWUP_ENABLED`

Rollout:

1. habilitar en orgs internas;
2. correr fixtures con ventas contado/credito;
3. validar export bridge;
4. habilitar por tenant;
5. recien luego considerar backfill parcial.

## 20. Criterios de aceptacion

La implementacion se considera aceptable cuando:

1. una venta ya no requiere elegir una sola cuenta sino una plantilla + cuenta principal + settlement context;
2. el preview muestra todas las lineas del asiento;
3. las ventas credito abren clientes y los cobros posteriores las cancelan;
4. las ventas contado con tarjeta no van directo a banco salvo que el usuario lo configure expresamente;
5. los casos `unknown` van a cuentas puente provisionales sin bloquear el flujo;
6. la IA solo sugiere settlement method cuando hay evidencia suficiente;
7. el usuario puede guardar reglas reutilizables con `payment_terms` y `settlement_method`;
8. el export bridge saca el asiento multi-linea correctamente.

## 21. Decision final

La correccion conceptual del sistema es esta:

- dejar de pensar `documento -> cuenta`
- pasar a `documento -> template -> roles -> lineas`
- separar `payment_terms` de `settlement_method`
- separar `documento comercial` de `evento de settlement`
- usar cuentas puente cuando falta evidencia
- dejar que la IA ayude, pero sin adivinar lo que el documento no dice

Eso arregla el problema contable de fondo sin convertir Convertilabs en un monstruo de tesoreria.
