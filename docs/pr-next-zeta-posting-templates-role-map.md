> **Estado Convertilabs 2.0:** referencia tecnica vigente para role map y plantillas contables Zeta. Queda subordinada a `docs/convertilabs-2.0-baseline-arquitectura.md`, `docs/analisis-arquitectura-convertilabs-2.0.md`, `docs/plan_de_accion_convertilabs2_PRs_analisis.md` y `docs/agent_rules.md`.

# PR siguiente - Plantillas base por familia operativa y Role Map Zeta

Fecha de planificacion original: 2026-04-20
Estado: referencia tecnica conservada; revisar codigo actual antes de usar como plan vigente.
Tipo: kernel contable, UX de reviewer y role map Zeta.

## 1. Contexto

Convertilabs ya tiene una integracion activa con Zetasoftware para importar CFEs recibidos y comprobantes emitidos. El tramo anterior deja o debe dejar materializados los maestros contables minimos de Zeta:

- Plan de Cuentas desde `RESTPlanCuentasV2Query`;
- Conceptos desde `RESTConceptosV1Query`;
- Tipos de Asiento desde `RESTTiposAsientosV1Query`;
- columnas de espejo proveedor en `chart_of_accounts`, incluyendo `provider_managed`, `source_provider = 'zetasoftware'`, `external_code`, `is_imputable`, jerarquia, literal tributario y metadata de proveedor.

El siguiente paso no es exportar a Zeta ni crear comprobantes. El siguiente paso es que Convertilabs deje de resolver una factura como "una cuenta suelta" y use la secuencia oficial:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable base
-> roles contables
-> cuentas reales del plan Zeta
-> preview multi-linea
-> posting futuro
```

Esto permite que el reviewer trabaje con lenguaje operativo y contable reutilizable, mientras el sistema conserva compatibilidad futura con Bandeja de Entrada de Asientos.

## 2. Objetivo

Implementar un primer set de plantillas contables base por familia operativa y un role map por organizacion que vincule roles internos de Convertilabs con cuentas imputables del plan de cuentas Zeta.

Resultado esperado para un CFE recibido:

```text
Plantilla:
Compra gasto operativo credito

Preview:
Debe  gasto / cuenta principal
Debe  IVA compras
Haber proveedores
```

Resultado esperado para una compra chica pagada con dinero personal:

```text
Plantilla:
Compra pagada con dinero personal / a reintegrar

Preview:
Debe  gasto
Debe  IVA compras
Haber cuenta a reintegrar a socio
```

Importante: el caso pagado por socio no usa Banco Rontil ni Caja Rontil, porque el dinero no sale de la empresa.

## 3. Principios obligatorios

- No convertir Convertilabs en un ERP generico ni en una UI manual de asientos.
- No pedir cuentas sueltas como flujo principal cuando corresponde plantilla y roles.
- No inventar cuentas.
- No usar cuentas no imputables.
- No modificar cuentas con `provider_managed = false`.
- No exportar a Zeta en este PR.
- No sincronizar Articulos, Bancos, Cajas, Cuentas Bancarias ni Contactos masivos en este PR.
- La IA puede sugerir, pero no puede saltearse reglas ni crear cuentas.
- Todo debe degradar a `manual_review`, `assisted` o `blocked` si falta un role mapping critico.
- No meter logica contable en componentes React.

## 4. Archivos a leer antes de implementar

Antes de editar codigo relacionado con esta referencia:

1. `docs/agent_rules.md`
2. `docs/convertilabs-2.0-baseline-arquitectura.md`
3. `docs/analisis-arquitectura-convertilabs-2.0.md`
4. `docs/plan_de_accion_convertilabs2_PRs_analisis.md`

Luego inspeccionar:

- `modules/accounting/classification-runner.ts`
- `modules/accounting/chart-admin.ts`
- `modules/accounting/*template*`
- `modules/accounting/*rule*`
- `components/documents/document-review-workspace.tsx`
- `components/documents/document-review-staged-workspace.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `components/mobile/accounting-template-card.tsx`
- `components/settings/integrations/zetasoftware-sync-panel.tsx`
- `db/schema/05_accounting.sql`
- `db/schema/07_integrations_and_audit.sql`
- `supabase/migrations/`

Si existen entidades equivalentes para templates o role mappings, extenderlas. No duplicar modelos.

## 5. Scope del PR

Este PR incluye:

- catalogo base de roles contables internos;
- persistencia minima de role map por organizacion;
- servicio server-side para listar, sugerir, guardar y borrar mappings;
- catalogo versionado de plantillas base;
- resolver de preview `template + facts + role map`;
- extension del classification runner para ser template-aware;
- soporte explicito del caso "pagado por socio / a reintegrar";
- UI de reviewer template-first;
- UI compacta en Settings para `Mapa contable Zeta`;
- persistencia auditable de la seleccion de plantilla y preview;
- tests de roles, templates, resolver, role map y smoke UI razonable.

## 6. No scope

- No exportar a `RESTBandejaEntradaAsientosV1Save`.
- No consultar `RESTBandejaEntradaAsientosV1Query`, `RESTBandejaEntradaAsientosV1Load` ni `RESTAsientoV1Lista`.
- No sincronizar Articulos.
- No sincronizar Contactos masivos.
- No sincronizar Bancos, Cajas ni Cuentas Bancarias.
- No implementar conciliacion.
- No implementar aprendizaje completo posterior al posting.
- No crear ni modificar comprobantes en Zeta.
- No crear un admin completo de plantillas.
- No permitir cuentas no imputables.
- No modificar cuentas locales `provider_managed = false`.
- No vender como automatico un documento con roles faltantes.

## 7. Catalogo base de roles contables

Crear `modules/accounting/account-roles.ts` o extender el modulo equivalente si ya existe.

Roles minimos:

```ts
export type AccountRoleCode =
  | 'purchase_expense_default'
  | 'purchase_inventory'
  | 'purchase_fixed_asset'
  | 'vat_purchase_basic'
  | 'vat_purchase_minimum'
  | 'vat_purchase_other'
  | 'accounts_payable'
  | 'partner_reimbursement_payable'
  | 'cash_uyu'
  | 'cash_usd'
  | 'bank_uyu'
  | 'bank_usd'
  | 'accounts_receivable'
  | 'sales_local'
  | 'sales_export'
  | 'vat_sales_basic'
  | 'vat_sales_minimum'
  | 'vat_sales_other'
  | 'withholding_payable'
  | 'fx_gain'
  | 'fx_loss'
```

Metadata por role:

```ts
interface AccountRoleDefinition {
  code: AccountRoleCode
  label: string
  description: string
  normalBalance: 'debit' | 'credit' | 'mixed'
  requiredForTemplates: string[]
  zetaSearchHints: string[]
  bridgeRequired: boolean
}
```

Hints obligatorios para roles principales:

- `partner_reimbursement_payable`: `socio`, `socios`, `reintegrar`, `reintegro`, `anticipo`, `cuenta a pagar socio`.
- `accounts_payable`: `proveedores`, `acreedores comerciales`.
- `accounts_receivable`: `clientes`, `deudores por ventas`.
- `vat_purchase_basic`: `iva compras`, `iva credito fiscal`, `iva credito fiscal`.
- `vat_sales_basic`: `iva ventas`, `iva debito fiscal`, `iva debito fiscal`.

Los hints solo sugieren mappings. Nunca confirman automaticamente.

## 8. Persistencia minima para role map

Revisar primero si ya existe una tabla equivalente. Si no existe, agregar:

```sql
create table if not exists organization_account_role_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  account_role_code text not null,
  chart_account_id uuid not null references chart_of_accounts(id),
  source text not null default 'manual',
  confidence numeric(5,4),
  notes text,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, account_role_code)
);

create index if not exists idx_org_account_role_mappings_org
  on organization_account_role_mappings (organization_id);

create index if not exists idx_org_account_role_mappings_account
  on organization_account_role_mappings (chart_account_id);
```

Reglas de integridad:

- `chart_account_id` debe apuntar a una cuenta de la misma organizacion.
- La cuenta debe tener `is_imputable = true`.
- Para organizaciones con Zeta conectado, priorizar cuentas `provider_managed = true` y `source_provider = 'zetasoftware'`.
- No modificar nunca `chart_of_accounts` desde este servicio.
- No tocar cuentas locales con `provider_managed = false`.

Persistencia requerida:

- migracion incremental `supabase/migrations/YYYYMMDD_account_role_mappings.sql`;
- actualizacion de `db/schema/05_accounting.sql`;
- RLS con membresia activa y roles suficientes, reutilizando patrones existentes de settings/accounting.

## 9. Servicio de role map

Crear `modules/accounting/account-role-map-service.ts`.

Funciones minimas:

```ts
async function listAccountRoleMappings(params: {
  organizationId: string
}): Promise<AccountRoleMappingView[]>

async function upsertAccountRoleMapping(params: {
  organizationId: string
  accountRoleCode: AccountRoleCode
  chartAccountId: string
  actorProfileId: string
  source?: 'manual' | 'suggested' | 'imported'
  notes?: string
}): Promise<AccountRoleMappingView>

async function deleteAccountRoleMapping(params: {
  organizationId: string
  accountRoleCode: AccountRoleCode
  actorProfileId: string
}): Promise<void>

async function suggestAccountRoleMappings(params: {
  organizationId: string
}): Promise<AccountRoleMappingSuggestion[]>
```

Validaciones:

- rechazar roles inexistentes;
- rechazar cuentas inexistentes;
- rechazar cuentas de otra organizacion;
- rechazar cuentas no imputables;
- si la cuenta es local y la organizacion tiene Zeta conectado, permitir solo con modo avanzado explicito o devolver warning `local_account_not_bridge_ready`;
- registrar `audit_log` para create, update y delete.

Las sugerencias deben buscar en `chart_of_accounts` por `external_code`, `name`, `provider_meta_json`, `is_imputable = true` y `source_provider = 'zetasoftware'`.

No guardar sugerencias automaticamente.

## 10. Catalogo de plantillas base

Crear `modules/accounting/posting-template-catalog.ts`.

Contrato:

```ts
interface PostingTemplateDefinition {
  code: string
  version: string
  label: string
  description: string
  operationKind:
    | 'purchase'
    | 'sale'
    | 'supplier_credit_note'
    | 'customer_credit_note'
    | 'adjustment'
  operationFamily:
    | 'purchase_expense'
    | 'purchase_inventory'
    | 'purchase_fixed_asset'
    | 'purchase_paid_by_partner'
    | 'sale_local'
    | 'sale_export'
    | 'credit_note'
    | 'fx_adjustment'
  paymentTerms: 'credit' | 'cash' | 'bank' | 'paid_by_partner' | 'unknown'
  direction: 'incoming' | 'outgoing' | 'adjustment'
  zetaJournalTypeNameHints: string[]
  lines: PostingTemplateLineDefinition[]
  requiredRoleCodes: AccountRoleCode[]
  createsOpenItem: boolean
  settlementAware: boolean
}

interface PostingTemplateLineDefinition {
  lineKey: string
  debitCredit: 'debit' | 'credit'
  accountRoleCode: AccountRoleCode | 'document_primary_account' | 'tax_role_by_rate'
  amountSource:
    | 'net_amount'
    | 'vat_amount'
    | 'gross_total'
    | 'net_amount_negative'
    | 'vat_amount_negative'
    | 'gross_total_negative'
  descriptionTemplate: string
  required: boolean
}
```

Templates minimos:

| Template | Lineas | Open item |
|---|---|---|
| `purchase_expense_credit.v1` | Debe cuenta principal, Debe IVA compras, Haber proveedores | si |
| `purchase_expense_paid_by_partner.v1` | Debe cuenta principal, Debe IVA compras, Haber cuenta a reintegrar a socio | si |
| `purchase_expense_cash_uyu.v1` | Debe cuenta principal, Debe IVA compras, Haber caja UYU | no |
| `purchase_expense_bank_uyu.v1` | Debe cuenta principal, Debe IVA compras, Haber banco UYU | no |
| `purchase_fixed_asset_credit.v1` | Debe activo fijo, Debe IVA compras, Haber proveedores | si |
| `purchase_inventory_credit.v1` | Debe mercaderias/stock, Debe IVA compras, Haber proveedores | si |
| `sale_local_credit.v1` | Debe clientes, Haber ventas plaza, Haber IVA ventas | si |
| `sale_local_cash_uyu.v1` | Debe caja UYU, Haber ventas plaza, Haber IVA ventas | no |
| `sale_local_bank_uyu.v1` | Debe banco UYU, Haber ventas plaza, Haber IVA ventas | no |
| `sale_export_credit.v1` | Debe clientes, Haber ventas exportacion | si |
| `supplier_credit_note.v1` | Debe proveedores, Haber cuenta principal, Haber IVA compras | segun caso |
| `customer_credit_note.v1` | Debe ventas plaza, Debe IVA ventas, Haber clientes | segun caso |

Notas:

- `purchase_expense_paid_by_partner.v1` es generico. No hardcodear Los Delfines ni ningun RUT.
- `sale_export_credit.v1` no inventa linea de IVA si el documento no trae IVA.
- Las notas de credito invierten la operacion original, pero el matching exhaustivo contra factura original queda fuera de este PR.

## 11. Resolver de plantilla y roles

Crear `modules/accounting/posting-template-resolver.ts`.

Funcion principal:

```ts
async function resolvePostingTemplatePreview(params: {
  organizationId: string
  documentId: string
  candidateTemplateCode: string
  facts: NormalizedDocumentAccountingFacts
  actorProfileId?: string
}): Promise<ResolvedPostingTemplatePreview>
```

Salida:

```ts
interface ResolvedPostingTemplatePreview {
  documentId: string
  postingTemplateCode: string
  postingTemplateVersion: string
  operationKind: string
  operationFamily: string
  paymentTerms: string
  zetaJournalTypeCode: string | null
  zetaJournalTypeName: string | null
  lines: ResolvedPostingTemplateLine[]
  roleResolutions: RoleResolution[]
  blockers: PostingTemplateBlocker[]
  warnings: PostingTemplateWarning[]
  createsOpenItem: boolean
  isBalanced: boolean
  mode: 'automatic' | 'assisted' | 'blocked'
}
```

Reglas:

- Resolver `document_primary_account` por: Concepto Zeta con `CodigoContable`, regla existente, role map `purchase_expense_default`, blocker `missing_primary_account`.
- Resolver `tax_role_by_rate` desde facts fiscales, no desde IA:
  - compras: `vat_purchase_basic`, `vat_purchase_minimum`, `vat_purchase_other`;
  - ventas: `vat_sales_basic`, `vat_sales_minimum`, `vat_sales_other`.
- Resolver cuentas solo contra `organization_account_role_mappings` o link de Conceptos Zeta ya materializado.
- Filtrar siempre cuentas no imputables.
- Balancear Debe/Haber con tolerancia existente o maxima `0.01`.
- Si falta un role requerido, devolver `blocked` o `assisted` segun posibilidad real de completar manualmente.
- No crear `journal_entries` salvo que el flujo existente de posting provisional ya lo haga. Este PR se concentra en preview y asignacion.

## 12. Integracion con classification runner

Extender `modules/accounting/classification-runner.ts` sin romper la precedencia existente:

1. `manual_override`
2. `document_override`
3. `vendor_concept_operation_category`
4. `vendor_concept`
5. `concept_global`
6. `vendor_default`
7. `assistant`
8. `manual_review`

El resultado puede incluir:

```ts
{
  postingTemplateCode,
  operationFamily,
  accountRoleResolutions,
  preview,
  winningRuleSource
}
```

Reglas nuevas:

- Concepto Zeta con `CodigoContable` sugiere deterministamente `document_primary_account`.
- Regla de proveedor o proveedor + concepto puede elegir template.
- Si la regla indica `settlementMethod = paid_by_partner`, seleccionar `purchase_expense_paid_by_partner.v1`.
- El asistente solo sugiere dentro de templates validos.
- Si falta role critico, degradar a `manual_review`, `assisted` o `blocked`.

## 13. UI de reviewer

Modificar el paso de asignacion contable para que muestre primero plantillas, no cuentas sueltas.

Componentes a revisar o extender:

- `components/mobile/accounting-template-card.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/document-review-workspace.tsx`
- `components/documents/document-review-staged-workspace.tsx`

Comportamiento:

- mostrar sugerencia principal con template, motivo y fuente;
- ofrecer `Cambiar plantilla`;
- al elegir plantilla, ejecutar resolver y mostrar preview multi-linea;
- mostrar cuenta Zeta como `external_code - name` con badge `Zeta`;
- mostrar IVA separado y contrapartida;
- si falta mapping, mostrar CTA `Mapear cuenta`;
- abrir selector filtrado a `is_imputable = true`;
- mantener cuenta suelta solo como modo avanzado.

Copy recomendado:

- `Elegir plantilla contable`
- `Compra gasto operativo credito`
- `Compra pagada con dinero personal / a reintegrar`
- `Cuenta pendiente de mapear`
- `Guardar y recalcular sugerencia`
- `Confirmar asignacion`

No usar `Postear` si el documento todavia solo esta en assignment o preview.

## 14. UI de Settings

Agregar una seccion compacta:

```text
Mapa contable Zeta
```

Puede vivir en `components/settings/integrations/zetasoftware-sync-panel.tsx` o en la superficie de Settings mas adecuada.

Mostrar:

- cantidad de roles requeridos;
- cantidad de roles mapeados;
- estado completo o incompleto;
- ultima sync del plan de cuentas;
- lista compacta de roles principales.

Roles visibles inicialmente:

- Proveedores;
- Clientes / Deudores por ventas;
- Ventas plaza;
- Ventas exportacion;
- IVA compras basica;
- IVA ventas basica;
- Caja pesos;
- Banco pesos;
- Cuenta a reintegrar a socio;
- Gasto operativo default;
- Activo fijo;
- Mercaderias / stock.

Cada fila:

```text
Rol contable | Cuenta Zeta asignada | Estado | Accion
```

Selector:

- buscar por codigo y nombre;
- filtrar imputables;
- mostrar `external_code - name`;
- badge `Zeta`;
- ocultar no imputables;
- sugerir cuentas probables con `zetaSearchHints`.

No crear un configurador gigante. Mantenerlo plegable y mobile-first.

## 15. Persistir seleccion de plantilla

Revisar antes:

- `document_accounting_contexts`
- `document_assignment_runs`
- `posting_proposals`

Si ya existe lugar para `posting_template_code`, reutilizarlo. Si no existe, agregar columnas minimas al lugar correcto, no a varias tablas:

```sql
posting_template_code text,
posting_template_version text,
operation_family text,
settlement_method text,
account_role_resolution_json jsonb,
template_preview_json jsonb
```

La seleccion de template debe quedar auditable y reproducible.

## 16. Tests requeridos

### `tests/account-roles.test.cjs`

- codigos de role unicos;
- roles requeridos por templates existen;
- `zetaSearchHints` no vacio para roles principales;
- ningun template refiere un role inexistente.

### `tests/posting-template-catalog.test.cjs`

- codigos de template unicos;
- cada template tiene version;
- cada template tiene al menos dos lineas;
- cada template declara roles requeridos;
- compra credito tiene Debe gasto, Debe IVA, Haber proveedores;
- venta credito tiene Debe clientes, Haber ventas, Haber IVA;
- compra pagada por socio usa `partner_reimbursement_payable` y no usa `accounts_payable`, `cash_uyu` ni `bank_uyu`.

### `tests/posting-template-resolver.test.cjs`

- compra gasto credito con mappings completos produce preview balanceado;
- compra pagada por socio produce Haber contra `partner_reimbursement_payable`;
- faltante de role critico produce blocker;
- cuenta no imputable no puede resolver role;
- Concepto Zeta con `CodigoContable` gana como `document_primary_account`;
- IVA basico compra usa `vat_purchase_basic`;
- IVA basico venta usa `vat_sales_basic`.

### `tests/account-role-map-service.test.cjs`

- no permite mapear role a cuenta no imputable;
- no permite cuenta de otra organizacion;
- upsert idempotente;
- update registra audit log;
- sugerencias no se guardan automaticamente;
- cuenta local en organizacion Zeta produce warning o requiere modo avanzado.

### UI smoke

- reviewer muestra plantilla sugerida;
- preview muestra lineas Debe/Haber;
- cuenta muestra formato `external_code - name`;
- roles faltantes muestran CTA de mapping;
- Settings muestra progreso del role map.

## 17. Validacion

Ejecutar:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:verify:parity
```

Si hay tests especificos de DB/RLS, correrlos tambien.

## 18. Resultado esperado

Para un CFE importado:

```text
Plantilla sugerida:
Compra gasto operativo credito

Preview:
Debe  5xxxx - Gasto X
Debe  1xxxx - IVA compras
Haber 2xxxx - Proveedores

Fuente:
Concepto Zeta + role map Zeta
```

Para compra pagada con dinero personal:

```text
Plantilla:
Compra pagada con dinero personal / a reintegrar

Preview:
Debe  gasto
Debe  IVA compras
Haber cuenta a reintegrar a socio

Importante:
No usa Banco ni Caja de la empresa.
```

## 19. Roadmap posterior

Despues de este PR, el orden recomendado es:

1. Tasas de IVA Zeta deterministicas, si todavia no quedaron materializadas.
2. Rule runner Zeta-aware.
3. Preview multi-linea consolidado.
4. Export a Bandeja de Entrada de Asientos.
5. Reconciliacion de exportaciones contra Zeta.
6. Aprendizaje contable reusable.

## 20. Prompts individuales del roadmap

El roadmap completo queda separado en diez piezas implementables:

1. Inventario Zeta y estado de sincronizacion: mostrar en Settings ultima sync, counts, conflictos y errores por stream.
2. Plan de Cuentas Zeta como espejo: materializar `RESTPlanCuentasV2Query` en `chart_of_accounts` con idempotencia y conflictos.
3. Tasas de IVA Zeta deterministicas: materializar tasas, cuentas fiscales y literales tributarios sin IA.
4. Role Map contable: conectar roles internos con cuentas imputables por organizacion.
5. Plantillas base por familia operativa: catalogo versionado de templates con roles.
6. Rule Runner Zeta-aware: usar Conceptos, role map, templates y reglas sin romper precedencia.
7. Preview contable multi-linea: consolidar Debe/Haber, IVA, contrapartida, warnings y blockers.
8. Export bridge a Bandeja: mapper y envio manual a `RESTBandejaEntradaAsientosV1Save`.
9. Reconciliacion Zeta: comparar exportaciones contra Bandeja y asientos definitivos.
10. Aprendizaje contable reusable: convertir decisiones humanas en reglas versionadas con simulacion.

El PR recomendado actual combina las piezas 4 y 5 porque juntas dan valor operativo inmediato: el role map sin plantillas no clasifica, y las plantillas sin role map no resuelven cuentas reales.
