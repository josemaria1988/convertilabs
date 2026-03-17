/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  isMissingDocumentStep5ColumnError,
  omitDocumentStep5Columns,
} = require("@/modules/accounting/step5-schema-compat");

test("document step5 schema compat recognizes functional currency and original amount columns", () => {
  assert.equal(
    isMissingDocumentStep5ColumnError({
      message: "Could not find the 'functional_currency_code' column of 'documents' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingDocumentStep5ColumnError({
      message: "Could not find the 'original_total_amount' column of 'documents' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingDocumentStep5ColumnError({
      message: "Could not find the 'some_other_column' column of 'documents' in the schema cache",
    }),
    false,
  );
});

test("document step5 schema compat strips functional and original amount payload fields", () => {
  assert.deepEqual(
    omitDocumentStep5Columns({
      status: "draft_ready",
      functional_currency_code: "UYU",
      functional_total_amount_uyu: 123,
      original_total_amount: 100,
    }),
    {
      status: "draft_ready",
    },
  );
});
