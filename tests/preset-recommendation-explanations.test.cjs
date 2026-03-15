/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildPresetRecommendation,
} = require("@/modules/accounting/presets/recommendation-engine");

test("preset recommendation composes a Rontil-like profile without hardcoding a tenant preset", () => {
  const result = buildPresetRecommendation({
    primaryActivityCode: "46590",
    secondaryActivityCodes: ["33120"],
    selectedTraits: [
      "imports_goods",
      "sells_goods",
      "provides_services",
      "maintains_inventory",
      "technical_installation_or_maintenance",
      "multi_currency_operations",
    ],
    shortDescription: "Importamos equipos, vendemos repuestos y hacemos instalacion y mantenimiento.",
  });

  assert.equal(result.recommended.basePresetCode, "UY_BASE_SA_GENERAL_V1");
  assert.ok(result.recommended.overlayCodes.includes("CIIU_46_WHOLESALE_EQUIPMENT_V1"));
  assert.ok(result.recommended.overlayCodes.includes("CIIU_33_REPAIR_INSTALLATION_V1"));
  assert.ok(result.recommended.overlayCodes.includes("TRAIT_IMPORTER_V1"));
  assert.ok(result.recommended.overlayCodes.includes("TRAIT_MULTI_CURRENCY_V1"));
  assert.match(result.recommended.label, /Importador|Comercio|Servicios/i);
});

test("preset recommendation always returns a human explanation", () => {
  const result = buildPresetRecommendation({
    primaryActivityCode: "47110",
    secondaryActivityCodes: [],
    selectedTraits: ["vat_taxed_operations", "sells_goods"],
    shortDescription: "Tienda minorista con ventas locales.",
  });

  assert.ok(result.explanation.title.length > 0);
  assert.ok(result.explanation.summary.length > 0);
  assert.ok(result.explanation.reasons.length > 0);
  assert.ok(result.explanation.impacts.length > 0);
  assert.ok(result.explanation.whatCanYouDo.length > 0);
  assert.ok(result.alternatives.length <= 2);
});
