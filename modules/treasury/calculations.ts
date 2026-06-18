import type {
  TreasuryAlert,
  TreasuryCashPositionInput,
  TreasuryCashPositionResult,
  TreasuryProjectionEvent,
  TreasuryProjectionInput,
  TreasuryProjectionScenario,
  TreasuryRiskLevel,
  TreasuryValeTermCashImpact,
  TreasuryValeTermInput,
  TreasuryWithdrawalSimulation,
} from "@/modules/treasury/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ZERO_MINOR = BigInt(0);

function assertNonNegative(value: bigint, label: string) {
  if (value < ZERO_MINOR) {
    throw new Error(`${label} no puede ser negativo.`);
  }
}

export function compareIsoDates(left: string, right: string) {
  return left.localeCompare(right);
}

export function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetweenIso(start: string, end: string) {
  const startDate = Date.parse(`${start}T00:00:00.000Z`);
  const endDate = Date.parse(`${end}T00:00:00.000Z`);

  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) {
    return 0;
  }

  return Math.round((endDate - startDate) / DAY_MS);
}

export function isWithinHorizon(date: string, today: string, horizonDays: number) {
  return compareIsoDates(date, today) >= 0
    && compareIsoDates(date, addDaysIso(today, horizonDays)) <= 0;
}

export function calculateValeTermCashImpact(
  term: TreasuryValeTermInput,
): TreasuryValeTermCashImpact {
  assertNonNegative(term.principalAmountMinor, "Capital");
  assertNonNegative(term.expectedInterestAmountMinor, "Interes");
  assertNonNegative(term.expectedFeesAmountMinor, "Gastos");
  assertNonNegative(term.expectedPartialPrincipalPaymentMinor, "Amortizacion parcial");

  const interestAndFees =
    term.expectedInterestAmountMinor + term.expectedFeesAmountMinor;
  const renewalOutflow =
    interestAndFees + term.expectedPartialPrincipalPaymentMinor;
  const closeOutflow = term.principalAmountMinor + interestAndFees;

  if (term.plannedAction === "close") {
    return {
      plannedOutflowMinor: closeOutflow,
      conservativeOutflowMinor: closeOutflow,
      closeOutflowMinor: closeOutflow,
      renewalOutflowMinor: renewalOutflow,
      explanation: "El vale esta planificado para cierre: se considera capital, interes y gastos.",
    };
  }

  if (term.plannedAction === "renew" && term.renewalConfirmed) {
    return {
      plannedOutflowMinor: renewalOutflow,
      conservativeOutflowMinor: renewalOutflow,
      closeOutflowMinor: closeOutflow,
      renewalOutflowMinor: renewalOutflow,
      explanation: "La renovacion esta confirmada: se considera interes, gastos y amortizacion parcial.",
    };
  }

  if (term.plannedAction === "renew" && !term.renewalConfirmed) {
    return {
      plannedOutflowMinor: renewalOutflow,
      conservativeOutflowMinor: closeOutflow,
      closeOutflowMinor: closeOutflow,
      renewalOutflowMinor: renewalOutflow,
      explanation: "La renovacion esta planificada pero no confirmada: planificado usa renovacion y conservador asume cierre.",
    };
  }

  return {
    plannedOutflowMinor: closeOutflow,
    conservativeOutflowMinor: closeOutflow,
    closeOutflowMinor: closeOutflow,
    renewalOutflowMinor: renewalOutflow,
    explanation: "No hay accion definida: por prudencia se asume cierre del vale.",
  };
}

export function calculateCashPosition(
  input: TreasuryCashPositionInput,
): TreasuryCashPositionResult {
  assertNonNegative(input.plannedObligationsMinor, "Obligaciones planificadas");
  assertNonNegative(input.conservativeObligationsMinor, "Obligaciones conservadoras");
  assertNonNegative(input.unavoidablePaymentsMinor, "Pagos inevitables");
  assertNonNegative(input.minBufferMinor, "Colchon minimo");

  const plannedCommittedMinor =
    input.plannedObligationsMinor + input.unavoidablePaymentsMinor;
  const conservativeCommittedMinor =
    input.conservativeObligationsMinor + input.unavoidablePaymentsMinor;
  const plannedAvailableCashMinor =
    input.bankBalanceMinor - plannedCommittedMinor - input.minBufferMinor;
  const conservativeAvailableCashMinor =
    input.bankBalanceMinor - conservativeCommittedMinor - input.minBufferMinor;

  let status: TreasuryCashPositionResult["status"];
  let message: string;

  if (conservativeAvailableCashMinor < -input.minBufferMinor) {
    status = "CRITICAL";
    message = "No tocar. La caja libre conservadora esta muy por debajo de cero.";
  } else if (conservativeAvailableCashMinor < ZERO_MINOR) {
    status = "RED";
    message = "No tocar. La caja libre conservadora es negativa.";
  } else if (conservativeAvailableCashMinor < input.minBufferMinor) {
    status = "YELLOW";
    message = "Caja ajustada. Evitar retiros y gastos no urgentes.";
  } else {
    status = "GREEN";
    message = "Hay caja libre conservadora positiva manteniendo obligaciones y colchon.";
  }

  return {
    currencyCode: input.currencyCode,
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

export function simulateWithdrawal(params: {
  conservativeAvailableCashMinor: bigint;
  withdrawalAmountMinor: bigint;
}): TreasuryWithdrawalSimulation {
  assertNonNegative(params.withdrawalAmountMinor, "Retiro");

  const afterWithdrawalMinor =
    params.conservativeAvailableCashMinor - params.withdrawalAmountMinor;

  if (afterWithdrawalMinor < ZERO_MINOR) {
    return {
      allowed: false,
      risk: "HIGH",
      afterWithdrawalMinor,
      message: "No recomendado. Despues del retiro la caja libre conservadora queda negativa.",
    };
  }

  if (afterWithdrawalMinor === ZERO_MINOR) {
    return {
      allowed: true,
      risk: "MEDIUM",
      afterWithdrawalMinor,
      message: "Permitido solo si es inevitable. La caja libre queda en cero.",
    };
  }

  return {
    allowed: true,
    risk: "LOW",
    afterWithdrawalMinor,
    message: "Permitido con cuidado. La caja libre conservadora sigue positiva.",
  };
}

function projectionRiskLevel(balanceMinor: bigint): TreasuryRiskLevel {
  if (balanceMinor < ZERO_MINOR) {
    return "critical";
  }

  if (balanceMinor === ZERO_MINOR) {
    return "high";
  }

  return "low";
}

function shouldIncludeReceivable(
  receivable: TreasuryProjectionInput["receivables"][number],
  scenario: TreasuryProjectionScenario,
) {
  if (receivable.status !== "pending") {
    return false;
  }

  if (scenario === "conservative") {
    return receivable.confidence === "confirmed" && receivable.includeInConservative === true;
  }

  return receivable.confidence === "confirmed" || receivable.confidence === "probable";
}

function eventSort(left: Omit<TreasuryProjectionEvent, "projectedBalanceMinor">, right: Omit<TreasuryProjectionEvent, "projectedBalanceMinor">) {
  return left.date.localeCompare(right.date)
    || left.sourceType.localeCompare(right.sourceType)
    || left.label.localeCompare(right.label);
}

export function buildCashProjection(input: TreasuryProjectionInput): TreasuryProjectionEvent[] {
  const horizonEnd = addDaysIso(input.today, input.horizonDays);
  const currencies = new Set(input.startingBalances.map((balance) => balance.currencyCode));

  for (const term of input.valeTerms) {
    currencies.add(term.currencyCode);
  }

  for (const receivable of input.receivables) {
    currencies.add(receivable.currencyCode);
  }

  for (const payable of input.payables) {
    currencies.add(payable.currencyCode);
  }

  const output: TreasuryProjectionEvent[] = [];

  for (const scenario of ["conservative", "planned"] satisfies TreasuryProjectionScenario[]) {
    for (const currencyCode of currencies) {
      const startingBalance = input.startingBalances
        .filter((balance) => balance.currencyCode === currencyCode)
        .reduce((sum, balance) => sum + balance.amountMinor, ZERO_MINOR);
      const draftEvents: Array<Omit<TreasuryProjectionEvent, "projectedBalanceMinor">> = [{
        id: `${scenario}:${currencyCode}:initial`,
        date: input.today,
        label: "Saldo inicial",
        sourceType: "initial_balance",
        scenario,
        currencyCode,
        inflowMinor: startingBalance,
        outflowMinor: ZERO_MINOR,
        riskLevel: projectionRiskLevel(startingBalance),
      }];

      for (const term of input.valeTerms) {
        if (term.currencyCode !== currencyCode || !isWithinHorizon(term.dueDate, input.today, input.horizonDays)) {
          continue;
        }

        const impact = calculateValeTermCashImpact(term);
        const outflowMinor = scenario === "conservative"
          ? impact.conservativeOutflowMinor
          : impact.plannedOutflowMinor;

        draftEvents.push({
          id: `${scenario}:vale:${term.id}`,
          date: term.dueDate,
          label: scenario === "conservative" && impact.conservativeOutflowMinor === impact.closeOutflowMinor && term.plannedAction !== "close"
            ? "Cierre conservador de vale"
            : "Salida por vale",
          sourceType: "vale",
          scenario,
          currencyCode,
          inflowMinor: ZERO_MINOR,
          outflowMinor,
          riskLevel: "medium",
        });
      }

      for (const payable of input.payables) {
        if (
          payable.currencyCode !== currencyCode
          || compareIsoDates(payable.dueDate, input.today) < 0
          || compareIsoDates(payable.dueDate, horizonEnd) > 0
          || payable.status === "settled"
          || payable.status === "cancelled"
        ) {
          continue;
        }

        draftEvents.push({
          id: `${scenario}:payable:${payable.id}`,
          date: payable.dueDate,
          label: payable.label,
          sourceType: "payable",
          scenario,
          currencyCode,
          inflowMinor: ZERO_MINOR,
          outflowMinor: payable.amountMinor,
          riskLevel: "medium",
        });
      }

      for (const receivable of input.receivables) {
        if (
          receivable.currencyCode !== currencyCode
          || compareIsoDates(receivable.expectedDate, input.today) < 0
          || compareIsoDates(receivable.expectedDate, horizonEnd) > 0
          || !shouldIncludeReceivable(receivable, scenario)
        ) {
          continue;
        }

        draftEvents.push({
          id: `${scenario}:receivable:${receivable.id}`,
          date: receivable.expectedDate,
          label: receivable.label,
          sourceType: "receivable",
          scenario,
          currencyCode,
          inflowMinor: receivable.amountMinor,
          outflowMinor: ZERO_MINOR,
          riskLevel: receivable.confidence === "confirmed" ? "low" : "medium",
        });
      }

      let balanceMinor = ZERO_MINOR;

      for (const event of draftEvents.sort(eventSort)) {
        balanceMinor += event.inflowMinor - event.outflowMinor;
        output.push({
          ...event,
          projectedBalanceMinor: balanceMinor,
          riskLevel: event.riskLevel === "low"
            ? projectionRiskLevel(balanceMinor)
            : event.riskLevel,
        });
      }
    }
  }

  return output.sort((left, right) =>
    left.scenario.localeCompare(right.scenario)
    || left.currencyCode.localeCompare(right.currencyCode)
    || left.date.localeCompare(right.date));
}

export function evaluateTreasuryAlerts(input: {
  today: string;
  valeTerms: TreasuryValeTermInput[];
  conservativeAvailableByCurrency: Map<string, bigint>;
  minBufferByCurrency: Map<string, bigint>;
  receivables?: TreasuryProjectionInput["receivables"];
}): TreasuryAlert[] {
  const alerts: TreasuryAlert[] = [];

  for (const [currencyCode, availableMinor] of input.conservativeAvailableByCurrency.entries()) {
    const bufferMinor = input.minBufferByCurrency.get(currencyCode) ?? ZERO_MINOR;

    if (availableMinor < ZERO_MINOR) {
      alerts.push({
        key: `cash-negative:${currencyCode}`,
        title: `Caja libre conservadora negativa en ${currencyCode}`,
        message: "Hay saldo bancario aparente, pero queda comprometido por vencimientos y colchon.",
        riskLevel: "critical",
        dueDate: null,
      });
    } else if (availableMinor < bufferMinor) {
      alerts.push({
        key: `cash-buffer:${currencyCode}`,
        title: `Caja por debajo del colchon en ${currencyCode}`,
        message: "Evitar retiros hasta confirmar renovaciones, cobros o pagos.",
        riskLevel: "high",
        dueDate: null,
      });
    }
  }

  for (const term of input.valeTerms) {
    const daysUntilDue = daysBetweenIso(input.today, term.dueDate);
    const impact = calculateValeTermCashImpact(term);

    if (daysUntilDue < 0) {
      alerts.push({
        key: `vale-overdue:${term.id}`,
        title: "Vale vencido sin cierre o renovacion registrada",
        message: "Registrar renovacion o cierre para que la caja vuelva a reflejar el riesgo real.",
        riskLevel: "critical",
        dueDate: term.dueDate,
      });
      continue;
    }

    if (daysUntilDue <= 3) {
      alerts.push({
        key: `vale-72h:${term.id}`,
        title: "Vale vence en menos de 72 horas",
        message: "Confirmar con banco si se renueva o si hay que devolver capital e intereses.",
        riskLevel: impact.conservativeOutflowMinor > impact.plannedOutflowMinor ? "critical" : "high",
        dueDate: term.dueDate,
      });
    } else if (daysUntilDue <= 7) {
      alerts.push({
        key: `vale-7d:${term.id}`,
        title: "Vale vence en menos de 7 dias",
        message: term.plannedAction === "renew" && !term.renewalConfirmed
          ? "La renovacion esta planificada pero todavia no esta confirmada por el banco."
          : "Revisar caja disponible antes del vencimiento.",
        riskLevel: term.plannedAction === "renew" && !term.renewalConfirmed ? "high" : "medium",
        dueDate: term.dueDate,
      });
    }

    if (term.plannedAction === "renew" && !term.renewalConfirmed) {
      alerts.push({
        key: `renewal-unconfirmed:${term.id}`,
        title: "Renovacion planificada sin confirmacion",
        message: "No contar con la caja planificada hasta confirmar la renovacion con el banco.",
        riskLevel: "high",
        dueDate: term.dueDate,
      });
    }
  }

  for (const receivable of input.receivables ?? []) {
    if (receivable.status === "pending" && compareIsoDates(receivable.expectedDate, input.today) < 0) {
      alerts.push({
        key: `receivable-overdue:${receivable.id}`,
        title: "Cuenta por cobrar atrasada",
        message: `${receivable.label} estaba prevista para ${receivable.expectedDate}.`,
        riskLevel: receivable.confidence === "confirmed" ? "high" : "medium",
        dueDate: receivable.expectedDate,
      });
    }
  }

  return alerts.sort((left, right) => {
    const severity = { critical: 4, high: 3, medium: 2, low: 1 };

    return severity[right.riskLevel] - severity[left.riskLevel]
      || (left.dueDate ?? "9999-99-99").localeCompare(right.dueDate ?? "9999-99-99")
      || left.title.localeCompare(right.title);
  });
}
