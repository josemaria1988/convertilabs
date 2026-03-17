/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  validateOrganizationOnboardingInput,
} = require("@/modules/organizations/onboarding-schema");

function buildBaseInput() {
  return {
    name: "Rontil SA",
    legalEntityType: "SAS",
    taxId: "218765430019",
    taxRegimeCode: "IRAE_GENERAL",
    vatRegime: "GENERAL",
    dgiGroup: "NO_CEDE",
    cfeStatus: "ELECTRONIC_ISSUER",
    primaryActivityCode: "46590",
    selectedTraits: ["imports_goods"],
    shortBusinessDescription: "Vendemos equipos y repuestos.",
    planSetupMode: "recommended",
    selectedPresetComposition: "UY_BASE_SA_GENERAL_V1__CIIU_46_WHOLESALE_EQUIPMENT_V1",
  };
}

test("onboarding validation accepts valid refined secondary activities", () => {
  const result = validateOrganizationOnboardingInput(
    {
      ...buildBaseInput(),
      secondaryActivityCodes: ["33120"],
    },
    { requireBusinessProfile: true },
  );

  assert.equal(result.success, true);
});

test("onboarding validation rejects secondary activities outside the official catalog", () => {
  const result = validateOrganizationOnboardingInput(
    {
      ...buildBaseInput(),
      secondaryActivityCodes: ["NO_EXISTE"],
    },
    { requireBusinessProfile: true },
  );

  assert.equal(result.success, false);
  assert.equal(
    result.errors.secondaryActivityCodes,
    "Las actividades secundarias deben ser subclases oficiales o casos especiales validos.",
  );
});
