/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveDocumentContextLabel,
} = require("@/modules/presentation/field-mobile");

test("field mobile context labels prefer work units over legacy projects", () => {
  const label = resolveDocumentContextLabel({
    item: {
      workUnitId: "work-1",
      costCenterId: "cost-1",
    },
    workUnitNameById: new Map([["work-1", "Trabajo ADP Caraguata"]]),
    costCenterNameById: new Map([["cost-1", "Proyecto viejo"]]),
  });

  assert.equal(label, "Trabajo: Trabajo ADP Caraguata");
});

test("field mobile context labels keep project fallback for older assignments", () => {
  const label = resolveDocumentContextLabel({
    item: {
      workUnitId: null,
      costCenterId: "cost-1",
    },
    costCenterNameById: new Map([["cost-1", "Proyecto Treinta y Tres"]]),
  });

  assert.equal(label, "Proyecto: Proyecto Treinta y Tres");
});
