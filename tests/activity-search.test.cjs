/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  getSuggestedActivitiesFromText,
  searchActivities,
} = require("@/modules/organizations/activity-search");

test("activity search matches aliases and natural terms", () => {
  const results = searchActivities("repuestos maquinaria");

  assert.ok(results.length > 0);
  assert.equal(results[0].code, "46590");
});

test("activity suggestions from text remain deterministic and non-empty for common business descriptions", () => {
  const results = getSuggestedActivitiesFromText(
    "Vendemos equipos y repuestos, hacemos instalacion y mantenimiento tecnico.",
    3,
  );

  assert.ok(results.length > 0);
  assert.ok(results.some((entry) => entry.code.startsWith("46") || entry.code.startsWith("33")));
});
