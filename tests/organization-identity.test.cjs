/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildOrganizationIdentityProfile,
  buildOrganizationIdentityPromptContext,
  matchOrganizationIdentity,
} = require("@/modules/accounting/organization-identity");

test("organization identity normalizes RUT and matches exact aliases", () => {
  const identity = buildOrganizationIdentityProfile({
    organizationId: "org-1",
    legalName: "Rontil SAS",
    taxId: "21-433.455/019",
    aliases: ["Rontil", "Rontil Trading"],
  });

  const taxIdMatch = matchOrganizationIdentity({
    identity,
    partyName: "Proveedor cualquiera",
    partyTaxId: "21433455019",
  });
  const aliasMatch = matchOrganizationIdentity({
    identity,
    partyName: "RONTIL",
    partyTaxId: null,
  });

  assert.equal(identity.taxIdNormalized, "21433455019");
  assert.equal(taxIdMatch.status, "matched");
  assert.equal(taxIdMatch.strategy, "tax_id");
  assert.equal(aliasMatch.status, "matched");
  assert.equal(aliasMatch.strategy, "exact_alias");
  assert.equal(aliasMatch.matchedAlias, "Rontil");
});

test("organization identity returns tentative token overlap matches and blocks conflicting tax ids", () => {
  const identity = buildOrganizationIdentityProfile({
    organizationId: "org-1",
    legalName: "Rontil SAS",
    taxId: "21433455019",
    aliases: ["Rontil Trading"],
  });

  const tentativeMatch = matchOrganizationIdentity({
    identity,
    partyName: "Trading Rontil",
    partyTaxId: null,
  });
  const conflictingTaxId = matchOrganizationIdentity({
    identity,
    partyName: "Rontil Trading",
    partyTaxId: "21999999001",
  });
  const promptContext = buildOrganizationIdentityPromptContext(identity);

  assert.equal(tentativeMatch.status, "tentative");
  assert.equal(tentativeMatch.strategy, "token_overlap");
  assert.equal(conflictingTaxId.status, "not_matched");
  assert.match(promptContext, /21433455019/);
  assert.match(promptContext, /Rontil Trading/);
});
