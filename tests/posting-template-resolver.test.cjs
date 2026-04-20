/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolvePostingTemplatePreview,
} = require("@/modules/accounting/posting-template-resolver");
const {
  getAccountRoleDefinition,
} = require("@/modules/accounting/account-roles");

function account(overrides = {}) {
  return {
    id: overrides.id || "acct",
    organization_id: "org-1",
    code: overrides.code || overrides.external_code || "1.1.1",
    name: overrides.name || "Cuenta",
    account_type: overrides.account_type || "asset",
    normal_side: overrides.normal_side || "debit",
    is_postable: true,
    is_provisional: false,
    source: "provider_mirror",
    external_code: overrides.external_code || overrides.code || "1.1.1",
    metadata: {},
    provider_managed: true,
    source_provider: "zetasoftware",
    is_imputable: true,
    literal_tributario: overrides.literal_tributario ?? null,
    provider_meta_json: {},
    ...overrides,
  };
}

function mapping(roleCode, mappedAccount) {
  return {
    bindingId: `bind-${roleCode}`,
    organizationId: "org-1",
    accountRoleCode: roleCode,
    role: getAccountRoleDefinition(roleCode),
    account: mappedAccount,
    source: "manual",
    confidence: null,
    notes: null,
    warnings: [],
    updatedAt: null,
  };
}

function baseAccounts() {
  return {
    expense: account({
      id: "acct-expense",
      code: "5.2.1",
      external_code: "5.2.1",
      name: "Gastos administrativos",
      account_type: "expense",
    }),
    vatPurchase: account({
      id: "acct-vat-purchase",
      code: "1.1.9",
      external_code: "1.1.9",
      name: "IVA compras",
      account_type: "asset",
      literal_tributario: 11,
    }),
    payable: account({
      id: "acct-payable",
      code: "2.1.1",
      external_code: "2.1.1",
      name: "Proveedores",
      account_type: "liability",
      normal_side: "credit",
    }),
    partner: account({
      id: "acct-partner",
      code: "2.2.5",
      external_code: "2.2.5",
      name: "Cuenta a reintegrar a socio",
      account_type: "liability",
      normal_side: "credit",
    }),
    receivable: account({
      id: "acct-receivable",
      code: "1.1.2",
      external_code: "1.1.2",
      name: "Clientes",
      account_type: "asset",
    }),
    sales: account({
      id: "acct-sales",
      code: "4.1.1",
      external_code: "4.1.1",
      name: "Ventas plaza",
      account_type: "revenue",
      normal_side: "credit",
    }),
    vatSales: account({
      id: "acct-vat-sales",
      code: "2.1.9",
      external_code: "2.1.9",
      name: "IVA ventas",
      account_type: "liability",
      normal_side: "credit",
    }),
  };
}

function purchaseMappings(accounts = baseAccounts()) {
  return [
    mapping("purchase_expense_default", accounts.expense),
    mapping("vat_purchase_basic", accounts.vatPurchase),
    mapping("accounts_payable", accounts.payable),
    mapping("partner_reimbursement_payable", accounts.partner),
  ];
}

test("purchase expense credit with complete mappings produces balanced preview", async () => {
  const accounts = baseAccounts();
  const preview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-1",
    candidateTemplateCode: "purchase_expense_credit.v1",
    facts: {
      documentRole: "purchase",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      currencyCode: "UYU",
      vatRate: 22,
    },
    roleMappings: purchaseMappings(accounts),
    accounts: Object.values(accounts),
  });

  assert.equal(preview.isBalanced, true);
  assert.equal(preview.mode, "assisted");
  assert.deepEqual(preview.lines.map((line) => line.debitCredit), ["debit", "debit", "credit"]);
  assert.deepEqual(preview.lines.map((line) => line.amount), [100, 22, 122]);
});

test("purchase paid by partner credits partner reimbursement payable", async () => {
  const accounts = baseAccounts();
  const preview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-2",
    candidateTemplateCode: "purchase_expense_paid_by_partner.v1",
    facts: {
      documentRole: "purchase",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      vatRate: 22,
    },
    roleMappings: purchaseMappings(accounts),
    accounts: Object.values(accounts),
  });
  const creditLine = preview.lines.find((line) => line.debitCredit === "credit");

  assert.equal(creditLine.accountRoleCode, "partner_reimbursement_payable");
  assert.equal(creditLine.chartAccountId, "acct-partner");
  assert.equal(preview.lines.some((line) => line.accountRoleCode === "accounts_payable"), false);
});

test("missing critical role produces blocker", async () => {
  const accounts = baseAccounts();
  const preview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-3",
    candidateTemplateCode: "purchase_expense_credit.v1",
    facts: {
      documentRole: "purchase",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      vatRate: 22,
    },
    roleMappings: purchaseMappings(accounts).filter(
      (entry) => entry.accountRoleCode !== "accounts_payable",
    ),
    accounts: Object.values(accounts),
  });

  assert.equal(preview.mode, "blocked");
  assert.match(preview.blockers.map((blocker) => blocker.code).join(" "), /accounts_payable/);
});

test("non imputable account cannot resolve role", async () => {
  const accounts = baseAccounts();
  const badVat = account({
    ...accounts.vatPurchase,
    is_imputable: false,
  });
  const preview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-4",
    candidateTemplateCode: "purchase_expense_credit.v1",
    facts: {
      documentRole: "purchase",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      vatRate: 22,
    },
    roleMappings: [
      mapping("purchase_expense_default", accounts.expense),
      mapping("vat_purchase_basic", badVat),
      mapping("accounts_payable", accounts.payable),
    ],
    accounts: [...Object.values(accounts), badVat],
  });

  assert.equal(preview.mode, "blocked");
  assert.match(preview.blockers.map((blocker) => blocker.code).join(" "), /role_account_not_imputable/);
});

test("Zeta concept account wins as document primary account", async () => {
  const accounts = baseAccounts();
  const conceptAccount = account({
    id: "acct-concept",
    code: "5.9.9",
    external_code: "5.9.9",
    name: "Gasto heredado desde concepto Zeta",
    account_type: "expense",
  });
  const preview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-5",
    candidateTemplateCode: "purchase_expense_credit.v1",
    facts: {
      documentRole: "purchase",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      vatRate: 22,
      zetaConceptAccountExternalCode: "5.9.9",
    },
    roleMappings: purchaseMappings(accounts),
    accounts: [...Object.values(accounts), conceptAccount],
  });
  const mainLine = preview.lines.find((line) => line.lineKey === "purchase_net");

  assert.equal(mainLine.chartAccountId, "acct-concept");
  assert.equal(
    preview.roleResolutions.find((resolution) => resolution.accountRoleCode === "purchase_expense_default").source,
    "concept_zeta",
  );
});

test("basic VAT uses purchase and sales VAT roles by direction", async () => {
  const accounts = baseAccounts();
  const purchasePreview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-purchase",
    candidateTemplateCode: "purchase_expense_credit.v1",
    facts: {
      documentRole: "purchase",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      vatRate: 22,
    },
    roleMappings: purchaseMappings(accounts),
    accounts: Object.values(accounts),
  });
  const salePreview = await resolvePostingTemplatePreview({
    organizationId: "org-1",
    documentId: "doc-sale",
    candidateTemplateCode: "sale_local_credit.v1",
    facts: {
      documentRole: "sale",
      netAmount: 100,
      vatAmount: 22,
      grossTotal: 122,
      vatRate: 22,
    },
    roleMappings: [
      mapping("accounts_receivable", accounts.receivable),
      mapping("sales_local", accounts.sales),
      mapping("vat_sales_basic", accounts.vatSales),
    ],
    accounts: Object.values(accounts),
  });

  assert.ok(purchasePreview.lines.some((line) => line.accountRoleCode === "vat_purchase_basic"));
  assert.ok(salePreview.lines.some((line) => line.accountRoleCode === "vat_sales_basic"));
});
