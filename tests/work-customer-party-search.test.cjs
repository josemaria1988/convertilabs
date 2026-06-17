/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

test("Customer party search filters by normalized name tokens and RUT", () => {
  const { filterCustomerPartyOptions } = require("@/components/work/customer-party-search-field");
  const options = [
    { id: "party-1", displayName: "Rontil S.A.", taxId: "210000000019" },
    { id: "party-2", displayName: "Consumidor final", taxId: null },
    { id: "party-3", displayName: "Agro Industrial del Litoral", taxId: "216667770011" },
  ];

  assert.deepEqual(
    filterCustomerPartyOptions(options, "rontil").map((option) => option.id),
    ["party-1"],
  );
  assert.deepEqual(
    filterCustomerPartyOptions(options, "210000").map((option) => option.id),
    ["party-1"],
  );
  assert.deepEqual(
    filterCustomerPartyOptions(options, "agro litoral").map((option) => option.id),
    ["party-3"],
  );
});

test("Customer party search limits empty query results", () => {
  const { filterCustomerPartyOptions } = require("@/components/work/customer-party-search-field");
  const options = Array.from({ length: 60 }, (_, index) => ({
    id: `party-${index}`,
    displayName: `Cliente ${index}`,
    taxId: null,
  }));

  assert.equal(filterCustomerPartyOptions(options, "").length, 40);
  assert.equal(filterCustomerPartyOptions(options, "", 8).length, 8);
});
