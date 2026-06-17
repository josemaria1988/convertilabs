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
