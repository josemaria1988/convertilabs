/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  ACCOUNT_ROLE_DEFINITIONS,
  ACCOUNT_ROLE_CODES,
  getAccountRoleDefinition,
  listZetaRoleMapDefinitions,
} = require("@/modules/accounting/account-roles");
const {
  POSTING_TEMPLATE_CATALOG,
} = require("@/modules/accounting/posting-template-catalog");

test("account role catalog has unique codes", () => {
  const unique = new Set(ACCOUNT_ROLE_CODES);

  assert.equal(unique.size, ACCOUNT_ROLE_CODES.length);
});

test("visible Zeta role map roles have search hints", () => {
  for (const role of listZetaRoleMapDefinitions()) {
    assert.ok(role.zetaSearchHints.length > 0, `${role.code} needs search hints`);
  }
});

test("template required roles exist in role catalog", () => {
  for (const template of POSTING_TEMPLATE_CATALOG) {
    for (const roleCode of template.requiredRoleCodes) {
      assert.ok(getAccountRoleDefinition(roleCode), `${template.code} references ${roleCode}`);
    }
  }
});

test("principal Zeta roles include partner reimbursement", () => {
  const partnerRole = ACCOUNT_ROLE_DEFINITIONS.find(
    (role) => role.code === "partner_reimbursement_payable",
  );

  assert.ok(partnerRole);
  assert.equal(partnerRole.normalBalance, "credit");
  assert.ok(partnerRole.zetaSearchHints.some((hint) => /socio|reintegr/i.test(hint)));
});
