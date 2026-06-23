/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildCompanyHomeDashboard,
} = require("@/modules/presentation/company-home");

test("company home dashboard prioritizes real blockers and overdue money", () => {
  const dashboard = buildCompanyHomeDashboard({
    organizationSlug: "rontil",
    documents: [
      {
        id: "doc-1",
        label: "Factura proveedor",
        href: "/app/o/rontil/documents/doc-1",
        createdAt: "2026-06-17T10:00:00Z",
        bucket: "blocked",
        blockingReason: "Falta FX",
        nextActionLabel: "Resolver",
      },
      {
        id: "doc-2",
        label: "Venta cliente",
        href: "/app/o/rontil/documents/doc-2",
        createdAt: "2026-06-16T10:00:00Z",
        bucket: "review",
        blockingReason: null,
        nextActionLabel: "Revisar",
      },
    ],
    work: {
      isAvailable: true,
      totalCount: 1,
      recent: [
        {
          id: "work-1",
          name: "Nueva Palmira",
          status: "active",
          kind: "job",
          actualRevenue: 1000,
          actualCost: 650,
          marginStatus: "healthy",
          updatedAt: "2026-06-17T12:00:00Z",
        },
      ],
    },
    directory: {
      isAvailable: true,
      totalCount: 2,
      recent: [],
    },
    money: {
      isAvailable: true,
      totalCount: 1,
      recent: [
        {
          id: "item-1",
          counterpartyName: "Cliente SA",
          documentRole: "sale",
          dueDate: "2026-06-10",
          daysOverdue: 7,
          outstandingAmount: 1220,
          status: "open",
          sourceDocumentId: "doc-2",
        },
      ],
    },
  });

  assert.equal(dashboard.summary.blockedDocuments, 1);
  assert.equal(dashboard.summary.overdueMoneyItems, 1);
  assert.deepEqual(
    dashboard.actions.map((action) => action.key),
    ["blocked_documents", "review_documents", "overdue_money"],
  );
  assert.equal(
    dashboard.metrics.find((metric) => metric.key === "money").tone,
    "warning",
  );
});

test("company home dashboard keeps empty states honest", () => {
  const dashboard = buildCompanyHomeDashboard({
    organizationSlug: "rontil",
    documents: [],
    work: {
      isAvailable: true,
      totalCount: 0,
      recent: [],
    },
    directory: {
      isAvailable: true,
      totalCount: 0,
      recent: [],
    },
    money: {
      isAvailable: false,
      totalCount: 0,
      recent: [],
    },
  });

  assert.deepEqual(dashboard.actions.map((action) => action.key), ["first_work"]);
  assert.equal(dashboard.metrics.find((metric) => metric.key === "money").value, "--");
  assert.equal(dashboard.availability.money, false);
  assert.equal(dashboard.summary.actionableDocuments, 0);
});

test("company home dashboard surfaces pending work intake", () => {
  const dashboard = buildCompanyHomeDashboard({
    organizationSlug: "rontil",
    documents: [],
    work: {
      isAvailable: true,
      totalCount: 1,
      recent: [],
    },
    directory: {
      isAvailable: true,
      totalCount: 0,
      recent: [],
    },
    intake: {
      isAvailable: true,
      totalCount: 2,
      recent: [
        {
          id: "intake-1",
          title: "Nueva Palmira",
          status: "needs_review",
          sourceType: "web_form",
          partyId: null,
          workUnitId: null,
          dueDate: "2026-06-24",
          createdAt: "2026-06-23T10:00:00Z",
          nextAction: "Revisar",
        },
        {
          id: "intake-2",
          title: "Solicitud ya convertida",
          status: "converted_to_work",
          sourceType: "email",
          partyId: "party-1",
          workUnitId: "work-1",
          dueDate: null,
          createdAt: "2026-06-23T09:00:00Z",
          nextAction: null,
        },
      ],
    },
    money: {
      isAvailable: true,
      totalCount: 0,
      recent: [],
    },
  });

  assert.equal(dashboard.summary.openWorkIntakeItems, 1);
  assert.equal(dashboard.summary.workIntakeNeedsReview, 1);
  assert.equal(dashboard.summary.workIntakeWithoutParty, 1);
  assert.equal(dashboard.metrics.find((metric) => metric.key === "intake").tone, "info");
  assert.deepEqual(
    dashboard.actions.map((action) => action.key),
    ["work_intake_review", "work_intake_without_party", "load_document"],
  );
});

test("company home dashboard uses treasury signal when available", () => {
  const dashboard = buildCompanyHomeDashboard({
    organizationSlug: "rontil",
    documents: [],
    work: {
      isAvailable: true,
      totalCount: 1,
      recent: [],
    },
    directory: {
      isAvailable: true,
      totalCount: 0,
      recent: [],
    },
    money: {
      isAvailable: true,
      totalCount: 1,
      recent: [
        {
          id: "item-1",
          counterpartyName: "Cliente SA",
          documentRole: "sale",
          dueDate: "2026-06-20",
          daysOverdue: 0,
          outstandingAmount: 1000,
          status: "open",
          sourceDocumentId: null,
        },
      ],
    },
    treasury: {
      isAvailable: true,
      currencyCode: "USD",
      conservativeAvailableCash: -120,
      alertCount: 2,
      criticalAlertCount: 1,
    },
  });
  const moneyMetric = dashboard.metrics.find((metric) => metric.key === "money");

  assert.equal(moneyMetric.label, "Caja libre conservadora");
  assert.equal(moneyMetric.tone, "danger");
  assert.equal(dashboard.availability.treasury, true);
  assert.equal(dashboard.summary.treasuryCriticalAlertCount, 1);
  assert.equal(dashboard.actions[0].key, "treasury_alerts");
});
