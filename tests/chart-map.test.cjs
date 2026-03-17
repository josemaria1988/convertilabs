/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildChartMapTree,
  buildImpactGraph,
  listChartMapEvents,
} = require("@/modules/accounting/chart-map");

test("chart map event taxonomy exposes sale and purchase operational events", () => {
  const events = listChartMapEvents();

  assert.ok(events.some((event) => event.id === "sale_local_cash"));
  assert.ok(events.some((event) => event.id === "purchase_local_credit"));
  assert.ok(events.some((event) => event.id === "customer_collection"));
});

test("chart map tree keeps ancestors visible when a child matches the search", () => {
  const tree = buildChartMapTree({
    accounts: [
      {
        id: "a-root",
        code: "1",
        name: "Activo",
        accountType: "Activo",
        normalSide: "Debe",
        isPostable: false,
        isProvisional: false,
        isActive: true,
        parentId: null,
        parentCode: null,
        systemRole: null,
        source: "preset",
        externalCode: null,
        taxProfileHint: null,
        currencyPolicy: null,
        statementSection: null,
        functionTag: null,
        cashflowTag: null,
        usage: {
          childCount: 1,
          directRuleCount: 0,
          templateCount: 0,
          recentPostingCount: 0,
        },
        warnings: [],
      },
      {
        id: "a-child",
        code: "1101",
        name: "Caja principal",
        accountType: "Activo",
        normalSide: "Debe",
        isPostable: true,
        isProvisional: false,
        isActive: true,
        parentId: "a-root",
        parentCode: "1",
        systemRole: "cash_account",
        source: "preset",
        externalCode: "EXT-1101",
        taxProfileHint: null,
        currencyPolicy: null,
        statementSection: null,
        functionTag: null,
        cashflowTag: null,
        usage: {
          childCount: 0,
          directRuleCount: 2,
          templateCount: 1,
          recentPostingCount: 3,
        },
        warnings: [],
      },
    ],
    searchTerm: "caja",
    filter: "all",
    highlightedAccountIds: ["a-child"],
  });

  assert.equal(tree.length, 1);
  assert.equal(tree[0].code, "1");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].highlighted, true);
});

test("impact graph produces nodes, edges and warnings for provisional accounts", () => {
  const graph = buildImpactGraph({
    selectedEvent: {
      id: "sale_local_cash",
      label: "Venta local contado",
      description: "Venta con cobro inmediato.",
      documentRole: "sale",
      tags: ["venta"],
      matchingRuleCount: 1,
      impactedAccountCount: 1,
    },
    matchingRules: [
      {
        id: "rule-1",
        scope: "Proveedor + concepto",
        priority: 100,
        source: "manual",
        operationCategory: "taxed_basic_22",
        linkedOperationType: null,
        templateCode: "sale_local_cash",
        accountId: "acc-1",
        accountCode: "4101",
        accountName: "Ventas plaza",
      },
    ],
    impactedAccounts: [
      {
        id: "acc-1",
        code: "4101",
        name: "Ventas plaza",
        accountType: "Ingresos",
        normalSide: "Haber",
        isPostable: true,
        isProvisional: true,
        isActive: true,
        parentId: null,
        parentCode: null,
        systemRole: null,
        source: "spreadsheet_import",
        externalCode: null,
        taxProfileHint: "UY_VAT_SALE_BASIC",
        currencyPolicy: null,
        statementSection: null,
        functionTag: null,
        cashflowTag: null,
        usage: {
          childCount: 0,
          directRuleCount: 1,
          templateCount: 1,
          recentPostingCount: 4,
        },
        warnings: [
          {
            code: "provisional_account",
            severity: "warning",
            message: "Cuenta provisional.",
          },
        ],
      },
    ],
  });

  assert.ok(graph.nodes.some((node) => node.type === "event"));
  assert.ok(graph.nodes.some((node) => node.type === "rule"));
  assert.ok(graph.nodes.some((node) => node.type === "account"));
  assert.ok(graph.edges.some((edge) => edge.type === "impacts"));
  assert.ok(graph.warnings.some((warning) => warning.code === "provisional_accounts"));
});
