# Convertilabs — Módulo Banco / Tesorería para vales, renovaciones, cierres y caja disponible

## Contexto de negocio

Este módulo nace de una regla operativa central:

> El saldo que aparece en el banco no es plata disponible.  
> La plata disponible real es lo que queda después de cubrir vales, préstamos, intereses, vencimientos, compromisos y un colchón mínimo.

En Rontil, gran parte de la gestión bancaria depende de **vales bancarios**. La información de esos vales no viene hoy de una API confiable: se obtiene manualmente desde la web del banco y desde emails de la ejecutiva de cuentas, que informa vencimientos, renovaciones posibles y cierres.

Por eso el primer MVP debe permitir **carga manual robusta**, no integración bancaria automática.

El sistema debe ayudar a responder en segundos:

```text
1. ¿Qué vales/préstamos vencen pronto?
2. ¿Cuáles se renuevan y cuáles se cierran?
3. ¿Cuánto hay que pagar de intereses por renovación?
4. ¿Cuánto hay que devolver si se cierra un vale?
5. ¿Cuánta plata hay realmente disponible?
6. ¿Qué plata tengo por cobrar y cuándo?
7. ¿Qué pasa si saco plata hoy?
```

---

## Objetivo del módulo

Crear dentro de Convertilabs un módulo llamado preferentemente:

```text
Banco / Tesorería
```

o

```text
Tesorería y Vencimientos
```

El objetivo no es hacer contabilidad completa.  
El objetivo es evitar errores de caja y anticipar riesgos bancarios.

La pantalla principal debe dejar clarísimo:

```text
Disponible real ≠ saldo bancario.
Disponible real = saldo bancario - obligaciones - colchón mínimo.
```

---

## Alcance del MVP

### Incluido en MVP

- Carga manual de cuentas bancarias.
- Actualización manual de saldo bancario por moneda.
- Registro manual de vales bancarios.
- Registro de vencimientos de vales.
- Registro de renovaciones de vales.
- Registro de cierres de vales.
- Registro de pago de intereses.
- Registro de devolución de capital cuando se cierra un vale.
- Registro de cuentas por cobrar.
- Dashboard de caja.
- Proyección de caja.
- Semáforo de riesgo.
- Simulador de retiro.
- Alertas por vencimientos y caja insuficiente.

### No incluido en MVP

- Integración automática con bancos.
- Lectura automática de emails.
- Conciliación bancaria automática.
- OCR perfecto de documentos bancarios.
- IA tomando decisiones financieras.
- ERP contable completo.

La integración bancaria, Gmail, OCR o IA pueden venir después. Primero se necesita una herramienta confiable para cargar manualmente y calcular bien.

---

## Regla principal de negocio

```text
La caja libre real es el único monto disponible para gastar o retirar.
```

Fórmula base:

```text
Caja libre real =
Saldo bancario actual
- vencimientos financieros próximos
- intereses próximos
- pagos operativos inevitables
- colchón mínimo
```

Importante:

```text
La plata por cobrar NO aumenta la caja libre real hasta que esté cobrada.
Solo puede usarse para proyección.
```

---

## Conceptos del negocio

### Vale bancario

Un vale bancario es una deuda de corto plazo con un banco. Tiene:

- banco;
- moneda;
- capital;
- fecha de vencimiento;
- interés a pagar;
- eventuales comisiones/gastos;
- estado;
- posibilidad de renovación;
- posibilidad de cierre.

### Vencimiento de un vale

Cuando un vale vence pueden pasar dos cosas principales:

#### 1. Renovación

Se paga el interés, gastos o comisiones del período y el capital continúa financiado hasta una nueva fecha.

Ejemplo:

```text
Vale actual:
Capital: USD 5.000
Interés al vencimiento: USD 180
Vence: 25/06/2026

Si se renueva:
Sale de caja ahora: USD 180
Capital pendiente: USD 5.000
Nuevo vencimiento: fecha informada por banco
```

Puede existir amortización parcial. Por eso la renovación debe permitir opcionalmente pagar parte del capital.

Ejemplo con amortización parcial:

```text
Capital: USD 5.000
Interés: USD 180
Amortización parcial: USD 1.000

Sale de caja al renovar: USD 1.180
Nuevo capital pendiente: USD 4.000
```

#### 2. Cierre

Se devuelve toda la plata: capital + interés + gastos.

Ejemplo:

```text
Vale:
Capital: USD 5.000
Interés: USD 180
Gastos: USD 0

Si se cierra:
Sale de caja: USD 5.180
El vale queda cerrado.
```

Regla:

```text
Cerrar un vale implica devolver el capital completo pendiente, más intereses y gastos.
```

---

## Regla conservadora

Si un vale vence y todavía no está confirmada la renovación, el sistema debe asumir riesgo alto.

Para cálculos conservadores:

```text
Si la renovación NO está confirmada, asumir cierre.
```

Es decir:

```text
Monto conservador a cubrir = capital pendiente + interés + gastos
```

Para cálculos planificados:

```text
Si está marcado como "renovación confirmada", considerar solo interés + gastos + amortización parcial.
```

El dashboard puede mostrar ambos números:

```text
Caja libre planificada
Caja libre conservadora
```

Pero la tarjeta principal recomendada debe ser conservadora, salvo que el usuario active explícitamente una vista planificada.

---

## Estados de un vale

Estados recomendados:

```text
DRAFT
ACTIVE
DUE_SOON
RENEWED
CLOSED
OVERDUE
CANCELLED
```

Significado:

| Estado | Significado |
|---|---|
| `DRAFT` | Cargado parcialmente, no usar para cálculo todavía |
| `ACTIVE` | Vale vigente |
| `DUE_SOON` | Vence pronto |
| `RENEWED` | El período anterior fue renovado |
| `CLOSED` | Se devolvió capital e intereses |
| `OVERDUE` | Venció y no está marcado como renovado/cerrado |
| `CANCELLED` | Anulado por error, no borrar si tiene historial |

---

## Ciclo de vida recomendado

### Alta inicial de vale

El usuario carga manualmente:

```text
Banco
Moneda
Número/referencia de operación
Capital
Fecha de emisión, si se conoce
Fecha de vencimiento
Interés esperado
Gastos/comisiones esperados
Estado de renovación
Notas
Fuente de información
```

Fuente de información puede ser:

```text
WEB_BANCO
EMAIL_EJECUTIVA
MANUAL
OTRO
```

Debe haber un campo para pegar texto del email o nota de la ejecutiva.

---

### Renovación de vale

Cuando se renueva un vale:

1. Registrar fecha de renovación.
2. Registrar interés pagado.
3. Registrar gastos/comisiones pagados.
4. Registrar amortización parcial si existió.
5. Registrar nuevo capital pendiente.
6. Registrar nuevo vencimiento.
7. Marcar el período actual como renovado.
8. Crear un nuevo período del mismo vale.
9. Mantener el historial.

Importante:

```text
Una renovación no cierra el vale.
Una renovación paga intereses/gastos y extiende el capital.
```

---

### Cierre de vale

Cuando se cierra un vale:

1. Registrar fecha de cierre/pago.
2. Registrar capital devuelto.
3. Registrar interés pagado.
4. Registrar gastos/comisiones pagados.
5. Marcar el período como cerrado.
6. Marcar el vale como cerrado si no queda capital pendiente.

Importante:

```text
Un cierre sí devuelve toda la plata pendiente.
```

---

## Modelo recomendado: Vale + períodos + eventos

No modelar cada renovación como un vale totalmente separado sin relación.  
La recomendación es usar:

```text
Vale
 ├── ValeTerm / período 1
 │    └── ValeEvent: alta
 │    └── ValeEvent: renovación
 ├── ValeTerm / período 2
 │    └── ValeEvent: renovación
 └── ValeTerm / período 3
      └── ValeEvent: cierre
```

Esto permite ver la historia completa del vale.

---

## Modelo de datos recomendado

Adaptar a la arquitectura existente del repositorio.  
Si el proyecto usa Prisma, este esquema sirve como base.

Usar importes en unidades menores:

```text
USD 7.500,25 => 750025
UYU 12.345,67 => 1234567
```

No usar `float` para dinero.

Las APIs deben enviar `BigInt` como string cuando sea necesario.

---

## Prisma schema sugerido

```prisma
enum Currency {
  USD
  UYU
}

enum BankAccountType {
  CHECKING
  SAVINGS
  CREDIT_LINE
  OTHER
}

enum SourceType {
  WEB_BANCO
  EMAIL_EJECUTIVA
  MANUAL
  OTHER
}

enum ValeStatus {
  DRAFT
  ACTIVE
  DUE_SOON
  RENEWED
  CLOSED
  OVERDUE
  CANCELLED
}

enum ValeTermStatus {
  PENDING
  RENEWED
  CLOSED
  OVERDUE
  CANCELLED
}

enum ValePlannedAction {
  UNDECIDED
  RENEW
  CLOSE
}

enum ValeEventType {
  CREATED
  UPDATED
  RENEWAL_CONFIRMED
  RENEWED
  CLOSED
  INTEREST_PAID
  PRINCIPAL_PAID
  DUE_DATE_CHANGED
  NOTE
  CANCELLED
}

enum ReceivableStatus {
  PENDING
  COLLECTED
  OVERDUE
  CANCELLED
}

enum ReceivableConfidence {
  CONFIRMED
  PROBABLE
  DOUBTFUL
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model BankAccount {
  id             String          @id @default(cuid())

  // Si el proyecto es multi-empresa, agregar companyId / tenantId.
  name           String
  bankName       String
  accountNumber  String?
  currency       Currency
  type           BankAccountType @default(CHECKING)

  currentBalance BigInt          @default(0)
  notes          String?

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  balanceSnapshots BankBalanceSnapshot[]
  vales            Vale[]
}

model BankBalanceSnapshot {
  id            String      @id @default(cuid())
  bankAccountId String
  bankAccount   BankAccount @relation(fields: [bankAccountId], references: [id])

  balance       BigInt
  currency      Currency
  snapshotDate  DateTime
  notes         String?
  source        SourceType  @default(MANUAL)

  createdAt     DateTime    @default(now())
}

model Vale {
  id                  String      @id @default(cuid())

  bankAccountId       String?
  bankAccount         BankAccount? @relation(fields: [bankAccountId], references: [id])

  bankName            String
  operationNumber     String?
  internalReference   String?

  currency            Currency
  originalPrincipal   BigInt
  currentPrincipal    BigInt

  status              ValeStatus  @default(ACTIVE)

  source              SourceType  @default(MANUAL)
  sourceText          String?
  notes               String?

  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  terms               ValeTerm[]
  events              ValeEvent[]
}

model ValeTerm {
  id                         String            @id @default(cuid())

  valeId                     String
  vale                       Vale              @relation(fields: [valeId], references: [id])

  sequence                   Int

  principalAmount            BigInt
  expectedInterestAmount     BigInt            @default(0)
  expectedFeesAmount         BigInt            @default(0)
  expectedPartialPrincipalPayment BigInt       @default(0)

  issueDate                  DateTime?
  dueDate                    DateTime

  plannedAction              ValePlannedAction @default(UNDECIDED)
  renewalOffered             Boolean           @default(false)
  renewalConfirmed           Boolean           @default(false)
  expectedNewDueDate         DateTime?
  expectedNewPrincipalAmount BigInt?

  status                     ValeTermStatus    @default(PENDING)
  riskLevel                  RiskLevel         @default(MEDIUM)

  source                     SourceType        @default(MANUAL)
  sourceText                 String?
  notes                      String?

  createdAt                  DateTime          @default(now())
  updatedAt                  DateTime          @updatedAt

  events                     ValeEvent[]
}

model ValeEvent {
  id                    String        @id @default(cuid())

  valeId                String
  vale                  Vale          @relation(fields: [valeId], references: [id])

  valeTermId            String?
  valeTerm              ValeTerm?     @relation(fields: [valeTermId], references: [id])

  type                  ValeEventType
  eventDate             DateTime

  principalPaidAmount   BigInt        @default(0)
  interestPaidAmount    BigInt        @default(0)
  feesPaidAmount        BigInt        @default(0)

  resultingPrincipal    BigInt?
  newDueDate            DateTime?

  source                SourceType    @default(MANUAL)
  sourceText            String?
  notes                 String?

  createdAt             DateTime      @default(now())
}

model Receivable {
  id              String                @id @default(cuid())

  customerName    String
  documentNumber  String?
  description     String?

  currency        Currency
  amount          BigInt

  issueDate       DateTime?
  expectedDate    DateTime
  collectedAt     DateTime?

  status          ReceivableStatus      @default(PENDING)
  confidence      ReceivableConfidence  @default(PROBABLE)

  source          SourceType            @default(MANUAL)
  sourceText      String?
  notes           String?

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
}

model CashReserveRule {
  id              String    @id @default(cuid())
  currency        Currency
  minBufferAmount BigInt
  horizonDays     Int       @default(45)
  active          Boolean   @default(true)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model CashAlert {
  id              String    @id @default(cuid())

  currency        Currency
  title           String
  message         String
  riskLevel       RiskLevel

  dueDate         DateTime?
  resolved        Boolean   @default(false)

  createdAt       DateTime  @default(now())
  resolvedAt      DateTime?
}
```

---

## Nota sobre fechas

Para vencimientos bancarios conviene evitar errores por zona horaria.

Recomendación:

- Si el stack lo permite, tratar `dueDate`, `expectedDate` y fechas de vencimiento como fechas de negocio, no como instantes horarios.
- La empresa opera en Uruguay, por lo que usar `America/Montevideo` para presentación.
- En la base puede usarse `DateTime`, pero normalizar a mediodía local o manejar una capa `LocalDate` si ya existe en el proyecto.

---

## Cálculos centrales

Crear un servicio puro de TypeScript, por ejemplo:

```text
src/modules/treasury/treasury-calculations.ts
```

o adaptar a la estructura existente.

---

### Tipos base

```ts
export type Currency = "USD" | "UYU";

export type RiskStatus = "GREEN" | "YELLOW" | "RED" | "CRITICAL";

export type ValePlannedAction = "UNDECIDED" | "RENEW" | "CLOSE";

export type ValeTermInput = {
  id: string;
  currency: Currency;
  principalAmountMinor: bigint;
  expectedInterestAmountMinor: bigint;
  expectedFeesAmountMinor: bigint;
  expectedPartialPrincipalPaymentMinor: bigint;
  dueDate: Date;
  plannedAction: ValePlannedAction;
  renewalConfirmed: boolean;
};
```

---

### Calcular salida de caja de un período de vale

```ts
export function calculateValeTermCashImpact(term: ValeTermInput): {
  plannedOutflowMinor: bigint;
  conservativeOutflowMinor: bigint;
  explanation: string;
} {
  const interestAndFees =
    term.expectedInterestAmountMinor + term.expectedFeesAmountMinor;

  const renewalOutflow =
    interestAndFees + term.expectedPartialPrincipalPaymentMinor;

  const closeOutflow =
    term.principalAmountMinor + interestAndFees;

  if (term.plannedAction === "CLOSE") {
    return {
      plannedOutflowMinor: closeOutflow,
      conservativeOutflowMinor: closeOutflow,
      explanation:
        "El vale está planificado para cierre: se considera capital + interés + gastos.",
    };
  }

  if (term.plannedAction === "RENEW" && term.renewalConfirmed) {
    return {
      plannedOutflowMinor: renewalOutflow,
      conservativeOutflowMinor: renewalOutflow,
      explanation:
        "La renovación está confirmada: se considera interés + gastos + amortización parcial.",
    };
  }

  if (term.plannedAction === "RENEW" && !term.renewalConfirmed) {
    return {
      plannedOutflowMinor: renewalOutflow,
      conservativeOutflowMinor: closeOutflow,
      explanation:
        "La renovación está planificada pero no confirmada: planificado usa renovación, conservador asume cierre.",
    };
  }

  return {
    plannedOutflowMinor: closeOutflow,
    conservativeOutflowMinor: closeOutflow,
    explanation:
      "No hay acción definida: por prudencia se asume cierre del vale.",
  };
}
```

---

### Calcular caja libre

```ts
export type CashPositionInput = {
  currency: Currency;
  bankBalanceMinor: bigint;
  plannedObligationsMinor: bigint;
  conservativeObligationsMinor: bigint;
  unavoidablePaymentsMinor: bigint;
  minBufferMinor: bigint;
};

export type CashPositionResult = {
  currency: Currency;
  bankBalanceMinor: bigint;
  plannedCommittedMinor: bigint;
  conservativeCommittedMinor: bigint;
  minBufferMinor: bigint;
  plannedAvailableCashMinor: bigint;
  conservativeAvailableCashMinor: bigint;
  status: RiskStatus;
  message: string;
};

export function calculateCashPosition(
  input: CashPositionInput
): CashPositionResult {
  const plannedCommittedMinor =
    input.plannedObligationsMinor + input.unavoidablePaymentsMinor;

  const conservativeCommittedMinor =
    input.conservativeObligationsMinor + input.unavoidablePaymentsMinor;

  const plannedAvailableCashMinor =
    input.bankBalanceMinor - plannedCommittedMinor - input.minBufferMinor;

  const conservativeAvailableCashMinor =
    input.bankBalanceMinor - conservativeCommittedMinor - input.minBufferMinor;

  let status: RiskStatus;
  let message: string;

  if (conservativeAvailableCashMinor < 0n) {
    status = "RED";
    message =
      "No tocar. La caja libre conservadora es negativa.";
  } else if (conservativeAvailableCashMinor < input.minBufferMinor) {
    status = "YELLOW";
    message =
      "Caja ajustada. Evitar retiros y gastos no urgentes.";
  } else {
    status = "GREEN";
    message =
      "Hay caja libre conservadora positiva manteniendo obligaciones y colchón.";
  }

  return {
    currency: input.currency,
    bankBalanceMinor: input.bankBalanceMinor,
    plannedCommittedMinor,
    conservativeCommittedMinor,
    minBufferMinor: input.minBufferMinor,
    plannedAvailableCashMinor,
    conservativeAvailableCashMinor,
    status,
    message,
  };
}
```

---

### Simulador de retiro

```ts
export function simulateWithdrawal(params: {
  conservativeAvailableCashMinor: bigint;
  withdrawalAmountMinor: bigint;
  currency: Currency;
}): {
  allowed: boolean;
  risk: "LOW" | "MEDIUM" | "HIGH";
  afterWithdrawalMinor: bigint;
  message: string;
} {
  const afterWithdrawalMinor =
    params.conservativeAvailableCashMinor - params.withdrawalAmountMinor;

  if (afterWithdrawalMinor < 0n) {
    return {
      allowed: false,
      risk: "HIGH",
      afterWithdrawalMinor,
      message:
        "No recomendado. Después del retiro la caja libre conservadora queda negativa.",
    };
  }

  if (afterWithdrawalMinor === 0n) {
    return {
      allowed: true,
      risk: "MEDIUM",
      afterWithdrawalMinor,
      message:
        "Permitido solo si es inevitable. La caja libre queda en cero.",
    };
  }

  return {
    allowed: true,
    risk: "LOW",
    afterWithdrawalMinor,
    message:
      "Permitido con cuidado. La caja libre conservadora sigue positiva.",
  };
}
```

---

## Proyección de caja

La proyección debe separar al menos dos escenarios:

```text
1. Conservador:
   - Vales sin renovación confirmada se asumen como cierre.
   - Solo incluye cuentas por cobrar confirmadas si el usuario activa esa opción para proyección.
   - Nunca suma cuentas por cobrar a caja disponible actual.

2. Planificado:
   - Usa las acciones planificadas de cada vale.
   - Si hay renovación marcada como confirmada, considera pago de intereses/gastos y no devolución total de capital en ese vencimiento.
   - Incluye cobros confirmados y opcionalmente probables para ver flujo futuro.
```

Tabla ejemplo:

| Fecha | Evento | Escenario | Entra | Sale | Saldo proyectado |
|---|---|---|---:|---:|---:|
| Hoy | Saldo inicial | Conservador |  |  | USD 7.500 |
| 25/06/2026 | Cierre conservador Vale Banco X | Conservador |  | USD 5.180 | USD 2.320 |
| 28/06/2026 | Cobro Cliente A confirmado | Conservador | USD 7.500 |  | USD 9.820 |
| 25/06/2026 | Renovación confirmada Vale Banco X | Planificado |  | USD 180 | USD 7.320 |

---

## Cuentas por cobrar

Campos mínimos:

```text
Cliente
Documento/factura
Moneda
Importe
Fecha esperada de cobro
Estado
Probabilidad
Notas
Fuente
Texto pegado desde email/documento
```

Estados:

```text
PENDING
COLLECTED
OVERDUE
CANCELLED
```

Confianza:

```text
CONFIRMED
PROBABLE
DOUBTFUL
```

Regla:

```text
Una cuenta por cobrar no se considera caja disponible hasta que se marque como cobrada.
```

Al marcar como cobrada:

- registrar fecha real de cobro;
- opcionalmente asociar cuenta bancaria;
- opcionalmente actualizar saldo bancario o crear movimiento, si el sistema ya tiene movimientos.

---

## Dashboard principal

Ruta sugerida:

```text
/treasury
```

o

```text
/banco
```

Tarjetas superiores:

```text
Saldo bancos
Comprometido próximos 7 días
Comprometido próximos 30 días
Caja libre conservadora
Caja libre planificada
Por cobrar confirmado 30 días
Riesgo
```

Ejemplo:

```text
Saldo bancos USD:                 7.500
Vales próximos 30 días:
  - Conservador:                  5.180
  - Planificado:                    180
Colchón mínimo USD:               1.000

Caja libre conservadora:          1.320
Caja libre planificada:           6.320

Estado:
VERDE conservador, pero revisar si la renovación está realmente confirmada.
```

Si renovación no confirmada:

```text
Saldo bancos USD:                 7.500
Vale Banco X vence 25/06/2026:
  - Si cierra:                    5.180
  - Si renueva:                     180

Renovación no confirmada.
Caja libre conservadora:          1.320
Caja libre planificada:           6.320

Alerta:
No contar con la caja planificada hasta confirmar la renovación.
```

---

## Pantallas necesarias

### 1. Resumen de Tesorería

Debe mostrar:

- saldo por banco/moneda;
- caja libre conservadora;
- caja libre planificada;
- vencimientos próximos;
- cobros esperados;
- alertas;
- simulador de retiro rápido.

---

### 2. Cuentas bancarias

Funcionalidades:

- crear cuenta;
- editar cuenta;
- actualizar saldo manualmente;
- ver historial de saldos manuales.

Campos:

```text
Banco
Nombre de cuenta
Número/referencia
Moneda
Tipo
Saldo actual
Fecha de saldo
Notas
```

---

### 3. Vales

Funcionalidades:

- listar vales activos;
- filtrar por banco, moneda, vencimiento, estado, renovación confirmada;
- crear vale;
- editar vale;
- ver detalle e historial;
- registrar renovación;
- registrar cierre;
- registrar nota;
- cancelar vale cargado por error.

Columnas importantes:

```text
Banco
Operación
Capital pendiente
Interés próximo
Gastos próximos
Vencimiento
Acción prevista
Renovación confirmada
Salida conservadora
Salida planificada
Estado
Riesgo
```

Acciones por fila:

```text
Ver detalle
Editar
Confirmar renovación
Registrar renovación
Registrar cierre
Agregar nota
```

---

### 4. Detalle de vale

Debe mostrar:

```text
Datos generales
Capital original
Capital pendiente
Banco
Número de operación
Estado actual
Períodos
Eventos
Notas
Fuente de información
```

Tabla de períodos:

| Secuencia | Capital | Interés | Gastos | Vence | Acción | Confirmada | Estado |
|---:|---:|---:|---:|---|---|---|---|

Tabla de eventos:

| Fecha | Evento | Capital pagado | Interés pagado | Gastos | Resultado |
|---|---|---:|---:|---:|---|

---

### 5. Modal/formulario: Registrar renovación

Campos:

```text
Fecha de renovación
Interés pagado
Gastos/comisiones pagados
Capital amortizado, opcional
Nuevo capital pendiente
Nuevo vencimiento
Renovación confirmada por banco
Fuente: web banco / email ejecutiva / manual
Texto o nota de respaldo
```

Validaciones:

```text
Nuevo vencimiento obligatorio.
Interés pagado >= 0.
Gastos >= 0.
Capital amortizado >= 0.
Nuevo capital pendiente = capital anterior - capital amortizado, salvo que el usuario lo ajuste con confirmación.
No permitir renovar un período ya cerrado o ya renovado.
```

Efecto:

```text
1. Crear ValeEvent tipo RENEWED.
2. Marcar ValeTerm actual como RENEWED.
3. Crear nuevo ValeTerm con sequence + 1.
4. Actualizar Vale.currentPrincipal.
5. Mantener Vale.status ACTIVE.
```

---

### 6. Modal/formulario: Registrar cierre

Campos:

```text
Fecha de cierre
Capital devuelto
Interés pagado
Gastos/comisiones pagados
Fuente
Texto/nota de respaldo
```

Validaciones:

```text
Capital devuelto debe ser mayor a 0.
Si capital devuelto < capital pendiente, advertir que no es cierre total; puede ser amortización parcial.
Si se confirma cierre total, capital resultante debe ser 0.
No permitir cerrar un período ya cerrado o renovado.
```

Efecto:

```text
1. Crear ValeEvent tipo CLOSED.
2. Marcar ValeTerm actual como CLOSED.
3. Actualizar Vale.currentPrincipal = 0 si cierre total.
4. Marcar Vale.status CLOSED si no queda capital pendiente.
```

---

### 7. Por cobrar

Funcionalidades:

- crear cuenta por cobrar;
- editar fecha esperada;
- cambiar confianza;
- marcar como cobrada;
- marcar como dudosa;
- ver atrasadas.

Columnas:

```text
Cliente
Documento
Monto
Fecha esperada
Estado
Confianza
Días de atraso
Acción siguiente
```

---

### 8. Simulador

Formulario:

```text
Moneda
Monto que quiero sacar/gastar
Horizonte: 7 / 15 / 30 / 45 días
Escenario: conservador / planificado
```

Resultado:

```text
Caja libre antes
Caja libre después
Riesgo
Mensaje
```

Ejemplo:

```text
Quiero sacar USD 500.

Caja libre conservadora antes: USD 1.320
Caja libre después: USD 820

Resultado:
Permitido con cuidado.
```

Si da negativo:

```text
No recomendado.
Después del retiro la caja libre conservadora queda negativa.
```

---

## Alertas

Crear alertas calculadas o persistidas según arquitectura.

Alertas mínimas:

```text
1. Vale vence en menos de 7 días.
2. Vale vence en menos de 72 horas.
3. Vale vencido sin renovación/cierre registrado.
4. Renovación planificada pero no confirmada.
5. Caja libre conservadora negativa.
6. Cuenta por cobrar confirmada se atrasó.
7. Saldo bancario menor al colchón mínimo.
8. Intento de retiro simulado deja caja negativa.
```

Niveles:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Reglas:

```text
Si vence en menos de 72 horas y no hay caja suficiente => CRITICAL.
Si vence en menos de 7 días y renovación no confirmada => HIGH.
Si caja libre conservadora < 0 => HIGH o CRITICAL.
Si la fecha venció y no está cerrado/renovado => CRITICAL.
```

---

## Endpoints sugeridos

Adaptar nombres a la convención del backend.

```text
GET    /api/treasury/dashboard
GET    /api/treasury/cash-position
GET    /api/treasury/projection?days=45&scenario=conservative
POST   /api/treasury/simulate-withdrawal

GET    /api/treasury/bank-accounts
POST   /api/treasury/bank-accounts
PATCH  /api/treasury/bank-accounts/:id
POST   /api/treasury/bank-accounts/:id/balance-snapshots

GET    /api/treasury/vales
POST   /api/treasury/vales
GET    /api/treasury/vales/:id
PATCH  /api/treasury/vales/:id
POST   /api/treasury/vales/:id/terms/:termId/confirm-renewal
POST   /api/treasury/vales/:id/terms/:termId/renew
POST   /api/treasury/vales/:id/terms/:termId/close
POST   /api/treasury/vales/:id/notes

GET    /api/treasury/receivables
POST   /api/treasury/receivables
PATCH  /api/treasury/receivables/:id
POST   /api/treasury/receivables/:id/mark-collected

GET    /api/treasury/alerts
POST   /api/treasury/alerts/:id/resolve
```

---

## Payloads ejemplo

### Crear vale

```json
{
  "bankAccountId": "optional",
  "bankName": "Banco X",
  "operationNumber": "123456",
  "currency": "USD",
  "originalPrincipalMinor": "500000",
  "currentPrincipalMinor": "500000",
  "dueDate": "2026-06-25",
  "expectedInterestAmountMinor": "18000",
  "expectedFeesAmountMinor": "0",
  "plannedAction": "UNDECIDED",
  "renewalOffered": false,
  "renewalConfirmed": false,
  "source": "EMAIL_EJECUTIVA",
  "sourceText": "Texto pegado del email de la ejecutiva...",
  "notes": "Vencimiento informado por ejecutiva."
}
```

### Confirmar renovación futura

```json
{
  "plannedAction": "RENEW",
  "renewalConfirmed": true,
  "expectedInterestAmountMinor": "18000",
  "expectedFeesAmountMinor": "0",
  "expectedPartialPrincipalPaymentMinor": "0",
  "expectedNewPrincipalAmountMinor": "500000",
  "expectedNewDueDate": "2026-07-25",
  "source": "EMAIL_EJECUTIVA",
  "sourceText": "Renovación confirmada hasta 25/07."
}
```

### Registrar renovación ejecutada

```json
{
  "eventDate": "2026-06-25",
  "interestPaidAmountMinor": "18000",
  "feesPaidAmountMinor": "0",
  "principalPaidAmountMinor": "0",
  "newPrincipalAmountMinor": "500000",
  "newDueDate": "2026-07-25",
  "source": "WEB_BANCO",
  "sourceText": "Pago de intereses realizado en web banco.",
  "notes": "Renovado sin amortización."
}
```

### Registrar cierre

```json
{
  "eventDate": "2026-06-25",
  "principalPaidAmountMinor": "500000",
  "interestPaidAmountMinor": "18000",
  "feesPaidAmountMinor": "0",
  "source": "WEB_BANCO",
  "sourceText": "Cierre realizado en web banco.",
  "notes": "Vale cerrado completamente."
}
```

---

## Respuesta de dashboard esperada

```ts
export type TreasuryDashboardResponse = {
  currency: "USD" | "UYU";

  bankBalanceMinor: string;

  obligations: {
    next7DaysPlannedMinor: string;
    next7DaysConservativeMinor: string;
    next30DaysPlannedMinor: string;
    next30DaysConservativeMinor: string;
    next45DaysPlannedMinor: string;
    next45DaysConservativeMinor: string;
  };

  reserve: {
    minBufferMinor: string;
  };

  availableCash: {
    plannedMinor: string;
    conservativeMinor: string;
  };

  receivables: {
    confirmedNext30DaysMinor: string;
    probableNext30DaysMinor: string;
    overdueMinor: string;
  };

  status: "GREEN" | "YELLOW" | "RED" | "CRITICAL";

  message: string;

  upcomingVales: Array<{
    id: string;
    termId: string;
    bankName: string;
    operationNumber?: string;
    dueDate: string;
    principalAmountMinor: string;
    expectedInterestAmountMinor: string;
    expectedFeesAmountMinor: string;
    plannedAction: "UNDECIDED" | "RENEW" | "CLOSE";
    renewalConfirmed: boolean;
    plannedOutflowMinor: string;
    conservativeOutflowMinor: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;

  upcomingReceivables: Array<{
    id: string;
    customerName: string;
    expectedDate: string;
    amountMinor: string;
    confidence: "CONFIRMED" | "PROBABLE" | "DOUBTFUL";
    status: "PENDING" | "COLLECTED" | "OVERDUE" | "CANCELLED";
  }>;

  alerts: Array<{
    title: string;
    message: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
};
```

---

## Reglas de validación

### Dinero

```text
- No usar float.
- Usar BigInt o Decimal según estándar existente.
- En UI mostrar formato humano.
- En API enviar strings si se usa BigInt.
```

### Vale

```text
- Un vale activo debe tener capital pendiente > 0.
- Un período activo debe tener fecha de vencimiento.
- Un período no puede renovarse dos veces.
- Un período no puede cerrarse dos veces.
- No borrar vales con historial: usar CANCELLED.
- Si venció y no está cerrado/renovado, marcar o mostrar como OVERDUE.
- Si plannedAction = RENEW y renewalConfirmed = false, mostrar alerta.
- Si plannedAction = RENEW y no hay expectedNewDueDate, advertir.
```

### Renovación

```text
- Debe registrar pago de intereses.
- Debe pedir nuevo vencimiento.
- Debe crear nuevo período.
- Debe mantener capital pendiente, salvo amortización parcial.
- Si hay amortización parcial, reducir capital pendiente.
```

### Cierre

```text
- Debe registrar capital devuelto.
- Debe registrar interés/gastos.
- Debe dejar capital pendiente en cero si es cierre total.
- Debe marcar vale como CLOSED.
```

### Por cobrar

```text
- No impacta caja disponible hasta marcar como cobrado.
- Si expectedDate < hoy y status = PENDING, mostrar como atrasado.
- CONFIRMED puede aparecer en proyección conservadora si el usuario lo permite.
- PROBABLE solo debe aparecer en proyección planificada/optimista.
- DOUBTFUL no debe usarse para caja salvo visualización de riesgo.
```

---

## UI: mensajes importantes

Usar textos claros, no técnicos.

Ejemplos:

```text
No tocar: la caja libre conservadora es negativa.
```

```text
Hay saldo en banco, pero está comprometido por vencimientos.
```

```text
La renovación está planificada, pero todavía no está confirmada por el banco.
```

```text
Si este vale no se renueva, hay que devolver capital + intereses.
```

```text
Este cobro ayuda a la proyección, pero todavía no es caja disponible.
```

```text
Cerrar este vale implica devolver toda la plata pendiente.
```

---

## Componentes frontend sugeridos

Adaptar a la estructura existente.

```text
TreasuryDashboardPage
BankAccountsPage
ValesPage
ValeDetailPage
ReceivablesPage
CashProjectionPage

CashSummaryCards
UpcomingValesTable
UpcomingReceivablesTable
TreasuryAlertsPanel
WithdrawalSimulator
ValeForm
RenewValeModal
CloseValeModal
ConfirmRenewalModal
MoneyInput
CurrencyBadge
RiskBadge
```

---

## Orden de implementación recomendado para Codex

### Paso 1 — Inspección

Antes de modificar:

```text
- Revisar estructura del repo.
- Identificar framework backend.
- Identificar framework frontend.
- Identificar ORM/base de datos.
- Identificar patrones existentes de rutas, servicios, validaciones y componentes.
- Reusar convenciones existentes.
```

No imponer arquitectura nueva si el repo ya tiene una.

---

### Paso 2 — Capa de cálculo pura

Crear primero funciones puras testeables:

```text
calculateValeTermCashImpact
calculateCashPosition
simulateWithdrawal
buildCashProjection
evaluateTreasuryRisk
```

Esto evita mezclar reglas financieras con UI o base de datos.

---

### Paso 3 — Modelos y migración

Agregar tablas/modelos:

```text
BankAccount
BankBalanceSnapshot
Vale
ValeTerm
ValeEvent
Receivable
CashReserveRule
CashAlert
```

Si el repo ya tiene modelos similares, extenderlos en vez de duplicar.

---

### Paso 4 — Endpoints/API

Implementar endpoints mínimos:

```text
Dashboard
Cuentas bancarias
Vales
Renovar vale
Cerrar vale
Por cobrar
Simulador
```

---

### Paso 5 — UI mínima

Crear pantallas:

```text
Resumen
Vales
Detalle de vale
Por cobrar
Cuentas bancarias
```

Priorizar funcionalidad sobre estética.

---

### Paso 6 — Tests

Agregar tests unitarios para cálculos.

Casos obligatorios:

```text
1. Vale sin renovación confirmada se calcula como cierre en escenario conservador.
2. Vale con renovación confirmada calcula solo interés/gastos/amortización.
3. Cierre de vale calcula capital + interés + gastos.
4. Cuenta por cobrar pendiente no suma a caja libre.
5. Simulador de retiro rechaza retiro que deja caja negativa.
6. Renovación crea nuevo período y mantiene historial.
7. Cierre deja capital pendiente en cero.
```

---

## Casos de prueba concretos

### Caso 1: vale con cierre

```text
Saldo banco: USD 7.500
Vale capital: USD 5.000
Interés: USD 180
Gastos: USD 0
Acción: CLOSE
Colchón: USD 1.000

Salida por vale: USD 5.180
Caja libre conservadora: USD 1.320
Caja libre planificada: USD 1.320
```

---

### Caso 2: vale con renovación confirmada

```text
Saldo banco: USD 7.500
Vale capital: USD 5.000
Interés: USD 180
Gastos: USD 0
Acción: RENEW
Renovación confirmada: sí
Nuevo vencimiento: 25/07/2026
Colchón: USD 1.000

Salida por vale en vencimiento actual: USD 180
Capital pendiente después: USD 5.000
Caja libre conservadora: USD 6.320
Caja libre planificada: USD 6.320
```

---

### Caso 3: renovación planificada pero no confirmada

```text
Saldo banco: USD 7.500
Vale capital: USD 5.000
Interés: USD 180
Acción: RENEW
Renovación confirmada: no
Colchón: USD 1.000

Salida planificada: USD 180
Salida conservadora: USD 5.180

Caja libre planificada: USD 6.320
Caja libre conservadora: USD 1.320

Alerta:
Renovación no confirmada. No contar con caja planificada hasta confirmar con banco.
```

---

### Caso 4: cuenta por cobrar confirmada

```text
Saldo banco: USD 7.500
Cobro confirmado próximo: USD 3.000
Sin marcar como cobrado.

Caja libre actual:
No suma esos USD 3.000.

Proyección:
Puede aparecer como entrada futura.
```

---

### Caso 5: cierre total de vale

```text
Vale activo:
Capital pendiente: USD 5.000

Registrar cierre:
Capital pagado: USD 5.000
Interés pagado: USD 180
Gastos: USD 0

Resultado:
Vale.status = CLOSED
Vale.currentPrincipal = 0
ValeTerm.status = CLOSED
ValeEvent tipo CLOSED creado
```

---

### Caso 6: renovación con amortización parcial

```text
Vale activo:
Capital pendiente: USD 5.000
Interés: USD 180

Registrar renovación:
Interés pagado: USD 180
Amortización parcial: USD 1.000
Nuevo vencimiento: 25/07/2026

Resultado:
Sale de caja: USD 1.180
Nuevo capital pendiente: USD 4.000
ValeTerm anterior = RENEWED
Nuevo ValeTerm creado con principal USD 4.000
```

---

## Definition of Done

El módulo se considera funcional para MVP si:

```text
1. Puedo crear una cuenta bancaria y actualizar su saldo manualmente.
2. Puedo crear un vale con capital, interés y vencimiento.
3. Puedo marcar un vale como renovación confirmada.
4. Puedo registrar la renovación pagando intereses y creando nuevo vencimiento.
5. Puedo registrar el cierre devolviendo capital + interés.
6. Puedo ver historial completo de períodos/eventos de cada vale.
7. Puedo cargar cuentas por cobrar.
8. El dashboard muestra saldo, comprometido, caja libre conservadora y caja libre planificada.
9. El dashboard no cuenta cuentas por cobrar como caja disponible.
10. El sistema alerta cuando hay vencimientos cercanos o renovación no confirmada.
11. El simulador indica si puedo retirar/gastar plata sin romper la caja.
12. Hay tests unitarios para los cálculos financieros.
```

---

## Prioridades reales

Implementar en este orden:

| Prioridad | Feature | Motivo |
|---:|---|---|
| 1 | Modelo de vales con períodos/eventos | Es el corazón del módulo |
| 2 | Cálculo de salida por cierre/renovación | Evita errores graves |
| 3 | Dashboard de caja libre | Decisión diaria |
| 4 | Registro de renovaciones/cierres | Historial y control |
| 5 | Por cobrar | Proyección de caja |
| 6 | Simulador de retiro | Freno antes de tocar plata |
| 7 | Alertas | Anticipación |
| 8 | CSV/Gmail/OCR | Después |

---

## Cosas a evitar

```text
- No hacer integración bancaria automática en el MVP.
- No depender de IA para decidir caja disponible.
- No mezclar cuentas por cobrar con caja real.
- No borrar historial de vales.
- No usar floats para dinero.
- No ocultar el escenario conservador.
- No asumir que "renovar" es lo mismo que "cerrar".
- No modelar cada renovación como un vale aislado sin relación histórica.
```

---

## Nota para Codex

Implementar con criterio incremental.  
Primero hacer que el cálculo sea correcto y testeable.  
Después hacer UI.  
La estética es secundaria frente a evitar errores de caja.

La regla que debe guiar todo el módulo:

```text
Más vale mostrar "NO TOCAR" de más, que permitir retirar plata y quedar corto para un vale.
```
