export type CompanyHomeTone = "neutral" | "success" | "warning" | "danger" | "info";

export type CompanyHomeDocumentSignal = {
  id: string;
  label: string;
  href: string | null;
  createdAt: string | null;
  bucket: "processing" | "review" | "blocked" | "ready_to_post" | "done";
  blockingReason: string | null;
  nextActionLabel: string | null;
};

export type CompanyHomeWorkUnitSignal = {
  id: string;
  name: string;
  status: string;
  kind: string;
  actualRevenue: number;
  actualCost: number;
  marginStatus: string | null;
  updatedAt: string | null;
};

export type CompanyHomePartySignal = {
  id: string;
  displayName: string;
  status: string | null;
  source: string | null;
  updatedAt: string | null;
};

export type CompanyHomeIntakeSignal = {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  partyId: string | null;
  workUnitId: string | null;
  dueDate: string | null;
  createdAt: string | null;
  nextAction: string | null;
};

export type CompanyHomeMoneySignal = {
  id: string;
  counterpartyName: string | null;
  documentRole: string | null;
  dueDate: string | null;
  daysOverdue: number;
  outstandingAmount: number;
  status: string | null;
  sourceDocumentId: string | null;
};

export type CompanyHomeOperationsSignal = {
  isAvailable: boolean;
  totalTasks: number;
  blockedTasks: number;
  dueThisWeek: number;
  continuityRiskCount: number;
  rawCaptures: number;
  latestVatStatus: string | null;
  vatReviewFlags: number;
  vatTracedDocuments: number;
  latestCloseStatus: string | null;
  closeBlockers: number;
  closeWarnings: number;
};

export type CompanyHomeTreasurySignal = {
  isAvailable: boolean;
  currencyCode: string | null;
  conservativeAvailableCash: number;
  alertCount: number;
  criticalAlertCount: number;
};

export type CompanyHomePresenterInput = {
  organizationSlug: string;
  documents: CompanyHomeDocumentSignal[];
  work: {
    isAvailable: boolean;
    totalCount: number;
    recent: CompanyHomeWorkUnitSignal[];
  };
  directory: {
    isAvailable: boolean;
    totalCount: number;
    recent: CompanyHomePartySignal[];
  };
  intake?: {
    isAvailable: boolean;
    totalCount: number;
    recent: CompanyHomeIntakeSignal[];
  };
  money: {
    isAvailable: boolean;
    totalCount: number;
    recent: CompanyHomeMoneySignal[];
  };
  operations?: CompanyHomeOperationsSignal;
  treasury?: CompanyHomeTreasurySignal;
};

export type CompanyHomeMetricCard = {
  key: string;
  label: string;
  value: string;
  hint: string;
  href: string;
  cta: string;
  tone: CompanyHomeTone;
};

export type CompanyHomeAction = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: CompanyHomeTone;
};

export type CompanyHomeDashboard = {
  summary: {
    actionableDocuments: number;
    blockedDocuments: number;
    activeWorkUnits: number;
    openMoneyItems: number;
    overdueMoneyItems: number;
    outstandingAmount: number;
    treasuryAvailableCash: number | null;
    treasuryAlertCount: number;
    treasuryCriticalAlertCount: number;
    directoryParties: number;
    openWorkIntakeItems: number;
    workIntakeNeedsReview: number;
    workIntakeWithoutParty: number;
    openTasks: number;
    blockedTasks: number;
    continuityRisks: number;
    rawCaptures: number;
    vatReviewFlags: number;
    vatTracedDocuments: number;
    closeBlockers: number;
    closeWarnings: number;
  };
  metrics: CompanyHomeMetricCard[];
  actions: CompanyHomeAction[];
  documents: CompanyHomeDocumentSignal[];
  intakeItems: CompanyHomeIntakeSignal[];
  workUnits: CompanyHomeWorkUnitSignal[];
  parties: CompanyHomePartySignal[];
  moneyItems: CompanyHomeMoneySignal[];
  availability: {
    work: boolean;
    directory: boolean;
    money: boolean;
    intake: boolean;
    treasury: boolean;
    operations: boolean;
  };
};

function formatCount(value: number) {
  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoneyAmount(value: number, currencyCode = "UYU") {
  if (Math.abs(value) < 0.005) {
    return "$ 0";
  }

  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function isActiveWorkUnit(workUnit: CompanyHomeWorkUnitSignal) {
  return !["archived", "cancelled", "completed"].includes(workUnit.status);
}

function isOpenIntake(item: CompanyHomeIntakeSignal) {
  return !["converted_to_work", "won", "lost", "archived"].includes(item.status);
}

export function buildCompanyHomeDashboard(
  input: CompanyHomePresenterInput,
): CompanyHomeDashboard {
  const reviewDocuments = input.documents.filter((document) => document.bucket === "review");
  const blockedDocuments = input.documents.filter((document) => document.bucket === "blocked");
  const processingDocuments = input.documents.filter((document) => document.bucket === "processing");
  const actionableDocuments = input.documents.filter((document) => document.bucket !== "done");
  const activeWorkUnits = input.work.recent.filter(isActiveWorkUnit);
  const intake = input.intake ?? {
    isAvailable: false,
    totalCount: 0,
    recent: [],
  };
  const openIntakeItems = intake.recent.filter(isOpenIntake);
  const intakeNeedsReview = openIntakeItems.filter((item) =>
    ["captured", "needs_review"].includes(item.status));
  const intakeWithoutParty = openIntakeItems.filter((item) => !item.partyId);
  const overdueMoneyItems = input.money.recent.filter((item) => item.daysOverdue > 0);
  const outstandingAmount = input.money.recent.reduce(
    (sum, item) => sum + item.outstandingAmount,
    0,
  );
  const treasury = input.treasury ?? {
    isAvailable: false,
    currencyCode: null,
    conservativeAvailableCash: 0,
    alertCount: 0,
    criticalAlertCount: 0,
  };
  const hasTreasurySignal = treasury.isAvailable && Boolean(treasury.currencyCode);
  const operations = input.operations ?? {
    isAvailable: false,
    totalTasks: 0,
    blockedTasks: 0,
    dueThisWeek: 0,
    continuityRiskCount: 0,
    rawCaptures: 0,
    latestVatStatus: null,
    vatReviewFlags: 0,
    vatTracedDocuments: 0,
    latestCloseStatus: null,
    closeBlockers: 0,
    closeWarnings: 0,
  };
  const slug = input.organizationSlug;

  const metrics: CompanyHomeMetricCard[] = [
    {
      key: "intake",
      label: "Solicitudes",
      value: intake.isAvailable ? formatCount(openIntakeItems.length) : "--",
      hint: intake.isAvailable
        ? "Pedidos, cotizaciones y oportunidades pendientes de clasificar."
        : "La tabla work_intake_items no esta disponible.",
      href: `/app/o/${slug}/work#work-intake`,
      cta: "Abrir solicitudes",
      tone: intakeNeedsReview.length > 0
        ? "info"
        : intakeWithoutParty.length > 0
          ? "warning"
          : openIntakeItems.length > 0
            ? "success"
            : "neutral",
    },
    {
      key: "work",
      label: "Trabajos activos",
      value: input.work.isAvailable ? formatCount(input.work.totalCount) : "--",
      hint: input.work.isAvailable
        ? "Trabajos y centros de costo conectados al modelo madre."
        : "La tabla work_units no esta disponible en esta base.",
      href: `/app/o/${slug}/work`,
      cta: "Abrir trabajos",
      tone: input.work.totalCount > 0 ? "success" : "neutral",
    },
    {
      key: "documents",
      label: "Documentos accionables",
      value: formatCount(actionableDocuments.length),
      hint: "Procesando, en revision o bloqueados; no incluye documentos cerrados.",
      href: `/app/o/${slug}/documents`,
      cta: "Abrir documentos",
      tone: blockedDocuments.length > 0 ? "warning" : actionableDocuments.length > 0 ? "info" : "success",
    },
    {
      key: "money",
      label: hasTreasurySignal ? "Caja libre conservadora" : "Dinero pendiente",
      value: hasTreasurySignal
        ? formatMoneyAmount(treasury.conservativeAvailableCash, treasury.currencyCode ?? "UYU")
        : input.money.isAvailable
          ? formatMoneyAmount(outstandingAmount)
          : "--",
      hint: hasTreasurySignal
        ? "Saldo bancario menos vales, pagos inevitables y colchon operativo."
        : input.money.isAvailable
        ? "Suma visible de deudores y acreedores con saldo vivo."
        : "La vista de open items no esta disponible.",
      href: `/app/o/${slug}/money`,
      cta: "Abrir dinero",
      tone: hasTreasurySignal
        ? treasury.criticalAlertCount > 0 || treasury.conservativeAvailableCash < 0
          ? "danger"
          : treasury.alertCount > 0
            ? "warning"
            : "success"
        : overdueMoneyItems.length > 0
          ? "warning"
          : outstandingAmount > 0
            ? "info"
            : "neutral",
    },
    {
      key: "agenda",
      label: "Agenda operativa",
      value: operations.isAvailable ? formatCount(operations.totalTasks) : "--",
      hint: operations.isAvailable
        ? "Tareas abiertas y vencimientos operativos materializados."
        : "La tabla tasks no esta disponible en esta base.",
      href: `/app/o/${slug}/agenda`,
      cta: "Abrir agenda",
      tone: operations.blockedTasks > 0 || operations.continuityRiskCount > 0
        ? "warning"
        : operations.totalTasks > 0
          ? "info"
          : "neutral",
    },
    {
      key: "tax_close",
      label: "IVA y cierre",
      value: operations.isAvailable
        ? formatCount(operations.vatReviewFlags + operations.closeBlockers)
        : "--",
      hint: operations.isAvailable
        ? "Flags de IVA y blockers de cierre visibles fuera de /tax."
        : "Las senales fiscales todavia no estan disponibles.",
      href: `/app/o/${slug}/agenda`,
      cta: "Abrir agenda",
      tone: operations.closeBlockers > 0
        ? "warning"
        : operations.vatReviewFlags > 0
          ? "info"
          : "neutral",
    },
  ];

  const actions: CompanyHomeAction[] = [
    intakeNeedsReview.length > 0
      ? {
        key: "work_intake_review",
        title: `Revisar ${formatCount(intakeNeedsReview.length)} solicitud(es)`,
        description: "Hay pedidos o cotizaciones esperando cliente, trabajo o proxima accion.",
        href: `/app/o/${slug}/work#work-intake`,
        cta: "Abrir solicitudes",
        tone: "info",
      }
      : null,
    intakeWithoutParty.length > 0
      ? {
        key: "work_intake_without_party",
        title: `Asociar cliente en ${formatCount(intakeWithoutParty.length)} solicitud(es)`,
        description: "Hay entrada comercial sin party canonico. No conviene crear documentos ni ventas todavia.",
        href: `/app/o/${slug}/work#work-intake`,
        cta: "Resolver cliente",
        tone: "warning",
      }
      : null,
    hasTreasurySignal && treasury.alertCount > 0
      ? {
        key: "treasury_alerts",
        title: `Revisar ${formatCount(treasury.alertCount)} alerta(s) de tesoreria`,
        description: treasury.criticalAlertCount > 0
          ? "Hay caja libre o vencimientos en estado critico para revisar antes de mover fondos."
          : "Hay renovaciones, vencimientos o cobros que conviene confirmar.",
        href: `/app/o/${slug}/money`,
        cta: "Abrir dinero",
        tone: treasury.criticalAlertCount > 0 ? "danger" : "warning",
      }
      : null,
    blockedDocuments.length > 0
      ? {
        key: "blocked_documents",
        title: `Destrabar ${formatCount(blockedDocuments.length)} documento(s)`,
        description: "Hay comprobantes bloqueados por duplicado, FX, alcance o revision asistida.",
        href: `/app/o/${slug}/review`,
        cta: "Resolver bloqueos",
        tone: "warning",
      }
      : null,
    reviewDocuments.length > 0
      ? {
        key: "review_documents",
        title: `Revisar ${formatCount(reviewDocuments.length)} documento(s)`,
        description: "Requieren decision humana antes de avanzar a posting, IVA o cierre.",
        href: `/app/o/${slug}/review`,
        cta: "Abrir revision",
        tone: "info",
      }
      : null,
    overdueMoneyItems.length > 0
      ? {
        key: "overdue_money",
        title: `Mirar ${formatCount(overdueMoneyItems.length)} vencido(s)`,
        description: "Hay saldos vivos con fecha vencida en cuentas a cobrar o pagar.",
        href: `/app/o/${slug}/money?due=overdue`,
        cta: "Abrir vencidos",
        tone: "warning",
      }
      : null,
    operations.blockedTasks > 0
      ? {
        key: "blocked_tasks",
        title: `Destrabar ${formatCount(operations.blockedTasks)} tarea(s)`,
        description: "Hay tareas bloqueadas que pueden frenar trabajo, dinero o continuidad.",
        href: `/app/o/${slug}/agenda`,
        cta: "Abrir agenda",
        tone: "warning",
      }
      : null,
    operations.continuityRiskCount > 0
      ? {
        key: "continuity_risks",
        title: `Mirar ${formatCount(operations.continuityRiskCount)} riesgo(s) de continuidad`,
        description: "Hay procesos, obligaciones o conocimiento crudo que conviene documentar.",
        href: `/app/o/${slug}/continuity`,
        cta: "Abrir continuidad",
        tone: "warning",
      }
      : null,
    operations.vatReviewFlags > 0
      ? {
        key: "vat_review_flags",
        title: `Revisar ${formatCount(operations.vatReviewFlags)} flag(s) de IVA`,
        description: "Hay documentos trazados al ultimo VAT run con senales que requieren revision.",
        href: `/app/o/${slug}/tax`,
        cta: "Abrir tax",
        tone: "info",
      }
      : null,
    operations.closeBlockers > 0
      ? {
        key: "close_blockers",
        title: `Resolver ${formatCount(operations.closeBlockers)} blocker(s) de cierre`,
        description: "El ultimo validator de cierre dejo problemas accionables en tareas y cockpit.",
        href: `/app/o/${slug}/close`,
        cta: "Abrir cierre",
        tone: "warning",
      }
      : null,
    processingDocuments.length > 0
      ? {
        key: "processing_documents",
        title: `${formatCount(processingDocuments.length)} documento(s) en proceso`,
        description: "Conviene revisar si alguno quedo detenido antes de sumar mas carga.",
        href: `/app/o/${slug}/documents`,
        cta: "Ver documentos",
        tone: "neutral",
      }
      : null,
    input.work.isAvailable && input.work.totalCount === 0
      ? {
        key: "first_work",
        title: "Crear el primer trabajo",
        description: "Inicio necesita trabajos reales para conectar documentos, dinero y margen.",
        href: `/app/o/${slug}/work`,
        cta: "Abrir trabajos",
        tone: "neutral",
      }
      : null,
    actionableDocuments.length === 0 && input.work.totalCount > 0
      ? {
        key: "load_document",
        title: "Cargar o revisar actividad nueva",
        description: "No hay documentos accionables ahora mismo.",
        href: `/app/o/${slug}/documents#document-upload-panel`,
        cta: "Cargar documento",
        tone: "success",
      }
      : null,
  ].filter((action): action is CompanyHomeAction => Boolean(action));

  return {
    summary: {
      actionableDocuments: actionableDocuments.length,
      blockedDocuments: blockedDocuments.length,
      activeWorkUnits: activeWorkUnits.length,
      openMoneyItems: input.money.totalCount,
      overdueMoneyItems: overdueMoneyItems.length,
      outstandingAmount,
      treasuryAvailableCash: hasTreasurySignal ? treasury.conservativeAvailableCash : null,
      treasuryAlertCount: hasTreasurySignal ? treasury.alertCount : 0,
      treasuryCriticalAlertCount: hasTreasurySignal ? treasury.criticalAlertCount : 0,
      directoryParties: input.directory.totalCount,
      openWorkIntakeItems: openIntakeItems.length,
      workIntakeNeedsReview: intakeNeedsReview.length,
      workIntakeWithoutParty: intakeWithoutParty.length,
      openTasks: operations.totalTasks,
      blockedTasks: operations.blockedTasks,
      continuityRisks: operations.continuityRiskCount,
      rawCaptures: operations.rawCaptures,
      vatReviewFlags: operations.vatReviewFlags,
      vatTracedDocuments: operations.vatTracedDocuments,
      closeBlockers: operations.closeBlockers,
      closeWarnings: operations.closeWarnings,
    },
    metrics,
    actions,
    documents: input.documents.slice(0, 8),
    intakeItems: intake.recent.slice(0, 6),
    workUnits: input.work.recent.slice(0, 6),
    parties: input.directory.recent.slice(0, 6),
    moneyItems: input.money.recent.slice(0, 6),
    availability: {
      work: input.work.isAvailable,
      directory: input.directory.isAvailable,
      money: input.money.isAvailable,
      intake: intake.isAvailable,
      treasury: hasTreasurySignal,
      operations: operations.isAvailable,
    },
  };
}
