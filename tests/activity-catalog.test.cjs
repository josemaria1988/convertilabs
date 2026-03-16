/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  getActivityByCode,
  getActivityChildren,
} = require("@/modules/organizations/activity-catalog");
const {
  searchActivities,
} = require("@/modules/organizations/activity-search");
const {
  buildPresetRecommendation,
} = require("@/modules/accounting/presets/recommendation-engine");

test("activity catalog exposes refined official subclasses and legacy coarse codes require refinement", () => {
  const refined = getActivityByCode("47521");
  const legacy = getActivityByCode("47520");

  assert.equal(refined.displayCode, "4752.1");
  assert.equal(refined.isSelectable, true);
  assert.equal(legacy.isLegacySelection, true);
  assert.equal(legacy.requiresRefinement, true);
  assert.equal(legacy.legacyResolvedCode, "4752");
});

test("activity catalog children resolve official subclasses from a parent class", () => {
  const children = getActivityChildren("7020", { selectableOnly: true });

  assert.ok(children.some((entry) => entry.code === "70201"));
  assert.ok(children.some((entry) => entry.code === "70202"));
});

test("activity search finds refined subclasses through aliases and descriptions", () => {
  const results = searchActivities("consultoria de gestion", 5, {
    selectableOnly: true,
  });

  assert.ok(results.length > 0);
  assert.equal(results[0].code, "70201");
});

test("preset recommendation inherits overlays from retail subclasses", () => {
  const recommendation = buildPresetRecommendation({
    primaryActivityCode: "47521",
    secondaryActivityCodes: [],
    selectedTraits: ["public_tenders"],
    shortDescription: "Ferreteria de barrio",
  });

  assert.ok(recommendation.recommended.overlayCodes.includes("CIIU_47_RETAIL_V1"));
});

test("preset recommendation inherits overlays from agro subclasses", () => {
  const recommendation = buildPresetRecommendation({
    primaryActivityCode: "01411",
    secondaryActivityCodes: [],
    selectedTraits: ["multi_currency_operations"],
    shortDescription: "Ganaderia bovina",
  });

  assert.ok(recommendation.recommended.overlayCodes.includes("CIIU_01_03_AGRO_V1"));
});
