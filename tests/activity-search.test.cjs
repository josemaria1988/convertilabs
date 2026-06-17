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

test("activity search resolves software and SaaS terms to information technology subclasses", () => {
  const softwareResults = searchActivities("software contable", 8, {
    selectableOnly: true,
  });
  const saasResults = searchActivities("saas", 8, {
    selectableOnly: true,
  });
  const aiResults = searchActivities("inteligencia artificial", 8, {
    selectableOnly: true,
  });
  const automatedAccountingResults = searchActivities("contabilidad automatizada", 8, {
    selectableOnly: true,
  });

  assert.ok(softwareResults.length > 0);
  assert.equal(softwareResults[0].code, "62010");
  assert.ok(saasResults.length > 0);
  assert.equal(saasResults[0].code, "62010");
  assert.ok(aiResults.length > 0);
  assert.equal(aiResults[0].code, "62010");
  assert.ok(automatedAccountingResults.length > 0);
  assert.equal(automatedAccountingResults[0].code, "62010");
});

test("activity search resolves web platform terms without preferring construction platforms", () => {
  const results = searchActivities("plataforma web", 8, {
    selectableOnly: true,
  });

  assert.ok(results.length > 0);
  assert.equal(results[0].code, "63120");
  assert.notEqual(results[0].code, "43902");
});

test("activity search resolves import and wholesale terms to broad commercial categories", () => {
  const importResults = searchActivities("importador", 8, {
    selectableOnly: true,
  });
  const genericWholesaleResults = searchActivities("importador mayorista productos varios", 8, {
    selectableOnly: true,
  });

  assert.equal(importResults[0].code, "46530");
  assert.ok(importResults.some((entry) => entry.code === "46590"));
  assert.ok(importResults.some((entry) => entry.code === "46900"));
  assert.ok(importResults.some((entry) => entry.code === "46699"));
  assert.equal(genericWholesaleResults[0].code, "46900");
});

test("activity search resolves Rontil-like agroindustrial equipment and after-sales terms", () => {
  const equipmentResults = searchActivities("importador maquinaria agroindustrial", 8, {
    selectableOnly: true,
  });
  const maintenanceResults = searchActivities("mantenimiento equipos agroindustriales", 8, {
    selectableOnly: true,
  });

  assert.equal(equipmentResults[0].code, "46530");
  assert.equal(maintenanceResults[0].code, "33120");
});

test("activity search keeps specific vehicle imports above generic importer aliases", () => {
  const results = searchActivities("importador vehiculos", 8, {
    selectableOnly: true,
  });

  assert.equal(results[0].code, "45101");
});

test("activity search resolves waste container sales as products, not waste management", () => {
  const results = searchActivities("contenedores residuos", 8, {
    selectableOnly: true,
  });

  assert.equal(results[0].code, "46699");
  assert.ok(results.some((entry) => entry.code === "47739"));
  assert.ok(!results.some((entry) => entry.code.startsWith("381")));
});

test("activity search does not return arbitrary selectable rows for unknown text", () => {
  const results = searchActivities("convertilabs", 8, {
    selectableOnly: true,
  });

  assert.deepEqual(results, []);
});

test("activity suggestions from text remain deterministic and non-empty for common business descriptions", () => {
  const results = getSuggestedActivitiesFromText(
    "Vendemos equipos y repuestos, hacemos instalacion y mantenimiento tecnico.",
    3,
  );

  assert.ok(results.length > 0);
  assert.ok(results.some((entry) => entry.code.startsWith("46") || entry.code.startsWith("33")));
});
