# specs-driven-zeta-contabilidad-development

**Estado:** draft v0.1  
**Última actualización:** 2026-03-18  
**Propósito:** construir en Convertilabs un espejo contable **read-only** de ZetaSoftware para entrenar, validar y endurecer un motor contable determinístico y una capa de IA explicable, **sin convertir a Convertilabs en un submódulo de Zeta**.

---

## 1) Decisión estratégica

### 1.1 Tesis
Convertilabs debe ser un **núcleo contable canónico** y generalista.  
ZetaSoftware es, en esta fase, una **fuente externa de verdad operativa/fiscal** y un **proveedor de datos**.

### 1.2 Regla de oro
**El dominio vive en Convertilabs. El adapter de Zeta vive en el borde.**

Eso significa:

- No hardcodear Zeta en el corazón del modelo.
- No usar nombres de tablas/campos de Zeta como si fueran verdades universales.
- No asumir que todo ERP maneja exactamente `Local`, `Caja`, `Referencia`, `Literal Tributario` o `TipoAsiento` como Zeta.
- Sí usar Zeta como base para:
  - aprender la operativa real,
  - espejar información auditable,
  - derivar reglas determinísticas,
  - generar datasets de entrenamiento,
  - reconciliar resultados.

### 1.3 Alcance de esta spec
Esta spec cubre la **integración read-only** con APIs de Zeta para traer y espejar:

- plan de cuentas,
- ejercicios,
- tipos de asientos,
- auxiliares,
- asientos y líneas,
- centros de costo,
- referencias,
- tasas de IVA,
- monedas y cotizaciones,
- RUT/terceros,
- bandeja de validación,
- y subledgers mínimos necesarios para contexto.

### 1.4 Fuera de alcance por ahora
- Crear o modificar registros en Zeta.
- Publicar asientos o comprobantes.
- Automatizar cierre dentro de Zeta.
- Reemplazar Zeta.
- Automatizaciones “mágicas” sin trazabilidad.

---

## 2) Hechos confirmados de Zeta que afectan el diseño

### 2.1 Transporte/API
- Zeta documenta SOAP y REST, pero **prioriza REST** y aclara que SOAP está en uso limitado y en proceso de descontinuación progresiva.
- Todas las nuevas integraciones deberían implementarse sobre REST, aunque todavía existan descripciones WSDL para muchos recursos.
- La documentación además muestra ejemplos REST con payload JSON y endpoints bajo `api.zetasoftware.com/rest/APIs/...`.

### 2.2 Autenticación
- La autenticación usa credenciales del desarrollador/integrador (`DesarrolladorCodigo`, `DesarrolladorClave`) y credenciales por empresa (`EmpresaCodigo`, `EmpresaClave`).
- `UsuarioCodigo` y `UsuarioClave` no se usan.
- `RolCodigo` debe existir y estar activo en la empresa; Zeta recomienda usar el rol `1`.

### 2.3 Contabilidad y asientos
- El asiento es el registro fundamental y debe mantener equilibrio Debe = Haber.
- Un asiento en Zeta tiene fecha, número dentro del ejercicio, tipo, concepto y líneas.
- Al guardar, Zeta valida: balance, cuenta válida e imputable, fecha dentro del ejercicio activo y centro de costos cuando corresponda.
- Los asientos automáticos e importados pasan primero por una **Bandeja de Entrada** para revisión antes de incorporarse definitivamente.

### 2.4 Modelo de consulta disponible
- La API de **Consulta de Asientos** expone asientos ya generados y devuelve campos de línea como `Cuenta`, `Debe`, `Haber`, `Centro`, `Referencia`, `Contacto`, `RUT`, `Tributo`, etc.
- La API de **Balance Contable** **no genera** balances; solo expone un balance ya generado previamente por un usuario dentro de Zeta.
- La API de **Plan de Cuentas** permite consultar código, nombre, imputabilidad, grupo, capítulo y cuenta padre.
- La API de **Tipos de Asientos** expone también vínculo con **Auxiliares**, columna de IVA, DGI 2/181, importes negativos y resumido de diarios.
- La API de **Tasas de IVA** devuelve tasa, tipo, abreviación, cuentas contables de compras/ventas y literales tributarios de compras/ventas.
- La API de **Bandeja Entrada de Asientos** expone `Fecha`, `TipoAsiento`, `Concepto`, `Moneda`, `TipoCambio`, `RUT`, `Contacto`, `Cuenta`, `Importe`, `DebeHaber`, `CentroCostos`, `Referencia`, `Local`, `LiteralTributario`, `Origen`, `Validado`, `Error`.
- Zeta documenta APIs separadas para `Locales Comerciales`, `Cajas`, `Centros de Costo`, `Referencias`, `Monedas`, `Cotización de Monedas`, `Números de RUT`, `Contactos`, `Datos Comerciales Cliente`, `Formas de Pago`, `Condiciones de Pago`, `Bancos y Financieras`, `Cuentas Bancarias`, `Comprobantes`, `Cuotas Pendientes`, etc.

### 2.5 Lectura correcta
De acá sale una conclusión clave:

> **No conviene modelar Convertilabs a la forma de la UI de Zeta. Conviene modelarlo a la integridad contable detrás de Zeta y encapsular la traducción en un provider adapter.**

---

## 3) Principios no negociables

### P-01. Núcleo contable independiente
Convertilabs debe poder soportar Zeta hoy y otros ERPs mañana.

### P-02. Read-only real
La integración inicial no debe ejecutar altas, bajas ni modificaciones sobre Zeta.

### P-03. Trazabilidad completa
Todo dato espejado debe poder rastrearse hasta:
- endpoint,
- página,
- payload,
- timestamp de extracción,
- hash del contenido,
- mapping aplicado,
- versión del código que lo normalizó.

### P-04. Idempotencia
Repetir una sincronización nunca debe duplicar entidades ni líneas.

### P-05. Contabilidad antes que IA
La IA propone; el motor determinístico y las reglas de integridad mandan.

### P-06. Provider metadata aislado
Lo específico de Uruguay o de Zeta debe ir a `provider_meta` o `jurisdiction_meta`, no al núcleo.

### P-07. Reconstrucción verificable
Debe ser posible reconstruir:
- libro diario,
- mayor,
- trial balance / balance de comprobación,
- open items,
- conciliaciones básicas,
a partir del espejo canónico.

### P-08. Cierre de ejercicio respetado
Los ejercicios son parte del dominio. No son un filtro decorativo.

---

## 4) Objetivo funcional del espejo

### 4.1 Qué queremos lograr
Traer información desde Zeta y guardarla en Convertilabs de forma que:

1. exista un **espejo canónico**,
2. podamos **reconstruir la lógica contable** usada por la empresa,
3. podamos **entrenar y medir** clasificadores y reglas,
4. podamos hacer **reconciliación** entre:
   - documentos entrantes,
   - propuestas de asiento,
   - asiento histórico en Zeta,
   - balance y saldos,
5. podamos evolucionar a:
   - asistente contable,
   - pre-cierre automático,
   - auditor continuo,
   - copiloto de clasificación y revisión.

### 4.2 Qué NO queremos
Un sistema que “se parezca a Zeta” pero que no cierre contablemente.

---

## 5) Arquitectura objetivo

```text
                   +-----------------------+
                   |   Zeta REST / SOAP    |
                   +-----------+-----------+
                               |
                               v
                    +----------------------+
                    | zeta-provider-reader  |
                    |  (solo lectura)       |
                    +-----------+-----------+
                                |
                                v
                    +----------------------+
                    | raw landing zone      |
                    | request/page/record   |
                    +-----------+-----------+
                                |
                                v
                    +----------------------+
                    | canonical normalizer  |
                    | zeta -> domain        |
                    +-----------+-----------+
                                |
          +---------------------+----------------------+
          |                                            |
          v                                            v
+--------------------------+               +--------------------------+
| canonical accounting DB  |               | reconciliation / QA      |
| periods/accounts/journal |               | balances / mismatchs     |
+------------+-------------+               +------------+-------------+
             |                                              |
             v                                              v
+--------------------------+               +--------------------------+
| deterministic engine     |               | AI assistant / auditor   |
| rules + templates        |               | explainable suggestions  |
+--------------------------+               +--------------------------+
```

### 5.1 Capa de provider
Responsable de:
- autenticarse,
- invocar endpoints,
- paginar,
- serializar raw payloads,
- manejar rate limit / retries,
- exponer DTOs del proveedor.

### 5.2 Capa canónica
Responsable de:
- normalizar,
- deduplicar,
- versionar,
- guardar entidades independientes del ERP.

### 5.3 Capa de reconciliación
Responsable de:
- comparar trial balance calculado vs Zeta,
- detectar huecos,
- alertar conflictos de mapping,
- medir calidad del espejo.

### 5.4 Capa de IA
Responsable de:
- leer documentos,
- leer espejo contable,
- proponer clasificación,
- explicar la propuesta,
- nunca tocar el proveedor.

---

## 6) Modelo canónico: contabilidad general primero

### 6.1 Entidades universales

#### Organization
Entidad contable/jurídica.

#### FiscalPeriod
Período contable. No asumir año calendario.

#### Currency
Moneda.

#### ExchangeRate
Cotización por fecha y tipo.

#### Account
Cuenta contable.

#### AccountGroup
Clasificación transversal para análisis.

#### JournalBook / Auxiliary
Libro auxiliar o agrupador lógico.

#### JournalType
Tipo de asiento o categoría de posting.

#### Party
Tercero: cliente, proveedor, banco, empleado, organismo, etc.

#### TaxCode
Regla o tasa impositiva.

#### JournalEntry
Cabecera del asiento.

#### JournalLine
Línea del asiento.

#### OpenItem
Partida abierta / cuota / saldo pendiente.

#### ValidationTrayItem
Elemento pendiente de validación o staging.

#### DimensionDefinition / DimensionValue
Dimensiones organizacionales o analíticas:
- sucursal / local,
- caja,
- centro de costo,
- referencia,
- proyecto,
- unidad de negocio,
- cualquier otra.

#### SourceDocument
Documento fuente leído por IA.

#### PostingSuggestion
Propuesta de clasificación y asiento.

---

## 7) Diseño del núcleo para no quedar rehén de Zeta

### 7.1 Campos específicos vs dimensiones
No modelar `Local`, `Caja`, `Referencia` como verdades globales obligatorias.

Diseño recomendado:

- `dimension_definition`
- `dimension_value`
- `journal_entry_dimension`
- `journal_line_dimension`

Con `kind` como:
- `branch`
- `cashbox`
- `cost_center`
- `reference`
- `warehouse`
- `project`
- `tax_reporting`
- `custom`

Esto permite que:
- Zeta `Local` → `branch`
- Zeta `Caja` → `cashbox`
- Zeta `Centro de Costo` → `cost_center`
- Zeta `Referencia` → `reference`

y mañana otro ERP pueda traer otras dimensiones sin romper el core.

### 7.2 Campo provider_meta
Todo lo muy específico del proveedor va en `provider_meta`.

Ejemplos:
- `LiteralTributario`
- `DGI2181`
- `ColumnaIVA`
- `ResumirDiarios`
- códigos internos raros
- flags propios del ERP

### 7.3 Campo jurisdiction_meta
Todo lo específico del país/regulación va en `jurisdiction_meta`.

Ejemplos:
- `UY.literalTributario`
- `UY.formulario2181`
- `UY.cfeTipo`
- códigos fiscales locales

---

## 8) Invariantes canónicos

### 8.1 Invariantes del journal
1. `sum(debit) == sum(credit)`
2. ninguna línea puede tener Debe y Haber positivos a la vez
3. toda línea debe tener cuenta postable
4. toda línea debe pertenecer a un entry
5. toda entrada debe pertenecer a un período
6. la fecha del asiento debe caer dentro del período
7. la moneda del entry debe existir
8. si hay moneda extranjera, la cotización debe existir o quedar explícitamente nula por diseño
9. toda entrada espejada debe tener lineage al origen
10. todo recalculo debe ser reproducible

### 8.2 Invariantes del espejo
1. un mismo registro fuente no puede crear dos entidades canónicas equivalentes
2. una resincronización con superposición temporal no puede duplicar líneas
3. un cambio en el proveedor debe generar nueva versión o actualización controlada
4. un registro borrado/no visible no debe desaparecer silenciosamente del histórico canónico

---

## 9) Entidades y contratos TypeScript

```ts
export type ProviderKey = "zeta";

export interface ExternalRef {
  provider: ProviderKey;
  entity: string;
  externalId: string;
  externalCode?: string;
  sourceHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface Organization {
  id: string;
  code: string;
  legalName: string;
  taxId?: string;
  countryCode: string;
  baseCurrencyCode: string;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}

export interface FiscalPeriod {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "open" | "closed" | "archived";
  isCurrent: boolean;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}

export interface AccountGroup {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  externalRefs: ExternalRef[];
}

export type AccountKind =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "memo"
  | "unknown";

export interface Account {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  kind: AccountKind;
  chapterCode?: string;
  parentCode?: string;
  groupCode?: string;
  isPostable: boolean;
  currencyCode?: string;
  naturalBalance?: "debit" | "credit";
  reportingCode?: string;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
  jurisdictionMeta?: Record<string, unknown>;
}

export interface AuxiliaryBook {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  externalRefs: ExternalRef[];
}

export interface JournalType {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  conceptTemplate?: string;
  auxiliaryCode?: string;
  taxColumn?: "debit" | "credit" | "none";
  includeInTaxAnnex?: boolean;
  negativeInAuxiliary?: boolean;
  summarizeInJournal?: boolean;
  reservedSystemCode?: "A" | "X" | "Y" | "Z" | null;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
  jurisdictionMeta?: Record<string, unknown>;
}

export interface Currency {
  code: string;
  isoCode?: string;
  name: string;
  symbol?: string;
  rounding?: number;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}

export interface ExchangeRate {
  id: string;
  organizationId: string;
  currencyCode: string;
  date: string;
  commercialRate?: number;
  fiscalRate?: number;
  source: "provider" | "manual";
  externalRefs: ExternalRef[];
}

export interface DimensionDefinition {
  id: string;
  organizationId: string;
  kind:
    | "branch"
    | "cashbox"
    | "cost_center"
    | "reference"
    | "warehouse"
    | "project"
    | "tax_reporting"
    | "custom";
  code: string;
  name: string;
  active: boolean;
  externalRefs: ExternalRef[];
}

export interface Party {
  id: string;
  organizationId: string;
  code: string;
  legalName: string;
  taxId?: string;
  roles: Array<"customer" | "supplier" | "bank" | "other">;
  accountingCode?: string;
  taxExempt?: boolean;
  active: boolean;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}

export interface TaxCode {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  rate: number;
  taxType?: string;
  purchaseAccountCode?: string;
  salesAccountCode?: string;
  externalRefs: ExternalRef[];
  jurisdictionMeta?: Record<string, unknown>;
}

export interface JournalEntry {
  id: string;
  organizationId: string;
  fiscalPeriodCode: string;
  entryNumber: string;
  entryDate: string;
  entryTypeCode?: string;
  concept?: string;
  currencyCode?: string;
  exchangeRate?: number;
  sourceProvider: ProviderKey;
  sourceStatus: "posted" | "pending_validation" | "unknown";
  origin?: string;
  postedAt?: string;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  sequence: number;
  accountCode: string;
  debit: number;
  credit: number;
  partyCode?: string;
  taxCode?: string;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}

export interface JournalLineDimension {
  journalLineId: string;
  dimensionCode: string;
}

export interface OpenItem {
  id: string;
  organizationId: string;
  partyCode: string;
  side: "receivable" | "payable";
  dueDate: string;
  currencyCode?: string;
  originalAmount: number;
  openAmount: number;
  sourceDocumentCode?: string;
  sourceProvider: ProviderKey;
  externalRefs: ExternalRef[];
}

export interface ValidationTrayItem {
  id: string;
  organizationId: string;
  sourceProvider: ProviderKey;
  entryDate: string;
  entryTypeCode?: string;
  concept?: string;
  currencyCode?: string;
  exchangeRate?: number;
  isValidated?: boolean;
  validationError?: string;
  origin?: string;
  externalRefs: ExternalRef[];
  providerMeta?: Record<string, unknown>;
}
```

---

## 10) Registry de endpoints Zeta para el espejo

> **Implementar primero con interfaz provider-agnostic.**  
> El adapter Zeta resuelve payloads y detalles REST/SOAP internamente.

### 10.1 Prioridad P0 — Conectividad y contexto
1. Roles de Usuarios
2. Locales Comerciales
3. Cajas

**Motivo:** sin eso no entendés el contexto organizacional ni el `RolCodigo`.

### 10.2 Prioridad P1 — Backbone contable
4. Ejercicios Contables  
5. Monedas  
6. Cotización de Monedas  
7. Plan de Cuentas  
8. Grupos de Cuentas  
9. Auxiliares  
10. Tipos de Asientos  
11. Centros de Costo  
12. Referencias  
13. Tasas de IVA  
14. Números de RUT

### 10.3 Prioridad P2 — Terceros y catálogos comerciales
15. Contactos  
16. Datos Comerciales Cliente  
17. Datos Comerciales Proveedor  
18. Condiciones de Pago  
19. Formas de Pago  
20. Bancos y Financieras  
21. Cuentas Bancarias  
22. Comprobantes

### 10.4 Prioridad P3 — Transaccional contable
23. Consulta de Asientos  
24. Bandeja Entrada de Asientos  
25. Cuotas Pendientes

### 10.5 Prioridad P4 — Contexto operacional para explicar contabilidad
26. Facturas de Clientes (solo lectura/consulta cuando aplique)  
27. Facturas de Proveedores (solo lectura/consulta cuando aplique)  
28. Movimientos Bancarios  
29. Movimientos de Caja  
30. Comprobantes por Cliente  
31. Movimientos de Artículos  
32. Stock Actual (solo si ayuda a explicar costo/mercadería)

### 10.6 Prioridad P5 — Verificación
33. Balance Contable

**Importante:** el Balance Contable sirve como **oráculo de contraste**, no como fuente primaria del ledger.

---

## 11) Mapping Zeta -> Canonical

| Entidad canónica | Zeta | Comentario de diseño |
|---|---|---|
| `FiscalPeriod` | Ejercicios Contables | Mantener abierto/cerrado y rango de fechas. No asumir año calendario. |
| `Account` | Plan de Cuentas | Guardar capítulo, imputabilidad, cuenta padre, grupo, moneda, meta fiscal. |
| `AccountGroup` | Grupos de Cuentas | Clasificación transversal; útil para IVA, análisis y reporting. |
| `AuxiliaryBook` | Auxiliares | No es cuenta. Es agrupador de tipos/libros. |
| `JournalType` | Tipos de Asientos | Mantener flags de IVA, anexo, negativo, resumen diario, reservados A/X/Y/Z. |
| `Currency` | Monedas | Guardar ISO, símbolo, redondeo, cuentas de diferencias si las hubiera. |
| `ExchangeRate` | Cotización de Monedas | Guardar cotización comercial y fiscal. |
| `DimensionDefinition(kind=branch)` | Locales Comerciales | No hardcodear como campo obligatorio del core. |
| `DimensionDefinition(kind=cashbox)` | Cajas | Igual criterio. |
| `DimensionDefinition(kind=cost_center)` | Centros de Costo | Puede aplicarse a líneas. |
| `DimensionDefinition(kind=reference)` | Referencias | Etiqueta analítica; puede aplicarse a líneas o asientos. |
| `TaxCode` | Tasas de IVA | Incluir cuentas compras/ventas y meta fiscal. |
| `Party` | Contactos + Datos Comerciales Cliente/Proveedor + Números de RUT | Unificar tercero + rol + código contable + exención + tax id. |
| `JournalEntry` + `JournalLine` | Consulta de Asientos | Reconstrucción desde resultado plano por línea. |
| `ValidationTrayItem` | Bandeja Entrada de Asientos | Mantener separado del journal posted. No mezclar automáticamente. |
| `OpenItem` | Cuotas Pendientes | Subledger de cuentas a cobrar/pagar. |
| `ReportSnapshot` | Balance Contable | Snapshot de control; no verdad contable primaria. |

---

## 12) Dificultades específicas de Zeta que hay que resolver bien

### 12.1 Consulta de Asientos es plana
La API documentada muestra resultados por línea:
- `Numero`
- `Fecha`
- `Cuenta`
- `Debe`
- `Haber`
- `Tipo`
- `Centro`
- `Referencia`
- `Contacto`
- `RUT`
- `Tributo`
- etc.

**Problema:** no aparece documentado un `LineNumber` explícito.

**Solución de diseño:**
- agrupar por `organization + ejercicio + numero + fecha + tipo + concepto + moneda + cotizacion`,
- conservar `raw_page_number` y `raw_row_ordinal`,
- generar `line.sequence` a partir del orden de llegada dentro del grupo,
- guardar `sourceHash` por fila,
- permitir rearmado estable aunque Zeta no entregue identificador de línea.

### 12.2 Balance API no genera balance
No sirve como fuente primaria del ledger.

**Regla:**
- truth for journal = `Consulta de Asientos`
- truth for staging = `Bandeja Entrada`
- truth for verification = `Balance Contable`

### 12.3 SOAP vs REST
La ayuda oficial dice que REST es el estándar actual y que SOAP queda para compatibilidad.

**Diseño recomendado:**
- interfaz única `LedgerProviderReader`
- `ZetaRestTransport` como implementación principal
- `ZetaSoapFallbackTransport` opcional, solo si falta cobertura o el Postman/REST no resuelve algo puntual

### 12.4 Bandeja de Entrada no es libro mayor
No asumir que `Validado = S` implica ya incorporado al journal final si no existe vínculo inequívoco.

**Diseño:**
- persistir `ValidationTrayItem` como entidad aparte
- buscar match posterior contra `JournalEntry` por heurística controlada
- si no hay match seguro, dejar “pendiente de conciliación de staging”

---

## 13) Estrategia de sincronización

### 13.1 Full snapshot inicial
#### Catálogos
- ejercicios,
- plan,
- grupos,
- auxiliares,
- tipos,
- centros,
- referencias,
- monedas,
- cotizaciones,
- tasas,
- RUT,
- terceros,
- locales,
- cajas,
- bancos,
- cuentas bancarias,
- comprobantes,
- condiciones y formas de pago.

#### Transaccional
- asientos por ejercicio, página por página
- bandeja de entrada por rango de fechas
- cuotas pendientes por ventanas de vencimiento

### 13.2 Incremental después del bootstrap
Como varios endpoints documentan paginación por `Page` y no necesariamente un `updated_at`, el incremental debe ser **ventaneado + idempotente**.

#### Recomendación
- `Consulta de Asientos`: resincronización diaria con superposición de 14 días
- `Bandeja Entrada`: cada 15/30 min con ventana superpuesta de 7 días
- catálogos: full snapshot nocturno
- cotizaciones: diario
- open items/cuotas: varias veces por día
- balance: on demand / nightly si existe balance generado

### 13.3 Idempotencia
Cada record raw debe persistirse con:
- `provider`
- `operation`
- `page`
- `row_ordinal`
- `natural_key`
- `source_hash`

### 13.4 Borrados
Nunca borrar físicamente de canónico por desaparición del proveedor.

Usar:
- `first_seen_at`
- `last_seen_at`
- `deleted_in_source_at?`
- `visibility_status`

---

## 14) Landing zone y tablas mínimas

### 14.1 Tablas raw
- `provider_connection`
- `provider_sync_job`
- `provider_sync_run`
- `provider_raw_request`
- `provider_raw_page`
- `provider_raw_record`

### 14.2 Tablas de enlace
- `external_entity_link`
- `canonical_revision`
- `reconciliation_issue`

### 14.3 Tablas canónicas
- `organization`
- `fiscal_period`
- `currency`
- `exchange_rate`
- `account_group`
- `account`
- `auxiliary_book`
- `journal_type`
- `dimension_definition`
- `party`
- `tax_code`
- `journal_entry`
- `journal_line`
- `journal_line_dimension`
- `validation_tray_item`
- `validation_tray_line`
- `open_item`

### 14.4 Regla de auditoría
Todo canónico debe poder responder:
- de qué endpoint vino,
- cuándo se leyó,
- qué hash tenía el payload,
- qué transformación se aplicó,
- qué versión del normalizador lo produjo.

---

## 15) Interfaz del provider

```ts
export interface PageResult<T> {
  items: T[];
  page: number;
  isLastPage?: boolean;
}

export interface ReaderContext {
  organizationCode: string;
  credentialsRef: string; // referencia al vault, no la credencial en claro
}

export interface LedgerProviderReader {
  provider: "zeta";
  ping(ctx: ReaderContext): Promise<void>;

  listPeriods(ctx: ReaderContext, page: number): Promise<PageResult<unknown>>;
  listAccounts(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listAccountGroups(ctx: ReaderContext, page: number): Promise<PageResult<unknown>>;
  listAuxiliaryBooks(ctx: ReaderContext, page: number): Promise<PageResult<unknown>>;
  listJournalTypes(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listCurrencies(ctx: ReaderContext, page: number): Promise<PageResult<unknown>>;
  listExchangeRates(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listDimensions(ctx: ReaderContext, kind: string, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listParties(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listPartyCommercialProfiles(ctx: ReaderContext, side: "customer" | "supplier", filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listTaxCodes(ctx: ReaderContext, page: number): Promise<PageResult<unknown>>;
  listJournalRows(ctx: ReaderContext, filters: { periodCode: string; from?: string; to?: string; typeCode?: string; }, page?: number): Promise<PageResult<unknown>>;
  listValidationTrayRows(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listOpenItems(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
  listBalanceSnapshot(ctx: ReaderContext, filters: Record<string, unknown>, page: number): Promise<PageResult<unknown>>;
}
```

### 15.1 Regla
El provider devuelve DTOs crudos o semi-crudos.  
La conversión al modelo canónico se hace en un normalizador aparte.

---

## 16) Normalización Zeta -> Canonical

### 16.1 Plan de Cuentas
#### Inputs Zeta
- `Codigo`
- `Nombre`
- `EsImputable`
- `CodigoPresentacion`
- `Capitulo`
- `CuentaPadre`
- `GrupoCodigo`
- `MonedaCodigo`
- etc.

#### Salida canónica
- `account.code`
- `account.name`
- `account.isPostable`
- `account.chapterCode`
- `account.parentCode`
- `account.groupCode`
- `account.currencyCode`
- `account.providerMeta`

#### Regla importante
No deducir `naturalBalance` ciegamente desde Zeta si la documentación no lo expone de forma explícita.  
Si se puede inferir desde capítulo, marcar como inferido y dejar trazabilidad.

### 16.2 Ejercicios
Mapear a `FiscalPeriod`.

Campos mínimos:
- `code`
- `name`
- `startsOn`
- `endsOn`
- `status`
- `isCurrent`

### 16.3 Tipos de Asiento
Mapear a `JournalType`.

No convertir `TipoAsiento` en enum fija global del sistema.  
Es configuración de cada empresa.

### 16.4 Auxiliares
Mapear a `AuxiliaryBook`.

### 16.5 Asientos y líneas
#### Reconstrucción
- agrupar líneas planas en entries
- asignar `sequence`
- crear entry con status `posted`

#### Dimensiones
- `Centro` -> `cost_center`
- `Referencia` -> `reference`
- `Local` -> `branch`
- `Tributo` -> `tax_reporting` o `jurisdiction_meta`

### 16.6 Bandeja
Mapear a `ValidationTrayItem` + líneas.

Status sugerido:
- `Validado = N` -> `pending_validation`
- `Validado = S` -> `validated_pending_import_or_reconcile`
- con `Error` -> `validation_error`

### 16.7 Tasas de IVA
Mapear a `TaxCode`.

No hardcodear “IVA” como único impuesto universal.  
El core debe hablar de `TaxCode` / `TaxRule`.

### 16.8 Terceros
Unificar:
- Contactos
- Datos Comerciales Cliente
- Datos Comerciales Proveedor
- Números de RUT

en una sola entidad `Party`, con roles múltiples.

---

## 17) Reconciliación

### 17.1 Reconciliaciones obligatorias
1. **Journal vs itself**
   - Debe/Haber por entry
   - Debe/Haber total por período
2. **Journal vs Balance**
   - trial balance calculado por Convertilabs
   - contraste con snapshot traído desde Balance Contable
3. **Journal vs Open Items**
   - cuentas a cobrar/pagar vs cuotas pendientes
4. **Tax**
   - cuentas y tasas IVA vs líneas con tributo/literal
5. **Dimensions**
   - centros/referencias/locales válidos y existentes

### 17.2 Tipos de issues
- `MISSING_MASTER`
- `UNBALANCED_ENTRY`
- `ENTRY_RECONSTRUCTION_CONFLICT`
- `UNKNOWN_ACCOUNT`
- `UNKNOWN_PARTY`
- `UNKNOWN_TAX_CODE`
- `MISSING_DIMENSION`
- `BALANCE_MISMATCH`
- `OPEN_ITEM_MISMATCH`
- `RAW_DUPLICATE`
- `PROVIDER_SHAPE_CHANGE`

### 17.3 Política
Ningún issue se tapa.  
Se clasifica, se explica y se deja evidencia.

---

## 18) Cómo usar el espejo para el motor determinístico

### 18.1 Dataset de entrenamiento
Cada documento procesado por IA debe poder asociarse a:
- tercero,
- tipo de operación,
- tasa impositiva,
- cuentas elegidas,
- centro de costo,
- referencia,
- período,
- moneda,
- monto neto / IVA / total,
- asiento histórico real en Zeta.

### 18.2 Labels útiles
- `journal_type_code`
- `account_code_primary`
- `account_code_counterpart`
- `tax_code`
- `party_role`
- `dimension_assignments`
- `is_credit_note`
- `is_cash_vs_credit`
- `suggested_auxiliary`

### 18.3 Estrategia correcta
1. documento entra
2. IA extrae campos
3. motor determinístico propone posting con reglas
4. IA solo ayuda a resolver ambigüedad
5. se compara contra espejo Zeta
6. si coincide: gana confianza
7. si no coincide: se abre caso de revisión / aprendizaje

### 18.4 Regla central
La IA no aprende “contabilidad en abstracto”; aprende de un espejo auditable + reglas explícitas.

---

## 19) Cómo usar el espejo para auditoría continua

### 19.1 Auditorías automáticas posibles
- asiento raro para ese tercero
- cuenta poco habitual para esa clase de documento
- IVA incoherente con histórico
- proveedor exento con tasa gravada
- centro de costo faltante en tipo de gasto que suele tenerlo
- referencia faltante donde históricamente existe
- cotización ausente o fuera de rango
- saldos abiertos extraños
- tipo de asiento que no coincide con el flujo operacional

### 19.2 Métricas
- `% documentos correctamente clasificados`
- `% postings que matchean 100% con Zeta`
- `% mismatches explicados`
- `MTTR contable` de revisión
- `% asientos con trazabilidad completa`
- `desvío entre trial balance propio y balance Zeta`

---

## 20) Requisitos funcionales (FR)

### FR-001 — Provider abstraction
El sistema debe soportar un provider `zeta` sin contaminar el dominio canónico con clases o nombres propios del proveedor.

### FR-002 — Read-only enforcement
El adapter Zeta debe exponer únicamente operaciones de lectura en esta fase.

### FR-003 — Raw persistence
Toda llamada al provider debe persistirse con request, response, page, timestamps y hash.

### FR-004 — Mirror de backbone contable
El sistema debe espejar ejercicios, cuentas, grupos, auxiliares, tipos, monedas, cotizaciones, dimensiones, terceros e impuestos.

### FR-005 — Reconstrucción de journal
El sistema debe reconstruir entries y lines desde `Consulta de Asientos`.

### FR-006 — Staging separado
El sistema debe espejar la Bandeja de Entrada sin mezclarla automáticamente con el journal publicado.

### FR-007 — Trial balance propio
El sistema debe poder calcular balance de comprobación desde el journal canónico.

### FR-008 — Reconciliación contra Zeta
El sistema debe poder contrastar su trial balance con snapshots de Balance Contable de Zeta.

### FR-009 — Dataset de aprendizaje
El sistema debe exponer datasets etiquetados para entrenar reglas y modelos.

### FR-010 — Explainability
Cada sugerencia contable debe mostrar:
- qué campos del documento usó,
- qué patrón histórico usó,
- qué regla disparó,
- qué score/confianza obtuvo.

### FR-011 — Multi-provider future-proof
Agregar otro ERP no debe requerir reescribir el core contable.

---

## 21) Requisitos no funcionales (NFR)

### NFR-001 — Seguridad
Credenciales siempre en vault. Nunca en logs ni payloads persistidos sin cifrado.

### NFR-002 — Auditabilidad
Todo dato espejado y toda sugerencia deben tener lineage.

### NFR-003 — Idempotencia
Reintentos y resincronizaciones no duplican.

### NFR-004 — Observabilidad
Métricas por endpoint, latencia, errores, páginas, retries, drift de schema.

### NFR-005 — Reproducibilidad
Una misma versión del normalizador sobre el mismo raw payload debe producir el mismo resultado.

### NFR-006 — Aislamiento
Un fallo en un endpoint no debe romper el resto del espejo.

### NFR-007 — Degradación elegante
Si Balance no existe, el sistema sigue operando con journal.

### NFR-008 — Explainability > opacidad
No se aceptan decisiones “porque el modelo dijo”.

---

## 22) Casos de aceptación (Gherkin)

### CA-001 — Importación inicial del plan de cuentas
```gherkin
Given una conexión válida a Zeta
When ejecuto la sincronización inicial de Plan de Cuentas
Then cada cuenta debe guardarse una sola vez en el modelo canónico
And cada cuenta debe conservar su código externo y hash de origen
And las cuentas imputables deben quedar marcadas como postables
```

### CA-002 — Reconstrucción de asientos desde filas planas
```gherkin
Given filas de Consulta de Asientos para un mismo número de asiento
When el normalizador procesa las filas
Then debe crear un único JournalEntry
And debe crear N JournalLines
And la suma del Debe debe ser igual a la suma del Haber
```

### CA-003 — Resincronización con superposición
```gherkin
Given una sincronización diaria con ventana superpuesta de 14 días
When se releen filas ya importadas
Then no deben duplicarse JournalEntries
And no deben duplicarse JournalLines
And debe actualizarse lastSeenAt
```

### CA-004 — Balance de contraste
```gherkin
Given que existe un Balance Contable generado en Zeta
When Convertilabs recalcula el trial balance del mismo período
Then debe comparar sus saldos contra el snapshot traído desde Zeta
And debe registrar cualquier diferencia como reconciliation_issue
```

### CA-005 — Read-only enforcement
```gherkin
Given el adapter zeta-provider-reader
When un desarrollador intenta invocar un método de escritura
Then el build debe fallar o el método no debe existir
```

---

## 23) Orden real de implementación

### Fase 0 — Preparación
- obtener credenciales
- confirmar rol
- importar colección Postman REST de Zeta
- hacer smoke tests
- definir vault y secretos

### Fase 1 — SDK/Adapter
- `provider-zeta`
- transporte REST
- fallback SOAP opcional
- paginación
- logging raw
- retry/backoff

### Fase 2 — Backbone contable
- ejercicios
- monedas
- cotizaciones
- plan
- grupos
- auxiliares
- tipos
- centros
- referencias
- tasas IVA
- RUT

### Fase 3 — Terceros y contexto
- contactos
- datos comerciales cliente/proveedor
- locales
- cajas
- bancos
- cuentas bancarias
- formas/condiciones de pago
- comprobantes

### Fase 4 — Journal
- consulta de asientos
- reconstrucción de entries/lines
- invariantes
- trial balance

### Fase 5 — Staging y open items
- bandeja de entrada
- cuotas pendientes
- match heurístico staged/posteado

### Fase 6 — Reconciliación
- balance snapshot
- mismatch engine
- dashboards

### Fase 7 — Motor determinístico + IA
- dataset builder
- rule miner
- scoring engine
- explainability
- auditor continuo

---

## 24) Estructura de repositorio sugerida

```text
/apps
  /convertilabs-api
  /sync-worker
  /admin-console
/packages
  /accounting-domain
  /accounting-canonical
  /provider-zeta
  /provider-common
  /reconciliation-engine
  /rules-engine
  /ai-posting-lab
  /shared-types
/docs
  /specs
    specs-driven-zeta-contabilidad-development.md
```

---

## 25) Anti-patrones a evitar

1. **“Zeta-first core”**  
   Mala idea. Te encierra y te vuelve incapaz de soportar otro ERP.

2. **Hardcodear Uruguay en el núcleo**  
   `LiteralTributario`, `DGI2181`, `CFE` deben vivir en meta jurisdiccional.

3. **Usar Balance API como verdad**  
   No. Es snapshot ya generado, no ledger.

4. **Perder payload raw**  
   Pecado capital. Después no auditás ni depurás nada.

5. **No separar bandeja de journal**  
   Mezcla staging con posted y hace lío conceptual.

6. **Dejar que la IA clasifique sin historial canónico**  
   Eso es pedirle al loro que cierre el ejercicio.

7. **Asumir que entry number solo alcanza como PK global**  
   En Zeta el número vive dentro del ejercicio.

8. **Borrar físicamente registros desaparecidos**  
   Después no sabés si hubo cambio, error o filtro.

---

## 26) Primer backlog aplicable ya

### Sprint 1
- [ ] crear `provider_connection`
- [ ] crear `provider_sync_run`
- [ ] implementar `zeta-provider-reader.ping()`
- [ ] probar Roles, Locales, Cajas
- [ ] persistir raw requests/responses

### Sprint 2
- [ ] implementar readers para Ejercicios, Plan, Grupos, Auxiliares, Tipos
- [ ] mapear a canónico
- [ ] tests de idempotencia
- [ ] tests de hashes

### Sprint 3
- [ ] monedas + cotizaciones + IVA + RUT + referencias + centros
- [ ] dimensions model
- [ ] tax model

### Sprint 4
- [ ] contactos + perfiles comerciales
- [ ] mapping de terceros
- [ ] reglas de party roles

### Sprint 5
- [ ] consulta de asientos
- [ ] reconstrucción entry/line
- [ ] trial balance
- [ ] dashboard de discrepancias

### Sprint 6
- [ ] bandeja + cuotas pendientes
- [ ] primer dataset de entrenamiento
- [ ] primer scoring engine de clasificación

---

## 27) Preguntas abiertas que hay que resolver con la primera conexión real

1. ¿La colección Postman REST cubre todos los endpoints que necesitamos o hay huecos?
2. ¿`Consulta de Asientos` trae `IsLastPage` o hay que inferir fin de datos por página vacía según el endpoint/versión?
3. ¿Existe algún identificador estable de línea no documentado en la respuesta real?
4. ¿Cómo se matchea de forma confiable un item de bandeja con un asiento ya importado al journal final?
5. ¿Qué campos extra devuelve la empresa concreta de Rontil que no estén en la ayuda pública?
6. ¿Qué endpoints tienen límites efectivos de velocidad y tamaño?
7. ¿Hay diferencias entre lo que documenta SOAP y lo que realmente devuelve REST?
8. ¿Qué reportes genera hoy Rontil en Zeta que debamos reproducir en Convertilabs para validar utilidad?

---

## 28) Definición de Done de esta fase

La fase “read-only mirror Zeta contabilidad” se considera terminada cuando:

- Convertilabs puede sincronizar y versionar catálogos contables completos.
- Puede reconstruir journal entries y lines por ejercicio.
- Puede calcular su propio trial balance.
- Puede leer staging/bandeja sin confundirlo con posted.
- Puede contrastar contra Balance Contable si existe snapshot en Zeta.
- Puede construir dataset etiquetado para clasificación.
- Puede explicar por qué un documento se clasificaría de cierta forma usando histórico real.
- Todo eso ocurre sin escribir un solo byte hacia Zeta.

---

## 29) Fuentes oficiales consultadas

> Base factual usada para esta spec (consultada 2026-03-18):

- [APIs - visión general](https://zetasoftware.info/ayuda/apis/)
- [Datos de Conexión](https://zetasoftware.info/ayuda/apis/datos-de-conexion/)
- [Configuración > APIs](https://zetasoftware.info/ayuda/configuracion/empresa/apis/)
- [SOAP y REST](https://zetasoftware.info/ayuda/apis/soap-y-rest/)
- [Índice de APIs](https://zetasoftware.info/ayuda/apis/indice-de-apis/)
- [Contabilidad](https://zetasoftware.info/ayuda/contabilidad/)
- [Asientos](https://zetasoftware.info/ayuda/contabilidad/asientos/)
- [Plan de Cuentas - ayuda funcional](https://zetasoftware.info/ayuda/configuracion/contabilidad/plan-de-cuentas/)
- [Parámetros Generales de Contabilidad](https://zetasoftware.info/ayuda/configuracion/contabilidad/parametros-generales-de-contabilidad/)
- [Tipos de Asientos - ayuda funcional](https://zetasoftware.info/ayuda/configuracion/contabilidad/tipos-de-asientos/)
- [Generar Anexo DGI 2/181](https://zetasoftware.info/ayuda/contabilidad/herramientas/generar-anexo-dgi/)
- [Plan de Cuentas - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/plan-de-cuentas/)
- [Ejercicios Contables - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/ejercicios-contables/)
- [Tipos de Asientos - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/tipos-de-asientos/)
- [Auxiliares - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/auxiliares/)
- [Centros de Costo - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/centros-de-costo/)
- [Referencias - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/referencias/)
- [Tasas de IVA - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/tasas-de-iva/)
- [Números de RUT - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/numeros-de-rut/)
- [Monedas - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/monedas/)
- [Cotización de Monedas - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/cotizacion-de-monedas/)
- [Locales Comerciales - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/locales-comerciales/)
- [Cajas - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/cajas/)
- [Roles de Usuarios - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/roles-de-usuarios/)
- [Contactos - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/contactos/)
- [Datos Comerciales Cliente - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/configuracion/datos-comerciales-cliente/)
- [Consulta de Asientos - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/consulta-de-asientos/)
- [Bandeja Entrada de Asientos - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/bandeja-entrada-de-asientos/)
- [Cuotas Pendientes - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/cuotas-de-cliente-y-proveedor/)
- [Balance Contable - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/balance-contable/)
- [Facturas de Clientes - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-clientes/)
- [Facturas de Proveedores - API](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-proveedores/)

---

## 30) Cierre

La jugada correcta no es “copiar Zeta”.  
La jugada correcta es:

1. **leer Zeta bien**,
2. **espejarlo con integridad**,
3. **entender la lógica contable real**,
4. **derivar un núcleo generalista**,
5. **usar IA encima de un sistema que ya cierra**.

Primero ledger. Después magia.  
En ese orden, o aparece el chocolate contable.
