/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  POSTING_TEMPLATE_CATALOG,
  getPostingTemplateDefinition,
} = require("@/modules/accounting/posting-template-catalog");

function lineKeys(templateCode) {
  return getPostingTemplateDefinition(templateCode).lines.map((line) => ({
    debitCredit: line.debitCredit,
    accountRoleCode: line.accountRoleCode,
    amountSource: line.amountSource,
  }));
}

test("posting template catalog has unique codes", () => {
  const codes = POSTING_TEMPLATE_CATALOG.map((template) => template.code);

  assert.equal(new Set(codes).size, codes.length);
});

test("posting templates are versioned and have material lines", () => {
  for (const template of POSTING_TEMPLATE_CATALOG) {
    assert.ok(template.version);
    assert.ok(template.lines.length >= 2, `${template.code} needs at least two lines`);
    assert.ok(template.requiredRoleCodes.length > 0, `${template.code} needs required roles`);
  }
});

test("purchase credit template has expense, VAT and payable legs", () => {
  const lines = lineKeys("purchase_expense_credit.v1");

  assert.deepEqual(lines, [
    {
      debitCredit: "debit",
      accountRoleCode: "document_primary_account",
      amountSource: "net_amount",
    },
    {
      debitCredit: "debit",
      accountRoleCode: "tax_role_by_rate",
      amountSource: "vat_amount",
    },
    {
      debitCredit: "credit",
      accountRoleCode: "accounts_payable",
      amountSource: "gross_total",
    },
  ]);
});

test("sale credit template has receivable, sales and VAT legs", () => {
  const lines = lineKeys("sale_local_credit.v1");

  assert.deepEqual(lines, [
    {
      debitCredit: "debit",
      accountRoleCode: "accounts_receivable",
      amountSource: "gross_total",
    },
    {
      debitCredit: "credit",
      accountRoleCode: "sales_local",
      amountSource: "net_amount",
    },
    {
      debitCredit: "credit",
      accountRoleCode: "tax_role_by_rate",
      amountSource: "vat_amount",
    },
  ]);
});

test("purchase paid by partner uses reimbursement payable and not provider, cash or bank", () => {
  const template = getPostingTemplateDefinition("purchase_expense_paid_by_partner.v1");
  const roles = template.lines.map((line) => line.accountRoleCode);

  assert.ok(roles.includes("partner_reimbursement_payable"));
  assert.equal(roles.includes("accounts_payable"), false);
  assert.equal(roles.includes("cash_uyu"), false);
  assert.equal(roles.includes("bank_uyu"), false);
});
